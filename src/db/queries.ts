import { asc, and, count, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  atsReports,
  downloadHistory,
  engineIterations,
  engineJobs,
  jobMatches,
  pricingPlans,
  resumes,
  resumeVersions,
  templatesCatalog,
  users,
} from './schema.ts';

const AUTO_ADMIN_EMAIL = 'itsanuj81@gmail.com';

const FALLBACK_CATALOG_PLANS = [
  {
    id: 1,
    slug: 'free',
    name: 'Free Starter',
    tagline: 'For early-stage job seekers testing resume readiness',
    monthlyPrice: 0,
    scanLimit: 2,
    features: [
      'Up to 2 ATS resume scans',
      'Step-by-step Resume Builder',
      'Classic Executive ATS template',
      'Single resume PDF download',
      'Explicit privacy & deletion controls',
    ],
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    id: 2,
    slug: 'premium',
    name: 'Premium Pro',
    tagline: 'For active candidates tailoring applications across roles',
    monthlyPrice: 19,
    scanLimit: 50,
    features: [
      'Up to 50 ATS resume scans per month',
      'All 4 ATS-friendly templates unlocked',
      'AI Improvement Assistant & ethical bullet rewriting',
      'Job Description Matcher with keyword gap analysis',
      'Unlimited PDF & DOCX resume downloads',
      'Full version history & one-click snapshots',
    ],
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

const FALLBACK_CATALOG_TEMPLATES = [
  {
    id: 1,
    slug: 'classic-executive',
    name: 'Classic Executive',
    category: 'Standard & Corporate',
    description:
      'Traditional single-column layout with centered contact header and clean section lines.',
    isPremium: false,
    isActive: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    id: 2,
    slug: 'modern-tech',
    name: 'Modern Tech',
    category: 'Software & IT',
    description:
      'Left-aligned single-column layout with clear skill rows and crisp navy headings.',
    isPremium: false,
    isActive: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    id: 3,
    slug: 'minimalist-academic',
    name: 'Minimalist Academic',
    category: 'Students & Freshers',
    description:
      'Calm, easy-to-scan layout ideal for students, fresh graduates, and project-focused resumes.',
    isPremium: false,
    isActive: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    id: 4,
    slug: 'compact-ats',
    name: 'Compact ATS',
    category: 'One-Page Fit',
    description:
      'Space-saving single-column layout designed to fit detailed experience cleanly on one page.',
    isPremium: false,
    isActive: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

let cachedCatalog: {
  plans: typeof FALLBACK_CATALOG_PLANS;
  templates: typeof FALLBACK_CATALOG_TEMPLATES;
  fetchedAt: number;
} | null = null;
const CATALOG_CACHE_TTL_MS = 30_000;

export async function ensureCatalogDefaults() {
  try {
    const existingPlans = await db.select().from(pricingPlans);
    if (existingPlans.length === 0) {
      await db
        .insert(pricingPlans)
        .values(
          FALLBACK_CATALOG_PLANS.map((p) => ({
            slug: p.slug,
            name: p.name,
            tagline: p.tagline,
            monthlyPrice: p.monthlyPrice,
            scanLimit: p.scanLimit,
            featuresJson: JSON.stringify(p.features),
          }))
        )
        .onConflictDoNothing();
    }

    const existingTemplates = await db.select().from(templatesCatalog);
    if (existingTemplates.length === 0) {
      await db
        .insert(templatesCatalog)
        .values(
          FALLBACK_CATALOG_TEMPLATES.map((t) => ({
            slug: t.slug,
            name: t.name,
            category: t.category,
            description: t.description,
            isPremium: t.isPremium,
            isActive: t.isActive,
          }))
        )
        .onConflictDoNothing();
    }
  } catch (error) {
    console.error('Catalog seed check failed:', error);
    throw new Error('Unable to load platform catalog.', { cause: error });
  }
}

async function queryCatalogFromDb() {
  await ensureCatalogDefaults();
  const [plansRows, templatesRows] = await Promise.all([
    db.select().from(pricingPlans).orderBy(pricingPlans.monthlyPrice),
    db.select().from(templatesCatalog).orderBy(templatesCatalog.id),
  ]);

  const result = {
    plans: plansRows.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      monthlyPrice: p.monthlyPrice,
      scanLimit: p.scanLimit,
      features: JSON.parse(p.featuresJson || '[]'),
      updatedAt: p.updatedAt,
    })),
    templates: templatesRows.map((t) => ({
      ...t,
      isPremium: false,
    })),
  };

  cachedCatalog = {
    ...result,
    fetchedAt: Date.now(),
  };
  return result;
}

export async function getCatalogData() {
  if (cachedCatalog && Date.now() - cachedCatalog.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return {
      plans: cachedCatalog.plans,
      templates: cachedCatalog.templates,
    };
  }

  try {
    // Allow DB query to run in background even if cold-start exceeds 4.5s so Cloud SQL finishes waking up
    const dbFetchPromise = queryCatalogFromDb();
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutSentinel = new Promise<null>((resolve) => {
      timeoutHandle = setTimeout(() => resolve(null), 4500);
    });

    const raced = await Promise.race([dbFetchPromise, timeoutSentinel]);
    if (timeoutHandle) clearTimeout(timeoutHandle);

    if (raced) {
      return raced;
    }

    // Keep background DB wake-up unhandled-rejection safe
    dbFetchPromise.catch(() => {});

    return cachedCatalog
      ? { plans: cachedCatalog.plans, templates: cachedCatalog.templates }
      : { plans: FALLBACK_CATALOG_PLANS, templates: FALLBACK_CATALOG_TEMPLATES };
  } catch (error) {
    console.warn('Catalog DB read temporarily unavailable, serving cached/default catalog:', error);
    return cachedCatalog
      ? { plans: cachedCatalog.plans, templates: cachedCatalog.templates }
      : { plans: FALLBACK_CATALOG_PLANS, templates: FALLBACK_CATALOG_TEMPLATES };
  }
}

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const normalizedEmail = (email || '').trim();
    const isAutoAdmin = normalizedEmail.toLowerCase() === AUTO_ADMIN_EMAIL;

    const upserted = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        displayName: name || normalizedEmail.split('@')[0] || 'Member',
        role: isAutoAdmin ? 'admin' : 'user',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          ...(isAutoAdmin ? { role: 'admin' } : {}),
        },
      })
      .returning();

    const userRow = upserted[0];

    const [plansRows, dlCountRows] = await Promise.all([
      db.select().from(pricingPlans).where(eq(pricingPlans.slug, userRow.plan)),
      db
        .select({ total: count() })
        .from(downloadHistory)
        .where(eq(downloadHistory.userUid, uid)),
    ]);

    const scanLimit = 999999;
    const downloadsCount = Number(dlCountRows[0]?.total ?? 0);

    return {
      ...userRow,
      scanLimit,
      downloadsCount,
    };
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function updateUserProfileName(uid: string, displayName: string) {
  try {
    const rows = await db
      .update(users)
      .set({ displayName })
      .where(eq(users.uid, uid))
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Database query failed in updateUserProfileName:', error);
    throw new Error('Failed to update profile.', { cause: error });
  }
}

export async function setUserPlan(uid: string, plan: 'free' | 'premium') {
  try {
    const rows = await db
      .update(users)
      .set({
        plan,
        subscriptionStatus: 'active',
        upgradedAt: plan === 'premium' ? new Date() : null,
      })
      .where(eq(users.uid, uid))
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Database query failed in setUserPlan:', error);
    throw new Error('Failed to update subscription tier.', { cause: error });
  }
}

export async function incrementUserScansAndSaveReport(params: {
  uid: string;
  fileName: string;
  fileType: string;
  overallScore: number;
  reportJson: string;
}) {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, params.uid));
    if (existing[0]) {
      await db
        .update(users)
        .set({ scansUsed: existing[0].scansUsed + 1 })
        .where(eq(users.uid, params.uid));
    }

    const inserted = await db
      .insert(atsReports)
      .values({
        userUid: params.uid,
        fileName: params.fileName,
        fileType: params.fileType,
        overallScore: params.overallScore,
        reportJson: params.reportJson,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in incrementUserScansAndSaveReport:', error);
    throw new Error('Failed to store ATS diagnostic report.', { cause: error });
  }
}

export async function createResumeWithVersion(params: {
  uid: string;
  title: string;
  templateSlug: string;
  resumeData: unknown;
  changeSummary: string;
}) {
  try {
    const resumeDataStr = JSON.stringify(params.resumeData);
    const created = await db
      .insert(resumes)
      .values({
        userUid: params.uid,
        title: params.title,
        templateSlug: params.templateSlug,
        resumeData: resumeDataStr,
      })
      .returning();

    const row = created[0];
    await db.insert(resumeVersions).values({
      resumeId: row.id,
      userUid: params.uid,
      versionNumber: 1,
      changeSummary: params.changeSummary,
      snapshotData: JSON.stringify({
        title: row.title,
        templateSlug: row.templateSlug,
        resumeData: params.resumeData,
      }),
    });

    return {
      ...row,
      resumeData: params.resumeData,
    };
  } catch (error) {
    console.error('Database query failed in createResumeWithVersion:', error);
    throw new Error('Failed to save new resume.', { cause: error });
  }
}

export async function updateResumeWithVersion(params: {
  resumeId: number;
  uid: string;
  title: string;
  templateSlug: string;
  resumeData: unknown;
  changeSummary: string;
}) {
  try {
    const existing = await db
      .select()
      .from(resumes)
      .where(and(eq(resumes.id, params.resumeId), eq(resumes.userUid, params.uid)));

    if (!existing[0]) {
      return createResumeWithVersion(params);
    }

    const updated = await db
      .update(resumes)
      .set({
        title: params.title,
        templateSlug: params.templateSlug,
        resumeData: JSON.stringify(params.resumeData),
        updatedAt: new Date(),
      })
      .where(and(eq(resumes.id, params.resumeId), eq(resumes.userUid, params.uid)))
      .returning();

    const versionCountRows = await db
      .select({ total: count() })
      .from(resumeVersions)
      .where(eq(resumeVersions.resumeId, params.resumeId));

    const nextVersionNumber = Number(versionCountRows[0]?.total ?? 0) + 1;

    await db.insert(resumeVersions).values({
      resumeId: params.resumeId,
      userUid: params.uid,
      versionNumber: nextVersionNumber,
      changeSummary: params.changeSummary,
      snapshotData: JSON.stringify({
        title: params.title,
        templateSlug: params.templateSlug,
        resumeData: params.resumeData,
      }),
    });

    return {
      ...updated[0],
      resumeData: params.resumeData,
    };
  } catch (error) {
    console.error('Database query failed in updateResumeWithVersion:', error);
    throw new Error('Failed to save resume update.', { cause: error });
  }
}

export async function listUserResumes(uid: string) {
  try {
    const rows = await db
      .select()
      .from(resumes)
      .where(eq(resumes.userUid, uid))
      .orderBy(desc(resumes.updatedAt));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      templateSlug: r.templateSlug,
      resumeData: JSON.parse(r.resumeData),
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    }));
  } catch (error) {
    console.error('Database query failed in listUserResumes:', error);
    throw new Error('Failed to fetch saved resumes.', { cause: error });
  }
}

export async function deleteUserResume(uid: string, resumeId: number) {
  try {
    await db
      .delete(resumes)
      .where(and(eq(resumes.id, resumeId), eq(resumes.userUid, uid)));
  } catch (error) {
    console.error('Database query failed in deleteUserResume:', error);
    throw new Error('Failed to delete resume.', { cause: error });
  }
}

export async function listUserAtsReports(uid: string) {
  try {
    const rows = await db
      .select()
      .from(atsReports)
      .where(eq(atsReports.userUid, uid))
      .orderBy(desc(atsReports.createdAt))
      .limit(15);

    return rows.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      fileType: r.fileType,
      overallScore: r.overallScore,
      report: JSON.parse(r.reportJson),
      createdAt: r.createdAt,
    }));
  } catch (error) {
    console.error('Database query failed in listUserAtsReports:', error);
    throw new Error('Failed to fetch ATS reports.', { cause: error });
  }
}

export async function deleteUserAtsReport(uid: string, reportId: number) {
  try {
    await db
      .delete(atsReports)
      .where(and(eq(atsReports.id, reportId), eq(atsReports.userUid, uid)));
  } catch (error) {
    console.error('Database query failed in deleteUserAtsReport:', error);
    throw new Error('Failed to delete ATS report.', { cause: error });
  }
}

export async function saveJobMatchRecord(params: {
  uid: string;
  jobTitle: string;
  resumeTitle: string;
  matchPercentage: number;
  matchJson: string;
}) {
  try {
    const inserted = await db
      .insert(jobMatches)
      .values({
        userUid: params.uid,
        jobTitle: params.jobTitle,
        resumeTitle: params.resumeTitle,
        matchPercentage: params.matchPercentage,
        matchJson: params.matchJson,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in saveJobMatchRecord:', error);
    throw new Error('Failed to save job match analysis.', { cause: error });
  }
}

export async function recordDownloadEvent(params: {
  uid: string;
  resumeId: number | null;
  resumeTitle: string;
  templateSlug: string;
  format: string;
}) {
  try {
    const inserted = await db
      .insert(downloadHistory)
      .values({
        userUid: params.uid,
        resumeId: params.resumeId,
        resumeTitle: params.resumeTitle,
        templateSlug: params.templateSlug,
        format: params.format,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in recordDownloadEvent:', error);
    throw new Error('Failed to record download event.', { cause: error });
  }
}

export async function getUserDashboardBundle(uid: string) {
  try {
    const [resumeRows, reportRows, versionRows, downloadRows, matchRows, engineJobRows] =
      await Promise.all([
        listUserResumes(uid),
        db
          .select()
          .from(atsReports)
          .where(eq(atsReports.userUid, uid))
          .orderBy(desc(atsReports.createdAt)),
        db
          .select()
          .from(resumeVersions)
          .where(eq(resumeVersions.userUid, uid))
          .orderBy(desc(resumeVersions.createdAt)),
        db
          .select()
          .from(downloadHistory)
          .where(eq(downloadHistory.userUid, uid))
          .orderBy(desc(downloadHistory.createdAt)),
        db
          .select()
          .from(jobMatches)
          .where(eq(jobMatches.userUid, uid))
          .orderBy(desc(jobMatches.createdAt)),
        db
          .select()
          .from(engineJobs)
          .where(eq(engineJobs.userUid, uid))
          .orderBy(desc(engineJobs.createdAt)),
      ]);

    return {
      resumes: resumeRows,
      atsReports: reportRows.map((r) => ({
        id: r.id,
        fileName: r.fileName,
        fileType: r.fileType,
        overallScore: r.overallScore,
        report: JSON.parse(r.reportJson),
        createdAt: r.createdAt,
      })),
      versions: versionRows.map((v) => ({
        id: v.id,
        resumeId: v.resumeId,
        versionNumber: v.versionNumber,
        changeSummary: v.changeSummary,
        snapshotData: JSON.parse(v.snapshotData),
        createdAt: v.createdAt,
      })),
      downloads: downloadRows,
      jobMatches: matchRows.map((m) => ({
        id: m.id,
        jobTitle: m.jobTitle,
        resumeTitle: m.resumeTitle,
        matchPercentage: m.matchPercentage,
        match: JSON.parse(m.matchJson),
        createdAt: m.createdAt,
      })),
      engineJobs: engineJobRows.map((j) => ({
        id: j.id,
        jobUid: j.jobUid,
        mode: j.mode,
        fileName: j.fileName,
        fileType: j.fileType,
        state: j.state,
        currentIteration: j.currentIteration,
        initialScore: j.initialScore,
        currentScore: j.currentScore,
        selectedVersionNumber: j.selectedVersionNumber,
        stopReason: j.stopReason,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
      })),
    };
  } catch (error) {
    console.error('Database query failed in getUserDashboardBundle:', error);
    throw new Error('Failed to fetch dashboard data.', { cause: error });
  }
}

export async function deleteEntireUserAccount(uid: string) {
  try {
    await db.delete(users).where(eq(users.uid, uid));
  } catch (error) {
    console.error('Database query failed in deleteEntireUserAccount:', error);
    throw new Error('Failed to delete user account and associated data.', {
      cause: error,
    });
  }
}

export async function getAdminOverviewBundle() {
  try {
    const [
      allUsers,
      resumesCount,
      scansCount,
      matchesCount,
      downloadsCount,
      catalog,
    ] = await Promise.all([
      db.select().from(users).orderBy(desc(users.createdAt)),
      db.select({ total: count() }).from(resumes),
      db.select({ total: count() }).from(atsReports),
      db.select({ total: count() }).from(jobMatches),
      db.select({ total: count() }).from(downloadHistory),
      getCatalogData(),
    ]);

    const premiumUsersCount = allUsers.filter((u) => u.plan === 'premium').length;
    const premiumPlan = catalog.plans.find((p) => p.slug === 'premium');
    const premiumPrice = premiumPlan?.monthlyPrice ?? 19;

    return {
      stats: {
        totalUsers: allUsers.length,
        premiumUsers: premiumUsersCount,
        totalResumes: Number(resumesCount[0]?.total ?? 0),
        totalAtsScans: Number(scansCount[0]?.total ?? 0),
        totalJobMatches: Number(matchesCount[0]?.total ?? 0),
        totalDownloads: Number(downloadsCount[0]?.total ?? 0),
        estimatedMonthlyRecurringRevenue: premiumUsersCount * premiumPrice,
      },
      users: allUsers,
      templates: catalog.templates,
      plans: catalog.plans,
    };
  } catch (error) {
    console.error('Database query failed in getAdminOverviewBundle:', error);
    throw new Error('Failed to load admin overview.', { cause: error });
  }
}

export async function adminUpdateUserRecord(
  targetUid: string,
  patch: { role?: string; plan?: string; resetScans?: boolean }
) {
  try {
    const updateSet: Record<string, unknown> = {};
    if (patch.role === 'user' || patch.role === 'admin') {
      updateSet.role = patch.role;
    }
    if (patch.plan === 'free' || patch.plan === 'premium') {
      updateSet.plan = patch.plan;
      updateSet.upgradedAt = patch.plan === 'premium' ? new Date() : null;
    }
    if (patch.resetScans) {
      updateSet.scansUsed = 0;
    }

    const rows = await db
      .update(users)
      .set(updateSet)
      .where(eq(users.uid, targetUid))
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Database query failed in adminUpdateUserRecord:', error);
    throw new Error('Failed to update user record.', { cause: error });
  }
}

export async function adminUpdateTemplateRecord(
  templateId: number,
  patch: {
    name: string;
    description: string;
    isPremium: boolean;
    isActive: boolean;
  }
) {
  try {
    const rows = await db
      .update(templatesCatalog)
      .set({
        name: patch.name,
        description: patch.description,
        isPremium: patch.isPremium,
        isActive: patch.isActive,
        updatedAt: new Date(),
      })
      .where(eq(templatesCatalog.id, templateId))
      .returning();
    cachedCatalog = null;
    return rows[0];
  } catch (error) {
    console.error('Database query failed in adminUpdateTemplateRecord:', error);
    throw new Error('Failed to update template.', { cause: error });
  }
}

export async function adminUpdatePlanRecord(
  planId: number,
  patch: {
    name: string;
    tagline: string;
    monthlyPrice: number;
    scanLimit: number;
    features: string[];
  }
) {
  try {
    const rows = await db
      .update(pricingPlans)
      .set({
        name: patch.name,
        tagline: patch.tagline,
        monthlyPrice: patch.monthlyPrice,
        scanLimit: patch.scanLimit,
        featuresJson: JSON.stringify(patch.features),
        updatedAt: new Date(),
      })
      .where(eq(pricingPlans.id, planId))
      .returning();
    cachedCatalog = null;
    return rows[0];
  } catch (error) {
    console.error('Database query failed in adminUpdatePlanRecord:', error);
    throw new Error('Failed to update pricing plan.', { cause: error });
  }
}

export async function incrementUserScansOnly(uid: string) {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid));
    if (existing[0]) {
      await db
        .update(users)
        .set({ scansUsed: existing[0].scansUsed + 1 })
        .where(eq(users.uid, uid));
    }
  } catch (error) {
    console.error('Database query failed in incrementUserScansOnly:', error);
  }
}

export async function createEngineJobRecord(params: {
  jobUid: string;
  userUid: string | null;
  mode: 'autonomous_improve' | 'ats_audit_only';
  fileName: string;
  fileType: string;
  maxIterations?: number;
  totalTasks: number;
  extractedText?: string | null;
  structuralNotes?: string[];
  lastCompletedStage?: string | null;
}) {
  try {
    const rows = await db
      .insert(engineJobs)
      .values({
        jobUid: params.jobUid,
        userUid: params.userUid,
        mode: params.mode,
        fileName: params.fileName,
        fileType: params.fileType,
        state: 'Uploaded',
        currentStageDetail: 'Document received and queued for asynchronous processing',
        currentIteration: 0,
        maxIterations: params.maxIterations ?? 3,
        completedTasks: 0,
        totalTasks: params.totalTasks,
        extractedText: params.extractedText ?? null,
        structuralMetadataJson: JSON.stringify(params.structuralNotes || []),
        lastCompletedStage: params.lastCompletedStage ?? 'upload_received',
      })
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Database query failed in createEngineJobRecord:', error);
    throw new Error('Failed to create background processing job.', { cause: error });
  }
}

export async function updateEngineJobCheckpoint(
  jobUid: string,
  patch: Partial<{
    state: string;
    currentStageDetail: string;
    currentIteration: number;
    maxIterations: number;
    completedTasks: number;
    totalTasks: number;
    initialScore: number | null;
    previousScore: number | null;
    currentScore: number | null;
    selectedVersionNumber: number | null;
    stopReason: string | null;
    extractedText: string | null;
    structuralMetadataJson: string;
    completedImprovementsJson: string;
    remainingIssuesJson: string;
    taskLogsJson: string;
    finalResumeJson: string | null;
    bestSelectionJson: string | null;
    atsAuditReportJson: string | null;
    artifactsMetaJson: string;
    lastCompletedStage: string | null;
    retryCount: number;
    errorCode: string | null;
    errorMessage: string | null;
  }>
) {
  try {
    const rows = await db
      .update(engineJobs)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(engineJobs.jobUid, jobUid))
      .returning();
    return rows[0];
  } catch (error) {
    console.error('Database query failed in updateEngineJobCheckpoint:', error);
    throw new Error('Failed to persist job checkpoint.', { cause: error });
  }
}

export async function upsertEngineIterationRecord(params: {
  jobUid: string;
  versionNumber: number;
  iterationLabel: string;
  resumeData: unknown;
  resumeText: string;
  qualityReport: unknown;
  improvementsApplied: string[];
  overallScore: number;
  factualValidationPassed: boolean;
  selectionCompositeScore: number;
}) {
  try {
    const existing = await db
      .select()
      .from(engineIterations)
      .where(
        and(
          eq(engineIterations.jobUid, params.jobUid),
          eq(engineIterations.versionNumber, params.versionNumber)
        )
      );

    if (existing[0]) {
      const updated = await db
        .update(engineIterations)
        .set({
          iterationLabel: params.iterationLabel,
          resumeJson: JSON.stringify(params.resumeData),
          resumeText: params.resumeText,
          qualityReportJson: JSON.stringify(params.qualityReport),
          improvementsAppliedJson: JSON.stringify(params.improvementsApplied),
          overallScore: params.overallScore,
          factualValidationPassed: params.factualValidationPassed,
          selectionCompositeScore: params.selectionCompositeScore,
        })
        .where(eq(engineIterations.id, existing[0].id))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(engineIterations)
      .values({
        jobUid: params.jobUid,
        versionNumber: params.versionNumber,
        iterationLabel: params.iterationLabel,
        resumeJson: JSON.stringify(params.resumeData),
        resumeText: params.resumeText,
        qualityReportJson: JSON.stringify(params.qualityReport),
        improvementsAppliedJson: JSON.stringify(params.improvementsApplied),
        overallScore: params.overallScore,
        factualValidationPassed: params.factualValidationPassed,
        selectionCompositeScore: params.selectionCompositeScore,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in upsertEngineIterationRecord:', error);
    throw new Error('Failed to store resume iteration snapshot.', { cause: error });
  }
}

export async function getRawEngineJobWithIterations(jobUid: string) {
  const jobRows = await db
    .select()
    .from(engineJobs)
    .where(eq(engineJobs.jobUid, jobUid));
  if (!jobRows[0]) return null;

  const iterRows = await db
    .select()
    .from(engineIterations)
    .where(eq(engineIterations.jobUid, jobUid))
    .orderBy(asc(engineIterations.versionNumber));

  return {
    job: jobRows[0],
    iterations: iterRows,
  };
}

export async function getHydratedEngineJob(jobUid: string) {
  const bundle = await getRawEngineJobWithIterations(jobUid);
  if (!bundle) return null;

  const { job, iterations } = bundle;
  const totalTasks = Math.max(1, job.totalTasks || 1);
  const completedTasks = Math.min(totalTasks, Math.max(0, job.completedTasks || 0));
  const progressPercent = Math.round((completedTasks / totalTasks) * 100);

  return {
    id: job.id,
    jobUid: job.jobUid,
    userUid: job.userUid,
    mode: job.mode,
    fileName: job.fileName,
    fileType: job.fileType,
    state: job.state,
    currentStageDetail: job.currentStageDetail,
    currentIteration: job.currentIteration,
    maxIterations: job.maxIterations,
    completedTasks,
    totalTasks,
    progressPercent,
    initialScore: job.initialScore,
    previousScore: job.previousScore,
    currentScore: job.currentScore,
    selectedVersionNumber: job.selectedVersionNumber,
    stopReason: job.stopReason,
    completedImprovements: JSON.parse(job.completedImprovementsJson || '[]'),
    remainingIssues: JSON.parse(job.remainingIssuesJson || '[]'),
    taskLogs: JSON.parse(job.taskLogsJson || '[]'),
    finalResumeData: job.finalResumeJson ? JSON.parse(job.finalResumeJson) : null,
    bestSelection: job.bestSelectionJson ? JSON.parse(job.bestSelectionJson) : null,
    atsAuditReport: job.atsAuditReportJson ? JSON.parse(job.atsAuditReportJson) : null,
    artifactsReady: JSON.parse(
      job.artifactsMetaJson || '{"pdfReady":false,"docxReady":false}'
    ),
    lastCompletedStage: job.lastCompletedStage,
    retryCount: job.retryCount,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    iterations: iterations.map((it) => ({
      id: it.id,
      jobUid: it.jobUid,
      versionNumber: it.versionNumber,
      iterationLabel: it.iterationLabel,
      resumeData: JSON.parse(it.resumeJson),
      resumeText: it.resumeText,
      qualityReport: JSON.parse(it.qualityReportJson),
      improvementsApplied: JSON.parse(it.improvementsAppliedJson || '[]'),
      overallScore: it.overallScore,
      factualValidationPassed: it.factualValidationPassed,
      selectionCompositeScore: it.selectionCompositeScore,
      createdAt: it.createdAt,
    })),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function deleteEngineJobByUid(jobUid: string, userUid?: string | null) {
  try {
    if (userUid) {
      await db
        .delete(engineJobs)
        .where(and(eq(engineJobs.jobUid, jobUid), eq(engineJobs.userUid, userUid)));
    } else {
      await db.delete(engineJobs).where(eq(engineJobs.jobUid, jobUid));
    }
  } catch (error) {
    console.error('Database query failed in deleteEngineJobByUid:', error);
    throw new Error('Failed to delete engine job.', { cause: error });
  }
}

