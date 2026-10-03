import type { JobObject } from "./types";

export function getJobKey(
  job: Pick<JobObject, "jobNumber" | "title" | "salary" | "company" | "url">
): string {
  if (job.jobNumber) return `jobNumber:${job.jobNumber}`;
  return `meta:${job.title}|${job.salary}|${job.company}|${job.url}`;
}

export interface HistoryLookupItem {
  key: string;
  url: string;
  job?: { url?: string };
}

/** Compare listing addresses without hash or a trailing slash. */
export function normalizeListingUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    url.hash = "";
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.href;
  } catch {
    return trimmed;
  }
}

export function findHistoryItemByListingUrl<T extends HistoryLookupItem>(
  pageUrl: string,
  history: T[]
): T | undefined {
  const target = normalizeListingUrl(pageUrl);
  if (!target) return undefined;
  return history.find((item) => {
    const candidates = [item.url, item.job?.url ?? ""];
    return candidates.some((candidate) => normalizeListingUrl(candidate) === target);
  });
}

/**
 * Match a saved report the same way a repeat check does (job key), then by
 * listing URL when field corrections changed the key but not the page.
 * History is newest-first; the first match wins.
 */
export function findCachedHistoryItem<T extends HistoryLookupItem>(
  job: Pick<JobObject, "jobNumber" | "title" | "salary" | "company" | "url">,
  history: T[]
): T | undefined {
  const key = getJobKey(job);
  const byKey = history.find((item) => item.key === key);
  if (byKey) return byKey;
  return findHistoryItemByListingUrl(job.url, history);
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function openExtensionPage(path: string, query?: Record<string, string>) {
  const params = query
    ? `?${new URLSearchParams(query).toString()}`
    : "";
  const url = chrome.runtime.getURL(`${path}${params}`);
  void chrome.tabs.create({ url });
}
