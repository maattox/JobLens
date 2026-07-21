export { DEBUG_TELEMETRY_ENABLED, DEBUG_LOG_BUFFER_SIZE } from "./config";
export {
  appendDebugEntry,
  clearDebugBuffer,
  createDebugLogEntry,
  getDebugEntries,
  hydrateDebugBuffer,
} from "./buffer";
export {
  bindDebugAppender,
  configureDebugLogger,
  debugError,
  debugInfo,
  debugLog,
  debugWarn,
  ensureDebugReady,
  isDebugTelemetryEnabled,
} from "./logger";
export {
  buildIssueReport,
  formatIssueReportMarkdown,
  issueReportFileName,
} from "./report";
export { sanitizeForReport, summarizeError } from "./sanitize";
export type {
  DebugLogEntry,
  DebugLogLevel,
  DebugRuntimeSnapshot,
  DebugSource,
  DebugUiSnapshot,
  IssueReportPayload,
} from "./types";
