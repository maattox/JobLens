import { callCompatibilityAi, callFollowUpAi, callAiProvider } from "./ai/client";
import {
  ensureModelCatalog,
  getModelsForProvider,
  refreshProviderCatalog,
  syncProviderCatalog,
  clearModelCatalogNotice,
} from "./ai/catalog";
import { AiRequestError } from "./ai/errors";
import { isSessionExpiredError } from "./ai/types";
import { collectRuntimeSnapshot } from "./debugSnapshot";
import { getTabPageUrl, resolveJobTab, sendTabMessage } from "./tabUtils";
import {
  appendDebugEntry,
  bindDebugAppender,
  clearDebugBuffer,
  configureDebugLogger,
  debugError,
  debugInfo,
  debugWarn,
  ensureDebugReady,
  getDebugEntries,
  isDebugTelemetryEnabled,
  summarizeError,
} from "../shared/debug";
import { MSG } from "../shared/messages";
import {
  buildCompatibilityPrompt,
  buildFollowUpRebuildPrompt,
  buildJobFieldsExtractPrompt,
  buildResumeExtractPrompt,
} from "../shared/prompt";
import { runPreCheck } from "../shared/precheck";
import { applyJobFieldCorrections } from "../shared/jobCorrections";
import {
  applyJobFieldsToJob,
  jobFieldsFromJob,
  mergeScrapedAndAiFields,
} from "../shared/fieldCompare";
import {
  extractJsonFromText,
  parseCompatibilityReport,
  parseJobFieldsExtractResult,
  parseResumeExtractResult,
} from "../shared/schema";
import {
  migrateCheckHistory,
  migratePreferences,
  migrateProfile,
  migrateAiSettings,
} from "../shared/migration";
import { STORAGE_KEYS } from "../shared/storage";
import {
  normalizeFieldExtractModels,
  pickFieldExtractModel,
  type FieldExtractModelMap,
} from "../shared/fieldExtractModels";
import type {
  AiConversationContext,
  AiSettings,
  CheckHistoryItem,
  CompatibilityCheckResponse,
  CompatibilityReport,
  FollowUpEntry,
  JobFieldsExtractResult,
  JobObject,
  JobSource,
  ModelCatalogSyncResult,
  ResumeExtractResult,
  ScrapeResponse,
  ScrapedJobMemory,
  UserPreferences,
  UserProfile,
} from "../shared/types";
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_PREFERENCES,
  DEFAULT_PROFILE,
} from "../shared/types";
import {
  findCachedHistoryItem,
  findHistoryItemByListingUrl,
  getJobKey,
} from "../shared/utils";

if (isDebugTelemetryEnabled()) {
  configureDebugLogger({ messageType: MSG.DEBUG_LOG });
  bindDebugAppender(appendDebugEntry);
  void ensureDebugReady().then(() => {
    debugInfo("background", "lifecycle", "Service worker started");
  });

  self.addEventListener("error", (event) => {
    debugError("background", "uncaught", event.message || "Uncaught error", {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
  self.addEventListener("unhandledrejection", (event) => {
    debugError(
      "background",
      "unhandledrejection",
      "Unhandled promise rejection",
      summarizeError(event.reason)
    );
  });
}

void ensureModelCatalog();

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function createFollowUpId(): string {
  return `fu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function getFromStorage<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T) ?? fallback;
}

async function extractJobFromTab(tab: chrome.tabs.Tab): Promise<JobObject> {
  debugInfo("background", "extract", "Requesting job extraction from tab", {
    tabId: tab.id,
    url: tab.url,
  });

  const response: ScrapeResponse = await sendTabMessage(tab.id!, {
    type: MSG.EXTRACT_JOB,
  });

  if (!response?.success || !response.data) {
    const error =
      response?.error ||
      "Failed to extract job listing. Refresh the page and try again.";
    debugError("background", "extract", "Job extraction failed", { error });
    throw new Error(error);
  }

  debugInfo("background", "extract", "Job extraction succeeded", {
    title: response.data.title,
    source: response.data.source,
    isSupported: response.data.isSupported,
    sectionCount: response.data.sections.length,
    plainTextLength: response.data.plainText.length,
  });

  return response.data;
}

function createReportId(): string {
  return `rpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function snapshotExtractedJob(job: JobObject) {
  return {
    title: job.title,
    company: job.company,
    location: job.location,
    salary: job.salary,
    workMode: job.workMode,
    employmentType: job.employmentType,
    source: job.source,
    isSupported: job.isSupported,
  };
}

async function runAiCompatibilityCheck(
  profile: UserProfile,
  preferences: UserPreferences,
  aiSettings: AiSettings,
  job: JobObject
): Promise<{
  report: CompatibilityReport;
  conversation?: AiConversationContext;
  job: JobObject;
  extractedJob: JobObject;
}> {
  const extractedJob = { ...job };
  const prompt = buildCompatibilityPrompt(profile, preferences, job);
  const startedAt = Date.now();
  debugInfo("background", "ai", "Starting compatibility AI call", {
    provider: aiSettings.provider,
    model: aiSettings.model,
    promptLength: prompt.length,
    jobTitle: job.title,
    jobSource: job.source,
  });

  let aiResult;
  try {
    aiResult = await callCompatibilityAi(aiSettings, prompt);
  } catch (error) {
    debugError("background", "ai", "Compatibility AI call failed", {
      ...summarizeError(error),
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }

  debugInfo("background", "ai", "Compatibility AI call completed", {
    durationMs: Date.now() - startedAt,
    responseLength: aiResult.text.length,
    hasConversation: Boolean(aiResult.conversation),
  });

  const json = extractJsonFromText(aiResult.text);
  const parsed = parseCompatibilityReport(json);

  const { job: correctedJob, applied } = applyJobFieldCorrections(
    job,
    parsed.jobFieldCorrections
  );

  const reportId = createReportId();
  const report: CompatibilityReport = {
    ...parsed,
    reportId,
    actionableAdvice: parsed.actionableAdvice ?? [],
    checkedAt: new Date().toISOString(),
    cached: false,
    debug: {
      extractedJob: snapshotExtractedJob(extractedJob),
      appliedFieldCorrections: applied
        ? {
            fields: applied.fields,
            before: applied.before as Record<string, string>,
            after: applied.after as Record<string, string>,
          }
        : undefined,
      extractionSupported: extractedJob.isSupported,
      reliabilityWarning: extractedJob.reliabilityWarning,
    },
  };

  debugInfo("background", "ai", "Compatibility report parsed", {
    reportId,
    overallScore: report.overallScore,
    correctedFields: applied?.fields ?? [],
  });

  return {
    report,
    conversation: aiResult.conversation,
    job: correctedJob,
    extractedJob,
  };
}

async function getCachedCheck(key: string): Promise<CheckHistoryItem | null> {
  const history = await getFromStorage<CheckHistoryItem[]>(
    STORAGE_KEYS.checkHistory,
    []
  );
  return history.find((item) => item.key === key) ?? null;
}

function toCachedCheckResponse(item: CheckHistoryItem): CompatibilityCheckResponse {
  return {
    success: true,
    report: { ...item.report, cached: true },
    job: item.job,
    isCached: true,
    reportViewSource: "liveCache",
    followUps: item.followUps ?? [],
    aiConversation: item.aiConversation,
    historyKey: item.key,
  };
}

/**
 * Restore a saved report for the active tab without an AI call.
 * Identical tab addresses match from history alone. A local extract runs
 * only when the address differs, so a stable job number can still match.
 */
async function lookupCachedReport(
  tabId?: number
): Promise<CompatibilityCheckResponse> {
  const history = migrateCheckHistory(
    await getFromStorage<unknown>(STORAGE_KEYS.checkHistory, [])
  );
  if (!history.length || typeof tabId !== "number") {
    return { success: true };
  }

  let tab: chrome.tabs.Tab;
  try {
    tab = await resolveJobTab(tabId);
  } catch (error) {
    debugInfo(
      "background",
      "check",
      "Saved report lookup skipped",
      summarizeError(error)
    );
    return { success: true };
  }

  const byUrl = findHistoryItemByListingUrl(getTabPageUrl(tab) ?? "", history);
  if (byUrl) {
    debugInfo("background", "check", "Restoring saved report from tab URL", {
      key: byUrl.key,
    });
    return toCachedCheckResponse(byUrl);
  }

  try {
    const job = await extractJobFromTab(tab);
    const match = findCachedHistoryItem(job, history);
    if (!match) return { success: true };
    debugInfo("background", "check", "Restoring saved report from extracted job", {
      key: match.key,
    });
    return toCachedCheckResponse(match);
  } catch (error) {
    debugInfo(
      "background",
      "check",
      "Saved report extract lookup skipped",
      summarizeError(error)
    );
    return { success: true };
  }
}

async function saveCheckToHistory(
  job: JobObject,
  report: CompatibilityReport,
  conversation?: AiConversationContext,
  extractedJob?: JobObject
) {
  const history = await getFromStorage<CheckHistoryItem[]>(
    STORAGE_KEYS.checkHistory,
    []
  );
  const key = getJobKey(job);
  const existing = history.find((entry) => entry.key === key);
  const item: CheckHistoryItem = {
    key,
    reportId: report.reportId,
    jobNumber: job.jobNumber,
    title: job.title,
    salary: job.salary,
    company: job.company,
    location: job.location,
    url: job.url,
    source: job.source,
    report,
    job,
    extractedJob: extractedJob ?? existing?.extractedJob,
    followUps: existing?.followUps ?? [],
    aiConversation: conversation ?? existing?.aiConversation,
  };

  const next = [item, ...history.filter((entry) => entry.key !== key)].slice(
    0,
    200
  );
  await chrome.storage.local.set({ [STORAGE_KEYS.checkHistory]: next });
}

async function updateHistoryItem(item: CheckHistoryItem) {
  const history = await getFromStorage<CheckHistoryItem[]>(
    STORAGE_KEYS.checkHistory,
    []
  );
  const next = history.map((entry) => (entry.key === item.key ? item : entry));
  await chrome.storage.local.set({ [STORAGE_KEYS.checkHistory]: next });
}

async function rememberScrape(job: JobObject) {
  const scrapedJobs = await getFromStorage<ScrapedJobMemory[]>(
    STORAGE_KEYS.scrapedJobs,
    []
  );
  const key = getJobKey(job);
  const exists = scrapedJobs.some((entry) => entry.key === key);

  if (!exists) {
    scrapedJobs.push({
      key,
      jobNumber: job.jobNumber,
      title: job.title,
      salary: job.salary,
      company: job.company,
      scrapedAt: new Date().toISOString(),
    });
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.lastScraped]: job,
    [STORAGE_KEYS.scrapedJobs]: scrapedJobs,
  });
}

async function runResumeExtract(
  aiSettings: AiSettings,
  resumeText: string
): Promise<ResumeExtractResult> {
  const prompt = buildResumeExtractPrompt(resumeText);
  const rawText = await callAiProvider(aiSettings, prompt);
  const json = extractJsonFromText(rawText);
  return parseResumeExtractResult(json);
}

function usesHybridFieldVerification(source: JobSource): boolean {
  return source === "ziprecruiter" || source === "linkedin";
}

/** Prefer a cheaper/faster lite model for the metadata extract pass. */
async function resolveFieldExtractSettings(
  settings: AiSettings
): Promise<AiSettings> {
  await ensureModelCatalog();
  const stored = await chrome.storage.local.get(STORAGE_KEYS.fieldExtractModels);
  const preferences = normalizeFieldExtractModels(
    stored[STORAGE_KEYS.fieldExtractModels]
  );
  const catalog = await getModelsForProvider(settings.provider);
  const preferred = preferences[settings.provider];
  let model = pickFieldExtractModel(settings.provider, catalog, { preferred });

  if (!model || (preferred && !catalog.includes(preferred))) {
    // Preferred lite missing from local catalog — refresh from the API once.
    try {
      const refreshed = await refreshProviderCatalog(
        settings.provider,
        settings.apiKey
      );
      model = pickFieldExtractModel(settings.provider, refreshed, {
        preferred,
        exclude: preferred && !refreshed.includes(preferred) ? preferred : undefined,
      });
      if (model && model !== preferred) {
        await persistFieldExtractModel(settings.provider, model, preferences);
      }
    } catch {
      model = pickFieldExtractModel(settings.provider, catalog, { preferred });
    }
  }

  if (!model) {
    return settings;
  }

  return { ...settings, model };
}

async function persistFieldExtractModel(
  provider: AiSettings["provider"],
  model: string,
  current?: FieldExtractModelMap
): Promise<void> {
  const base =
    current ??
    normalizeFieldExtractModels(
      (await chrome.storage.local.get(STORAGE_KEYS.fieldExtractModels))[
        STORAGE_KEYS.fieldExtractModels
      ]
    );
  const next = { ...base, [provider]: model };
  await chrome.storage.local.set({ [STORAGE_KEYS.fieldExtractModels]: next });
}

async function runAiJobFieldsExtract(
  aiSettings: AiSettings,
  job: JobObject
): Promise<JobFieldsExtractResult> {
  const pageText = (job.plainText || job.rawText || "").trim();
  if (!pageText) {
    return {
      title: "",
      company: "",
      location: "",
      salary: "",
      workMode: "",
      employmentType: "",
    };
  }

  const prompt = buildJobFieldsExtractPrompt(pageText, job.source);
  const startedAt = Date.now();

  async function parseExtract(rawText: string): Promise<JobFieldsExtractResult> {
    const parsed = parseJobFieldsExtractResult(extractJsonFromText(rawText));
    return {
      title: parsed.title || "",
      company: parsed.company || "",
      location: parsed.location || "",
      salary: parsed.salary || "",
      workMode: parsed.workMode || "",
      employmentType: parsed.employmentType || "",
    };
  }

  let extractSettings = await resolveFieldExtractSettings(aiSettings);
  debugInfo("background", "fieldExtract", "Starting AI job-field extract", {
    source: job.source,
    model: extractSettings.model,
    pageTextLength: pageText.length,
  });

  try {
    const rawText = await callAiProvider(extractSettings, prompt, {
      persistModelReplacement: false,
      recoverOnModelNotFound: false,
    });
    const parsed = await parseExtract(rawText);
    debugInfo("background", "fieldExtract", "AI job-field extract complete", {
      durationMs: Date.now() - startedAt,
      title: parsed.title,
      company: parsed.company,
    });
    return parsed;
  } catch (error) {
    if (error instanceof AiRequestError && error.kind === "model_not_found") {
      debugWarn(
        "background",
        "fieldExtract",
        "Lite model unavailable; refreshing catalog",
        {
          failedModel: extractSettings.model,
          provider: aiSettings.provider,
        }
      );

      let refreshed: string[] = [];
      try {
        refreshed = await refreshProviderCatalog(
          aiSettings.provider,
          aiSettings.apiKey
        );
      } catch {
        // Fall through to user model below.
      }

      const nextLite = pickFieldExtractModel(aiSettings.provider, refreshed, {
        exclude: extractSettings.model,
      });

      if (nextLite && nextLite !== extractSettings.model) {
        await persistFieldExtractModel(aiSettings.provider, nextLite);
        extractSettings = { ...aiSettings, model: nextLite };
        debugInfo(
          "background",
          "fieldExtract",
          "Retrying field extract with updated lite model",
          { model: nextLite }
        );
        try {
          const rawText = await callAiProvider(extractSettings, prompt, {
            persistModelReplacement: false,
            recoverOnModelNotFound: false,
          });
          const parsed = await parseExtract(rawText);
          debugInfo(
            "background",
            "fieldExtract",
            "AI job-field extract complete",
            {
              durationMs: Date.now() - startedAt,
              title: parsed.title,
              company: parsed.company,
              recoveredModel: nextLite,
            }
          );
          return parsed;
        } catch (retryError) {
          debugWarn(
            "background",
            "fieldExtract",
            "Updated lite model failed; falling back to user model",
            summarizeError(retryError)
          );
        }
      }

      if (aiSettings.model !== extractSettings.model) {
        debugInfo(
          "background",
          "fieldExtract",
          "Falling back to user-selected model for field extract",
          { model: aiSettings.model }
        );
        try {
          const rawText = await callAiProvider(aiSettings, prompt, {
            persistModelReplacement: false,
          });
          const parsed = await parseExtract(rawText);
          debugInfo(
            "background",
            "fieldExtract",
            "AI job-field extract complete",
            {
              durationMs: Date.now() - startedAt,
              title: parsed.title,
              company: parsed.company,
              usedUserModel: true,
            }
          );
          return parsed;
        } catch (fallbackError) {
          debugError(
            "background",
            "fieldExtract",
            "AI job-field extract failed",
            {
              ...summarizeError(fallbackError),
              durationMs: Date.now() - startedAt,
            }
          );
          throw fallbackError;
        }
      }
    }

    debugError("background", "fieldExtract", "AI job-field extract failed", {
      ...summarizeError(error),
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

async function handleCompatibilityCheck(
  tabId?: number,
  forceRecheck = false,
  options?: {
    skipFieldVerification?: boolean;
    verifiedFields?: JobFieldsExtractResult;
  }
): Promise<CompatibilityCheckResponse> {
  debugInfo("background", "check", "Compatibility check started", {
    tabId,
    forceRecheck,
    skipFieldVerification: Boolean(options?.skipFieldVerification),
    hasVerifiedFields: Boolean(options?.verifiedFields),
  });

  const [profile, preferences, storedAi] = await Promise.all([
    migrateProfile(
      await getFromStorage<unknown>(STORAGE_KEYS.profile, DEFAULT_PROFILE)
    ),
    migratePreferences(
      await getFromStorage<unknown>(STORAGE_KEYS.preferences, DEFAULT_PREFERENCES)
    ),
    getFromStorage<unknown>(STORAGE_KEYS.aiSettings, DEFAULT_AI_SETTINGS),
  ]);
  let aiSettings = migrateAiSettings(storedAi);
  if (
    typeof storedAi === "object" &&
    storedAi !== null &&
    ((storedAi as AiSettings).model !== aiSettings.model ||
      (storedAi as AiSettings).provider !== aiSettings.provider)
  ) {
    await chrome.storage.local.set({ [STORAGE_KEYS.aiSettings]: aiSettings });
  }

  if (!profile.setupComplete) {
    debugWarn("background", "check", "Blocked: profile incomplete");
    return { success: false, error: "Complete your profile in Setup first." };
  }

  if (!preferences.setupComplete) {
    debugWarn("background", "check", "Blocked: preferences incomplete");
    return { success: false, error: "Save your job preferences first." };
  }

  if (!aiSettings.apiKey.trim()) {
    debugWarn("background", "check", "Blocked: missing API key");
    return { success: false, error: "MISSING_API_KEY" };
  }

  try {
    const sync = await syncProviderCatalog(aiSettings.provider, aiSettings.apiKey, {
      force: false,
    });
    if (sync.modelSwitched) {
      aiSettings.model = sync.currentModel;
    }
    debugInfo("background", "check", "Model catalog sync before check", {
      provider: sync.provider,
      changed: sync.changed,
      modelSwitched: sync.modelSwitched,
      refreshed: sync.refreshed,
      model: aiSettings.model,
    });
  } catch (error) {
    debugWarn(
      "background",
      "check",
      "Model catalog sync failed; continuing with cached models",
      summarizeError(error)
    );
  }

  let job = await extractJobFromTab(await resolveJobTab(tabId));

  if (options?.verifiedFields) {
    job = applyJobFieldsToJob(job, options.verifiedFields);
    debugInfo("background", "check", "Applied user-verified job fields", {
      title: job.title,
      company: job.company,
      workMode: job.workMode,
    });
  } else if (
    usesHybridFieldVerification(job.source) &&
    !options?.skipFieldVerification
  ) {
    const scrapedFields = jobFieldsFromJob(job);
    const aiFields = await runAiJobFieldsExtract(aiSettings, job);
    const { merged, conflicts } = mergeScrapedAndAiFields(scrapedFields, aiFields);

    if (conflicts.length > 0) {
      debugWarn("background", "check", "Field verification required", {
        source: job.source,
        conflictFields: conflicts.map((c) => c.field),
      });
      const pendingJob = applyJobFieldsToJob(job, merged);
      await rememberScrape(pendingJob);
      return {
        success: true,
        needsFieldVerification: true,
        job: pendingJob,
        scrapedFields,
        aiFields,
        fieldConflicts: conflicts,
        reportViewSource: "fresh",
      };
    }

    job = applyJobFieldsToJob(job, merged);
    debugInfo("background", "check", "Scraped and AI fields agreed (or auto-merged)", {
      source: job.source,
    });
  }

  await rememberScrape(job);

  const key = getJobKey(job);
  if (!forceRecheck) {
    const cached = await getCachedCheck(key);
    if (cached) {
      debugInfo("background", "check", "Returning cached compatibility report", {
        key,
        reportId: cached.reportId ?? cached.report?.reportId,
      });
      return toCachedCheckResponse(cached);
    }
  }

  const preCheck = runPreCheck(job, preferences);
  debugInfo("background", "precheck", "Pre-check finished", {
    passed: preCheck.passed,
    hardMismatch: preCheck.hardMismatch,
    reasons: preCheck.reasons,
  });

  if (preCheck.hardMismatch && !forceRecheck) {
    debugWarn("background", "check", "Hard mismatch; skipping AI", {
      reasons: preCheck.reasons,
    });
    return {
      success: true,
      job,
      preCheck,
      skippedAi: true,
      reportViewSource: "fresh",
    };
  }

  const {
    report,
    conversation,
    job: correctedJob,
    extractedJob,
  } = await runAiCompatibilityCheck(
    profile,
    preferences,
    aiSettings,
    job
  );
  await saveCheckToHistory(correctedJob, report, conversation, extractedJob);

  debugInfo("background", "check", "Compatibility check complete", {
    reportId: report.reportId,
    overallScore: report.overallScore,
    historyKey: key,
  });

  return {
    success: true,
    report,
    job: correctedJob,
    preCheck,
    skippedAi: false,
    reportViewSource: "fresh",
    followUps: [],
    aiConversation: conversation,
    historyKey: key,
  };
}

async function handleFollowUpQuestion(
  historyKey: string,
  question: string
): Promise<{
  success: boolean;
  answer?: string;
  followUps?: FollowUpEntry[];
  aiConversation?: AiConversationContext;
  job?: JobObject;
  error?: string;
}> {
  const trimmed = question.trim();
  debugInfo("background", "followUp", "Follow-up question received", {
    historyKey,
    questionLength: trimmed.length,
  });

  if (!trimmed) {
    return { success: false, error: "Enter a question first." };
  }

  const [profile, preferences, storedAi, history] = await Promise.all([
    migrateProfile(
      await getFromStorage<unknown>(STORAGE_KEYS.profile, DEFAULT_PROFILE)
    ),
    migratePreferences(
      await getFromStorage<unknown>(STORAGE_KEYS.preferences, DEFAULT_PREFERENCES)
    ),
    getFromStorage<unknown>(STORAGE_KEYS.aiSettings, DEFAULT_AI_SETTINGS),
    getFromStorage<CheckHistoryItem[]>(STORAGE_KEYS.checkHistory, []),
  ]);

  const aiSettings = migrateAiSettings(storedAi);
  if (!aiSettings.apiKey.trim()) {
    return { success: false, error: "MISSING_API_KEY" };
  }

  const item = history.find((entry) => entry.key === historyKey);
  if (!item) {
    debugWarn("background", "followUp", "History item not found", { historyKey });
    return { success: false, error: "Compatibility report not found in history." };
  }

  const priorFollowUps = item.followUps ?? [];
  const rebuildPrompt = buildFollowUpRebuildPrompt(
    profile,
    preferences,
    item.job,
    priorFollowUps,
    trimmed
  );

  let conversation = item.aiConversation;
  let answer = "";

  const attemptFollowUp = async (useRebuild: boolean) =>
    callFollowUpAi(aiSettings, {
      mode: "followUp",
      question: trimmed,
      conversation: useRebuild ? undefined : conversation,
      rebuildPrompt: useRebuild ? rebuildPrompt : undefined,
    });

  try {
    const result = await attemptFollowUp(false);
    answer = result.text.trim();
    conversation = result.conversation ?? conversation;
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number((error as { status?: number }).status) : 0;
    const body = error instanceof Error && "body" in error ? String((error as { body?: string }).body || "") : "";
    if (isSessionExpiredError(aiSettings.provider, status, body)) {
      debugWarn("background", "followUp", "Session expired; rebuilding conversation", {
        provider: aiSettings.provider,
        status,
      });
      const rebuilt = await attemptFollowUp(true);
      answer = rebuilt.text.trim();
      conversation = rebuilt.conversation;
    } else {
      debugError("background", "followUp", "Follow-up AI failed", summarizeError(error));
      throw error;
    }
  }

  const entry: FollowUpEntry = {
    id: createFollowUpId(),
    question: trimmed,
    answer,
    askedAt: new Date().toISOString(),
  };

  const nextFollowUps = [...priorFollowUps, entry];
  const updatedItem: CheckHistoryItem = {
    ...item,
    followUps: nextFollowUps,
    aiConversation: conversation,
  };
  await updateHistoryItem(updatedItem);

  debugInfo("background", "followUp", "Follow-up saved", {
    historyKey,
    followUpId: entry.id,
    answerLength: answer.length,
  });

  return {
    success: true,
    answer,
    followUps: nextFollowUps,
    aiConversation: conversation,
    job: updatedItem.job,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isDebugTelemetryEnabled() && message?.type === MSG.DEBUG_LOG) {
    if (message.entry && typeof message.entry === "object") {
      appendDebugEntry(message.entry);
    }
    sendResponse({ success: true });
    return false;
  }

  if (isDebugTelemetryEnabled() && message?.type === MSG.DEBUG_CLEAR) {
    clearDebugBuffer();
    debugInfo("background", "debug", "Telemetry buffer cleared");
    sendResponse({ success: true });
    return false;
  }

  if (isDebugTelemetryEnabled() && message?.type === MSG.DEBUG_GET_REPORT_CONTEXT) {
    void (async () => {
      await ensureDebugReady();
      const { environment, state } = await collectRuntimeSnapshot();
      sendResponse({
        success: true,
        telemetry: getDebugEntries(),
        environment,
        state,
      });
    })().catch((error) => {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Failed to build debug context.",
      });
    });
    return true;
  }

  (async () => {
    if (message?.type === MSG.SYNC_MODEL_CATALOG) {
      const storedAi = await getFromStorage<unknown>(
        STORAGE_KEYS.aiSettings,
        DEFAULT_AI_SETTINGS
      );
      const aiSettings = migrateAiSettings(storedAi);
      const provider =
        message.provider === "openai" ||
        message.provider === "anthropic" ||
        message.provider === "gemini"
          ? message.provider
          : aiSettings.provider;
      const apiKey =
        typeof message.apiKey === "string" && message.apiKey.trim()
          ? message.apiKey.trim()
          : aiSettings.apiKey;

      if (!apiKey.trim()) {
        sendResponse({
          success: false,
          error: "MISSING_API_KEY",
        } satisfies { success: false; error: string });
        return;
      }

      try {
        const result: ModelCatalogSyncResult = await syncProviderCatalog(
          provider,
          apiKey,
          { force: Boolean(message.force) }
        );
        sendResponse({ success: true, result });
      } catch (error) {
        sendResponse({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not refresh available AI models.",
        });
      }
      return;
    }

    if (message?.type === MSG.CLEAR_MODEL_CATALOG_NOTICE) {
      await clearModelCatalogNotice();
      sendResponse({ success: true });
      return;
    }

    if (message?.type === MSG.LOOKUP_CACHED_REPORT) {
      const tabId =
        typeof message.tabId === "number" ? message.tabId : undefined;
      const result = await lookupCachedReport(tabId);
      sendResponse(result);
      return;
    }

    if (message?.type === MSG.RUN_COMPATIBILITY_CHECK) {
      const tabId =
        typeof message.tabId === "number" ? message.tabId : undefined;

      const verifiedFields =
        message.verifiedFields && typeof message.verifiedFields === "object"
          ? (message.verifiedFields as JobFieldsExtractResult)
          : undefined;

      const result = await handleCompatibilityCheck(
        tabId,
        Boolean(message.forceRecheck),
        {
          skipFieldVerification: Boolean(message.skipFieldVerification),
          verifiedFields,
        }
      );
      sendResponse(result);
      return;
    }

    if (message?.type === MSG.ASK_FOLLOW_UP) {
      const result = await handleFollowUpQuestion(
        asString(message.historyKey),
        asString(message.question)
      );
      sendResponse(result);
      return;
    }

    if (message?.type === MSG.EXTRACT_FROM_RESUME) {
      debugInfo("background", "resume", "Resume extract requested", {
        resumeTextLength: asString(message.resumeText).length,
      });
      const storedAi = await getFromStorage<unknown>(
        STORAGE_KEYS.aiSettings,
        DEFAULT_AI_SETTINGS
      );
      const aiSettings = migrateAiSettings(storedAi);

      if (!aiSettings.apiKey.trim()) {
        sendResponse({ success: false, error: "MISSING_API_KEY" });
        return;
      }

      const resumeText = asString(message.resumeText);
      if (!resumeText.trim()) {
        sendResponse({ success: false, error: "Resume text is empty." });
        return;
      }

      try {
        const data = await runResumeExtract(aiSettings, resumeText);
        debugInfo("background", "resume", "Resume extract succeeded", {
          workExperienceCount: data.profile.workExperience.length,
          educationCount: data.profile.education.length,
        });
        sendResponse({ success: true, data });
      } catch (error) {
        debugError("background", "resume", "Resume extract failed", summarizeError(error));
        throw error;
      }
      return;
    }

    if (message?.type === MSG.SCRAPE_JOB) {
      const tabId =
        typeof message.tabId === "number" ? message.tabId : undefined;
      const tab = await resolveJobTab(tabId);
      const job = await extractJobFromTab(tab);
      const scrapedJobs = await getFromStorage<ScrapedJobMemory[]>(
        STORAGE_KEYS.scrapedJobs,
        []
      );
      const key = getJobKey(job);
      const isDuplicate = scrapedJobs.some((entry) => entry.key === key);
      await rememberScrape(job);

      sendResponse({ success: true, data: job, isDuplicate });
    }
  })().catch((error) => {
    debugError("background", "message", "Message handler failed", {
      type: message?.type,
      ...summarizeError(error),
    });
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error.",
    });
  });

  return true;
});
