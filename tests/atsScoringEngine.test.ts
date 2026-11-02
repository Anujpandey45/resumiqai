import assert from 'node:assert/strict';
import test from 'node:test';
import { jsPDF } from 'jspdf';
import type { AtsCheckReport } from '../src/types.ts';
import {
  computeDeterministicAtsReport,
  detectKeywordStuffing,
  evaluateGrammarAndSpelling,
  parseJobDescriptionRequirements,
  parseResumeSections,
} from '../src/server/atsScoringEngine.ts';
import {
  DocumentValidationError,
  parseResumeBuffer,
} from '../src/server/docParser.ts';

const REQUIRED_TEN_CATEGORY_KEYS = [
  'formatting_readability',
  'contact_information',
  'professional_summary',
  'technical_skills',
  'jd_keyword_matching',
  'work_experience',
  'projects_achievements',
  'education',
  'certifications',
  'grammar_spelling',
];

const BACKEND_JOB_DESCRIPTION = `
Senior Backend & Full-Stack Software Engineer

Requirements:
- 3+ years building production web services with TypeScript, Node.js, and React.
- Strong experience designing relational schemas in PostgreSQL and caching with Redis.
- Proven track record building REST API microservices and deploying containers with Docker on AWS.
- Automated CI/CD pipelines with GitHub Actions and comprehensive unit testing with Jest.

Preferred Qualifications:
- Experience with Kubernetes, GraphQL, and Terraform is a plus.
- Nice to have: observability dashboards using Prometheus or Grafana.
`.trim();

const HEALTHCARE_NURSING_JOB_DESCRIPTION = `
Registered Nurse - Intensive Care Unit (ICU)

Requirements:
- Active Registered Nurse license and Bachelor of Science in Nursing.
- Experience with patient triage, ventilator monitoring, medication administration, and bedside critical care.
- Strong clinical documentation, customer support, and operations management in acute hospital wards.

Preferred:
- Critical care nursing certification and public speaking for family care briefings.
`.trim();

const WELL_FORMATTED_RESUME = `
Elena Rostova
San Francisco, CA | +1 (415) 890-4321 | elena.rostova@example.com | https://linkedin.com/in/elenarostova | https://github.com/erostova

Professional Summary
Backend-focused Full-Stack Software Engineer with 4 years of experience architecting scalable TypeScript, NodeJS, and React platforms. Proven track record optimizing Postgres databases, Redis caching layers, and containerized microservices on Amazon Web Services.

Technical Skills
Languages & Frameworks: TypeScript, JavaScript, NodeJS, React.js, Express, RESTful APIs, GraphQL
Databases & Cloud: Postgres, Redis, Docker, K8s, Amazon Web Services, GitHub Actions, CI/CD, Jest

Work Experience
Software Engineer — CloudPulse Systems (Jan 2023 – Present)
• Architected multi-tenant RESTful APIs using NodeJS, TypeScript, and Postgres serving 120,000+ users with 99.95% uptime.
• Reduced median database query latency by 42% by indexing high-traffic Postgres tables and introducing Redis read-through caching.
• Automated Docker container builds and Jest unit testing workflows in GitHub Actions, cutting deployment time from 25 minutes to 6 minutes.
• Migrated 8 core microservices onto K8s clusters on Amazon Web Services with zero customer downtime.

Software Engineering Intern — DataVantage Inc. (May 2022 – Dec 2022)
• Developed interactive analytics views in React.js and TypeScript used daily by 450+ enterprise customers.
• Built 35+ automated Jest unit tests and integration tests covering authentication and billing endpoints.

Projects
Distributed Webhook Relay Engine (TypeScript, NodeJS, Redis, Docker) — https://github.com/erostova/webhook-relay
• Engineered an event-driven webhook delivery engine handling 15,000+ requests per minute with exponential backoff retries.
• Containerized worker services with Docker and published automated benchmark suites verifying 99.9% delivery reliability.

Education
University of California, Berkeley — Bachelor of Science in Computer Science (May 2022)

Certifications
• AWS Certified Solutions Architect – Associate — Amazon Web Services (2024)
`.trim();

const POORLY_FORMATTED_RESUME = `
john smith
i am looking for a job where i can use my computer background and grow my career in tech.. i worked on teh company website and was responsible for fixing bugs and helped with managment tasks,, duties included updating pages and talking to clients in the the office enviroment while learning javscript and databse tools.
`.trim();

/**
 * Verifies every mandatory invariant across any generated ATS report.
 */
function assertReportInvariants(
  report: AtsCheckReport,
  inputForDeterminism?: Parameters<typeof computeDeterministicAtsReport>[0]
) {
  // 1. Score strictly in [0, 100] and equals exact sum of category pointsEarned
  assert.equal(typeof report.overallScore, 'number');
  assert.ok(!Number.isNaN(report.overallScore), 'overallScore must not be NaN');
  assert.ok(
    report.overallScore >= 0 && report.overallScore <= 100,
    `overallScore (${report.overallScore}) must be within [0, 100]`
  );

  // 2. All 10 required categories exist and maxPoints total strictly 100
  assert.equal(report.criteriaBreakdown.length, 10, 'Must evaluate all 10 required categories');
  const keys = report.criteriaBreakdown.map((c) => c.key);
  assert.deepEqual(keys, REQUIRED_TEN_CATEGORY_KEYS);

  const weightSum = report.criteriaBreakdown.reduce((sum, c) => sum + c.maxPoints, 0);
  assert.equal(weightSum, 100, `Category weights must sum to 100, got ${weightSum}`);
  assert.equal(report.totalMaxPoints, 100);

  const earnedSum = report.criteriaBreakdown.reduce((sum, c) => sum + c.pointsEarned, 0);
  assert.equal(
    report.overallScore,
    earnedSum,
    `overallScore (${report.overallScore}) must equal exact sum of category marks (${earnedSum})`
  );

  for (const cat of report.criteriaBreakdown) {
    assert.ok(
      cat.pointsEarned >= 0 && cat.pointsEarned <= cat.maxPoints,
      `Category ${cat.key} pointsEarned (${cat.pointsEarned}) out of bounds [0, ${cat.maxPoints}]`
    );
    if (cat.pointsEarned < cat.maxPoints) {
      assert.ok(
        Array.isArray(cat.deductions) && cat.deductions.length > 0,
        `Category ${cat.key} lost points (${cat.pointsEarned}/${cat.maxPoints}) and MUST explain why marks were deducted`
      );
    }
  }

  // 3. Zero duplicate critical issues or warnings
  const allDiagnosticIds = [
    ...report.criticalIssues.map((i) => i.id),
    ...report.warnings.map((i) => i.id),
  ];
  assert.equal(
    new Set(allDiagnosticIds).size,
    allDiagnosticIds.length,
    `Duplicate issue IDs found: ${allDiagnosticIds.join(', ')}`
  );

  const allDiagnosticTitles = [
    ...report.criticalIssues.map((i) => i.title.toLowerCase()),
    ...report.warnings.map((i) => i.title.toLowerCase()),
  ];
  assert.equal(
    new Set(allDiagnosticTitles).size,
    allDiagnosticTitles.length,
    `Duplicate issue titles found: ${allDiagnosticTitles.join(', ')}`
  );

  for (const issue of [...report.criticalIssues, ...report.warnings]) {
    assert.ok(issue.explanation.length >= 15, `Issue ${issue.id} must include clear explanation`);
    assert.ok(issue.solution.length >= 15, `Issue ${issue.id} must include actionable solution`);
  }

  // 4. Honest disclaimer & non-guarantee statement
  assert.match(report.disclaimer, /Estimated ATS Compatibility Score/i);
  assert.match(report.disclaimer, /(?:no score|never)\s+guarantees interview selection/i);

  // 5. Determinism: identical inputs produce 100% identical outputs
  if (inputForDeterminism) {
    const secondRun = computeDeterministicAtsReport(inputForDeterminism);
    const thirdRun = computeDeterministicAtsReport(inputForDeterminism);
    assert.deepEqual(report, secondRun, 'Identical inputs must produce identical report (run 2)');
    assert.deepEqual(report, thirdRun, 'Identical inputs must produce identical report (run 3)');
  }
}

test('1. Well-formatted resume + matching JD scores strongly, recognizes technical synonyms, and separates Required vs Preferred skills', () => {
  const input = {
    resumeText: WELL_FORMATTED_RESUME,
    fileName: 'elena_rostova_resume.pdf',
    jobDescription: BACKEND_JOB_DESCRIPTION,
  };
  const report = computeDeterministicAtsReport(input);
  assertReportInvariants(report, input);

  assert.ok(
    report.overallScore >= 88,
    `Expected strong score >= 88 for complete matching resume, got ${report.overallScore}`
  );
  assert.equal(report.criticalIssues.length, 0, 'Well-formatted complete resume should have 0 critical issues');

  // Verify synonym recognition ("NodeJS" <-> "Node.js", "Postgres" <-> "PostgreSQL", "K8s" <-> "Kubernetes", etc.)
  assert.ok(report.jobMatch.matchedRequiredSkills.includes('Node.js'));
  assert.ok(report.jobMatch.matchedRequiredSkills.includes('PostgreSQL'));
  assert.ok(report.jobMatch.matchedRequiredSkills.includes('REST API'));
  assert.ok(report.jobMatch.matchedRequiredSkills.includes('AWS'));
  assert.ok(report.jobMatch.matchedPreferredSkills.includes('Kubernetes'));
  assert.ok(report.jobMatch.matchedPreferredSkills.includes('GraphQL'));
  assert.ok(report.jobMatch.missingPreferredSkills.includes('Terraform'));
  assert.ok(
    report.jobMatch.synonymMatches.length >= 3,
    'Should record recognized technical synonyms between resume and JD'
  );

  // Verify genuine passed checks exist
  const passedIds = new Set(report.passedChecks.map((p) => p.id));
  assert.ok(passedIds.has('contact_complete'));
  assert.ok(passedIds.has('education_complete'));
  assert.ok(passedIds.has('certifications_verified'));
  assert.ok(passedIds.has('grammar_clean'));
});

test('2. Poorly formatted resume with tables, images, missing sections, passive phrasing, and spelling errors receives accurate low score and zero fake passed checks', () => {
  const input = {
    resumeText: POORLY_FORMATTED_RESUME,
    fileName: 'poor_resume.docx',
    structuralNotes: [
      'DOCX contains layout tables (<table>).',
      'DOCX contains embedded images.',
    ],
    jobDescription: BACKEND_JOB_DESCRIPTION,
  };
  const report = computeDeterministicAtsReport(input);
  assertReportInvariants(report, input);

  assert.ok(
    report.overallScore <= 25,
    `Poorly formatted incomplete resume should score <= 25, got ${report.overallScore}`
  );

  const critIds = new Set(report.criticalIssues.map((c) => c.id));
  assert.ok(critIds.has('layout_tables_detected'), 'Must flag layout tables as critical');
  assert.ok(critIds.has('severely_thin_content'), 'Must flag <100 word resume as critical');
  assert.ok(critIds.has('missing_email'), 'Must flag missing email');
  assert.ok(critIds.has('missing_phone'), 'Must flag missing phone');
  assert.ok(critIds.has('missing_education'), 'Must flag missing education');
  assert.ok(critIds.has('grammar_spelling_errors'), 'Must flag multiple typos & grammar issues');

  // Verify ZERO fake passed checks
  assert.equal(
    report.passedChecks.length,
    0,
    `Poorly formatted resume must have 0 passed checks, got: ${report.passedChecks.map((p) => p.id).join(', ')}`
  );
});

test('3. Resume with missing contact information deducts exact contact marks and never marks contact_complete as passed', () => {
  const noContactResume = WELL_FORMATTED_RESUME.replace(
    'San Francisco, CA | +1 (415) 890-4321 | elena.rostova@example.com | https://linkedin.com/in/elenarostova | https://github.com/erostova',
    ''
  ).replace('https://github.com/erostova/webhook-relay', '');

  const input = {
    resumeText: noContactResume,
    fileName: 'missing_contact.pdf',
    jobDescription: BACKEND_JOB_DESCRIPTION,
  };
  const report = computeDeterministicAtsReport(input);
  assertReportInvariants(report, input);

  const contactCat = report.criteriaBreakdown.find((c) => c.key === 'contact_information')!;
  assert.equal(contactCat.pointsEarned, 2, 'Only name (2 pts) is present; email (3), phone (2), and location/link (1) must be deducted');
  assert.ok(contactCat.deductions!.some((d) => d.includes('Email address is missing')));
  assert.ok(contactCat.deductions!.some((d) => d.includes('Phone number is missing')));

  const critIds = new Set(report.criticalIssues.map((c) => c.id));
  assert.ok(critIds.has('missing_email'));
  assert.ok(critIds.has('missing_phone'));

  const passedIds = new Set(report.passedChecks.map((p) => p.id));
  assert.ok(!passedIds.has('contact_complete'), 'Must NOT claim contact_complete when email/phone are missing');
});

test('4. Resume with no projects receives 0/10 in Projects & Achievements, emits no_projects_section warning, and omits projects_documented passed check', () => {
  const resumeWithoutProjects = WELL_FORMATTED_RESUME.replace(
    /Projects[\s\S]*?(?=Education)/,
    ''
  );

  const input = {
    resumeText: resumeWithoutProjects,
    fileName: 'no_projects.pdf',
    jobDescription: BACKEND_JOB_DESCRIPTION,
  };
  const report = computeDeterministicAtsReport(input);
  assertReportInvariants(report, input);

  const projCat = report.criteriaBreakdown.find((c) => c.key === 'projects_achievements')!;
  assert.equal(projCat.pointsEarned, 0, 'Resume with no Projects or Achievements must earn 0/10');
  assert.equal(projCat.maxPoints, 10);

  const warnIds = new Set(report.warnings.map((w) => w.id));
  assert.ok(warnIds.has('no_projects_section'), 'Must warn when Projects section is absent');

  const passedIds = new Set(report.passedChecks.map((p) => p.id));
  assert.ok(!passedIds.has('projects_documented'), 'Must NOT pass projects_documented when Projects section is missing');
});

test('5. Resume with irrelevant keywords and keyword stuffing is not rewarded and triggers keyword stuffing penalty + warning', () => {
  const cleanNonMatchingResume = `
Marcus Vance
Austin, TX | +1 (512) 555-0199 | marcus.vance@example.com | https://linkedin.com/in/marcusvance

Professional Summary
Graphic Designer and Illustrator with 4 years of agency experience creating brand identities, print layouts, and social media marketing visuals using Photoshop, Illustrator, and Sketch.

Technical Skills
Design & Marketing: Photoshop, Illustrator, Sketch, Copywriting, Social Media Marketing, Email Marketing, HubSpot, QuickBooks

Work Experience
Senior Graphic Designer — BrightLeaf Studio (Feb 2022 – Present)
• Designed 60+ brand identity packages and social media marketing campaigns using Photoshop and Illustrator for retail clients.
• Increased email marketing click-through rates by 24% through visual layout A/B testing in HubSpot.
• Managed print production schedules across 15 client accounts with 100% on-time delivery.

Projects
Retail Packaging Redesign Suite (Photoshop, Illustrator, Sketch) — https://marcusvance.design
• Created sustainable packaging illustrations for 12 consumer beverage products sold in 80+ regional stores.

Education
University of Texas at Austin — Bachelor of Fine Arts in Design (May 2021)
`.trim();

  // Append irrelevant buzzwords AND stuffed repetitions of JD keywords
  const stuffedResume = `${cleanNonMatchingResume}

Additional Keywords
TypeScript TypeScript TypeScript TypeScript TypeScript TypeScript TypeScript TypeScript TypeScript TypeScript TypeScript TypeScript
PostgreSQL, PostgreSQL, PostgreSQL, PostgreSQL, PostgreSQL, PostgreSQL, PostgreSQL, PostgreSQL, PostgreSQL, PostgreSQL
Photoshop Illustrator Blockchain Solidity Agronomy Knitting Astrology`;

  const cleanReport = computeDeterministicAtsReport({
    resumeText: cleanNonMatchingResume,
    fileName: 'designer.pdf',
    jobDescription: BACKEND_JOB_DESCRIPTION,
  });
  assertReportInvariants(cleanReport);

  // Irrelevant design skills earn 0 required skill matches on Backend Engineering JD
  assert.equal(cleanReport.jobMatch.matchedRequiredSkills.length, 0);

  const stuffedReport = computeDeterministicAtsReport({
    resumeText: stuffedResume,
    fileName: 'stuffed.pdf',
    jobDescription: BACKEND_JOB_DESCRIPTION,
  });
  assertReportInvariants(stuffedReport);

  assert.equal(stuffedReport.jobMatch.keywordStuffingDetected, true, 'Must detect keyword stuffing');
  assert.ok(stuffedReport.jobMatch.stuffedTerms.includes('TypeScript'));
  assert.ok(stuffedReport.jobMatch.stuffedTerms.includes('PostgreSQL'));

  const warnIds = new Set(stuffedReport.warnings.map((w) => w.id));
  assert.ok(warnIds.has('keyword_stuffing'), 'Must emit keyword_stuffing warning');

  const jdCat = stuffedReport.criteriaBreakdown.find((c) => c.key === 'jd_keyword_matching')!;
  assert.ok(
    jdCat.deductions!.some((d) => d.toLowerCase().includes('stuffing')),
    'JD category deductions must record keyword stuffing penalty'
  );
});

test('6 & 7. Matching Job Description vs Non-Matching Job Description produces clear, honest score separation', () => {
  const matchingReport = computeDeterministicAtsReport({
    resumeText: WELL_FORMATTED_RESUME,
    fileName: 'elena.pdf',
    jobDescription: BACKEND_JOB_DESCRIPTION,
  });
  const nonMatchingReport = computeDeterministicAtsReport({
    resumeText: WELL_FORMATTED_RESUME,
    fileName: 'elena.pdf',
    jobDescription: HEALTHCARE_NURSING_JOB_DESCRIPTION,
  });

  assertReportInvariants(matchingReport);
  assertReportInvariants(nonMatchingReport);

  const matchJdPts = matchingReport.criteriaBreakdown.find(
    (c) => c.key === 'jd_keyword_matching'
  )!.pointsEarned;
  const nonMatchJdPts = nonMatchingReport.criteriaBreakdown.find(
    (c) => c.key === 'jd_keyword_matching'
  )!.pointsEarned;

  assert.ok(matchJdPts >= 16, `Expected high JD score (>=16/20) for matching JD, got ${matchJdPts}`);
  assert.equal(nonMatchJdPts, 0, `Expected 0/20 JD score for completely unrelated Nursing JD, got ${nonMatchJdPts}`);
  assert.ok(
    matchingReport.overallScore - nonMatchingReport.overallScore >= 16,
    `Matching JD (${matchingReport.overallScore}) must outscore non-matching JD (${nonMatchingReport.overallScore}) by at least 16 points`
  );

  const nonMatchCritIds = new Set(nonMatchingReport.criticalIssues.map((c) => c.id));
  assert.ok(
    nonMatchCritIds.has('zero_required_jd_skills'),
    'Must flag zero_required_jd_skills critical issue when resume matches 0 required JD skills'
  );
});

test('8a. Invalid, empty, and unreadable PDFs fail honestly with DocumentValidationError and never produce fake scores', async () => {
  // Empty 0-byte buffer
  await assert.rejects(
    () => parseResumeBuffer(Buffer.alloc(0), 'empty.pdf'),
    (err: unknown) => {
      assert.ok(err instanceof DocumentValidationError);
      assert.equal(err.code, 'EMPTY_DOCUMENT');
      return true;
    }
  );

  // Unsupported extension
  await assert.rejects(
    () => parseResumeBuffer(Buffer.from('plain text resume'), 'resume.txt'),
    (err: unknown) => {
      assert.ok(err instanceof DocumentValidationError);
      assert.equal(err.code, 'UNSUPPORTED_FILE_TYPE');
      return true;
    }
  );

  // Corrupted fake PDF header
  await assert.rejects(
    () => parseResumeBuffer(Buffer.from('%PDF-1.7 broken binary stream $$$$'), 'corrupt.pdf'),
    (err: unknown) => {
      assert.ok(err instanceof DocumentValidationError);
      assert.equal(err.code, 'CORRUPTED_DOCUMENT');
      return true;
    }
  );

  // Blank PDF with zero selectable text (simulating flattened/empty scan)
  const blankDoc = new jsPDF({ unit: 'pt', format: 'letter' });
  blankDoc.rect(40, 40, 500, 700);
  const blankPdfBuf = Buffer.from(blankDoc.output('arraybuffer'));

  await assert.rejects(
    () => parseResumeBuffer(blankPdfBuf, 'blank_scan.pdf'),
    (err: unknown) => {
      assert.ok(err instanceof DocumentValidationError);
      assert.ok(
        err.code === 'EMPTY_DOCUMENT' || err.code === 'SCANNED_PDF_UNREADABLE',
        `Unexpected error code: ${err.code}`
      );
      return true;
    }
  );
});

test('8b. Multi-column PDF coordinate parser separates Left and Right columns cleanly without interleaving sections', async () => {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  // Top spanning header banner
  doc.text('Aarav Mehta — Full-Stack Software Engineer', 40, 48);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    'Seattle, WA | +1 (206) 555-0148 | aarav.mehta@example.com | https://github.com/aaravmehta',
    40,
    66
  );

  // Left Column (x = 40..210)
  const leftLines = [
    'TECHNICAL SKILLS',
    'Languages: TypeScript, Python',
    'Backend: Node.js, PostgreSQL',
    'Cloud: AWS, Docker, Redis',
    'Testing: Jest, GitHub Actions',
    'EDUCATION',
    'University of Washington',
    'B.S. in Computer Science',
    'Graduated June 2022',
    'CERTIFICATIONS',
    'AWS Certified Developer (2024)',
  ];
  let leftY = 110;
  for (const line of leftLines) {
    doc.text(line, 40, leftY);
    leftY += 20;
  }

  // Right Column (x = 250..560) at the EXACT SAME Y coordinates!
  const rightLines = [
    'PROFESSIONAL SUMMARY',
    'Software Engineer experienced in TypeScript, Node.js, React, and AWS.',
    'Focused on reliable REST API design and automated CI/CD delivery.',
    'WORK EXPERIENCE',
    'Software Engineer — Cascade Cloud (2022 – Present)',
    '- Built scalable REST API services in Node.js and PostgreSQL for 50,000+ users.',
    '- Reduced API latency by 35% using Redis caching and Docker containers on AWS.',
    '- Implemented automated Jest unit testing pipelines in GitHub Actions.',
    'PROJECTS',
    'Realtime Metrics Collector (TypeScript, Redis, Docker)',
    '- Engineered telemetry ingestion pipeline handling 8,000+ requests per minute.',
  ];
  let rightY = 110;
  for (const line of rightLines) {
    doc.text(line, 250, rightY);
    rightY += 20;
  }

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  const parsed = await parseResumeBuffer(pdfBuffer, 'two_column_resume.pdf');

  assert.equal(parsed.isMultiColumn, true, 'Should detect two-column layout');
  // Left column heading TECHNICAL SKILLS must NOT be merged on the same line as PROFESSIONAL SUMMARY!
  assert.ok(
    !parsed.text.includes('TECHNICAL SKILLS  PROFESSIONAL SUMMARY'),
    'Left and right column headings must not interleave on the same line'
  );

  const sections = parseResumeSections(parsed.text);
  assert.ok(sections.detectedHeadingKeys.has('skills'), 'Skills section preserved');
  assert.ok(sections.detectedHeadingKeys.has('education'), 'Education section preserved');
  assert.ok(sections.detectedHeadingKeys.has('certifications'), 'Certifications section preserved');
  assert.ok(sections.detectedHeadingKeys.has('summary'), 'Summary section preserved');
  assert.ok(sections.detectedHeadingKeys.has('experience'), 'Experience section preserved');
  assert.ok(sections.detectedHeadingKeys.has('projects'), 'Projects section preserved');

  const report = computeDeterministicAtsReport({
    resumeText: parsed.text,
    fileName: 'two_column_resume.pdf',
    pageCount: parsed.pageCount,
    structuralNotes: parsed.structuralNotes,
    jobDescription: BACKEND_JOB_DESCRIPTION,
  });
  assertReportInvariants(report);
  assert.ok(
    report.warnings.some((w) => w.id === 'multi_column_pdf'),
    'Multi-column PDF should emit an honest compatibility warning while still extracting all content accurately'
  );
});

test('9. Sub-analyzers (JD parser, Grammar checker, Stuffing detector) work deterministically on edge cases', () => {
  const jdParsed = parseJobDescriptionRequirements(BACKEND_JOB_DESCRIPTION);
  assert.ok(jdParsed.requiredSkills.includes('typescript'));
  assert.ok(jdParsed.requiredSkills.includes('postgresql'));
  assert.ok(jdParsed.preferredSkills.includes('kubernetes'));
  assert.ok(jdParsed.preferredSkills.includes('terraform'));
  assert.ok(!jdParsed.requiredSkills.includes('terraform'), 'Preferred skill must not leak into required skills');

  const grammar = evaluateGrammarAndSpelling(
    '• built a microservice in teh cloud enviroment and recieve alerts..',
    ['• built a microservice in teh cloud enviroment and recieve alerts..']
  );
  assert.ok(grammar.misspelledExamples.length >= 3);

  const noStuff = detectKeywordStuffing(WELL_FORMATTED_RESUME, 240);
  assert.equal(noStuff.keywordStuffingDetected, false);
});

test('10. Live HTTP /api/ats/check endpoint enforces deterministic scoring and rejects invalid PDFs with 400 (no fake score)', async () => {
  const baseUrl = 'http://127.0.0.1:3000';
  let serverReachable = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const health = await fetch(`${baseUrl}/api/health`);
      if (health.ok) {
        serverReachable = true;
        break;
      }
    } catch {
      // Wait for dev server startup
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  assert.equal(serverReachable, true, 'Express dev server on port 3000 must be reachable');

  // 10a. Valid deterministic JSON check — two identical HTTP calls must return identical scores
  const payload = {
    resumeText: WELL_FORMATTED_RESUME,
    fileName: 'elena_rostova.pdf',
    fileType: 'pdf',
    jobDescription: BACKEND_JOB_DESCRIPTION,
    consentConfirmed: true,
    includeAiTips: false,
  };

  const [res1, res2] = await Promise.all([
    fetch(`${baseUrl}/api/ats/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    fetch(`${baseUrl}/api/ats/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  ]);

  assert.equal(res1.status, 200);
  assert.equal(res2.status, 200);
  const body1 = (await res1.json()) as { report: AtsCheckReport };
  const body2 = (await res2.json()) as { report: AtsCheckReport };
  assert.deepEqual(body1.report, body2.report, 'HTTP /api/ats/check must be 100% deterministic');
  assertReportInvariants(body1.report);

  // 10b. Invalid corrupted PDF upload must return 400 with understandable error and NO report/fake score
  const badForm = new FormData();
  badForm.append(
    'resumeFile',
    new Blob([Buffer.from('not-a-real-pdf-binary')], { type: 'application/pdf' }),
    'corrupted.pdf'
  );
  badForm.append('consentConfirmed', 'true');
  badForm.append('includeAiTips', 'false');

  const badRes = await fetch(`${baseUrl}/api/ats/check`, {
    method: 'POST',
    body: badForm,
  });
  assert.equal(badRes.status, 400);
  const badJson = (await badRes.json()) as { error?: string; report?: unknown };
  assert.ok(typeof badJson.error === 'string' && badJson.error.length > 10);
  assert.equal(badJson.report, undefined, 'Invalid PDF must never return a fake ATS report');
});
