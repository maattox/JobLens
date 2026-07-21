import {
  DEBUG_LOG_BUFFER_SIZE,
  DEBUG_STORAGE_KEY,
  DEBUG_TELEMETRY_ENABLED,
} from "./config";
import type { DebugLogEntry } from "./types";

let memoryBuffer: DebugLogEntry[] = [];
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let hydrated = false;

function schedulePersist() {
  if (!DEBUG_TELEMETRY_ENABLED) return;
  if (typeof chrome === "undefined" || !chrome.storage?.session) return;

  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void chrome.storage.session
      .set({ [DEBUG_STORAGE_KEY]: memoryBuffer })
      .catch(() => {
        /* session storage optional; ignore quota / unavailable */
      });
  }, 150);
}

export async function hydrateDebugBuffer(): Promise<void> {
  if (!DEBUG_TELEMETRY_ENABLED || hydrated) return;
  hydrated = true;

  if (typeof chrome === "undefined" || !chrome.storage?.session) return;

  try {
    const result = await chrome.storage.session.get(DEBUG_STORAGE_KEY);
    const stored = result[DEBUG_STORAGE_KEY];
    if (Array.isArray(stored)) {
      memoryBuffer = stored.filter(isDebugLogEntry).slice(-DEBUG_LOG_BUFFER_SIZE);
    }
  } catch {
    /* ignore */
  }
}

function isDebugLogEntry(value: unknown): value is DebugLogEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as DebugLogEntry;
  return (
    typeof entry.id === "string" &&
    typeof entry.ts === "string" &&
    typeof entry.level === "string" &&
    typeof entry.source === "string" &&
    typeof entry.category === "string" &&
    typeof entry.message === "string"
  );
}

export function appendDebugEntry(entry: DebugLogEntry): void {
  if (!DEBUG_TELEMETRY_ENABLED) return;
  memoryBuffer.push(entry);
  if (memoryBuffer.length > DEBUG_LOG_BUFFER_SIZE) {
    memoryBuffer = memoryBuffer.slice(-DEBUG_LOG_BUFFER_SIZE);
  }
  schedulePersist();
}

export function getDebugEntries(): DebugLogEntry[] {
  return [...memoryBuffer];
}

export function clearDebugBuffer(): void {
  memoryBuffer = [];
  schedulePersist();
}

export function createDebugLogEntry(
  partial: Omit<DebugLogEntry, "id" | "ts"> & { id?: string; ts?: string }
): DebugLogEntry {
  return {
    id:
      partial.id ??
      `dbg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    ts: partial.ts ?? new Date().toISOString(),
    level: partial.level,
    source: partial.source,
    category: partial.category,
    message: partial.message,
    data: partial.data,
  };
}
