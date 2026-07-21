import type { AiProvider } from "../../shared/types";

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
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

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
  const response = await fetch("https://api.anthropic.com/v1/models?limit=1000", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
  });

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

async function listGeminiModels(apiKey: string): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const data = await response.json();
  return Array.isArray(data.models)
    ? data.models
        .map((item: { name?: string }) => item.name)
        .filter((name: unknown): name is string => typeof name === "string")
    : [];
}
