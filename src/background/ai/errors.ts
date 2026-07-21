import type { AiProvider } from "../../shared/types";

export type AiErrorKind =
  | "auth"
  | "model_not_found"
  | "capacity"
  | "rate_limit"
  | "invalid_request"
  | "network"
  | "unknown";

export class AiRequestError extends Error {
  readonly kind: AiErrorKind;
  readonly provider: AiProvider;
  readonly status: number;
  readonly body: string;

  constructor(
    kind: AiErrorKind,
    provider: AiProvider,
    status: number,
    body: string,
    message?: string
  ) {
    super(message ?? toUserMessage(kind, provider));
    this.name = "AiRequestError";
    this.kind = kind;
    this.provider = provider;
    this.status = status;
    this.body = body;
  }
}

function parseJsonBody(body: string): Record<string, unknown> | null {
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function messageIncludes(body: string, ...needles: string[]): boolean {
  const lower = body.toLowerCase();
  return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

export function classifyAiError(
  provider: AiProvider,
  status: number,
  body: string
): AiErrorKind {
  const parsed = parseJsonBody(body);
  const errorObj =
    parsed?.error && typeof parsed.error === "object"
      ? (parsed.error as Record<string, unknown>)
      : null;
  const errorMessage =
    typeof errorObj?.message === "string"
      ? errorObj.message
      : typeof parsed?.message === "string"
        ? parsed.message
        : body;
  const errorStatus =
    typeof errorObj?.status === "string" ? errorObj.status : "";
  const errorCode =
    typeof errorObj?.code === "string" ? errorObj.code : "";

  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  if (status === 0 || messageIncludes(body, "network error", "failed to fetch")) {
    return "network";
  }

  if (
    status === 404 ||
    errorCode === "model_not_found" ||
    messageIncludes(errorMessage, "model not found", "does not exist", "not found")
  ) {
    return "model_not_found";
  }

  if (
    status === 503 ||
    status === 529 ||
    errorStatus === "UNAVAILABLE" ||
    messageIncludes(
      body,
      "high demand",
      "overloaded",
      "capacity",
      "temporarily unavailable",
      "try again later"
    )
  ) {
    return "capacity";
  }

  if (status === 400 || status === 422) return "invalid_request";

  if (provider === "gemini" && messageIncludes(body, "API key not valid")) {
    return "auth";
  }

  if (provider === "openai" && messageIncludes(body, "invalid_api_key")) {
    return "auth";
  }

  if (provider === "anthropic" && messageIncludes(body, "invalid x-api-key")) {
    return "auth";
  }

  return "unknown";
}

export function toUserMessage(kind: AiErrorKind, provider: AiProvider): string {
  const providerLabel =
    provider === "openai"
      ? "OpenAI"
      : provider === "anthropic"
        ? "Anthropic"
        : "Google Gemini";

  switch (kind) {
    case "auth":
      return `Your ${providerLabel} API key appears invalid or unauthorized. Check Settings and make sure you pasted the correct key.`;
    case "model_not_found":
      return `The selected ${providerLabel} model is no longer available. Open Settings and choose a different model.`;
    case "capacity":
      return `The selected ${providerLabel} model is busy right now. Try again in a few minutes or switch to another model in Settings.`;
    case "rate_limit":
      return `${providerLabel} rate limit reached. Wait a moment and try again, or switch providers.`;
    case "invalid_request":
      return `The ${providerLabel} request could not be processed. Check your API key and model selection in Settings.`;
    case "network":
      return `Could not reach ${providerLabel}. Check your internet connection and try again.`;
    default:
      return `The compatibility check failed due to a ${providerLabel} API error. Verify your API key and model in Settings, then try again.`;
  }
}

export function misconfiguredMessage(provider: AiProvider): string {
  const providerLabel =
    provider === "openai"
      ? "OpenAI"
      : provider === "anthropic"
        ? "Anthropic"
        : "Google Gemini";
  return `The ${providerLabel} API is misconfigured or unavailable. Double-check your API key in Settings and try again.`;
}

export function createAiRequestError(
  provider: AiProvider,
  status: number,
  body: string
): AiRequestError {
  const kind = classifyAiError(provider, status, body);
  return new AiRequestError(kind, provider, status, body);
}
