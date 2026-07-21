/** Extract state slug from GovernmentJobs URL: /careers/{slug}/jobs/... */
export function extractGovernmentJobsStateSlug(url: string): string {
  try {
    const match = new URL(url).pathname.match(/\/careers\/([^/]+)\//i);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

export function titleCaseSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatGovernmentJobsCompany(
  department: string,
  pageUrl: string
): string {
  if (!department.trim()) return "";
  const slug = extractGovernmentJobsStateSlug(pageUrl);
  if (!slug) return department.trim();
  return `${titleCaseSlug(slug)} - ${department.trim()}`;
}
