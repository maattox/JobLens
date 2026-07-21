#!/usr/bin/env node
/**
 * Sync curated JobLens AI model defaults.
 *
 * Usage (from repo root):
 *   npm run sync:models
 *
 * Optional live API intersection (uses your own keys; never committed):
 *   set OPENAI_API_KEY=...
 *   set ANTHROPIC_API_KEY=...
 *   set GEMINI_API_KEY=...   (or GOOGLE_API_KEY)
 *   npm run sync:models
 *
 * Without keys, the script refreshes `src/shared/aiModelDefaults.ts` from the
 * built-in general-use candidate lists (and paid-only exclusions).
 *
 * Provider Models APIs are the best available signal for key-scoped access, but
 * Gemini's list endpoint can still return paid-only models on free-tier keys.
 * Those are filtered via GEMINI_PAID_ONLY_MODELS.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const defaultsPath = join(root, "src", "shared", "aiModelDefaults.ts");

/** General-use chat models we are willing to surface in the extension UI. */
const CANDIDATES = {
  openai: ["gpt-5.6", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.4-mini"],
  anthropic: ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-4-8"],
  gemini: ["gemini-3.6-flash", "gemini-3.5-flash-lite"],
};

const DEFAULTS = {
  openai: "gpt-5.6",
  anthropic: "claude-haiku-4-5",
  gemini: "gemini-3.6-flash",
};

const FIELD_EXTRACT = {
  openai: "gpt-5.6-luna",
  anthropic: "claude-haiku-4-5",
  gemini: "gemini-3.5-flash-lite",
};

const GEMINI_PAID_ONLY = [
  "gemini-3.1-pro-preview",
  "gemini-3.1-pro-preview-customtools",
  "gemini-3-pro-preview",
  "gemini-2.5-pro",
];

function stripGeminiName(name) {
  return String(name || "").replace(/^models\//i, "").trim();
}

async function listOpenAi(apiKey) {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`OpenAI models.list failed: ${response.status}`);
  }
  const data = await response.json();
  return (data.data || [])
    .map((item) => item.id)
    .filter((id) => typeof id === "string");
}

async function listAnthropic(apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/models?limit=1000", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!response.ok) {
    throw new Error(`Anthropic models.list failed: ${response.status}`);
  }
  const data = await response.json();
  return (data.data || [])
    .map((item) => item.id)
    .filter((id) => typeof id === "string");
}

async function listGemini(apiKey) {
  const ids = [];
  let pageToken = "";
  do {
    const url = new URL(
      "https://generativelanguage.googleapis.com/v1beta/models"
    );
    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Gemini models.list failed: ${response.status}`);
    }
    const data = await response.json();
    for (const model of data.models || []) {
      const methods = model.supportedGenerationMethods || [];
      if (!methods.includes("generateContent")) continue;
      const id = stripGeminiName(model.name);
      if (id) ids.push(id);
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return ids;
}

function intersect(candidates, liveIds, paidOnly = []) {
  if (!liveIds) return [...candidates];
  const live = new Set(liveIds.map((id) => id.toLowerCase()));
  const blocked = new Set(paidOnly.map((id) => id.toLowerCase()));
  return candidates.filter(
    (id) => live.has(id.toLowerCase()) && !blocked.has(id.toLowerCase())
  );
}

function renderDefaults(options) {
  const fmtList = (arr) =>
    `[${arr.map((id) => `"${id}"`).join(", ")}]`;

  return `/**
 * Curated general-use chat models shown in JobLens.
 * Updated by \`npm run sync:models\` (see scripts/sync-ai-models.mjs).
 *
 * Runtime catalog sync intersects these with each provider's Models API for the
 * user's API key. Provider list endpoints do not always omit paid-only models
 * (Gemini free tier can still list Pro), so paid-only exclusions below still apply.
 */
export const AI_MODEL_OPTIONS = {
  openai: ${fmtList(options.openai)},
  anthropic: ${fmtList(options.anthropic)},
  gemini: ${fmtList(options.gemini)},
} as const satisfies Record<"openai" | "anthropic" | "gemini", readonly string[]>;

/** Default model when a provider is first selected / installed. */
export const DEFAULT_MODEL_BY_PROVIDER = {
  openai: "${options.defaults.openai}",
  anthropic: "${options.defaults.anthropic}",
  gemini: "${options.defaults.gemini}",
} as const satisfies Record<"openai" | "anthropic" | "gemini", string>;

/** Preferred cheap/fast models for the ZipRecruiter/LinkedIn field-extract pass. */
export const DEFAULT_FIELD_EXTRACT_MODELS = {
  openai: "${options.fieldExtract.openai}",
  anthropic: "${options.fieldExtract.anthropic}",
  gemini: "${options.fieldExtract.gemini}",
} as const satisfies Record<"openai" | "anthropic" | "gemini", string>;

/**
 * Models that appear in Gemini's Models API for free-tier keys but are not
 * available on the free tier per https://ai.google.dev/gemini-api/docs/pricing
 */
export const GEMINI_PAID_ONLY_MODELS = [
${GEMINI_PAID_ONLY.map((id) => `  "${id}",`).join("\n")}
] as const;
`;
}

function pickDefault(list, preferred) {
  if (list.includes(preferred)) return preferred;
  return list[0] || preferred;
}

async function main() {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const geminiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();

  let openaiLive = null;
  let anthropicLive = null;
  let geminiLive = null;

  if (openaiKey) {
    console.log("Fetching OpenAI models…");
    openaiLive = await listOpenAi(openaiKey);
  } else {
    console.log("OPENAI_API_KEY not set — keeping curated OpenAI candidates.");
  }

  if (anthropicKey) {
    console.log("Fetching Anthropic models…");
    anthropicLive = await listAnthropic(anthropicKey);
  } else {
    console.log("ANTHROPIC_API_KEY not set — keeping curated Anthropic candidates.");
  }

  if (geminiKey) {
    console.log("Fetching Gemini models…");
    geminiLive = await listGemini(geminiKey);
  } else {
    console.log("GEMINI_API_KEY/GOOGLE_API_KEY not set — keeping curated Gemini candidates.");
  }

  const openai = intersect(CANDIDATES.openai, openaiLive);
  const anthropic = intersect(CANDIDATES.anthropic, anthropicLive);
  const gemini = intersect(CANDIDATES.gemini, geminiLive, GEMINI_PAID_ONLY);

  if (!openai.length || !anthropic.length || !gemini.length) {
    console.error("Refusing to write empty provider lists after intersection.");
    console.error({ openai, anthropic, gemini });
    process.exit(1);
  }

  const next = {
    openai,
    anthropic,
    gemini,
    defaults: {
      openai: pickDefault(openai, DEFAULTS.openai),
      anthropic: pickDefault(anthropic, DEFAULTS.anthropic),
      gemini: pickDefault(gemini, DEFAULTS.gemini),
    },
    fieldExtract: {
      openai: pickDefault(openai, FIELD_EXTRACT.openai),
      anthropic: pickDefault(anthropic, FIELD_EXTRACT.anthropic),
      gemini: pickDefault(gemini, FIELD_EXTRACT.gemini),
    },
  };

  const previous = readFileSync(defaultsPath, "utf8");
  const rendered = renderDefaults(next);
  writeFileSync(defaultsPath, rendered, "utf8");

  console.log("\nUpdated", defaultsPath.replace(root + "\\", "").replace(root + "/", ""));
  console.log("OpenAI:", next.openai.join(", "));
  console.log("Anthropic:", next.anthropic.join(", "));
  console.log("Gemini:", next.gemini.join(", "));
  console.log("Defaults:", next.defaults);
  console.log("Field extract:", next.fieldExtract);

  if (previous === rendered) {
    console.log("\nNo content changes.");
  } else {
    console.log("\nFile changed. Rebuild the extension (`npm run build`) to ship the update.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
