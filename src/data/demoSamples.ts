import type { ResumeDocumentData } from '../types.ts';

export const DEFAULT_SECTION_ORDER: ResumeDocumentData['sectionOrder'] = [
  'objective',
  'education',
  'skills',
  'internships',
  'projects',
  'certifications',
  'achievements',
];

export const EMPTY_RESUME_DATA: ResumeDocumentData = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  websiteOrLinkedin: '',
  careerObjective: '',
  education: [
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
  technicalSkills: [
    {
      id: 'skill-1',
      category: 'Languages & Frameworks',
      items: '',
    },
  ],
  internships: [
    {
      id: 'exp-1',
      role: '',
      company: '',
      type: 'Work Experience',
      location: '',
      startDate: '',
      endDate: '',
      bullets: [''],
    },
  ],
  projects: [
    {
      id: 'proj-1',
      name: '',
      techStack: '',
      link: '',
      date: '',
      bullets: [''],
    },
  ],
  certifications: [],
  achievements: [],
  sectionOrder: [...DEFAULT_SECTION_ORDER],
};

/**
 * Clearly labeled DEMO SAMPLE resume data strictly for optional user testing in the Builder or Checker.
 * Never presented as the user's real resume; all ATS & Match scores are computed deterministically by resumiq.ai.
 */
export const DEMO_SAMPLE_RESUME: ResumeDocumentData = {
  fullName: 'Jordan Patel (Demo Sample)',
  email: 'jordan.patel.demo@example.com',
  phone: '+1 (415) 555-0192',
  location: 'San Francisco, CA',
  websiteOrLinkedin: 'linkedin.com/in/jordanpatel-demo',
  careerObjective:
    'Full-stack software engineer with 2 years of experience building TypeScript web applications and PostgreSQL APIs. Seeking a backend or full-stack engineering role focused on scalable cloud services.',
  education: [
    {
      id: 'demo-edu-1',
      institution: 'University of California, Davis',
      degree: 'B.S.',
      field: 'Computer Science',
      graduationDate: 'May 2024',
      location: 'Davis, CA',
      gpaOrHonors: 'GPA: 3.78 / 4.0 · Dean’s Honor List',
    },
  ],
  technicalSkills: [
    {
      id: 'demo-skill-1',
      category: 'Programming Languages',
      items: 'TypeScript, JavaScript (ES2023), Python, SQL, HTML5, CSS3',
    },
    {
      id: 'demo-skill-2',
      category: 'Frameworks & Cloud',
      items: 'React, Node.js, Express, PostgreSQL, Docker, GitHub Actions, AWS S3',
    },
  ],
  internships: [
    {
      id: 'demo-exp-1',
      role: 'Junior Full-Stack Engineer',
      company: 'Northstar Logistics Tech (Demo)',
      type: 'Work Experience',
      location: 'Oakland, CA',
      startDate: 'Jul 2024',
      endDate: 'Present',
      bullets: [
        'Developed shipment tracking REST endpoints in Node.js and PostgreSQL serving 14,000 daily status lookups.',
        'Reduced invoice table query latency by 38% by indexing composite foreign keys and eliminating N+1 queries.',
        'Built reusable React TypeScript dashboard filters used by 45 internal dispatch coordinators.',
      ],
    },
    {
      id: 'demo-exp-2',
      role: 'Software Engineering Intern',
      company: 'Clearview Analytics (Demo)',
      type: 'Internship',
      location: 'San Jose, CA',
      startDate: 'Jun 2023',
      endDate: 'Sep 2023',
      bullets: [
        'Automated nightly CSV ingestion validation scripts in Python, catching malformed vendor rows prior to ETL import.',
        'Wrote unit and integration tests in Vitest increasing checkout service line coverage from 61% to 84%.',
      ],
    },
  ],
  projects: [
    {
      id: 'demo-proj-1',
      name: 'PulseQueue — Distributed Task Monitor',
      techStack: 'TypeScript, Express, PostgreSQL, Redis, React',
      link: 'github.com/jordanpatel-demo/pulsequeue',
      date: '2024',
      bullets: [
        'Engineered a dead-letter queue inspection dashboard allowing developers to replay failed webhook jobs safely.',
        'Implemented token-bucket rate limiting middleware to protect downstream webhook consumers.',
      ],
    },
  ],
  certifications: [
    {
      id: 'demo-cert-1',
      name: 'AWS Certified Cloud Practitioner',
      issuer: 'Amazon Web Services',
      date: '2024',
      credentialId: 'DEMO-CCP-2024',
    },
  ],
  achievements: [
    {
      id: 'demo-ach-1',
      title: '1st Place — UC Davis Civic Data Hackathon',
      issuerOrContext: 'Built transit accessibility route planner among 62 student teams',
      date: '2023',
      description: 'Awarded top prize by municipal transit engineers for GTFS real-time delay accuracy.',
    },
  ],
  sectionOrder: [...DEFAULT_SECTION_ORDER],
};

export const DEMO_SAMPLE_RAW_RESUME_TEXT = `[DEMO SAMPLE RESUME — FOR ATS DIAGNOSTIC TESTING]
Alex Rivera
Email: alex.rivera.demo@example.com
Location: Austin, TX

Objective
Hardworking graduate looking for a software job where I can grow my skills and help the company succeed.

Education
B.S. Information Systems, Texas State University, 2024

Work History
Web Developer Intern — BrightLeaf Media (Summer 2023)
- Worked on company website pages and fixed bugs when reported by the team.
- Helped update database tables and attended daily standups.
- Responsible for testing forms on mobile browsers.

Projects
Weather Dashboard App
- Made a weather app using React and an external API that shows 5-day forecasts.

Skills
JavaScript, React, HTML, CSS, SQL, Git`;

export const DEMO_SAMPLE_JOB_DESCRIPTION = `[DEMO SAMPLE JOB DESCRIPTION — FULL-STACK ENGINEER]
Role: Mid-Level Full-Stack Software Engineer (TypeScript / Node.js)

Responsibilities:
- Design, build, and maintain production RESTful APIs using Node.js, Express, and PostgreSQL.
- Build responsive, accessible frontend workflows in React and TypeScript.
- Optimize SQL query performance, schema migrations, and automated CI/CD pipelines (GitHub Actions, Docker).
- Collaborate with product managers and designers to ship reliable SaaS features with strong observability and unit/integration test coverage.

Qualifications:
- 1–3+ years of software engineering experience (including internships and production projects).
- Strong proficiency in TypeScript, React, Node.js, and relational databases (PostgreSQL).
- Experience with cloud infrastructure (AWS or GCP), Docker, and automated testing frameworks.
- Clear written communication and ability to translate product requirements into maintainable architecture.`;
