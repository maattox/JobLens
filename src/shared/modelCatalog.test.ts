import { describe, expect, it } from "vitest";
import {
  buildDefaultModelCatalog,
  mergeModelCatalog,
  normalizeModelCatalog,
} from "../shared/modelCatalog";

describe("mergeModelCatalog", () => {
  it("keeps curated order when API ids are available", () => {
    const merged = mergeModelCatalog("openai", [
      "gpt-5.5",
      "gpt-5.4-mini",
      "dall-e-3",
    ]);

    expect(merged[0]).toBe("gpt-5.4-mini");
    expect(merged).toContain("gpt-5.5");
    expect(merged).not.toContain("dall-e-3");
  });

  it("falls back to curated list when API list is empty", () => {
    const merged = mergeModelCatalog("gemini", []);
    expect(merged).toEqual(buildDefaultModelCatalog().gemini);
  });

  it("appends extra API chat models not in curated list", () => {
    const merged = mergeModelCatalog("anthropic", [
      "claude-opus-4-8",
      "claude-sonnet-5",
      "claude-haiku-4-5",
      "claude-new-preview",
    ]);

    expect(merged.at(-1)).toBe("claude-new-preview");
  });
});

describe("normalizeModelCatalog", () => {
  it("returns defaults for invalid storage", () => {
    expect(normalizeModelCatalog(null)).toEqual(buildDefaultModelCatalog());
  });
});
