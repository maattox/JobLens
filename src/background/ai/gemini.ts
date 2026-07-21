import type { AiSettings } from "../../shared/types";
import { FOLLOW_UP_SYSTEM_PROMPT, SYSTEM_PROMPT } from "../../shared/prompt";
import { debugError, debugInfo } from "../../shared/debug";
import { createAiRequestError } from "./errors";
import { fetchWithTimeout } from "./fetchWithTimeout";
import type { AiCallResult, CompatibilityAiOptions, FollowUpAiOptions } from "./types";

const INTERACTIONS_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

/** Required for the post–May 2026 Interactions request/response schema. */
const GEMINI_API_REVISION = "2026-05-20";

/**
 * Prefer `low` over `minimal`. Google docs note that `minimal` can 400 when
 * thought signatures are expected; `low` is the safe fast tier for structured JSON.
 */
const GEMINI_THINKING_LEVEL = "low";

/** JSON Schema for compatibility reports (Interactions API response_format). */
const COMPATIBILITY_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    overallScore: { type: "number" },
    categoryScores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          score: { type: "number" },
          summaryBullets: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["label", "score", "summaryBullets"],
      },
    },
    summaryBullets: {
      type: "array",
      items: { type: "string" },
    },
    missingQualifications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          severity: { type: "string", enum: ["easyToLearn", "majorGap"] },
        },
        required: ["item", "severity"],
      },
    },
    actionableAdvice: {
      type: "array",
      items: { type: "string" },
    },
    jobFieldCorrections: {
      type: "object",
      properties: {
        title: { type: "string" },
        company: { type: "string" },
        location: { type: "string" },
        salary: { type: "string" },
        workMode: { type: "string" },
        employmentType: { type: "string" },
      },
    },
  },
  required: [
    "overallScore",
    "categoryScores",
    "summaryBullets",
    "missingQualifications",
  ],
};

function interactionsUrl(apiKey: string): string {
  return `${INTERACTIONS_URL}?key=${encodeURIComponent(apiKey)}`;
}

function extractGeminiText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const steps = data.steps;
  if (!Array.isArray(steps)) return "";

  const texts: string[] = [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (!step || typeof step !== "object") continue;
    const typed = step as { type?: string; content?: unknown[] };
    if (typed.type !== "model_output" || !Array.isArray(typed.content)) continue;

    for (const part of typed.content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: string }).type === "text" &&
        typeof (part as { text?: string }).text === "string"
      ) {
        texts.push((part as { text: string }).text);
      }
    }
    if (texts.length) break;
  }

  return texts.reverse().join("");
}

async function postInteraction(
  settings: AiSettings,
  body: Record<string, unknown>
): Promise<AiCallResult> {
  let response: Response;
  try {
    response = await fetchWithTimeout(interactionsUrl(settings.apiKey), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Revision": GEMINI_API_REVISION,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    debugError("background", "gemini", "Interactions request network failure", {
      model: settings.model,
      message,
    });
    throw createAiRequestError("gemini", 0, message);
  }

  if (!response.ok) {
    const err = await response.text();
    debugError("background", "gemini", "Interactions request rejected", {
      model: settings.model,
      status: response.status,
      bodyPreview: err.slice(0, 1500),
    });
    throw createAiRequestError("gemini", response.status, err);
  }

  const data = (await response.json()) as Record<string, unknown>;
  debugInfo("background", "gemini", "Interactions request completed", {
    model: settings.model,
    interactionId: String(data.id || ""),
  });
  return {
    text: extractGeminiText(data),
    conversation: {
      provider: "gemini",
      geminiInteractionId: String(data.id || ""),
      createdAt: new Date().toISOString(),
    },
  };
}

export async function callGeminiCompatibility(
  settings: AiSettings,
  options: CompatibilityAiOptions
): Promise<AiCallResult> {
  return postInteraction(settings, {
    model: settings.model,
    input: options.userPrompt,
    store: true,
    system_instruction: SYSTEM_PROMPT,
    generation_config: {
      thinking_level: GEMINI_THINKING_LEVEL,
    },
    // May 2026+: response_mime_type was removed; use top-level response_format.
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: COMPATIBILITY_RESPONSE_SCHEMA,
    },
  });
}

export async function callGeminiFollowUp(
  settings: AiSettings,
  options: FollowUpAiOptions
): Promise<AiCallResult> {
  const previousId = options.conversation?.geminiInteractionId;

  const body = previousId
    ? {
        model: settings.model,
        input: options.question,
        previous_interaction_id: previousId,
        store: true,
        system_instruction: FOLLOW_UP_SYSTEM_PROMPT,
        generation_config: { thinking_level: GEMINI_THINKING_LEVEL },
      }
    : {
        model: settings.model,
        input: options.rebuildPrompt || options.question,
        store: true,
        system_instruction: FOLLOW_UP_SYSTEM_PROMPT,
        generation_config: { thinking_level: GEMINI_THINKING_LEVEL },
      };

  const result = await postInteraction(settings, body);
  return {
    ...result,
    conversation: {
      provider: "gemini",
      geminiInteractionId:
        result.conversation?.geminiInteractionId || previousId || "",
      createdAt:
        options.conversation?.createdAt ||
        result.conversation?.createdAt ||
        new Date().toISOString(),
    },
  };
}

/** Legacy generateContent path for resume extraction / field extract. */
export async function callGemini(
  settings: AiSettings,
  userPrompt: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          // generateContent uses uppercase enum values.
          thinkingConfig: { thinkingLevel: "LOW" },
          responseMimeType: "application/json",
        },
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    debugError("background", "gemini", "generateContent network failure", {
      model: settings.model,
      message,
    });
    throw createAiRequestError("gemini", 0, message);
  }

  if (!response.ok) {
    const err = await response.text();
    debugError("background", "gemini", "generateContent rejected", {
      model: settings.model,
      status: response.status,
      bodyPreview: err.slice(0, 1500),
    });
    throw createAiRequestError("gemini", response.status, err);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
