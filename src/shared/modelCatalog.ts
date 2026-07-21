import { GEMINI_PAID_ONLY_MODELS } from "./aiModelDefaults";
import {
  AI_MODEL_OPTIONS,
  type AiProvider,
  type ModelCatalog,
} from "./types";

const OPENAI_PREFIXES = ["gpt-", "o1", "o3", "o4"];
const ANTHROPIC_PREFIXES = ["claude-"];
const GEMINI_PREFIXES = ["gemini-"];

function matchesPrefix(id: string, prefixes: string[]): boolean {
  const lower = id.toLowerCase();
  return prefixes.some((prefix) => lower.startsWith(prefix));
}

function stripGeminiPrefix(id: string): string {
  return id.replace(/^models\//i, "");
}

/** Exclude media / embedding / tooling variants that are not text chat models. */
function isNonChatModelId(id: string): boolean {
  const lower = id.toLowerCase();
  return (
    lower.includes("embed") ||
    lower.includes("embedding") ||
    lower.includes("image") ||
    lower.includes("imagen") ||
    lower.includes("tts") ||
    lower.includes("audio") ||
    lower.includes("video") ||
    lower.includes("omni") ||
    lower.includes("robotics") ||
    lower.includes("computer-use") ||
    lower.includes("whisper") ||
    lower.includes("dall-e") ||
    lower.includes("realtime") ||
    lower.includes("moderation") ||
    lower.includes("transcribe") ||
    lower.includes("tts")
  );
}

/**
 * Current-generation text models we may surface if curated defaults are all gone.
 * Keeps the dropdown small when providers rename models.
 */
export function isCurrentGenerationChatModel(
  provider: AiProvider,
  id: string
): boolean {
  const raw = provider === "gemini" ? stripGeminiPrefix(id) : id;
  const lower = raw.toLowerCase();
  if (isNonChatModelId(lower)) return false;

  switch (provider) {
    case "gemini":
      // Skill: gemini-2.5/2.0/1.5 are legacy; prefer gemini-3.x text models.
      return /^gemini-3(\.|-)/.test(lower);
    case "anthropic":
      return (
        /^claude-(haiku|sonnet|opus)-/.test(lower) &&
        !/claude-(1|2|3-|instant)/.test(lower)
      );
    case "openai":
      return (
        /^gpt-5(\.|-)/.test(lower) ||
        /^gpt-4\.1/.test(lower) ||
        /^(o3|o4)(-|$)/.test(lower)
      );
    default:
      return false;
  }
}

export function filterApiIds(provider: AiProvider, apiIds: string[]): string[] {
  const normalized = apiIds
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    .map((id) => (provider === "gemini" ? stripGeminiPrefix(id.trim()) : id.trim()));

  const paidOnly =
    provider === "gemini"
      ? new Set(GEMINI_PAID_ONLY_MODELS.map((id) => id.toLowerCase()))
      : null;

  switch (provider) {
    case "openai":
      return normalized.filter(
        (id) =>
          matchesPrefix(id, OPENAI_PREFIXES) &&
          !isNonChatModelId(id) &&
          isCurrentGenerationChatModel("openai", id)
      );
    case "anthropic":
      return normalized.filter(
        (id) =>
          matchesPrefix(id, ANTHROPIC_PREFIXES) &&
          isCurrentGenerationChatModel("anthropic", id)
      );
    case "gemini":
      return normalized.filter(
        (id) =>
          matchesPrefix(id, GEMINI_PREFIXES) &&
          isCurrentGenerationChatModel("gemini", id) &&
          !paidOnly?.has(id.toLowerCase())
      );
    default:
      return [];
  }
}

/**
 * Build the selectable model list from curated defaults intersected with the
 * live provider catalog. Does not dump every historical API model into the UI.
 */
export function mergeModelCatalog(
  provider: AiProvider,
  apiIds: string[] | null
): string[] {
  const curated = AI_MODEL_OPTIONS[provider];
  if (!apiIds?.length) {
    return [...curated];
  }

  const filtered = filterApiIds(provider, apiIds);
  const filteredSet = new Set(filtered);
  const merged = curated.filter((id) => filteredSet.has(id));

  if (merged.length) {
    return merged;
  }

  // Curated IDs all missing from the live API — offer a short current-gen fallback.
  const fallback = filtered.slice(0, 8);
  return fallback.length ? fallback : [...curated];
}

export function buildDefaultModelCatalog(): ModelCatalog {
  return {
    openai: [...AI_MODEL_OPTIONS.openai],
    anthropic: [...AI_MODEL_OPTIONS.anthropic],
    gemini: [...AI_MODEL_OPTIONS.gemini],
  };
}

export function pickReplacementModel(
  catalog: string[],
  currentModel: string
): string | null {
  return catalog.find((model) => model !== currentModel) ?? null;
}

export function normalizeModelCatalog(raw: unknown): ModelCatalog {
  const defaults = buildDefaultModelCatalog();
  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const data = raw as Partial<ModelCatalog>;

  function sanitize(provider: AiProvider, list: unknown): string[] {
    if (!Array.isArray(list) || !list.length) {
      return defaults[provider];
    }
    const cleaned = list.filter(
      (id): id is string =>
        typeof id === "string" &&
        isCurrentGenerationChatModel(provider, id) &&
        !(
          provider === "gemini" &&
          GEMINI_PAID_ONLY_MODELS.some(
            (paid) => paid.toLowerCase() === id.toLowerCase()
          )
        )
    );
    const set = new Set(cleaned);
    const ordered = AI_MODEL_OPTIONS[provider].filter((id) => set.has(id));
    if (ordered.length) return ordered;
    // No curated overlap in storage — reset to defaults instead of keeping stray ids.
    return defaults[provider];
  }

  return {
    openai: sanitize("openai", data.openai),
    anthropic: sanitize("anthropic", data.anthropic),
    gemini: sanitize("gemini", data.gemini),
  };
}
