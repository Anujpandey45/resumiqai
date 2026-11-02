import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  FileCheck2,
  FilePenLine,
} from 'lucide-react';
import type { AppView } from '../types.ts';
import { SEO_GUIDE_ARTICLES } from '../data/seoGuides.ts';
import heroFallbackPhoto from '../assets/images/resumiq_hero_photo.jpeg';

interface LandingPageProps {
  onNavigate: (view: AppView) => void;
  onNavigatePath?: (path: string) => void;
}

export const SIMPLE_FAQS = [
  {
    q: 'Is resumiq.ai really 100% free with no hidden paywalls?',
    a: 'Yes. Every ATS-friendly resume template, PDF or Word download, and 100-point ATS resume check is completely free. There are no paid plans, subscriptions, or locked downloads.',
  },
  {
    q: 'Do I need to sign in before creating a resume or checking my ATS score?',
    a: 'No. You can build your resume, download a PDF, and use our free ATS resume checker right away without an account. Sign in only if you want to save your resumes online to edit later.',
  },
  {
    q: 'How is the 100-point ATS resume score calculated?',
    a: 'We use one centralized, deterministic 100-point scoring formula—never random guesses. Your score evaluates 10 weighted categories totaling 100 points: Job Description Keyword Matching (20), Technical Skills (15), Work Experience (14), Formatting & Readability (12), Projects & Achievements (10), Contact Information (8), Professional Summary (7), Education (6), Grammar & Spelling (5), and Certifications (3).',
  },
  {
    q: 'Which resume file format is best for ATS systems—PDF or Word (.docx)?',
    a: 'Both text-based PDF and Word (.docx) files work well with modern Applicant Tracking Systems as long as the layout uses clean, selectable single-column text without tables or scanned images. You can download both formats for free in our Resume Builder.',
  },
  {
    q: 'Does this work as a resume checker for freshers and college students?',
    a: 'Yes. Work experience is optional in our step-by-step Resume Builder, and our resume checker for freshers evaluates academic projects, technical skills, internships, education, and certifications fairly.',
  },
  {
    q: 'Does a high ATS score guarantee interview selection?',
    a: 'No. Every employer configures its hiring software differently, and human recruiters make the final decision. Our online resume scanner helps you fix missing job keywords, missing contact details, and formatting issues before you apply.',
  },
];

export function LandingPage({ onNavigate, onNavigatePath }: LandingPageProps) {
  const [heroSrc, setHeroSrc] = useState<string>('/images/resumiq-hero.jpg');
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleNavAnchor = (
    e: React.MouseEvent<HTMLAnchorElement>,
    target: AppView
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
    onNavigate(target);
  };

  const handlePathAnchor = (
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
    if (onNavigatePath) {
      e.preventDefault();
      onNavigatePath(path);
    }
  };

  return (
    <div>
      {/* 5-Second Clarity Hero Section — Only Two Main Actions */}
      <section className="max-w-7xl mx-auto px-6 pt-10 pb-16 lg:pt-16 lg:pb-22">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              100% Free · No Subscriptions · Beginner &amp; Fresher Friendly
            </p>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.12] max-w-2xl">
              Free Resume Builder &amp; ATS Score Checker — Ready in Minutes.
            </h1>

            <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Create a clean, single-column ATS-friendly resume step by step and download it as a PDF—or upload your CV to our free ATS resume checker and online resume scanner to see matched keywords and missing skills instantly.
            </p>

            {/* ONLY TWO MAIN ACTIONS ON THE HOMEPAGE */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <a
                href="/resume-builder"
                onClick={(e) => handleNavAnchor(e, 'builder')}
                className="inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-xl text-base font-semibold bg-blue-700 hover:bg-blue-600 text-white transition-colors"
              >
                <FilePenLine className="w-5 h-5 shrink-0" />
                <span>Create My Resume</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </a>

              <a
                href="/ats-score-checker"
                onClick={(e) => handleNavAnchor(e, 'ats-checker')}
                className="inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-xl text-base font-semibold border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
              >
                <FileCheck2 className="w-5 h-5 shrink-0 text-blue-700 dark:text-blue-400" />
                <span>Check My ATS Score</span>
              </a>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Works right away in your browser · Supports PDF &amp; Word (.docx) · Sign in optional
            </p>
          </div>

          <div className="lg:col-span-5">
            {!heroImgFailed ? (
              <div className="max-w-[370px] mx-auto lg:ml-auto rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 shadow-xs">
                <img
                  src={heroSrc}
                  alt="resumiq.ai — Free ATS Resume Checker and Single-Column Resume Builder"
                  width={1200}
                  height={1600}
                  fetchPriority="high"
                  decoding="async"
                  onError={() => {
                    if (heroSrc !== heroFallbackPhoto) {
                      setHeroSrc(heroFallbackPhoto);
                    } else {
                      setHeroImgFailed(true);
                    }
                  }}
                  className="w-full aspect-[3/4] object-cover object-bottom block"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] p-7 space-y-5">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    resumiq.ai
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    Everything you need to apply with confidence
                  </p>
                </div>
                <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Step-by-step form with live resume preview</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>4 clean ATS-friendly templates &amp; free PDF download</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Consistent 100-point ATS check against any job description</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Two Clear Features Overview */}
      <section className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B1120] py-16">
        <div className="max-w-7xl mx-auto px-6 space-y-10">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Two free career tools for freshers &amp; experienced job seekers
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Whether you are writing your very first graduate resume or testing an existing CV with an AI resume analyzer and ATS scanner before applying, choose the tool that fits your step.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Tool 1: Resume Builder */}
            <div className="rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 p-7 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <FilePenLine className="w-6 h-6 text-blue-700 dark:text-blue-400 shrink-0" />
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    01. Simple ATS Resume Builder
                  </h3>
                </div>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  Fill out a clear 5-step form while watching your single-column resume update live on the page. No design skills or sign-up required.
                </p>
                <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>Personal info, Education, Skills, Projects, and optional Experience</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>4 clean, single-column ATS-friendly templates unlocked for free</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>Download crisp PDF or Word (.docx) anytime</span>
                  </li>
                </ul>
              </div>

              <div>
                <a
                  href="/resume-builder"
                  onClick={(e) => handleNavAnchor(e, 'builder')}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline underline-offset-4"
                >
                  Open Free Resume Builder <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Tool 2: ATS Resume Checker */}
            <div className="rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 p-7 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <FileCheck2 className="w-6 h-6 text-blue-700 dark:text-blue-400 shrink-0" />
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    02. Free ATS Resume Checker &amp; Online Scanner
                  </h3>
                </div>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  Upload your PDF or Word resume and paste the job description you want to apply for. Get a clear, repeatable ATS compatibility score out of 100.
                </p>
                <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>Shows matched skills, missing required job keywords, and formatting issues</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>Built as an accurate resume checker for freshers and experienced applicants</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>Explains every point deduction in plain English with practical next steps</span>
                  </li>
                </ul>
              </div>

              <div>
                <a
                  href="/ats-score-checker"
                  onClick={(e) => handleNavAnchor(e, 'ats-checker')}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline underline-offset-4"
                >
                  Open Free ATS Score Checker <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent Scoring Criteria Section */}
      <section className="border-t border-slate-200 dark:border-slate-800 py-16">
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              How our 100-point ATS Score Checker calculates your score
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Identical inputs always produce the exact same score. When you paste a job description into our resume scanner online, your 100-point estimated compatibility score comes from 10 transparent categories:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                pts: '20 pts',
                title: 'JD Keyword Match',
                desc: 'Required vs. preferred job skills, technical synonyms, and role keywords.',
              },
              {
                pts: '15 pts',
                title: 'Technical Skills',
                desc: 'Concrete tools & technologies backed up in your experience or projects.',
              },
              {
                pts: '14 pts',
                title: 'Work Experience',
                desc: 'Timeline clarity, strong action verbs, and measurable scope or results.',
              },
              {
                pts: '12 pts',
                title: 'Formatting & Readability',
                desc: 'Single-column parseability, standard headings, length, and bullet structure.',
              },
              {
                pts: '10 pts',
                title: 'Projects & Achievements',
                desc: 'Documented projects, tech stack details, and concrete outcomes.',
              },
              {
                pts: '8 pts',
                title: 'Contact Information',
                desc: 'Plain-text candidate name, email, phone number, and location/profile link.',
              },
              {
                pts: '7 pts',
                title: 'Professional Summary',
                desc: 'Concise, role-focused summary free of casual first-person clichés.',
              },
              {
                pts: '6 pts',
                title: 'Education',
                desc: 'Institution name, degree or field of study, and graduation year.',
              },
              {
                pts: '5 pts',
                title: 'Grammar & Spelling',
                desc: 'Checks for common resume typos, duplicate words, and capitalization.',
              },
              {
                pts: '3 pts',
                title: 'Certifications',
                desc: 'Verified industry credentials with issuing organization and year.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1.5"
              >
                <p className="text-xl font-bold font-mono tabular-nums text-blue-700 dark:text-blue-400">
                  {item.pts}
                </p>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Practical ATS & Resume Guides Section (Internal Link Discovery) */}
      <section className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B1120] py-16">
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Practical ATS Resume Guides &amp; Tips for Freshers
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-300">
                Learn how hiring software reads resumes, how to raise your job match score ethically, and how to avoid parsing errors.
              </p>
            </div>

            <a
              href="/guides"
              onClick={(e) => handlePathAnchor(e, '/guides')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline underline-offset-4 shrink-0"
            >
              <span>View All Guides</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SEO_GUIDE_ARTICLES.map((guide) => (
              <a
                key={guide.slug}
                href={guide.path}
                onClick={(e) => handlePathAnchor(e, guide.path)}
                className="rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 p-5 hover:border-blue-600 dark:hover:border-blue-500 transition-colors flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{guide.category}</span>
                  </p>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white leading-snug">
                    {guide.shortNavTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {guide.metaDescription}
                  </p>
                </div>

                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                  Read guide <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Beginner Questions (FAQ) */}
      <section className="border-t border-slate-200 dark:border-slate-800 py-16">
        <div className="max-w-3xl mx-auto px-6 space-y-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Frequently asked questions
          </h2>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
            {SIMPLE_FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              const panelId = `faq-panel-${idx}`;
              return (
                <div key={idx} className="py-4">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 text-left font-semibold text-base text-slate-900 dark:text-white"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p
                      id={panelId}
                      className="mt-2.5 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed"
                    >
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
