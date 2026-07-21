import {
  buildSelectableModels,
  customModelIds,
  normalizeCustomModels,
  type CustomModelsByProvider,
} from "../../shared/customModels";
import {
  buildDefaultModelCatalog,
  mergeModelCatalog,
  normalizeModelCatalog,
} from "../../shared/modelCatalog";
import { STORAGE_KEYS } from "../../shared/storage";
import type {
  AiProvider,
  AiSettings,
  ModelCatalog,
  ModelCatalogMeta,
  ModelCatalogNotice,
  ModelCatalogSyncResult,
} from "../../shared/types";
import { DEFAULT_AI_SETTINGS } from "../../shared/types";
import { listProviderModels } from "./listModels";

/** Re-check the live API at most this often unless force=true. */
export const MODEL_CATALOG_TTL_MS = 15 * 60 * 1000;

function listsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function providerLabel(provider: AiProvider): string {
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Anthropic";
  return "Google Gemini";
}

async function readCatalog(): Promise<ModelCatalog> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.modelCatalog);
  return normalizeModelCatalog(result[STORAGE_KEYS.modelCatalog]);
}

async function writeCatalog(catalog: ModelCatalog): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.modelCatalog]: catalog });
}

async function readMeta(): Promise<ModelCatalogMeta> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.modelCatalogMeta);
  const raw = result[STORAGE_KEYS.modelCatalogMeta];
  if (!raw || typeof raw !== "object") {
    return { lastSyncedAt: {} };
  }
  const data = raw as ModelCatalogMeta;
  return {
    lastSyncedAt:
      data.lastSyncedAt && typeof data.lastSyncedAt === "object"
        ? data.lastSyncedAt
        : {},
  };
}

async function writeMeta(meta: ModelCatalogMeta): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.modelCatalogMeta]: meta });
}

async function writeNotice(notice: ModelCatalogNotice | null): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.modelCatalogNotice]: notice });
}

async function readCustomModels(): Promise<CustomModelsByProvider> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.customModels);
  return normalizeCustomModels(result[STORAGE_KEYS.customModels]);
}

export async function getModelCatalog(): Promise<ModelCatalog> {
  return readCatalog();
}

export async function getModelsForProvider(provider: AiProvider): Promise<string[]> {
  const catalog = await readCatalog();
  const custom = await readCustomModels();
  return buildSelectableModels(catalog[provider] ?? [], custom[provider]);
}

export async function clearModelCatalogNotice(): Promise<void> {
  await writeNotice(null);
}

export async function refreshProviderCatalog(
  provider: AiProvider,
  apiKey: string
): Promise<string[]> {
  const result = await syncProviderCatalog(provider, apiKey, { force: true });
  return result.models;
}

/**
 * Fetch the live model list for a provider, update storage when it changes,
 * and switch the user's selected model if it is no longer available.
 */
export async function syncProviderCatalog(
  provider: AiProvider,
  apiKey: string,
  options?: { force?: boolean }
): Promise<ModelCatalogSyncResult> {
  const settingsResult = await chrome.storage.local.get(STORAGE_KEYS.aiSettings);
  const settings = (settingsResult[STORAGE_KEYS.aiSettings] as AiSettings | undefined) ?? {
    ...DEFAULT_AI_SETTINGS,
    provider,
  };
  const previousModel = settings.provider === provider ? settings.model : "";

  const catalog = await readCatalog();
  const before = [...(catalog[provider] ?? [])];
  const meta = await readMeta();
  const lastSynced = meta.lastSyncedAt[provider] ?? 0;
  const stale = Date.now() - lastSynced > MODEL_CATALOG_TTL_MS;
  const selectedMissing =
    Boolean(previousModel) && before.length > 0 && !before.includes(previousModel);
  const shouldRefresh =
    Boolean(options?.force) || stale || !before.length || selectedMissing;

  if (!apiKey.trim()) {
    return {
      provider,
      models: before.length ? before : buildDefaultModelCatalog()[provider],
      changed: false,
      modelSwitched: false,
      previousModel,
      currentModel: previousModel,
      refreshed: false,
      notice: null,
    };
  }

  if (!shouldRefresh) {
    return {
      provider,
      models: before,
      changed: false,
      modelSwitched: false,
      previousModel,
      currentModel: previousModel,
      refreshed: false,
      notice: null,
    };
  }

  const apiIds = await listProviderModels(provider, apiKey);
  const merged = mergeModelCatalog(provider, apiIds);
  const changed = !listsEqual(before, merged);

  catalog[provider] = merged;
  await writeCatalog(catalog);
  meta.lastSyncedAt[provider] = Date.now();
  await writeMeta(meta);

  let modelSwitched = false;
  let currentModel = previousModel;
  if (previousModel && !merged.includes(previousModel)) {
    const custom = await readCustomModels();
    const isManual = customModelIds(custom, provider).includes(previousModel);
    if (!isManual) {
      currentModel = merged[0] ?? previousModel;
      modelSwitched = currentModel !== previousModel;
      if (modelSwitched && settings.provider === provider) {
        await chrome.storage.local.set({
          [STORAGE_KEYS.aiSettings]: { ...settings, model: currentModel },
        });
      }
    }
  }

  let notice: string | null = null;
  if (changed || modelSwitched) {
    const label = providerLabel(provider);
    if (modelSwitched) {
      notice = `Detected changes to ${label} models — updated available options. “${previousModel}” is no longer available, so JobLens switched to “${currentModel}”.`;
    } else {
      notice = `Detected changes to ${label} models — updated available options in JobLens.`;
    }
    await writeNotice({
      message: notice,
      updatedAt: new Date().toISOString(),
      provider,
    });
  }

  return {
    provider,
    models: merged,
    changed,
    modelSwitched,
    previousModel,
    currentModel,
    refreshed: true,
    notice,
  };
}

export async function ensureModelCatalog(): Promise<ModelCatalog> {
  const catalog = await readCatalog();
  const defaults = buildDefaultModelCatalog();
  let changed = false;

  for (const provider of Object.keys(defaults) as AiProvider[]) {
    if (!catalog[provider]?.length) {
      catalog[provider] = defaults[provider];
      changed = true;
    }
  }

  if (changed) {
    await writeCatalog(catalog);
  }

  return catalog;
}
