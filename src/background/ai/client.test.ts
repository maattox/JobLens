import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "../../shared/storage";
import type { AiSettings } from "../../shared/types";
import { callCompatibilityAi } from "./client";

const settings: AiSettings = {
  provider: "openai",
  apiKey: "test-key",
  model: "gpt-old-model",
};

describe("callCompatibilityAi model recovery", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) => {
            if (key === STORAGE_KEYS.aiSettings) {
              return { [STORAGE_KEYS.aiSettings]: settings };
            }
            if (key === STORAGE_KEYS.modelCatalog) {
              return {
                [STORAGE_KEYS.modelCatalog]: {
                  openai: ["gpt-old-model", "gpt-new-model"],
                  anthropic: [],
                  gemini: [],
                },
              };
            }
            return {};
          }),
          set: vi.fn(async () => undefined),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("refreshes catalog and retries when the model is not found", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () =>
          JSON.stringify({
            error: {
              code: "model_not_found",
              message: "The model `gpt-old-model` does not exist",
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: "gpt-5.6" }, { id: "gpt-5.4-mini" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "resp_new",
          output_text: JSON.stringify({
            overallScore: 80,
            categoryScores: [],
            summaryBullets: [],
            missingQualifications: [],
          }),
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await callCompatibilityAi(settings, "test prompt");

    expect(result.text).toContain("overallScore");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.aiSettings]: expect.objectContaining({
        model: "gpt-5.6",
      }),
    });
  });

  it("returns a friendly error when catalog refresh cannot recover", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () =>
          JSON.stringify({
            error: {
              code: "model_not_found",
              message: "The model `gpt-old-model` does not exist",
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () =>
          JSON.stringify({
            error: {
              code: "model_not_found",
              message: "The model `gpt-5.4-mini` does not exist",
            },
          }),
      });

    vi.stubGlobal("fetch", fetchMock);

    await expect(callCompatibilityAi(settings, "test prompt")).rejects.toThrow(
      /model|settings/i
    );
  });
});
