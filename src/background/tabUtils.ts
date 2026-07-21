function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("could not establish connection") ||
    message.includes("receiving end does not exist")
  );
}

export interface TabLike {
  id?: number;
  url?: string;
  pendingUrl?: string;
}

export function getTabPageUrl(tab: TabLike): string | undefined {
  return tab.url || tab.pendingUrl;
}

export function isInjectableUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

export function pickInjectableTab<T extends TabLike>(tabs: T[]): T | undefined {
  return tabs.find((tab) => isInjectableUrl(getTabPageUrl(tab)));
}

export function assertInjectableTab(
  tab: TabLike | undefined
): asserts tab is TabLike & { id: number } {
  if (!tab?.id) {
    throw new Error(
      "No active browser tab found. Open a job listing page and try again."
    );
  }

  const pageUrl = getTabPageUrl(tab);
  if (!isInjectableUrl(pageUrl)) {
    throw new Error(
      pageUrl
        ? `This page (${pageUrl}) is not a web job listing. Open an http or https job listing tab and try again.`
        : "Could not read the active page URL. Focus a job listing tab (http or https) and try again."
    );
  }
}

export async function getActiveJobTab(): Promise<chrome.tabs.Tab> {
  const [focusedTab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  if (focusedTab?.id && isInjectableUrl(getTabPageUrl(focusedTab))) {
    return focusedTab;
  }

  const injectableTab = pickInjectableTab(
    await chrome.tabs.query({ active: true, windowType: "normal" })
  );
  if (injectableTab?.id) {
    return injectableTab;
  }

  if (focusedTab?.id) {
    return focusedTab;
  }

  throw new Error(
    "No active browser tab found. Open a job listing page and try again."
  );
}

export async function resolveJobTab(tabId?: number): Promise<chrome.tabs.Tab> {
  const tab =
    typeof tabId === "number"
      ? await chrome.tabs.get(tabId)
      : await getActiveJobTab();

  assertInjectableTab(tab);
  return tab;
}

export async function injectContentScript(tabId: number): Promise<void> {
  const manifest = chrome.runtime.getManifest();
  const files = manifest.content_scripts?.[0]?.js;

  if (!files?.length) {
    throw new Error("Content script is not registered in the extension manifest.");
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [...files],
  });
}

export async function sendTabMessage<T>(
  tabId: number,
  message: unknown
): Promise<T> {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    if (!isConnectionError(error)) {
      throw error;
    }

    await injectContentScript(tabId);
    return await chrome.tabs.sendMessage(tabId, message);
  }
}
