/** Default timeout for provider HTTP calls (avoids indefinite hangs). */
export const AI_FETCH_TIMEOUT_MS = 180_000;
/** Shorter timeout for model-list endpoints. */
export const AI_LIST_MODELS_TIMEOUT_MS = 30_000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = AI_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (init.signal) {
    if (init.signal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      init.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      throw new Error("network error: request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
