import { DEBUG_MAX_STRING_CHARS } from "./config";

const SECRET_KEY_PATTERN =
  /^(api[_-]?key|authorization|token|secret|password|credential)$/i;

function truncateString(value: string): string {
  if (value.length <= DEBUG_MAX_STRING_CHARS) return value;
  return `${value.slice(0, DEBUG_MAX_STRING_CHARS)}… [truncated ${value.length - DEBUG_MAX_STRING_CHARS} chars]`;
}

/**
 * Deep-clone and redact secrets / oversized strings for issue reports.
 * Safe to include in downloaded reports shared with local AI agents.
 */
export function sanitizeForReport(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[max depth]";
  if (value == null) return value;

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeForReport(item, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        out[key] = typeof nested === "string" && nested.trim()
          ? "[REDACTED]"
          : nested
            ? "[REDACTED]"
            : "";
        continue;
      }
      out[key] = sanitizeForReport(nested, depth + 1);
    }
    return out;
  }

  return String(value);
}

export function summarizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const extra: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack ? truncateString(error.stack) : undefined,
    };
    if ("status" in error) {
      extra.status = (error as { status?: unknown }).status;
    }
    if ("body" in error) {
      extra.body = sanitizeForReport((error as { body?: unknown }).body);
    }
    return extra;
  }
  return { message: String(error) };
}
