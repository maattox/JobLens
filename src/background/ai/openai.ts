import type { AiSettings } from "../../shared/types";
import { FOLLOW_UP_SYSTEM_PROMPT, SYSTEM_PROMPT } from "../../shared/prompt";
import { createAiRequestError } from "./errors";
import type { AiCallResult, CompatibilityAiOptions, FollowUpAiOptions } from "./types";

function extractOpenAiText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text) {
    return data.output_text;
  }

  const output = data.output;
  if (!Array.isArray(output)) return "";

  for (const item of output) {
    if (
      item &&
      typeof item === "object" &&
      (item as { type?: string }).type === "message"
    ) {
      const content = (item as { content?: unknown[] }).content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (
          block &&
          typeof block === "object" &&
          (block as { type?: string }).type === "output_text" &&
          typeof (block as { text?: string }).text === "string"
        ) {
          return (block as { text: string }).text;
        }
      }
    }
  }

  return "";
}

export async function callOpenAiCompatibility(
  settings: AiSettings,
  options: CompatibilityAiOptions
): Promise<AiCallResult> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        store: true,
        instructions: SYSTEM_PROMPT,
        input: options.userPrompt,
        text: { format: { type: "json_object" } },
      }),
    });
  } catch {
    throw createAiRequestError("openai", 0, "network error");
  }

  if (!response.ok) {
    const err = await response.text();
    throw createAiRequestError("openai", response.status, err);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return {
    text: extractOpenAiText(data),
    conversation: {
      provider: "openai",
      openaiResponseId: String(data.id || ""),
      createdAt: new Date().toISOString(),
    },
  };
}

export async function callOpenAiFollowUp(
  settings: AiSettings,
  options: FollowUpAiOptions
): Promise<AiCallResult> {
  const previousId = options.conversation?.openaiResponseId;
  const body = previousId
    ? {
        model: settings.model,
        store: true,
        instructions: FOLLOW_UP_SYSTEM_PROMPT,
        previous_response_id: previousId,
        input: options.question,
      }
    : {
        model: settings.model,
        store: true,
        instructions: FOLLOW_UP_SYSTEM_PROMPT,
        input: options.rebuildPrompt || options.question,
      };

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw createAiRequestError("openai", 0, "network error");
  }

  if (!response.ok) {
    const err = await response.text();
    throw createAiRequestError("openai", response.status, err);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return {
    text: extractOpenAiText(data),
    conversation: {
      provider: "openai",
      openaiResponseId: String(data.id || previousId || ""),
      createdAt: options.conversation?.createdAt || new Date().toISOString(),
    },
  };
}

/** Legacy chat-completions path for resume extraction. */
export async function callOpenAi(
  settings: AiSettings,
  userPrompt: string
): Promise<string> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch {
    throw createAiRequestError("openai", 0, "network error");
  }

  if (!response.ok) {
    const err = await response.text();
    throw createAiRequestError("openai", response.status, err);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}
