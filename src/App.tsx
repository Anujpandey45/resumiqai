import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { LogIn, LogOut, Menu, Moon, Sun, Trash2, X } from 'lucide-react';
import type {
  AppView,
  ResumeDocumentData,
  SavedResumeRecord,
  ThemeMode,
} from './types.ts';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { fetchJsonSafe } from './lib/apiClient.ts';
import { EMPTY_RESUME_DATA } from './data/demoSamples.ts';
import { SEO_GUIDE_ARTICLES } from './data/seoGuides.ts';
import { LandingPage } from './components/LandingPage.tsx';
import {
  applyDocumentSeoForPath,
  appViewToPath,
  resolveRoute,
} from './utils/seo.ts';

const ResumeBuilderView = lazy(() =>
  import('./components/ResumeBuilderView.tsx').then((m) => ({
    default: m.ResumeBuilderView,
  }))
);
const AtsCheckerView = lazy(() =>
  import('./components/AtsCheckerView.tsx').then((m) => ({
    default: m.AtsCheckerView,
  }))
);
const SeoGuidesView = lazy(() =>
  import('./components/SeoGuidesView.tsx').then((m) => ({
    default: m.SeoGuidesView,
  }))
);
const NotFoundView = lazy(() =>
  import('./components/NotFoundView.tsx').then((m) => ({
    default: m.NotFoundView,
  }))
);

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="max-w-5xl mx-auto px-6 py-16 text-sm text-slate-500 dark:text-slate-400"
    >
      Loading workspace…
    </div>
  );
}

function ResumiqWorkspaceShell() {
  const {
    firebaseUser,
    profile,
    authError,
    clearAuthError,
    signInWithGoogle,
    signOutUser,
    getAuthHeaders,
  } = useAuth();

  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window === 'undefined') return '/';
    const initial = resolveRoute(window.location.pathname);
    if (initial.redirectTo) {
      window.history.replaceState({}, '', initial.redirectTo);
      return initial.redirectTo;
    }
    return window.location.pathname || '/';
  });

  const resolvedRoute = resolveRoute(currentPath);
  const view = resolvedRoute.view;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('resumiq_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore storage errors
    }
    return 'light';
  });

  // Active Resume Builder Draft State
  const [draftResumeId, setDraftResumeId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState('My Resume');
  const [draftTemplate, setDraftTemplate] = useState('classic-executive');
  const [draftData, setDraftData] = useState<ResumeDocumentData>(() =>
    structuredClone(EMPTY_RESUME_DATA)
  );

  // If user clicks "Check ATS Score of This Resume" from Builder, preselect Builder draft in Checker
  const [preselectBuilderInChecker, setPreselectBuilderInChecker] = useState(false);

  // Saved Resumes from PostgreSQL (when signed in)
  const [savedResumes, setSavedResumes] = useState<SavedResumeRecord[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('resumiq_theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const fetchSavedResumes = useCallback(async () => {
    if (!firebaseUser) {
      setSavedResumes([]);
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetchJsonSafe<{ resumes?: SavedResumeRecord[] }>(
        '/api/resumes',
        { headers, retries: 2 }
      );
      if (res.ok) {
        setSavedResumes(res.data?.resumes || []);
      }
    } catch {
      // Ignore transient cold-start resume fetch errors
    }
  }, [firebaseUser, getAuthHeaders]);

  useEffect(() => {
    fetchSavedResumes();
  }, [fetchSavedResumes]);

  useEffect(() => {
    applyDocumentSeoForPath(currentPath);
  }, [currentPath]);

  useEffect(() => {
    const handlePopState = () => {
      const nextResolved = resolveRoute(window.location.pathname);
      if (nextResolved.redirectTo) {
        window.history.replaceState({}, '', nextResolved.redirectTo);
        setCurrentPath(nextResolved.redirectTo);
      } else {
        setCurrentPath(window.location.pathname || '/');
      }
      setMobileMenuOpen(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const toggleTheme = () =>
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const navigateToPath = useCallback(
    (nextPath: string, fromBuilderCheck = false) => {
      const resolved = resolveRoute(nextPath);
      const targetPath = resolved.redirectTo || nextPath;
      setPreselectBuilderInChecker(fromBuilderCheck);
      setCurrentPath(targetPath);
      setMobileMenuOpen(false);
      setConfirmDeleteAccount(false);
      if (typeof window !== 'undefined') {
        if (window.location.pathname !== targetPath) {
          window.history.pushState({}, '', targetPath);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    []
  );

  const navigateTo = useCallback(
    (nextView: AppView, fromBuilderCheck = false) => {
      const targetPath = appViewToPath(nextView);
      navigateToPath(targetPath, fromBuilderCheck);
    },
    [navigateToPath]
  );

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetPath: string
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
    navigateToPath(targetPath);
  };

  const handleDeleteAccount = async () => {
    if (!firebaseUser) return;
    setDeletingAccount(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetchJsonSafe('/api/me', {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        await signOutUser();
        setSavedResumes([]);
        setDraftResumeId(null);
        setDraftTitle('My Resume');
        setDraftData(structuredClone(EMPTY_RESUME_DATA));
        setConfirmDeleteAccount(false);
        navigateToPath('/');
      }
    } finally {
      setDeletingAccount(false);
    }
  };

  const navLinks: { id: AppView; path: string; label: string }[] = [
    { id: 'landing', path: '/', label: 'Home' },
    { id: 'builder', path: '/resume-builder', label: 'Create My Resume' },
    { id: 'ats-checker', path: '/ats-score-checker', label: 'Check My ATS Score' },
    { id: 'guides', path: '/guides', label: 'ATS Guides' },
  ];

  const isNavItemActive = (itemId: AppView) => {
    if (itemId === 'guides') {
      return view === 'guides' || view === 'guide-detail';
    }
    return view === itemId;
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#090D16] text-slate-900 dark:text-slate-100">
      {/* Keyboard Skip Link for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-blue-700 focus:text-white focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#090D16]/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => handleLinkClick(e, '/')}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            resumiq<span className="text-blue-700 dark:text-blue-400">.ai</span>
          </a>

          {/* Zone 2: Simple Single-Line Navigation */}
          <nav
            aria-label="Main navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {navLinks.map((item) => {
              const active = isNavItemActive(item.id);
              return (
                <a
                  key={item.id}
                  href={item.path}
                  aria-current={active ? 'page' : undefined}
                  onClick={(e) => handleLinkClick(e, item.path)}
                  className={`whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'text-blue-700 dark:text-blue-400 font-semibold underline underline-offset-8 decoration-2'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: Single Clear Account Control + Mobile Menu Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            {firebaseUser ? (
              <div className="hidden sm:flex items-center gap-3">
                <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[160px]">
                  {profile?.displayName || firebaseUser.displayName || firebaseUser.email}
                </span>
                <button
                  type="button"
                  onClick={signOutUser}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-4 h-4" />
                Sign In to Save
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Simple Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] px-6 py-4 space-y-2">
            {navLinks.map((item) => {
              const active = isNavItemActive(item.id);
              return (
                <a
                  key={item.id}
                  href={item.path}
                  aria-current={active ? 'page' : undefined}
                  onClick={(e) => handleLinkClick(e, item.path)}
                  className={`block w-full text-left px-3.5 py-2.5 rounded-lg text-base font-medium ${
                    active
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              {firebaseUser ? (
                <button
                  type="button"
                  onClick={signOutUser}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 dark:bg-blue-600 text-white"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Save
                </button>
              )}

              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4" /> Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4" /> Dark Mode
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Global Authentication Error Banner */}
      {authError && (
        <div className="max-w-7xl w-full mx-auto px-6 pt-5">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-4 py-3 flex items-start justify-between gap-4 text-sm text-amber-900 dark:text-amber-200">
            <p>{authError}</p>
            <button
              type="button"
              onClick={clearAuthError}
              className="p-1 rounded hover:bg-amber-200/50 dark:hover:bg-amber-900/50 shrink-0"
              aria-label="Close message"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main id="main-content" className="flex-1 w-full">
        {view === 'landing' && (
          <LandingPage
            onNavigate={navigateTo}
            onNavigatePath={navigateToPath}
          />
        )}

        {view === 'builder' && (
          <Suspense fallback={<RouteLoadingFallback />}>
            <div className="max-w-7xl mx-auto px-6 py-8 sm:py-10">
              <ResumeBuilderView
                savedResumes={savedResumes}
                draftResumeId={draftResumeId}
                draftTitle={draftTitle}
                draftTemplate={draftTemplate}
                draftData={draftData}
                onChangeDraft={(next) => {
                  setDraftResumeId(next.id);
                  setDraftTitle(next.title);
                  setDraftTemplate(next.templateSlug);
                  setDraftData(next.data);
                }}
                onSaved={(rec) => {
                  setDraftResumeId(rec.id);
                  setDraftTitle(rec.title);
                  setDraftTemplate(rec.templateSlug);
                  setDraftData(rec.resumeData);
                  fetchSavedResumes();
                }}
                onDeleted={() => {
                  setDraftResumeId(null);
                  setDraftTitle('My Resume');
                  setDraftData(structuredClone(EMPTY_RESUME_DATA));
                  fetchSavedResumes();
                }}
                onCheckThisResume={() => navigateTo('ats-checker', true)}
              />
            </div>
          </Suspense>
        )}

        {view === 'ats-checker' && (
          <Suspense fallback={<RouteLoadingFallback />}>
            <div className="max-w-5xl mx-auto px-6 py-8 sm:py-10">
              <AtsCheckerView
                savedResumes={savedResumes}
                currentDraftTitle={draftTitle}
                currentDraftData={draftData}
                defaultToBuilderDraft={preselectBuilderInChecker}
                onOpenBuilder={() => navigateTo('builder')}
              />
            </div>
          </Suspense>
        )}

        {(view === 'guides' || view === 'guide-detail') && (
          <Suspense fallback={<RouteLoadingFallback />}>
            <SeoGuidesView
              guideSlug={resolvedRoute.guideSlug}
              onNavigatePath={navigateToPath}
            />
          </Suspense>
        )}

        {view === 'not-found' && (
          <Suspense fallback={<RouteLoadingFallback />}>
            <NotFoundView onNavigatePath={navigateToPath} />
          </Suspense>
        )}
      </main>

      {/* Quiet, Crawlable Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B1120]">
        <div className="max-w-7xl mx-auto px-6 py-10 space-y-6 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <p className="font-semibold text-slate-900 dark:text-white">
                resumiq.ai — 100% Free ATS Resume Checker &amp; Resume Builder
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
                Your uploaded files are read in memory only when you ask us to check them and are never sold or shared.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href="/resume-builder"
                onClick={(e) => handleLinkClick(e, '/resume-builder')}
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Create My Resume
              </a>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                ·
              </span>
              <a
                href="/ats-score-checker"
                onClick={(e) => handleLinkClick(e, '/ats-score-checker')}
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Check My ATS Score
              </a>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                ·
              </span>
              <a
                href="/guides"
                onClick={(e) => handleLinkClick(e, '/guides')}
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                ATS Guides
              </a>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                ·
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5" /> Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5" /> Dark Mode
                  </>
                )}
              </button>

              {firebaseUser && (
                <>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                    ·
                  </span>
                  {!confirmDeleteAccount ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAccount(true)}
                      className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Account &amp; Data
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-2 text-xs">
                      <span className="text-rose-700 dark:text-rose-300 font-medium">
                        Delete all saved resumes &amp; reports?
                      </span>
                      <button
                        type="button"
                        disabled={deletingAccount}
                        onClick={handleDeleteAccount}
                        className="px-2.5 py-1 rounded bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50"
                      >
                        {deletingAccount ? 'Deleting...' : 'Yes, Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteAccount(false)}
                        className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Direct Guide Links for Search Engine Discovery */}
          <nav
            aria-label="Resume guides"
            className="pt-5 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-slate-400"
          >
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Guides:
            </span>
            {SEO_GUIDE_ARTICLES.map((g) => (
              <a
                key={g.slug}
                href={g.path}
                onClick={(e) => handleLinkClick(e, g.path)}
                className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 transition-colors"
              >
                {g.shortNavTitle}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ResumiqWorkspaceShell />
    </AuthProvider>
  );
}
