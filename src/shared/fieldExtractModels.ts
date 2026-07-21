import {
  DEFAULT_FIELD_EXTRACT_MODELS as CURATED_FIELD_EXTRACT_MODELS,
} from "./aiModelDefaults";
import type { AiProvider } from "./types";

/** Preferred cheap/lite models for the job-field verification extract pass. */
export const DEFAULT_FIELD_EXTRACT_MODELS: Record<AiProvider, string> = {
  openai: CURATED_FIELD_EXTRACT_MODELS.openai,
  anthropic: CURATED_FIELD_EXTRACT_MODELS.anthropic,
  gemini: CURATED_FIELD_EXTRACT_MODELS.gemini,
};

export type FieldExtractModelMap = Record<AiProvider, string>;

export function buildDefaultFieldExtractModels(): FieldExtractModelMap {
  return { ...DEFAULT_FIELD_EXTRACT_MODELS };
}

export function normalizeFieldExtractModels(raw: unknown): FieldExtractModelMap {
  const defaults = buildDefaultFieldExtractModels();
  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const data = raw as Partial<Record<AiProvider, unknown>>;
  return {
    openai:
      typeof data.openai === "string" && data.openai.trim()
        ? data.openai.trim()
        : defaults.openai,
    anthropic:
      typeof data.anthropic === "string" && data.anthropic.trim()
        ? data.anthropic.trim()
        : defaults.anthropic,
    gemini:
      typeof data.gemini === "string" && data.gemini.trim()
        ? data.gemini.trim()
        : defaults.gemini,
  };
}

const LITE_PATTERNS: Record<AiProvider, RegExp[]> = {
  openai: [/luna/i, /mini/i, /nano/i],
  anthropic: [/haiku/i],
  // Prefer explicit lite ids — do not match every "flash" model.
  gemini: [/flash-lite/i, /lite/i],
};

/**
 * Pick a cheap/lite model from the live provider catalog.
 * Prefers the stored/default preferred id when still listed, then pattern matches.
 */
export function pickFieldExtractModel(
  provider: AiProvider,
  catalog: string[],
  options?: { preferred?: string; exclude?: string | string[] }
): string | null {
  if (!catalog.length) return null;

  const excluded = new Set(
    (Array.isArray(options?.exclude)
      ? options.exclude
      : options?.exclude
        ? [options.exclude]
        : []
    ).filter(Boolean)
  );

  const available = catalog.filter((id) => id && !excluded.has(id));
  if (!available.length) return null;

  const preferred =
    options?.preferred?.trim() || DEFAULT_FIELD_EXTRACT_MODELS[provider];
  if (preferred && available.includes(preferred)) {
    return preferred;
  }

  for (const pattern of LITE_PATTERNS[provider]) {
    const match = available.find((id) => pattern.test(id));
    if (match) return match;
  }

  return available[0] ?? null;
}
