import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

interface CachedVerifiedToken {
  decoded: DecodedIdToken;
  expiresAtMs: number;
}

const verifiedGoogleTokenCache = new Map<string, CachedVerifiedToken>();

let cachedTokenServiceHealth: {
  ready: boolean;
  checkedAtMs: number;
} | null = null;

export async function checkFirebaseTokenServiceHealth(): Promise<{
  firebaseTokenServiceReady: boolean;
  oAuthClientId: string;
}> {
  const now = Date.now();
  if (cachedTokenServiceHealth && now - cachedTokenServiceHealth.checkedAtMs < 60_000) {
    return {
      firebaseTokenServiceReady: cachedTokenServiceHealth.ready,
      oAuthClientId: firebaseConfig.oAuthClientId || '',
    };
  }

  let ready = true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: 'health_probe',
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    // When securetoken.googleapis.com is enabled, Google returns 400 INVALID_REFRESH_TOKEN.
    // When disabled in the Cloud project, Google returns 403 SERVICE_DISABLED.
    if (res.status === 403) {
      const body: any = await res.json().catch(() => ({}));
      const msg = String(body?.error?.message || '');
      if (
        msg.includes('Token Service API has not been used') ||
        msg.includes('securetoken.googleapis.com') ||
        body?.error?.status === 'PERMISSION_DENIED'
      ) {
        ready = false;
      }
    }
  } catch {
    // Default to GIS compatibility if probe cannot verify securetoken
    ready = false;
  }

  cachedTokenServiceHealth = {
    ready,
    checkedAtMs: now,
  };

  return {
    firebaseTokenServiceReady: ready,
    oAuthClientId: firebaseConfig.oAuthClientId || '',
  };
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function isLikelyJwt(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts[0].length > 8 && parts[1].length > 8;
}

async function verifyGoogleOAuthAccessToken(
  accessToken: string
): Promise<DecodedIdToken> {
  const expectedClientId = firebaseConfig.oAuthClientId;
  if (!expectedClientId) {
    throw new Error('OAuth client is not configured.');
  }

  const cacheKey = hashToken(accessToken);
  const now = Date.now();
  const hit = verifiedGoogleTokenCache.get(cacheKey);
  if (hit && hit.expiresAtMs > now) {
    return hit.decoded;
  }

  const [tokenInfoRes, userInfoRes] = await Promise.all([
    fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    ),
    fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }),
  ]);

  if (!tokenInfoRes.ok || !userInfoRes.ok) {
    throw new Error('Invalid or expired Google OAuth access token.');
  }

  const tokenInfo: any = await tokenInfoRes.json();
  const userInfo: any = await userInfoRes.json();

  const audMatches =
    tokenInfo.aud === expectedClientId || tokenInfo.azp === expectedClientId;
  if (!audMatches) {
    throw new Error('OAuth token audience does not match application client ID.');
  }

  const expiresInSec = Number(tokenInfo.expires_in || 0);
  if (expiresInSec <= 0) {
    throw new Error('OAuth access token has expired.');
  }

  const sub = String(userInfo.sub || tokenInfo.sub || '').trim();
  const email = String(userInfo.email || tokenInfo.email || '').trim();
  const emailVerified =
    userInfo.email_verified === true ||
    tokenInfo.email_verified === 'true' ||
    tokenInfo.email_verified === true;

  if (!sub || !email || !emailVerified) {
    throw new Error('Verified Google account email is required.');
  }

  const nowSec = Math.floor(now / 1000);
  const expSec = nowSec + expiresInSec;
  const decoded = {
    uid: sub,
    sub,
    email,
    email_verified: true,
    name: userInfo.name || email.split('@')[0],
    picture: userInfo.picture || undefined,
    aud: expectedClientId,
    iss: 'https://accounts.google.com',
    auth_time: nowSec,
    iat: nowSec,
    exp: expSec,
    firebase: {
      identities: { 'google.com': [sub], email: [email] },
      sign_in_provider: 'google.com',
    },
  } as DecodedIdToken;

  const ttlMs = Math.max(5_000, Math.min(120_000, (expiresInSec - 10) * 1000));
  verifiedGoogleTokenCache.set(cacheKey, {
    decoded,
    expiresAtMs: now + ttlMs,
  });

  return decoded;
}

async function verifyBearerToken(token: string): Promise<DecodedIdToken> {
  if (isLikelyJwt(token)) {
    return adminAuth.verifyIdToken(token);
  }
  return verifyGoogleOAuthAccessToken(token);
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decodedToken = await verifyBearerToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying authentication token:', error);
    res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    try {
      const decodedToken = await verifyBearerToken(token);
      req.user = decodedToken;
    } catch (error) {
      console.warn('Optional auth token verification skipped:', error);
    }
  }
  next();
};
