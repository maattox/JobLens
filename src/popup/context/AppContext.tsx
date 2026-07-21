import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  configureDebugLogger,
  debugError,
  debugInfo,
  isDebugTelemetryEnabled,
  summarizeError,
} from "../../shared/debug";
import { MSG } from "../../shared/messages";
import {
  migrateCheckHistory,
  migrateJobObject,
  migratePreferences,
  migrateProfile,
  migrateAiSettings,
} from "../../shared/migration";
import { normalizeModelCatalog } from "../../shared/modelCatalog";
import type { ShellMode } from "../../shared/shell";
import { STORAGE_KEYS } from "../../shared/storage";
import type {
  AiSettings,
  CheckHistoryItem,
  CompatibilityCheckResponse,
  FieldVerificationState,
  HistorySortOption,
  JobFieldsExtractResult,
  JobObject,
  ModelCatalog,
  ResumeExtractResult,
  UserPreferences,
  UserProfile,
} from "../../shared/types";
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_PREFERENCES,
  DEFAULT_PROFILE,
} from "../../shared/types";
import { openExtensionPage, getJobKey } from "../../shared/utils";

if (isDebugTelemetryEnabled()) {
  configureDebugLogger({ messageType: MSG.DEBUG_LOG });
}
export type ViewName =
  | "apiKeySetup"
  | "home"
  | "profile"
  | "preferences"
  | "settings"
  | "history"
  | "result"
  | "setup"
  | "fieldVerification";

interface AppContextValue {
  shellMode: ShellMode;
  view: ViewName;
  setView: (view: ViewName) => void;
  profile: UserProfile;
  preferences: UserPreferences;
  aiSettings: AiSettings;
  modelCatalog: ModelCatalog;
  lastScraped: JobObject | null;
  checkHistory: CheckHistoryItem[];
  latestCheck: CompatibilityCheckResponse | null;
  fieldVerification: FieldVerificationState | null;
  status: string;
  statusType: "" | "success" | "error";
  loading: boolean;
  followUpLoading: boolean;
  checkPhase: string;
  privacyAcknowledged: boolean;
  onboardingComplete: boolean;
  saveProfile: (profile: UserProfile) => Promise<void>;
  savePreferences: (preferences: UserPreferences) => Promise<void>;
  saveAiSettings: (settings: AiSettings) => Promise<void>;
  acknowledgePrivacy: () => Promise<void>;
  completeApiKeySetup: () => void;
  completeOnboarding: () => Promise<void>;
  setStatus: (message: string, type?: "" | "success" | "error") => void;
  runCompatibilityCheck: (forceRecheck?: boolean) => Promise<void>;
  continueCompatibilityCheck: (
    verifiedFields: JobFieldsExtractResult
  ) => Promise<void>;
  clearFieldVerification: () => void;
  extractFromResume: (resumeText: string) => Promise<ResumeExtractResult>;
  openDedicatedTab: () => void;
  openHistoryItem: (item: CheckHistoryItem) => void;
  askFollowUp: (question: string) => Promise<void>;
  historySort: HistorySortOption;
  setHistorySort: (sort: HistorySortOption) => Promise<void>;
  refreshHistory: () => Promise<void>;
  deleteHistoryItem: (key: string) => Promise<void>;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function resolveInitialView(
  shellMode: ShellMode,
  hasApiKey: boolean,
  onboardingComplete: boolean
): ViewName {
  if (!hasApiKey) return "apiKeySetup";
  if (!onboardingComplete && shellMode !== "tab") return "setup";
  return shellMode === "tab" ? "profile" : "home";
}

export function AppProvider({
  children,
  shellMode = "popup",
}: {
  children: ReactNode;
  shellMode?: ShellMode;
}) {
  const [view, setViewState] = useState<ViewName>(
    shellMode === "tab" ? "profile" : "home"
  );
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [preferences, setPreferences] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [aiSettings, setAiSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [modelCatalog, setModelCatalog] = useState<ModelCatalog>(
    normalizeModelCatalog(null)
  );
  const [lastScraped, setLastScraped] = useState<JobObject | null>(null);
  const [checkHistory, setCheckHistory] = useState<CheckHistoryItem[]>([]);
  const [latestCheck, setLatestCheck] =
    useState<CompatibilityCheckResponse | null>(null);
  const [fieldVerification, setFieldVerification] =
    useState<FieldVerificationState | null>(null);
  const [status, setStatusState] = useState("");
  const [statusType, setStatusType] = useState<"" | "success" | "error">("");
  const [loading, setLoading] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [checkPhase, setCheckPhase] = useState("");
  const [historySort, setHistorySortState] = useState<HistorySortOption>("overall");
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [apiKeyGateActive, setApiKeyGateActive] = useState(false);

  const setStatus = useCallback(
    (message: string, type: "" | "success" | "error" = "") => {
      setStatusState(message);
      setStatusType(type);
      if (message) {
        debugInfo("popup", "status", message, { type });
      }
    },
    []
  );

  const setView = useCallback(
    (next: ViewName) => {
      if (apiKeyGateActive && next !== "apiKeySetup") {
        return;
      }
      debugInfo("popup", "navigation", `View → ${next}`);
      setViewState(next);
    },
    [apiKeyGateActive]
  );

  const loadStorage = useCallback(async () => {
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.profile,
      STORAGE_KEYS.preferences,
      STORAGE_KEYS.aiSettings,
      STORAGE_KEYS.modelCatalog,
      STORAGE_KEYS.lastScraped,
      STORAGE_KEYS.checkHistory,
      STORAGE_KEYS.privacyAcknowledged,
      STORAGE_KEYS.onboardingComplete,
      STORAGE_KEYS.historySort,
    ]);

    let migratedAi = DEFAULT_AI_SETTINGS;
    if (data[STORAGE_KEYS.profile]) {
      setProfile(migrateProfile(data[STORAGE_KEYS.profile]));
    }
    if (data[STORAGE_KEYS.preferences]) {
      setPreferences(migratePreferences(data[STORAGE_KEYS.preferences]));
    }
    if (data[STORAGE_KEYS.aiSettings]) {
      migratedAi = migrateAiSettings(data[STORAGE_KEYS.aiSettings]);
      setAiSettings(migratedAi);
      if (
        migratedAi.model !== data[STORAGE_KEYS.aiSettings]?.model ||
        migratedAi.provider !== data[STORAGE_KEYS.aiSettings]?.provider
      ) {
        void chrome.storage.local.set({ [STORAGE_KEYS.aiSettings]: migratedAi });
      }
    }
    setModelCatalog(normalizeModelCatalog(data[STORAGE_KEYS.modelCatalog]));
    if (data[STORAGE_KEYS.lastScraped]) {
      const migrated = migrateJobObject(data[STORAGE_KEYS.lastScraped]);
      if (migrated) setLastScraped(migrated);
    }
    if (data[STORAGE_KEYS.checkHistory]) {
      const migrated = migrateCheckHistory(data[STORAGE_KEYS.checkHistory]);
      setCheckHistory(migrated);
      if (migrated.length !== (data[STORAGE_KEYS.checkHistory] as unknown[])?.length) {
        void chrome.storage.local.set({
          [STORAGE_KEYS.checkHistory]: migrated,
        });
      }
    }
    const acknowledged = Boolean(data[STORAGE_KEYS.privacyAcknowledged]);
    const onboarded = Boolean(data[STORAGE_KEYS.onboardingComplete]);
    setPrivacyAcknowledged(acknowledged);
    setOnboardingComplete(onboarded);
    const storedSort = data[STORAGE_KEYS.historySort];
    if (
      storedSort === "overall" ||
      storedSort === "skills" ||
      storedSort === "experience" ||
      storedSort === "preferences" ||
      storedSort === "date"
    ) {
      setHistorySortState(storedSort);
    }

    const hasApiKey = Boolean(migratedAi.apiKey.trim());
    setApiKeyGateActive(!hasApiKey);
    setViewState(
      resolveInitialView(shellMode, hasApiKey, onboarded)
    );
  }, [shellMode]);

  useEffect(() => {
    void loadStorage();
    debugInfo("popup", "lifecycle", "Popup/app shell mounted", { shellMode });
  }, [loadStorage, shellMode]);

  useEffect(() => {
    if (!isDebugTelemetryEnabled()) return;

    function onError(event: ErrorEvent) {
      debugError("popup", "uncaught", event.message || "Uncaught error", {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    }

    function onRejection(event: PromiseRejectionEvent) {
      debugError(
        "popup",
        "unhandledrejection",
        "Unhandled promise rejection",
        summarizeError(event.reason)
      );
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    function handleStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) {
      if (area !== "local") return;
      if (changes[STORAGE_KEYS.modelCatalog]) {
        setModelCatalog(
          normalizeModelCatalog(changes[STORAGE_KEYS.modelCatalog].newValue)
        );
      }
      if (changes[STORAGE_KEYS.aiSettings]) {
        const migrated = migrateAiSettings(changes[STORAGE_KEYS.aiSettings].newValue);
        setAiSettings(migrated);
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const saveProfile = useCallback(async (next: UserProfile) => {
    setProfile(next);
    await chrome.storage.local.set({ [STORAGE_KEYS.profile]: next });
  }, []);

  const savePreferences = useCallback(async (next: UserPreferences) => {
    setPreferences(next);
    await chrome.storage.local.set({ [STORAGE_KEYS.preferences]: next });
  }, []);

  const saveAiSettings = useCallback(async (next: AiSettings) => {
    setAiSettings(next);
    await chrome.storage.local.set({ [STORAGE_KEYS.aiSettings]: next });
    if (next.apiKey.trim()) {
      setApiKeyGateActive(false);
    }
  }, []);

  const acknowledgePrivacy = useCallback(async () => {
    setPrivacyAcknowledged(true);
    await chrome.storage.local.set({ [STORAGE_KEYS.privacyAcknowledged]: true });
  }, []);

  const completeApiKeySetup = useCallback(() => {
    setApiKeyGateActive(false);
    if (!onboardingComplete && shellMode !== "tab") {
      setViewState("setup");
      return;
    }
    setViewState(shellMode === "tab" ? "profile" : "home");
  }, [onboardingComplete, shellMode]);

  const completeOnboarding = useCallback(async () => {
    setOnboardingComplete(true);
    await chrome.storage.local.set({ [STORAGE_KEYS.onboardingComplete]: true });
    setView(shellMode === "tab" ? "profile" : "home");
  }, [setView, shellMode]);

  const refreshHistory = useCallback(async () => {
    const data = await chrome.storage.local.get(STORAGE_KEYS.checkHistory);
    setCheckHistory(migrateCheckHistory(data[STORAGE_KEYS.checkHistory]));
  }, []);

  const deleteHistoryItem = useCallback(
    async (key: string) => {
      const next = checkHistory.filter((item) => item.key !== key);
      setCheckHistory(next);
      await chrome.storage.local.set({ [STORAGE_KEYS.checkHistory]: next });
      if (latestCheck?.job && getJobKey(latestCheck.job) === key) {
        setLatestCheck(null);
      }
    },
    [checkHistory, latestCheck]
  );

  const handleCheckResponse = useCallback(
    async (response: CompatibilityCheckResponse) => {
      if (!response?.success) {
        if (response?.error === "MISSING_API_KEY") {
          setStatus(
            "Add your API key in Settings to run compatibility checks.",
            "error"
          );
          setApiKeyGateActive(true);
          setViewState("apiKeySetup");
          return;
        }
        throw new Error(response?.error || "Compatibility check failed.");
      }

      if (
        response.needsFieldVerification &&
        response.job &&
        response.scrapedFields &&
        response.aiFields &&
        response.fieldConflicts?.length
      ) {
        setFieldVerification({
          job: response.job,
          scrapedFields: response.scrapedFields,
          aiFields: response.aiFields,
          conflicts: response.fieldConflicts,
        });
        if (response.job) setLastScraped(response.job);
        setLatestCheck(null);
        setView("fieldVerification");
        setStatus(
          "Review conflicting job details before continuing the check.",
          "error"
        );
        debugInfo("popup", "check", "Field verification required", {
          conflicts: response.fieldConflicts.map((c) => c.field),
        });
        return;
      }

      setFieldVerification(null);
      setCheckPhase("Building report…");
      setLatestCheck(response);
      if (response.job) setLastScraped(response.job);
      await refreshHistory();
      setView("result");

      debugInfo("popup", "check", "Compatibility check UI updated", {
        isCached: response.isCached,
        skippedAi: response.skippedAi,
        reportId: response.report?.reportId,
        overallScore: response.report?.overallScore,
      });

      if (response.isCached) {
        setStatus("Loaded a previously cached compatibility check.", "success");
      } else if (response.skippedAi) {
        setStatus("Hard mismatch detected before AI check.", "error");
      } else {
        setStatus("Compatibility check complete.", "success");
      }
    },
    [refreshHistory, setStatus, setView]
  );

  const runCompatibilityCheck = useCallback(
    async (forceRecheck = false) => {
      if (shellMode === "tab") return;

      setLoading(true);
      setCheckPhase("Gathering job information…");
      setStatus("");
      debugInfo("popup", "check", "User started compatibility check", {
        forceRecheck,
      });

      try {
        if (!privacyAcknowledged) {
          setStatus("Acknowledge the privacy notice before running a check.", "error");
          return;
        }

        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        debugInfo("popup", "check", "Active tab resolved", {
          tabId: tab?.id,
          url: tab?.url,
        });

        setCheckPhase("Extracting and verifying job details…");

        const response: CompatibilityCheckResponse =
          await chrome.runtime.sendMessage({
            type: MSG.RUN_COMPATIBILITY_CHECK,
            forceRecheck,
            tabId: tab?.id,
          });

        await handleCheckResponse(response);
      } catch (error) {
        debugError("popup", "check", "Compatibility check failed in UI", summarizeError(error));
        setStatus(
          error instanceof Error ? error.message : "Unexpected error.",
          "error"
        );
      } finally {
        setLoading(false);
        setCheckPhase("");
      }
    },
    [handleCheckResponse, privacyAcknowledged, setStatus, shellMode]
  );

  const continueCompatibilityCheck = useCallback(
    async (verifiedFields: JobFieldsExtractResult) => {
      if (shellMode === "tab") return;

      setLoading(true);
      setCheckPhase("Running compatibility check…");
      setStatus("");
      debugInfo("popup", "check", "Continuing check with verified fields");

      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        const response: CompatibilityCheckResponse =
          await chrome.runtime.sendMessage({
            type: MSG.RUN_COMPATIBILITY_CHECK,
            forceRecheck: true,
            skipFieldVerification: true,
            verifiedFields,
            tabId: tab?.id,
          });

        await handleCheckResponse(response);
      } catch (error) {
        debugError(
          "popup",
          "check",
          "Verified continuation failed",
          summarizeError(error)
        );
        setStatus(
          error instanceof Error ? error.message : "Unexpected error.",
          "error"
        );
      } finally {
        setLoading(false);
        setCheckPhase("");
      }
    },
    [handleCheckResponse, setStatus, shellMode]
  );

  const clearFieldVerification = useCallback(() => {
    setFieldVerification(null);
  }, []);

  const extractFromResume = useCallback(
    async (resumeText: string): Promise<ResumeExtractResult> => {
      if (!privacyAcknowledged) {
        throw new Error(
          "Acknowledge the privacy notice before extracting from a resume."
        );
      }

      const response = await chrome.runtime.sendMessage({
        type: MSG.EXTRACT_FROM_RESUME,
        resumeText,
      });

      if (!response?.success) {
        if (response?.error === "MISSING_API_KEY") {
          throw new Error("Add your API key in Settings first.");
        }
        throw new Error(response?.error || "Resume extraction failed.");
      }

      return response.data as ResumeExtractResult;
    },
    [privacyAcknowledged]
  );

  const openDedicatedTab = useCallback(() => {
    openExtensionPage("src/app/index.html");
  }, []);

  const openHistoryItem = useCallback((item: CheckHistoryItem) => {
    setLatestCheck({
      success: true,
      job: item.job,
      report: { ...item.report, cached: true },
      reportViewSource: "history",
      followUps: item.followUps ?? [],
      aiConversation: item.aiConversation,
      historyKey: item.key,
    });
    setView("result");
  }, [setView]);

  const askFollowUp = useCallback(
    async (question: string) => {
      const historyKey = latestCheck?.historyKey;
      if (!historyKey) {
        throw new Error("Save a compatibility check before asking follow-ups.");
      }

      setFollowUpLoading(true);
      try {
        const response = await chrome.runtime.sendMessage({
          type: MSG.ASK_FOLLOW_UP,
          historyKey,
          question,
        });

        if (!response?.success) {
          if (response?.error === "MISSING_API_KEY") {
            throw new Error("Add your API key in Settings first.");
          }
          throw new Error(response?.error || "Follow-up question failed.");
        }

        setLatestCheck((prev) =>
          prev
            ? {
                ...prev,
                followUps: response.followUps ?? prev.followUps,
                aiConversation: response.aiConversation ?? prev.aiConversation,
                job: response.job ?? prev.job,
              }
            : prev
        );
        await refreshHistory();
      } finally {
        setFollowUpLoading(false);
      }
    },
    [latestCheck?.historyKey, refreshHistory]
  );

  const setHistorySort = useCallback(async (sort: HistorySortOption) => {
    setHistorySortState(sort);
    await chrome.storage.local.set({ [STORAGE_KEYS.historySort]: sort });
  }, []);

  const resetAllData = useCallback(async () => {
    const confirmed = window.confirm("Clear all locally saved extension data?");
    if (!confirmed) return;

    await chrome.storage.local.clear();

    setProfile(DEFAULT_PROFILE);
    setPreferences(DEFAULT_PREFERENCES);
    setAiSettings(DEFAULT_AI_SETTINGS);
    setModelCatalog(normalizeModelCatalog(null));
    setLastScraped(null);
    setCheckHistory([]);
    setLatestCheck(null);
    setFieldVerification(null);
    setPrivacyAcknowledged(false);
    setOnboardingComplete(false);
    setApiKeyGateActive(true);
    setStatus("");
    setStatusType("");
    setViewState(shellMode === "tab" ? "apiKeySetup" : "apiKeySetup");
  }, [setStatus]);

  const value = useMemo<AppContextValue>(
    () => ({
      shellMode,
      view,
      setView,
      profile,
      preferences,
      aiSettings,
      modelCatalog,
      lastScraped,
      checkHistory,
      latestCheck,
      fieldVerification,
      status,
      statusType,
      loading,
      followUpLoading,
      checkPhase,
      privacyAcknowledged,
      onboardingComplete,
      saveProfile,
      savePreferences,
      saveAiSettings,
      acknowledgePrivacy,
      completeApiKeySetup,
      completeOnboarding,
      setStatus,
      runCompatibilityCheck,
      continueCompatibilityCheck,
      clearFieldVerification,
      extractFromResume,
      openDedicatedTab,
      openHistoryItem,
      askFollowUp,
      historySort,
      setHistorySort,
      refreshHistory,
      deleteHistoryItem,
      resetAllData,
    }),
    [
      shellMode,
      view,
      setView,
      profile,
      preferences,
      aiSettings,
      modelCatalog,
      lastScraped,
      checkHistory,
      latestCheck,
      fieldVerification,
      status,
      statusType,
      loading,
      followUpLoading,
      checkPhase,
      privacyAcknowledged,
      onboardingComplete,
      saveProfile,
      savePreferences,
      saveAiSettings,
      acknowledgePrivacy,
      completeApiKeySetup,
      completeOnboarding,
      setStatus,
      runCompatibilityCheck,
      continueCompatibilityCheck,
      clearFieldVerification,
      extractFromResume,
      openDedicatedTab,
      openHistoryItem,
      askFollowUp,
      historySort,
      setHistorySort,
      refreshHistory,
      deleteHistoryItem,
      resetAllData,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
