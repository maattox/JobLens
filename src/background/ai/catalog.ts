import {
  buildDefaultModelCatalog,
  mergeModelCatalog,
  normalizeModelCatalog,
} from "../../shared/modelCatalog";
import { STORAGE_KEYS } from "../../shared/storage";
import type { AiProvider, ModelCatalog } from "../../shared/types";
import { listProviderModels } from "./listModels";

async function readCatalog(): Promise<ModelCatalog> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.modelCatalog);
  return normalizeModelCatalog(result[STORAGE_KEYS.modelCatalog]);
}

async function writeCatalog(catalog: ModelCatalog): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.modelCatalog]: catalog });
}

export async function getModelCatalog(): Promise<ModelCatalog> {
  return readCatalog();
}

export async function getModelsForProvider(provider: AiProvider): Promise<string[]> {
  const catalog = await readCatalog();
  return catalog[provider];
}

export async function refreshProviderCatalog(
  provider: AiProvider,
  apiKey: string
): Promise<string[]> {
  const apiIds = await listProviderModels(provider, apiKey);
  const merged = mergeModelCatalog(provider, apiIds);
  const catalog = await readCatalog();
  catalog[provider] = merged;
  await writeCatalog(catalog);
  return merged;
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
