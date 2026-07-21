import { inferWorkMode, normalizeWhitespace } from "../../shared/textUtils";
import { applyCompletenessGate } from "./completeness";
import { blockToText } from "./domUtils";
import { htmlToPlainText } from "./jsonLd";
import {
  cleanLocationLabel,
  formatZipPay,
  mapZipEmploymentType,
  mapZipLocationType,
  splitLocationAndWorkMode,
} from "./locationParse";
import {
  extractZipDescriptionHtml,
  parseZipRecruiterSerializedData,
} from "./scriptJson";
import type { ExtractorResult } from "./types";

const EMPLOYMENT_KEYWORDS =
  /\b(full[- ]?time|part[- ]?time|contract|contractor|temporary|temp|internship|intern)\b/i;
const SALARY_PATTERN = /[\$€£]|\b\d+(\.\d+)?k\b|\bper (hour|year|annum|month)\b|\/mo\b|\/hr\b/i;

function textOf(el: Element | null): string {
  return normalizeWhitespace(el?.textContent || "");
}

function hasClass(el: Element, partial: string): boolean {
  return Array.from(el.classList).some((cls) => cls.includes(partial));
}

function getExtractionScope(): ParentNode {
  // Dedicated job tabs only — do not use search-modal scopes.
  return document.querySelector("main") || document;
}

/** Prefer the job title before ZipRecruiter's "| Division | City" suffixes. */
function cleanZipTitle(raw: string): string {
  const trimmed = normalizeWhitespace(raw);
  if (!trimmed.includes("|")) return trimmed;
  return trimmed.split("|")[0].trim() || trimmed;
}

function extractTitleDom(scope: ParentNode): string {
  const header = Array.from(scope.querySelectorAll("h2")).find((el) =>
    hasClass(el, "text-header-md")
  );

  if (header) return cleanZipTitle(textOf(header));

  return cleanZipTitle(
    textOf(scope.querySelector("h1.job_title")) ||
      textOf(scope.querySelector("h1"))
  );
}

function cleanZipCompanyName(name: string): string {
  // Keep franchise location suffixes like " - Olympia, WA" when present.
  return normalizeWhitespace(name);
}

function extractCompanyDom(scope: ParentNode): string {
  const links = Array.from(
    scope.querySelectorAll('a[href^="/co/"], a[href*="/co/"]')
  ).filter((link) => {
    // Skip related-job cards in the sidebar/feed.
    if (link.getAttribute("data-testid") === "job-card-company") return false;
    const href = link.getAttribute("href") || "";
    if (/\/Jobs(\?|$)/i.test(href)) return false;
    return true;
  });

  const preferred =
    links.find((link) =>
      Boolean(link.closest(".grid") || link.getAttribute("aria-label"))
    ) || links[0];

  return cleanZipCompanyName(textOf(preferred));
}

function isMetadataRow(el: Element): boolean {
  if (!hasClass(el, "flex")) return false;
  return Boolean(el.querySelector("svg") && el.querySelector("p"));
}

function extractMetadataRows(scope: ParentNode): {
  salary: string;
  employmentType: string;
  texts: string[];
} {
  const rows = Array.from(scope.querySelectorAll("div")).filter(isMetadataRow);
  let salary = "";
  let employmentType = "";
  const texts: string[] = [];

  for (const row of rows) {
    const paragraph = row.querySelector("p");
    const value = textOf(paragraph);
    if (!value) continue;
    texts.push(value);

    if (!salary && SALARY_PATTERN.test(value)) {
      salary = value;
      continue;
    }

    if (!employmentType && EMPLOYMENT_KEYWORDS.test(value)) {
      employmentType = value;
    }
  }

  return { salary, employmentType, texts };
}

function extractLocationDom(
  scope: ParentNode,
  company: string,
  metadataTexts: string[]
): string {
  const companyLink = Array.from(
    scope.querySelectorAll('a[href^="/co/"], a[href*="/co/"]')
  ).find((link) => link.getAttribute("data-testid") !== "job-card-company");

  if (companyLink) {
    const parent = companyLink.closest("div");
    if (parent) {
      const candidates = Array.from(
        parent.parentElement?.querySelectorAll("p") || []
      )
        .map((el) => textOf(el))
        .filter(
          (text) =>
            text &&
            text !== company &&
            !SALARY_PATTERN.test(text) &&
            !EMPLOYMENT_KEYWORDS.test(text) &&
            !/^(close|apply|save|share)$/i.test(text)
        );
      if (candidates[0]) return candidates[0];
    }
  }

  const fallback = metadataTexts.find(
    (text) =>
      !SALARY_PATTERN.test(text) &&
      !EMPLOYMENT_KEYWORDS.test(text) &&
      text !== company &&
      !/^(close|apply|save|share)$/i.test(text)
  );
  return fallback || "";
}

function extractDescriptionRoot(scope: ParentNode): Element | null {
  const headings = Array.from(scope.querySelectorAll("h2, h3"));
  const descriptionHeading = headings.find(
    (el) => textOf(el).toLowerCase() === "job description"
  );

  if (descriptionHeading) {
    const sibling = descriptionHeading.nextElementSibling;
    if (sibling && hasClass(sibling, "whitespace-pre-line")) {
      return sibling;
    }
    const nested = descriptionHeading.parentElement?.querySelector(
      ".whitespace-pre-line"
    );
    if (nested) return nested;
  }

  return (
    Array.from(scope.querySelectorAll("div")).find(
      (el) =>
        hasClass(el, "whitespace-pre-line") &&
        (hasClass(el, "wrap-anywhere") ||
          (el.textContent && el.textContent.length > 120))
    ) ||
    scope.querySelector("#job_description") ||
    scope.querySelector("[class*='job_description']")
  );
}

function workModeFromDescription(plain: string): string {
  if (/flexible\s*\/\s*hybrid|hybrid\s*\/\s*flexible/i.test(plain)) {
    return "hybrid";
  }
  if (/remote employment:\s*flexible\/hybrid/i.test(plain)) {
    return "hybrid";
  }
  return inferWorkMode(plain);
}

function extractFromSerialized(): Partial<{
  title: string;
  company: string;
  location: string;
  salary: string;
  employmentType: string;
  workMode: string;
  jobNumber: string;
  plain: string;
}> | null {
  const data = parseZipRecruiterSerializedData();
  if (!data) return null;

  const display = data.display;
  const salary = formatZipPay(data.pay, display?.pay?.text);

  const locationRaw =
    display?.location ||
    data.location?.displayName ||
    [data.location?.city, data.location?.state].filter(Boolean).join(", ");

  const locationTypes =
    display?.locationTypes ||
    data.locationTypes?.[0]?.name ||
    "";
  const employmentTypes =
    display?.employmentTypes ||
    data.employmentTypes?.[0]?.name ||
    "";

  const { location, workMode: locWorkMode } = splitLocationAndWorkMode(
    locationRaw + (locationTypes ? ` • ${locationTypes}` : "")
  );

  let plain = "";
  const descHtml = extractZipDescriptionHtml();
  if (descHtml) {
    plain = htmlToPlainText(descHtml);
  } else if (typeof data.htmlFullDescription === "string") {
    plain = htmlToPlainText(data.htmlFullDescription);
  }

  const descriptionWorkMode = workModeFromDescription(plain);

  return {
    title: cleanZipTitle(data.title || ""),
    company: cleanZipCompanyName(data.company?.name || ""),
    location: cleanLocationLabel(location),
    salary,
    employmentType: mapZipEmploymentType(employmentTypes),
    // Prefer description Flexible/Hybrid over header On-site for gov-style listings.
    workMode:
      descriptionWorkMode ||
      locWorkMode ||
      mapZipLocationType(locationTypes) ||
      inferWorkMode(locationTypes),
    jobNumber: data.listingKey || "",
    plain,
  };
}

export function extractZipRecruiter(): ExtractorResult {
  const serialized = extractFromSerialized();
  const scope = getExtractionScope();

  const title = serialized?.title || extractTitleDom(scope);
  const company = serialized?.company || extractCompanyDom(scope);
  const { salary: salaryDom, employmentType: employmentDom, texts } =
    extractMetadataRows(scope);
  const salary = serialized?.salary || salaryDom;
  const employmentType = serialized?.employmentType || employmentDom;

  const locationRaw =
    serialized?.location || extractLocationDom(scope, company, texts);
  const { location: parsedLocation, workMode: locWorkMode } =
    splitLocationAndWorkMode(locationRaw);
  const location = cleanLocationLabel(parsedLocation);

  const descriptionRoot = extractDescriptionRoot(scope);
  let plain = serialized?.plain || "";
  let markdown = plain;

  if (!plain && descriptionRoot) {
    plain = blockToText(descriptionRoot, true);
    markdown = blockToText(descriptionRoot, false);
  }

  const sections = plain
    ? [{ heading: "Description", markdown, plain }]
    : [];

  const workMode =
    serialized?.workMode ||
    workModeFromDescription(plain) ||
    locWorkMode ||
    inferWorkMode(`${location} ${salary} ${employmentType} ${plain}`);

  const hasCoreFields = Boolean(title && (plain || company || location));

  const result: ExtractorResult = {
    isSupported: Boolean(title || plain),
    reliabilityWarning: hasCoreFields
      ? undefined
      : title
        ? undefined
        : "ZipRecruiter layout not fully recognized; results may be incomplete.",
    job: {
      title,
      jobNumber: serialized?.jobNumber || "",
      salary,
      company,
      location,
      workMode,
      employmentType,
      source: "ziprecruiter",
      sections,
      isSupported: Boolean(title || plain),
      rawText: plain,
    },
  };

  return applyCompletenessGate(result);
}
