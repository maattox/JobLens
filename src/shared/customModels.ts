import type { AiProvider } from "./types";

/**
 * User-added model for a provider. JobLens only needs the API model id string
 * (the same value sent as `model` in OpenAI / Anthropic / Gemini requests).
 * The API key stays in Settings separately.
 */
export interface CustomModelEntry {
  /** Exact model id accepted by the provider API. */
  id: string;
  /** Optional label shown in the dropdown. */
  label: string;
  /** Optional note for the user (not sent to the API). */
  notes: string;
  createdAt: string;
}

export type CustomModelsByProvider = Record<AiProvider, CustomModelEntry[]>;

export function buildEmptyCustomModels(): CustomModelsByProvider {
  return { openai: [], anthropic: [], gemini: [] };
}

function asEntry(raw: unknown): CustomModelEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<CustomModelEntry>;
  const id = typeof data.id === "string" ? normalizeModelId(data.id) : "";
  if (!id) return null;
  return {
    id,
    label: typeof data.label === "string" ? data.label.trim() : "",
    notes: typeof data.notes === "string" ? data.notes.trim() : "",
    createdAt:
      typeof data.createdAt === "string" && data.createdAt
        ? data.createdAt
        : new Date().toISOString(),
  };
}

/** Strip Gemini `models/` prefix if the user pasted a full resource name. */
export function normalizeModelId(raw: string): string {
  return raw.trim().replace(/^models\//i, "");
}

export function normalizeCustomModels(raw: unknown): CustomModelsByProvider {
  const empty = buildEmptyCustomModels();
  if (!raw || typeof raw !== "object") return empty;

  const data = raw as Partial<Record<AiProvider, unknown>>;
  const result = buildEmptyCustomModels();

  for (const provider of Object.keys(empty) as AiProvider[]) {
    const list = data[provider];
    if (!Array.isArray(list)) continue;
    const seen = new Set<string>();
    for (const item of list) {
      const entry = asEntry(item);
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      result[provider].push(entry);
    }
  }

  return result;
}

export function customModelIds(
  custom: CustomModelsByProvider,
  provider: AiProvider
): string[] {
  return custom[provider].map((entry) => entry.id);
}

/** Catalog models plus any manually added ids (catalog first, then custom). */
export function buildSelectableModels(
  catalog: string[],
  custom: CustomModelEntry[]
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of catalog) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  for (const entry of custom) {
    if (!entry.id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    ids.push(entry.id);
  }
  return ids;
}

export function formatModelOptionLabel(
  modelId: string,
  custom: CustomModelEntry[]
): string {
  const entry = custom.find((item) => item.id === modelId);
  if (entry?.label) return `${entry.label} (${modelId})`;
  if (entry) return `${modelId} (manual)`;
  return modelId;
}

export function upsertCustomModel(
  current: CustomModelsByProvider,
  provider: AiProvider,
  entry: Omit<CustomModelEntry, "createdAt"> & { createdAt?: string }
): CustomModelsByProvider {
  const id = normalizeModelId(entry.id);
  if (!id) return current;

  const nextEntry: CustomModelEntry = {
    id,
    label: entry.label.trim(),
    notes: entry.notes.trim(),
    createdAt: entry.createdAt || new Date().toISOString(),
  };

  const list = current[provider].filter((item) => item.id !== id);
  return {
    ...current,
    [provider]: [...list, nextEntry],
  };
}

export function removeCustomModel(
  current: CustomModelsByProvider,
  provider: AiProvider,
  modelId: string
): CustomModelsByProvider {
  const id = normalizeModelId(modelId);
  return {
    ...current,
    [provider]: current[provider].filter((item) => item.id !== id),
  };
}
