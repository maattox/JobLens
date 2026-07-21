import { attachFormattedOutputs } from "../../shared/formatting";
import { formatGovernmentJobsCompany } from "../../shared/governmentJobsUtils";
import type { JobObject } from "../../shared/types";
import { applyCompletenessGate } from "./completeness";
import { extractFallback } from "./fallback";
import { extractGovernmentJobs } from "./governmentjobs";
import { extractIndeed } from "./indeed";
import { extractLinkedIn } from "./linkedin";
import {
  detectIndeedPageView,
  detectZipRecruiterPageView,
  INDEED_DEDICATED_TAB_MESSAGE,
  ZIPRECRUITER_DEDICATED_TAB_MESSAGE,
} from "./pageView";
import type { ExtractorResult } from "./types";
import { extractZipRecruiter } from "./ziprecruiter";

function emptyJob(source: JobObject["source"]): ExtractorResult["job"] {
  return {
    title: "",
    jobNumber: "",
    salary: "",
    company: "",
    location: "",
    workMode: "",
    employmentType: "",
    source,
    sections: [],
    isSupported: false,
  };
}

function resolveExtractor(hostname: string) {
  const host = hostname.toLowerCase();
  if (host.includes("governmentjobs.com")) return extractGovernmentJobs;
  if (host.includes("indeed.com")) return extractIndeed;
  if (host.includes("ziprecruiter.com")) return extractZipRecruiter;
  if (host.includes("linkedin.com")) return extractLinkedIn;
  return extractFallback;
}

function isKnownJobHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host.includes("governmentjobs.com") ||
    host.includes("indeed.com") ||
    host.includes("ziprecruiter.com") ||
    host.includes("linkedin.com")
  );
}

export interface PageExtractResult {
  job: JobObject;
  requiresDedicatedTab?: boolean;
  dedicatedTabMessage?: string;
}

export function extractJobFromPage(url: string): PageExtractResult {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  if (hostname.includes("indeed.com")) {
    const view = detectIndeedPageView(url);
    if (view !== "dedicated") {
      return {
        requiresDedicatedTab: true,
        dedicatedTabMessage: INDEED_DEDICATED_TAB_MESSAGE,
        job: finalizeJob(emptyJob("indeed"), url, false, INDEED_DEDICATED_TAB_MESSAGE),
      };
    }
  }

  if (hostname.includes("ziprecruiter.com")) {
    const view = detectZipRecruiterPageView(url);
    if (view !== "dedicated") {
      return {
        requiresDedicatedTab: true,
        dedicatedTabMessage: ZIPRECRUITER_DEDICATED_TAB_MESSAGE,
        job: finalizeJob(
          emptyJob("ziprecruiter"),
          url,
          false,
          ZIPRECRUITER_DEDICATED_TAB_MESSAGE
        ),
      };
    }
  }

  const extractor = resolveExtractor(hostname);
  const rawResult: ExtractorResult = extractor();
  const result: ExtractorResult = isKnownJobHost(hostname)
    ? rawResult
    : applyCompletenessGate(rawResult);

  if (result.requiresDedicatedTab) {
    const message =
      result.reliabilityWarning ||
      (result.job.source === "indeed"
        ? INDEED_DEDICATED_TAB_MESSAGE
        : result.job.source === "ziprecruiter"
          ? ZIPRECRUITER_DEDICATED_TAB_MESSAGE
          : "Open the full job listing in its own tab, then try again.");
    return {
      requiresDedicatedTab: true,
      dedicatedTabMessage: message,
      job: finalizeJob(result.job, url, false, message),
    };
  }

  const jobPartial =
    result.job.source === "governmentjobs"
      ? {
          ...result.job,
          company: formatGovernmentJobsCompany(result.job.company, url),
        }
      : result.job;

  return {
    job: finalizeJob(
      jobPartial,
      url,
      result.isSupported,
      result.reliabilityWarning
    ),
  };
}

function finalizeJob(
  jobPartial: ExtractorResult["job"],
  url: string,
  isSupported: boolean,
  reliabilityWarning?: string
): JobObject {
  const formatted = attachFormattedOutputs(jobPartial);
  const rawText =
    jobPartial.rawText ||
    formatted.plainText ||
    (isSupported ? normalizeBodyText() : "");

  return {
    ...jobPartial,
    url,
    markdown: formatted.markdown,
    plainText: formatted.plainText,
    rawText,
    isSupported,
    reliabilityWarning,
  };
}

function normalizeBodyText(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script, style").forEach((el) => el.remove());
  return (clone.innerText || "").trim();
}

export function isJobSite(hostname: string): boolean {
  return isKnownJobHost(hostname);
}
