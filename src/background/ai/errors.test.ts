import { describe, expect, it } from "vitest";
import {
  classifyAiError,
  createAiRequestError,
  toUserMessage,
} from "./errors";

describe("classifyAiError", () => {
  it("classifies Gemini high-demand 503 as capacity", () => {
    const body = JSON.stringify({
      error: {
        code: 503,
        message:
          "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
        status: "UNAVAILABLE",
      },
    });

    expect(classifyAiError("gemini", 503, body)).toBe("capacity");
  });

  it("classifies OpenAI model not found", () => {
    const body = JSON.stringify({
      error: {
        message: "The model `gpt-old` does not exist",
        type: "invalid_request_error",
        code: "model_not_found",
      },
    });

    expect(classifyAiError("openai", 404, body)).toBe("model_not_found");
  });

  it("classifies Anthropic 401 as auth", () => {
    expect(classifyAiError("anthropic", 401, "invalid x-api-key")).toBe("auth");
  });

  it("classifies rate limits", () => {
    expect(classifyAiError("openai", 429, "rate limit")).toBe("rate_limit");
  });
});

describe("toUserMessage", () => {
  it("returns readable capacity guidance", () => {
    const message = toUserMessage("capacity", "gemini");
    expect(message).toContain("busy");
    expect(message).not.toContain("UNAVAILABLE");
  });

  it("uses friendly message on AiRequestError", () => {
    const error = createAiRequestError("gemini", 503, '{"error":{"status":"UNAVAILABLE"}}');
    expect(error.message).toContain("busy");
  });
});
