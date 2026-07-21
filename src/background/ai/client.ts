import { STORAGE_KEYS } from "../../shared/storage";
import type { AiProvider, AiSettings } from "../../shared/types";
import {
  callAnthropic,
  callAnthropicCompatibility,
  callAnthropicFollowUp,
} from "./anthropic";
import {
  ensureModelCatalog,
  getModelsForProvider,
  refreshProviderCatalog,
} from "./catalog";
import {
  AiRequestError,
  misconfiguredMessage,
  toUserMessage,
} from "./errors";
import {
  callGemini,
  callGeminiCompatibility,
  callGeminiFollowUp,
} from "./gemini";
import {
  callOpenAi,
  callOpenAiCompatibility,
  callOpenAiFollowUp,
} from "./openai";
import type {
  AiCallResult,
  CompatibilityAiOptions,
  FollowUpAiOptions,
} from "./types";

async function invokeProvider(
  settings: AiSettings,
  userPrompt: string
): Promise<string> {
  switch (settings.provider) {
    case "openai":
      return callOpenAi(settings, userPrompt);
    case "anthropic":
      return callAnthropic(settings, userPrompt);
    case "gemini":
      return callGemini(settings, userPrompt);
    default:
      throw new Error(`Unsupported AI provider: ${settings.provider}`);
  }
}

async function invokeCompatibility(
  settings: AiSettings,
  options: CompatibilityAiOptions
): Promise<AiCallResult> {
  switch (settings.provider) {
    case "openai":
      return callOpenAiCompatibility(settings, options);
    case "anthropic":
      return callAnthropicCompatibility(settings, options);
    case "gemini":
      return callGeminiCompatibility(settings, options);
    default:
      throw new Error(`Unsupported AI provider: ${settings.provider}`);
  }
}

async function invokeFollowUp(
  settings: AiSettings,
  options: FollowUpAiOptions
): Promise<AiCallResult> {
  switch (settings.provider) {
    case "openai":
      return callOpenAiFollowUp(settings, options);
    case "anthropic":
      return callAnthropicFollowUp(settings, options);
    case "gemini":
      return callGeminiFollowUp(settings, options);
    default:
      throw new Error(`Unsupported AI provider: ${settings.provider}`);
  }
}

async function persistModel(
  provider: AiProvider,
  model: string
): Promise<AiSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.aiSettings);
  const current = (result[STORAGE_KEYS.aiSettings] as AiSettings | undefined) ?? {
    provider,
    apiKey: "",
    model,
  };
  const next = { ...current, provider, model };
  await chrome.storage.local.set({ [STORAGE_KEYS.aiSettings]: next });
  return next;
}

/** Prefer a single cheaper/faster fallback instead of burning the whole catalog. */
function pickCapacityFallback(
  provider: AiProvider,
  catalog: string[],
  currentModel: string
): string | null {
  const candidates = catalog.filter((model) => model && model !== currentModel);
  if (!candidates.length) return null;

  const patterns: RegExp[] =
    provider === "openai"
      ? [/luna/i, /mini/i, /nano/i]
      : provider === "anthropic"
        ? [/haiku/i]
        : [/flash-lite/i, /lite/i];

  for (const pattern of patterns) {
    const match = candidates.find((id) => pattern.test(id));
    if (match) return match;
  }

  return candidates[0] ?? null;
}

export interface CallAiProviderOptions {
  /**
   * When true (default), model_not_found replacements are written to aiSettings.
   * Field-extract calls should set false so the user's compatibility model is unchanged.
   */
  persistModelReplacement?: boolean;
  /**
   * When false, model_not_found is rethrown after refreshing the provider catalog
   * so the caller can pick a new lite/preferred model. Default true.
   */
  recoverOnModelNotFound?: boolean;
}

async function recoverFromModelNotFound<T>(
  settings: AiSettings,
  error: AiRequestError,
  run: (active: AiSettings) => Promise<T>,
  persistReplacement: boolean
): Promise<T> {
  let refreshed: string[];
  try {
    refreshed = await refreshProviderCatalog(settings.provider, settings.apiKey);
  } catch {
    throw new AiRequestError(
      "unknown",
      settings.provider,
      error.status,
      error.body,
      misconfiguredMessage(settings.provider)
    );
  }

  if (refreshed.includes(settings.model)) {
    throw new AiRequestError(
      "unknown",
      settings.provider,
      error.status,
      error.body,
      misconfiguredMessage(settings.provider)
    );
  }

  const replacement =
    refreshed.find((model) => model !== settings.model) ?? refreshed[0];
  if (!replacement) {
    throw new AiRequestError(
      "model_not_found",
      settings.provider,
      error.status,
      error.body,
      toUserMessage("model_not_found", settings.provider)
    );
  }

  const nextSettings = persistReplacement
    ? await persistModel(settings.provider, replacement)
    : { ...settings, model: replacement };

  try {
    return await run(nextSettings);
  } catch (retryError) {
    if (retryError instanceof AiRequestError) {
      throw new AiRequestError(
        "unknown",
        settings.provider,
        retryError.status,
        retryError.body,
        misconfiguredMessage(settings.provider)
      );
    }
    throw retryError;
  }
}

async function tryModels(
  settings: AiSettings,
  userPrompt: string,
  models: string[]
): Promise<string> {
  let lastError: AiRequestError | null = null;

  for (const model of models) {
    if (!model || model === settings.model) {
      continue;
    }

    try {
      const result = await invokeProvider({ ...settings, model }, userPrompt);
      await persistModel(settings.provider, model);
      return result;
    } catch (error) {
      if (error instanceof AiRequestError) {
        lastError = error;
        if (error.kind === "auth" || error.kind === "invalid_request") {
          throw error;
        }
        continue;
      }
      throw error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new AiRequestError(
    "capacity",
    settings.provider,
    503,
    "",
    toUserMessage("capacity", settings.provider)
  );
}

async function withModelRecovery<T>(
  settings: AiSettings,
  run: (active: AiSettings) => Promise<T>,
  persistReplacement = true
): Promise<T> {
  try {
    return await run(settings);
  } catch (error) {
    if (!(error instanceof AiRequestError)) {
      throw error;
    }

    if (error.kind === "model_not_found") {
      return recoverFromModelNotFound(settings, error, run, persistReplacement);
    }

    if (error.kind === "capacity") {
      const catalog = await getModelsForProvider(settings.provider);
      const fallback = pickCapacityFallback(
        settings.provider,
        catalog,
        settings.model
      );
      if (!fallback) {
        throw error;
      }

      try {
        return await run({ ...settings, model: fallback });
      } catch (retryError) {
        if (
          retryError instanceof AiRequestError &&
          retryError.kind !== "capacity"
        ) {
          throw retryError;
        }
        throw error;
      }
    }

    throw error;
  }
}

export async function callAiProvider(
  settings: AiSettings,
  userPrompt: string,
  options?: CallAiProviderOptions
): Promise<string> {
  if (!settings.apiKey.trim()) {
    throw new Error("API key is missing. Add your key in Settings.");
  }

  const persistReplacement = options?.persistModelReplacement !== false;
  const recoverOnModelNotFound = options?.recoverOnModelNotFound !== false;
  await ensureModelCatalog();

  try {
    return await invokeProvider(settings, userPrompt);
  } catch (error) {
    if (!(error instanceof AiRequestError)) {
      throw error;
    }

    if (error.kind === "model_not_found") {
      if (!recoverOnModelNotFound) {
        try {
          await refreshProviderCatalog(settings.provider, settings.apiKey);
        } catch {
          // Caller still receives the original model_not_found error.
        }
        throw error;
      }

      return recoverFromModelNotFound(
        settings,
        error,
        (active) => invokeProvider(active, userPrompt),
        persistReplacement
      );
    }

    if (error.kind === "capacity") {
      const catalog = await getModelsForProvider(settings.provider);
      const fallback = pickCapacityFallback(
        settings.provider,
        catalog,
        settings.model
      );
      if (!fallback) {
        throw error;
      }

      return tryModels(settings, userPrompt, [fallback]);
    }

    throw error;
  }
}

export async function callCompatibilityAi(
  settings: AiSettings,
  userPrompt: string
): Promise<AiCallResult> {
  if (!settings.apiKey.trim()) {
    throw new Error("API key is missing. Add your key in Settings.");
  }

  await ensureModelCatalog();
  return withModelRecovery(settings, (active) =>
    invokeCompatibility(active, { mode: "compatibility", userPrompt })
  );
}

export async function callFollowUpAi(
  settings: AiSettings,
  options: FollowUpAiOptions
): Promise<AiCallResult> {
  if (!settings.apiKey.trim()) {
    throw new Error("API key is missing. Add your key in Settings.");
  }

  await ensureModelCatalog();
  return withModelRecovery(settings, (active) => invokeFollowUp(active, options));
}
