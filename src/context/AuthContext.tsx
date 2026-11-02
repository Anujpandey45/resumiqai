import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  firebaseConfig,
  getFirebaseAuth,
  googleAuthProvider,
} from '../lib/firebase.ts';
import {
  DEFAULT_CATALOG_TEMPLATES,
  fetchJsonSafe,
} from '../lib/apiClient.ts';
import type { UserProfile, TemplateCatalogItem } from '../types.ts';

export interface AuthenticatedSessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}

interface AuthContextValue {
  firebaseUser: User | AuthenticatedSessionUser | null;
  profile: UserProfile | null;
  authLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  templates: TemplateCatalogItem[];
  signInWithGoogle: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
  getAuthHeaders: () => Promise<Record<string, string>>;
  refreshProfile: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: {
              access_token?: string;
              expires_in?: number;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
          revoke?: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function ensureGisScriptLoaded(): Promise<void> {
  if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      const checkInterval = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 60);
      setTimeout(() => {
        clearInterval(checkInterval);
        if (window.google?.accounts?.oauth2) {
          resolve();
        } else {
          reject(new Error('Sign-in service took too long to load.'));
        }
      }, 6000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Unable to load sign-in service.'));
    document.head.appendChild(script);
  });
}

function clearStaleFirebaseIndexedDb() {
  try {
    if (typeof indexedDB !== 'undefined') {
      indexedDB.deleteDatabase('firebaseLocalStorageDb');
    }
  } catch {
    // Ignore IndexedDB cleanup errors
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<
    User | AuthenticatedSessionUser | null
  >(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateCatalogItem[]>(
    DEFAULT_CATALOG_TEMPLATES
  );

  // In-memory OAuth token storage (never persisted to localStorage/sessionStorage)
  const gisAccessTokenRef = useRef<string | null>(null);
  const gisTokenExpiresAtRef = useRef<number>(0);
  const firebaseReadyRef = useRef<boolean>(false);
  const oAuthClientIdRef = useRef<string>(firebaseConfig.oAuthClientId || '');

  const refreshCatalog = useCallback(async () => {
    const res = await fetchJsonSafe<{
      templates?: TemplateCatalogItem[];
    }>('/api/catalog', { retries: 3 });

    if (res.ok && res.data) {
      if (Array.isArray(res.data.templates) && res.data.templates.length > 0) {
        setTemplates(
          res.data.templates.map((t) => ({
            ...t,
            isPremium: false,
          }))
        );
      }
    }
  }, []);

  const syncProfileWithBearerToken = useCallback(async (bearerToken: string) => {
    const res = await fetchJsonSafe<{ user?: UserProfile }>('/api/me', {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
      retries: 3,
    });
    if (res.ok && res.data?.user) {
      setProfile(res.data.user);
      return res.data.user;
    }
    return null;
  }, []);

  const fetchFirebaseUserProfile = useCallback(
    async (user: User) => {
      try {
        const token = await user.getIdToken();
        await syncProfileWithBearerToken(token);
      } catch {
        // Ignore transient token sync issues on initial boot
      }
    },
    [syncProfileWithBearerToken]
  );

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (
      gisAccessTokenRef.current &&
      Date.now() < gisTokenExpiresAtRef.current
    ) {
      return {
        Authorization: `Bearer ${gisAccessTokenRef.current}`,
      };
    }

    if (firebaseReadyRef.current) {
      try {
        const auth = getFirebaseAuth();
        if (auth.currentUser) {
          const token = await auth.currentUser.getIdToken();
          return {
            Authorization: `Bearer ${token}`,
          };
        }
      } catch {
        return {};
      }
    }

    return {};
  }, []);

  const refreshProfile = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers.Authorization) return;
    const res = await fetchJsonSafe<{ user?: UserProfile }>('/api/me', {
      headers,
      retries: 2,
    });
    if (res.ok && res.data?.user) {
      setProfile(res.data.user);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeFirebase: (() => void) | null = null;

    const initAuthRuntime = async () => {
      const capsRes = await fetchJsonSafe<{
        firebaseTokenServiceReady?: boolean;
        oAuthClientId?: string;
      }>('/api/auth/capabilities', { retries: 2 });

      if (cancelled) return;

      if (capsRes.ok && capsRes.data?.oAuthClientId) {
        oAuthClientIdRef.current = capsRes.data.oAuthClientId;
      }

      const tokenServiceReady = Boolean(
        capsRes.ok && capsRes.data?.firebaseTokenServiceReady
      );
      firebaseReadyRef.current = tokenServiceReady;

      if (tokenServiceReady) {
        const auth = getFirebaseAuth();
        unsubscribeFirebase = onAuthStateChanged(auth, async (user) => {
          if (cancelled) return;
          setFirebaseUser(user);
          if (user) {
            await fetchFirebaseUserProfile(user);
          } else if (!gisAccessTokenRef.current) {
            setProfile(null);
          }
          setAuthLoading(false);
        });
      } else {
        // Prevent any stale cached Firebase IndexedDB record from hitting disabled securetoken API
        clearStaleFirebaseIndexedDb();
        setAuthLoading(false);
      }
    };

    initAuthRuntime();

    return () => {
      cancelled = true;
      if (unsubscribeFirebase) {
        unsubscribeFirebase();
      }
    };
  }, [fetchFirebaseUserProfile]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signInViaGoogleIdentityServices = useCallback(async (): Promise<boolean> => {
    const clientId = oAuthClientIdRef.current || firebaseConfig.oAuthClientId;
    if (!clientId) {
      setAuthError('Account sign-in is not configured for this workspace.');
      return false;
    }

    if (!window.google?.accounts?.oauth2) {
      try {
        await ensureGisScriptLoaded();
      } catch (err: any) {
        setAuthError(
          err?.message || 'Unable to initialize sign-in popup.'
        );
        return false;
      }
    }

    return new Promise<boolean>((resolve) => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (!oauth2) {
        setAuthError('Sign-in is unavailable in this browser session.');
        resolve(false);
        return;
      }

      const tokenClient = oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: async (response) => {
          if (response.error || !response.access_token) {
            if (response.error !== 'access_denied') {
              setAuthError(
                response.error_description ||
                  'Sign-in was cancelled or could not complete.'
              );
            }
            resolve(false);
            return;
          }

          const expiresInSec = Number(response.expires_in || 3600);
          gisAccessTokenRef.current = response.access_token;
          gisTokenExpiresAtRef.current =
            Date.now() + Math.max(60, expiresInSec - 30) * 1000;

          try {
            const syncedProfile = await syncProfileWithBearerToken(
              response.access_token
            );
            if (!syncedProfile) {
              gisAccessTokenRef.current = null;
              setAuthError('Unable to synchronize your account profile.');
              resolve(false);
              return;
            }

            setFirebaseUser({
              uid: syncedProfile.uid,
              email: syncedProfile.email,
              displayName: syncedProfile.displayName,
            });
            resolve(true);
          } catch {
            gisAccessTokenRef.current = null;
            setAuthError('Failed to verify sign-in session.');
            resolve(false);
          }
        },
        error_callback: (err) => {
          if (err?.type === 'popup_closed') {
            resolve(false);
            return;
          }
          if (err?.type === 'popup_failed_to_open') {
            setAuthError(
              'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.'
            );
            resolve(false);
            return;
          }
          resolve(false);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    });
  }, [syncProfileWithBearerToken]);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    setAuthError(null);

    // When securetoken.googleapis.com is disabled in GCP, go directly to GIS OAuth2
    // inside the synchronous click gesture so Sign-In succeeds on the very first click.
    if (!firebaseReadyRef.current) {
      return signInViaGoogleIdentityServices();
    }

    try {
      const auth = getFirebaseAuth();
      const credential = await signInWithPopup(auth, googleAuthProvider);
      if (credential.user) {
        await fetchFirebaseUserProfile(credential.user);
      }
      return true;
    } catch (err: any) {
      const code = String(err?.code || '');
      const message = String(err?.message || '');

      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        return false;
      }

      if (
        code.includes('token-service-api-has-not-been-used') ||
        message.includes('securetoken.googleapis.com')
      ) {
        firebaseReadyRef.current = false;
        clearStaleFirebaseIndexedDb();
        return signInViaGoogleIdentityServices();
      }

      if (code === 'auth/popup-blocked') {
        setAuthError(
          'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.'
        );
        return false;
      }

      setAuthError(
        message.replace(/^Firebase:\s*/i, '') ||
          'Sign-in could not be completed. Please try again.'
      );
      return false;
    }
  }, [fetchFirebaseUserProfile, signInViaGoogleIdentityServices]);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    const activeGisToken = gisAccessTokenRef.current;
    gisAccessTokenRef.current = null;
    gisTokenExpiresAtRef.current = 0;

    if (activeGisToken && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(activeGisToken, () => {});
      } catch {
        // ignore revoke errors
      }
    }

    if (firebaseReadyRef.current) {
      try {
        await signOut(getFirebaseAuth());
      } catch {
        // ignore signOut errors
      }
    }

    setFirebaseUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        authLoading,
        authError,
        clearAuthError,
        templates,
        signInWithGoogle,
        signOutUser,
        getAuthHeaders,
        refreshProfile,
        refreshCatalog,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
