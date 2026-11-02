import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCheck2,
  FileDown,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  AchievementItem,
  CertificationItem,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  ResumeDocumentData,
  SavedResumeRecord,
  SkillGroup,
} from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { fetchJsonSafe } from '../lib/apiClient.ts';
import {
  DEFAULT_SECTION_ORDER,
  DEMO_SAMPLE_RESUME,
  EMPTY_RESUME_DATA,
} from '../data/demoSamples.ts';
import { ResumeLivePreview } from './ResumeLivePreview.tsx';

interface ResumeBuilderViewProps {
  savedResumes: SavedResumeRecord[];
  draftResumeId: number | null;
  draftTitle: string;
  draftTemplate: string;
  draftData: ResumeDocumentData;
  onChangeDraft: (next: {
    id: number | null;
    title: string;
    templateSlug: string;
    data: ResumeDocumentData;
  }) => void;
  onSaved: (record: SavedResumeRecord) => void;
  onDeleted: () => void;
  onCheckThisResume: () => void;
}

const BUILDER_STEPS = [
  { id: 'personal', label: '1. Personal Info' },
  { id: 'education', label: '2. Education' },
  { id: 'skills', label: '3. Skills' },
  { id: 'projects', label: '4. Projects' },
  { id: 'experience', label: '5. Experience (Optional)' },
] as const;

export function ResumeBuilderView({
  savedResumes,
  draftResumeId,
  draftTitle,
  draftTemplate,
  draftData,
  onChangeDraft,
  onSaved,
  onDeleted,
  onCheckThisResume,
}: ResumeBuilderViewProps) {
  const { firebaseUser, templates, signInWithGoogle, getAuthHeaders } = useAuth();

  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'PDF' | 'DOCX' | null>(null);
  const [polishingKey, setPolishingKey] = useState<string | null>(null);
  const [showOptionalExtras, setShowOptionalExtras] = useState(
    () =>
      (draftData.certifications && draftData.certifications.length > 0) ||
      (draftData.achievements && draftData.achievements.length > 0)
  );
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const activeTemplates = templates.filter((t) => t.isActive);

  const updateData = (patch: Partial<ResumeDocumentData>) => {
    onChangeDraft({
      id: draftResumeId,
      title: draftTitle,
      templateSlug: draftTemplate,
      data: {
        ...draftData,
        sectionOrder: draftData.sectionOrder?.length
          ? draftData.sectionOrder
          : [...DEFAULT_SECTION_ORDER],
        ...patch,
      },
    });
  };

  const handleLoadSavedResume = (resumeIdStr: string) => {
    setConfirmDelete(false);
    setStatusMessage(null);
    if (!resumeIdStr) {
      onChangeDraft({
        id: null,
        title: 'My Resume',
        templateSlug: draftTemplate,
        data: structuredClone(EMPTY_RESUME_DATA),
      });
      return;
    }
    const found = savedResumes.find((r) => String(r.id) === resumeIdStr);
    if (found) {
      onChangeDraft({
        id: found.id,
        title: found.title,
        templateSlug: found.templateSlug || 'classic-executive',
        data: found.resumeData,
      });
      if (
        (found.resumeData.certifications && found.resumeData.certifications.length > 0) ||
        (found.resumeData.achievements && found.resumeData.achievements.length > 0)
      ) {
        setShowOptionalExtras(true);
      }
      setStatusMessage({
        type: 'info',
        text: `Loaded "${found.title}".`,
      });
    }
  };

  const handleFillSample = () => {
    setConfirmDelete(false);
    onChangeDraft({
      id: null,
      title: 'Sample Software Engineer Resume',
      templateSlug: draftTemplate,
      data: structuredClone(DEMO_SAMPLE_RESUME),
    });
    setStatusMessage({
      type: 'info',
      text: 'Filled with sample details so you can test the preview and PDF download. Replace with your own details anytime.',
    });
  };

  const handleClearForm = () => {
    setConfirmDelete(false);
    onChangeDraft({
      id: null,
      title: 'My Resume',
      templateSlug: draftTemplate,
      data: structuredClone(EMPTY_RESUME_DATA),
    });
    setStepIdx(0);
    setStatusMessage({
      type: 'info',
      text: 'Started a fresh blank resume.',
    });
  };

  const handleSaveResume = async () => {
    setStatusMessage(null);
    if (!firebaseUser) {
      const signedIn = await signInWithGoogle();
      if (!signedIn) {
        setStatusMessage({
          type: 'info',
          text: 'Sign in to save resumes to your account—or click Download PDF to save directly to your device without signing in.',
        });
        return;
      }
    }

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const payload = {
        title: draftTitle.trim() || 'My Resume',
        templateSlug: draftTemplate,
        resumeData: draftData,
        changeSummary: draftResumeId ? 'Updated resume' : 'Created resume',
      };

      const res = await fetchJsonSafe<{ resume?: SavedResumeRecord; error?: string }>(
        draftResumeId ? `/api/resumes/${draftResumeId}` : '/api/resumes',
        {
          method: draftResumeId ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok || !res.data?.resume) {
        setStatusMessage({
          type: 'error',
          text: res.data?.error || 'Could not save your resume right now. Please try again.',
        });
        return;
      }

      onSaved(res.data.resume);
      setStatusMessage({
        type: 'success',
        text: 'Resume saved to your account.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSavedResume = async () => {
    if (!draftResumeId || !firebaseUser) return;
    setDeleting(true);
    setStatusMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetchJsonSafe<{ deleted?: boolean; error?: string }>(
        `/api/resumes/${draftResumeId}`,
        {
          method: 'DELETE',
          headers,
        }
      );
      if (res.ok) {
        setConfirmDelete(false);
        onDeleted();
        setStatusMessage({
          type: 'info',
          text: 'Saved resume deleted.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.data?.error || 'Could not delete resume.',
        });
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (format: 'PDF' | 'DOCX') => {
    setExportingFormat(format);
    setStatusMessage(null);
    try {
      const exportName = draftData.fullName.trim()
        ? `${draftData.fullName.trim()} Resume`
        : draftTitle.trim() || 'My Resume';

      const { exportResumeAsDocx, exportResumeAsPdf } = await import(
        '../utils/exportResume.ts'
      );
      if (format === 'PDF') {
        await exportResumeAsPdf(draftData, draftTemplate, exportName);
      } else {
        await exportResumeAsDocx(draftData, draftTemplate, exportName);
      }

      // Optionally record download if signed in (non-blocking)
      if (firebaseUser) {
        const headers = await getAuthHeaders();
        fetchJsonSafe('/api/downloads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            resumeId: draftResumeId,
            resumeTitle: draftTitle,
            templateSlug: draftTemplate,
            format,
          }),
        }).catch(() => {});
      }

      setStatusMessage({
        type: 'success',
        text: `Downloaded your ${format} resume.`,
      });
    } catch {
      setStatusMessage({
        type: 'error',
        text: `Could not generate the ${format} file. Please check your details and try again.`,
      });
    } finally {
      setExportingFormat(null);
    }
  };

  const handlePolishText = async (
    key: string,
    mode: 'summary' | 'bullets' | 'project',
    text: string,
    onApply: (improved: string) => void
  ) => {
    const trimmed = text.trim();
    if (trimmed.length < 10) {
      setStatusMessage({
        type: 'info',
        text: 'Write a short draft sentence first, then click Improve Writing to make it clearer.',
      });
      return;
    }

    setPolishingKey(key);
    setStatusMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetchJsonSafe<{
        result?: { improvedText?: string };
        error?: string;
      }>('/api/ai/improve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          mode,
          content: trimmed,
        }),
      });

      if (!res.ok || !res.data?.result?.improvedText) {
        setStatusMessage({
          type: 'error',
          text:
            res.data?.error ||
            'AI writing polish is temporarily unavailable. You can continue editing and downloading your resume normally.',
        });
        return;
      }

      onApply(res.data.result.improvedText);
      setStatusMessage({
        type: 'success',
        text: 'Polished wording while keeping your real facts. Review any [X] placeholders before downloading.',
      });
    } finally {
      setPolishingKey(null);
    }
  };

  // Array Helpers
  const updateEducation = (idx: number, patch: Partial<EducationItem>) => {
    const next = draftData.education.map((item, i) =>
      i === idx ? { ...item, ...patch } : item
    );
    updateData({ education: next });
  };

  const addEducation = () => {
    updateData({
      education: [
        ...draftData.education,
        {
          id: `edu-${Date.now()}`,
          institution: '',
          degree: '',
          field: '',
          graduationDate: '',
          location: '',
          gpaOrHonors: '',
        },
      ],
    });
  };

  const removeEducation = (idx: number) => {
    const next = draftData.education.filter((_, i) => i !== idx);
    updateData({
      education:
        next.length > 0
          ? next
          : [
              {
                id: 'edu-1',
                institution: '',
                degree: '',
                field: '',
                graduationDate: '',
                location: '',
                gpaOrHonors: '',
              },
            ],
    });
  };

  const updateSkillGroup = (idx: number, patch: Partial<SkillGroup>) => {
    const next = draftData.technicalSkills.map((item, i) =>
      i === idx ? { ...item, ...patch } : item
    );
    updateData({ technicalSkills: next });
  };

  const addSkillGroup = () => {
    updateData({
      technicalSkills: [
        ...draftData.technicalSkills,
        {
          id: `skill-${Date.now()}`,
          category: 'Tools & Technologies',
          items: '',
        },
      ],
    });
  };

  const removeSkillGroup = (idx: number) => {
    const next = draftData.technicalSkills.filter((_, i) => i !== idx);
    updateData({
      technicalSkills:
        next.length > 0
          ? next
          : [{ id: 'skill-1', category: 'Core Skills', items: '' }],
    });
  };

  const updateProject = (idx: number, patch: Partial<ProjectItem>) => {
    const next = draftData.projects.map((item, i) =>
      i === idx ? { ...item, ...patch } : item
    );
    updateData({ projects: next });
  };

  const addProject = () => {
    updateData({
      projects: [
        ...draftData.projects,
        {
          id: `proj-${Date.now()}`,
          name: '',
          techStack: '',
          link: '',
          date: '',
          bullets: [''],
        },
      ],
    });
  };

  const removeProject = (idx: number) => {
    const next = draftData.projects.filter((_, i) => i !== idx);
    updateData({ projects: next });
  };

  const updateExperience = (idx: number, patch: Partial<ExperienceItem>) => {
    const next = draftData.internships.map((item, i) =>
      i === idx ? { ...item, ...patch } : item
    );
    updateData({ internships: next });
  };

  const addExperience = () => {
    updateData({
      internships: [
        ...draftData.internships,
        {
          id: `exp-${Date.now()}`,
          role: '',
          company: '',
          type: 'Work Experience',
          location: '',
          startDate: '',
          endDate: '',
          bullets: [''],
        },
      ],
    });
  };

  const removeExperience = (idx: number) => {
    const next = draftData.internships.filter((_, i) => i !== idx);
    updateData({ internships: next });
  };

  const updateCertification = (idx: number, patch: Partial<CertificationItem>) => {
    const next = draftData.certifications.map((c, i) =>
      i === idx ? { ...c, ...patch } : c
    );
    updateData({ certifications: next });
  };

  const updateAchievement = (idx: number, patch: Partial<AchievementItem>) => {
    const next = draftData.achievements.map((a, i) =>
      i === idx ? { ...a, ...patch } : a
    );
    updateData({ achievements: next });
  };

  const activeStep = BUILDER_STEPS[stepIdx];

  const inputClass =
    'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600';
  const labelClass =
    'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Create My Resume — Free ATS Resume Builder
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Fill in each step below. Your single-column ATS-friendly resume preview updates live on the right.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {firebaseUser && savedResumes.length > 0 && (
            <select
              aria-label="Load saved resume"
              value={draftResumeId ? String(draftResumeId) : ''}
              onChange={(e) => handleLoadSavedResume(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
            >
              <option value="">+ New Resume</option>
              {savedResumes.map((rec) => (
                <option key={rec.id} value={String(rec.id)}>
                  Saved: {rec.title}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleFillSample}
            className="px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Fill Example
          </button>

          <button
            type="button"
            onClick={handleClearForm}
            className="px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Start Blank
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveResume}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-blue-600 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{draftResumeId ? 'Save Changes' : 'Save Online'}</span>
          </button>

          {draftResumeId && firebaseUser && (
            <>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              ) : (
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDeleteSavedResume}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700"
                  >
                    {deleting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-2 rounded-lg text-xs border border-slate-300 dark:border-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status Banner */}
      {statusMessage && (
        <div
          className={`rounded-lg px-4 py-3 text-sm border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : statusMessage.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/35 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                : 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Main Split Workspace: Left Step Form | Right Template + Download + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: 5-STEP FORM */}
        <div className="lg:col-span-6 space-y-5">
          {/* Resume Title Input */}
          <div>
            <label htmlFor="resume-title-input" className={labelClass}>
              Resume File Name
            </label>
            <input
              id="resume-title-input"
              type="text"
              value={draftTitle}
              onChange={(e) =>
                onChangeDraft({
                  id: draftResumeId,
                  title: e.target.value,
                  templateSlug: draftTemplate,
                  data: draftData,
                })
              }
              placeholder="e.g., My Software Developer Resume"
              className={inputClass}
            />
          </div>

          {/* 5 Simple Step Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-[#0F172A]">
            {BUILDER_STEPS.map((st, idx) => {
              const isCurrent = idx === stepIdx;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStepIdx(idx)}
                  className={`px-3 py-3 text-xs font-semibold text-center border-b sm:border-b-0 sm:border-r last:border-r-0 border-slate-200 dark:border-slate-800 transition-colors ${
                    isCurrent
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {st.label}
                </button>
              );
            })}
          </div>

          {/* Active Step Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-6 space-y-5">
            {/* STEP 1: PERSONAL INFO */}
            {activeStep.id === 'personal' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Step 1: Personal Information
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Add your name and contact details so employers can reach you easily.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Full Name *</label>
                    <input
                      type="text"
                      value={draftData.fullName}
                      onChange={(e) => updateData({ fullName: e.target.value })}
                      placeholder="e.g., Priya Sharma"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Email Address *</label>
                    <input
                      type="email"
                      value={draftData.email}
                      onChange={(e) => updateData({ email: e.target.value })}
                      placeholder="priya@email.com"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Phone Number *</label>
                    <input
                      type="tel"
                      value={draftData.phone}
                      onChange={(e) => updateData({ phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>City &amp; Country</label>
                    <input
                      type="text"
                      value={draftData.location}
                      onChange={(e) => updateData({ location: e.target.value })}
                      placeholder="Austin, TX"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>LinkedIn or Portfolio Link (Optional)</label>
                    <input
                      type="text"
                      value={draftData.websiteOrLinkedin}
                      onChange={(e) => updateData({ websiteOrLinkedin: e.target.value })}
                      placeholder="linkedin.com/in/yourname"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Short Professional Summary (Optional, 2–3 sentences)
                    </label>
                    <button
                      type="button"
                      disabled={polishingKey === 'summary'}
                      onClick={() =>
                        handlePolishText(
                          'summary',
                          'summary',
                          draftData.careerObjective,
                          (improved) => updateData({ careerObjective: improved })
                        )
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline disabled:opacity-50"
                    >
                      {polishingKey === 'summary' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      Improve Writing
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={draftData.careerObjective}
                    onChange={(e) => updateData({ careerObjective: e.target.value })}
                    placeholder="Briefly describe your degree, core skills, and the type of role you are applying for."
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {/* STEP 2: EDUCATION */}
            {activeStep.id === 'education' && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Step 2: Education
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      List your university, college, or school details (most recent first).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addEducation}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Education
                  </button>
                </div>

                <div className="space-y-5 divide-y divide-slate-200 dark:divide-slate-800">
                  {draftData.education.map((edu, idx) => (
                    <div key={edu.id} className={idx > 0 ? 'pt-5 space-y-4' : 'space-y-4'}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase text-slate-500">
                          Education #{idx + 1}
                        </span>
                        {draftData.education.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEducation(idx)}
                            className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className={labelClass}>School / University Name</label>
                          <input
                            type="text"
                            value={edu.institution}
                            onChange={(e) =>
                              updateEducation(idx, { institution: e.target.value })
                            }
                            placeholder="e.g., State University"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Degree</label>
                          <input
                            type="text"
                            value={edu.degree}
                            onChange={(e) =>
                              updateEducation(idx, { degree: e.target.value })
                            }
                            placeholder="e.g., B.S. or B.Tech"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Major / Field of Study</label>
                          <input
                            type="text"
                            value={edu.field}
                            onChange={(e) =>
                              updateEducation(idx, { field: e.target.value })
                            }
                            placeholder="e.g., Computer Science"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Graduation Month &amp; Year</label>
                          <input
                            type="text"
                            value={edu.graduationDate}
                            onChange={(e) =>
                              updateEducation(idx, { graduationDate: e.target.value })
                            }
                            placeholder="e.g., May 2025"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>GPA / Grade (Optional)</label>
                          <input
                            type="text"
                            value={edu.gpaOrHonors}
                            onChange={(e) =>
                              updateEducation(idx, { gpaOrHonors: e.target.value })
                            }
                            placeholder="e.g., GPA: 3.7 / 4.0"
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3: SKILLS */}
            {activeStep.id === 'skills' && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Step 3: Skills
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      List the real tools, languages, or job skills you know, separated by commas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addSkillGroup}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Group
                  </button>
                </div>

                <div className="space-y-4">
                  {draftData.technicalSkills.map((group, idx) => (
                    <div
                      key={group.id}
                      className="space-y-3 pb-4 border-b last:border-b-0 border-slate-200 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={group.category}
                          onChange={(e) =>
                            updateSkillGroup(idx, { category: e.target.value })
                          }
                          placeholder="Category (e.g., Technical Skills, Tools)"
                          className="w-64 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100"
                        />
                        {draftData.technicalSkills.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSkillGroup(idx)}
                            className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        value={group.items}
                        onChange={(e) =>
                          updateSkillGroup(idx, { items: e.target.value })
                        }
                        placeholder="e.g., Python, SQL, React, Excel, Git, Communication"
                        className={inputClass}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4: PROJECTS */}
            {activeStep.id === 'projects' && (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Step 4: Projects
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Include college, personal, or freelance projects that show your skills in action.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addProject}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Project
                  </button>
                </div>

                {draftData.projects.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No projects added yet. Click &ldquo;Add Project&rdquo; above to add one, or click Next Step.
                  </p>
                )}

                <div className="space-y-6 divide-y divide-slate-200 dark:divide-slate-800">
                  {draftData.projects.map((proj, idx) => (
                    <div key={proj.id} className={idx > 0 ? 'pt-6 space-y-4' : 'space-y-4'}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase text-slate-500">
                          Project #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeProject(idx)}
                          className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          Remove Project
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Project Name</label>
                          <input
                            type="text"
                            value={proj.name}
                            onChange={(e) => updateProject(idx, { name: e.target.value })}
                            placeholder="e.g., Personal Budget Tracker"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Tools / Skills Used</label>
                          <input
                            type="text"
                            value={proj.techStack}
                            onChange={(e) =>
                              updateProject(idx, { techStack: e.target.value })
                            }
                            placeholder="e.g., React, Node.js, PostgreSQL"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Project Link (Optional)</label>
                          <input
                            type="text"
                            value={proj.link}
                            onChange={(e) => updateProject(idx, { link: e.target.value })}
                            placeholder="github.com/yourname/project"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Year / Date</label>
                          <input
                            type="text"
                            value={proj.date}
                            onChange={(e) => updateProject(idx, { date: e.target.value })}
                            placeholder="2025"
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <label className={labelClass}>
                          What did you build or achieve? (Bullet points)
                        </label>
                        {proj.bullets.map((b, bIdx) => {
                          const polishId = `proj-${idx}-${bIdx}`;
                          return (
                            <div key={bIdx} className="space-y-1">
                              <div className="flex items-start gap-2">
                                <input
                                  type="text"
                                  value={b}
                                  onChange={(e) => {
                                    const nextBullets = [...proj.bullets];
                                    nextBullets[bIdx] = e.target.value;
                                    updateProject(idx, { bullets: nextBullets });
                                  }}
                                  placeholder="e.g., Built a web dashboard to track monthly expenses with CSV export."
                                  className={inputClass}
                                />
                                {proj.bullets.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextBullets = proj.bullets.filter(
                                        (_, i) => i !== bIdx
                                      );
                                      updateProject(idx, { bullets: nextBullets });
                                    }}
                                    className="px-2.5 py-2.5 text-xs text-rose-600 hover:underline shrink-0"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  disabled={polishingKey === polishId}
                                  onClick={() =>
                                    handlePolishText(polishId, 'project', b, (improved) => {
                                      const nextBullets = [...proj.bullets];
                                      nextBullets[bIdx] = improved;
                                      updateProject(idx, { bullets: nextBullets });
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline disabled:opacity-50"
                                >
                                  {polishingKey === polishId ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3 h-3" />
                                  )}
                                  Improve Bullet
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() =>
                            updateProject(idx, { bullets: [...proj.bullets, ''] })
                          }
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Bullet Point
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5: EXPERIENCE (OPTIONAL) + OPTIONAL EXTRAS */}
            {activeStep.id === 'experience' && (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Step 5: Work Experience &amp; Internships (Optional)
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Student or fresher with no job history yet? Leave this blank—empty fields will not appear on your resume.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addExperience}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Role
                  </button>
                </div>

                <div className="space-y-6 divide-y divide-slate-200 dark:divide-slate-800">
                  {draftData.internships.map((exp, idx) => (
                    <div key={exp.id} className={idx > 0 ? 'pt-6 space-y-4' : 'space-y-4'}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase text-slate-500">
                          Role #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeExperience(idx)}
                          className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          Remove Role
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Job or Internship Title</label>
                          <input
                            type="text"
                            value={exp.role}
                            onChange={(e) =>
                              updateExperience(idx, { role: e.target.value })
                            }
                            placeholder="e.g., Web Developer Intern"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Company / Organization</label>
                          <input
                            type="text"
                            value={exp.company}
                            onChange={(e) =>
                              updateExperience(idx, { company: e.target.value })
                            }
                            placeholder="e.g., BrightLeaf Media"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Type</label>
                          <select
                            value={exp.type}
                            onChange={(e) =>
                              updateExperience(idx, {
                                type:
                                  e.target.value === 'Internship'
                                    ? 'Internship'
                                    : 'Work Experience',
                              })
                            }
                            className={inputClass}
                          >
                            <option value="Work Experience">Work Experience</option>
                            <option value="Internship">Internship</option>
                          </select>
                        </div>

                        <div>
                          <label className={labelClass}>Location</label>
                          <input
                            type="text"
                            value={exp.location}
                            onChange={(e) =>
                              updateExperience(idx, { location: e.target.value })
                            }
                            placeholder="e.g., Remote or New York, NY"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Start Date</label>
                          <input
                            type="text"
                            value={exp.startDate}
                            onChange={(e) =>
                              updateExperience(idx, { startDate: e.target.value })
                            }
                            placeholder="Jun 2024"
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className={labelClass}>End Date</label>
                          <input
                            type="text"
                            value={exp.endDate}
                            onChange={(e) =>
                              updateExperience(idx, { endDate: e.target.value })
                            }
                            placeholder="Present"
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <label className={labelClass}>Responsibilities &amp; Results</label>
                        {exp.bullets.map((b, bIdx) => {
                          const polishId = `exp-${idx}-${bIdx}`;
                          return (
                            <div key={bIdx} className="space-y-1">
                              <div className="flex items-start gap-2">
                                <input
                                  type="text"
                                  value={b}
                                  onChange={(e) => {
                                    const nextBullets = [...exp.bullets];
                                    nextBullets[bIdx] = e.target.value;
                                    updateExperience(idx, { bullets: nextBullets });
                                  }}
                                  placeholder="e.g., Built responsive landing pages and reduced form errors."
                                  className={inputClass}
                                />
                                {exp.bullets.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextBullets = exp.bullets.filter(
                                        (_, i) => i !== bIdx
                                      );
                                      updateExperience(idx, { bullets: nextBullets });
                                    }}
                                    className="px-2.5 py-2.5 text-xs text-rose-600 hover:underline shrink-0"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  disabled={polishingKey === polishId}
                                  onClick={() =>
                                    handlePolishText(polishId, 'bullets', b, (improved) => {
                                      const nextBullets = [...exp.bullets];
                                      nextBullets[bIdx] = improved;
                                      updateExperience(idx, { bullets: nextBullets });
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline disabled:opacity-50"
                                >
                                  {polishingKey === polishId ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3 h-3" />
                                  )}
                                  Improve Bullet
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() =>
                            updateExperience(idx, { bullets: [...exp.bullets, ''] })
                          }
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Bullet Point
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Collapsible Optional Certifications & Awards (preserves existing DB data cleanly) */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowOptionalExtras((v) => !v)}
                    className="w-full flex items-center justify-between text-left text-sm font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <span>Optional: Certifications &amp; Awards</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        showOptionalExtras ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {showOptionalExtras && (
                    <div className="mt-4 space-y-6">
                      {/* Certifications */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase text-slate-500">
                            Certifications
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateData({
                                certifications: [
                                  ...draftData.certifications,
                                  {
                                    id: `cert-${Date.now()}`,
                                    name: '',
                                    issuer: '',
                                    date: '',
                                    credentialId: '',
                                  },
                                ],
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Certification
                          </button>
                        </div>

                        {draftData.certifications.map((cert, cIdx) => (
                          <div
                            key={cert.id}
                            className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center"
                          >
                            <input
                              type="text"
                              value={cert.name}
                              onChange={(e) =>
                                updateCertification(cIdx, { name: e.target.value })
                              }
                              placeholder="Certificate Name"
                              className={inputClass}
                            />
                            <input
                              type="text"
                              value={cert.issuer}
                              onChange={(e) =>
                                updateCertification(cIdx, { issuer: e.target.value })
                              }
                              placeholder="Issuer (e.g., AWS)"
                              className={inputClass}
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={cert.date}
                                onChange={(e) =>
                                  updateCertification(cIdx, { date: e.target.value })
                                }
                                placeholder="Year"
                                className={inputClass}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateData({
                                    certifications: draftData.certifications.filter(
                                      (_, i) => i !== cIdx
                                    ),
                                  })
                                }
                                className="text-xs text-rose-600 hover:underline shrink-0"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Awards / Achievements */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase text-slate-500">
                            Awards &amp; Achievements
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateData({
                                achievements: [
                                  ...draftData.achievements,
                                  {
                                    id: `ach-${Date.now()}`,
                                    title: '',
                                    issuerOrContext: '',
                                    date: '',
                                    description: '',
                                  },
                                ],
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Award
                          </button>
                        </div>

                        {draftData.achievements.map((ach, aIdx) => (
                          <div
                            key={ach.id}
                            className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center"
                          >
                            <input
                              type="text"
                              value={ach.title}
                              onChange={(e) =>
                                updateAchievement(aIdx, { title: e.target.value })
                              }
                              placeholder="Award Title"
                              className={inputClass}
                            />
                            <input
                              type="text"
                              value={ach.issuerOrContext}
                              onChange={(e) =>
                                updateAchievement(aIdx, {
                                  issuerOrContext: e.target.value,
                                })
                              }
                              placeholder="Organizer / Details"
                              className={inputClass}
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={ach.date}
                                onChange={(e) =>
                                  updateAchievement(aIdx, { date: e.target.value })
                                }
                                placeholder="Year"
                                className={inputClass}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateData({
                                    achievements: draftData.achievements.filter(
                                      (_, i) => i !== aIdx
                                    ),
                                  })
                                }
                                className="text-xs text-rose-600 hover:underline shrink-0"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step Navigation Footer */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <button
                type="button"
                disabled={stepIdx === 0}
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Step
              </button>

              {stepIdx < BUILDER_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setStepIdx((i) => Math.min(BUILDER_STEPS.length - 1, i + 1))
                  }
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold bg-blue-700 hover:bg-blue-600 text-white transition-colors"
                >
                  Next Step
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={exportingFormat !== null}
                  onClick={() => handleDownload('PDF')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 text-white transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Free PDF
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TEMPLATE PICKER, DOWNLOAD BUTTONS & LIVE PREVIEW */}
        <div className="lg:col-span-6 space-y-5 lg:sticky lg:top-20">
          {/* Free ATS Template Selector & Download Controls */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0F172A] p-5 space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                Choose Free ATS-Friendly Template
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {activeTemplates.map((tpl) => {
                  const selected = draftTemplate === tpl.slug;
                  return (
                    <button
                      key={tpl.slug}
                      type="button"
                      onClick={() =>
                        onChangeDraft({
                          id: draftResumeId,
                          title: draftTitle,
                          templateSlug: tpl.slug,
                          data: draftData,
                        })
                      }
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border text-left transition-colors ${
                        selected
                          ? 'bg-blue-700 border-blue-700 text-white'
                          : 'bg-white dark:bg-[#090D16] border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {tpl.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                disabled={exportingFormat !== null}
                onClick={() => handleDownload('PDF')}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold bg-blue-700 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
              >
                {exportingFormat === 'PDF' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Download PDF</span>
              </button>

              <button
                type="button"
                disabled={exportingFormat !== null}
                onClick={() => handleDownload('DOCX')}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#090D16] text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {exportingFormat === 'DOCX' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                <span>Word (.docx)</span>
              </button>

              <button
                type="button"
                onClick={onCheckThisResume}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-lg text-sm font-semibold text-blue-700 dark:text-blue-400 hover:underline"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Check ATS Score</span>
              </button>
            </div>
          </div>

          {/* Live Paper Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wide">
                Live Resume Preview
              </span>
              <span>Single-column ATS layout</span>
            </div>
            <ResumeLivePreview data={draftData} templateSlug={draftTemplate} />
          </div>
        </div>
      </div>
    </div>
  );
}
