/**
 * Indeed / ZipRecruiter expose unreliable "Version1" surfaces (search/list/modal
 * panes) and reliable dedicated "Version2" job tabs. Compatibility checks should
 * only run on dedicated tabs.
 */

export type JobPageViewKind = "dedicated" | "split_or_modal" | "unknown";

function pathnameOf(href: string): string {
  try {
    return new URL(href).pathname.toLowerCase();
  } catch {
    return "";
  }
}

/** Dedicated Indeed job page (`/viewjob` or mobile `/m/viewjob`). */
export function isIndeedDedicatedJobPage(href: string): boolean {
  const path = pathnameOf(href);
  return path.includes("/viewjob");
}

/**
 * Indeed search / homepage / two-pane feed with an embedded job preview.
 * Prefer URL first; also catch feed markers when the URL is ambiguous.
 */
export function detectIndeedPageView(
  href: string,
  doc: Document = document
): JobPageViewKind {
  if (isIndeedDedicatedJobPage(href)) return "dedicated";

  const path = pathnameOf(href);
  if (
    path === "/" ||
    path === "/jobs" ||
    path.startsWith("/jobs/") ||
    /\/jobs$/i.test(path)
  ) {
    return "split_or_modal";
  }

  if (
    doc.querySelector('[data-testid="new-job-feed-wrapper"]') ||
    doc.querySelector(".jobsearch-RecentSearchesMixedJobFeed") ||
    doc.querySelector("#jobsearch-ViewjobPaneWrapper") ||
    doc.querySelector('[class*="viewjobPaneWrapper"]')
  ) {
    return "split_or_modal";
  }

  // Other indeed.com pages (companies, etc.) — not a dedicated listing.
  return "split_or_modal";
}

/**
 * Dedicated ZipRecruiter job detail (`/jobs/<slug>`, `/jobs/v2/<token>`,
 * `/job/<slug>`, `/c/...`). Detect from URL only — full job pages often keep
 * hidden Settings/dialogs that match the search-modal ZDS selector, so DOM
 * must not override a dedicated path.
 */
export function isZipRecruiterDedicatedJobPage(href: string): boolean {
  const path = pathnameOf(href);

  if (/jobs-search|job-search/.test(path)) return false;

  return (
    /\/jobs\/[^/]+/i.test(path) ||
    /\/job\/[^/]+/i.test(path) ||
    /\/c\/[^/]+/i.test(path)
  );
}

export function detectZipRecruiterPageView(href: string): JobPageViewKind {
  if (isZipRecruiterDedicatedJobPage(href)) return "dedicated";
  return "split_or_modal";
}

export const INDEED_DEDICATED_TAB_MESSAGE =
  "This looks like an Indeed search or split-pane view. Open the full job listing in its own tab first (the URL should include /viewjob), then run the check again.";

export const ZIPRECRUITER_DEDICATED_TAB_MESSAGE =
  "This looks like a ZipRecruiter search or modal preview. Open the full job listing in its own dedicated tab first, then run the check again.";
