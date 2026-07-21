import type { JobObject, PreCheckResult, RemoteWorkOption, UserPreferences } from "./types";
import { inferWorkMode, parseSalaryMax } from "./textUtils";

const WORK_MODE_LABELS: Record<Exclude<RemoteWorkOption, "noPreference">, string> = {
  remote: "remote",
  hybrid: "hybrid",
  onsite: "on-site",
};

const KNOWN_WORK_MODES = new Set<Exclude<RemoteWorkOption, "noPreference">>([
  "remote",
  "hybrid",
  "onsite",
]);

/** Resolve remote/hybrid/onsite only — ignore unrelated fields like job type. */
function resolveJobWorkMode(jobWorkMode: string, jobText: string): string {
  const normalized = (jobWorkMode || "").toLowerCase().trim();
  if (KNOWN_WORK_MODES.has(normalized as Exclude<RemoteWorkOption, "noPreference">)) {
    return normalized;
  }

  return inferWorkMode(jobWorkMode) || inferWorkMode(jobText);
}

function workModeConflicts(
  remoteWork: UserPreferences["remoteWork"],
  jobWorkMode: string,
  jobText: string
): string | null {
  if (!remoteWork.length || remoteWork.includes("noPreference")) {
    return null;
  }

  const inferred = resolveJobWorkMode(jobWorkMode, jobText);
  if (!inferred || !KNOWN_WORK_MODES.has(inferred as Exclude<RemoteWorkOption, "noPreference">)) {
    return null;
  }

  const selected = new Set(remoteWork);
  if (selected.has(inferred as RemoteWorkOption)) {
    return null;
  }

  const jobLabel =
    WORK_MODE_LABELS[inferred as Exclude<RemoteWorkOption, "noPreference">] ||
    inferred;
  const preferred = remoteWork
    .filter((mode) => mode !== "noPreference")
    .map((mode) => WORK_MODE_LABELS[mode as Exclude<RemoteWorkOption, "noPreference">] || mode)
    .join(", ");

  return `Job appears ${jobLabel} but your remote work preferences are: ${preferred}.`;
}

export function runPreCheck(
  job: JobObject,
  preferences: UserPreferences
): PreCheckResult {
  const reasons: string[] = [];
  let hardMismatch = false;

  if (preferences.minBasePay != null && preferences.minBasePay > 0) {
    const jobMax = parseSalaryMax(job.salary);
    const combinedText = `${job.rawText} ${job.plainText}`;
    const textMax = parseSalaryMax(combinedText);
    const effectiveMax = jobMax ?? textMax;

    if (effectiveMax != null && effectiveMax < preferences.minBasePay) {
      reasons.push(
        `Listed salary (up to ~$${effectiveMax.toLocaleString()}) is below your minimum base pay of $${preferences.minBasePay.toLocaleString()}.`
      );
      hardMismatch = true;
    }
  }

  const workConflict = workModeConflicts(
    preferences.remoteWork,
    job.workMode,
    job.plainText
  );
  if (workConflict) {
    reasons.push(workConflict);
    hardMismatch = true;
  }

  return {
    passed: reasons.length === 0,
    hardMismatch,
    reasons,
  };
}
