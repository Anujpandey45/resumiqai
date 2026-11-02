import crypto from 'crypto';
import type {
  CompletedTaskLog,
  DetectedEngineIssue,
  EngineIterationRecord,
  EngineJobMode,
  EngineJobState,
  ResumeDocumentData,
} from '../types.ts';
import {
  createEngineJobRecord,
  getRawEngineJobWithIterations,
  incrementUserScansAndSaveReport,
  incrementUserScansOnly,
  updateEngineJobCheckpoint,
  upsertEngineIterationRecord,
} from '../db/queries.ts';
import {
  DocumentValidationError,
  parseResumeBuffer,
  validateUploadMetadata,
} from './docParser.ts';
import {
  analyzeResumeWithGemini,
  evaluateCandidateIterationWithGemini,
  extractAndEvaluateBaselineWithGemini,
  runIterativeImprovementWithGemini,
  type AiExecutionOptions,
} from './aiService.ts';
import {
  combineQualityReport,
  selectBestResumeVersion,
  serializeResumeDataToText,
} from './qualityEngine.ts';
import {
  generateServerDocxBuffer,
  generateServerPdfBuffer,
} from './serverDocGenerator.ts';

interface PendingBufferItem {
  buffer: Buffer;
  originalName: string;
}

export interface JobRunOptions {
  timeoutMs?: number;
  maxRetries?: number;
  faultInjection?: {
    failTimesBeforeSuccess?: number;
    simulateTimeoutOnStage?: string;
  };
}

// Ephemeral in-memory staging map strictly for unextracted upload buffers;
// deleted immediately once the 'Extracting' stage completes or fails!
const ephemeralUploadBuffers = new Map<string, PendingBufferItem>();
const jobRunConfigs = new Map<string, JobRunOptions>();
const activeWorkerQueue: string[] = [];
const runningJobUids = new Set<string>();
const MAX_CONCURRENT_JOBS = 2;

export function generateJobUid(): string {
  return `job_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export async function enqueueResumeUploadJob(params: {
  userUid: string | null;
  mode: EngineJobMode;
  buffer: Buffer;
  originalName: string;
  maxIterations?: number;
  runOptions?: JobRunOptions;
}): Promise<{ jobUid: string; state: EngineJobState; fileType: 'pdf' | 'docx' }> {
  // Fast synchronous header + size check (<2ms) before accepting into queue
  const fileType = validateUploadMetadata(params.buffer, params.originalName);
  const jobUid = generateJobUid();
  const maxIterations = Math.min(3, Math.max(1, params.maxIterations ?? 3));
  const totalTasks =
    params.mode === 'ats_audit_only' ? 2 : 3 + maxIterations * 2;

  ephemeralUploadBuffers.set(jobUid, {
    buffer: Buffer.from(params.buffer),
    originalName: params.originalName,
  });

  if (params.runOptions) {
    jobRunConfigs.set(jobUid, params.runOptions);
  }

  await createEngineJobRecord({
    jobUid,
    userUid: params.userUid,
    mode: params.mode,
    fileName: params.originalName,
    fileType,
    maxIterations,
    totalTasks,
    lastCompletedStage: 'upload_received',
  });

  scheduleJobExecution(jobUid);
  return { jobUid, state: 'Uploaded', fileType };
}

export async function enqueueResumeTextJob(params: {
  userUid: string | null;
  mode: EngineJobMode;
  resumeText: string;
  fileName: string;
  fileType: string;
  maxIterations?: number;
  runOptions?: JobRunOptions;
}): Promise<{ jobUid: string; state: EngineJobState }> {
  const cleaned = (params.resumeText || '').trim();
  if (cleaned.length < 20) {
    throw new DocumentValidationError(
      'EMPTY_DOCUMENT',
      'Provided resume text is empty or contains fewer than 20 characters.'
    );
  }

  const jobUid = generateJobUid();
  const maxIterations = Math.min(3, Math.max(1, params.maxIterations ?? 3));
  const totalTasks =
    params.mode === 'ats_audit_only' ? 2 : 3 + maxIterations * 2;

  if (params.runOptions) {
    jobRunConfigs.set(jobUid, params.runOptions);
  }

  await createEngineJobRecord({
    jobUid,
    userUid: params.userUid,
    mode: params.mode,
    fileName: params.fileName,
    fileType: params.fileType,
    maxIterations,
    totalTasks,
    extractedText: cleaned,
    structuralNotes: ['Structured text input'],
    lastCompletedStage: 'upload_received',
  });

  scheduleJobExecution(jobUid);
  return { jobUid, state: 'Uploaded' };
}

export async function resumeFailedJobFromCheckpoint(
  jobUid: string,
  overrideOptions?: JobRunOptions
): Promise<{ jobUid: string; resumedFromStage: string }> {
  const bundle = await getRawEngineJobWithIterations(jobUid);
  if (!bundle) {
    throw new Error('Job record not found.');
  }
  const { job } = bundle;
  if (runningJobUids.has(jobUid)) {
    return {
      jobUid,
      resumedFromStage: job.lastCompletedStage || 'upload_received',
    };
  }

  if (overrideOptions) {
    jobRunConfigs.set(jobUid, overrideOptions);
  } else {
    // Clear any one-off test fault injection when retrying normally
    jobRunConfigs.delete(jobUid);
  }

  await updateEngineJobCheckpoint(jobUid, {
    state: 'Uploaded',
    currentStageDetail: `Resuming from saved checkpoint (${job.lastCompletedStage || 'start'})...`,
    retryCount: (job.retryCount || 0) + 1,
    errorCode: null,
    errorMessage: null,
  });

  scheduleJobExecution(jobUid);
  return {
    jobUid,
    resumedFromStage: job.lastCompletedStage || 'upload_received',
  };
}

function scheduleJobExecution(jobUid: string) {
  if (!activeWorkerQueue.includes(jobUid) && !runningJobUids.has(jobUid)) {
    activeWorkerQueue.push(jobUid);
  }
  setImmediate(drainWorkerQueue);
}

function drainWorkerQueue() {
  while (
    runningJobUids.size < MAX_CONCURRENT_JOBS &&
    activeWorkerQueue.length > 0
  ) {
    const nextJobUid = activeWorkerQueue.shift();
    if (!nextJobUid || runningJobUids.has(nextJobUid)) continue;

    runningJobUids.add(nextJobUid);
    executeJobPipeline(nextJobUid)
      .catch((err) => {
        console.error(
          `[ResumiqQueue] Unhandled worker error for ${nextJobUid}:`,
          err?.message || 'Unknown error'
        );
      })
      .finally(() => {
        runningJobUids.delete(nextJobUid);
        setImmediate(drainWorkerQueue);
      });
  }
}

const STAGE_ORDER = [
  'upload_received',
  'extracted',
  'baseline_analyzed',
  'iter_1_improved',
  'iter_1_rechecked',
  'iter_2_improved',
  'iter_2_rechecked',
  'iter_3_improved',
  'iter_3_rechecked',
  'artifacts_generated',
];

function isStageAlreadyDone(
  lastCompleted: string | null | undefined,
  stageKey: string
): boolean {
  if (!lastCompleted) return false;
  const lastIdx = STAGE_ORDER.indexOf(lastCompleted);
  const targetIdx = STAGE_ORDER.indexOf(stageKey);
  if (lastIdx < 0 || targetIdx < 0) return false;
  return lastIdx >= targetIdx;
}

function buildAiOptions(
  jobUid: string,
  stageKey: string,
  runConfig?: JobRunOptions
): AiExecutionOptions {
  return {
    timeoutMs: runConfig?.timeoutMs,
    maxRetries: runConfig?.maxRetries,
    jobTag: jobUid,
    faultInjection: runConfig?.faultInjection
      ? {
          ...runConfig.faultInjection,
          currentStageKey: stageKey,
        }
      : undefined,
  };
}

async function executeJobPipeline(jobUid: string): Promise<void> {
  const initialBundle = await getRawEngineJobWithIterations(jobUid);
  if (!initialBundle) return;

  const runConfig = jobRunConfigs.get(jobUid);
  let { job } = initialBundle;
  const taskLogs: CompletedTaskLog[] = JSON.parse(job.taskLogsJson || '[]');
  const completedImprovements: string[] = JSON.parse(
    job.completedImprovementsJson || '[]'
  );
  let remainingIssues: DetectedEngineIssue[] = JSON.parse(
    job.remainingIssuesJson || '[]'
  );

  const pushTaskLog = (
    taskKey: string,
    label: string,
    stage: EngineJobState,
    iteration: number
  ) => {
    if (!taskLogs.some((t) => t.taskKey === taskKey)) {
      taskLogs.push({
        taskKey,
        label,
        stage,
        iteration,
        completedAt: new Date().toISOString(),
      });
    }
  };

  try {
    // =========================================================================
    // STAGE 1: EXTRACTING (Separate PDF/DOCX extraction from AI analysis)
    // =========================================================================
    let extractedText = job.extractedText || '';
    let structuralNotes: string[] = JSON.parse(
      job.structuralMetadataJson || '[]'
    );

    if (!isStageAlreadyDone(job.lastCompletedStage, 'extracted')) {
      await updateEngineJobCheckpoint(jobUid, {
        state: 'Extracting',
        currentStageDetail: 'Extracting machine-readable text and structural metadata...',
      });

      const stagedUpload = ephemeralUploadBuffers.get(jobUid);
      if (stagedUpload) {
        try {
          const parsedDoc = await parseResumeBuffer(
            stagedUpload.buffer,
            stagedUpload.originalName
          );
          extractedText = parsedDoc.text;
          structuralNotes = parsedDoc.structuralNotes;
        } finally {
          // Security guarantee: immediately purge temporary upload buffer from memory
          ephemeralUploadBuffers.delete(jobUid);
        }
      } else if (!extractedText || extractedText.trim().length < 20) {
        throw new DocumentValidationError(
          'EMPTY_DOCUMENT',
          'Upload buffer expired or contained no readable text. Please re-upload your PDF or DOCX.'
        );
      }

      pushTaskLog(
        'extract_document',
        `Extracted ${extractedText.split(/\s+/).filter(Boolean).length} words cleanly`,
        'Extracting',
        0
      );

      job = await updateEngineJobCheckpoint(jobUid, {
        state: 'Extracting',
        currentStageDetail: 'Document extraction completed',
        extractedText,
        structuralMetadataJson: JSON.stringify(structuralNotes),
        completedTasks: taskLogs.length,
        taskLogsJson: JSON.stringify(taskLogs),
        lastCompletedStage: 'extracted',
      });
    } else {
      // Ensure buffer cleanup even on checkpoint resume
      ephemeralUploadBuffers.delete(jobUid);
    }

    // =========================================================================
    // MODE A: ATS AUDIT ONLY (Async 11-Category ATS Resume Checker)
    // =========================================================================
    if (job.mode === 'ats_audit_only') {
      await updateEngineJobCheckpoint(jobUid, {
        state: 'Analyzing',
        currentStageDetail: 'Running 11-category ATS compatibility audit...',
      });

      const report = await analyzeResumeWithGemini({
        resumeText: extractedText,
        fileName: job.fileName,
        structuralNotes,
        options: buildAiOptions(jobUid, 'baseline_analyzed', runConfig),
      });

      if (job.userUid) {
        await incrementUserScansAndSaveReport({
          uid: job.userUid,
          fileName: job.fileName,
          fileType: job.fileType,
          overallScore: Number(report.overallScore) || 0,
          reportJson: JSON.stringify(report),
        });
      }

      pushTaskLog(
        'ats_audit_complete',
        'Completed 11-category ATS diagnostic evaluation',
        'Analyzing',
        0
      );

      await updateEngineJobCheckpoint(jobUid, {
        state: 'Completed',
        currentStageDetail: 'ATS compatibility audit completed',
        completedTasks: 2,
        totalTasks: 2,
        initialScore: report.overallScore,
        currentScore: report.overallScore,
        atsAuditReportJson: JSON.stringify(report),
        taskLogsJson: JSON.stringify(taskLogs),
        lastCompletedStage: 'artifacts_generated',
      });
      jobRunConfigs.delete(jobUid);
      return;
    }

    // =========================================================================
    // MODE B: AUTONOMOUS SELF-IMPROVING RESUME ENGINE (Up to 3 Iterations)
    // =========================================================================
    const loadCurrentIterations = async (): Promise<EngineIterationRecord[]> => {
      const latest = await getRawEngineJobWithIterations(jobUid);
      if (!latest) return [];
      return latest.iterations.map((it) => ({
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
        createdAt: it.createdAt.toISOString(),
      }));
    };

    // STAGE 2: BASELINE ANALYZING (v0)
    if (!isStageAlreadyDone(job.lastCompletedStage, 'baseline_analyzed')) {
      await updateEngineJobCheckpoint(jobUid, {
        state: 'Analyzing',
        currentIteration: 0,
        currentStageDetail:
          'Baseline Analysis: Evaluating 10 quality dimensions & detecting structural/content issues...',
      });

      const baselineAi = await extractAndEvaluateBaselineWithGemini({
        rawText: extractedText,
        structuralNotes,
        options: buildAiOptions(jobUid, 'baseline_analyzed', runConfig),
      });

      const baselineQuality = combineQualityReport({
        candidateData: baselineAi.structuredResume,
        baselineData: baselineAi.structuredResume,
        baselineRawText: extractedText,
        structuralNotes,
        isBaseline: true,
        aiAreaScores: baselineAi.aiAreas,
        aiExecutiveSummary: baselineAi.executiveSummary,
        aiIssues: baselineAi.issues,
        previousIteration: null,
      });

      const baselineText = serializeResumeDataToText(baselineAi.structuredResume);

      await upsertEngineIterationRecord({
        jobUid,
        versionNumber: 0,
        iterationLabel: 'Baseline v0: Original Uploaded Resume',
        resumeData: baselineAi.structuredResume,
        resumeText: baselineText,
        qualityReport: baselineQuality,
        improvementsApplied: ['Extracted baseline factual structure'],
        overallScore: baselineQuality.overallScore,
        factualValidationPassed: true,
        selectionCompositeScore: baselineQuality.overallScore,
      });

      remainingIssues = baselineQuality.issues;
      pushTaskLog(
        'baseline_analyzed',
        `Baseline analysis complete (Initial Quality Score: ${baselineQuality.overallScore}/100, ${remainingIssues.length} issues identified)`,
        'Analyzing',
        0
      );

      if (job.userUid) {
        await incrementUserScansOnly(job.userUid);
      }

      job = await updateEngineJobCheckpoint(jobUid, {
        state: 'Analyzing',
        currentStageDetail: `Baseline complete (${baselineQuality.overallScore}/100)`,
        initialScore: baselineQuality.overallScore,
        previousScore: baselineQuality.overallScore,
        currentScore: baselineQuality.overallScore,
        remainingIssuesJson: JSON.stringify(remainingIssues),
        completedTasks: taskLogs.length,
        taskLogsJson: JSON.stringify(taskLogs),
        lastCompletedStage: 'baseline_analyzed',
      });
    }

    // Load stored iterations (including Baseline v0)
    let iterations = await loadCurrentIterations();
    const baselineIteration = iterations.find((it) => it.versionNumber === 0);
    if (!baselineIteration) {
      throw new Error('Baseline snapshot missing from checkpoint store.');
    }

    const maxIterations = Math.min(3, Math.max(1, job.maxIterations || 3));
    let stopReason: string | null = job.stopReason || null;

    // =========================================================================
    // STAGES 3..5: ITERATIVE FEEDBACK LOOP (Rounds 1 to maxIterations)
    // =========================================================================
    for (let round = 1; round <= maxIterations; round++) {
      const improveStageKey = `iter_${round}_improved`;
      const recheckStageKey = `iter_${round}_rechecked`;

      iterations = await loadCurrentIterations();
      const prevIter =
        iterations
          .filter((it) => it.versionNumber < round && it.factualValidationPassed)
          .sort((a, b) => b.versionNumber - a.versionNumber)[0] || baselineIteration;

      const prevUnresolved = prevIter.qualityReport.issues.filter((i) => !i.resolved);

      // Stop check BEFORE starting round if zero meaningful issues remain on baseline/prior round
      if (
        !isStageAlreadyDone(job.lastCompletedStage, improveStageKey) &&
        prevUnresolved.length === 0 &&
        prevIter.overallScore >= 88
      ) {
        stopReason = `Converged before Iteration ${round}: No meaningful unresolved issues remain (Score ${prevIter.overallScore}/100).`;
        break;
      }

      const roundTitle =
        round === 1
          ? 'Iteration 1: Content & Action-Verb Improvement'
          : round === 2
            ? 'Iteration 2: Keyword Alignment & Project Clarity'
            : 'Iteration 3: Final Polish & Consistency Refinement';

      // --- STEP A: IMPROVING ---
      let draftResume: ResumeDocumentData;
      let draftImprovements: string[];

      const existingRoundRecord = iterations.find((it) => it.versionNumber === round);

      if (!isStageAlreadyDone(job.lastCompletedStage, improveStageKey)) {
        await updateEngineJobCheckpoint(jobUid, {
          state: 'Improving',
          currentIteration: round,
          currentStageDetail: `${roundTitle} — Refining targeted sections while preserving factual data...`,
        });

        const improvedResult = await runIterativeImprovementWithGemini({
          iterationNumber: round,
          previousResume: prevIter.resumeData,
          previousExecutiveSummary: prevIter.qualityReport.executiveSummary,
          unresolvedIssues: prevUnresolved,
          options: buildAiOptions(jobUid, improveStageKey, runConfig),
        });

        draftResume = improvedResult.improvedResume;
        draftImprovements = improvedResult.improvementsApplied;

        // Save intermediate draft row immediately so if Rechecking fails, Improving is NOT repeated!
        await upsertEngineIterationRecord({
          jobUid,
          versionNumber: round,
          iterationLabel: roundTitle,
          resumeData: draftResume,
          resumeText: serializeResumeDataToText(draftResume),
          qualityReport: prevIter.qualityReport,
          improvementsApplied: draftImprovements,
          overallScore: prevIter.overallScore,
          factualValidationPassed: true,
          selectionCompositeScore: prevIter.selectionCompositeScore,
        });

        for (const imp of draftImprovements) {
          if (!completedImprovements.includes(imp)) {
            completedImprovements.push(imp);
          }
        }

        pushTaskLog(
          improveStageKey,
          `${roundTitle} generated (${draftImprovements.length} targeted improvement(s))`,
          'Improving',
          round
        );

        job = await updateEngineJobCheckpoint(jobUid, {
          state: 'Improving',
          currentIteration: round,
          currentStageDetail: `${roundTitle} draft saved`,
          completedImprovementsJson: JSON.stringify(completedImprovements),
          completedTasks: taskLogs.length,
          taskLogsJson: JSON.stringify(taskLogs),
          lastCompletedStage: improveStageKey,
        });
      } else {
        draftResume = existingRoundRecord?.resumeData || prevIter.resumeData;
        draftImprovements = existingRoundRecord?.improvementsApplied || [];
      }

      // --- STEP B: RECHECKING & INTELLIGENT FEEDBACK LOOP EVALUATION ---
      if (!isStageAlreadyDone(job.lastCompletedStage, recheckStageKey)) {
        await updateEngineJobCheckpoint(jobUid, {
          state: 'Rechecking',
          currentIteration: round,
          currentStageDetail: `Rechecking Iteration ${round}: Validating 10 quality areas & factual integrity...`,
        });

        const recheckAi = await evaluateCandidateIterationWithGemini({
          iterationNumber: round,
          candidateResume: draftResume,
          previousIssues: prevUnresolved,
          options: buildAiOptions(jobUid, recheckStageKey, runConfig),
        });

        const roundQuality = combineQualityReport({
          candidateData: draftResume,
          baselineData: baselineIteration.resumeData,
          baselineRawText: extractedText,
          structuralNotes,
          isBaseline: false,
          aiAreaScores: recheckAi.aiAreas,
          aiExecutiveSummary: recheckAi.executiveSummary,
          aiIssues: recheckAi.remainingIssues,
          previousIteration: prevIter,
        });

        await upsertEngineIterationRecord({
          jobUid,
          versionNumber: round,
          iterationLabel: roundTitle,
          resumeData: draftResume,
          resumeText: serializeResumeDataToText(draftResume),
          qualityReport: roundQuality,
          improvementsApplied: draftImprovements,
          overallScore: roundQuality.overallScore,
          factualValidationPassed: roundQuality.factualValidation.passed,
          selectionCompositeScore: roundQuality.factualValidation.passed
            ? roundQuality.overallScore
            : 0,
        });

        remainingIssues = roundQuality.issues.filter((i) => !i.resolved);

        pushTaskLog(
          recheckStageKey,
          `Rechecked Iteration ${round}: Score ${prevIter.overallScore} → ${roundQuality.overallScore}/100 (${
            roundQuality.factualValidation.passed ? 'Factual Check Passed' : 'Factual Violation Disqualified'
          })`,
          'Rechecking',
          round
        );

        job = await updateEngineJobCheckpoint(jobUid, {
          state: 'Rechecking',
          currentIteration: round,
          currentStageDetail: `Iteration ${round} verified (${roundQuality.overallScore}/100)`,
          previousScore: prevIter.overallScore,
          currentScore: roundQuality.overallScore,
          remainingIssuesJson: JSON.stringify(remainingIssues),
          completedTasks: taskLogs.length,
          taskLogsJson: JSON.stringify(taskLogs),
          lastCompletedStage: recheckStageKey,
        });

        // Intelligent Feedback Loop Stop Conditions:
        if (!roundQuality.factualValidation.passed) {
          stopReason = `Stopped after Iteration ${round}: Factual validation guard flagged unverified content; preserving last 100% verified version.`;
          break;
        }
        if (remainingIssues.length === 0) {
          stopReason = `Converged at Iteration ${round}: All actionable resume issues resolved.`;
          break;
        }
        if (roundQuality.overallScore <= prevIter.overallScore) {
          stopReason = `Stopped after Iteration ${round}: Quality score stabilized (${prevIter.overallScore} → ${roundQuality.overallScore}) with no further net gain.`;
          break;
        }
        if (round === maxIterations) {
          stopReason = `Completed all ${maxIterations} scheduled autonomous improvement rounds.`;
        }
      } else {
        // Already rechecked in a previous run before a later stage failed; check if loop had stopped
        const roundRec = existingRoundRecord;
        if (roundRec) {
          if (!roundRec.factualValidationPassed) {
            stopReason = `Stopped after Iteration ${round}: Factual validation guard triggered.`;
            break;
          }
          const unres = roundRec.qualityReport.issues.filter((i) => !i.resolved);
          if (unres.length === 0 || roundRec.overallScore <= prevIter.overallScore) {
            stopReason =
              job.stopReason ||
              `Converged at Iteration ${round} based on quality feedback metrics.`;
            break;
          }
        }
      }
    }

    // =========================================================================
    // STAGE 6: GENERATING PDF & BEST RESUME SELECTOR (Separated from AI calls)
    // =========================================================================
    const finalIterations = await loadCurrentIterations();
    const bestSelection = selectBestResumeVersion(finalIterations);
    const winningIteration =
      finalIterations.find(
        (it) => it.versionNumber === bestSelection.selectedVersionNumber
      ) || baselineIteration;

    // Align totalTasks with the actual number of executed stages + 1 final artifact stage
    const actualTotalTasks = taskLogs.length + 1;

    await updateEngineJobCheckpoint(jobUid, {
      state: 'Generating PDF',
      totalTasks: actualTotalTasks,
      currentStageDetail: `Selected ${winningIteration.iterationLabel} — Generating ATS-clean PDF & DOCX documents...`,
    });

    const [pdfBuf, docxBuf] = await Promise.all([
      generateServerPdfBuffer(winningIteration.resumeData, 'modern-tech'),
      generateServerDocxBuffer(winningIteration.resumeData, 'modern-tech'),
    ]);

    const artifactsMeta = {
      pdfReady: pdfBuf.length > 500,
      docxReady: docxBuf.length > 500,
      pdfSizeBytes: pdfBuf.length,
      docxSizeBytes: docxBuf.length,
    };

    pushTaskLog(
      'artifacts_generated',
      `Verified & prepared downloadable PDF (${Math.round(pdfBuf.length / 1024)} KB) and DOCX (${Math.round(docxBuf.length / 1024)} KB) for Best Version v${winningIteration.versionNumber}`,
      'Generating PDF',
      winningIteration.versionNumber
    );

    const previousComparisonScore =
      winningIteration.versionNumber > 0
        ? baselineIteration.overallScore
        : winningIteration.overallScore;

    await updateEngineJobCheckpoint(jobUid, {
      state: 'Completed',
      currentStageDetail: `Completed — Selected ${winningIteration.iterationLabel} (${winningIteration.overallScore}/100)`,
      completedTasks: taskLogs.length,
      totalTasks: taskLogs.length,
      previousScore: previousComparisonScore,
      currentScore: winningIteration.overallScore,
      selectedVersionNumber: winningIteration.versionNumber,
      stopReason:
        stopReason || `Completed ${finalIterations.length - 1} autonomous improvement round(s).`,
      finalResumeJson: JSON.stringify(winningIteration.resumeData),
      bestSelectionJson: JSON.stringify(bestSelection),
      remainingIssuesJson: JSON.stringify(
        winningIteration.qualityReport.issues.filter((i) => !i.resolved)
      ),
      artifactsMetaJson: JSON.stringify(artifactsMeta),
      taskLogsJson: JSON.stringify(taskLogs),
      lastCompletedStage: 'artifacts_generated',
      errorCode: null,
      errorMessage: null,
    });

    jobRunConfigs.delete(jobUid);
  } catch (err: any) {
    ephemeralUploadBuffers.delete(jobUid);
    const errorCode =
      err instanceof DocumentValidationError
        ? err.code
        : String(err?.message || '').includes('AI_STAGE_TIMEOUT') ||
            Number(err?.status) === 504
          ? 'STAGE_TIMEOUT'
          : 'PROCESSING_ERROR';

    const safeMessage =
      err instanceof DocumentValidationError
        ? err.message
        : String(err?.message || 'A processing stage encountered an error.').slice(
            0,
            320
          );

    // Anonymized status note — NEVER log resume contents or personal info
    console.info(
      `[ResumiqEngine] Job ${jobUid} saved at checkpoint (code=${errorCode}, lastCompletedStage=${job.lastCompletedStage})`
    );

    await updateEngineJobCheckpoint(jobUid, {
      state: 'Failed',
      currentStageDetail: `Paused at stage after ${job.lastCompletedStage || 'upload'} — Ready to resume without restarting`,
      errorCode,
      errorMessage: safeMessage,
      taskLogsJson: JSON.stringify(taskLogs),
    });
  }
}
