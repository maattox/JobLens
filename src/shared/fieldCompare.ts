import type {
  JobFieldConflict,
  JobFieldsExtractResult,
  JobMetaField,
  JobObject,
  FieldResolution,
} from "./types";
import { JOB_META_FIELDS } from "./types";

export function jobFieldsFromJob(job: JobObject): JobFieldsExtractResult {
  return {
    title: job.title || "",
    company: job.company || "",
    location: job.location || "",
    salary: job.salary || "",
    workMode: job.workMode || "",
    employmentType: job.employmentType || "",
  };
}

export function applyJobFieldsToJob(
  job: JobObject,
  fields: JobFieldsExtractResult
): JobObject {
  return {
    ...job,
    title: fields.title,
    company: fields.company,
    location: fields.location,
    salary: fields.salary,
    workMode: fields.workMode,
    employmentType: fields.employmentType,
  };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

/** Normalize field values for fuzzy equality (format-only diffs should agree). */
export function normalizeJobFieldForCompare(
  field: JobMetaField,
  value: string
): string {
  let s = normalizeWhitespace(value).toLowerCase();
  if (!s) return "";

  if (field === "workMode") {
    if (/flexible\s*\/\s*hybrid|hybrid\s*\/\s*flexible/.test(s)) return "hybrid";
    if (/\bhybrid\b/.test(s)) return "hybrid";
    if (/\b(on[- ]?site|in[- ]?person|in person|onsite)\b/.test(s)) return "onsite";
    if (/\b(remote|telework|telecommute|wfh|work from home)\b/.test(s)) {
      return "remote";
    }
    return s.replace(/[^a-z0-9]/g, "");
  }

  if (field === "employmentType") {
    if (/full/.test(s)) return "fulltime";
    if (/part/.test(s)) return "parttime";
    if (/intern/.test(s)) return "internship";
    if (/contract|contractor/.test(s)) return "contract";
    if (/temp/.test(s)) return "temporary";
    return s.replace(/[^a-z0-9]/g, "");
  }

  if (field === "salary") {
    const numbers = s
      .replace(/,/g, "")
      .match(/\d+(?:\.\d+)?/g)
      ?.map((n) => String(Number(n)));
    const unit = /hour|\/\s*hr|\bhr\b/.test(s)
      ? "hour"
      : /month|\/\s*mo/.test(s)
        ? "month"
        : /year|annual/.test(s)
          ? "year"
          : "";
    return `${(numbers || []).join("-")}|${unit}`;
  }

  // title / company / location: strip most punctuation
  return s
    .replace(/[|•·]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function jobFieldsAgree(
  field: JobMetaField,
  scraped: string,
  ai: string
): boolean {
  const a = normalizeWhitespace(scraped);
  const b = normalizeWhitespace(ai);
  if (!a && !b) return true;
  if (!a || !b) return false;

  const na = normalizeJobFieldForCompare(field, a);
  const nb = normalizeJobFieldForCompare(field, b);
  if (na && nb && na === nb) return true;

  // Soft containment for titles/companies with minor suffix differences.
  if (field === "title" || field === "company" || field === "location") {
    if (na.length >= 4 && nb.length >= 4) {
      if (na.includes(nb) || nb.includes(na)) return true;
    }
  }

  return false;
}

export interface MergeJobFieldsResult {
  /** Scraped fields with empty slots filled from AI (no user prompt needed). */
  merged: JobFieldsExtractResult;
  conflicts: JobFieldConflict[];
}

/**
 * Merge scraped + AI fields:
 * - both empty → empty
 * - one empty → take the non-empty (auto)
 * - both set and agree (fuzzy) → prefer scraped formatting
 * - both set and disagree → conflict for user resolution
 */
export function mergeScrapedAndAiFields(
  scraped: JobFieldsExtractResult,
  ai: JobFieldsExtractResult
): MergeJobFieldsResult {
  const merged: JobFieldsExtractResult = {
    title: "",
    company: "",
    location: "",
    salary: "",
    workMode: "",
    employmentType: "",
  };
  const conflicts: JobFieldConflict[] = [];

  for (const field of JOB_META_FIELDS) {
    const scrapedValue = normalizeWhitespace(scraped[field] || "");
    const aiValue = normalizeWhitespace(ai[field] || "");

    if (!scrapedValue && !aiValue) {
      merged[field] = "";
      continue;
    }

    if (!scrapedValue && aiValue) {
      merged[field] = aiValue;
      continue;
    }

    if (scrapedValue && !aiValue) {
      merged[field] = scrapedValue;
      continue;
    }

    if (jobFieldsAgree(field, scrapedValue, aiValue)) {
      merged[field] = scrapedValue;
      continue;
    }

    merged[field] = scrapedValue;
    conflicts.push({ field, scrapedValue, aiValue });
  }

  return { merged, conflicts };
}

export function applyFieldResolutions(
  base: JobFieldsExtractResult,
  scraped: JobFieldsExtractResult,
  ai: JobFieldsExtractResult,
  resolutions: FieldResolution[]
): JobFieldsExtractResult {
  const next = { ...base };

  for (const resolution of resolutions) {
    if (resolution.choice === "scraped") {
      next[resolution.field] = scraped[resolution.field] || "";
    } else if (resolution.choice === "ai") {
      next[resolution.field] = ai[resolution.field] || "";
    } else {
      next[resolution.field] = normalizeWhitespace(resolution.manualValue || "");
    }
  }

  return next;
}

export const JOB_META_FIELD_LABELS: Record<JobMetaField, string> = {
  title: "Job title",
  company: "Company",
  location: "Location",
  salary: "Salary",
  workMode: "Work mode",
  employmentType: "Job type",
};
