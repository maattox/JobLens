import { DEV_MODE } from "../devMode";

/**
 * Dev-only debug telemetry / issue reporting.
 * Tied to {@link DEV_MODE} in `src/shared/devMode.ts` — flip that one flag
 * before store release instead of editing this file.
 */
export const DEBUG_TELEMETRY_ENABLED = DEV_MODE;

/** Max in-memory / session-persisted log entries (ring buffer). */
export const DEBUG_LOG_BUFFER_SIZE = 400;

/** Truncate large string fields in report snapshots. */
export const DEBUG_MAX_STRING_CHARS = 4_000;

export const DEBUG_STORAGE_KEY = "debugTelemetryLog";
