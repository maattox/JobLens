import type { AiConversationContext, AiSettings } from "../../shared/types";

export interface AiCallResult {
  text: string;
  conversation?: AiConversationContext;
}

export interface CompatibilityAiOptions {
  mode: "compatibility";
  userPrompt: string;
}

export interface FollowUpAiOptions {
  mode: "followUp";
  question: string;
  conversation?: AiConversationContext;
  rebuildPrompt?: string;
}

export type StructuredAiOptions = CompatibilityAiOptions | FollowUpAiOptions;

export function isSessionExpiredError(
  provider: AiSettings["provider"],
  status: number,
  body: string
): boolean {
  const lower = body.toLowerCase();
  if (provider === "openai") {
    return (
      status === 404 ||
      lower.includes("previous_response_not_found") ||
      lower.includes("response not found")
    );
  }
  if (provider === "gemini") {
    return (
      status === 404 ||
      lower.includes("interaction not found") ||
      lower.includes("previous_interaction_id")
    );
  }
  return false;
}
