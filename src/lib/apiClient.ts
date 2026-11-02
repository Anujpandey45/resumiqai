import type { PricingPlanItem, TemplateCatalogItem } from '../types.ts';

const INITIAL_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export const DEFAULT_CATALOG_PLANS: PricingPlanItem[] = [
  {
    id: 1,
    slug: 'free',
    name: 'Free Starter',
    tagline: 'For early-stage job seekers testing resume readiness',
    monthlyPrice: 0,
    scanLimit: 2,
    features: [
      'Up to 2 ATS resume scans',
      'Step-by-step Resume Builder',
      'Classic Executive ATS template',
      'Single resume PDF download',
      'Explicit privacy & deletion controls',
    ],
    updatedAt: INITIAL_TIMESTAMP,
  },
  {
    id: 2,
    slug: 'premium',
    name: 'Premium Pro',
    tagline: 'For active candidates tailoring applications across roles',
    monthlyPrice: 19,
    scanLimit: 50,
    features: [
      'Up to 50 ATS resume scans per month',
      'All 4 ATS-friendly templates unlocked',
      'AI Improvement Assistant & ethical bullet rewriting',
      'Job Description Matcher with keyword gap analysis',
      'Unlimited PDF & DOCX resume downloads',
      'Full version history & one-click snapshots',
    ],
    updatedAt: INITIAL_TIMESTAMP,
  },
];

export const DEFAULT_CATALOG_TEMPLATES: TemplateCatalogItem[] = [
  {
    id: 1,
    slug: 'classic-executive',
    name: 'Classic Executive',
    category: 'Standard & Corporate',
    description:
      'Traditional single-column layout with centered contact header and clean section lines.',
    isPremium: false,
    isActive: true,
    updatedAt: INITIAL_TIMESTAMP,
  },
  {
    id: 2,
    slug: 'modern-tech',
    name: 'Modern Tech',
    category: 'Software & IT',
    description:
      'Left-aligned single-column layout with clear skill rows and crisp navy headings.',
    isPremium: false,
    isActive: true,
    updatedAt: INITIAL_TIMESTAMP,
  },
  {
    id: 3,
    slug: 'minimalist-academic',
    name: 'Minimalist Academic',
    category: 'Students & Freshers',
    description:
      'Calm, easy-to-scan layout ideal for students, fresh graduates, and project-focused resumes.',
    isPremium: false,
    isActive: true,
    updatedAt: INITIAL_TIMESTAMP,
  },
  {
    id: 4,
    slug: 'compact-ats',
    name: 'Compact ATS',
    category: 'One-Page Fit',
    description:
      'Space-saving single-column layout designed to fit detailed experience cleanly on one page.',
    isPremium: false,
    isActive: true,
    updatedAt: INITIAL_TIMESTAMP,
  },
];

export interface SafeJsonResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
  isHtmlFallback?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRequestHeaders(initHeaders?: HeadersInit): Headers {
  const headers = new Headers(initHeaders || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'XMLHttpRequest');
  }
  return headers;
}

function looksLikeHtml(text: string, contentType: string): boolean {
  const trimmed = text.trimStart().slice(0, 64).toLowerCase();
  if (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<head') ||
    trimmed.startsWith('<body') ||
    trimmed.startsWith('<meta') ||
    trimmed.startsWith('<script')
  ) {
    return true;
  }
  if (contentType.toLowerCase().includes('text/html') && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return true;
  }
  return false;
}

/**
 * Safely executes an API fetch expecting JSON.
 * Prevents `SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON`
 * when Cloud Run / proxy cold-starts return an interstitial HTML warmup page,
 * automatically retrying transient warmup responses before surfacing a clean message.
 */
export async function fetchJsonSafe<T = any>(
  url: string,
  init?: RequestInit & { retries?: number }
): Promise<SafeJsonResult<T>> {
  const method = (init?.method || 'GET').toUpperCase();
  const maxRetries =
    init?.retries !== undefined ? init.retries : method === 'GET' ? 3 : 1;
  const headers = buildRequestHeaders(init?.headers);
  const { retries: _ignoredRetries, ...restInit } = init || {};

  let lastStatus = 503;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        credentials: 'same-origin',
        ...restInit,
        headers,
      });

      lastStatus = res.status;
      const contentType = res.headers.get('content-type') || '';
      const rawText = await res.text();
      const trimmed = rawText.trim();

      if (looksLikeHtml(trimmed, contentType)) {
        if (attempt < maxRetries) {
          await sleep(650 * (attempt + 1));
          continue;
        }
        return {
          ok: false,
          status: res.status >= 400 ? res.status : 503,
          isHtmlFallback: true,
          data: {
            error:
              'The workspace server is waking up. Please retry your action in a moment.',
          } as unknown as T,
        };
      }

      if (
        (res.status === 502 || res.status === 503 || res.status === 504) &&
        method === 'GET' &&
        attempt < maxRetries
      ) {
        await sleep(750 * (attempt + 1));
        continue;
      }

      if (!trimmed) {
        return {
          ok: res.ok,
          status: res.status,
          data: (res.ok
            ? {}
            : { error: `Request failed with status ${res.status}.` }) as unknown as T,
        };
      }

      try {
        const parsed = JSON.parse(trimmed) as T;
        return {
          ok: res.ok,
          status: res.status,
          data: parsed,
        };
      } catch {
        if (attempt < maxRetries && method === 'GET') {
          await sleep(650 * (attempt + 1));
          continue;
        }
        return {
          ok: false,
          status: res.status >= 400 ? res.status : 502,
          data: {
            error:
              'Received an unexpected non-JSON response from the server. Please try again.',
          } as unknown as T,
        };
      }
    } catch (networkErr: any) {
      if (attempt < maxRetries && method === 'GET') {
        await sleep(700 * (attempt + 1));
        continue;
      }
      return {
        ok: false,
        status: lastStatus,
        data: {
          error:
            networkErr?.message ||
            'Unable to reach the workspace server. Please check your connection and retry.',
        } as unknown as T,
      };
    }
  }

  return {
    ok: false,
    status: lastStatus,
    data: {
      error: 'Service temporarily unavailable. Please try again shortly.',
    } as unknown as T,
  };
}

/**
 * Safely parses an error message from a binary download response
 * without throwing if the response body is HTML or plain text.
 */
export async function parseErrorFromResponse(
  res: Response,
  fallbackMessage: string
): Promise<string> {
  try {
    const contentType = res.headers.get('content-type') || '';
    const text = (await res.text()).trim();
    if (!text || looksLikeHtml(text, contentType)) {
      return fallbackMessage;
    }
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error;
    }
    return fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}
