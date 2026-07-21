import type { JobObject } from "./types";

export function getJobKey(
  job: Pick<JobObject, "jobNumber" | "title" | "salary" | "company" | "url">
): string {
  if (job.jobNumber) return `jobNumber:${job.jobNumber}`;
  return `meta:${job.title}|${job.salary}|${job.company}|${job.url}`;
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
