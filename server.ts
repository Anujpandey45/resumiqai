import * as dotenv from 'dotenv';
dotenv.config();

import { execFile } from 'child_process';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  checkFirebaseTokenServiceHealth,
  optionalAuth,
  requireAuth,
  type AuthRequest,
} from './src/middleware/auth.ts';
import {
  adminUpdatePlanRecord,
  adminUpdateTemplateRecord,
  adminUpdateUserRecord,
  createResumeWithVersion,
  deleteEngineJobByUid,
  deleteEntireUserAccount,
  deleteUserAtsReport,
  deleteUserResume,
  getAdminOverviewBundle,
  getCatalogData,
  getHydratedEngineJob,
  getOrCreateUser,
  getUserDashboardBundle,
  incrementUserScansAndSaveReport,
  listUserAtsReports,
  listUserResumes,
  recordDownloadEvent,
  saveJobMatchRecord,
  setUserPlan,
  updateEngineJobCheckpoint,
  updateResumeWithVersion,
  updateUserProfileName,
} from './src/db/queries.ts';
import {
  DocumentValidationError,
  MAX_UPLOAD_SIZE_BYTES,
  parseResumeBuffer,
} from './src/server/docParser.ts';
import {
  analyzeResumeWithGemini,
  generateOptionalPlainEnglishTipsWithGemini,
  improveResumeContentWithGemini,
  isExternalQuotaError,
  matchResumeToJobWithGemini,
} from './src/server/aiService.ts';
import { computeDeterministicAtsReport } from './src/server/atsScoringEngine.ts';
import {
  enqueueResumeTextJob,
  enqueueResumeUploadJob,
  resumeFailedJobFromCheckpoint,
  type JobRunOptions,
} from './src/server/jobProcessor.ts';
import {
  generateServerDocxBuffer,
  generateServerPdfBuffer,
} from './src/server/serverDocGenerator.ts';
import { sanitizeResumeFileName } from './src/utils/exportResume.ts';
import { SEO_GUIDE_ARTICLES } from './src/data/seoGuides.ts';
import {
  CANONICAL_SITE_ORIGIN,
  buildRouteJsonLd,
  buildServerPrerenderMarkup,
  getAllPublicSitemapEntries,
  getRouteSeoMetadata,
  normalizeCanonicalOrigin,
  resolveRoute,
} from './src/utils/seo.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES, // 10 MB strict cap
  },
});

function handleSingleUpload(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (err: any) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          error: 'File size exceeds the 10 MB maximum limit. Please upload a compact PDF or DOCX.',
          code: 'FILE_TOO_LARGE',
        });
        return;
      }
      res.status(400).json({
        error: 'Invalid multipart file upload request.',
        code: 'UPLOAD_ERROR',
      });
    });
  };
}

function formatSafeServerError(error: any): {
  status: number;
  message: string;
  code?: string;
} {
  if (error instanceof DocumentValidationError) {
    return {
      status: 400,
      message: error.message,
      code: error.code,
    };
  }
  const msg = String(error?.message || error || '');
  if (msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      message:
        'Writing assistant service authentication is currently unavailable. Resume building, PDF downloads, and ATS score checks continue to work normally.',
      code: 'API_KEY_INVALID',
    };
  }
  if (isExternalQuotaError(error)) {
    return {
      status: 429,
      message:
        'The external AI service quota is temporarily full. Please wait a minute and try again. Resume building, PDF downloads, and ATS score checks continue to work normally.',
      code: 'EXTERNAL_QUOTA_EXHAUSTED',
    };
  }
  if (msg.includes('DEADLINE_EXCEEDED') || msg.includes('AI_STAGE_TIMEOUT')) {
    return {
      status: 504,
      message:
        'The external AI request took too long to respond. Please try again in a moment.',
      code: 'STAGE_TIMEOUT',
    };
  }
  return {
    status: 500,
    message: msg.slice(0, 260) || 'An unexpected server error occurred.',
    code: 'SERVER_ERROR',
  };
}

function parseLoopbackTestOptions(req: Request): JobRunOptions | undefined {
  const ip = req.ip || req.socket.remoteAddress || '';
  const isLoopback =
    ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  const rawHeader = req.headers['x-resumiq-local-test'];
  if (!isLoopback || typeof rawHeader !== 'string') return undefined;
  try {
    return JSON.parse(rawHeader) as JobRunOptions;
  } catch {
    return undefined;
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  const getSiteOrigin = () =>
    normalizeCanonicalOrigin(process.env.PUBLIC_SITE_URL || CANONICAL_SITE_ORIGIN);

  // Enforce HTTPS redirect behind production reverse proxies
  app.use((req, res, next) => {
    const forwardedProto = req.headers['x-forwarded-proto'];
    if (
      process.env.NODE_ENV === 'production' &&
      typeof forwardedProto === 'string' &&
      forwardedProto.split(',')[0].trim().toLowerCase() === 'http'
    ) {
      res.redirect(301, `${getSiteOrigin()}${req.originalUrl}`);
      return;
    }
    next();
  });

  // Never index private API responses, uploaded resume payloads, or user reports
  app.use('/api', (_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/auth/capabilities', async (_req, res) => {
    try {
      const caps = await checkFirebaseTokenServiceHealth();
      res.setHeader('Cache-Control', 'no-store');
      res.json(caps);
    } catch {
      res.json({ firebaseTokenServiceReady: false, oAuthClientId: '' });
    }
  });

  // Public Catalog (Templates & Pricing Plans)
  app.get('/api/catalog', async (_req, res) => {
    try {
      const catalog = await getCatalogData();
      res.setHeader('Cache-Control', 'no-store');
      res.json(catalog);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load catalog.' });
    }
  });

  // Synchronize & Fetch Authenticated User Profile
  app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const u = req.user!;
      const profile = await getOrCreateUser(
        u.uid,
        u.email || `${u.uid}@authenticated.user`,
        u.name
      );
      res.json({ user: profile });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch profile.' });
    }
  });

  app.patch('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const displayName = String(req.body?.displayName || '').trim().slice(0, 80);
      await getOrCreateUser(
        req.user!.uid,
        req.user!.email || `${req.user!.uid}@authenticated.user`,
        req.user!.name
      );
      const updated = await updateUserProfileName(req.user!.uid, displayName);
      res.json({ user: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update profile.' });
    }
  });

  app.delete('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      await deleteEntireUserAccount(req.user!.uid);
      res.json({ deleted: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete account.' });
    }
  });

  app.post('/api/subscription/upgrade', requireAuth, async (req: AuthRequest, res) => {
    try {
      await getOrCreateUser(
        req.user!.uid,
        req.user!.email || `${req.user!.uid}@authenticated.user`,
        req.user!.name
      );
      const updated = await setUserPlan(req.user!.uid, 'premium');
      res.json({ user: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Upgrade failed.' });
    }
  });

  app.post('/api/subscription/downgrade', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await setUserPlan(req.user!.uid, 'free');
      res.json({ user: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Plan update failed.' });
    }
  });

  // ===========================================================================
  // SELF-IMPROVING AI RESUME ENGINE — ASYNC BACKGROUND JOB API (NO 504 TIMEOUTS)
  // ===========================================================================

  // 1. Immediate Upload Job Enqueue (<100ms response returning jobUid)
  app.post(
    '/api/engine/jobs/upload',
    optionalAuth,
    handleSingleUpload('resumeFile'),
    async (req: AuthRequest, res) => {
      try {
        if (req.body?.consentConfirmed !== 'true') {
          res.status(400).json({
            error:
              'Explicit user permission is required before processing uploaded resume documents.',
            code: 'CONSENT_REQUIRED',
          });
          return;
        }

        if (!req.file) {
          res.status(400).json({
            error: 'Please select a PDF (.pdf) or Word (.docx) resume file to upload.',
            code: 'MISSING_FILE',
          });
          return;
        }

        let userRecord: Awaited<ReturnType<typeof getOrCreateUser>> | null = null;
        if (req.user) {
          userRecord = await getOrCreateUser(
            req.user.uid,
            req.user.email || `${req.user.uid}@authenticated.user`,
            req.user.name
          );
        }

        const mode =
          req.body?.mode === 'ats_audit_only'
            ? 'ats_audit_only'
            : 'autonomous_improve';
        const maxIterations = Math.min(
          3,
          Math.max(1, Number(req.body?.maxIterations) || 3)
        );

        const queued = await enqueueResumeUploadJob({
          userUid: userRecord?.uid ?? null,
          mode,
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          maxIterations,
          runOptions: parseLoopbackTestOptions(req),
        });

        // Release request buffer reference promptly
        (req as any).file = undefined;

        res.status(202).json({
          jobUid: queued.jobUid,
          state: queued.state,
          fileType: queued.fileType,
        });
      } catch (error: any) {
        const formatted = formatSafeServerError(error);
        res
          .status(formatted.status)
          .json({ error: formatted.message, code: formatted.code });
      }
    }
  );

  // 2. Immediate Text / Saved Builder / Demo Sample Job Enqueue (<100ms response)
  app.post('/api/engine/jobs/text', optionalAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.body?.consentConfirmed) {
        res.status(400).json({
          error: 'Explicit user permission is required before processing resume text.',
          code: 'CONSENT_REQUIRED',
        });
        return;
      }

      let userRecord: Awaited<ReturnType<typeof getOrCreateUser>> | null = null;
      if (req.user) {
        userRecord = await getOrCreateUser(
          req.user.uid,
          req.user.email || `${req.user.uid}@authenticated.user`,
          req.user.name
        );
      }

      const mode =
        req.body?.mode === 'ats_audit_only'
          ? 'ats_audit_only'
          : 'autonomous_improve';
      const maxIterations = Math.min(
        3,
        Math.max(1, Number(req.body?.maxIterations) || 3)
      );

      const queued = await enqueueResumeTextJob({
        userUid: userRecord?.uid ?? null,
        mode,
        resumeText: String(req.body?.resumeText || ''),
        fileName: String(req.body?.fileName || 'Resume Draft').trim(),
        fileType: String(req.body?.fileType || 'builder').trim(),
        maxIterations,
        runOptions: parseLoopbackTestOptions(req),
      });

      res.status(202).json({
        jobUid: queued.jobUid,
        state: queued.state,
      });
    } catch (error: any) {
      const formatted = formatSafeServerError(error);
      res
        .status(formatted.status)
        .json({ error: formatted.message, code: formatted.code });
    }
  });

  // 3. Poll Job Status, Live Progress Metrics, Iterations & Selected Version
  app.get('/api/engine/jobs/:jobUid', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const hydrated = await getHydratedEngineJob(req.params.jobUid);
      if (!hydrated) {
        res.status(404).json({ error: 'Processing job not found.' });
        return;
      }
      if (hydrated.userUid && req.user?.uid !== hydrated.userUid) {
        // Allow access only to job owner when linked to an authenticated user
        res.status(403).json({ error: 'Access denied to this resume processing job.' });
        return;
      }
      res.json({ job: hydrated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to poll job state.' });
    }
  });

  // 4. Resume Failed Job from Last Saved Stage Checkpoint (Never Restarts Completed Stages)
  app.post(
    '/api/engine/jobs/:jobUid/retry',
    optionalAuth,
    async (req: AuthRequest, res) => {
      try {
        const hydrated = await getHydratedEngineJob(req.params.jobUid);
        if (!hydrated) {
          res.status(404).json({ error: 'Processing job not found.' });
          return;
        }
        if (hydrated.userUid && req.user?.uid !== hydrated.userUid) {
          res.status(403).json({ error: 'Access denied.' });
          return;
        }

        const resumed = await resumeFailedJobFromCheckpoint(
          req.params.jobUid,
          parseLoopbackTestOptions(req)
        );
        res.json({
          resumed: true,
          jobUid: resumed.jobUid,
          resumedFromStage: resumed.resumedFromStage,
        });
      } catch (error: any) {
        const formatted = formatSafeServerError(error);
        res.status(formatted.status).json({ error: formatted.message });
      }
    }
  );

  // 5. Save User Edits to Final Generated Resume Content
  app.put(
    '/api/engine/jobs/:jobUid/resume',
    optionalAuth,
    async (req: AuthRequest, res) => {
      try {
        const hydrated = await getHydratedEngineJob(req.params.jobUid);
        if (!hydrated) {
          res.status(404).json({ error: 'Processing job not found.' });
          return;
        }
        if (hydrated.userUid && req.user?.uid !== hydrated.userUid) {
          res.status(403).json({ error: 'Access denied.' });
          return;
        }
        if (!req.body?.resumeData || typeof req.body.resumeData !== 'object') {
          res.status(400).json({ error: 'Valid resumeData payload is required.' });
          return;
        }

        const resumeData = req.body.resumeData;
        const [pdfBuf, docxBuf] = await Promise.all([
          generateServerPdfBuffer(resumeData, 'modern-tech'),
          generateServerDocxBuffer(resumeData, 'modern-tech'),
        ]);

        await updateEngineJobCheckpoint(req.params.jobUid, {
          finalResumeJson: JSON.stringify(resumeData),
          artifactsMetaJson: JSON.stringify({
            pdfReady: pdfBuf.length > 500,
            docxReady: docxBuf.length > 500,
            pdfSizeBytes: pdfBuf.length,
            docxSizeBytes: docxBuf.length,
          }),
        });

        const updatedJob = await getHydratedEngineJob(req.params.jobUid);
        res.json({ job: updatedJob });
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to update final resume.' });
      }
    }
  );

  // 6. Download Clean ATS-Friendly PDF or DOCX with Clickable Email & Portfolio Links
  app.get(
    '/api/engine/jobs/:jobUid/export',
    optionalAuth,
    async (req: AuthRequest, res) => {
      try {
        const hydrated = await getHydratedEngineJob(req.params.jobUid);
        if (!hydrated) {
          res.status(404).json({ error: 'Processing job not found.' });
          return;
        }
        if (hydrated.userUid && req.user?.uid !== hydrated.userUid) {
          res.status(403).json({ error: 'Access denied.' });
          return;
        }

        const format = String(req.query.format || 'pdf').toLowerCase();
        const templateSlug = String(req.query.template || 'modern-tech');
        const versionQuery = req.query.version;

        let targetResume = hydrated.finalResumeData;
        if (versionQuery !== undefined && versionQuery !== 'best') {
          const verNum = Number(versionQuery);
          const foundIter = hydrated.iterations.find(
            (it) => it.versionNumber === verNum
          );
          if (foundIter) {
            targetResume = foundIter.resumeData;
          }
        }

        if (!targetResume) {
          res.status(400).json({ error: 'Resume version is not yet generated.' });
          return;
        }

        if (req.user) {
          await recordDownloadEvent({
            uid: req.user.uid,
            resumeId: null,
            resumeTitle: `${hydrated.fileName} (Engine Improved)`,
            templateSlug,
            format: format.toUpperCase(),
          });
        }

        const baseTitle = sanitizeResumeFileName(
          targetResume.fullName
            ? `${targetResume.fullName}_Optimized_Resume`
            : hydrated.fileName.replace(/\.(pdf|docx)$/i, '')
        );

        if (format === 'docx') {
          const buf = await generateServerDocxBuffer(targetResume, templateSlug);
          res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          );
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${baseTitle}.docx"`
          );
          res.send(buf);
          return;
        }

        const pdfBuf = await generateServerPdfBuffer(targetResume, templateSlug);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${baseTitle}.pdf"`
        );
        res.send(pdfBuf);
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to generate export.' });
      }
    }
  );

  // 7. Permanent Deletion of Engine Job & All Iteration Snapshots
  app.delete(
    '/api/engine/jobs/:jobUid',
    optionalAuth,
    async (req: AuthRequest, res) => {
      try {
        const hydrated = await getHydratedEngineJob(req.params.jobUid);
        if (!hydrated) {
          res.json({ deleted: true });
          return;
        }
        if (hydrated.userUid && req.user?.uid !== hydrated.userUid) {
          res.status(403).json({ error: 'Access denied.' });
          return;
        }
        await deleteEngineJobByUid(req.params.jobUid, hydrated.userUid);
        res.json({ deleted: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to delete job record.' });
      }
    }
  );

  // ===========================================================================
  // FREE DETERMINISTIC ATS RESUME CHECKER + JOB DESCRIPTION ANALYZER
  // ===========================================================================
  app.post(
    '/api/ats/check',
    optionalAuth,
    handleSingleUpload('resumeFile'),
    async (req: AuthRequest, res) => {
      try {
        const consentVal = req.body?.consentConfirmed;
        if (consentVal !== 'true' && consentVal !== true) {
          res.status(400).json({
            error:
              'Please check the permission box so we can read your resume and calculate your ATS score.',
            code: 'CONSENT_REQUIRED',
          });
          return;
        }

        const jobDescription = String(req.body?.jobDescription || '')
          .trim()
          .slice(0, 24000);
        const includeAiTips =
          req.body?.includeAiTips === 'true' || req.body?.includeAiTips === true;

        let resumeText = '';
        let fileName = String(req.body?.fileName || 'Uploaded Resume').trim();
        let fileType = String(req.body?.fileType || 'pdf').trim();
        let pageCount = 1;
        let structuralNotes: string[] = [];

        if (req.file) {
          fileName = req.file.originalname || fileName;
          const parsedDoc = await parseResumeBuffer(
            req.file.buffer,
            req.file.originalname
          );
          // Immediately release uploaded file buffer from memory
          (req as any).file = undefined;

          resumeText = parsedDoc.text;
          fileType = parsedDoc.fileType;
          pageCount = parsedDoc.pageCount;
          structuralNotes = parsedDoc.structuralNotes;
        } else {
          resumeText = String(req.body?.resumeText || '').trim();
          if (resumeText.length < 25) {
            res.status(400).json({
              error:
                'Please upload a PDF or Word (.docx) resume file, or make sure your resume draft has enough text to check.',
              code: 'EMPTY_RESUME_INPUT',
            });
            return;
          }
          pageCount = Math.max(
            1,
            Math.ceil(resumeText.split(/\s+/).filter(Boolean).length / 450)
          );
        }

        // 1. Compute 100% consistent, weighted, deterministic ATS report
        const report = computeDeterministicAtsReport({
          resumeText,
          fileName,
          pageCount,
          structuralNotes,
          jobDescription,
        });

        // 2. Optional plain-English AI writing suggestions (never changes the score!)
        if (includeAiTips) {
          const aiSupplement = await generateOptionalPlainEnglishTipsWithGemini({
            resumeText,
            jobDescription,
            missingSkills: report.missingSkills,
            missingInformation: report.missingInformation,
            formattingIssues: report.formattingIssues,
          });
          report.aiTailoredTips = aiSupplement.tips;
          report.aiQuotaNotice = aiSupplement.quotaNotice;
        }

        // 3. Save report if user is signed in (gracefully skipped in local stateless VS Code setups)
        let savedReportId: number | null = null;
        if (req.user) {
          try {
            const userRecord = await getOrCreateUser(
              req.user.uid,
              req.user.email || `${req.user.uid}@authenticated.user`,
              req.user.name
            );
            const savedRow = await incrementUserScansAndSaveReport({
              uid: userRecord.uid,
              fileName,
              fileType,
              overallScore: report.overallScore,
              reportJson: JSON.stringify(report),
            });
            savedReportId = savedRow?.id ?? null;
          } catch (dbErr) {
            console.warn('Optional ATS report DB save skipped:', dbErr);
          }
        }

        res.json({
          savedReportId,
          fileName,
          fileType,
          report,
        });
      } catch (error: any) {
        (req as any).file = undefined;
        const formatted = formatSafeServerError(error);
        res.status(formatted.status).json({
          error: formatted.message,
          code: formatted.code,
        });
      }
    }
  );

  app.get('/api/ats/reports', requireAuth, async (req: AuthRequest, res) => {
    try {
      const reports = await listUserAtsReports(req.user!.uid);
      res.json({ reports });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load saved ATS checks.' });
    }
  });

  app.delete('/api/ats/reports/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      await deleteUserAtsReport(req.user!.uid, Number(req.params.id));
      res.json({ deleted: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete ATS report.' });
    }
  });

  // Resumes CRUD + Immutable Editing History Snapshots
  app.get('/api/resumes', requireAuth, async (req: AuthRequest, res) => {
    try {
      const list = await listUserResumes(req.user!.uid);
      res.json({ resumes: list });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch resumes.' });
    }
  });

  app.post('/api/resumes', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userRecord = await getOrCreateUser(
        req.user!.uid,
        req.user!.email || `${req.user!.uid}@authenticated.user`,
        req.user!.name
      );

      const templateSlug = String(req.body?.templateSlug || 'classic-executive');

      const saved = await createResumeWithVersion({
        uid: userRecord.uid,
        title: String(req.body?.title || 'My Resume').trim() || 'My Resume',
        templateSlug,
        resumeData: req.body?.resumeData || {},
        changeSummary: String(req.body?.changeSummary || 'Saved resume'),
      });

      res.json({ resume: saved });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to save resume.' });
    }
  });

  app.put('/api/resumes/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userRecord = await getOrCreateUser(
        req.user!.uid,
        req.user!.email || `${req.user!.uid}@authenticated.user`,
        req.user!.name
      );

      const templateSlug = String(req.body?.templateSlug || 'classic-executive');

      const saved = await updateResumeWithVersion({
        resumeId: Number(req.params.id),
        uid: userRecord.uid,
        title: String(req.body?.title || 'My Resume').trim() || 'My Resume',
        templateSlug,
        resumeData: req.body?.resumeData || {},
        changeSummary: String(req.body?.changeSummary || 'Updated resume'),
      });

      res.json({ resume: saved });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update resume.' });
    }
  });

  app.delete('/api/resumes/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      await deleteUserResume(req.user!.uid, Number(req.params.id));
      res.json({ deleted: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete resume.' });
    }
  });

  app.post('/api/downloads', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const format = String(req.body?.format || 'PDF').toUpperCase();
      if (!req.user) {
        res.json({ download: { logged: false, format } });
        return;
      }

      const userRecord = await getOrCreateUser(
        req.user.uid,
        req.user.email || `${req.user.uid}@authenticated.user`,
        req.user.name
      );

      const log = await recordDownloadEvent({
        uid: userRecord.uid,
        resumeId: req.body?.resumeId ? Number(req.body.resumeId) : null,
        resumeTitle: String(req.body?.resumeTitle || 'Resume Export'),
        templateSlug: String(req.body?.templateSlug || 'classic-executive'),
        format,
      });

      res.json({ download: log });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to log download.' });
    }
  });

  app.post('/api/ai/improve', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const mode = String(req.body?.mode || 'bullets');
      const content = String(req.body?.content || '').trim();
      const targetKeywords = String(req.body?.targetKeywords || '').trim();

      if (content.length < 8) {
        res.status(400).json({
          error: 'Please enter a sentence or bullet point first so we can polish it.',
        });
        return;
      }

      const result = await improveResumeContentWithGemini({
        mode,
        content,
        targetKeywords,
      });

      res.json({ result });
    } catch (error: any) {
      const formatted = formatSafeServerError(error);
      res
        .status(formatted.status)
        .json({ error: formatted.message, code: formatted.code });
    }
  });

  app.get('/api/dashboard', requireAuth, async (req: AuthRequest, res) => {
    try {
      await getOrCreateUser(
        req.user!.uid,
        req.user!.email || `${req.user!.uid}@authenticated.user`,
        req.user!.name
      );
      const bundle = await getUserDashboardBundle(req.user!.uid);
      res.json(bundle);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load dashboard.' });
    }
  });

  const ensureAdmin = async (req: AuthRequest): Promise<boolean> => {
    const profile = await getOrCreateUser(
      req.user!.uid,
      req.user!.email || `${req.user!.uid}@authenticated.user`,
      req.user!.name
    );
    return profile.role === 'admin';
  };

  app.get('/api/admin/overview', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!(await ensureAdmin(req))) {
        res.status(403).json({ error: 'Forbidden: Administrator role required.' });
        return;
      }
      const overview = await getAdminOverviewBundle();
      res.json(overview);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load admin console.' });
    }
  });

  app.patch('/api/admin/users/:uid', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!(await ensureAdmin(req))) {
        res.status(403).json({ error: 'Forbidden: Administrator role required.' });
        return;
      }
      const updated = await adminUpdateUserRecord(req.params.uid, {
        role: req.body?.role,
        plan: req.body?.plan,
        resetScans: Boolean(req.body?.resetScans),
      });
      res.json({ user: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update user.' });
    }
  });

  app.delete('/api/admin/users/:uid', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!(await ensureAdmin(req))) {
        res.status(403).json({ error: 'Forbidden: Administrator role required.' });
        return;
      }
      if (req.params.uid === req.user!.uid) {
        res.status(400).json({ error: 'Cannot delete your own active admin session.' });
        return;
      }
      await deleteEntireUserAccount(req.params.uid);
      res.json({ deleted: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete user.' });
    }
  });

  app.patch('/api/admin/templates/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!(await ensureAdmin(req))) {
        res.status(403).json({ error: 'Forbidden: Administrator role required.' });
        return;
      }
      const updated = await adminUpdateTemplateRecord(Number(req.params.id), {
        name: String(req.body?.name || '').trim(),
        description: String(req.body?.description || '').trim(),
        isPremium: Boolean(req.body?.isPremium),
        isActive: Boolean(req.body?.isActive),
      });
      res.json({ template: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update template.' });
    }
  });

  app.patch('/api/admin/plans/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!(await ensureAdmin(req))) {
        res.status(403).json({ error: 'Forbidden: Administrator role required.' });
        return;
      }
      const updated = await adminUpdatePlanRecord(Number(req.params.id), {
        name: String(req.body?.name || '').trim(),
        tagline: String(req.body?.tagline || '').trim(),
        monthlyPrice: Number(req.body?.monthlyPrice) || 0,
        scanLimit: Math.max(1, Number(req.body?.scanLimit) || 1),
        features: Array.isArray(req.body?.features) ? req.body.features : [],
      });
      res.json({ plan: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update pricing plan.' });
    }
  });

  const injectRouteSeoIntoHtml = (rawHtml: string, pathname: string): string => {
    const siteOrigin = getSiteOrigin();
    const meta = getRouteSeoMetadata(pathname, siteOrigin);
    const jsonLdString = JSON.stringify(buildRouteJsonLd(pathname, siteOrigin));
    const prerenderHtml = buildServerPrerenderMarkup(pathname);

    const escapedTitle = meta.title.replace(/&/g, '&amp;');
    const escapedDesc = meta.description.replace(/"/g, '&quot;');
    const gscToken = (process.env.GOOGLE_SITE_VERIFICATION || '').trim();
    const gscMetaTag = gscToken
      ? `<meta name="google-site-verification" content="${gscToken.replace(/"/g, '&quot;')}" />`
      : '';

    return rawHtml
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapedTitle}</title>`)
      .replace(
        /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="description" content="${escapedDesc}" />`
      )
      .replace(
        /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="robots" content="${meta.robots}" />`
      )
      .replace(
        /<meta\s+name="googlebot"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="googlebot" content="${meta.robots}" />`
      )
      .replace('<!--GOOGLE_SITE_VERIFICATION_SLOT-->', gscMetaTag)
      .replace(
        /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
        `<link rel="canonical" href="${meta.canonicalUrl}" />`
      )
      .replace(
        /<link\s+rel="alternate"\s+hreflang="en"\s+href="[^"]*"\s*\/?>/i,
        `<link rel="alternate" hreflang="en" href="${meta.canonicalUrl}" />`
      )
      .replace(
        /<link\s+rel="alternate"\s+hreflang="x-default"\s+href="[^"]*"\s*\/?>/i,
        `<link rel="alternate" hreflang="x-default" href="${meta.canonicalUrl}" />`
      )
      .replace(
        /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i,
        `<meta property="og:type" content="${meta.ogType}" />`
      )
      .replace(
        /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
        `<meta property="og:url" content="${meta.canonicalUrl}" />`
      )
      .replace(
        /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
        `<meta property="og:title" content="${escapedTitle}" />`
      )
      .replace(
        /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
        `<meta property="og:description" content="${escapedDesc}" />`
      )
      .replace(
        /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="twitter:title" content="${escapedTitle}" />`
      )
      .replace(
        /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="twitter:description" content="${escapedDesc}" />`
      )
      .replace(
        /<script\s+id="resumiq-jsonld"\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
        `<script id="resumiq-jsonld" type="application/ld+json">${jsonLdString}</script>`
      )
      .replace(
        /<!--RESUMIQ_SSR_START-->[\s\S]*?<!--RESUMIQ_SSR_END-->/,
        `<!--RESUMIQ_SSR_START-->${prerenderHtml}<!--RESUMIQ_SSR_END-->`
      );
  };

  app.get('/robots.txt', (_req, res) => {
    const siteOrigin = getSiteOrigin();
    res.type('text/plain; charset=utf-8').send(
      [
        'User-agent: *',
        'Allow: /',
        'Allow: /resume-builder',
        'Allow: /ats-score-checker',
        'Allow: /guides',
        'Allow: /guides/',
        'Allow: /images/',
        'Disallow: /api/',
        '',
        `Sitemap: ${siteOrigin}/sitemap.xml`,
        '',
      ].join('\n')
    );
  });

  app.get('/llms.txt', (_req, res) => {
    const siteOrigin = getSiteOrigin();
    res.type('text/plain; charset=utf-8').send(
      [
        '# resumiq.ai',
        '',
        '> 100% Free ATS-Friendly Resume Builder, Online Resume Scanner & Deterministic 100-Point ATS Resume Score Checker.',
        '',
        '## Core Tools',
        `- [Home](${siteOrigin}/): Overview of resumiq.ai free career tools and 10-category transparent ATS scoring criteria.`,
        `- [Free ATS Resume Builder](${siteOrigin}/resume-builder): Step-by-step single-column resume builder with live preview and instant free PDF & Word (.docx) download without mandatory sign-in.`,
        `- [Free ATS Score Checker](${siteOrigin}/ats-score-checker): Upload a PDF or DOCX resume and paste any job description for a repeatable 100-point compatibility score, required vs. preferred keyword matching, and formatting checks.`,
        `- [ATS Resume Guides](${siteOrigin}/guides): Practical guides for job seekers and freshers on ATS parsing, keyword alignment, and resume formatting.`,
        '',
        '## Guides',
        ...SEO_GUIDE_ARTICLES.map(
          (g) => `- [${g.h1}](${siteOrigin}${g.path}): ${g.metaDescription}`
        ),
        '',
      ].join('\n')
    );
  });

  app.get('/sitemap.xml', (_req, res) => {
    const siteOrigin = getSiteOrigin();
    const pages = getAllPublicSitemapEntries(siteOrigin);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages
  .map(
    (p) => `  <url>
    <loc>${p.loc}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>${
      p.images.length > 0
        ? '\n' +
          p.images
            .map(
              (img) => `    <image:image>
      <image:loc>${img.loc}</image:loc>
      <image:title>${img.title.replace(/&/g, '&amp;')}</image:title>
    </image:image>`
            )
            .join('\n')
        : ''
    }
  </url>`
  )
  .join('\n')}
</urlset>`;

    res
      .set('Cache-Control', 'public, max-age=3600')
      .type('application/xml; charset=utf-8')
      .send(xml);
  });

  // Development-only clean source archive download (never active in production)
  if (process.env.NODE_ENV !== 'production') {
    app.get('/api/dev/export-zip', (_req, res) => {
      const archiveCmd = [
        'if [ ! -d .git ]; then',
        '  git init -b main >/dev/null 2>&1 &&',
        '  git config user.name "RESUMIQ AI" &&',
        '  git config user.email "itsanuj81@gmail.com" &&',
        '  git add . &&',
        '  git commit -m "Initial commit: RESUMIQ AI complete source code" >/dev/null 2>&1;',
        'fi &&',
        'git archive --format=zip --prefix=RESUMIQ-AI/ HEAD',
      ].join(' ');

      execFile(
        'bash',
        ['-c', archiveCmd],
        { cwd: __dirname, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
        (err, stdout) => {
          if (err || !stdout || stdout.length < 100) {
            res.status(500).json({ error: 'Unable to build source archive.' });
            return;
          }
          res.setHeader('Content-Type', 'application/zip');
          res.setHeader(
            'Content-Disposition',
            'attachment; filename="RESUMIQ-AI.zip"'
          );
          res.setHeader('Cache-Control', 'no-store');
          res.send(stdout);
        }
      );
    });
  }

  // Strict JSON 404 guard + X-Robots-Tag noindex for /api/* routes
  app.use('/api', (_req, res) => {
    res
      .status(404)
      .set('X-Robots-Tag', 'noindex, nofollow')
      .json({ error: 'API endpoint not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const publicDir = path.join(__dirname, 'public');
    const vitePromise = import('vite').then(({ createServer }) =>
      createServer({
        server: { middlewareMode: true },
        appType: 'custom',
      })
    );

    const isViteOrStaticAssetRequest = (reqPath: string): boolean => {
      if (
        reqPath.startsWith('/@') ||
        reqPath.startsWith('/src/') ||
        reqPath.startsWith('/node_modules/')
      ) {
        return true;
      }
      if (/\.[a-z0-9]+$/i.test(reqPath) && !reqPath.endsWith('.html')) {
        return true;
      }
      const candidatePublic = path.join(publicDir, reqPath);
      if (
        candidatePublic.startsWith(publicDir) &&
        fs.existsSync(candidatePublic) &&
        fs.statSync(candidatePublic).isFile()
      ) {
        return true;
      }
      return false;
    };

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          vite.middlewares(req, res, next);
          return;
        }
        if (isViteOrStaticAssetRequest(req.path)) {
          vite.middlewares(req, res, next);
          return;
        }

        const resolved = resolveRoute(req.path);
        if (resolved.redirectTo) {
          const queryIdx = req.originalUrl.indexOf('?');
          const qs = queryIdx >= 0 ? req.originalUrl.slice(queryIdx) : '';
          res.redirect(301, `${resolved.redirectTo}${qs}`);
          return;
        }

        const rawTemplate = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawTemplate);
        const withSeo = injectRouteSeoIntoHtml(transformed, req.path);
        const meta = getRouteSeoMetadata(req.path, getSiteOrigin());

        res
          .status(resolved.is404 ? 404 : 200)
          .set({
            'Content-Type': 'text/html; charset=utf-8',
            'X-Robots-Tag': meta.robots,
          })
          .end(withSeo);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    const distIndexHtmlPath = path.join(distPath, 'index.html');
    app.use(
      express.static(distPath, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      if (/\.(js|mjs|css|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|map|json|webmanifest)$/i.test(req.path)) {
        res
          .status(404)
          .set('X-Robots-Tag', 'noindex, nofollow')
          .type('text/plain; charset=utf-8')
          .send('Asset not found');
        return;
      }

      const resolved = resolveRoute(req.path);
      if (resolved.redirectTo) {
        const queryIdx = req.originalUrl.indexOf('?');
        const qs = queryIdx >= 0 ? req.originalUrl.slice(queryIdx) : '';
        res.redirect(301, `${resolved.redirectTo}${qs}`);
        return;
      }

      try {
        const rawHtml = fs.readFileSync(distIndexHtmlPath, 'utf8');
        const withSeo = injectRouteSeoIntoHtml(rawHtml, req.path);
        const meta = getRouteSeoMetadata(req.path, getSiteOrigin());
        res
          .status(resolved.is404 ? 404 : 200)
          .set({
            'Content-Type': 'text/html; charset=utf-8',
            'X-Robots-Tag': meta.robots,
          })
          .send(withSeo);
      } catch {
        res.status(resolved.is404 ? 404 : 200).sendFile(distIndexHtmlPath);
      }
    });
  }

  // Global error handler ensuring /api/* always returns valid JSON even on body-parser errors
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      const status = typeof err?.status === 'number' ? err.status : 500;
      res.status(status).json({
        error: err?.message || 'Unexpected API server error.',
      });
      return;
    }
    res.status(500).send('Internal Server Error');
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`resumiq.ai server running on http://0.0.0.0:${PORT}`);
    // Trigger background DB catalog warmup immediately on boot
    getCatalogData().catch(() => {});
  });
}

startServer();
