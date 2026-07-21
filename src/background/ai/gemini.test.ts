import { describe, expect, it, vi, afterEach } from "vitest";
import type { AiSettings } from "../../shared/types";
import { callGeminiCompatibility } from "./gemini";

describe("callGeminiCompatibility", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends Interactions response_format instead of response_mime_type", async () => {
    const settings: AiSettings = {
      provider: "gemini",
      apiKey: "test-key",
      model: "gemini-3.6-flash",
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "int_123",
        output_text: '{"overallScore":80}',
        steps: [
          {
            type: "model_output",
            content: [{ type: "text", text: '{"overallScore":80}' }],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callGeminiCompatibility(settings, {
      mode: "compatibility",
      userPrompt: "test prompt",
    });

    expect(result.text).toContain("overallScore");
    expect(result.conversation?.geminiInteractionId).toBe("int_123");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));

    expect(body.generation_config).toEqual({ thinking_level: "low" });
    expect(body.generation_config?.response_mime_type).toBeUndefined();
    expect(body.response_format).toEqual(
      expect.objectContaining({
        type: "text",
        mime_type: "application/json",
      })
    );
    expect(init.headers).toEqual(
      expect.objectContaining({
        "Content-Type": "application/json",
        "Api-Revision": "2026-05-20",
      })
    );
    expect(body.system_instruction).toBeTruthy();
    expect(body.input).toBe("test prompt");
  });

  it("extracts text from steps when output_text is missing", async () => {
    const settings: AiSettings = {
      provider: "gemini",
      apiKey: "test-key",
      model: "gemini-3.6-flash",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "int_456",
          steps: [
            {
              type: "model_output",
              content: [{ type: "text", text: '{"overallScore":70}' }],
            },
          ],
        }),
      })
    );

    const result = await callGeminiCompatibility(settings, {
      mode: "compatibility",
      userPrompt: "test",
    });

    expect(result.text).toBe('{"overallScore":70}');
  });
});
