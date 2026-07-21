import type { AiProvider } from "../../shared/types";
import { AI_LIST_MODELS_TIMEOUT_MS, fetchWithTimeout } from "./fetchWithTimeout";

async function readError(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export async function listProviderModels(
  provider: AiProvider,
  apiKey: string
): Promise<string[]> {
  if (!apiKey.trim()) {
    return [];
  }

  switch (provider) {
    case "openai":
      return listOpenAiModels(apiKey);
    case "anthropic":
      return listAnthropicModels(apiKey);
    case "gemini":
      return listGeminiModels(apiKey);
    default:
      return [];
  }
}

async function listOpenAiModels(apiKey: string): Promise<string[]> {
  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/models",
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
    AI_LIST_MODELS_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const data = await response.json();
  return Array.isArray(data.data)
    ? data.data
        .map((item: { id?: string }) => item.id)
        .filter((id: unknown): id is string => typeof id === "string")
    : [];
}

async function listAnthropicModels(apiKey: string): Promise<string[]> {
  const response = await fetchWithTimeout(
    "https://api.anthropic.com/v1/models?limit=1000",
    {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
    },
    AI_LIST_MODELS_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const data = await response.json();
  return Array.isArray(data.data)
    ? data.data
        .map((item: { id?: string }) => item.id)
        .filter((id: unknown): id is string => typeof id === "string")
    : [];
}

type GeminiModelListItem = {
  name?: string;
  supportedGenerationMethods?: string[];
};

/**
 * List Gemini models that support generateContent (text), paging through results.
 * Media / embedding-only models are excluded upstream in modelCatalog filters.
 */
async function listGeminiModels(apiKey: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken = "";

  do {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", "100");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetchWithTimeout(
      url.toString(),
      {},
      AI_LIST_MODELS_TIMEOUT_MS
    );

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    const data = (await response.json()) as {
      models?: GeminiModelListItem[];
      nextPageToken?: string;
    };

    if (Array.isArray(data.models)) {
      for (const model of data.models) {
        if (typeof model.name !== "string" || !model.name.trim()) continue;
        const methods = model.supportedGenerationMethods ?? [];
        if (!methods.includes("generateContent")) continue;
        ids.push(model.name);
      }
    }

    pageToken =
      typeof data.nextPageToken === "string" && data.nextPageToken
        ? data.nextPageToken
        : "";
  } while (pageToken);

  return ids;
}
