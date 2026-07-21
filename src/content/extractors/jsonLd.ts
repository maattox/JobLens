export interface JobPostingLd {
  title?: string;
  description?: string;
  employmentType?: string | string[];
  jobLocation?: unknown;
  jobLocationType?: string;
  baseSalary?: {
    value?: {
      minValue?: number;
      maxValue?: number;
      unitText?: string;
    };
    currency?: string;
  };
  hiringOrganization?: { name?: string };
  identifier?: { value?: string };
  datePosted?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectJobPostings(node: unknown, out: JobPostingLd[]): void {
  if (!node) return;

  if (Array.isArray(node)) {
    for (const item of node) collectJobPostings(item, out);
    return;
  }

  if (!isRecord(node)) return;

  const type = node["@type"];
  const types = Array.isArray(type) ? type : type ? [type] : [];
  if (types.some((t) => String(t).toLowerCase() === "jobposting")) {
    out.push(node as JobPostingLd);
  }

  if (node["@graph"]) {
    collectJobPostings(node["@graph"], out);
  }
}

export function findJobPostingJsonLd(doc: Document = document): JobPostingLd | null {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  const postings: JobPostingLd[] = [];

  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw) continue;
    try {
      collectJobPostings(JSON.parse(raw), postings);
    } catch {
      // ignore malformed JSON-LD
    }
  }

  return postings[0] ?? null;
}

export function formatPostalAddress(location: unknown): string {
  if (Array.isArray(location)) {
    for (const item of location) {
      const formatted = formatPostalAddress(item);
      if (formatted) return formatted;
    }
    return "";
  }

  if (!isRecord(location)) return "";

  const address = location.address ?? location;
  if (!isRecord(address)) return "";

  const locality = String(address.addressLocality || "").trim();
  const region = String(address.addressRegion || "").trim();
  const postal = String(address.postalCode || "").trim();
  const street = String(address.streetAddress || "").trim();
  const country = String(address.addressCountry || "").trim();

  if (street) {
    const cityState = [locality, region].filter(Boolean).join(", ");
    const withPostal = [cityState, postal].filter(Boolean).join(" ");
    return [street, withPostal].filter(Boolean).join(", ");
  }

  // GovernmentJobs often puts the full place string in addressLocality.
  if (locality && /[–—,]/.test(locality) && !region) {
    return locality;
  }

  if (locality && region && postal) {
    return `${locality}, ${region} ${postal}`;
  }

  const cityRegion = [locality, region].filter(Boolean).join(", ");
  if (cityRegion && country && country.length <= 3) {
    return `${cityRegion}, ${country}`;
  }

  return cityRegion || postal;
}

export function formatSalaryFromLd(
  posting: JobPostingLd,
  options?: { yearLabel?: "a year" | "Annually"; fractionDigits?: number }
): string {
  const value = posting.baseSalary?.value;
  if (!value) return "";

  const min = value.minValue;
  const max = value.maxValue;
  const unit = String(value.unitText || "").toUpperCase();
  const yearLabel = options?.yearLabel ?? "a year";
  const fractionDigits = options?.fractionDigits ?? 0;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });

  if (min != null && max != null && min !== max) {
    if (unit === "HOUR") return `$${fmt(min)} - $${fmt(max)}/hr`;
    if (unit === "YEAR") return `$${fmt(min)} - $${fmt(max)} ${yearLabel}`;
    if (unit === "MONTH") return `$${fmt(min)} - $${fmt(max)}/mo`;
    return `$${fmt(min)} - $${fmt(max)}`;
  }

  if (min != null) {
    if (unit === "HOUR") return `$${fmt(min)}/hr`;
    if (unit === "YEAR") return `$${fmt(min)} ${yearLabel}`;
    if (unit === "MONTH") return `$${fmt(min)}/mo`;
    return `$${fmt(min)}`;
  }

  return "";
}

export function formatEmploymentTypeLd(
  employmentType: string | string[] | undefined
): string {
  if (!employmentType) return "";
  const raw = Array.isArray(employmentType) ? employmentType[0] : employmentType;
  const normalized = String(raw).toUpperCase().replace(/-/g, "_");
  const map: Record<string, string> = {
    FULL_TIME: "Full-time",
    PART_TIME: "Part-time",
    CONTRACTOR: "Contract",
    TEMPORARY: "Temporary",
    INTERN: "Internship",
    OTHER: "",
  };
  return map[normalized] || raw.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function htmlToPlainText(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  return (template.content.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
