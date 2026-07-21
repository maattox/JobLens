import type { AiSettings } from "../../shared/types";
import { FOLLOW_UP_SYSTEM_PROMPT, SYSTEM_PROMPT } from "../../shared/prompt";
import { createAiRequestError } from "./errors";
import type { AiCallResult, CompatibilityAiOptions, FollowUpAiOptions } from "./types";

function extractAnthropicText(data: Record<string, unknown>): string {
  const content = data.content;
  if (!Array.isArray(content)) return "";
  const block = content.find(
    (item) =>
      item &&
      typeof item === "object" &&
      (item as { type?: string }).type === "text"
  ) as { text?: string } | undefined;
  return block?.text || "";
}

export async function callAnthropicCompatibility(
  settings: AiSettings,
  options: CompatibilityAiOptions
): Promise<AiCallResult> {
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 4096,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: options.userPrompt,
                cache_control: { type: "ephemeral" },
              },
            ],
          },
        ],
      }),
    });
  } catch {
    throw createAiRequestError("anthropic", 0, "network error");
  }

  if (!response.ok) {
    const err = await response.text();
    throw createAiRequestError("anthropic", response.status, err);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const text = extractAnthropicText(data);

  return {
    text,
    conversation: {
      provider: "anthropic",
      anthropicMessages: [
        { role: "user", content: options.userPrompt },
        { role: "assistant", content: text },
      ],
      createdAt: new Date().toISOString(),
    },
  };
}

export async function callAnthropicFollowUp(
  settings: AiSettings,
  options: FollowUpAiOptions
): Promise<AiCallResult> {
  const prior = options.conversation?.anthropicMessages;
  const messages = prior?.length
    ? [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prior[0].content,
              cache_control: { type: "ephemeral" },
            },
          ],
        },
        { role: "assistant", content: prior[1]?.content || "" },
        ...(prior.slice(2) as Array<{ role: string; content: string }>),
        { role: "user", content: options.question },
      ]
    : [{ role: "user", content: options.rebuildPrompt || options.question }];

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 4096,
        temperature: 0.2,
        system: FOLLOW_UP_SYSTEM_PROMPT,
        messages,
      }),
    });
  } catch {
    throw createAiRequestError("anthropic", 0, "network error");
  }

  if (!response.ok) {
    const err = await response.text();
    throw createAiRequestError("anthropic", response.status, err);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const text = extractAnthropicText(data);

  const nextMessages = prior?.length
    ? [
        ...prior,
        { role: "user" as const, content: options.question },
        { role: "assistant" as const, content: text },
      ]
    : [
        { role: "user" as const, content: options.rebuildPrompt || options.question },
        { role: "assistant" as const, content: text },
      ];

  return {
    text,
    conversation: {
      provider: "anthropic",
      anthropicMessages: nextMessages,
      createdAt: options.conversation?.createdAt || new Date().toISOString(),
    },
  };
}

/** Legacy messages path for resume extraction. */
export async function callAnthropic(
  settings: AiSettings,
  userPrompt: string
): Promise<string> {
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": settings.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 4096,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
  } catch {
    throw createAiRequestError("anthropic", 0, "network error");
  }

  if (!response.ok) {
    const err = await response.text();
    throw createAiRequestError("anthropic", response.status, err);
  }

  const data = await response.json();
  const block = data.content?.find((item: { type: string }) => item.type === "text");
  return block?.text || "";
}
