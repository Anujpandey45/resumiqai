import React from 'react';
import { ArrowLeft, BookOpen, FileCheck2, FilePenLine } from 'lucide-react';

interface NotFoundViewProps {
  onNavigatePath: (path: string) => void;
}

export function NotFoundView({ onNavigatePath }: NotFoundViewProps) {
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

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24 space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-mono font-semibold text-blue-700 dark:text-blue-400">
          HTTP 404 · Page Not Found
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          We couldn’t find that page on resumiq.ai
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          The link you followed may be outdated or mistyped. Jump straight to one of our free resume tools or career guides below:
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a
          href="/resume-builder"
          onClick={(e) => handleAnchor(e, '/resume-builder')}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-5 hover:border-blue-600 dark:hover:border-blue-500 transition-colors space-y-2"
        >
          <FilePenLine className="w-5 h-5 text-blue-700 dark:text-blue-400" />
          <h2 className="font-bold text-sm text-slate-900 dark:text-white">
            Create My Resume
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Build a single-column ATS resume with live PDF &amp; Word download.
          </p>
        </a>

        <a
          href="/ats-score-checker"
          onClick={(e) => handleAnchor(e, '/ats-score-checker')}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-5 hover:border-blue-600 dark:hover:border-blue-500 transition-colors space-y-2"
        >
          <FileCheck2 className="w-5 h-5 text-blue-700 dark:text-blue-400" />
          <h2 className="font-bold text-sm text-slate-900 dark:text-white">
            Check My ATS Score
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Scan your PDF or DOCX resume against any job description.
          </p>
        </a>

        <a
          href="/guides"
          onClick={(e) => handleAnchor(e, '/guides')}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-5 hover:border-blue-600 dark:hover:border-blue-500 transition-colors space-y-2"
        >
          <BookOpen className="w-5 h-5 text-blue-700 dark:text-blue-400" />
          <h2 className="font-bold text-sm text-slate-900 dark:text-white">
            ATS Resume Guides
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Learn ATS formatting rules, keyword tips, and fresher resume advice.
          </p>
        </a>
      </div>

      <div>
        <a
          href="/"
          onClick={(e) => handleAnchor(e, '/')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline underline-offset-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to resumiq.ai Homepage
        </a>
      </div>
    </div>
  );
}
