import type { AiSettings } from "../../shared/types";
import { FOLLOW_UP_SYSTEM_PROMPT, SYSTEM_PROMPT } from "../../shared/prompt";
import { createAiRequestError } from "./errors";
import type { AiCallResult, CompatibilityAiOptions, FollowUpAiOptions } from "./types";

const INTERACTIONS_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

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
    response = await fetch(interactionsUrl(settings.apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw createAiRequestError("gemini", 0, "network error");
  }

  if (!response.ok) {
    const err = await response.text();
    throw createAiRequestError("gemini", response.status, err);
  }

  const data = (await response.json()) as Record<string, unknown>;
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
      temperature: 0.2,
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
        generation_config: { temperature: 0.2 },
      }
    : {
        model: settings.model,
        input: options.rebuildPrompt || options.question,
        store: true,
        system_instruction: FOLLOW_UP_SYSTEM_PROMPT,
        generation_config: { temperature: 0.2 },
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

/** Legacy generateContent path for resume extraction. */
export async function callGemini(
  settings: AiSettings,
  userPrompt: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;

  let response: Response;
  try {
    response = await fetch(url, {
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
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch {
    throw createAiRequestError("gemini", 0, "network error");
  }

  if (!response.ok) {
    const err = await response.text();
    throw createAiRequestError("gemini", response.status, err);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
