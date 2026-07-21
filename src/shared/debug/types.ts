export type DebugLogLevel = "debug" | "info" | "warn" | "error";

export type DebugSource = "popup" | "background" | "content" | "shared";

export interface DebugLogEntry {
  id: string;
  ts: string;
  level: DebugLogLevel;
  source: DebugSource;
  category: string;
  message: string;
  data?: unknown;
}

export interface DebugRuntimeSnapshot {
  extensionVersion: string;
  manifestVersion: number;
  userAgent: string;
  platform: string;
  language: string;
  extensionId: string;
  serviceWorkerAlive: boolean;
  storageKeys: string[];
  activeTab?: {
    id?: number;
    url?: string;
    title?: string;
    status?: string;
  };
  ai?: {
    provider: string;
    model: string;
    hasApiKey: boolean;
  };
  flags?: {
    privacyAcknowledged: boolean;
    onboardingComplete: boolean;
    profileSetupComplete: boolean;
    preferencesSetupComplete: boolean;
  };
  latestHistorySummary?: {
    count: number;
    mostRecent?: {
      key: string;
      reportId?: string;
      title: string;
      url: string;
      overallScore?: number;
      checkedAt?: string;
    };
  };
  lastScrapedSummary?: {
    title: string;
    company: string;
    source: string;
    url: string;
    isSupported: boolean;
  };
}

export interface DebugUiSnapshot {
  shellMode: string;
  view: string;
  status: string;
  statusType: string;
  loading: boolean;
  followUpLoading: boolean;
  checkPhase: string;
  historySort: string;
  historyCount: number;
  hasLatestCheck: boolean;
  latestCheckSummary?: {
    success: boolean;
    skippedAi?: boolean;
    isCached?: boolean;
    reportViewSource?: string;
    historyKey?: string;
    reportId?: string;
    overallScore?: number;
    error?: string;
    preCheck?: {
      passed: boolean;
      hardMismatch: boolean;
      reasons: string[];
    };
  };
}

export interface IssueReportPayload {
  reportId: string;
  createdAt: string;
  developerDescription: string;
  environment: DebugRuntimeSnapshot;
  ui: DebugUiSnapshot;
  /** Sanitized profile / preferences / recent report debug blobs (no API keys). */
  state: Record<string, unknown>;
  telemetry: DebugLogEntry[];
  instructionsForAgent: string;
}
