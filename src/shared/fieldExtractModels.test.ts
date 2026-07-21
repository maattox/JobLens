import { describe, expect, it } from "vitest";
import {
  DEFAULT_FIELD_EXTRACT_MODELS,
  normalizeFieldExtractModels,
  pickFieldExtractModel,
} from "./fieldExtractModels";

describe("pickFieldExtractModel", () => {
  it("returns the preferred lite model when present in the catalog", () => {
    expect(
      pickFieldExtractModel("gemini", [
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.1-pro-preview",
      ])
    ).toBe("gemini-3.5-flash-lite");
  });

  it("picks a new lite-like model when the preferred id is gone", () => {
    expect(
      pickFieldExtractModel(
        "gemini",
        ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro-preview"],
        { preferred: "gemini-3.1-flash-lite", exclude: "gemini-3.1-flash-lite" }
      )
    ).toBe("gemini-3.5-flash-lite");
  });

  it("prefers mini models for OpenAI", () => {
    expect(
      pickFieldExtractModel("openai", ["gpt-5.6", "gpt-5.6-luna", "gpt-5.4-mini"])
    ).toBe(DEFAULT_FIELD_EXTRACT_MODELS.openai);
  });
});

describe("normalizeFieldExtractModels", () => {
  it("fills defaults for missing providers", () => {
    expect(normalizeFieldExtractModels({ gemini: "gemini-new-lite" })).toEqual({
      ...DEFAULT_FIELD_EXTRACT_MODELS,
      gemini: "gemini-new-lite",
    });
  });
});
