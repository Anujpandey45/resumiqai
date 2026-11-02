# RESUMIQ AI (`resumiq.ai`)

**RESUMIQ AI** is a free, beginner-friendly **ATS Resume Checker**, **AI Resume Analyzer**, and **Step-by-Step Resume Builder** built with React 19, TypeScript, Tailwind CSS v4, and Express.

First-time users can immediately build a clean, single-column ATS-compatible resume or scan an existing PDF/DOCX resume against a target job description using a transparent, deterministic 100-point scoring engine.

---

## Core Features

### 1. Step-by-Step Resume Builder (`/resume-builder`)
- Guided form covering **Personal Details**, **Education**, **Skills**, **Projects**, and **Work Experience** (optional for students and freshers).
- Live real-time A4 resume preview with clean, recruiter-approved single-column templates (**Classic**, **Modern**, and **Minimal**).
- Instant **PDF** and **DOCX** export without watermarks or paywalls.

### 2. Deterministic 100-Point ATS Resume Checker (`/ats-resume-checker`)
- Upload **PDF** or **DOCX** resumes (up to 10 MB) with layout-aware multi-column coordinate reconstruction (`unpdf`, `pdfjs-dist`, `mammoth`).
- Paste any target job description to compare required vs. preferred skills, technical synonyms, and role keywords.
- **Deterministic 10-Category Weighted Rubric (Total = 100 Marks)**:
  1. Resume Formatting & Readability (12)
  2. Contact Information (8)
  3. Professional Summary (8)
  4. Technical Skills (16)
  5. Job Description Keyword Matching (20)
  6. Work Experience (14 — automatically rebalanced for fresher profiles)
  7. Projects & Achievements (10)
  8. Education (6)
  9. Certifications (2)
  10. Grammar & Spelling (4)
- Deduplicated **Critical Issues**, **Warnings**, **Passed Checks**, and actionable plain-English fixes.
- Honest extraction error handling for scanned/image-only PDFs—never invents fake or random scores.

### 3. Technical & Content SEO (`/guides/*`, `/sitemap.xml`, `/robots.txt`)
- Dynamic server-side HTML metadata injection, canonical URLs, Open Graph/Twitter cards, and semantic route prerendering (`server.ts` + `src/utils/seo.ts`).
- Valid JSON-LD structured data (`WebSite`, `Organization`, `WebApplication`, `Article`, `FAQPage`, `BreadcrumbList`).
- Dynamic `/sitemap.xml` (including Google Image Sitemap entries) and `/robots.txt` blocking private `/api/` routes.
- Built-in original career guides:
  - `/guides/what-is-an-ats-resume-checker`
  - `/guides/how-to-improve-ats-resume-score`
  - `/guides/how-to-create-an-ats-friendly-resume`
  - `/guides/resume-tips-for-freshers`
  - `/guides/common-ats-resume-mistakes`
- Proper HTTP `404` status and `noindex` handling for unknown routes.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons
- **Backend & API**: Node.js, Express 4 (`server.ts`), Multer (in-memory multipart uploads)
- **Document Parsing & Export**: `unpdf`, `pdfjs-dist`, `mammoth`, `jspdf`, `docx`
- **Database & Auth (Optional Persistence)**: PostgreSQL (`pg` + Drizzle ORM), Firebase Authentication (`firebase` / `firebase-admin`)
- **Testing**: Node native test runner via `tsx --test` (`tests/atsScoringEngine.test.ts`)

---

## Project Structure

```text
RESUMIQ-AI/
├── public/                        # Static public assets, favicon, manifest, Open Graph & hero images
│   ├── images/resumiq-hero.jpg
│   ├── favicon.svg
│   ├── og-resumiq.jpg
│   └── site.webmanifest
├── src/
│   ├── assets/images/             # Bundled fallback visual assets
│   ├── components/                # Modular React views & live preview
│   │   ├── AtsCheckerView.tsx     # PDF/DOCX ATS scanner & 100-point rubric report UI
│   │   ├── LandingPage.tsx        # Homepage with primary Resume Builder & ATS Checker actions
│   │   ├── NotFoundView.tsx       # Semantic 404 page
│   │   ├── ResumeBuilderView.tsx  # Step-by-step resume editor & template switcher
│   │   ├── ResumeLivePreview.tsx  # Live ATS-safe resume renderer
│   │   └── SeoGuidesView.tsx      # Career & ATS educational guide hub and articles
│   ├── context/
│   │   └── AuthContext.tsx        # Firebase / Google authentication state provider
│   ├── data/
│   │   ├── demoSamples.ts         # Sample resume & job description fixtures
│   │   └── seoGuides.ts           # Original long-form ATS & fresher resume articles
│   ├── db/                        # PostgreSQL schema & Drizzle ORM queries
│   │   ├── drizzle.config.ts
│   │   ├── index.ts
│   │   ├── queries.ts
│   │   └── schema.ts
│   ├── lib/                       # API client & Firebase SDK initialization
│   │   ├── apiClient.ts
│   │   ├── firebase-admin.ts
│   │   └── firebase.ts
│   ├── middleware/
│   │   └── auth.ts                # Bearer token verification middleware
│   ├── server/                    # Core backend engines
│   │   ├── aiService.ts           # Optional server-side writing helper integration
│   │   ├── atsScoringEngine.ts    # Centralized deterministic 100-point ATS scoring engine
│   │   ├── docParser.ts           # Multi-column PDF & DOCX parser and layout analyzer
│   │   ├── jobProcessor.ts        # Checkpoint-capable background analysis runner
│   │   ├── qualityEngine.ts       # Resume quality heuristics & constants
│   │   └── serverDocGenerator.ts  # Server-side PDF & DOCX buffer generation
│   ├── utils/
│   │   ├── exportResume.ts        # Client/server resume export utilities
│   │   └── seo.ts                 # Route metadata, JSON-LD, sitemap & SSR prerender helpers
│   ├── App.tsx                    # Path-based SPA router & top navigation shell
│   ├── index.css                  # Tailwind CSS v4 entry stylesheet
│   ├── main.tsx                   # React DOM entry point
│   └── types.ts                   # Shared TypeScript interfaces
├── tests/
│   └── atsScoringEngine.test.ts   # Automated unit & determinism tests for ATS scoring & PDF parsing
├── .env.example                   # Safe environment variable template (no secrets)
├── .gitignore                     # Excludes .env, node_modules, dist, logs, and credentials
├── firebase-applet-config.json    # Public Firebase Web SDK client configuration
├── firestore.rules                # Firestore security rules
├── index.html                     # HTML shell with base SEO metadata
├── metadata.json                  # Application metadata
├── package.json                   # Scripts & dependencies
├── server.ts                      # Express API server, dynamic SEO routes, and Vite middleware
├── tsconfig.json                  # TypeScript configuration
└── vite.config.ts                 # Vite bundler & code-splitting configuration
```

---

## Local Development Setup (VS Code)

### Prerequisites
- **Node.js** `v20.19+` or `v22.12+`
- **npm** `v10+` (or `bun`)

### 1. Clone the Repository
```bash
git clone https://github.com/<your-github-username>/RESUMIQ-AI.git
cd RESUMIQ-AI
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and fill in only the values you need:
```bash
cp .env.example .env
```
> **Note:** Both the **Resume Builder** (including PDF/DOCX export) and the **100-point ATS Resume Checker** run out-of-the-box locally without requiring `GEMINI_API_KEY` or PostgreSQL credentials.

### 4. Start the Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the full-stack Express + Vite development server on port `3000` using `tsx`. |
| `npm run build` | Builds the optimized production frontend bundle into `dist/`. |
| `npm start` | Runs `server.ts` in production mode (serves `dist/` + `/api/*` + SEO routes). |
| `npm run lint` | Runs `tsc --noEmit` to type-check the entire frontend and backend codebase. |
| `npm test` | Runs the deterministic ATS scoring & PDF parser test suite (`tests/atsScoringEngine.test.ts`). |

---

## Environment Variables & Security

Never commit `.env` files, private API keys, database passwords, or service account JSON files. `.gitignore` is configured to block `.env*` and credential files automatically.

| Variable | Required | Description |
| :--- | :--- | :--- |
| `PORT` | Optional | HTTP server port (defaults to `3000`). |
| `NODE_ENV` | Optional | `development` or `production`. |
| `PUBLIC_SITE_URL` | Optional | Canonical HTTPS origin (defaults to `https://resumiq.ai`). |
| `GOOGLE_SITE_VERIFICATION` | Optional | Google Search Console HTML `<meta name="google-site-verification">` token. |
| `GEMINI_API_KEY` | Optional | Server-side API key used only for optional bullet rewriting/tips. |
| `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD` | Optional | PostgreSQL credentials for saving authenticated user history via Drizzle ORM. |
| `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` | Optional | PostgreSQL admin credentials used only by `drizzle-kit` migrations. |

`firebase-applet-config.json` contains public Firebase Web SDK identifiers (`projectId`, `appId`, `authDomain`, browser `apiKey`) required to initialize client-side Firebase Authentication. If you connect your own Firebase project, replace those public client values with your own Firebase Web App config.

---

## Deployment Guide

Because **RESUMIQ AI** is a full-stack application (`server.ts` handles `/api/ats/quick-check` PDF/DOCX multipart uploads, server-side PDF/DOCX generation, `/sitemap.xml`, `/robots.txt`, and server-side SEO prerendering), choose one of the following deployment setups:

### Option A: Full-Stack Node Hosting (Cloud Run, Railway, Render, Fly.io) — Recommended
1. **Build Command**: `npm install && npm run build`
2. **Start Command**: `NODE_ENV=production npx tsx server.ts` (or `NODE_ENV=production node server.ts` on Node.js `v22.6+` / `v23+` with native TypeScript support)
3. **Environment Variables**: Add `NODE_ENV=production`, `PUBLIC_SITE_URL=https://resumiq.ai`, and any optional keys from `.env.example`.

### Option B: Deploying with Vercel
- **Frontend + Node Backend Split**: Host the Vite build (`npm run build`, Output Directory: `dist`) on Vercel and point `/api/*` via `vercel.json` rewrites to your Cloud Run / Railway Express URL; **or**
- **Vercel Serverless Adaptation**: Expose the Express `app` from `server.ts` via an `api/index.ts` Vercel Function handler and configure `vercel.json` routes so `/api/*`, `/sitemap.xml`, `/robots.txt`, and HTML document requests route through the Express handler, then add your `.env` variables in **Vercel Dashboard -> Settings -> Environment Variables**.
