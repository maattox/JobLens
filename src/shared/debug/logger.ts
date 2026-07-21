import { DEBUG_TELEMETRY_ENABLED } from "./config";
import {
  appendDebugEntry,
  createDebugLogEntry,
  hydrateDebugBuffer,
} from "./buffer";
import { sanitizeForReport } from "./sanitize";
import type { DebugLogEntry, DebugLogLevel, DebugSource } from "./types";

type AppendHandler = (entry: DebugLogEntry) => void;

let localAppender: AppendHandler | null = null;
let messageType: string | null = null;

/**
 * Background service worker should call this once at startup so logs stay local
 * (no self-message). Popup/content keep using runtime messaging.
 */
export function bindDebugAppender(handler: AppendHandler): void {
  localAppender = handler;
}

/** Background sets the message type constant to avoid circular imports. */
export function configureDebugLogger(options: { messageType: string }): void {
  messageType = options.messageType;
}

export function isDebugTelemetryEnabled(): boolean {
  return DEBUG_TELEMETRY_ENABLED;
}

export function debugLog(
  source: DebugSource,
  category: string,
  message: string,
  data?: unknown,
  level: DebugLogLevel = "info"
): void {
  if (!DEBUG_TELEMETRY_ENABLED) return;

  const entry = createDebugLogEntry({
    source,
    category,
    message,
    level,
    data: data === undefined ? undefined : sanitizeForReport(data),
  });

  if (localAppender) {
    localAppender(entry);
    return;
  }

  if (
    typeof chrome !== "undefined" &&
    chrome.runtime?.sendMessage &&
    messageType
  ) {
    void chrome.runtime.sendMessage({ type: messageType, entry }).catch(() => {
      /* popup may open before SW is ready; drop rather than throw */
    });
    return;
  }

  // Fallback: keep in this context's memory (content / early popup)
  appendDebugEntry(entry);
}

export function debugInfo(
  source: DebugSource,
  category: string,
  message: string,
  data?: unknown
): void {
  debugLog(source, category, message, data, "info");
}

export function debugWarn(
  source: DebugSource,
  category: string,
  message: string,
  data?: unknown
): void {
  debugLog(source, category, message, data, "warn");
}

export function debugError(
  source: DebugSource,
  category: string,
  message: string,
  data?: unknown
): void {
  debugLog(source, category, message, data, "error");
}

/** Ensure session buffer is loaded (background only). */
export async function ensureDebugReady(): Promise<void> {
  if (!DEBUG_TELEMETRY_ENABLED) return;
  await hydrateDebugBuffer();
}
