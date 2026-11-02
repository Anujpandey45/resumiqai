import { GoogleGenAI } from '@google/genai';
import type {
  AtsAnalysisResult,
  DetectedEngineIssue,
  EngineIssueCategory,
  QualityAreaKey,
  ResumeDocumentData,
} from '../types.ts';
import { DEFAULT_SECTION_ORDER } from '../data/demoSamples.ts';
import { computeDeterministicAtsReport } from './atsScoringEngine.ts';
import { ATS_ESTIMATE_DISCLAIMER } from './qualityEngine.ts';

export interface AiExecutionOptions {
  timeoutMs?: number;
  maxRetries?: number;
  jobTag?: string;
  /**
   * Used strictly by local resilience tests to verify exponential backoff
   * and stage-level checkpoint recovery without affecting real user jobs.
   */
  faultInjection?: {
    failTimesBeforeSuccess?: number;
    simulateTimeoutOnStage?: string;
    currentStageKey?: string;
  };
}

const transientInjectionCounters = new Map<string, number>();

// Temporary per-model circuit breaker cooldown (ms epoch) when an upstream model
// returns 503 high-demand or 404 unavailable so multi-stage jobs don't stall.
const modelCooldownUntil = new Map<string, number>();
const MODEL_COOLDOWN_MS = 60_000;

function sanitizeGeminiModelName(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^models\//i, '');
  // Strictly accept active Gemini 3.x / Flash aliases; reject numeric secret IDs (e.g. "924492")
  // and deprecated 1.5 / 2.0 / 2.5 model names.
  if (/^gemini-(3\.[0-9]+-[a-z0-9.-]+|flash(?:-lite)?-latest)$/i.test(cleaned)) {
    return cleaned;
  }
  return null;
}

const DEFAULT_PRIMARY_MODEL =
  sanitizeGeminiModelName(process.env.GEMINI_PRIMARY_MODEL) || 'gemini-3.8-flash';

const BASE_MODEL_RING: string[] = Array.from(
  new Set([
    DEFAULT_PRIMARY_MODEL,
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
  ])
);

function buildOrderedCandidateModels(): string[] {
  const now = Date.now();
  const healthy: string[] = [];
  const coolingDown: string[] = [];
  for (const model of BASE_MODEL_RING) {
    const until = modelCooldownUntil.get(model) || 0;
    if (until > now) {
      coolingDown.push(model);
    } else {
      healthy.push(model);
    }
  }
  return [...healthy, ...coolingDown];
}

function getConfiguredTimeoutMs(override?: number): number {
  const envVal = Number(process.env.AI_REQUEST_TIMEOUT_MS);
  if (typeof override === 'number' && override > 0) return override;
  if (!Number.isNaN(envVal) && envVal >= 11000) return envVal;
  return 28000;
}

function getGenAiClient(sdkTimeoutMs: number) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Writing assistant service key is not configured.');
  }
  // Enforce an 11s minimum deadline on httpOptions.timeout
  const safeSdkTimeout = Math.max(11000, sdkTimeoutMs);
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      timeout: safeSdkTimeout,
    },
  });
}

export function isTransientAiError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '').toUpperCase();
  const status = Number((err as any)?.status || (err as any)?.code || 0);

  // Never retry invalid API key or permission errors
  if (
    status === 401 ||
    status === 403 ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('IS NOT CONFIGURED')
  ) {
    return false;
  }

  if (
    status === 404 ||
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  return (
    msg.includes('504') ||
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('DEADLINE EXPIRED') ||
    msg.includes('AI_STAGE_TIMEOUT') ||
    msg.includes('SIMULATED_TRANSIENT_API_FAILURE') ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('HIGH DEMAND') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('404') ||
    msg.includes('NOT_FOUND') ||
    msg.includes('NO LONGER AVAILABLE') ||
    msg.includes('MALFORMED JSON') ||
    msg.includes('EMPTY JSON RESPONSE') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('FETCH FAILED')
  );
}

function shouldCooldownModel(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '').toUpperCase();
  const status = Number((err as any)?.status || (err as any)?.code || 0);
  return (
    status === 404 ||
    status === 429 ||
    status === 503 ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('HIGH DEMAND') ||
    msg.includes('NOT_FOUND') ||
    msg.includes('NO LONGER AVAILABLE') ||
    msg.includes('RESOURCE_EXHAUSTED')
  );
}

export function isExternalQuotaError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '').toUpperCase();
  const status = Number((err as any)?.status || (err as any)?.code || 0);
  return (
    status === 429 ||
    status === 503 ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.includes('QUOTA') ||
    msg.includes('RATE LIMIT') ||
    msg.includes('HIGH DEMAND') ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE')
  );
}

function formatReadableAiError(err: unknown): Error {
  const rawMsg = String((err as any)?.message || err || 'AI processing failed.');
  const upper = rawMsg.toUpperCase();
  if (upper.includes('API_KEY_INVALID') || upper.includes('PERMISSION_DENIED')) {
    return new Error(
      'Writing assistant authentication is currently unavailable.'
    );
  }
  if (upper.includes('HIGH DEMAND') || upper.includes('UNAVAILABLE') || upper.includes('503')) {
    const wrapped = new Error(
      'The external AI service is experiencing high demand right now. Please wait a moment and try again.'
    );
    (wrapped as any).status = 503;
    return wrapped;
  }
  if (upper.includes('RESOURCE_EXHAUSTED') || upper.includes('429')) {
    const wrapped = new Error(
      'The external AI service quota has been temporarily reached. Please wait a minute and try again.'
    );
    (wrapped as any).status = 429;
    return wrapped;
  }
  return err instanceof Error ? err : new Error(rawMsg);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractFirstJsonObject(raw: string): any {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    throw new Error('Empty JSON response from AI model.');
  }
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }
    throw new Error('Malformed JSON payload returned by AI model.');
  }
}

async function generateJsonWithResilience(params: {
  systemInstruction: string;
  prompt: string;
  options?: AiExecutionOptions;
}): Promise<any> {
  const timeoutMs = getConfiguredTimeoutMs(params.options?.timeoutMs);
  const candidateModels = buildOrderedCandidateModels();
  const maxRetries = Math.max(
    0,
    params.options?.maxRetries ?? Math.max(4, candidateModels.length - 1)
  );
  const tag = params.options?.jobTag || 'ai-call';
  const fi = params.options?.faultInjection;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const modelName = candidateModels[attempt % candidateModels.length];

    try {
      // Optional deterministic fault injection for automated resilience tests
      if (fi) {
        if (
          fi.simulateTimeoutOnStage &&
          fi.currentStageKey === fi.simulateTimeoutOnStage
        ) {
          const timeoutErr = new Error(
            `AI_STAGE_TIMEOUT: Stage "${fi.currentStageKey}" exceeded configured deadline (${timeoutMs}ms).`
          );
          (timeoutErr as any).code = 504;
          throw timeoutErr;
        }

        if (fi.failTimesBeforeSuccess && fi.failTimesBeforeSuccess > 0) {
          const counterKey = `${tag}:${fi.currentStageKey || 'default'}`;
          const prevCount = transientInjectionCounters.get(counterKey) || 0;
          if (prevCount < fi.failTimesBeforeSuccess) {
            transientInjectionCounters.set(counterKey, prevCount + 1);
            const transientErr = new Error(
              `SIMULATED_TRANSIENT_API_FAILURE: Temporary 503 upstream interruption (attempt ${prevCount + 1}).`
            );
            (transientErr as any).status = 503;
            throw transientErr;
          }
        }
      }

      const ai = getGenAiClient(timeoutMs);
      const t0 = Date.now();

      const callPromise = ai.models.generateContent({
        model: modelName,
        contents: params.prompt,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          const err = new Error(
            `AI_STAGE_TIMEOUT: Request exceeded ${timeoutMs}ms deadline.`
          );
          (err as any).status = 504;
          reject(err);
        }, timeoutMs);
        callPromise.finally(() => clearTimeout(timer)).catch(() => {});
      });

      const response = await Promise.race([callPromise, timeoutPromise]);
      const parsed = extractFirstJsonObject(response.text ?? '{}');

      // Clear any previous cooldown on this model once it succeeds
      modelCooldownUntil.delete(modelName);

      if (attempt > 0) {
        // Anonymized telemetry only — never log resume text or PII
        console.info(
          `[ResumiqEngine] Recovered on attempt ${attempt + 1} (${modelName}, ${Date.now() - t0}ms, tag=${tag})`
        );
      }

      return parsed;
    } catch (err: any) {
      lastError = err;
      const isSimulatedStageTimeout =
        fi?.simulateTimeoutOnStage &&
        fi.currentStageKey === fi.simulateTimeoutOnStage;

      if (!fi && shouldCooldownModel(err)) {
        modelCooldownUntil.set(modelName, Date.now() + MODEL_COOLDOWN_MS);
      }

      if (isSimulatedStageTimeout || attempt >= maxRetries || !isTransientAiError(err)) {
        break;
      }

      const nextModel = candidateModels[(attempt + 1) % candidateModels.length];
      const switchingModels = nextModel !== modelName;
      // Fast failover when switching to a distinct healthy model; exponential backoff when retrying same model
      const baseDelay = switchingModels
        ? 300 + attempt * 150
        : Math.round(900 * Math.pow(2.0, attempt));
      const jitter = Math.floor(Math.random() * 200);
      await sleep(baseDelay + jitter);
    }
  }

  throw formatReadableAiError(lastError);
}

const VALID_ISSUE_CATEGORIES: EngineIssueCategory[] = [
  'Missing Sections',
  'Weak Bullet Points',
  'Grammar Errors',
  'Poor Sentence Structure',
  'Missing Relevant Keywords',
  'Unclear Project Descriptions',
  'Formatting Problems',
  'Incomplete Education Details',
];

function normalizeResumeData(raw: any, fallback?: ResumeDocumentData): ResumeDocumentData {
  const fb = fallback;
  const ensureArr = (v: any) => (Array.isArray(v) ? v : []);

  return {
    fullName: String(raw?.fullName ?? fb?.fullName ?? '').trim(),
    email: String(raw?.email ?? fb?.email ?? '').trim(),
    phone: String(raw?.phone ?? fb?.phone ?? '').trim(),
    location: String(raw?.location ?? fb?.location ?? '').trim(),
    websiteOrLinkedin: String(raw?.websiteOrLinkedin ?? fb?.websiteOrLinkedin ?? '').trim(),
    careerObjective: String(raw?.careerObjective ?? fb?.careerObjective ?? '').trim(),
    education: ensureArr(raw?.education ?? fb?.education).map((e: any, i: number) => ({
      id: String(e?.id || `edu-${i + 1}`),
      institution: String(e?.institution || '').trim(),
      degree: String(e?.degree || '').trim(),
      field: String(e?.field || '').trim(),
      graduationDate: String(e?.graduationDate || '').trim(),
      location: String(e?.location || '').trim(),
      gpaOrHonors: String(e?.gpaOrHonors || '').trim(),
    })),
    technicalSkills: ensureArr(raw?.technicalSkills ?? fb?.technicalSkills).map(
      (s: any, i: number) => ({
        id: String(s?.id || `sk-${i + 1}`),
        category: String(s?.category || 'Core Skills').trim(),
        items: String(s?.items || '').trim(),
      })
    ),
    internships: ensureArr(raw?.internships ?? fb?.internships).map((ex: any, i: number) => ({
      id: String(ex?.id || `exp-${i + 1}`),
      role: String(ex?.role || '').trim(),
      company: String(ex?.company || '').trim(),
      type: ex?.type === 'Internship' ? 'Internship' : 'Work Experience',
      location: String(ex?.location || '').trim(),
      startDate: String(ex?.startDate || '').trim(),
      endDate: String(ex?.endDate || '').trim(),
      bullets: ensureArr(ex?.bullets)
        .map((b: any) => String(b || '').trim())
        .filter(Boolean),
    })),
    projects: ensureArr(raw?.projects ?? fb?.projects).map((p: any, i: number) => ({
      id: String(p?.id || `proj-${i + 1}`),
      name: String(p?.name || '').trim(),
      techStack: String(p?.techStack || '').trim(),
      link: String(p?.link || '').trim(),
      date: String(p?.date || '').trim(),
      bullets: ensureArr(p?.bullets)
        .map((b: any) => String(b || '').trim())
        .filter(Boolean),
    })),
    certifications: ensureArr(raw?.certifications ?? fb?.certifications).map(
      (c: any, i: number) => ({
        id: String(c?.id || `cert-${i + 1}`),
        name: String(c?.name || '').trim(),
        issuer: String(c?.issuer || '').trim(),
        date: String(c?.date || '').trim(),
        credentialId: String(c?.credentialId || '').trim(),
      })
    ),
    achievements: ensureArr(raw?.achievements ?? fb?.achievements).map(
      (a: any, i: number) => ({
        id: String(a?.id || `ach-${i + 1}`),
        title: String(a?.title || '').trim(),
        issuerOrContext: String(a?.issuerOrContext || '').trim(),
        date: String(a?.date || '').trim(),
        description: String(a?.description || '').trim(),
      })
    ),
    sectionOrder: [...DEFAULT_SECTION_ORDER],
  };
}

function normalizeIssues(rawIssues: any): DetectedEngineIssue[] {
  if (!Array.isArray(rawIssues)) return [];
  return rawIssues
    .map((item: any, idx: number) => {
      const catRaw = String(item?.category || '').trim();
      const matchedCat =
        VALID_ISSUE_CATEGORIES.find(
          (c) => c.toLowerCase() === catRaw.toLowerCase()
        ) || 'Weak Bullet Points';

      const sev =
        item?.severity === 'High' || item?.severity === 'Medium' || item?.severity === 'Low'
          ? item.severity
          : 'Medium';

      return {
        id: String(item?.id || `iss-${idx + 1}`),
        category: matchedCat,
        severity: sev,
        section: String(item?.section || 'General').trim(),
        description: String(item?.description || '').trim(),
        suggestion: String(item?.suggestion || '').trim(),
        resolved: Boolean(item?.resolved),
      };
    })
    .filter((i) => i.description.length > 0);
}

function normalizeAiAreaMap(
  rawAreas: any
): Partial<Record<QualityAreaKey, { score: number; findings: string }>> {
  const result: Partial<Record<QualityAreaKey, { score: number; findings: string }>> = {};
  if (!rawAreas || typeof rawAreas !== 'object') return result;

  const keys: QualityAreaKey[] = [
    'ats_readability',
    'professional_summary',
    'education',
    'technical_skills',
    'projects',
    'experience',
    'grammar',
    'formatting',
    'keyword_relevance',
    'consistency',
  ];

  for (const key of keys) {
    const entry = rawAreas[key];
    if (entry && typeof entry === 'object') {
      result[key] = {
        score: Number(entry.score) || 70,
        findings: String(entry.findings || '').trim(),
      };
    } else if (typeof entry === 'number') {
      result[key] = { score: entry, findings: '' };
    }
  }
  return result;
}

/**
 * Step 2 & Step 3 of Autonomous Improvement Engine:
 * Parses raw resume text into a structured ResumeDocumentData snapshot (preserving 100% factual truth)
 * and evaluates the 10 quality areas + 8 diagnostic issue categories.
 */
export async function extractAndEvaluateBaselineWithGemini(params: {
  rawText: string;
  structuralNotes?: string[];
  options?: AiExecutionOptions;
}): Promise<{
  structuredResume: ResumeDocumentData;
  executiveSummary: string;
  aiAreas: Partial<Record<QualityAreaKey, { score: number; findings: string }>>;
  issues: DetectedEngineIssue[];
}> {
  const structuralContext = params.structuralNotes?.length
    ? `\nStructural Observations:\n- ${params.structuralNotes.join('\n- ')}`
    : '';

  const parsed = await generateJsonWithResilience({
    options: params.options,
    systemInstruction: `You are the Baseline Extraction & Quality Auditor for resumiq.ai.
Extract the candidate's resume into structured JSON faithfully—NEVER invent degrees, marks/GPA, employers, dates, skills, certifications, or achievements not present in the source text.
Also audit the resume across all 10 quality dimensions and identify concrete issues using ONLY these 8 categories:
"Missing Sections", "Weak Bullet Points", "Grammar Errors", "Poor Sentence Structure", "Missing Relevant Keywords", "Unclear Project Descriptions", "Formatting Problems", "Incomplete Education Details".

Return strictly valid JSON with this exact shape:
{
  "structuredResume": {
    "fullName": "",
    "email": "",
    "phone": "",
    "location": "",
    "websiteOrLinkedin": "",
    "careerObjective": "",
    "education": [{ "institution": "", "degree": "", "field": "", "graduationDate": "", "location": "", "gpaOrHonors": "" }],
    "technicalSkills": [{ "category": "", "items": "" }],
    "internships": [{ "role": "", "company": "", "type": "Work Experience", "location": "", "startDate": "", "endDate": "", "bullets": [""] }],
    "projects": [{ "name": "", "techStack": "", "link": "", "date": "", "bullets": [""] }],
    "certifications": [{ "name": "", "issuer": "", "date": "", "credentialId": "" }],
    "achievements": [{ "title": "", "issuerOrContext": "", "date": "", "description": "" }]
  },
  "executiveSummary": "2-sentence honest baseline quality summary.",
  "areaScores": {
    "ats_readability": { "score": 70, "findings": "" },
    "professional_summary": { "score": 65, "findings": "" },
    "education": { "score": 75, "findings": "" },
    "technical_skills": { "score": 70, "findings": "" },
    "projects": { "score": 68, "findings": "" },
    "experience": { "score": 68, "findings": "" },
    "grammar": { "score": 72, "findings": "" },
    "formatting": { "score": 74, "findings": "" },
    "keyword_relevance": { "score": 65, "findings": "" },
    "consistency": { "score": 75, "findings": "" }
  },
  "issues": [
    {
      "category": "Weak Bullet Points",
      "severity": "High",
      "section": "Experience",
      "description": "Specific issue in resume",
      "suggestion": "Concrete factual fix"
    }
  ]
}`,
    prompt: `Extract and evaluate this resume:${structuralContext}

RESUME TEXT:
"""
${params.rawText.slice(0, 24000)}
"""`,
  });

  return {
    structuredResume: normalizeResumeData(parsed?.structuredResume),
    executiveSummary: String(parsed?.executiveSummary || '').trim(),
    aiAreas: normalizeAiAreaMap(parsed?.areaScores),
    issues: normalizeIssues(parsed?.issues),
  };
}

/**
 * Step 4 of Autonomous Improvement Engine (Intelligent Feedback Loop):
 * Reads previous structured resume + previous analysis report + unresolved issues.
 * Improves ONLY necessary sections while strictly preserving every factual detail.
 */
export async function runIterativeImprovementWithGemini(params: {
  iterationNumber: number;
  previousResume: ResumeDocumentData;
  previousExecutiveSummary: string;
  unresolvedIssues: DetectedEngineIssue[];
  options?: AiExecutionOptions;
}): Promise<{
  improvedResume: ResumeDocumentData;
  improvementsApplied: string[];
}> {
  const iterationFocus =
    params.iterationNumber === 1
      ? 'Iteration 1 Focus: Strengthen professional summary, replace passive phrasing ("worked on", "responsible for") with crisp action verbs, and organize existing skills cleanly.'
      : params.iterationNumber === 2
        ? 'Iteration 2 Focus: Clarify project descriptions, fix grammar/sentence structure, and align natural technical terminology already evidenced in the resume without keyword stuffing.'
        : 'Iteration 3 Focus: Final micro-refinement of consistency, date formatting, and conciseness across any remaining weak bullets.';

  const parsed = await generateJsonWithResilience({
    options: params.options,
    systemInstruction: `You are the Ethical Self-Improving Resume Engine for resumiq.ai.
${iterationFocus}

STRICT FACTUAL INTEGRITY RULES (MANDATORY):
1. NEVER change the candidate's fullName, email, phone, location, institutions, degrees, GPA/marks, employer names, or employment dates.
2. NEVER invent degrees, marks, work experience, companies, skills, certifications, numeric percentages, or achievements.
3. Do NOT insert fake numbers (like "42%"). Keep qualitative impact concise and truthful based ONLY on the candidate's existing facts.
4. Improve ONLY sections that have unresolved issues; leave already-strong sections untouched.
5. Synthesize a concise 2–3 sentence 'careerObjective' ONLY from the candidate's actual education, skills, and experience already present in the JSON.

Return strictly valid JSON:
{
  "improvedResume": { ...same ResumeDocumentData schema... },
  "improvementsApplied": [
    "Specific description of improvement 1",
    "Specific description of improvement 2"
  ]
}`,
    prompt: `PREVIOUS ANALYSIS SUMMARY:
${params.previousExecutiveSummary}

UNRESOLVED ISSUES TO ADDRESS IN ROUND ${params.iterationNumber}:
${JSON.stringify(params.unresolvedIssues.slice(0, 10))}

PREVIOUS STRUCTURED RESUME JSON:
${JSON.stringify(params.previousResume)}`,
  });

  const improvedResume = normalizeResumeData(
    parsed?.improvedResume,
    params.previousResume
  );

  // Hard lock identity fields to guarantee zero drift
  if (params.previousResume.fullName?.trim()) {
    improvedResume.fullName = params.previousResume.fullName;
  }
  if (params.previousResume.email?.trim()) {
    improvedResume.email = params.previousResume.email;
  }
  if (params.previousResume.phone?.trim()) {
    improvedResume.phone = params.previousResume.phone;
  }

  const improvementsApplied = Array.isArray(parsed?.improvementsApplied)
    ? parsed.improvementsApplied
        .map((s: any) => String(s || '').trim())
        .filter(Boolean)
    : ['Refined action-verb clarity and structural consistency'];

  return {
    improvedResume,
    improvementsApplied,
  };
}

/**
 * Step 5 of Autonomous Improvement Engine:
 * Re-checks the newly improved resume independently across all 10 quality areas
 * and identifies any remaining unresolved issues.
 */
export async function evaluateCandidateIterationWithGemini(params: {
  iterationNumber: number;
  candidateResume: ResumeDocumentData;
  previousIssues: DetectedEngineIssue[];
  options?: AiExecutionOptions;
}): Promise<{
  executiveSummary: string;
  aiAreas: Partial<Record<QualityAreaKey, { score: number; findings: string }>>;
  remainingIssues: DetectedEngineIssue[];
}> {
  const parsed = await generateJsonWithResilience({
    options: params.options,
    systemInstruction: `You are the Independent Quality Recheck Auditor for resumiq.ai.
Audit the Round ${params.iterationNumber} improved resume objectively across all 10 areas (0-100).
Check which previous issues remain genuinely unresolved—only include issues in 'remainingIssues' if they STILL need work (do not invent nitpicks if the resume is clean and factual, though note genuinely missing source details like missing graduation year if absent from original input).

Return strictly valid JSON:
{
  "executiveSummary": "2-sentence objective assessment of Round ${params.iterationNumber}.",
  "areaScores": {
    "ats_readability": { "score": 85, "findings": "" },
    "professional_summary": { "score": 84, "findings": "" },
    "education": { "score": 82, "findings": "" },
    "technical_skills": { "score": 86, "findings": "" },
    "projects": { "score": 84, "findings": "" },
    "experience": { "score": 85, "findings": "" },
    "grammar": { "score": 90, "findings": "" },
    "formatting": { "score": 88, "findings": "" },
    "keyword_relevance": { "score": 84, "findings": "" },
    "consistency": { "score": 88, "findings": "" }
  },
  "remainingIssues": [
    {
      "category": "Incomplete Education Details",
      "severity": "Low",
      "section": "Education",
      "description": "Remaining issue if any",
      "suggestion": "Actionable user guidance"
    }
  ]
}`,
    prompt: `PREVIOUS UNRESOLVED ISSUES:
${JSON.stringify(params.previousIssues.slice(0, 8))}

CANDIDATE RESUME JSON (ROUND ${params.iterationNumber}):
${JSON.stringify(params.candidateResume)}`,
  });

  return {
    executiveSummary: String(parsed?.executiveSummary || '').trim(),
    aiAreas: normalizeAiAreaMap(parsed?.areaScores),
    remainingIssues: normalizeIssues(parsed?.remainingIssues),
  };
}

/**
 * Centralized ATS Resume Checker Audit — delegates 100% of numeric scoring,
 * section breakdowns, and mistake detection to the single deterministic ATS engine
 * so identical inputs always produce identical scores with zero AI randomness.
 */
export async function analyzeResumeWithGemini(params: {
  resumeText: string;
  fileName: string;
  structuralNotes?: string[];
  options?: AiExecutionOptions;
}): Promise<AtsAnalysisResult> {
  const deterministic = computeDeterministicAtsReport({
    resumeText: params.resumeText,
    fileName: params.fileName,
    structuralNotes: params.structuralNotes,
  });

  const sectionScores = deterministic.criteriaBreakdown
    .filter((c) => c.maxPoints > 0)
    .map((c) => {
      const pct = Math.round((c.pointsEarned / c.maxPoints) * 100);
      return {
        key: String(c.key),
        label: c.label,
        score: pct,
        status: (pct >= 80
          ? 'Strong'
          : pct >= 60
            ? 'Needs Refinement'
            : 'Critical Gap') as 'Strong' | 'Needs Refinement' | 'Critical Gap',
        summary:
          c.deductions && c.deductions.length > 0
            ? c.deductions.join(' ')
            : c.plainExplanation,
      };
    });

  const detectedMistakes = [
    ...deterministic.criticalIssues.map((iss) => ({
      category: iss.category,
      severity: 'High' as const,
      issue: iss.title,
      excerptOrLocation: iss.explanation,
      fix: iss.solution,
    })),
    ...deterministic.warnings.map((iss) => ({
      category: iss.category,
      severity: 'Medium' as const,
      issue: iss.title,
      excerptOrLocation: iss.explanation,
      fix: iss.solution,
    })),
  ];

  return {
    overallScore: deterministic.overallScore,
    executiveSummary: deterministic.summaryPlainEnglish,
    disclaimer: deterministic.disclaimer || ATS_ESTIMATE_DISCLAIMER,
    sectionScores,
    detectedMistakes,
    detailedExplanations: deterministic.criteriaBreakdown
      .filter((c) => c.maxPoints > 0)
      .map((c) => ({
        heading: `${c.label} (${c.pointsEarned}/${c.maxPoints} pts)`,
        explanation:
          c.deductions && c.deductions.length > 0
            ? `${c.plainExplanation} Deductions: ${c.deductions.join(' ')}`
            : c.plainExplanation,
      })),
    improvementSuggestions: deterministic.practicalSuggestions,
    missingInformation: deterministic.missingInformation,
    extractedWordCount: deterministic.extractedWordCount,
  };
}

export async function matchResumeToJobWithGemini(params: {
  jobTitle: string;
  resumeText: string;
  jobDescription: string;
  options?: AiExecutionOptions;
}) {
  const deterministic = computeDeterministicAtsReport({
    resumeText: params.resumeText,
    fileName: params.jobTitle || 'Resume',
    jobDescription: params.jobDescription,
  });

  return {
    matchPercentage: deterministic.overallScore,
    summary: deterministic.summaryPlainEnglish,
    relevantSkills: deterministic.skillMatches,
    missingKeywords: [
      ...deterministic.jobMatch.missingRequiredSkills,
      ...deterministic.jobMatch.missingPreferredSkills,
      ...deterministic.missingKeywords,
    ],
    relevantExperience: deterministic.passedChecks.map((p) => ({
      roleOrProject: p.category,
      alignmentNote: p.detail,
    })),
    improvementRecommendations: deterministic.practicalSuggestions,
  };
}

export async function improveResumeContentWithGemini(params: {
  mode: string;
  content: string;
  targetKeywords?: string;
  options?: AiExecutionOptions;
}) {
  const modeInstructions: Record<string, string> = {
    summary:
      'Improve this career objective/summary into a crisp, authoritative 2–3 sentence executive summary.',
    project:
      'Rewrite this project description to emphasize technical architecture, tools used, and clear engineering purpose.',
    bullets:
      'Transform these resume bullet points to begin with strong action verbs and clear cause-and-effect structure.',
    grammar:
      'Fix all spelling, grammar, punctuation, and verb-tense inconsistencies while keeping the original meaning.',
    professional:
      'Elevate the tone of this resume excerpt so it reads clearly, concisely, and professionally for recruiters.',
    keywords: `Naturally weave in relevant terminology from [${
      params.targetKeywords || 'industry best practices'
    }] ONLY where contextually accurate, strictly avoiding unnatural keyword stuffing.`,
  };

  const specificTask = modeInstructions[params.mode] || modeInstructions.bullets;

  const parsed = await generateJsonWithResilience({
    options: params.options,
    systemInstruction: `You are the Ethical Resume Improvement Assistant for resumiq.ai.
CRITICAL ETHICAL RULES:
1. NEVER invent qualifications, degrees, companies, technologies, or numeric metrics that the user did not state.
2. If quantifying an achievement would strengthen the bullet point, insert an explicit bracketed placeholder such as "[X]%" or "[N] users" so the candidate can fill in their verified number truthfully.
3. Avoid buzzword fluff and never perform keyword stuffing.
Return strictly valid JSON:
{
  "improvedText": "...",
  "changesMade": ["..."],
  "ethicalNote": "..."
}`,
    prompt: `Task: ${specificTask}

Original Candidate Input:
"""
${params.content.slice(0, 6000)}
"""`,
  });

  return {
    improvedText: String(parsed?.improvedText || params.content),
    changesMade: Array.isArray(parsed?.changesMade)
      ? parsed.changesMade.map(String)
      : [],
    ethicalNote: String(
      parsed?.ethicalNote || 'Preserved all original factual claims without invention.'
    ),
  };
}

/**
 * Generates up to 3 plain-English, factual resume writing suggestions tailored to the
 * candidate's actual resume and pasted job description.
 * IMPORTANT: Never generates or modifies ATS scores. If external provider quota is full,
 * returns a clear quotaNotice without failing the deterministic ATS check.
 */
export async function generateOptionalPlainEnglishTipsWithGemini(params: {
  resumeText: string;
  jobDescription?: string;
  missingSkills: string[];
  missingInformation: string[];
  formattingIssues: string[];
  options?: AiExecutionOptions;
}): Promise<{ tips: string[]; quotaNotice: string | null }> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      tips: [],
      quotaNotice:
        'Optional writing tips are currently unavailable. Your ATS score and keyword report above are complete.',
    };
  }

  try {
    const jdBlock = params.jobDescription?.trim()
      ? `\nJOB DESCRIPTION:\n"""\n${params.jobDescription.slice(0, 8000)}\n"""`
      : '\nNo specific job description was pasted.';

    const parsed = await generateJsonWithResilience({
      options: {
        timeoutMs: 14000,
        maxRetries: 2,
        jobTag: 'ats-plain-tips',
        ...params.options,
      },
      systemInstruction: `You are a friendly, honest career coach helping a beginner improve their resume in simple English.
RULES:
1. Give exactly 3 short, practical tips (1-2 simple sentences each) based ONLY on the resume and job description below.
2. NEVER invent fake skills, degrees, companies, or numbers. Tell the user to add a missing skill ONLY if they genuinely know it.
3. NEVER output a score or claim to guarantee selection.
Return strictly valid JSON:
{
  "tips": [
    "Tip 1 in simple English",
    "Tip 2 in simple English",
    "Tip 3 in simple English"
  ]
}`,
      prompt: `RESUME TEXT:
"""
${params.resumeText.slice(0, 12000)}
"""
${jdBlock}

Detected Missing Job Skills: ${params.missingSkills.slice(0, 8).join(', ') || 'None'}
Detected Missing Resume Info: ${params.missingInformation.slice(0, 5).join('; ') || 'None'}
Detected Formatting Issues: ${params.formattingIssues.slice(0, 4).join('; ') || 'None'}`,
    });

    const tips = Array.isArray(parsed?.tips)
      ? parsed.tips
          .map((t: any) => String(t || '').trim())
          .filter((t: string) => t.length > 8)
          .slice(0, 3)
      : [];

    return { tips, quotaNotice: null };
  } catch (err: unknown) {
    if (isExternalQuotaError(err)) {
      return {
        tips: [],
        quotaNotice:
          'External AI writing tips are temporarily unavailable because the AI provider quota is busy right now. Your ATS score, keyword match, and improvement steps above are 100% complete.',
      };
    }
    return {
      tips: [],
      quotaNotice: null,
    };
  }
}

