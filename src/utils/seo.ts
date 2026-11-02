import type { AppView } from '../types.ts';
import {
  SEO_GUIDE_ARTICLES,
  SEO_GUIDES_BY_SLUG,
  type SeoGuideArticle,
} from '../data/seoGuides.ts';

export const CANONICAL_SITE_ORIGIN = 'https://resumiq.ai';

export function normalizeCanonicalOrigin(candidate?: string | null): string {
  const trimmed = (candidate || '').trim().replace(/\/+$/, '');
  if (!trimmed) return CANONICAL_SITE_ORIGIN;
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol === 'https:' &&
      /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(parsed.hostname) &&
      !parsed.hostname.includes('localhost')
    ) {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    // Ignore invalid URL strings such as numeric placeholders
  }
  return CANONICAL_SITE_ORIGIN;
}

export interface RouteSeoMetadata {
  path: string;
  title: string;
  description: string;
  canonicalUrl: string;
  ogType: 'website' | 'article';
  robots: string;
  is404: boolean;
}

export interface ResolvedRoute {
  view: AppView;
  guideSlug: string | null;
  guide: SeoGuideArticle | null;
  canonicalPath: string;
  redirectTo: string | null;
  is404: boolean;
}

const INDEXABLE_ROBOTS =
  'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const NOINDEX_ROBOTS = 'noindex, nofollow';

export const CORE_ROUTE_SEO: Record<
  'landing' | 'builder' | 'ats-checker' | 'guides' | 'not-found',
  {
    path: string;
    title: string;
    description: string;
  }
> = {
  landing: {
    path: '/',
    title: 'resumiq.ai – Free ATS Resume Checker & Resume Builder',
    description:
      'Use our Free ATS Resume Checker, AI Resume Analyzer, and step-by-step Resume Builder. Scan PDF or Word resumes against any job description on resumiq.ai.',
  },
  builder: {
    path: '/resume-builder',
    title: 'Free ATS Resume Builder & PDF Download | resumiq.ai',
    description:
      'Create a clean, single-column ATS-friendly resume step by step with live preview. Built for freshers and professionals with free PDF & Word download.',
  },
  'ats-checker': {
    path: '/ats-score-checker',
    title: 'ATS Score Checker & Online Resume Scanner | resumiq.ai',
    description:
      'Upload a PDF or DOCX resume to our free online resume scanner and ATS score checker. Compare skills against any job description for an honest 100-pt score.',
  },
  guides: {
    path: '/guides',
    title: 'ATS Resume Guides & Tips for Freshers | resumiq.ai',
    description:
      'Read practical guides on how ATS resume checkers work, how to improve your ATS score, fresher resume tips, and common formatting mistakes to avoid.',
  },
  'not-found': {
    path: '/404',
    title: 'Page Not Found (404) | resumiq.ai',
    description:
      'The page you requested could not be found on resumiq.ai. Return to our Free ATS Resume Builder, ATS Score Checker, or practical resume guides.',
  },
};

export function resolveRoute(rawPathname: string): ResolvedRoute {
  const cleanRaw = (rawPathname || '/').split('?')[0].split('#')[0] || '/';
  const hasTrailingSlash = cleanRaw.length > 1 && cleanRaw.endsWith('/');
  const normalized = cleanRaw.replace(/\/+$/, '').toLowerCase() || '/';

  // Legacy path 301 canonical redirects
  if (normalized === '/builder' || normalized === '/create-resume') {
    return {
      view: 'builder',
      guideSlug: null,
      guide: null,
      canonicalPath: '/resume-builder',
      redirectTo: '/resume-builder',
      is404: false,
    };
  }
  if (normalized === '/ats-checker' || normalized === '/check-ats-score') {
    return {
      view: 'ats-checker',
      guideSlug: null,
      guide: null,
      canonicalPath: '/ats-score-checker',
      redirectTo: '/ats-score-checker',
      is404: false,
    };
  }

  if (normalized === '/') {
    return {
      view: 'landing',
      guideSlug: null,
      guide: null,
      canonicalPath: '/',
      redirectTo: null,
      is404: false,
    };
  }

  if (normalized === '/resume-builder') {
    return {
      view: 'builder',
      guideSlug: null,
      guide: null,
      canonicalPath: '/resume-builder',
      redirectTo: hasTrailingSlash || cleanRaw !== normalized ? '/resume-builder' : null,
      is404: false,
    };
  }

  if (normalized === '/ats-score-checker') {
    return {
      view: 'ats-checker',
      guideSlug: null,
      guide: null,
      canonicalPath: '/ats-score-checker',
      redirectTo: hasTrailingSlash || cleanRaw !== normalized ? '/ats-score-checker' : null,
      is404: false,
    };
  }

  if (normalized === '/guides') {
    return {
      view: 'guides',
      guideSlug: null,
      guide: null,
      canonicalPath: '/guides',
      redirectTo: hasTrailingSlash || cleanRaw !== normalized ? '/guides' : null,
      is404: false,
    };
  }

  if (normalized.startsWith('/guides/')) {
    const slug = normalized.slice('/guides/'.length);
    const guide = SEO_GUIDES_BY_SLUG[slug];
    if (guide) {
      return {
        view: 'guide-detail',
        guideSlug: guide.slug,
        guide,
        canonicalPath: guide.path,
        redirectTo: hasTrailingSlash || cleanRaw !== guide.path ? guide.path : null,
        is404: false,
      };
    }
  }

  return {
    view: 'not-found',
    guideSlug: null,
    guide: null,
    canonicalPath: cleanRaw,
    redirectTo: null,
    is404: true,
  };
}

export function getRouteSeoMetadata(
  pathname: string,
  siteOrigin = CANONICAL_SITE_ORIGIN
): RouteSeoMetadata {
  const origin = normalizeCanonicalOrigin(siteOrigin);
  const resolved = resolveRoute(pathname);

  if (resolved.is404) {
    return {
      path: resolved.canonicalPath,
      title: CORE_ROUTE_SEO['not-found'].title,
      description: CORE_ROUTE_SEO['not-found'].description,
      canonicalUrl: `${origin}/`,
      ogType: 'website',
      robots: NOINDEX_ROBOTS,
      is404: true,
    };
  }

  if (resolved.view === 'guide-detail' && resolved.guide) {
    return {
      path: resolved.guide.path,
      title: resolved.guide.seoTitle,
      description: resolved.guide.metaDescription,
      canonicalUrl: `${origin}${resolved.guide.path}`,
      ogType: 'article',
      robots: INDEXABLE_ROBOTS,
      is404: false,
    };
  }

  const key =
    resolved.view === 'builder' ||
    resolved.view === 'ats-checker' ||
    resolved.view === 'guides'
      ? resolved.view
      : 'landing';
  const entry = CORE_ROUTE_SEO[key];
  const canonicalUrl =
    entry.path === '/' ? `${origin}/` : `${origin}${entry.path}`;

  return {
    path: entry.path,
    title: entry.title,
    description: entry.description,
    canonicalUrl,
    ogType: 'website',
    robots: INDEXABLE_ROBOTS,
    is404: false,
  };
}

export function getAllPublicSitemapEntries(siteOrigin = CANONICAL_SITE_ORIGIN) {
  const origin = normalizeCanonicalOrigin(siteOrigin);
  const corePages = [
    {
      loc: `${origin}/`,
      priority: '1.0',
      changefreq: 'weekly',
      lastmod: '2026-10-31',
      images: [
        {
          loc: `${origin}/og-resumiq.jpg`,
          title: 'resumiq.ai – Free ATS Resume Checker & Resume Builder',
        },
        {
          loc: `${origin}/images/resumiq-hero.jpg`,
          title: 'resumiq.ai Free Resume Builder and Online Resume Scanner',
        },
      ],
    },
    {
      loc: `${origin}/resume-builder`,
      priority: '0.9',
      changefreq: 'weekly',
      lastmod: '2026-10-31',
      images: [],
    },
    {
      loc: `${origin}/ats-score-checker`,
      priority: '0.9',
      changefreq: 'weekly',
      lastmod: '2026-10-31',
      images: [],
    },
    {
      loc: `${origin}/guides`,
      priority: '0.8',
      changefreq: 'weekly',
      lastmod: '2026-10-31',
      images: [],
    },
  ];

  const guidePages = SEO_GUIDE_ARTICLES.map((guide) => ({
    loc: `${origin}${guide.path}`,
    priority: '0.8',
    changefreq: 'monthly',
    lastmod: guide.updatedDate,
    images: [],
  }));

  return [...corePages, ...guidePages];
}

export function buildRouteJsonLd(
  pathname: string,
  siteOrigin = CANONICAL_SITE_ORIGIN
): Record<string, unknown> {
  const origin = normalizeCanonicalOrigin(siteOrigin);
  const resolved = resolveRoute(pathname);
  const meta = getRouteSeoMetadata(pathname, origin);

  const organizationNode = {
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: 'resumiq.ai',
    url: `${origin}/`,
    logo: {
      '@type': 'ImageObject',
      url: `${origin}/favicon.svg`,
    },
  };

  const websiteNode = {
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    url: `${origin}/`,
    name: 'resumiq.ai',
    inLanguage: 'en',
    description: CORE_ROUTE_SEO.landing.description,
    publisher: {
      '@id': `${origin}/#organization`,
    },
  };

  if (resolved.is404) {
    return {
      '@context': 'https://schema.org',
      '@graph': [organizationNode, websiteNode],
    };
  }

  if (resolved.view === 'guide-detail' && resolved.guide) {
    const g = resolved.guide;
    const graph: Record<string, unknown>[] = [
      organizationNode,
      websiteNode,
      {
        '@type': 'BreadcrumbList',
        '@id': `${origin}${g.path}#breadcrumbs`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${origin}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'ATS Resume Guides',
            item: `${origin}/guides`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: g.shortNavTitle,
            item: `${origin}${g.path}`,
          },
        ],
      },
      {
        '@type': 'Article',
        '@id': `${origin}${g.path}#article`,
        headline: g.h1,
        description: g.metaDescription,
        inLanguage: 'en',
        datePublished: g.publishedDate,
        dateModified: g.updatedDate,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${origin}${g.path}`,
        },
        author: {
          '@id': `${origin}/#organization`,
        },
        publisher: {
          '@id': `${origin}/#organization`,
        },
        image: `${origin}/og-resumiq.jpg`,
      },
    ];

    if (g.faqs.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        '@id': `${origin}${g.path}#faq`,
        mainEntity: g.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.answer,
          },
        })),
      });
    }

    return {
      '@context': 'https://schema.org',
      '@graph': graph,
    };
  }

  if (resolved.view === 'guides') {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        organizationNode,
        websiteNode,
        {
          '@type': 'BreadcrumbList',
          '@id': `${origin}/guides#breadcrumbs`,
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: `${origin}/`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'ATS Resume Guides',
              item: `${origin}/guides`,
            },
          ],
        },
        {
          '@type': 'CollectionPage',
          '@id': `${origin}/guides#collection`,
          name: meta.title,
          description: meta.description,
          url: `${origin}/guides`,
          hasPart: SEO_GUIDE_ARTICLES.map((g) => ({
            '@type': 'Article',
            headline: g.h1,
            url: `${origin}${g.path}`,
          })),
        },
      ],
    };
  }

  if (resolved.view === 'builder' || resolved.view === 'ats-checker') {
    const label =
      resolved.view === 'builder'
        ? 'Free ATS Resume Builder'
        : 'Free ATS Score Checker';
    return {
      '@context': 'https://schema.org',
      '@graph': [
        organizationNode,
        websiteNode,
        {
          '@type': 'BreadcrumbList',
          '@id': `${meta.canonicalUrl}#breadcrumbs`,
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: `${origin}/`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: label,
              item: meta.canonicalUrl,
            },
          ],
        },
        {
          '@type': 'WebApplication',
          '@id': `${meta.canonicalUrl}#webapp`,
          name: meta.title,
          url: meta.canonicalUrl,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'All',
          isAccessibleForFree: true,
          description: meta.description,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
        },
      ],
    };
  }

  // Home ('/')
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationNode,
      websiteNode,
      {
        '@type': 'WebApplication',
        '@id': `${origin}/#webapp`,
        name: 'resumiq.ai – Free ATS Resume Checker & Resume Builder',
        url: `${origin}/`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'All',
        isAccessibleForFree: true,
        browserRequirements: 'Requires JavaScript for live interactive editing',
        description:
          '100% free step-by-step ATS-friendly resume builder with live PDF/DOCX export and deterministic 100-point ATS resume score checker and online resume scanner.',
        featureList: [
          'Free ATS Resume Checker & 100-Point Score Breakdown',
          'Step-by-Step ATS-Friendly Resume Builder with Live Preview',
          'Instant Free PDF and Word (.docx) Download Without Mandatory Sign-Up',
          'Required vs. Preferred Job Description Keyword Matching',
          'Resume Checker for Freshers with Optional Work Experience',
        ],
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${origin}/#breadcrumbs`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${origin}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Free ATS Resume Builder',
            item: `${origin}/resume-builder`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Free ATS Score Checker',
            item: `${origin}/ats-score-checker`,
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: 'ATS Resume Guides',
            item: `${origin}/guides`,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${origin}/#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Is resumiq.ai really 100% free with no hidden paywalls?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. Every ATS-friendly resume template, PDF or Word download, and 100-point ATS resume check is completely free. There are no paid plans, subscriptions, or locked downloads.',
            },
          },
          {
            '@type': 'Question',
            name: 'How is the 100-point ATS resume score calculated?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'We use one centralized, deterministic 100-point scoring formula evaluating 10 weighted categories: Job Description Keyword Matching (20), Technical Skills (15), Work Experience (14), Formatting & Readability (12), Projects & Achievements (10), Contact Information (8), Professional Summary (7), Education (6), Grammar & Spelling (5), and Certifications (3).',
            },
          },
          {
            '@type': 'Question',
            name: 'Can freshers use this ATS resume checker and builder without work experience?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. Work experience is optional in our Resume Builder, and our resume checker for freshers evaluates academic projects, technical skills, internships, education, and certifications fairly.',
            },
          },
          {
            '@type': 'Question',
            name: 'Does a high ATS score guarantee interview selection?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'No. Every employer configures its hiring software differently, and human recruiters make the final decision. Our score is an estimated compatibility diagnostic to help you fix formatting and missing job keywords before applying.',
            },
          },
        ],
      },
    ],
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildServerPrerenderMarkup(pathname: string): string {
  const resolved = resolveRoute(pathname);
  const sharedHeader = `<header class="max-w-5xl mx-auto px-6 py-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 font-sans">
    <a href="/" class="text-lg font-bold text-slate-900">resumiq.ai</a>
    <nav aria-label="Main navigation" class="flex flex-wrap gap-5 text-sm">
      <a href="/">Home</a>
      <a href="/resume-builder">Create My Resume</a>
      <a href="/ats-score-checker">Check My ATS Score</a>
      <a href="/guides">ATS Guides</a>
    </nav>
  </header>`;

  const guideLinksList = SEO_GUIDE_ARTICLES.map(
    (g) =>
      `<li><a href="${g.path}">${escapeHtml(g.h1)}</a> — ${escapeHtml(g.metaDescription)}</li>`
  ).join('\n');

  const sharedFooter = `<footer class="max-w-5xl mx-auto px-6 py-8 border-t border-slate-200 text-sm text-slate-600 font-sans">
    <p><strong>resumiq.ai</strong> — 100% Free ATS Resume Checker, Online Resume Scanner &amp; Resume Builder.</p>
    <p class="mt-2">
      <a href="/">Home</a> ·
      <a href="/resume-builder">Free ATS Resume Builder</a> ·
      <a href="/ats-score-checker">Free ATS Score Checker</a> ·
      <a href="/guides">ATS Resume Guides</a>
    </p>
  </footer>`;

  if (resolved.is404) {
    return `${sharedHeader}
    <main id="main-content" class="max-w-3xl mx-auto px-6 py-16 font-sans text-slate-900">
      <h1 class="text-3xl font-bold">Page Not Found (404)</h1>
      <p class="mt-4 text-slate-700">Sorry, the page you requested does not exist or may have moved. Choose one of our free tools or resume guides below:</p>
      <ul class="mt-6 space-y-2 list-disc pl-5">
        <li><a href="/">Home — resumiq.ai Overview</a></li>
        <li><a href="/resume-builder">Create My Resume — Free Single-Column ATS Resume Builder</a></li>
        <li><a href="/ats-score-checker">Check My ATS Score — Free 100-Point Online Resume Scanner</a></li>
        <li><a href="/guides">ATS Resume Guides &amp; Tips for Freshers</a></li>
      </ul>
    </main>
    ${sharedFooter}`;
  }

  if (resolved.view === 'guide-detail' && resolved.guide) {
    const g = resolved.guide;
    const sectionsHtml = g.sections
      .map(
        (sec) => `<section id="${escapeHtml(sec.id)}" class="mt-8">
          <h2 class="text-2xl font-bold">${escapeHtml(sec.heading)}</h2>
          ${sec.paragraphs.map((p) => `<p class="mt-3">${escapeHtml(p)}</p>`).join('\n')}
          ${
            sec.bullets && sec.bullets.length > 0
              ? `<ul class="mt-3 list-disc pl-5 space-y-1">${sec.bullets
                  .map((b) => `<li>${escapeHtml(b)}</li>`)
                  .join('')}</ul>`
              : ''
          }
          ${
            sec.exampleBox
              ? `<div class="mt-4 p-4 border border-slate-200 rounded-lg">
                  <p><strong>${escapeHtml(sec.exampleBox.label)}</strong></p>
                  <p class="mt-1"><em>Before:</em> ${escapeHtml(sec.exampleBox.weakExample)}</p>
                  <p class="mt-1"><em>Improved:</em> ${escapeHtml(sec.exampleBox.strongExample)}</p>
                  <p class="mt-1">${escapeHtml(sec.exampleBox.whyItWorks)}</p>
                </div>`
              : ''
          }
        </section>`
      )
      .join('\n');

    const faqsHtml =
      g.faqs.length > 0
        ? `<section class="mt-10">
            <h2 class="text-2xl font-bold">Frequently Asked Questions</h2>
            ${g.faqs
              .map(
                (f) => `<div class="mt-4">
                  <h3 class="text-lg font-semibold">${escapeHtml(f.question)}</h3>
                  <p class="mt-1">${escapeHtml(f.answer)}</p>
                </div>`
              )
              .join('\n')}
          </section>`
        : '';

    return `${sharedHeader}
    <main id="main-content" class="max-w-4xl mx-auto px-6 py-10 font-sans text-slate-900">
      <nav aria-label="Breadcrumb" class="text-sm text-slate-600 mb-4">
        <a href="/">Home</a> / <a href="/guides">ATS Guides</a> / <span>${escapeHtml(g.shortNavTitle)}</span>
      </nav>
      <article>
        <p class="text-sm font-semibold text-blue-700">${escapeHtml(g.category)} · ${g.readingTimeMinutes} min read</p>
        <h1 class="mt-2 text-3xl font-bold">${escapeHtml(g.h1)}</h1>
        <p class="mt-4 text-lg text-slate-700">${escapeHtml(g.summaryLead)}</p>
        <section class="mt-6 p-5 bg-slate-50 border border-slate-200 rounded-xl">
          <h2 class="text-lg font-bold">Key Takeaways</h2>
          <ul class="mt-2 list-disc pl-5 space-y-1">
            ${g.keyTakeaways.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
          </ul>
        </section>
        ${sectionsHtml}
        ${faqsHtml}
        <section class="mt-10 p-6 border border-slate-200 rounded-xl">
          <h2 class="text-xl font-bold">Put This Guide Into Practice for Free</h2>
          <p class="mt-2">Build a clean single-column resume or test your existing PDF/DOCX resume against a job description right now:</p>
          <p class="mt-3"><a href="/resume-builder">Open Free ATS Resume Builder</a> · <a href="/ats-score-checker">Run Free ATS Score Checker</a> · <a href="/guides">Browse All ATS Guides</a></p>
        </section>
      </article>
    </main>
    ${sharedFooter}`;
  }

  if (resolved.view === 'guides') {
    return `${sharedHeader}
    <main id="main-content" class="max-w-5xl mx-auto px-6 py-10 font-sans text-slate-900">
      <nav aria-label="Breadcrumb" class="text-sm text-slate-600 mb-4">
        <a href="/">Home</a> / <span>ATS Resume Guides</span>
      </nav>
      <h1 class="text-3xl font-bold">ATS Resume Guides &amp; Practical Career Tips</h1>
      <p class="mt-3 text-slate-700">Straightforward, honest guides explaining how Applicant Tracking Systems parse resumes, how to improve your ATS score without keyword stuffing, and how freshers can build a strong first CV.</p>
      <ul class="mt-8 space-y-4 list-disc pl-5">
        ${guideLinksList}
      </ul>
    </main>
    ${sharedFooter}`;
  }

  if (resolved.view === 'builder') {
    return `${sharedHeader}
    <main id="main-content" class="max-w-5xl mx-auto px-6 py-10 font-sans text-slate-900">
      <h1 class="text-3xl font-bold">Create My Resume — Free Single-Column ATS Resume Builder</h1>
      <p class="mt-3 text-slate-700">Build a clean, single-column ATS-friendly resume step by step with live preview. Includes Personal Info, Education, Technical Skills, Projects, and optional Work Experience—ideal for both freshers and experienced professionals with instant free PDF and Word (.docx) download.</p>
      <p class="mt-5"><a href="/ats-score-checker">Check Your Resume ATS Score</a> · <a href="/guides/how-to-create-ats-friendly-resume">How to Create an ATS-Friendly Resume</a></p>
    </main>
    ${sharedFooter}`;
  }

  if (resolved.view === 'ats-checker') {
    return `${sharedHeader}
    <main id="main-content" class="max-w-5xl mx-auto px-6 py-10 font-sans text-slate-900">
      <h1 class="text-3xl font-bold">Free ATS Resume Checker &amp; Online Resume Scanner</h1>
      <p class="mt-3 text-slate-700">Upload your PDF or Word (.docx) resume and paste any target job description. Our deterministic 100-point ATS score checker and AI resume analyzer evaluates formatting readability, required vs. preferred job keywords, technical skills, projects, and fresher or experienced career history honestly.</p>
      <p class="mt-5"><a href="/resume-builder">Build an ATS-Friendly Resume</a> · <a href="/guides/what-is-an-ats-resume-checker">What Is an ATS Resume Checker?</a> · <a href="/guides/how-to-improve-ats-resume-score">How to Improve Your ATS Score</a></p>
    </main>
    ${sharedFooter}`;
  }

  // Landing ('/')
  return `${sharedHeader}
  <main id="main-content" class="max-w-5xl mx-auto px-6 py-10 font-sans text-slate-900">
    <section>
      <h1 class="text-3xl font-bold">Free Resume Builder &amp; ATS Score Checker — Ready in Minutes.</h1>
      <p class="mt-4 text-slate-700">Create a professional, single-column ATS-friendly resume with live PDF &amp; Word (.docx) download, or use our free ATS resume checker and online resume scanner to compare your resume against any job description.</p>
      <p class="mt-5"><a href="/resume-builder">Create My Resume</a> · <a href="/ats-score-checker">Check My ATS Score</a></p>
    </section>
    <section class="mt-10">
      <h2 class="text-2xl font-bold">Free Career Tools for Freshers &amp; Experienced Job Seekers</h2>
      <p class="mt-2 text-slate-700">Our 100-point ATS score checker and AI resume analyzer checks formatting parseability, contact details, technical skills, required job keywords, projects, and work experience with transparent scoring criteria.</p>
    </section>
    <section class="mt-10">
      <h2 class="text-2xl font-bold">ATS Resume Guides &amp; Resources</h2>
      <ul class="mt-3 space-y-2 list-disc pl-5">
        ${guideLinksList}
      </ul>
    </section>
  </main>
  ${sharedFooter}`;
}

export function pathToAppView(pathname: string): AppView {
  return resolveRoute(pathname).view;
}

export function appViewToPath(view: AppView, guideSlug?: string | null): string {
  if (view === 'builder') return '/resume-builder';
  if (view === 'ats-checker') return '/ats-score-checker';
  if (view === 'guides') return '/guides';
  if (view === 'guide-detail' && guideSlug && SEO_GUIDES_BY_SLUG[guideSlug]) {
    return SEO_GUIDES_BY_SLUG[guideSlug].path;
  }
  return '/';
}

function setMetaContent(selector: string, content: string) {
  if (typeof document === 'undefined') return;
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (el) {
    el.setAttribute('content', content);
  }
}

export function applyDocumentSeoForPath(pathname: string): void {
  if (typeof document === 'undefined') return;
  const meta = getRouteSeoMetadata(pathname, CANONICAL_SITE_ORIGIN);

  document.title = meta.title;
  setMetaContent('meta[name="description"]', meta.description);
  setMetaContent('meta[name="robots"]', meta.robots);
  setMetaContent('meta[name="googlebot"]', meta.robots);
  setMetaContent('meta[property="og:type"]', meta.ogType);
  setMetaContent('meta[property="og:title"]', meta.title);
  setMetaContent('meta[property="og:description"]', meta.description);
  setMetaContent('meta[property="og:url"]', meta.canonicalUrl);
  setMetaContent('meta[name="twitter:title"]', meta.title);
  setMetaContent('meta[name="twitter:description"]', meta.description);

  const canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonicalLink) {
    canonicalLink.setAttribute('href', meta.canonicalUrl);
  }

  let jsonLdScript = document.querySelector<HTMLScriptElement>(
    'script#resumiq-jsonld[type="application/ld+json"]'
  );
  if (!jsonLdScript) {
    jsonLdScript = document.querySelector<HTMLScriptElement>(
      'script[type="application/ld+json"]'
    );
    if (jsonLdScript) {
      jsonLdScript.id = 'resumiq-jsonld';
    }
  }
  if (jsonLdScript) {
    jsonLdScript.textContent = JSON.stringify(
      buildRouteJsonLd(pathname, CANONICAL_SITE_ORIGIN)
    );
  }
}

export function applyDocumentSeoForView(
  view: AppView,
  guideSlug?: string | null
): void {
  const path =
    view === 'not-found' && typeof window !== 'undefined'
      ? window.location.pathname
      : appViewToPath(view, guideSlug);
  applyDocumentSeoForPath(path);
}
