import type { JobSection } from "../../shared/types";
import { extractFallback } from "./fallback";
import type { ExtractorResult } from "./types";

export interface CoreJobFields {
  title: string;
  company: string;
  location: string;
  salary: string;
  sections: JobSection[];
}

export function countMissingCoreFields(fields: CoreJobFields): number {
  const core = [fields.title, fields.company, fields.location, fields.salary];
  return core.filter((v) => !v.trim()).length;
}

export function hasDescription(sections: JobSection[]): boolean {
  return sections.some((s) => s.plain.trim().length > 40);
}

export function shouldUsePlainTextFallback(fields: CoreJobFields): boolean {
  const missing = countMissingCoreFields(fields);
  const noDescription = !hasDescription(fields.sections);
  return missing >= 3 || noDescription;
}

export function applyCompletenessGate(result: ExtractorResult): ExtractorResult {
  if (!result.isSupported) return result;

  const fields: CoreJobFields = {
    title: result.job.title,
    company: result.job.company,
    location: result.job.location,
    salary: result.job.salary,
    sections: result.job.sections,
  };

  if (!shouldUsePlainTextFallback(fields)) {
    return result;
  }

  const fallback = extractFallback();
  return {
    isSupported: false,
    reliabilityWarning:
      "Job listing fields could not be reliably extracted from this page. Using visible page text instead.",
    job: {
      ...fallback.job,
      source: result.job.source,
      title: result.job.title || fallback.job.title,
      company: result.job.company,
      location: result.job.location,
      salary: result.job.salary,
      workMode: result.job.workMode,
      employmentType: result.job.employmentType,
      jobNumber: result.job.jobNumber,
    },
  };
}
