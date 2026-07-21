/**
 * Curated general-use chat models shown in JobLens.
 * Updated by `npm run sync:models` (see scripts/sync-ai-models.mjs).
 *
 * Runtime catalog sync intersects these with each provider's Models API for the
 * user's API key. Provider list endpoints do not always omit paid-only models
 * (Gemini free tier can still list Pro), so paid-only exclusions below still apply.
 */
export const AI_MODEL_OPTIONS = {
  openai: ["gpt-5.6", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.4-mini"],
  anthropic: ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-4-8"],
  gemini: ["gemini-3.6-flash", "gemini-3.5-flash-lite"],
} as const satisfies Record<"openai" | "anthropic" | "gemini", readonly string[]>;

/** Default model when a provider is first selected / installed. */
export const DEFAULT_MODEL_BY_PROVIDER = {
  openai: "gpt-5.6",
  anthropic: "claude-haiku-4-5",
  gemini: "gemini-3.6-flash",
} as const satisfies Record<"openai" | "anthropic" | "gemini", string>;

/** Preferred cheap/fast models for the ZipRecruiter/LinkedIn field-extract pass. */
export const DEFAULT_FIELD_EXTRACT_MODELS = {
  openai: "gpt-5.6-luna",
  anthropic: "claude-haiku-4-5",
  gemini: "gemini-3.5-flash-lite",
} as const satisfies Record<"openai" | "anthropic" | "gemini", string>;

/**
 * Models that appear in Gemini's Models API for free-tier keys but are not
 * available on the free tier per https://ai.google.dev/gemini-api/docs/pricing
 */
export const GEMINI_PAID_ONLY_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3.1-pro-preview-customtools",
  "gemini-3-pro-preview",
  "gemini-2.5-pro",
] as const;
