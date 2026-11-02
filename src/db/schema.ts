import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default(''),
  role: text('role').notNull().default('user'),
  plan: text('plan').notNull().default('free'),
  scansUsed: integer('scans_used').notNull().default(0),
  subscriptionStatus: text('subscription_status').notNull().default('active'),
  upgradedAt: timestamp('upgraded_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const resumes = pgTable('resumes', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  templateSlug: text('template_slug').notNull().default('classic-executive'),
  resumeData: text('resume_data').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const resumeVersions = pgTable('resume_versions', {
  id: serial('id').primaryKey(),
  resumeId: integer('resume_id')
    .references(() => resumes.id, { onDelete: 'cascade' })
    .notNull(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  versionNumber: integer('version_number').notNull(),
  changeSummary: text('change_summary').notNull(),
  snapshotData: text('snapshot_data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const atsReports = pgTable('ats_reports', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  overallScore: integer('overall_score').notNull(),
  reportJson: text('report_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const jobMatches = pgTable('job_matches', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  jobTitle: text('job_title').notNull(),
  resumeTitle: text('resume_title').notNull(),
  matchPercentage: integer('match_percentage').notNull(),
  matchJson: text('match_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const downloadHistory = pgTable('download_history', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  resumeId: integer('resume_id').references(() => resumes.id, { onDelete: 'set null' }),
  resumeTitle: text('resume_title').notNull(),
  templateSlug: text('template_slug').notNull(),
  format: text('format').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const templatesCatalog = pgTable('templates_catalog', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  isPremium: boolean('is_premium').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const pricingPlans = pgTable('pricing_plans', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  tagline: text('tagline').notNull(),
  monthlyPrice: integer('monthly_price').notNull(),
  scanLimit: integer('scan_limit').notNull(),
  featuresJson: text('features_json').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const engineJobs = pgTable('engine_jobs', {
  id: serial('id').primaryKey(),
  jobUid: text('job_uid').notNull().unique(),
  userUid: text('user_uid').references(() => users.uid, { onDelete: 'cascade' }),
  mode: text('mode').notNull().default('autonomous_improve'),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  state: text('state').notNull().default('Uploaded'),
  currentStageDetail: text('current_stage_detail').notNull().default('Queued for processing'),
  currentIteration: integer('current_iteration').notNull().default(0),
  maxIterations: integer('max_iterations').notNull().default(3),
  completedTasks: integer('completed_tasks').notNull().default(0),
  totalTasks: integer('total_tasks').notNull().default(9),
  initialScore: integer('initial_score'),
  previousScore: integer('previous_score'),
  currentScore: integer('current_score'),
  selectedVersionNumber: integer('selected_version_number'),
  stopReason: text('stop_reason'),
  extractedText: text('extracted_text'),
  structuralMetadataJson: text('structural_metadata_json').notNull().default('[]'),
  completedImprovementsJson: text('completed_improvements_json').notNull().default('[]'),
  remainingIssuesJson: text('remaining_issues_json').notNull().default('[]'),
  taskLogsJson: text('task_logs_json').notNull().default('[]'),
  finalResumeJson: text('final_resume_json'),
  bestSelectionJson: text('best_selection_json'),
  atsAuditReportJson: text('ats_audit_report_json'),
  artifactsMetaJson: text('artifacts_meta_json').notNull().default('{"pdfReady":false,"docxReady":false}'),
  lastCompletedStage: text('last_completed_stage'),
  retryCount: integer('retry_count').notNull().default(0),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const engineIterations = pgTable('engine_iterations', {
  id: serial('id').primaryKey(),
  jobUid: text('job_uid')
    .references(() => engineJobs.jobUid, { onDelete: 'cascade' })
    .notNull(),
  versionNumber: integer('version_number').notNull(),
  iterationLabel: text('iteration_label').notNull(),
  resumeJson: text('resume_json').notNull(),
  resumeText: text('resume_text').notNull(),
  qualityReportJson: text('quality_report_json').notNull(),
  improvementsAppliedJson: text('improvements_applied_json').notNull().default('[]'),
  overallScore: integer('overall_score').notNull().default(0),
  factualValidationPassed: boolean('factual_validation_passed').notNull().default(true),
  selectionCompositeScore: integer('selection_composite_score').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  resumes: many(resumes),
  resumeVersions: many(resumeVersions),
  atsReports: many(atsReports),
  jobMatches: many(jobMatches),
  downloads: many(downloadHistory),
  engineJobs: many(engineJobs),
}));

export const resumesRelations = relations(resumes, ({ one, many }) => ({
  owner: one(users, {
    fields: [resumes.userUid],
    references: [users.uid],
  }),
  versions: many(resumeVersions),
  downloads: many(downloadHistory),
}));

export const resumeVersionsRelations = relations(resumeVersions, ({ one }) => ({
  resume: one(resumes, {
    fields: [resumeVersions.resumeId],
    references: [resumes.id],
  }),
  owner: one(users, {
    fields: [resumeVersions.userUid],
    references: [users.uid],
  }),
}));

export const atsReportsRelations = relations(atsReports, ({ one }) => ({
  owner: one(users, {
    fields: [atsReports.userUid],
    references: [users.uid],
  }),
}));

export const jobMatchesRelations = relations(jobMatches, ({ one }) => ({
  owner: one(users, {
    fields: [jobMatches.userUid],
    references: [users.uid],
  }),
}));

export const downloadHistoryRelations = relations(downloadHistory, ({ one }) => ({
  owner: one(users, {
    fields: [downloadHistory.userUid],
    references: [users.uid],
  }),
  resume: one(resumes, {
    fields: [downloadHistory.resumeId],
    references: [resumes.id],
  }),
}));

export const engineJobsRelations = relations(engineJobs, ({ one, many }) => ({
  owner: one(users, {
    fields: [engineJobs.userUid],
    references: [users.uid],
  }),
  iterations: many(engineIterations),
}));

export const engineIterationsRelations = relations(engineIterations, ({ one }) => ({
  job: one(engineJobs, {
    fields: [engineIterations.jobUid],
    references: [engineJobs.jobUid],
  }),
}));
