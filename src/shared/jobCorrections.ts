import type { JobFieldCorrections, JobObject } from "./types";

const UI_CHROME_VALUES =
  /^(close|apply|save|share|cancel|ok|done|next|back|menu|search|filter|more|less|show more|show less|view all|learn more)$/i;

function isUsableCorrection(
  field: keyof JobFieldCorrections,
  value: string
): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (UI_CHROME_VALUES.test(trimmed)) return false;
  if (trimmed.length < 2) return false;

  if (field === "location") {
    // Work-mode words alone are not locations.
    if (/^(on-?site|remote|hybrid|flexible\/hybrid)$/i.test(trimmed)) {
      return false;
    }
  }

  if (field === "salary" && !/[\$€£\d]/.test(trimmed)) return false;

  return true;
}

export interface AppliedFieldCorrections {
  before: Partial<Record<keyof JobFieldCorrections, string>>;
  after: Partial<Record<keyof JobFieldCorrections, string>>;
  fields: (keyof JobFieldCorrections)[];
}

export function applyJobFieldCorrections(
  job: JobObject,
  corrections?: JobFieldCorrections
): { job: JobObject; applied: AppliedFieldCorrections | null } {
  if (!corrections) return { job, applied: null };

  const next = { ...job };
  const fields: (keyof JobFieldCorrections)[] = [];
  const before: AppliedFieldCorrections["before"] = {};
  const after: AppliedFieldCorrections["after"] = {};

  const candidates: (keyof JobFieldCorrections)[] = [
    "title",
    "company",
    "location",
    "salary",
    "workMode",
    "employmentType",
  ];

  for (const field of candidates) {
    const value = corrections[field];
    if (typeof value !== "string" || !isUsableCorrection(field, value)) {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed === String(job[field] || "").trim()) continue;

    before[field] = String(job[field] || "");
    next[field] = trimmed;
    after[field] = trimmed;
    fields.push(field);
  }

  if (!fields.length) return { job, applied: null };
  return { job: next, applied: { before, after, fields } };
}
