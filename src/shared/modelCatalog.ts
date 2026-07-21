import {
  AI_MODEL_OPTIONS,
  type AiProvider,
  type ModelCatalog,
} from "./types";

const OPENAI_PREFIXES = ["gpt-", "o1", "o3", "o4"];
const ANTHROPIC_PREFIXES = ["claude-"];
const GEMINI_PREFIXES = ["gemini-", "gemma-"];

function matchesPrefix(id: string, prefixes: string[]): boolean {
  const lower = id.toLowerCase();
  return prefixes.some((prefix) => lower.startsWith(prefix));
}

function filterApiIds(provider: AiProvider, apiIds: string[]): string[] {
  switch (provider) {
    case "openai":
      return apiIds.filter((id) => matchesPrefix(id, OPENAI_PREFIXES));
    case "anthropic":
      return apiIds.filter((id) => matchesPrefix(id, ANTHROPIC_PREFIXES));
    case "gemini":
      return apiIds
        .map((id) => id.replace(/^models\//, ""))
        .filter((id) => matchesPrefix(id, GEMINI_PREFIXES));
    default:
      return [];
  }
}

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

  for (const id of filtered) {
    if (!merged.includes(id)) {
      merged.push(id);
    }
  }

  return merged.length ? merged : [...curated];
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
  return {
    openai: Array.isArray(data.openai) && data.openai.length
      ? data.openai.filter((id): id is string => typeof id === "string")
      : defaults.openai,
    anthropic: Array.isArray(data.anthropic) && data.anthropic.length
      ? data.anthropic.filter((id): id is string => typeof id === "string")
      : defaults.anthropic,
    gemini: Array.isArray(data.gemini) && data.gemini.length
      ? data.gemini.filter((id): id is string => typeof id === "string")
      : defaults.gemini,
  };
}
