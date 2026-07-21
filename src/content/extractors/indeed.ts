import { inferWorkMode, normalizeWhitespace } from "../../shared/textUtils";
import { applyCompletenessGate } from "./completeness";
import { blockToText } from "./domUtils";
import {
  findJobPostingJsonLd,
  formatEmploymentTypeLd,
  formatPostalAddress,
  formatSalaryFromLd,
  htmlToPlainText,
} from "./jsonLd";
import { splitLocationAndWorkMode } from "./locationParse";
import {
  extractJkFromUrl,
  getIndeedCompanyFromSsr,
  getIndeedDescriptionFromSsr,
  getIndeedLocationFromSsr,
  parseIndeedSsrData,
} from "./scriptJson";
import type { ExtractorResult } from "./types";

function textOf(el: Element | null): string {
  return normalizeWhitespace(el?.textContent || "");
}

function cleanIndeedTitle(raw: string): string {
  return raw
    .replace(/\s*-\s*job post\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitleDom(): string {
  const header =
    document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]') ||
    document.querySelector(".jobsearch-JobInfoHeader-title") ||
    document.querySelector("h1.jobsearch-JobInfoHeader-title");

  if (!header) return "";

  const firstSpan = header.querySelector("span");
  if (firstSpan) {
    return cleanIndeedTitle(textOf(firstSpan));
  }

  return cleanIndeedTitle(textOf(header));
}

function extractCompanyDom(): string {
  const container =
    document.querySelector('[data-testid="inlineHeader-companyName"]') ||
    document.querySelector("[data-company-name='true']");

  const link =
    container?.querySelector("a") ||
    document.querySelector('a[href*="/cmp/"]');

  if (link) return textOf(link);
  return textOf(container);
}

function extractLocationDom(): string {
  return (
    textOf(document.querySelector('[data-testid="job-location"]')) ||
    textOf(document.querySelector("#jobLocationText"))
  );
}

function extractSalaryAndEmploymentTypeDom(): {
  salary: string;
  employmentType: string;
} {
  const container = document.querySelector("#salaryInfoAndJobType");
  if (!container) {
    return {
      salary: textOf(
        document.querySelector("[data-testid='jobsearch-JobInfoHeader-salary']")
      ),
      employmentType: "",
    };
  }

  const spans = Array.from(container.querySelectorAll(":scope > span"));
  const cleanSpan = (value: string) =>
    value.replace(/^[\s\-–—\u00a0]+/, "").trim();

  const salary = spans[0] ? cleanSpan(textOf(spans[0])) : "";
  const employmentType = spans[1] ? cleanSpan(textOf(spans[1])) : "";

  return { salary, employmentType };
}

function extractDescriptionRoot(): Element | null {
  return (
    document.querySelector("#jobDescriptionText") ||
    document.querySelector(".jobsearch-JobComponent-description") ||
    document.querySelector("[data-testid='jobsearch-JobComponent-description']")
  );
}

function formatIndeedSalaryFromSsr(
  model: NonNullable<ReturnType<typeof parseIndeedSsrData>>["salaryInfoModel"]
): string {
  if (!model) return "";
  if (model.salaryText) return model.salaryText;
  if (model.salaryMin != null && model.salaryMax != null) {
    const fmt = (n: number) => n.toLocaleString("en-US");
    if (model.salaryType === "YEARLY") {
      return `$${fmt(model.salaryMin)} - $${fmt(model.salaryMax)} a year`;
    }
    return `$${fmt(model.salaryMin)} - $${fmt(model.salaryMax)}`;
  }
  return "";
}

function preferRicherLocation(primary: string, secondary: string): string {
  const a = primary.trim();
  const b = secondary.trim();
  if (!a) return b;
  if (!b) return a;
  // Prefer the value that includes a street number / fuller address.
  const score = (value: string) =>
    (/\d/.test(value) ? 2 : 0) + (value.includes(",") ? 1 : 0) + Math.min(value.length, 80) / 80;
  return score(b) > score(a) ? b : a;
}

/**
 * Indeed extraction: schema.org JobPosting JSON-LD is primary when present.
 * Some Indeed layouts (search/list shells) only expose WebSite JSON-LD — then
 * fall back to embedded SSR payloads and DOM selectors.
 */
export function extractIndeed(): ExtractorResult {
  const ld = findJobPostingJsonLd();
  const ssr = parseIndeedSsrData();

  let title = cleanIndeedTitle(
    ld?.title || ssr?.jobTitle || extractTitleDom()
  );

  const company =
    ld?.hiringOrganization?.name ||
    getIndeedCompanyFromSsr(ssr) ||
    extractCompanyDom();

  const ldLocation = formatPostalAddress(ld?.jobLocation);
  const ssrLocation = getIndeedLocationFromSsr(ssr);
  const domLocation = extractLocationDom();
  // Prefer JSON-LD geo fields, but keep a fuller street address from SSR/DOM when available.
  let locationRaw = preferRicherLocation(
    preferRicherLocation(ldLocation, ssrLocation),
    domLocation
  );

  const { location, workMode: locationWorkMode } =
    splitLocationAndWorkMode(locationRaw);

  const { salary: salaryDom, employmentType: employmentDom } =
    extractSalaryAndEmploymentTypeDom();
  const salary =
    formatSalaryFromLd(ld || {}) ||
    formatIndeedSalaryFromSsr(ssr?.salaryInfoModel) ||
    salaryDom;
  const employmentType =
    formatEmploymentTypeLd(ld?.employmentType) || employmentDom;

  const descriptionRoot = extractDescriptionRoot();
  let plain = descriptionRoot ? blockToText(descriptionRoot, true) : "";
  let markdown = descriptionRoot ? blockToText(descriptionRoot, false) : "";

  if (!plain && ld?.description) {
    plain = htmlToPlainText(ld.description);
    markdown = plain;
  }

  if (!plain && ssr) {
    const ssrDesc = getIndeedDescriptionFromSsr(ssr);
    if (ssrDesc) {
      plain = htmlToPlainText(ssrDesc);
      markdown = plain;
    }
  }

  const sections = plain
    ? [{ heading: "Description", markdown, plain }]
    : [];

  const workMode =
    locationWorkMode ||
    (ld?.jobLocationType === "TELECOMMUTE" ? "remote" : "") ||
    inferWorkMode(`${location} ${plain}`);

  const jobNumber = extractJkFromUrl(window.location.href);
  const usedJsonLd = Boolean(ld?.title || ld?.description);
  const hasCoreFields = Boolean(title && (plain || company || location));

  const result: ExtractorResult = {
    isSupported: Boolean(title || plain),
    reliabilityWarning: usedJsonLd
      ? undefined
      : hasCoreFields
        ? "Indeed JobPosting JSON-LD was not found; used SSR/DOM fallbacks."
        : title
          ? undefined
          : "Indeed layout not fully recognized; results may be incomplete.",
    job: {
      title,
      jobNumber,
      salary,
      company,
      location,
      workMode,
      employmentType,
      source: "indeed",
      sections,
      isSupported: Boolean(title || plain),
      rawText: plain,
    },
  };

  return applyCompletenessGate(result);
}
