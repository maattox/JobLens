export const MSG = {
  EXTRACT_JOB: "EXTRACT_JOB",
  SCRAPE_JOB: "SCRAPE_JOB",
  RUN_COMPATIBILITY_CHECK: "RUN_COMPATIBILITY_CHECK",
  /** Local history lookup for the active tab. Does not call an AI provider. */
  LOOKUP_CACHED_REPORT: "LOOKUP_CACHED_REPORT",
  EXTRACT_FROM_RESUME: "EXTRACT_FROM_RESUME",
  ASK_FOLLOW_UP: "ASK_FOLLOW_UP",
  /** Refresh provider model list from the live API (optional force). */
  SYNC_MODEL_CATALOG: "SYNC_MODEL_CATALOG",
  CLEAR_MODEL_CATALOG_NOTICE: "CLEAR_MODEL_CATALOG_NOTICE",
  GET_STORAGE: "GET_STORAGE",
  SET_STORAGE: "SET_STORAGE",
  /** Dev-only debug telemetry (no-op when DEBUG_TELEMETRY_ENABLED is false). */
  DEBUG_LOG: "DEBUG_LOG",
  DEBUG_GET_REPORT_CONTEXT: "DEBUG_GET_REPORT_CONTEXT",
  DEBUG_CLEAR: "DEBUG_CLEAR",
} as const;

export type MessageType = (typeof MSG)[keyof typeof MSG];
