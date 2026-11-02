import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertTriangle,
  Check,
  FilePenLine,
  FileUp,
  Info,
  Loader2,
  Trash2,
} from 'lucide-react';
import type {
  AtsCheckReport,
  ResumeDocumentData,
  SavedAtsReportRecord,
  SavedResumeRecord,
} from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { fetchJsonSafe } from '../lib/apiClient.ts';
import {
  DEMO_SAMPLE_JOB_DESCRIPTION,
  DEMO_SAMPLE_RAW_RESUME_TEXT,
} from '../data/demoSamples.ts';

interface AtsCheckerViewProps {
  savedResumes: SavedResumeRecord[];
  currentDraftTitle: string;
  currentDraftData: ResumeDocumentData;
  defaultToBuilderDraft?: boolean;
  onOpenBuilder: () => void;
}

function serializeResumeDataToPlainText(data: ResumeDocumentData): string {
  const parts: string[] = [];
  if (data.fullName.trim()) parts.push(data.fullName.trim());

  const contact = [
    data.location.trim() ? `Location: ${data.location.trim()}` : '',
    data.phone.trim(),
    data.email.trim(),
    data.websiteOrLinkedin.trim(),
  ]
    .filter(Boolean)
    .join(' | ');
  if (contact) parts.push(contact);

  if (data.careerObjective.trim()) {
    parts.push(`\nProfessional Summary\n${data.careerObjective.trim()}`);
  }

  const validEdu = data.education.filter(
    (e) => e.institution.trim() || e.degree.trim() || e.field.trim()
  );
  if (validEdu.length > 0) {
    parts.push(
      '\nEducation\n' +
        validEdu
          .map(
            (e) =>
              `${e.institution} — ${e.degree} ${e.field} (${e.graduationDate}) ${e.gpaOrHonors}`
          )
          .join('\n')
    );
  }

  const validSkills = data.technicalSkills.filter((s) => s.items.trim());
  if (validSkills.length > 0) {
    parts.push(
      '\nSkills\n' +
        validSkills.map((s) => `${s.category}: ${s.items}`).join('\n')
    );
  }

  const validExp = data.internships.filter(
    (e) => e.role.trim() || e.company.trim()
  );
  if (validExp.length > 0) {
    parts.push(
      '\nWork Experience\n' +
        validExp
          .map(
            (exp) =>
              `${exp.role} — ${exp.company} (${exp.startDate} - ${exp.endDate})\n` +
              exp.bullets
                .filter((b) => b.trim())
                .map((b) => `• ${b.trim()}`)
                .join('\n')
          )
          .join('\n\n')
    );
  }

  const validProjects = data.projects.filter((p) => p.name.trim());
  if (validProjects.length > 0) {
    parts.push(
      '\nProjects\n' +
        validProjects
          .map(
            (p) =>
              `${p.name} (${p.techStack}) ${p.date}\n` +
              p.bullets
                .filter((b) => b.trim())
                .map((b) => `• ${b.trim()}`)
                .join('\n')
          )
          .join('\n\n')
    );
  }

  const validCerts = data.certifications.filter((c) => c.name.trim());
  if (validCerts.length > 0) {
    parts.push(
      '\nCertifications\n' +
        validCerts
          .map((c) => `• ${c.name} — ${c.issuer} (${c.date})`)
          .join('\n')
    );
  }

  const validAch = data.achievements.filter((a) => a.title.trim());
  if (validAch.length > 0) {
    parts.push(
      '\nAchievements\n' +
        validAch
          .map((a) => `• ${a.title} — ${a.issuerOrContext} (${a.date})`)
          .join('\n')
    );
  }

  return parts.join('\n').trim();
}

function isModernAtsCheckReport(raw: unknown): raw is AtsCheckReport {
  return Boolean(
    raw &&
      typeof raw === 'object' &&
      Array.isArray((raw as AtsCheckReport).criteriaBreakdown)
  );
}

export function AtsCheckerView({
  savedResumes,
  currentDraftTitle,
  currentDraftData,
  defaultToBuilderDraft = false,
  onOpenBuilder,
}: AtsCheckerViewProps) {
  const { firebaseUser, getAuthHeaders } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [sourceMode, setSourceMode] = useState<'upload' | 'builder' | 'sample'>(
    defaultToBuilderDraft ? 'builder' : 'upload'
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBuilderTarget, setSelectedBuilderTarget] = useState<string>('draft');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [consentChecked, setConsentChecked] = useState<boolean>(false);
  const [includeAiTips, setIncludeAiTips] = useState<boolean>(true);

  const [checking, setChecking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkedResumeLabel, setCheckedResumeLabel] = useState<string>('');
  const [report, setReport] = useState<AtsCheckReport | null>(null);

  // Recent Saved Reports (when signed in)
  const [savedReports, setSavedReports] = useState<SavedAtsReportRecord[]>([]);
  const [deletingReportId, setDeletingReportId] = useState<number | null>(null);

  useEffect(() => {
    if (defaultToBuilderDraft) {
      setSourceMode('builder');
      setSelectedBuilderTarget('draft');
    }
  }, [defaultToBuilderDraft]);

  const fetchRecentReports = useCallback(async () => {
    if (!firebaseUser) {
      setSavedReports([]);
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const res = await fetchJsonSafe<{ reports?: SavedAtsReportRecord[] }>(
        '/api/ats/reports',
        { headers, retries: 2 }
      );
      if (res.ok && Array.isArray(res.data?.reports)) {
        setSavedReports(res.data.reports);
      }
    } catch {
      // Ignore transient cold-start report history fetch issues
    }
  }, [firebaseUser, getAuthHeaders]);

  useEffect(() => {
    fetchRecentReports();
  }, [fetchRecentReports]);

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setErrorMessage(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
      setErrorMessage(
        'Unsupported file type. Please choose a PDF (.pdf) or Microsoft Word (.docx) resume.'
      );
      setSelectedFile(null);
      return;
    }

    if (file.size === 0) {
      setErrorMessage('The selected file is empty (0 bytes). Please upload a valid resume.');
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File is larger than 10 MB. Please upload a smaller PDF or DOCX file.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleLoadSample = () => {
    setSourceMode('sample');
    setJobDescription(DEMO_SAMPLE_JOB_DESCRIPTION);
    setConsentChecked(true);
    setErrorMessage(null);
  };

  const handleRunAtsCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!consentChecked) {
      setErrorMessage(
        'Please check the permission box below so we can read your resume and calculate your score.'
      );
      return;
    }

    setChecking(true);
    try {
      const headers = await getAuthHeaders();

      if (sourceMode === 'upload') {
        if (!selectedFile) {
          setErrorMessage('Please choose your PDF or Word (.docx) resume file first.');
          setChecking(false);
          return;
        }

        const formData = new FormData();
        formData.append('resumeFile', selectedFile);
        formData.append('fileName', selectedFile.name);
        formData.append('jobDescription', jobDescription);
        formData.append('consentConfirmed', 'true');
        formData.append('includeAiTips', includeAiTips ? 'true' : 'false');

        const res = await fetchJsonSafe<{
          fileName?: string;
          report?: AtsCheckReport;
          error?: string;
        }>('/api/ats/check', {
          method: 'POST',
          headers,
          body: formData,
        });

        const shouldRunBrowserFallback =
          !res.ok &&
          (Boolean(res.isHtmlFallback) ||
            res.status === 404 ||
            res.status === 405 ||
            res.status === 502 ||
            res.status === 503 ||
            res.status === 504);

        if (shouldRunBrowserFallback) {
          try {
            const [{ parseResumeFileInBrowser }, { computeDeterministicAtsReport }] =
              await Promise.all([
                import('../utils/clientDocParser.ts'),
                import('../server/atsScoringEngine.ts'),
              ]);
            const parsedDoc = await parseResumeFileInBrowser(selectedFile);
            const localReport = computeDeterministicAtsReport({
              resumeText: parsedDoc.text,
              fileName: selectedFile.name,
              pageCount: parsedDoc.pageCount,
              structuralNotes: parsedDoc.structuralNotes,
              jobDescription,
            });
            setCheckedResumeLabel(selectedFile.name);
            setReport(localReport);
            return;
          } catch (fallbackErr: any) {
            setErrorMessage(
              fallbackErr?.message ||
                'Could not read or analyze this file. Make sure it is a text-based PDF or Word (.docx) document.'
            );
            return;
          }
        }

        if (!res.ok || !res.data?.report) {
          setErrorMessage(
            res.data?.error ||
              'Could not read or analyze this file. Make sure it is a text-based PDF or Word (.docx) document.'
          );
          return;
        }

        setCheckedResumeLabel(res.data.fileName || selectedFile.name);
        setReport(res.data.report);
        fetchRecentReports();
        return;
      }

      // Builder draft, Saved resume, or Sample resume text mode
      let resumeText = '';
      let label = 'Resume Draft';

      if (sourceMode === 'sample') {
        resumeText = DEMO_SAMPLE_RAW_RESUME_TEXT;
        label = 'Sample Graduate Resume';
      } else {
        if (selectedBuilderTarget === 'draft') {
          resumeText = serializeResumeDataToPlainText(currentDraftData);
          label = currentDraftTitle || 'Current Builder Draft';
        } else {
          const found = savedResumes.find(
            (r) => String(r.id) === selectedBuilderTarget
          );
          if (found) {
            resumeText = serializeResumeDataToPlainText(found.resumeData);
            label = found.title;
          }
        }
      }

      if (resumeText.trim().length < 25) {
        setErrorMessage(
          'Your selected Resume Builder draft is still blank. Fill out your resume in Create My Resume first, or upload a PDF/DOCX file.'
        );
        return;
      }

      const res = await fetchJsonSafe<{
        fileName?: string;
        report?: AtsCheckReport;
        error?: string;
      }>('/api/ats/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          resumeText,
          fileName: label,
          fileType: sourceMode === 'sample' ? 'sample' : 'builder',
          jobDescription,
          consentConfirmed: true,
          includeAiTips,
        }),
      });

      const shouldRunTextFallback =
        !res.ok &&
        (Boolean(res.isHtmlFallback) ||
          res.status === 404 ||
          res.status === 405 ||
          res.status === 502 ||
          res.status === 503 ||
          res.status === 504);

      if (shouldRunTextFallback) {
        const { computeDeterministicAtsReport } = await import(
          '../server/atsScoringEngine.ts'
        );
        const pageCount = Math.max(
          1,
          Math.ceil(resumeText.split(/\s+/).filter(Boolean).length / 450)
        );
        const localReport = computeDeterministicAtsReport({
          resumeText,
          fileName: label,
          pageCount,
          structuralNotes: [],
          jobDescription,
        });
        setCheckedResumeLabel(label);
        setReport(localReport);
        return;
      }

      if (!res.ok || !res.data?.report) {
        setErrorMessage(
          res.data?.error || 'Could not complete the ATS check. Please try again.'
        );
        return;
      }

      setCheckedResumeLabel(res.data.fileName || label);
      setReport(res.data.report);
      fetchRecentReports();
    } finally {
      setChecking(false);
    }
  };

  const handleDeleteSavedReport = async (reportId: number) => {
    setDeletingReportId(reportId);
    try {
      const headers = await getAuthHeaders();
      const res = await fetchJsonSafe(`/api/ats/reports/${reportId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setSavedReports((prev) => prev.filter((r) => r.id !== reportId));
      }
    } finally {
      setDeletingReportId(null);
    }
  };

  const scoreColorClass = (score: number) => {
    if (score >= 80) return 'text-emerald-700 dark:text-emerald-400';
    if (score >= 60) return 'text-amber-700 dark:text-amber-400';
    return 'text-rose-700 dark:text-rose-400';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Free ATS Resume Checker &amp; Online Score Scanner
          </h1>
          <p className="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-300">
            Upload your PDF or Word resume and paste a job description. Our deterministic 100-point ATS score checker and AI resume analyzer works for both freshers and experienced applicants.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLoadSample}
          className="self-start sm:self-auto px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          Try Sample Check
        </button>
      </div>

      {/* Simple 2-Step Input Form */}
      <form
        onSubmit={handleRunAtsCheck}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 sm:p-7 space-y-6"
      >
        {/* Step 1: Choose Resume */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-base font-bold text-slate-900 dark:text-white">
              Step 1: Choose Your Resume
            </label>

            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setSourceMode('upload');
                  setErrorMessage(null);
                }}
                className={`px-3 py-1.5 transition-colors ${
                  sourceMode === 'upload'
                    ? 'bg-blue-700 text-white'
                    : 'bg-white dark:bg-[#090D16] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Upload PDF / DOCX
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceMode('builder');
                  setErrorMessage(null);
                }}
                className={`px-3 py-1.5 border-l border-slate-300 dark:border-slate-700 transition-colors ${
                  sourceMode === 'builder'
                    ? 'bg-blue-700 text-white'
                    : 'bg-white dark:bg-[#090D16] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                From Resume Builder
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceMode('sample');
                  setErrorMessage(null);
                }}
                className={`px-3 py-1.5 border-l border-slate-300 dark:border-slate-700 transition-colors ${
                  sourceMode === 'sample'
                    ? 'bg-blue-700 text-white'
                    : 'bg-white dark:bg-[#090D16] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Sample Resume
              </button>
            </div>
          </div>

          {sourceMode === 'upload' && (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-[#090D16] p-6 text-center space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFilePicked}
                className="hidden"
              />
              <FileUp className="w-7 h-7 mx-auto text-blue-700 dark:text-blue-400" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {selectedFile
                    ? `Selected: ${selectedFile.name} (${(
                        selectedFile.size / 1024
                      ).toFixed(0)} KB)`
                    : 'Select your PDF (.pdf) or Word (.docx) resume'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Maximum size 10 MB · Text-based PDFs and Word documents supported
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {selectedFile ? 'Choose a Different File' : 'Browse File'}
                </button>
              </div>
            </div>
          )}

          {sourceMode === 'builder' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Which Resume Builder draft do you want to check?
              </label>
              <select
                value={selectedBuilderTarget}
                onChange={(e) => setSelectedBuilderTarget(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="draft">
                  Current Active Draft ({currentDraftTitle || 'My Resume'})
                </option>
                {savedResumes.map((rec) => (
                  <option key={rec.id} value={String(rec.id)}>
                    Saved Resume: {rec.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {sourceMode === 'sample' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16] p-4 text-sm text-slate-700 dark:text-slate-300">
              Using our built-in <strong>Sample Graduate Resume</strong> so you can see how the ATS score, matched keywords, and missing skill checks work.
            </div>
          )}
        </div>

        {/* Step 2: Paste Job Description */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="job-description-input"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              Step 2: Paste Job Description (Recommended)
            </label>
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => setJobDescription(DEMO_SAMPLE_JOB_DESCRIPTION)}
                className="font-semibold text-blue-700 dark:text-blue-400 hover:underline"
              >
                Paste Sample Job Description
              </button>
              {jobDescription.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setJobDescription('')}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <textarea
            id="job-description-input"
            rows={6}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job posting (responsibilities, required skills, and qualifications) here so we can compare your resume directly against it..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3.5 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            If you leave this blank, we will still check your resume&rsquo;s general ATS readability, contact details, and formatting.
          </p>
        </div>

        {/* Consent & Optional AI Tips Checkboxes */}
        <div className="space-y-3 pt-1">
          <label className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span>
              I allow resumiq.ai to read this resume text to generate my ATS compatibility report.
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAiTips}
              onChange={(e) => setIncludeAiTips(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span>
              Also include 3 personalized writing tips (uses external AI service; never changes your numeric score)
            </span>
          </label>
        </div>

        {/* Honest Error Display */}
        {errorMessage && (
          <div className="rounded-lg bg-rose-50 dark:bg-rose-950/35 border border-rose-300 dark:border-rose-800 px-4 py-3 flex items-start gap-3 text-sm text-rose-900 dark:text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Primary Action Button */}
        <div>
          <button
            type="submit"
            disabled={checking}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl text-base font-semibold bg-blue-700 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
          >
            {checking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Checking Resume...</span>
              </>
            ) : (
              <span>Check My ATS Score</span>
            )}
          </button>
        </div>
      </form>

      {/* ===================================================================== */}
      {/* ATS RESULTS REPORT (Honest, 10-Category Weighted, Zero Clutter)       */}
      {/* ===================================================================== */}
      {report && (() => {
        const criticalIssues = Array.isArray(report.criticalIssues)
          ? report.criticalIssues
          : [];
        const warnings = Array.isArray(report.warnings) ? report.warnings : [];
        const passedChecks = Array.isArray(report.passedChecks)
          ? report.passedChecks
          : [];
        const detectedSections = Array.isArray(report.detectedSections)
          ? report.detectedSections
          : [];
        const jobMatch = report.jobMatch;
        const totalMaxPoints =
          typeof report.totalMaxPoints === 'number'
            ? report.totalMaxPoints
            : report.criteriaBreakdown.reduce((s, c) => s + c.maxPoints, 0);

        return (
          <div className="space-y-8">
            {/* 1. Overall Score & Honest Disclaimer */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 sm:p-8 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-5 border-b border-slate-200 dark:border-slate-800">
                <div className="space-y-1.5">
                  <p className="text-xs font-mono uppercase text-slate-500 dark:text-slate-400">
                    Checked: {checkedResumeLabel} · {report.extractedWordCount} words ·{' '}
                    {report.pageCount} {report.pageCount === 1 ? 'page' : 'pages'}
                  </p>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    Estimated ATS Compatibility Score
                  </h2>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Estimated compatibility score — not an actual employer&rsquo;s proprietary ATS score, and never a guarantee of interview selection.
                  </p>
                  <p className="pt-1 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl">
                    {report.summaryPlainEnglish}
                  </p>
                  {detectedSections.length > 0 && (
                    <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Parsed sections ({detectedSections.length}):
                      </span>{' '}
                      {detectedSections.join(' · ')}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-left md:text-right">
                  <p
                    className={`text-4xl sm:text-5xl font-bold font-mono tabular-nums ${scoreColorClass(
                      report.overallScore
                    )}`}
                  >
                    {report.overallScore}
                    <span className="text-xl sm:text-2xl text-slate-400 dark:text-slate-500">
                      /{totalMaxPoints}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {report.hasJobDescription
                      ? 'Weighted across 10 categories + job description'
                      : 'General 10-category ATS readiness check'}
                  </p>
                </div>
              </div>

              {/* Honest Disclaimer */}
              <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p>{report.disclaimer}</p>
              </div>
            </div>

            {/* 2. Critical Issues, Warnings & Verified Passed Checks */}
            {(criticalIssues.length > 0 ||
              warnings.length > 0 ||
              passedChecks.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Critical Issues */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 space-y-4">
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-rose-700 dark:text-rose-400">
                      Critical Issues
                    </h3>
                    <span className="text-xs font-mono tabular-nums font-semibold text-rose-700 dark:text-rose-400">
                      {criticalIssues.length} found
                    </span>
                  </div>

                  {criticalIssues.length === 0 ? (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2 font-medium">
                      <Check className="w-4 h-4 shrink-0" />
                      Zero critical blockers detected.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {criticalIssues.map((iss) => (
                        <div key={iss.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                          <p className="text-xs font-mono uppercase text-slate-500 dark:text-slate-400">
                            {iss.category}
                          </p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {iss.title}
                          </p>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {iss.explanation}
                          </p>
                          <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                            <span className="font-semibold">Fix:</span> {iss.solution}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Warnings */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 space-y-4">
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-amber-700 dark:text-amber-400">
                      Warnings
                    </h3>
                    <span className="text-xs font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                      {warnings.length} found
                    </span>
                  </div>

                  {warnings.length === 0 ? (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2 font-medium">
                      <Check className="w-4 h-4 shrink-0" />
                      Zero warnings triggered.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {warnings.map((warn) => (
                        <div key={warn.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                          <p className="text-xs font-mono uppercase text-slate-500 dark:text-slate-400">
                            {warn.category}
                          </p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {warn.title}
                          </p>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {warn.explanation}
                          </p>
                          <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                            <span className="font-semibold">Fix:</span> {warn.solution}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Passed Checks (Strictly Verified Only) */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 space-y-4">
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                      Passed Checks
                    </h3>
                    <span className="text-xs font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      {passedChecks.length} verified
                    </span>
                  </div>

                  {passedChecks.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      No categories have passed full verification yet. Fix the critical issues and warnings on the left to pass checks.
                    </p>
                  ) : (
                    <ul className="space-y-3 text-sm">
                      {passedChecks.map((chk) => (
                        <li key={chk.id} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {chk.category}
                            </p>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                              {chk.detail}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* 3. 10-Category Score Calculation & Exact Point Deductions */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 sm:p-8 space-y-6">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  How Your Score Was Calculated ({totalMaxPoints} Points Total)
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Category-wise marks across all 10 ATS dimensions, including exact reasons why marks were deducted:
                </p>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {report.criteriaBreakdown.map((item) => {
                  const isInactiveNoJd = item.maxPoints === 0;
                  const pct =
                    item.maxPoints > 0
                      ? Math.round((item.pointsEarned / item.maxPoints) * 100)
                      : 0;
                  const deductions = Array.isArray(item.deductions)
                    ? item.deductions
                    : [];

                  return (
                    <div key={item.key} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
                          {item.label}
                        </span>
                        <span className="font-mono tabular-nums text-sm font-bold text-slate-900 dark:text-white shrink-0">
                          {isInactiveNoJd
                            ? 'N/A (No JD pasted)'
                            : `${item.pointsEarned} / ${item.maxPoints} pts`}
                        </span>
                      </div>

                      {!isInactiveNoJd && (
                        <div className="w-full h-2 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              pct >= 80
                                ? 'bg-emerald-600'
                                : pct >= 55
                                  ? 'bg-blue-600'
                                  : pct > 0
                                    ? 'bg-amber-600'
                                    : 'bg-rose-600'
                            }`}
                            style={{ width: `${item.pointsEarned === 0 ? 0 : Math.max(4, Math.min(100, pct))}%` }}
                          />
                        </div>
                      )}

                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {item.plainExplanation}
                      </p>

                      {deductions.length > 0 && (
                        <div className="pt-1 space-y-1">
                          <p className="text-xs font-semibold uppercase text-rose-700 dark:text-rose-400">
                            Why marks were deducted:
                          </p>
                          <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                            {deductions.map((ded, idx) => (
                              <li key={idx} className="leading-relaxed">
                                {ded}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Job Description Skill & Keyword Matching (Required vs Preferred) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Box A: Matched Skills & Keywords */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Matched Skills &amp; Keywords
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {report.hasJobDescription
                      ? 'Verified in both your resume and the job description'
                      : 'Concrete technical & domain skills detected in your resume'}
                  </p>
                </div>

                {jobMatch && report.hasJobDescription ? (
                  jobMatch.matchedRequiredSkills.length === 0 &&
                  jobMatch.matchedPreferredSkills.length === 0 &&
                  jobMatch.matchedKeywords.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Zero required skills, preferred skills, or domain keywords from this job description matched your resume.
                    </p>
                  ) : (
                    <div className="space-y-3 text-sm">
                      {jobMatch.matchedRequiredSkills.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400 mb-1">
                            Matched Required Skills ({jobMatch.matchedRequiredSkills.length})
                          </p>
                          <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                            {jobMatch.matchedRequiredSkills.join(' · ')}
                          </p>
                        </div>
                      )}

                      {jobMatch.matchedPreferredSkills.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-400 mb-1">
                            Matched Preferred / Bonus Skills ({jobMatch.matchedPreferredSkills.length})
                          </p>
                          <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                            {jobMatch.matchedPreferredSkills.join(' · ')}
                          </p>
                        </div>
                      )}

                      {jobMatch.synonymMatches.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                            Equivalent Technical Terms Recognized ({jobMatch.synonymMatches.length})
                          </p>
                          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                            {jobMatch.synonymMatches
                              .map((s) => `${s.resumeTerm} ↔ ${s.jobTerm}`)
                              .join(' · ')}
                          </p>
                        </div>
                      )}

                      {jobMatch.matchedKeywords.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                            Matched Domain Keywords ({jobMatch.matchedKeywords.length})
                          </p>
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                            {jobMatch.matchedKeywords.join(' · ')}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                ) : report.skillMatches.length === 0 &&
                  report.matchedKeywords.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    No recognizable technical or domain skills were found yet. Check that your Skills section lists specific tools and technologies.
                  </p>
                ) : (
                  <div className="space-y-3 text-sm">
                    {report.skillMatches.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400 mb-1">
                          Detected Resume Skills ({report.skillMatches.length})
                        </p>
                        <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                          {report.skillMatches.join(' · ')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Box B: Missing Required vs Preferred Job Skills & Keywords */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Missing Job Skills &amp; Keywords
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Separated into Required vs. Preferred qualifications from the job posting
                  </p>
                </div>

                {!report.hasJobDescription ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Paste a job description in Step 2 above and run the check again to compare Required vs. Preferred job skills.
                  </p>
                ) : jobMatch ? (
                  jobMatch.missingRequiredSkills.length === 0 &&
                  jobMatch.missingPreferredSkills.length === 0 &&
                  jobMatch.missingKeywords.length === 0 ? (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                      Your resume covers all detected required skills, preferred skills, and domain keywords from this job posting.
                    </p>
                  ) : (
                    <div className="space-y-3 text-sm">
                      {jobMatch.missingRequiredSkills.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-rose-700 dark:text-rose-400 mb-1">
                            Missing Required Skills ({jobMatch.missingRequiredSkills.length})
                          </p>
                          <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                            {jobMatch.missingRequiredSkills.join(' · ')}
                          </p>
                        </div>
                      )}

                      {jobMatch.missingPreferredSkills.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-400 mb-1">
                            Missing Preferred / Nice-to-Have Skills ({jobMatch.missingPreferredSkills.length})
                          </p>
                          <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                            {jobMatch.missingPreferredSkills.join(' · ')}
                          </p>
                        </div>
                      )}

                      {jobMatch.missingKeywords.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                            Other Missing Domain Keywords ({jobMatch.missingKeywords.length})
                          </p>
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                            {jobMatch.missingKeywords.join(' · ')}
                          </p>
                        </div>
                      )}

                      {jobMatch.keywordStuffingDetected && (
                        <p className="text-xs text-rose-700 dark:text-rose-400 font-medium pt-1">
                          Keyword stuffing detected ({jobMatch.stuffedTerms.join(', ')}): repeating terms artificially reduces your score.
                        </p>
                      )}

                      <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                        Important: Only add skills you genuinely possess and can demonstrate in an interview.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="space-y-3 text-sm">
                    {report.missingSkills.length > 0 && (
                      <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                        {report.missingSkills.join(' · ')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Box C: Missing Resume Information */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Missing Basic Resume Information
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Contact details, dates, or standard headings missing from your document
                  </p>
                </div>

                {report.missingInformation.length === 0 ? (
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2 font-medium">
                    <Check className="w-4 h-4 shrink-0" />
                    All essential contact details and core sections are present.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300 list-disc pl-5">
                    {report.missingInformation.map((info, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {info}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Box D: Formatting & Readability Issues */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Formatting &amp; Readability Issues
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Checks for multi-column/table risks, embedded graphics, length, and bullet structure
                  </p>
                </div>

                {report.formattingIssues.length === 0 ? (
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2 font-medium">
                    <Check className="w-4 h-4 shrink-0" />
                    Clean formatting—easy for standard ATS software to read.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300 list-disc pl-5">
                    {report.formattingIssues.map((issue, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* 5. Practical Suggestions to Improve Your Resume */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    Actionable Suggestions to Improve Your Resume
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Prioritized steps based directly on your category deductions above:
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onOpenBuilder}
                  className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  <FilePenLine className="w-4 h-4" />
                  Edit in Resume Builder
                </button>
              </div>

              <ol className="space-y-3 list-decimal pl-5 text-sm sm:text-base text-slate-800 dark:text-slate-200">
                {report.practicalSuggestions.map((step, idx) => (
                  <li key={idx} className="leading-relaxed pl-1">
                    {step}
                  </li>
                ))}
              </ol>

              {/* Optional AI Tailored Writing Tips (never alters score) */}
              {report.aiTailoredTips && report.aiTailoredTips.length > 0 && (
                <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                    Extra Writing Tips for Your Resume
                  </h4>
                  <ul className="space-y-2 list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">
                    {report.aiTailoredTips.map((tip, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Clear Notice if External AI Service Quota is Exhausted */}
              {report.aiQuotaNotice && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-800 px-4 py-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                  {report.aiQuotaNotice}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Signed-in Recent Checks History (Simple & Deletable) */}
      {firebaseUser && savedReports.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Your Recent Saved ATS Checks
          </h3>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            {savedReports.map((item) => {
              const canView = isModernAtsCheckReport(item.report);
              return (
                <div
                  key={item.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {item.fileName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      Score: {item.overallScore}/100 ·{' '}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {canView && (
                      <button
                        type="button"
                        onClick={() => {
                          setCheckedResumeLabel(item.fileName);
                          setReport(item.report as AtsCheckReport);
                          window.scrollTo({ top: 380, behavior: 'smooth' });
                        }}
                        className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                      >
                        View Report
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={deletingReportId === item.id}
                      onClick={() => handleDeleteSavedReport(item.id)}
                      className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
