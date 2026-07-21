import { describe, expect, it } from "vitest";
import {
  buildDefaultModelCatalog,
  mergeModelCatalog,
  normalizeModelCatalog,
} from "../shared/modelCatalog";

describe("mergeModelCatalog", () => {
  it("keeps curated order for models present in the live API list", () => {
    const merged = mergeModelCatalog("openai", [
      "gpt-5.6",
      "gpt-5.6-luna",
      "gpt-5.4-mini",
      "dall-e-3",
      "gpt-3.5-turbo",
    ]);

    expect(merged).toEqual(["gpt-5.6", "gpt-5.6-luna", "gpt-5.4-mini"]);
    expect(merged).not.toContain("dall-e-3");
    expect(merged).not.toContain("gpt-3.5-turbo");
  });

  it("falls back to curated list when API list is empty", () => {
    const merged = mergeModelCatalog("gemini", []);
    expect(merged).toEqual(buildDefaultModelCatalog().gemini);
  });

  it("does not dump every live Anthropic id when curated models are available", () => {
    const merged = mergeModelCatalog("anthropic", [
      "claude-opus-4-8",
      "claude-sonnet-5",
      "claude-haiku-4-5",
      "claude-sonnet-5-extra-preview",
    ]);

    expect(merged).toEqual([
      "claude-haiku-4-5",
      "claude-sonnet-5",
      "claude-opus-4-8",
    ]);
    expect(merged).not.toContain("claude-sonnet-5-extra-preview");
  });
});

describe("normalizeModelCatalog", () => {
  it("returns defaults for invalid storage", () => {
    expect(normalizeModelCatalog(null)).toEqual(buildDefaultModelCatalog());
  });

  it("prunes bloated stored Gemini catalogs back to curated general-use models", () => {
    const normalized = normalizeModelCatalog({
      gemini: [
        "gemini-1.5-flash",
        "gemini-2.5-flash",
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-3.1-pro-preview",
        "gemini-3-pro-image",
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
      ],
    });

    expect(normalized.gemini).toEqual([
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
    ]);
    expect(normalized.gemini).not.toContain("gemini-3.1-pro-preview");
  });
});

describe("mergeModelCatalog availability filtering", () => {
  it("keeps only curated Gemini models that exist in the live API list", () => {
    const merged = mergeModelCatalog("gemini", [
      "models/gemini-3.6-flash",
      "models/gemini-3.5-flash-lite",
      "models/gemini-3.1-pro-preview",
      "models/gemini-3.5-flash",
      "models/gemini-2.5-flash",
      "models/gemini-3-pro-image",
    ]);

    expect(merged).toEqual(["gemini-3.6-flash", "gemini-3.5-flash-lite"]);
    expect(merged).not.toContain("gemini-3.1-pro-preview");
    expect(merged).not.toContain("gemini-3.5-flash");
  });

  it("falls back to current-gen live ids when curated models are all missing", () => {
    const merged = mergeModelCatalog("gemini", [
      "models/gemini-3.5-flash",
      "models/gemini-2.5-flash",
      "models/gemini-3-pro-image",
    ]);

    expect(merged).toEqual(["gemini-3.5-flash"]);
  });

  it("excludes known Gemini paid-only models even if the list API returns them", () => {
    const merged = mergeModelCatalog("gemini", [
      "models/gemini-3.6-flash",
      "models/gemini-3.1-pro-preview",
      "models/gemini-3.5-flash-lite",
    ]);

    expect(merged).toEqual(["gemini-3.6-flash", "gemini-3.5-flash-lite"]);
  });
});
