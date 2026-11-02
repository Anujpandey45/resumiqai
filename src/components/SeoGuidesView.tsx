import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  FileCheck2,
  FilePenLine,
} from 'lucide-react';
import {
  SEO_GUIDE_ARTICLES,
  SEO_GUIDES_BY_SLUG,
  type SeoGuideArticle,
} from '../data/seoGuides.ts';

interface SeoGuidesViewProps {
  guideSlug: string | null;
  onNavigatePath: (path: string) => void;
}

export function SeoGuidesView({ guideSlug, onNavigatePath }: SeoGuidesViewProps) {
  const handleAnchor = (
    e: React.MouseEvent<HTMLAnchorElement>,
    path: string
  ) => {
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    ) {
      return;
    }
    e.preventDefault();
    onNavigatePath(path);
  };

  const activeArticle: SeoGuideArticle | null = guideSlug
    ? SEO_GUIDES_BY_SLUG[guideSlug] || null
    : null;

  if (!activeArticle) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10 sm:py-14 space-y-10">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400"
        >
          <a
            href="/"
            onClick={(e) => handleAnchor(e, '/')}
            className="hover:text-slate-900 dark:hover:text-white underline-offset-4 hover:underline"
          >
            Home
          </a>
          <span aria-hidden="true">/</span>
          <span className="text-slate-800 dark:text-slate-200 font-medium">
            ATS Resume Guides
          </span>
        </nav>

        <header className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            Practical Career &amp; ATS Resources
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
            ATS Resume Guides &amp; Tips for Job Seekers
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Clear, practical guides explaining how Applicant Tracking Systems parse PDF and Word resumes, how to improve your ATS score honestly, and how freshers can write a strong first CV.
          </p>
        </header>

        <section
          aria-label="All ATS resume guides"
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {SEO_GUIDE_ARTICLES.map((guide) => (
            <article
              key={guide.slug}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 sm:p-7 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-blue-700 dark:text-blue-400">
                    {guide.category}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {guide.readingTimeMinutes} min read
                  </span>
                </div>

                <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
                  <a
                    href={guide.path}
                    onClick={(e) => handleAnchor(e, guide.path)}
                    className="hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
                  >
                    {guide.h1}
                  </a>
                </h2>

                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {guide.metaDescription}
                </p>
              </div>

              <div>
                <a
                  href={guide.path}
                  onClick={(e) => handleAnchor(e, guide.path)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline underline-offset-4"
                >
                  <span>Read Full Guide</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0B1120] p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Ready to build or scan your resume?
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Apply these formatting and keyword principles directly using our 100% free single-column Resume Builder and deterministic 100-point ATS Score Checker.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href="/resume-builder"
              onClick={(e) => handleAnchor(e, '/resume-builder')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-blue-700 hover:bg-blue-600 text-white transition-colors"
            >
              <FilePenLine className="w-4 h-4" />
              Create My Resume
            </a>
            <a
              href="/ats-score-checker"
              onClick={(e) => handleAnchor(e, '/ats-score-checker')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <FileCheck2 className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              Check My ATS Score
            </a>
          </div>
        </section>
      </div>
    );
  }

  const relatedArticles = activeArticle.relatedSlugs
    .map((slug) => SEO_GUIDES_BY_SLUG[slug])
    .filter((item): item is SeoGuideArticle => Boolean(item));

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 sm:py-14 space-y-10">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400"
      >
        <a
          href="/"
          onClick={(e) => handleAnchor(e, '/')}
          className="hover:text-slate-900 dark:hover:text-white underline-offset-4 hover:underline"
        >
          Home
        </a>
        <span aria-hidden="true">/</span>
        <a
          href="/guides"
          onClick={(e) => handleAnchor(e, '/guides')}
          className="hover:text-slate-900 dark:hover:text-white underline-offset-4 hover:underline"
        >
          ATS Resume Guides
        </a>
        <span aria-hidden="true">/</span>
        <span className="text-slate-800 dark:text-slate-200 font-medium">
          {activeArticle.shortNavTitle}
        </span>
      </nav>

      <article className="space-y-9">
        <header className="space-y-4 border-b border-slate-200 dark:border-slate-800 pb-7">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-400">
              <BookOpen className="w-3.5 h-3.5" />
              {activeArticle.category}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {activeArticle.readingTimeMinutes} min read
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
            {activeArticle.h1}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            {activeArticle.summaryLead}
          </p>
        </header>

        {/* Key Takeaways Box */}
        <section
          aria-label="Key takeaways"
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0F172A] p-6 space-y-3"
        >
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Key Takeaways
          </h2>
          <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
            {activeArticle.keyTakeaways.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Main Sections */}
        <div className="space-y-10">
          {activeArticle.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="space-y-4 scroll-mt-24"
            >
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {section.heading}
              </h2>

              {section.paragraphs.map((para, pIdx) => (
                <p
                  key={pIdx}
                  className="text-base text-slate-700 dark:text-slate-300 leading-relaxed"
                >
                  {para}
                </p>
              ))}

              {section.bullets && section.bullets.length > 0 && (
                <ul className="space-y-2.5 pl-5 list-disc text-sm sm:text-base text-slate-700 dark:text-slate-300">
                  {section.bullets.map((bullet, bIdx) => (
                    <li key={bIdx} className="leading-relaxed">
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}

              {section.exampleBox && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-5 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    {section.exampleBox.label}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-3.5 space-y-1">
                      <p className="font-semibold text-rose-800 dark:text-rose-300 text-xs">
                        Weak / Vague Phrasing
                      </p>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        “{section.exampleBox.weakExample}”
                      </p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 space-y-1">
                      <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-xs">
                        Clear ATS-Friendly Phrasing
                      </p>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        “{section.exampleBox.strongExample}”
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <strong className="text-slate-700 dark:text-slate-200">
                      Why this works:
                    </strong>{' '}
                    {section.exampleBox.whyItWorks}
                  </p>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Article FAQs */}
        {activeArticle.faqs.length > 0 && (
          <section className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-5">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Common Questions
            </h2>
            <div className="space-y-4">
              {activeArticle.faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-2"
                >
                  <h3 className="font-semibold text-base text-slate-900 dark:text-white">
                    {faq.question}
                  </h3>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Practical Action CTA */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0B1120] p-6 sm:p-7 space-y-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Test Your Resume or Build a Clean Single-Column Draft
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Use our free tools right in your browser—no subscriptions, no locked templates, and no mandatory sign-up.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href="/ats-score-checker"
              onClick={(e) => handleAnchor(e, '/ats-score-checker')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-blue-700 hover:bg-blue-600 text-white transition-colors"
            >
              <FileCheck2 className="w-4 h-4" />
              Check My ATS Score
            </a>
            <a
              href="/resume-builder"
              onClick={(e) => handleAnchor(e, '/resume-builder')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <FilePenLine className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              Create My Resume
            </a>
          </div>
        </section>
      </article>

      {/* Related Guides */}
      {relatedArticles.length > 0 && (
        <aside
          aria-label="Related ATS resume guides"
          className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Related Resume Guides
            </h2>
            <a
              href="/guides"
              onClick={(e) => handleAnchor(e, '/guides')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline underline-offset-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All Guides
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedArticles.map((rel) => (
              <a
                key={rel.slug}
                href={rel.path}
                onClick={(e) => handleAnchor(e, rel.path)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-blue-600 dark:hover:border-blue-500 transition-colors flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                    {rel.category}
                  </p>
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white leading-snug">
                    {rel.shortNavTitle}
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Read guide <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </a>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
