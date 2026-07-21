import type { JobSection } from "../../shared/types";
import { inferWorkMode, normalizeWhitespace } from "../../shared/textUtils";
import { applyCompletenessGate } from "./completeness";
import {
  blockToText,
  extractTermValue,
  getTermBlockValue,
} from "./domUtils";
import {
  findJobPostingJsonLd,
  formatEmploymentTypeLd,
  formatPostalAddress,
  formatSalaryFromLd,
  htmlToPlainText,
} from "./jsonLd";
import type { ExtractorResult } from "./types";

function extractTitleDom(): string {
  const titleEl = document.querySelector("h2.entity-title");
  if (!titleEl) return "";
  return normalizeWhitespace(
    titleEl.textContent || titleEl.getAttribute("title") || ""
  );
}

function extractSalaryDom(): string {
  const salaryLabel = document.querySelector("#salary-label-id.term-description");
  if (!salaryLabel) return "";

  const spanValue = getTermBlockValue(salaryLabel);
  if (spanValue) return spanValue;

  const icon = salaryLabel.querySelector(".job-details-salary-icon");
  if (!icon) return "";

  const popover =
    icon.getAttribute("data-content") || icon.getAttribute("aria-label") || "";

  if (!popover) return "";

  const lines = popover
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const annual = lines.find((line) => /annually/i.test(line));
  return annual || lines[lines.length - 1] || "";
}

function extractDescriptionSections(): JobSection[] {
  const detailsRoot = document.querySelector("#details-info.tab-pane.fr-view");
  if (!detailsRoot) return [];

  const definitionList = detailsRoot.querySelector("dl");
  if (!definitionList) return [];

  const sections: { heading: string; bodyElement: Element | null }[] = [];
  const children = Array.from(definitionList.children);
  let currentSection: { heading: string; bodyElement: Element | null } | null = null;

  for (const child of children) {
    const tag = child.tagName.toLowerCase();

    if (tag === "dt") {
      const headingEl = child.querySelector("h2, h3, h4");
      const heading = headingEl
        ? normalizeWhitespace(headingEl.textContent || "")
        : normalizeWhitespace(child.textContent || "");

      if (heading) {
        currentSection = { heading, bodyElement: null };
        sections.push(currentSection);
      }
      continue;
    }

    if (tag === "dd" && currentSection && !currentSection.bodyElement) {
      currentSection.bodyElement = child;
    }
  }

  return sections
    .filter((section) => section.heading)
    .map((section) => ({
      heading: section.heading,
      markdown: section.bodyElement
        ? blockToText(section.bodyElement, false)
        : "",
      plain: section.bodyElement ? blockToText(section.bodyElement, true) : "",
    }));
}

function normalizeGovWorkMode(value: string): string {
  const lower = value.toLowerCase();
  if (/flexible\s*\/\s*hybrid|hybrid\s*\/\s*flexible/.test(lower)) return "hybrid";
  if (/hybrid/.test(lower)) return "hybrid";
  if (/on[- ]?site|in person/.test(lower)) return "onsite";
  if (/remote|telework/.test(lower)) return "remote";
  return inferWorkMode(value);
}

function extractWorkMode(
  sections: JobSection[],
  location: string,
  ldTelecommute: boolean,
  remoteEmploymentTerm: string
): string {
  if (remoteEmploymentTerm.trim()) {
    return normalizeGovWorkMode(remoteEmploymentTerm);
  }

  const combined = [location, ...sections.map((s) => s.plain)].join("\n");
  const inferred = inferWorkMode(combined);
  if (inferred) return inferred;
  // TELECOMMUTE on GovernmentJobs often means hybrid/telework-eligible, not fully remote.
  if (ldTelecommute) return "hybrid";
  return "";
}

/**
 * GovernmentJobs: schema.org JobPosting JSON-LD is the primary structured source.
 * Agency-specific fields (department/company, job number, remote employment label,
 * formatted salary) are filled from the details DL when present.
 */
export function extractGovernmentJobs(): ExtractorResult {
  const ld = findJobPostingJsonLd();
  const sectionsDom = extractDescriptionSections();

  const locationDom = extractTermValue("Location");
  const location =
    formatPostalAddress(ld?.jobLocation) || locationDom || "";

  const ldTelecommute = ld?.jobLocationType === "TELECOMMUTE";
  const remoteEmployment = extractTermValue("Remote Employment");
  const workMode = extractWorkMode(
    sectionsDom,
    location,
    ldTelecommute,
    remoteEmployment
  );

  // Prefer department over generic LD hiringOrganization ("State of Washington").
  const department = extractTermValue("Department");
  const employmentType =
    extractTermValue("Job Type") ||
    formatEmploymentTypeLd(ld?.employmentType);

  let sections = sectionsDom;
  if (!sections.length && ld?.description) {
    const plain = htmlToPlainText(ld.description);
    if (plain) {
      sections = [{ heading: "Description", markdown: plain, plain }];
    }
  }

  const salaryDom = extractSalaryDom();
  const salaryLd = formatSalaryFromLd(ld || {}, {
    yearLabel: "Annually",
    fractionDigits: 2,
  });

  const result: ExtractorResult = {
    isSupported: true,
    reliabilityWarning: ld
      ? undefined
      : "GovernmentJobs JobPosting JSON-LD was not found; used page details markup.",
    job: {
      title: ld?.title || extractTitleDom() || "",
      jobNumber:
        extractTermValue("Job Number") ||
        String(ld?.identifier?.value || ""),
      // Prefer the site's annual salary label when available (includes cents / Annually).
      salary: salaryDom || salaryLd,
      company: department || ld?.hiringOrganization?.name || "",
      location,
      workMode,
      employmentType,
      source: "governmentjobs",
      sections,
      isSupported: true,
    },
  };

  return applyCompletenessGate(result);
}
