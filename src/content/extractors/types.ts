import type { JobObject } from "../../shared/types";

export interface ExtractorResult {
  job: Omit<JobObject, "url" | "markdown" | "plainText" | "rawText"> & {
    rawText?: string;
  };
  isSupported: boolean;
  reliabilityWarning?: string;
  /** When true, caller should abort and ask the user to open a dedicated job tab. */
  requiresDedicatedTab?: boolean;
}

export type SiteExtractor = () => ExtractorResult;
