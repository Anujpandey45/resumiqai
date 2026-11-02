export type ThemeMode = 'light' | 'dark';

export type AppView =
  | 'landing'
  | 'builder'
  | 'ats-checker'
  | 'guides'
  | 'guide-detail'
  | 'not-found';

export type ResumeSectionKey =
  | 'objective'
  | 'education'
  | 'skills'
  | 'internships'
  | 'projects'
  | 'certifications'
  | 'achievements';

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  field: string;
  graduationDate: string;
  location: string;
  gpaOrHonors: string;
}

export interface SkillGroup {
  id: string;
  category: string;
  items: string;
}

export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  type: 'Work Experience' | 'Internship';
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  techStack: string;
  link: string;
  date: string;
  bullets: string[];
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
  credentialId: string;
}

export interface AchievementItem {
  id: string;
  title: string;
  issuerOrContext: string;
  date: string;
  description: string;
}

export interface ResumeDocumentData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  websiteOrLinkedin: string;
  careerObjective: string;
  education: EducationItem[];
  technicalSkills: SkillGroup[];
  internships: ExperienceItem[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  achievements: AchievementItem[];
  sectionOrder: ResumeSectionKey[];
}

export interface SavedResumeRecord {
  id: number;
  title: string;
  templateSlug: string;
  resumeData: ResumeDocumentData;
  updatedAt: string;
  createdAt: string;
}

export interface ResumeVersionRecord {
  id: number;
  resumeId: number;
  versionNumber: number;
  changeSummary: string;
  snapshotData: {
    title: string;
    templateSlug: string;
    resumeData: ResumeDocumentData;
  };
  createdAt: string;
}

export type AtsCategoryKey =
  | 'formatting_readability'
  | 'contact_information'
  | 'professional_summary'
  | 'technical_skills'
  | 'jd_keyword_matching'
  | 'work_experience'
  | 'projects_achievements'
  | 'education'
  | 'certifications'
  | 'grammar_spelling';

export interface AtsCriterionScore {
  key: AtsCategoryKey | string;
  label: string;
  pointsEarned: number;
  maxPoints: number;
  plainExplanation: string;
  deductions?: string[];
  evidence?: string[];
}

export interface AtsDiagnosticIssue {
  id: string;
  severity: 'critical' | 'warning';
  category: string;
  title: string;
  explanation: string;
  solution: string;
}

export interface AtsPassedCheck {
  id: string;
  category: string;
  detail: string;
}

export interface AtsSynonymMatch {
  resumeTerm: string;
  jobTerm: string;
}

export interface AtsJobMatchBreakdown {
  hasJobDescription: boolean;
  matchedRequiredSkills: string[];
  missingRequiredSkills: string[];
  matchedPreferredSkills: string[];
  missingPreferredSkills: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  synonymMatches: AtsSynonymMatch[];
  keywordStuffingDetected: boolean;
  stuffedTerms: string[];
}

export interface AtsCheckReport {
  overallScore: number;
  totalMaxPoints: number;
  hasJobDescription: boolean;
  summaryPlainEnglish: string;
  disclaimer: string;
  extractedWordCount: number;
  pageCount: number;
  detectedSections: string[];
  criteriaBreakdown: AtsCriterionScore[];
  criticalIssues: AtsDiagnosticIssue[];
  warnings: AtsDiagnosticIssue[];
  passedChecks: AtsPassedCheck[];
  jobMatch: AtsJobMatchBreakdown;
  // Preserved top-level arrays for backward UI/DB compatibility
  skillMatches: string[];
  missingSkills: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  missingInformation: string[];
  formattingIssues: string[];
  practicalSuggestions: string[];
  aiTailoredTips?: string[];
  aiQuotaNotice?: string | null;
}

export interface SavedAtsReportRecord {
  id: number;
  fileName: string;
  fileType: string;
  overallScore: number;
  report: AtsCheckReport | AtsAnalysisResult;
  createdAt: string;
}

// Preserved legacy types for backward compatibility with existing DB helper modules
export interface AtsSectionScore {
  key: string;
  label: string;
  score: number;
  status: 'Strong' | 'Needs Refinement' | 'Critical Gap';
  summary: string;
}

export interface AtsMistakeItem {
  category: string;
  severity: 'High' | 'Medium' | 'Low';
  issue: string;
  excerptOrLocation: string;
  fix: string;
}

export interface AtsAnalysisResult {
  overallScore: number;
  executiveSummary: string;
  disclaimer: string;
  sectionScores: AtsSectionScore[];
  detectedMistakes: AtsMistakeItem[];
  detailedExplanations: {
    heading: string;
    explanation: string;
  }[];
  improvementSuggestions: string[];
  missingInformation: string[];
  extractedWordCount?: number;
}

export interface TemplateCatalogItem {
  id: number;
  slug: string;
  name: string;
  category: string;
  description: string;
  isPremium: boolean;
  isActive: boolean;
  updatedAt: string;
}

export interface PricingPlanItem {
  id: number;
  slug: 'free' | 'premium';
  name: string;
  tagline: string;
  monthlyPrice: number;
  scanLimit: number;
  features: string[];
  updatedAt: string;
}

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  plan: 'free' | 'premium';
  scansUsed: number;
  scanLimit: number;
  downloadsCount: number;
  subscriptionStatus: string;
  upgradedAt: string | null;
  createdAt: string;
}

export type EngineJobState =
  | 'Uploaded'
  | 'Extracting'
  | 'Analyzing'
  | 'Improving'
  | 'Rechecking'
  | 'Generating PDF'
  | 'Completed'
  | 'Failed';

export type EngineJobMode = 'autonomous_improve' | 'ats_audit_only';

export type QualityAreaKey =
  | 'ats_readability'
  | 'professional_summary'
  | 'education'
  | 'technical_skills'
  | 'projects'
  | 'experience'
  | 'grammar'
  | 'formatting'
  | 'keyword_relevance'
  | 'consistency';

export interface QualityAreaScore {
  key: QualityAreaKey;
  label: string;
  ruleScore: number;
  aiScore: number;
  combinedScore: number;
  status: 'Strong' | 'Needs Refinement' | 'Critical Gap';
  findings: string;
}

export type EngineIssueCategory =
  | 'Missing Sections'
  | 'Weak Bullet Points'
  | 'Grammar Errors'
  | 'Poor Sentence Structure'
  | 'Missing Relevant Keywords'
  | 'Unclear Project Descriptions'
  | 'Formatting Problems'
  | 'Incomplete Education Details';

export interface DetectedEngineIssue {
  id: string;
  category: EngineIssueCategory;
  severity: 'High' | 'Medium' | 'Low';
  section: string;
  description: string;
  suggestion: string;
  resolved?: boolean;
}

export interface FactualValidationResult {
  passed: boolean;
  accuracyScore: number;
  preservedFacts: string[];
  violations: string[];
  notes: string;
}

export interface VersionComparisonSummary {
  comparedAgainstVersion: number;
  scoreDelta: number;
  areaDeltas: { key: QualityAreaKey; label: number | string; delta: number }[];
  resolvedIssueCount: number;
  remainingIssueCount: number;
  sectionsModified: string[];
  summaryNote: string;
}

export interface EngineQualityReport {
  overallScore: number;
  disclaimer: string;
  executiveSummary: string;
  areas: QualityAreaScore[];
  issues: DetectedEngineIssue[];
  factualValidation: FactualValidationResult;
  comparison?: VersionComparisonSummary | null;
}

export interface EngineIterationRecord {
  id: number;
  jobUid: string;
  versionNumber: number;
  iterationLabel: string;
  resumeData: ResumeDocumentData;
  resumeText: string;
  qualityReport: EngineQualityReport;
  improvementsApplied: string[];
  overallScore: number;
  factualValidationPassed: boolean;
  selectionCompositeScore: number;
  createdAt: string;
}

export interface BestVersionSelection {
  selectedVersionNumber: number;
  selectedLabel: string;
  rationale: string;
  criteriaBreakdown: {
    versionNumber: number;
    label: string;
    factualPassed: boolean;
    contentAccuracy: number;
    atsReadability: number;
    relevantKeywords: number;
    grammar: number;
    formatting: number;
    completeness: number;
    rawOverallScore: number;
    compositeSelectionScore: number;
    eligible: boolean;
  }[];
}

export interface CompletedTaskLog {
  taskKey: string;
  label: string;
  stage: EngineJobState;
  iteration: number;
  completedAt: string;
}

export interface EngineJobRecord {
  id: number;
  jobUid: string;
  mode: EngineJobMode;
  fileName: string;
  fileType: string;
  state: EngineJobState;
  currentStageDetail: string;
  currentIteration: number;
  maxIterations: number;
  completedTasks: number;
  totalTasks: number;
  progressPercent: number;
  initialScore: number | null;
  previousScore: number | null;
  currentScore: number | null;
  selectedVersionNumber: number | null;
  stopReason: string | null;
  completedImprovements: string[];
  remainingIssues: DetectedEngineIssue[];
  taskLogs: CompletedTaskLog[];
  finalResumeData: ResumeDocumentData | null;
  bestSelection: BestVersionSelection | null;
  atsAuditReport: AtsAnalysisResult | null;
  artifactsReady: {
    pdfReady: boolean;
    docxReady: boolean;
    pdfSizeBytes?: number;
    docxSizeBytes?: number;
  };
  lastCompletedStage: string | null;
  retryCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  iterations: EngineIterationRecord[];
  createdAt: string;
  updatedAt: string;
}
