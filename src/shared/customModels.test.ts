import { describe, expect, it } from "vitest";
import {
  buildEmptyCustomModels,
  buildSelectableModels,
  formatModelOptionLabel,
  normalizeCustomModels,
  normalizeModelId,
  removeCustomModel,
  upsertCustomModel,
} from "./customModels";

describe("customModels", () => {
  it("normalizes Gemini models/ prefixes", () => {
    expect(normalizeModelId("models/gemini-3.6-flash")).toBe("gemini-3.6-flash");
  });

  it("merges catalog and manual ids without duplicates", () => {
    expect(
      buildSelectableModels(["gemini-3.6-flash"], [
        {
          id: "gemini-3.6-flash",
          label: "",
          notes: "",
          createdAt: "2026-01-01",
        },
        {
          id: "gemini-experimental",
          label: "Exp",
          notes: "",
          createdAt: "2026-01-01",
        },
      ])
    ).toEqual(["gemini-3.6-flash", "gemini-experimental"]);
  });

  it("upserts and removes manual models", () => {
    let custom = buildEmptyCustomModels();
    custom = upsertCustomModel(custom, "openai", {
      id: "gpt-special",
      label: "Special",
      notes: "test",
    });
    expect(custom.openai).toHaveLength(1);
    expect(formatModelOptionLabel("gpt-special", custom.openai)).toContain(
      "Special"
    );

    custom = removeCustomModel(custom, "openai", "gpt-special");
    expect(custom.openai).toHaveLength(0);
  });

  it("normalizes stored payloads", () => {
    const normalized = normalizeCustomModels({
      openai: [{ id: "  gpt-x  ", label: "X" }],
      anthropic: "bad",
      gemini: [{ id: "models/gemini-y" }, { id: "gemini-y" }],
    });
    expect(normalized.openai[0].id).toBe("gpt-x");
    expect(normalized.anthropic).toEqual([]);
    expect(normalized.gemini).toHaveLength(1);
    expect(normalized.gemini[0].id).toBe("gemini-y");
  });
});
