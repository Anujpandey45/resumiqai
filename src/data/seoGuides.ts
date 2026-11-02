export interface GuideSection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  exampleBox?: {
    label: string;
    weakExample: string;
    strongExample: string;
    whyItWorks: string;
  };
}

export interface GuideFaqItem {
  question: string;
  answer: string;
}

export interface SeoGuideArticle {
  slug: string;
  path: string;
  shortNavTitle: string;
  h1: string;
  seoTitle: string;
  metaDescription: string;
  category: string;
  readingTimeMinutes: number;
  publishedDate: string;
  updatedDate: string;
  summaryLead: string;
  keyTakeaways: string[];
  sections: GuideSection[];
  faqs: GuideFaqItem[];
  relatedSlugs: string[];
}

export const SEO_GUIDE_ARTICLES: SeoGuideArticle[] = [
  {
    slug: 'what-is-an-ats-resume-checker',
    path: '/guides/what-is-an-ats-resume-checker',
    shortNavTitle: 'What Is an ATS Resume Checker?',
    h1: 'What Is an ATS Resume Checker? How Online Resume Scanners Work',
    seoTitle: 'What Is an ATS Resume Checker? How Resume Scanners Work',
    metaDescription:
      'Learn what an ATS resume checker does, how Applicant Tracking Systems parse PDF and Word resumes, and how recruiters search and filter job applications.',
    category: 'ATS Fundamentals',
    readingTimeMinutes: 6,
    publishedDate: '2025-02-10',
    updatedDate: '2026-10-31',
    summaryLead:
      'An ATS resume checker (also called an online resume scanner or AI resume analyzer) tests how cleanly hiring software extracts text from your CV and compares your skills against a target job description before you submit an application.',
    keyTakeaways: [
      'Applicant Tracking Systems (ATS) organize, parse, and index resumes into structured candidate profiles—they do not secretly reject resumes on arbitrary design whims unless the text itself is unreadable.',
      'A reliable free ATS resume checker tests two concrete things: document parseability (whether headings, dates, and contact details extract cleanly) and job description keyword alignment.',
      'No third-party ATS score checker can replicate a specific company’s internal recruiter query, so treat any score as a pre-submission diagnostic checklist rather than an interview guarantee.',
    ],
    sections: [
      {
        id: 'what-is-ats',
        heading: '1. What Is an Applicant Tracking System (ATS)?',
        paragraphs: [
          'When you apply for an engineering, business, operations, or graduate role online, your PDF or Word file rarely lands directly in a recruiter’s email inbox. Instead, it enters an Applicant Tracking System—software platforms such as Greenhouse, Lever, Workday, iCIMS, or Taleo used by hiring teams to collect, store, search, and review hundreds of applications in one place.',
          'To make resumes searchable inside a uniform dashboard, an ATS extracts raw text from your file and maps it into structured fields: Candidate Name, Email, Phone Number, Education, Work Experience, Skills, and Certifications. Recruiters then filter or search that database using job titles, required technical skills, locations, and years of experience.',
        ],
      },
      {
        id: 'how-ats-checker-works',
        heading: '2. What Does a Free ATS Resume Checker Actually Test?',
        paragraphs: [
          'A transparent ATS resume checker simulates the text extraction and keyword comparison steps before you click submit. Instead of guessing, a deterministic scanner reads the exact character stream inside your PDF or DOCX document and evaluates clear criteria:',
        ],
        bullets: [
          'Text extraction & reading order: Checks whether multi-column layouts, floating text boxes, or scanned images scramble your work history or hide text completely.',
          'Contact information visibility: Verifies that your email address, phone number, and LinkedIn or portfolio URL appear in selectable plain text rather than inside graphic headers.',
          'Standard section headings: Confirms recognizable headings such as Education, Technical Skills, Work Experience, Projects, and Certifications so parsers group your background accurately.',
          'Required vs. preferred skill matching: Compares the exact tools, programming languages, frameworks, and domain terms in a pasted job description against your resume.',
          'Actionable bullet quality: Reviews whether experience and project bullets include concrete action verbs and measurable outcomes rather than vague duties.',
        ],
      },
      {
        id: 'ats-checker-vs-ai-analyzer',
        heading: '3. ATS Score Checker vs. AI Resume Analyzer: What Is the Difference?',
        paragraphs: [
          'Many job seekers search for both an ATS score checker and an AI resume analyzer, and while the two often work together, they solve different problems. Deterministic rule-based scoring measures objective structure—word count, section presence, contact parseability, and exact or synonym skill matches—producing the exact same score every time you test the same file.',
          'An AI writing assistant, on the other hand, helps rewrite awkward sentences or suggest tighter phrasing for bullet points. Keeping scoring deterministic ensures your compatibility score never fluctuates randomly between scans, while optional writing suggestions remain strictly focused on clarity.',
        ],
      },
      {
        id: 'what-ats-scores-mean',
        heading: '4. How to Interpret Your Estimated ATS Score Honestly',
        paragraphs: [
          'Every employer configures its hiring workflow differently. At smaller startups, a hiring manager may read every uploaded PDF manually; at high-volume enterprises, recruiters rely heavily on keyword filters and knock-out application questions (such as work authorization or location).',
          'Because no external website has access to a private employer’s recruiter search filters, treat an estimated 100-point ATS score as a quality control benchmark. Aim to eliminate critical formatting errors first, ensure every required skill you genuinely possess is named clearly in your Skills and Experience sections, and keep the document concise for the human reviewer who makes the final interview decision.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Do Applicant Tracking Systems automatically reject resumes below a certain score?',
        answer:
          'Most modern ATS platforms do not auto-reject candidates solely based on an automated resume score. Instead, resumes go unread when broken PDF formatting hides text from recruiter keyword searches or when required qualifications are missing.',
      },
      {
        question: 'Should I check my resume with or without a job description?',
        answer:
          'Always paste the target job description when possible. Without a job posting, a scanner can verify formatting, sections, and bullet clarity, but it cannot tell you which required skills from the employer’s posting are missing.',
      },
    ],
    relatedSlugs: [
      'how-to-improve-ats-resume-score',
      'how-to-create-ats-friendly-resume',
      'common-ats-resume-mistakes',
    ],
  },
  {
    slug: 'how-to-improve-ats-resume-score',
    path: '/guides/how-to-improve-ats-resume-score',
    shortNavTitle: 'How to Improve Your ATS Score',
    h1: 'How to Improve Your ATS Resume Score Without Keyword Stuffing',
    seoTitle: 'How to Improve Your ATS Resume Score (Practical Guide)',
    metaDescription:
      'Improve your ATS resume score honestly by aligning required job keywords, quantifying project impact, and fixing single-column resume formatting issues.',
    category: 'Score Optimization',
    readingTimeMinutes: 7,
    publishedDate: '2025-02-14',
    updatedDate: '2026-10-31',
    summaryLead:
      'Raising your ATS compatibility score does not mean cramming buzzwords into white text or copying a job posting verbatim. Follow these practical, ethical steps to fix parsing bottlenecks and present your real skills clearly.',
    keyTakeaways: [
      'Prioritize required technical and domain skills listed in the job description—and back them up inside experience or project bullet points, not only in a flat skills list.',
      'Use both common abbreviations and full terms where natural (for example, "REST APIs", "Continuous Integration (CI/CD)", or "Search Engine Optimization (SEO)").',
      'Switch from multi-column sidebars or graphic skill bars to a clean single-column layout so parsers never merge two columns into garbled lines.',
    ],
    sections: [
      {
        id: 'match-required-skills',
        heading: '1. Mirror Exact Terminology for Skills You Actually Have',
        paragraphs: [
          'Recruiters frequently search ATS databases using the exact nouns written in the job requisition. If a job description asks for "PostgreSQL", "TypeScript", and "Unit Testing", but your resume only says "relational databases" and "modern web development", basic keyword queries may skip your profile even if you have the right background.',
          'Read the Qualifications or Requirements section of the job posting line by line. Separate must-have skills from nice-to-have bonus tools, and update your Technical Skills and Experience bullets using accurate, truthful terminology that matches your real hands-on work.',
        ],
        exampleBox: {
          label: 'Keyword & Evidence Alignment Example',
          weakExample:
            'Worked on backend services and databases to make API responses faster for users.',
          strongExample:
            'Optimized Node.js and PostgreSQL REST API queries using composite indexing, reducing p95 response latency by 38% across 12,000 daily requests.',
          whyItWorks:
            'Names specific technologies (Node.js, PostgreSQL, REST API) in context and proves impact with concrete numbers.',
        },
      },
      {
        id: 'connect-skills-to-evidence',
        heading: '2. Prove Listed Skills Inside Your Experience or Projects',
        paragraphs: [
          'Both sophisticated ATS parsers and human hiring managers discount "orphan skills"—tools listed in a Skills block that never appear anywhere in your work history, internships, or projects. When you add a programming language, analytics tool, or certification to your Skills section, mention at least one concrete project or role where you applied it.',
        ],
        bullets: [
          'Group your Technical Skills into scannable sub-labels such as Languages, Frameworks, Databases, and Cloud/Tools.',
          'Remove outdated or beginner-level tools that are irrelevant to the target role so core strengths stand out.',
          'Never repeat the same keyword 10+ times; modern scanners detect unnatural repetition as keyword stuffing.',
        ],
      },
      {
        id: 'fix-section-structure',
        heading: '3. Fix Critical Contact and Section Deductions Immediately',
        paragraphs: [
          'Some of the easiest points lost in an ATS check come from missing or hidden basics rather than missing experience. Before tailoring bullet points, verify that every structural element parses cleanly:',
        ],
        bullets: [
          'Place your full name, email address, phone number, city/state, and LinkedIn or GitHub URL in the main body top block—never inside Word page headers or footers that older parsers skip.',
          'Use conventional section titles: Professional Summary, Education, Technical Skills, Work Experience, Projects, and Certifications.',
          'Write consistent date ranges (for example, "Jun 2024 – Present" or "2022 – 2026") aligned cleanly on the same line as the role or degree.',
        ],
      },
      {
        id: 'quantify-achievements',
        heading: '4. Replace Passive Task Lists With Measurable Outcomes',
        paragraphs: [
          'Phrases like "Responsible for managing..." or "Helped team with..." tell neither a parser nor a recruiter what changed because of your work. Start every bullet point with a clear past-tense action verb (Built, Automated, Designed, Reduced, Migrated, Analyzed) followed by what you built, which tools you used, and the measurable result.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Does hiding job keywords in tiny white font improve my ATS score?',
        answer:
          'No—never do this. ATS parsers strip font colors and render all extracted text in plain black inside the recruiter dashboard, immediately exposing hidden keyword blocks and disqualifying the application.',
      },
      {
        question: 'What is a strong target score on an online ATS score checker?',
        answer:
          'A score of 75 to 90+ against a specific job description generally indicates clean single-column formatting, complete contact and education sections, and strong alignment with required role keywords.',
      },
    ],
    relatedSlugs: [
      'what-is-an-ats-resume-checker',
      'common-ats-resume-mistakes',
      'how-to-create-ats-friendly-resume',
    ],
  },
  {
    slug: 'how-to-create-ats-friendly-resume',
    path: '/guides/how-to-create-ats-friendly-resume',
    shortNavTitle: 'Create an ATS-Friendly Resume',
    h1: 'How to Create an ATS-Friendly Resume Step by Step',
    seoTitle: 'How to Create an ATS-Friendly Resume Step by Step',
    metaDescription:
      'Follow this step-by-step guide to format an ATS-friendly resume with standard headings, clean fonts, measurable bullets, and parseable PDF or Word files.',
    category: 'Resume Formatting',
    readingTimeMinutes: 7,
    publishedDate: '2025-02-18',
    updatedDate: '2026-10-31',
    summaryLead:
      'An ATS-friendly resume is easy for software to parse into structured fields and effortless for a busy recruiter to scan in under ten seconds. Here is how to build one from scratch.',
    keyTakeaways: [
      'Stick to a clean, top-to-bottom single-column layout without nested tables, floating text boxes, icons, or profile photos (unless applying in a region that explicitly requires photos).',
      'Use standard, legible typography (10pt–11.5pt body text, clear bold headings, and consistent bullet symbols) and export as a text-based PDF or Word (.docx) document.',
      'Order your sections based on career stage: freshers lead with Education, Technical Skills, and Projects; experienced candidates lead with Summary, Technical Skills, and Work Experience.',
    ],
    sections: [
      {
        id: 'single-column-architecture',
        heading: '1. Choose a Single-Column Layout Over Graphic Templates',
        paragraphs: [
          'Graphic design tools often promote visually elaborate two-column resumes with colored sidebars, skill progress bars, and icon badges next to email addresses. Unfortunately, many PDF text extractors read across the horizontal X-axis line by line—stitching a left-column skill list directly into the middle of a right-column job description.',
          'A single-column layout guarantees linear top-to-bottom reading order across every parser and gives recruiters wider horizontal lines to read your accomplishments naturally on both desktop monitors and mobile screens.',
        ],
      },
      {
        id: 'recommended-section-order',
        heading: '2. Structure Your Resume With Standard Headings',
        paragraphs: [
          'Creative headings such as "Where I Have Made an Impact" or "My Toolbox" force resume parsers to guess where your work history begins and ends. Use clear, industry-standard labels:',
        ],
        bullets: [
          'Header Block: Full Name, Email, Phone Number, City/Country, and clickable LinkedIn/GitHub/Portfolio URL.',
          'Professional Summary (2–3 lines): Your target role, core technical or domain focus, and strongest verifiable achievement.',
          'Technical Skills: Grouped comma-separated lists of languages, frameworks, platforms, and methodologies.',
          'Work Experience (or Internships): Reverse-chronological entries with Job Title, Company Name, Location, Start–End Dates, and 3–5 impact bullets per role.',
          'Projects: Essential for students, career switchers, and software engineers—include project title, tech stack, live/repo link, and outcome bullets.',
          'Education & Certifications: Degree name, major, institution, graduation year, and verified credentials.',
        ],
      },
      {
        id: 'fonts-margins-file-type',
        heading: '3. Typography, Margins, Length, and File Format Rules',
        paragraphs: [
          'Keep visual styling restrained so hierarchy comes from spacing and weight rather than decoration:',
        ],
        bullets: [
          'Fonts: Standard sans-serif or serif fonts such as Helvetica, Arial, Inter, Calibri, Georgia, or Times New Roman at 10–11pt for body copy and 13–16pt for headings.',
          'Margins & Length: Maintain 0.5" to 0.85" page margins. Aim for 1 full page (350–600 words) if you have under 5–7 years of experience, or up to 2 pages for senior roles.',
          'PDF vs. DOCX: Both text-based PDFs and Word (.docx) files parse accurately today. Verify your PDF by opening it and dragging your cursor across the page—if you can highlight and copy individual words cleanly, it is text-based rather than a flat image scan.',
        ],
      },
      {
        id: 'test-before-applying',
        heading: '4. Build and Verify in Minutes',
        paragraphs: [
          'Once your draft is ready, download your single-column PDF or DOCX file and run it through a deterministic ATS score checker alongside a real job posting. Fix any missing dates, unparsed headings, or overlooked required skills before sending applications.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Are PDF resumes safe for Applicant Tracking Systems?',
        answer:
          'Yes, provided the PDF is exported from text (such as our Free ATS Resume Builder, Word, or Google Docs) rather than scanned from paper or exported as flattened outlines from an image editor.',
      },
      {
        question: 'Should I include skill percentage bars (e.g., Python 85%) on my resume?',
        answer:
          'No. Graphic bars cannot be parsed as text by ATS software and look arbitrary to hiring managers. List concrete skills in plain text and demonstrate proficiency through project and work bullets.',
      },
    ],
    relatedSlugs: [
      'what-is-an-ats-resume-checker',
      'resume-tips-for-freshers',
      'common-ats-resume-mistakes',
    ],
  },
  {
    slug: 'resume-tips-for-freshers',
    path: '/guides/resume-tips-for-freshers',
    shortNavTitle: 'Resume Tips for Freshers',
    h1: 'Resume Tips for Freshers: How to Build a Strong First Resume',
    seoTitle: 'Resume Tips for Freshers: Build a Strong First Resume',
    metaDescription:
      'Practical resume tips for freshers and college graduates with no work experience. Highlight projects, internships, technical skills, and coursework clearly.',
    category: 'Fresher & Student Guide',
    readingTimeMinutes: 7,
    publishedDate: '2025-02-22',
    updatedDate: '2026-10-31',
    summaryLead:
      'Writing your first resume as a college student or recent graduate can feel intimidating when job postings ask for hands-on experience. Here is how freshers can build a credible, ATS-friendly 1-page resume that highlights real capability.',
    keyTakeaways: [
      'You do not need full-time corporate employment to pass an ATS resume checker for freshers—capstone projects, open-source contributions, internships, and lab builds carry real weight when documented properly.',
      'Replace generic career objectives ("Seeking a challenging role to grow my skills...") with a specific 2-line role summary naming your degree, core tech stack, and what you have built.',
      'Keep a fresher resume strictly to one clean page (roughly 350–550 words) with zero spelling errors or inflated claims.',
    ],
    sections: [
      {
        id: 'fresher-summary-vs-objective',
        heading: '1. Write a Specific 2-Line Summary Instead of a Vague Objective',
        paragraphs: [
          'Recruiters reviewing campus and entry-level applications read dozens of identical objectives promising hard work and enthusiasm. Replace generic filler with a factual snapshot of your degree, graduation timeline, primary technical or analytical tools, and the types of problems you have solved.',
        ],
        exampleBox: {
          label: 'Fresher Summary Comparison',
          weakExample:
            'Hardworking Computer Science fresher looking for an entry-level opportunity in a reputed organization to utilize my skills and grow professionally.',
          strongExample:
            'Final-year B.Tech Computer Science graduate skilled in Java, TypeScript, React, and SQL. Built 3 full-stack web applications including an inventory API handling 5,000+ test records with automated unit tests.',
          whyItWorks:
            'Immediately tells both the ATS scanner and the recruiter your qualification, core stack, and concrete proof of work.',
        },
      },
      {
        id: 'projects-as-experience',
        heading: '2. Treat Academic and Personal Projects Like Real Engineering Work',
        paragraphs: [
          'When full-time work experience is optional or absent, your Projects section becomes the centerpiece of your resume. Instead of listing only a project title and a one-line description, structure every project with the same rigor as a professional role:',
        ],
        bullets: [
          'Include the Project Name, Tech Stack in parentheses (e.g., Python, FastAPI, PostgreSQL, Docker), Month/Year, and a working GitHub or live demo link.',
          'Explain the real problem solved—not just "Built an e-commerce website", but how authentication, search filtering, validation, or data modeling worked.',
          'Include concrete scope metrics: dataset size, test coverage percentage, build time reduction, lighthouse/latency benchmarks, or number of student users.',
        ],
      },
      {
        id: 'education-internships-certifications',
        heading: '3. Highlight Education, Internships, and Verified Certifications',
        paragraphs: [
          'Place your Education section near the top of your resume if you graduated within the last two years. Include your full degree name (e.g., Bachelor of Technology in Information Technology), university name, city, graduation month/year, and GPA/CGPA if it is strong (typically 7.5+/10 or 3.3+/4.0).',
          'If you completed summer internships, teaching assistantships, hackathon finals, or recognized technical certifications (such as AWS Cloud Practitioner, Oracle Java, or Google Data Analytics), list the issuing body and year clearly so entry-level resume scanners index those credentials.',
        ],
      },
      {
        id: 'tailoring-for-entry-level-jobs',
        heading: '4. Check Your Fresher Resume Against Entry-Level Job Descriptions',
        paragraphs: [
          'Before applying to graduate trainee, junior developer, or analyst roles, paste the exact job posting into a free resume checker for freshers. Check whether foundational concepts mentioned in the posting—such as Git, Object-Oriented Programming, Data Structures, SQL joins, Excel pivot tables, or REST APIs—are explicitly written on your resume if you know them.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Should freshers include high school (10th and 12th grade) marks on a resume?',
        answer:
          'Include your university degree first. Only include 12th-grade details if campus placement guidelines in your region specifically request them; otherwise, save that space for detailed technical projects and skills.',
      },
      {
        question: 'Is a 2-page resume acceptable for a fresher?',
        answer:
          'Almost never. Entry-level recruiters strongly prefer a focused 1-page resume that highlights your top 2–4 projects, internships, skills, and degree without padding.',
      },
    ],
    relatedSlugs: [
      'how-to-create-ats-friendly-resume',
      'how-to-improve-ats-resume-score',
      'common-ats-resume-mistakes',
    ],
  },
  {
    slug: 'common-ats-resume-mistakes',
    path: '/guides/common-ats-resume-mistakes',
    shortNavTitle: 'Common ATS Resume Mistakes',
    h1: '8 Common ATS Resume Mistakes That Hurt Readability & Keyword Match',
    seoTitle: 'Common ATS Resume Mistakes That Hurt Resume Parsing',
    metaDescription:
      'Avoid common ATS resume mistakes like two-column tables, graphics, scanned PDFs, missing contact details, and keyword stuffing before you submit your CV.',
    category: 'Troubleshooting & Audit',
    readingTimeMinutes: 6,
    publishedDate: '2025-02-26',
    updatedDate: '2026-10-31',
    summaryLead:
      'Qualified candidates frequently lose points during initial resume screening not because they lack skills, but because avoidable formatting or structural mistakes prevent parsers and recruiters from seeing their qualifications.',
    keyTakeaways: [
      'Never submit a scanned image PDF or screenshot-exported resume—if text cannot be highlighted with a cursor, standard ATS parsers extract zero words without OCR.',
      'Avoid multi-column tables, header/footer contact blocks, and custom icons that break text extraction or corrupt email addresses and phone numbers.',
      'Tailor skills truthfully for each role type instead of sending one generic, unfocused resume to fifty different job titles.',
    ],
    sections: [
      {
        id: 'formatting-parsing-mistakes',
        heading: '1. Layout & File Mistakes That Break Text Extraction',
        paragraphs: [
          'Even strong career histories fail automated checks when document structure interferes with text extraction:',
        ],
        bullets: [
          'Mistake #1 — Scanned or image-only PDFs: Exporting a resume from a design canvas as flattened vector curves or scanning a printed page produces zero selectable characters.',
          'Mistake #2 — Multi-column tables and floating text boxes: Side-by-side columns often cause PDF readers to concatenate left-column dates or skills onto the same line as right-column job bullets.',
          'Mistake #3 — Contact details trapped in document headers/footers: Some legacy Word parsers ignore header/footer regions completely, leaving your candidate record without an email or phone number.',
          'Mistake #4 — Replacing text labels with icons: Using a phone icon or map-pin glyph without plain spacing can merge characters into unreadable symbols during extraction.',
        ],
      },
      {
        id: 'content-keyword-mistakes',
        heading: '2. Content & Keyword Mistakes That Lower Job Match Scores',
        paragraphs: [
          'Once your file parses cleanly, the next set of mistakes involves how your experience and skills are written:',
        ],
        bullets: [
          'Mistake #5 — Non-standard section titles: Naming sections "My Journey", "Tech Stack Wizardry", or "Accolades" prevents parsers from categorizing Work Experience, Skills, and Achievements.',
          'Mistake #6 — Listing skills with zero supporting context: Dropping 30 buzzwords into a Skills block without mentioning any of them in your roles or projects lowers credibility.',
          'Mistake #7 — Missing dates or inconsistent date formats: Mixing "Summer 2023", "04/24", and undated roles makes it impossible for software to calculate tenure accurately.',
          'Mistake #8 — Unchecked typos in tool names and headings: Misspelling "Kubernetes", "PostgreSQL", "TypeScript", or "Experience" causes exact-match keyword queries to miss your resume.',
        ],
      },
      {
        id: 'quick-pre-application-audit',
        heading: '3. A 60-Second Pre-Application Checklist',
        paragraphs: [
          'Before uploading your resume to any company career portal, run through four quick checks: (1) Press Ctrl+A / Cmd+A inside your PDF viewer and paste into a plain notepad file to confirm clean reading order; (2) Confirm email, phone, and LinkedIn appear at the top; (3) Compare your Skills and Experience bullets against the target job description; and (4) Run a free ATS resume score check to catch overlooked warnings.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Do hyperlinks (LinkedIn, GitHub, portfolio) break ATS resume parsing?',
        answer:
          'Standard clickable text links (such as linkedin.com/in/yourname or github.com/yourname) are completely safe and helpful. Write out the clean readable URL rather than hiding links behind generic words like "Click Here".',
      },
      {
        question: 'Are bullet symbols safe in ATS-friendly resumes?',
        answer:
          'Standard round bullets (•) or simple hyphens (-) parse reliably everywhere. Avoid custom decorative emoji, checkmarks, or Wingdings arrows.',
      },
    ],
    relatedSlugs: [
      'what-is-an-ats-resume-checker',
      'how-to-improve-ats-resume-score',
      'how-to-create-ats-friendly-resume',
    ],
  },
];

export const SEO_GUIDES_BY_SLUG: Record<string, SeoGuideArticle> = Object.fromEntries(
  SEO_GUIDE_ARTICLES.map((article) => [article.slug, article])
);
