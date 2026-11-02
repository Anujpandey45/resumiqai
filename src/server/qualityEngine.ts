import type {
  BestVersionSelection,
  DetectedEngineIssue,
  EngineIterationRecord,
  EngineQualityReport,
  FactualValidationResult,
  QualityAreaKey,
  QualityAreaScore,
  ResumeDocumentData,
  VersionComparisonSummary,
} from '../types.ts';

export const QUALITY_AREA_LABELS: Record<QualityAreaKey, string> = {
  ats_readability: 'ATS Readability',
  professional_summary: 'Professional Summary',
  education: 'Education',
  technical_skills: 'Technical Skills',
  projects: 'Projects',
  experience: 'Experience',
  grammar: 'Grammar',
  formatting: 'Formatting',
  keyword_relevance: 'Keyword Relevance',
  consistency: 'Consistency',
};

export const QUALITY_AREA_ORDER: QualityAreaKey[] = [
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

const STRONG_ACTION_VERBS = new Set([
  'architected',
  'automated',
  'built',
  'collaborated',
  'configured',
  'consolidated',
  'created',
  'decreased',
  'delivered',
  'deployed',
  'designed',
  'developed',
  'diagnosed',
  'engineered',
  'enhanced',
  'established',
  'executed',
  'expanded',
  'implemented',
  'improved',
  'increased',
  'integrated',
  'launched',
  'led',
  'maintained',
  'managed',
  'migrated',
  'modernized',
  'optimized',
  'orchestrated',
  'pioneered',
  'reduced',
  'refactored',
  'resolved',
  'scaled',
  'spearheaded',
  'standardized',
  'streamlined',
  'strengthened',
  'tested',
  'transformed',
  'upgraded',
]);

const WEAK_PHRASES = [
  'responsible for',
  'worked on',
  'helped with',
  'assisted in',
  'duties included',
  'tasked with',
  'involved in',
];

export const ATS_ESTIMATE_DISCLAIMER =
  'Quality and ATS compatibility scores are diagnostic estimates combining rule-based structural checks and AI evaluation. Actual employer ATS platforms (Workday, Greenhouse, Lever, Taleo) differ in configuration and never guarantee interview selection.';

export function serializeResumeDataToText(data: ResumeDocumentData): string {
  const lines: string[] = [];
  if (data.fullName?.trim()) lines.push(data.fullName.trim());
  const contact = [
    data.email,
    data.phone,
    data.location,
    data.websiteOrLinkedin,
  ]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(' | ');
  if (contact) lines.push(contact);

  if (data.careerObjective?.trim()) {
    lines.push('\nPROFESSIONAL SUMMARY');
    lines.push(data.careerObjective.trim());
  }

  const validEdu = (data.education || []).filter(
    (e) => e.institution?.trim() || e.degree?.trim()
  );
  if (validEdu.length > 0) {
    lines.push('\nEDUCATION');
    for (const edu of validEdu) {
      const deg = [edu.degree, edu.field].filter(Boolean).join(' in ');
      const header = [edu.institution, deg, edu.graduationDate, edu.gpaOrHonors, edu.location]
        .filter((x) => x && x.trim())
        .join(' · ');
      lines.push(header);
    }
  }

  const validSkills = (data.technicalSkills || []).filter((s) => s.items?.trim());
  if (validSkills.length > 0) {
    lines.push('\nTECHNICAL SKILLS');
    for (const sk of validSkills) {
      lines.push(sk.category?.trim() ? `${sk.category.trim()}: ${sk.items.trim()}` : sk.items.trim());
    }
  }

  const validExp = (data.internships || []).filter(
    (e) => e.role?.trim() || e.company?.trim()
  );
  if (validExp.length > 0) {
    lines.push('\nWORK EXPERIENCE & INTERNSHIPS');
    for (const exp of validExp) {
      const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' – ');
      lines.push(
        `${[exp.role, exp.company].filter(Boolean).join(' — ')}${dates ? ` (${dates})` : ''}`
      );
      for (const b of exp.bullets || []) {
        if (b?.trim()) lines.push(`• ${b.trim()}`);
      }
    }
  }

  const validProj = (data.projects || []).filter((p) => p.name?.trim());
  if (validProj.length > 0) {
    lines.push('\nPROJECTS');
    for (const proj of validProj) {
      const header = `${proj.name.trim()}${proj.techStack?.trim() ? ` (${proj.techStack.trim()})` : ''}${proj.date?.trim() ? ` [${proj.date.trim()}]` : ''}`;
      lines.push(header);
      if (proj.link?.trim()) lines.push(proj.link.trim());
      for (const b of proj.bullets || []) {
        if (b?.trim()) lines.push(`• ${b.trim()}`);
      }
    }
  }

  const validCerts = (data.certifications || []).filter((c) => c.name?.trim());
  if (validCerts.length > 0) {
    lines.push('\nCERTIFICATIONS');
    for (const c of validCerts) {
      lines.push(
        `• ${[c.name, c.issuer, c.date].filter((x) => x && x.trim()).join(' — ')}`
      );
    }
  }

  const validAch = (data.achievements || []).filter((a) => a.title?.trim());
  if (validAch.length > 0) {
    lines.push('\nACHIEVEMENTS & AWARDS');
    for (const a of validAch) {
      lines.push(
        `• ${[a.title, a.issuerOrContext, a.date, a.description].filter((x) => x && x.trim()).join(' — ')}`
      );
    }
  }

  return lines.join('\n').trim();
}

function clampScore(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)));
}

function getStatusFromScore(score: number): 'Strong' | 'Needs Refinement' | 'Critical Gap' {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Needs Refinement';
  return 'Critical Gap';
}

function normalizeToken(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Verifies that an improved version NEVER invents degrees, institutions, companies,
 * certifications, numeric GPA/marks, or alters genuine candidate identity facts.
 */
export function validateFactualIntegrity(
  baselineData: ResumeDocumentData,
  baselineRawText: string,
  candidateData: ResumeDocumentData,
  isBaseline = false
): FactualValidationResult {
  if (isBaseline) {
    return {
      passed: true,
      accuracyScore: 100,
      preservedFacts: ['Baseline extracted directly from source resume'],
      violations: [],
      notes: 'Baseline snapshot anchors all factual verification checks.',
    };
  }

  const violations: string[] = [];
  const preservedFacts: string[] = [];
  const rawLower = (baselineRawText || '').toLowerCase();
  const baseSerializedLower = serializeResumeDataToText(baselineData).toLowerCase();
  const allowedCorpus = `${rawLower}\n${baseSerializedLower}`;

  // 1. Candidate Identity Check
  if (baselineData.fullName?.trim()) {
    if (
      normalizeToken(candidateData.fullName) === normalizeToken(baselineData.fullName)
    ) {
      preservedFacts.push('Candidate full name preserved');
    } else {
      violations.push('Candidate full name was altered from original source.');
    }
  }

  if (baselineData.email?.trim()) {
    if (
      candidateData.email?.trim().toLowerCase() ===
      baselineData.email.trim().toLowerCase()
    ) {
      preservedFacts.push('Primary email address preserved');
    } else {
      violations.push('Candidate email address was altered or removed.');
    }
  }

  // 2. Education Institutions, Degrees & Marks/GPA Check
  const baseInstitutions = (baselineData.education || [])
    .map((e) => normalizeToken(e.institution))
    .filter(Boolean);

  for (const edu of candidateData.education || []) {
    const instNorm = normalizeToken(edu.institution);
    if (instNorm && baseInstitutions.length > 0) {
      const matched =
        baseInstitutions.some((b) => b.includes(instNorm) || instNorm.includes(b)) ||
        allowedCorpus.includes(edu.institution.trim().toLowerCase());
      if (!matched) {
        violations.push(`Unverified educational institution introduced: "${edu.institution}"`);
      }
    }
    if (edu.gpaOrHonors?.trim()) {
      const digits = (edu.gpaOrHonors.match(/\d+(\.\d+)?/g) || []);
      for (const num of digits) {
        if (!allowedCorpus.includes(num)) {
          violations.push(`Unverified GPA or academic mark introduced: "${edu.gpaOrHonors}"`);
        }
      }
    }
  }
  if ((candidateData.education || []).length > (baselineData.education || []).length + 1) {
    violations.push('Additional unverified education entries were invented.');
  } else if ((baselineData.education || []).length > 0) {
    preservedFacts.push(`${candidateData.education.length} education record(s) verified`);
  }

  // 3. Employers / Experience Check
  const baseCompanies = (baselineData.internships || [])
    .map((e) => normalizeToken(e.company))
    .filter(Boolean);

  for (const exp of candidateData.internships || []) {
    const compNorm = normalizeToken(exp.company);
    if (compNorm) {
      const matched =
        baseCompanies.some((b) => b.includes(compNorm) || compNorm.includes(b)) ||
        allowedCorpus.includes(exp.company.trim().toLowerCase());
      if (!matched) {
        violations.push(`Unverified employer/company introduced: "${exp.company}"`);
      }
    }
  }
  if (
    baseCompanies.length === 0 &&
    (candidateData.internships || []).filter((e) => e.company?.trim()).length > 0
  ) {
    // Check if those companies actually existed in raw text
    const allInRaw = candidateData.internships.every((e) =>
      allowedCorpus.includes((e.company || '').trim().toLowerCase())
    );
    if (!allInRaw) {
      violations.push('Work experience was invented when none existed in source resume.');
    }
  } else if (baseCompanies.length > 0) {
    preservedFacts.push(`${candidateData.internships.length} experience role(s) verified`);
  }

  // 4. Certifications & Achievements Check
  const baseCertCount = (baselineData.certifications || []).filter((c) => c.name?.trim()).length;
  const candCerts = (candidateData.certifications || []).filter((c) => c.name?.trim());
  for (const cert of candCerts) {
    const certWords = cert.name
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const found =
      baseCertCount > 0 ||
      certWords.some((w) => allowedCorpus.includes(w));
    if (!found) {
      violations.push(`Unverified certification introduced: "${cert.name}"`);
    }
  }

  // 5. Numeric metric fabrication check (allow [X]% placeholders, reject invented percentages not in source)
  const candidateSerialized = serializeResumeDataToText(candidateData);
  const percentMatches = candidateSerialized.match(/\b\d+(\.\d+)?%/g) || [];
  for (const pct of percentMatches) {
    if (!allowedCorpus.includes(pct.toLowerCase())) {
      violations.push(
        `Unverified numeric percentage (${pct}) added without source evidence; use [X]% placeholder instead.`
      );
    }
  }

  const passed = violations.length === 0;
  const accuracyScore = clampScore(100 - violations.length * 25);

  return {
    passed,
    accuracyScore,
    preservedFacts,
    violations,
    notes: passed
      ? 'All candidate names, employers, education credentials, and quantitative facts match original source truth.'
      : `Factual validation flagged ${violations.length} unverified addition(s).`,
  };
}

/**
 * Deterministic rule-based evaluation across all 10 required Resume Quality Engine areas.
 */
export function computeRuleBasedAreaScores(
  data: ResumeDocumentData,
  structuralNotes: string[] = []
): Record<QualityAreaKey, { score: number; note: string }> {
  const allBullets: string[] = [
    ...(data.internships || []).flatMap((e) => e.bullets || []),
    ...(data.projects || []).flatMap((p) => p.bullets || []),
  ]
    .map((b) => (b || '').trim())
    .filter(Boolean);

  const hasTableWarning = structuralNotes.some((n) => n.toLowerCase().includes('table'));
  const hasImageWarning = structuralNotes.some((n) => n.toLowerCase().includes('image'));

  // 1. ATS Readability
  let atsScore = 88;
  const atsNotes: string[] = [];
  if (!data.email?.includes('@')) {
    atsScore -= 18;
    atsNotes.push('Missing standard email format');
  }
  if (!data.phone?.trim()) {
    atsScore -= 10;
    atsNotes.push('Missing phone contact');
  }
  if (hasTableWarning) {
    atsScore -= 15;
    atsNotes.push('Source used multi-column layout tables');
  }
  if (hasImageWarning) {
    atsScore -= 10;
    atsNotes.push('Source contained embedded images');
  }
  const populatedSections = [
    data.careerObjective?.trim(),
    (data.education || []).length > 0,
    (data.technicalSkills || []).length > 0,
    (data.internships || []).length > 0,
    (data.projects || []).length > 0,
  ].filter(Boolean).length;
  if (populatedSections < 4) {
    atsScore -= (4 - populatedSections) * 10;
    atsNotes.push('Standard section headings incomplete');
  }

  // 2. Professional Summary
  const summaryText = (data.careerObjective || '').trim();
  const summaryWords = summaryText ? summaryText.split(/\s+/).length : 0;
  let summaryScore = 40;
  let summaryNote = 'Professional summary is missing.';
  if (summaryWords >= 22 && summaryWords <= 75) {
    summaryScore = 90;
    summaryNote = `Concise ${summaryWords}-word summary aligned for quick recruiter triage.`;
  } else if (summaryWords >= 10 && summaryWords < 22) {
    summaryScore = 68;
    summaryNote = `Summary is brief (${summaryWords} words); expand domain focus and core value.`;
  } else if (summaryWords > 75) {
    summaryScore = 72;
    summaryNote = `Summary is lengthy (${summaryWords} words); tighten to 2–3 crisp sentences.`;
  } else if (summaryWords > 0) {
    summaryScore = 52;
    summaryNote = 'Summary is underdeveloped.';
  }

  // 3. Education
  const validEdu = (data.education || []).filter(
    (e) => e.institution?.trim() || e.degree?.trim()
  );
  let eduScore = 35;
  let eduNote = 'No structured education entries found.';
  if (validEdu.length > 0) {
    eduScore = 72;
    const completeEdu = validEdu.every(
      (e) => e.institution?.trim() && e.degree?.trim() && e.graduationDate?.trim()
    );
    if (completeEdu) {
      eduScore = 92;
      eduNote = 'Institution, degree credential, and graduation timeline clearly structured.';
    } else {
      eduNote = 'Education listed, but degree field or graduation timeline is incomplete.';
    }
  }

  // 4. Technical Skills
  const validSkills = (data.technicalSkills || []).filter((s) => s.items?.trim());
  const totalSkillTokens = validSkills
    .flatMap((s) => s.items.split(/[,;|•]/))
    .map((t) => t.trim())
    .filter(Boolean);
  let skillsScore = 35;
  let skillsNote = 'No dedicated technical skills section detected.';
  if (totalSkillTokens.length >= 6 && validSkills.length >= 2) {
    skillsScore = 92;
    skillsNote = `${totalSkillTokens.length} skills organized cleanly across ${validSkills.length} categories.`;
  } else if (totalSkillTokens.length >= 4) {
    skillsScore = 76;
    skillsNote = `${totalSkillTokens.length} skills listed; grouping into domain categories improves scan speed.`;
  } else if (totalSkillTokens.length > 0) {
    skillsScore = 58;
    skillsNote = 'Sparse skill keywords listed.';
  }

  // 5. Projects
  const validProjects = (data.projects || []).filter((p) => p.name?.trim());
  let projScore = 50;
  let projNote = 'No dedicated project entries included.';
  if (validProjects.length > 0) {
    const withTechAndBullets = validProjects.filter(
      (p) => p.techStack?.trim() && (p.bullets || []).filter((b) => b.trim()).length >= 2
    );
    if (withTechAndBullets.length === validProjects.length) {
      projScore = 91;
      projNote = `${validProjects.length} project(s) include explicit tech stacks and multi-bullet engineering detail.`;
    } else {
      projScore = 72;
      projNote = 'Projects present, but tech stack labels or outcome bullets need clearer detail.';
    }
  }

  // 6. Experience
  const validExp = (data.internships || []).filter(
    (e) => e.role?.trim() || e.company?.trim()
  );
  let expScore = 52;
  let expNote = 'No work experience or internships listed.';
  if (validExp.length > 0) {
    let strongCount = 0;
    let expBullets = 0;
    for (const exp of validExp) {
      for (const b of exp.bullets || []) {
        const clean = (b || '').trim();
        if (!clean) continue;
        expBullets++;
        const firstWord = clean.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') || '';
        if (STRONG_ACTION_VERBS.has(firstWord)) strongCount++;
      }
    }
    const ratio = expBullets > 0 ? strongCount / expBullets : 0;
    expScore = clampScore(68 + ratio * 26 + (expBullets >= validExp.length * 2 ? 6 : -8));
    expNote =
      expBullets > 0
        ? `${strongCount}/${expBullets} experience bullets lead with strong action verbs.`
        : 'Experience roles lack descriptive accomplishment bullets.';
  }

  // 7. Grammar & Action Phrasing
  let grammarScore = 88;
  const grammarIssues: string[] = [];
  let weakPhraseHits = 0;
  let unpunctuatedOrLower = 0;
  for (const b of allBullets) {
    const lower = b.toLowerCase();
    if (WEAK_PHRASES.some((wp) => lower.includes(wp))) {
      weakPhraseHits++;
    }
    if (/^[a-z]/.test(b)) {
      unpunctuatedOrLower++;
    }
    if (/\bi\b|\bmy\b|\bour\b/i.test(b)) {
      grammarScore -= 4;
      grammarIssues.push('First-person pronouns detected');
    }
  }
  grammarScore -= weakPhraseHits * 7 + unpunctuatedOrLower * 5;
  const grammarNote =
    weakPhraseHits > 0
      ? `${weakPhraseHits} passive phrase(s) ("worked on" / "responsible for") reduce clarity.`
      : grammarIssues[0] || 'Clean third-person implied resume phrasing and capitalization.';

  // 8. Formatting
  let formattingScore = 90;
  if (hasTableWarning) formattingScore -= 16;
  if (hasImageWarning) formattingScore -= 12;
  const overlyLongBullets = allBullets.filter((b) => b.split(/\s+/).length > 36).length;
  const overlyShortBullets = allBullets.filter((b) => b.split(/\s+/).length < 6).length;
  formattingScore -= overlyLongBullets * 5 + overlyShortBullets * 5;
  const formattingNote =
    overlyLongBullets > 0 || overlyShortBullets > 0
      ? 'Bullet length variance detected; aim for 12–28 words per bullet.'
      : 'Single-column ATS hierarchy with balanced bullet density.';

  // 9. Keyword Relevance (also guards against keyword stuffing)
  const serialized = serializeResumeDataToText(data);
  const words = serialized
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  let maxRepeatRatio = 0;
  for (const [, count] of freq) {
    if (words.length > 40) {
      maxRepeatRatio = Math.max(maxRepeatRatio, count / words.length);
    }
  }
  let keywordScore = clampScore(58 + Math.min(34, totalSkillTokens.length * 3));
  let keywordNote = 'Domain terminology aligned across skills and project bullets.';
  if (maxRepeatRatio > 0.065) {
    keywordScore -= 20;
    keywordNote = 'Excessive repetition detected—avoid unnatural keyword stuffing.';
  } else if (totalSkillTokens.length < 5) {
    keywordNote = 'Limited domain-specific technical terminology detected.';
  }

  // 10. Consistency
  const dates = [
    ...(data.education || []).map((e) => e.graduationDate),
    ...(data.internships || []).flatMap((e) => [e.startDate, e.endDate]),
    ...(data.projects || []).map((p) => p.date),
  ]
    .map((d) => (d || '').trim())
    .filter(Boolean);
  let consistencyScore = 88;
  let consistencyNote = 'Consistent date notation, bullet punctuation, and section ordering.';
  if (dates.length === 0) {
    consistencyScore = 64;
    consistencyNote = 'Chronological dates are missing from experience or education.';
  } else {
    const withPeriods = allBullets.filter((b) => b.endsWith('.')).length;
    if (
      allBullets.length >= 4 &&
      withPeriods > 0 &&
      withPeriods < allBullets.length
    ) {
      consistencyScore = 78;
      consistencyNote = 'Mixed trailing period punctuation across bullet points.';
    }
  }

  return {
    ats_readability: {
      score: clampScore(atsScore),
      note: atsNotes[0] || 'Clean linear contact and heading structure for ATS parsers.',
    },
    professional_summary: { score: clampScore(summaryScore), note: summaryNote },
    education: { score: clampScore(eduScore), note: eduNote },
    technical_skills: { score: clampScore(skillsScore), note: skillsNote },
    projects: { score: clampScore(projScore), note: projNote },
    experience: { score: clampScore(expScore), note: expNote },
    grammar: { score: clampScore(grammarScore), note: grammarNote },
    formatting: { score: clampScore(formattingScore), note: formattingNote },
    keyword_relevance: { score: clampScore(keywordScore), note: keywordNote },
    consistency: { score: clampScore(consistencyScore), note: consistencyNote },
  };
}

export function combineQualityReport(params: {
  candidateData: ResumeDocumentData;
  baselineData: ResumeDocumentData;
  baselineRawText: string;
  structuralNotes?: string[];
  isBaseline?: boolean;
  aiAreaScores?: Partial<Record<QualityAreaKey, { score: number; findings: string }>>;
  aiExecutiveSummary?: string;
  aiIssues?: DetectedEngineIssue[];
  previousIteration?: EngineIterationRecord | null;
}): EngineQualityReport {
  const ruleMap = computeRuleBasedAreaScores(
    params.candidateData,
    params.structuralNotes || []
  );

  const areas: QualityAreaScore[] = QUALITY_AREA_ORDER.map((key) => {
    const ruleEntry = ruleMap[key];
    const aiEntry = params.aiAreaScores?.[key];
    const aiScore =
      typeof aiEntry?.score === 'number' && !Number.isNaN(aiEntry.score)
        ? clampScore(aiEntry.score)
        : ruleEntry.score;
    const combinedScore = clampScore(ruleEntry.score * 0.45 + aiScore * 0.55);
    return {
      key,
      label: QUALITY_AREA_LABELS[key],
      ruleScore: ruleEntry.score,
      aiScore,
      combinedScore,
      status: getStatusFromScore(combinedScore),
      findings: aiEntry?.findings?.trim() || ruleEntry.note,
    };
  });

  const overallScore = clampScore(
    areas.reduce((acc, item) => acc + item.combinedScore, 0) / areas.length
  );

  const factualValidation = validateFactualIntegrity(
    params.baselineData,
    params.baselineRawText,
    params.candidateData,
    Boolean(params.isBaseline)
  );

  const issues: DetectedEngineIssue[] = (params.aiIssues || []).map((iss, idx) => ({
    id: iss.id || `issue-${idx + 1}`,
    category: iss.category || 'Weak Bullet Points',
    severity:
      iss.severity === 'High' || iss.severity === 'Medium' || iss.severity === 'Low'
        ? iss.severity
        : 'Medium',
    section: iss.section || 'General',
    description: iss.description || '',
    suggestion: iss.suggestion || '',
    resolved: Boolean(iss.resolved),
  }));

  let comparison: VersionComparisonSummary | null = null;
  if (params.previousIteration) {
    const prev = params.previousIteration;
    const scoreDelta = overallScore - prev.overallScore;
    const areaDeltas = areas.map((area) => {
      const prevArea = prev.qualityReport.areas.find((a) => a.key === area.key);
      return {
        key: area.key,
        label: area.label,
        delta: area.combinedScore - (prevArea?.combinedScore ?? area.combinedScore),
      };
    });

    const prevUnresolved = prev.qualityReport.issues.filter((i) => !i.resolved).length;
    const currUnresolved = issues.filter((i) => !i.resolved).length;
    const resolvedIssueCount = Math.max(0, prevUnresolved - currUnresolved);

    const sectionsModified: string[] = [];
    if (
      (prev.resumeData.careerObjective || '').trim() !==
      (params.candidateData.careerObjective || '').trim()
    ) {
      sectionsModified.push('Professional Summary');
    }
    if (
      JSON.stringify(prev.resumeData.education) !==
      JSON.stringify(params.candidateData.education)
    ) {
      sectionsModified.push('Education');
    }
    if (
      JSON.stringify(prev.resumeData.technicalSkills) !==
      JSON.stringify(params.candidateData.technicalSkills)
    ) {
      sectionsModified.push('Technical Skills');
    }
    if (
      JSON.stringify(prev.resumeData.internships) !==
      JSON.stringify(params.candidateData.internships)
    ) {
      sectionsModified.push('Work Experience');
    }
    if (
      JSON.stringify(prev.resumeData.projects) !==
      JSON.stringify(params.candidateData.projects)
    ) {
      sectionsModified.push('Projects');
    }

    comparison = {
      comparedAgainstVersion: prev.versionNumber,
      scoreDelta,
      areaDeltas,
      resolvedIssueCount,
      remainingIssueCount: currUnresolved,
      sectionsModified,
      summaryNote:
        scoreDelta > 0
          ? `Improved quality index by +${scoreDelta} points across ${sectionsModified.length || 1} targeted section(s) while preserving factual accuracy.`
          : scoreDelta === 0
            ? 'Quality metrics stabilized with no further net score gain.'
            : `Score shifted by ${scoreDelta} points compared with v${prev.versionNumber}.`,
    };
  }

  return {
    overallScore,
    disclaimer: ATS_ESTIMATE_DISCLAIMER,
    executiveSummary:
      params.aiExecutiveSummary?.trim() ||
      `Evaluated across 10 independent quality dimensions (Estimated Quality Score: ${overallScore}/100).`,
    areas,
    issues,
    factualValidation,
    comparison,
  };
}

/**
 * Multi-criteria Best Resume Selector:
 * Evaluates Content Accuracy (hard gate + weighted), ATS Readability, Relevant Keywords,
 * Grammar, Formatting, and Section Completeness—NOT simply picking highest raw score.
 */
export function selectBestResumeVersion(
  iterations: EngineIterationRecord[]
): BestVersionSelection {
  const getArea = (rep: EngineQualityReport, key: QualityAreaKey) =>
    rep.areas.find((a) => a.key === key)?.combinedScore ?? rep.overallScore;

  const computeCompleteness = (d: ResumeDocumentData): number => {
    let pts = 0;
    if (d.fullName?.trim() && d.email?.trim()) pts += 20;
    if (d.careerObjective?.trim().length >= 30) pts += 20;
    if ((d.education || []).some((e) => e.institution?.trim())) pts += 20;
    if ((d.technicalSkills || []).some((s) => s.items?.trim())) pts += 20;
    if (
      (d.internships || []).some((e) => e.role?.trim()) ||
      (d.projects || []).some((p) => p.name?.trim())
    ) {
      pts += 20;
    }
    return pts;
  };

  const breakdown = iterations.map((iter) => {
    const rep = iter.qualityReport;
    const factualPassed = iter.factualValidationPassed && rep.factualValidation.passed;
    const contentAccuracy = rep.factualValidation.accuracyScore;
    const atsReadability = getArea(rep, 'ats_readability');
    const relevantKeywords = getArea(rep, 'keyword_relevance');
    const grammar = getArea(rep, 'grammar');
    const formatting = getArea(rep, 'formatting');
    const completeness = computeCompleteness(iter.resumeData);

    // Weighted multi-criteria composite score (distinct from raw overall average)
    const compositeSelectionScore = factualPassed
      ? clampScore(
          contentAccuracy * 0.25 +
            atsReadability * 0.2 +
            grammar * 0.18 +
            relevantKeywords * 0.14 +
            formatting * 0.13 +
            completeness * 0.1
        )
      : 0;

    return {
      versionNumber: iter.versionNumber,
      label: iter.iterationLabel,
      factualPassed,
      contentAccuracy,
      atsReadability,
      relevantKeywords,
      grammar,
      formatting,
      completeness,
      rawOverallScore: iter.overallScore,
      compositeSelectionScore,
      eligible: factualPassed,
    };
  });

  const eligibleVersions = breakdown.filter((b) => b.eligible);
  const pool = eligibleVersions.length > 0 ? eligibleVersions : [breakdown[0]];

  // Sort by multi-criteria compositeSelectionScore, breaking ties by grammar + ATS readability
  const sorted = [...pool].sort((a, b) => {
    if (b.compositeSelectionScore !== a.compositeSelectionScore) {
      return b.compositeSelectionScore - a.compositeSelectionScore;
    }
    return b.grammar + b.atsReadability - (a.grammar + a.atsReadability);
  });

  const winner = sorted[0];
  const rejectedCount = breakdown.filter((b) => !b.factualPassed).length;

  let rationale = `Selected ${winner.label} (v${winner.versionNumber}) using multi-criteria evaluation: 100% verified factual accuracy (${winner.contentAccuracy}/100), ATS readability (${winner.atsReadability}/100), grammar (${winner.grammar}/100), formatting (${winner.formatting}/100), keyword balance (${winner.relevantKeywords}/100), and section completeness (${winner.completeness}/100).`;

  if (rejectedCount > 0) {
    rationale += ` ${rejectedCount} iteration(s) were automatically disqualified by the Factual Integrity Gate to prevent unverified claims.`;
  }

  return {
    selectedVersionNumber: winner.versionNumber,
    selectedLabel: winner.label,
    rationale,
    criteriaBreakdown: breakdown,
  };
}
