import { inferWorkMode, normalizeWhitespace } from "../../shared/textUtils";
import { applyCompletenessGate } from "./completeness";
import { blockToText } from "./domUtils";
import { findJobPostingJsonLd, formatEmploymentTypeLd, formatPostalAddress, formatSalaryFromLd, htmlToPlainText } from "./jsonLd";
import { splitLocationAndWorkMode } from "./locationParse";
import type { ExtractorResult } from "./types";

const ABOUT_JOB_SELECTOR =
  '[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"]';
const JOB_DETAILS_SCREEN_SELECTOR =
  '[data-sdui-screen="com.linkedin.sdui.flagshipnav.jobs.JobDetails"]';

const WORK_MODE_LABELS = /^(on-?site|remote|hybrid|in-?person)$/i;
const EMPLOYMENT_LABELS =
  /^(full[- ]?time|part[- ]?time|contract|temporary|internship|intern)$/i;
const UI_CHROME =
  /^(about the job|apply|save|share|follow|show more|show less|set alert.*)$/i;

function textOf(el: Element | null | undefined): string {
  return normalizeWhitespace(el?.textContent || "");
}

function getJobDetailsRoot(): ParentNode {
  return (
    document.querySelector(JOB_DETAILS_SCREEN_SELECTOR) ||
    document.querySelector("main") ||
    document
  );
}

function extractTitleFromDocumentTitle(): string {
  const title = normalizeWhitespace(document.title || "");
  const match = title.match(/^(.+?)\s*\|\s*.+?\s*\|\s*LinkedIn\s*$/i);
  if (match) return match[1].trim();
  return title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
}

function extractTitleDom(scope: ParentNode, about: Element | null): string {
  const classic =
    textOf(scope.querySelector(".job-details-jobs-unified-top-card__job-title")) ||
    textOf(scope.querySelector(".jobs-unified-top-card__job-title")) ||
    textOf(scope.querySelector("h1.t-24")) ||
    textOf(scope.querySelector("h1"));

  if (classic && classic.length < 160) return classic;

  if (about) {
    // Newer LinkedIn SDUI: title is often the first short span under About the job.
    for (const span of about.querySelectorAll("span")) {
      const value = textOf(span);
      if (
        value &&
        value.length >= 3 &&
        value.length <= 120 &&
        !UI_CHROME.test(value) &&
        !EMPLOYMENT_LABELS.test(value) &&
        !WORK_MODE_LABELS.test(value) &&
        !/^salary range/i.test(value) &&
        !/,\s*[A-Z]{2}\b/.test(value)
      ) {
        return value;
      }
    }
  }

  return extractTitleFromDocumentTitle();
}

function extractCompanyDom(scope: ParentNode): string {
  const classic =
    textOf(scope.querySelector(".job-details-jobs-unified-top-card__company-name a")) ||
    textOf(scope.querySelector(".jobs-unified-top-card__company-name a")) ||
    textOf(scope.querySelector(".topcard__org-name-link"));

  if (classic) return classic;

  const links = Array.from(scope.querySelectorAll('a[href*="/company/"]'))
    .map((link) => textOf(link))
    .filter((name) => name && name.length < 120 && !UI_CHROME.test(name));

  return links[0] || "";
}

function extractBadgeLabels(scope: ParentNode): {
  workMode: string;
  employmentType: string;
} {
  let workMode = "";
  let employmentType = "";

  for (const el of scope.querySelectorAll("a, span, div, p")) {
    const value = textOf(el);
    if (!value || value.length > 40) continue;

    if (!workMode && WORK_MODE_LABELS.test(value)) {
      workMode = inferWorkMode(value) || value.toLowerCase().replace(/\s+/g, "");
      if (workMode === "inperson") workMode = "onsite";
      if (/on-?site/i.test(value)) workMode = "onsite";
      continue;
    }

    if (!employmentType && EMPLOYMENT_LABELS.test(value)) {
      employmentType = value.replace(/\b\w/g, (c) => c.toUpperCase());
    }

    if (workMode && employmentType) break;
  }

  return { workMode, employmentType };
}

function parseAboutMetadata(about: Element | null): {
  employmentType: string;
  location: string;
  salary: string;
} {
  if (!about) {
    return { employmentType: "", location: "", salary: "" };
  }

  let employmentType = "";
  let location = "";
  let salary = "";

  for (const el of about.querySelectorAll("p, span, li")) {
    const value = textOf(el);
    if (!value || value.length > 180) continue;

    if (!salary && /^salary range\s*:/i.test(value)) {
      salary = value.replace(/^salary range\s*:\s*/i, "").trim();
      continue;
    }

    if (!employmentType && EMPLOYMENT_LABELS.test(value)) {
      employmentType = value.replace(/\b\w/g, (c) => c.toUpperCase());
      continue;
    }

    if (
      !location &&
      /,\s*[A-Z]{2}\b/.test(value) &&
      !/^salary range/i.test(value) &&
      value.length < 80
    ) {
      location = value.replace(/,\s*US\s*$/i, "").trim();
    }
  }

  return { employmentType, location, salary };
}

function extractDescription(about: Element | null, scope: ParentNode): {
  plain: string;
  markdown: string;
} {
  const classic =
    scope.querySelector(".jobs-description__content") ||
    scope.querySelector(".jobs-box__html-content") ||
    scope.querySelector("#job-details");

  if (classic) {
    return {
      plain: blockToText(classic, true),
      markdown: blockToText(classic, false),
    };
  }

  if (!about) return { plain: "", markdown: "" };

  const plain = blockToText(about, true)
    .replace(/^About the job\s*/i, "")
    .trim();
  const markdown = blockToText(about, false)
    .replace(/^About the job\s*/i, "")
    .trim();

  return { plain, markdown };
}

function extractJobIdFromUrl(href: string): string {
  try {
    const match = new URL(href).pathname.match(/\/jobs\/view\/(\d+)/i);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function normalizeLinkedInEmployment(value: string): string {
  if (!value) return "";
  if (/full/i.test(value)) return "Full-time";
  if (/part/i.test(value)) return "Part-time";
  return value;
}

/**
 * LinkedIn listings rarely expose JobPosting JSON-LD. Prefer stable SDUI hooks
 * (`data-sdui-screen` / `aboutTheJob`) and classic top-card selectors as fallback.
 * Remaining gaps are filled by AI `jobFieldCorrections` from the description text.
 */
export function extractLinkedIn(): ExtractorResult {
  const ld = findJobPostingJsonLd();
  const scope = getJobDetailsRoot();
  const about = document.querySelector(ABOUT_JOB_SELECTOR);

  const title =
    ld?.title ||
    extractTitleDom(scope, about) ||
    extractTitleFromDocumentTitle();

  const company =
    ld?.hiringOrganization?.name || extractCompanyDom(scope);

  const badges = extractBadgeLabels(scope);
  const aboutMeta = parseAboutMetadata(about);

  const locationRaw =
    formatPostalAddress(ld?.jobLocation) ||
    aboutMeta.location ||
    textOf(scope.querySelector(".job-details-jobs-unified-top-card__primary-description-container")) ||
    textOf(scope.querySelector(".jobs-unified-top-card__bullet"));

  const { location, workMode: locationWorkMode } =
    splitLocationAndWorkMode(locationRaw.replace(/\s*[·•].*$/, "").trim());

  const salary =
    formatSalaryFromLd(ld || {}) ||
    aboutMeta.salary ||
    "";

  const employmentType =
    formatEmploymentTypeLd(ld?.employmentType) ||
    normalizeLinkedInEmployment(badges.employmentType || aboutMeta.employmentType);

  // Prefer explicit LinkedIn workplace badges (On-site / Hybrid / Remote) over
  // incidental "hybrid" mentions inside the employer-written description.
  const workMode =
    badges.workMode ||
    locationWorkMode ||
    (ld?.jobLocationType === "TELECOMMUTE" ? "remote" : "") ||
    "";

  let { plain, markdown } = extractDescription(about, scope);
  if (!plain && ld?.description) {
    plain = htmlToPlainText(ld.description);
    markdown = plain;
  }

  if (!workMode && plain) {
    // Only infer from description when no badge was found.
    // no-op here — leave empty so AI can fill via jobFieldCorrections when ambiguous
  }

  const inferredWorkMode = workMode || inferWorkMode(`${location} ${title}`);

  const sections = plain
    ? [{ heading: "Description", markdown, plain }]
    : [];

  const hasCoreFields = Boolean(title && (plain || company || location));
  const usedJsonLd = Boolean(ld?.title || ld?.description);

  const result: ExtractorResult = {
    isSupported: Boolean(title || plain),
    reliabilityWarning: usedJsonLd
      ? undefined
      : hasCoreFields
        ? "LinkedIn listings are often unstructured; metadata may be incomplete and AI may refine fields from the description."
        : "LinkedIn layout not fully recognized; results may be incomplete.",
    job: {
      title,
      jobNumber: extractJobIdFromUrl(window.location.href),
      salary,
      company,
      location,
      workMode: inferredWorkMode,
      employmentType,
      source: "linkedin",
      sections,
      isSupported: Boolean(title || plain),
      rawText: plain,
    },
  };

  return applyCompletenessGate(result);
}
