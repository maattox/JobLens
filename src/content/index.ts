import { MSG } from "../shared/messages";
import {
  configureDebugLogger,
  debugError,
  debugInfo,
  isDebugTelemetryEnabled,
  summarizeError,
} from "../shared/debug";
import type { ScrapeResponse } from "../shared/types";
import { extractJobFromPage } from "./extractors/registry";

if (isDebugTelemetryEnabled()) {
  configureDebugLogger({ messageType: MSG.DEBUG_LOG });
}

function scrapeResponse(url: string): ScrapeResponse {
  debugInfo("content", "extract", "Extracting job from page", {
    url,
    readyState: document.readyState,
    title: document.title,
  });

  const extracted = extractJobFromPage(url);

  if (extracted.requiresDedicatedTab) {
    debugInfo("content", "extract", "Blocked: dedicated job tab required", {
      url,
      message: extracted.dedicatedTabMessage,
    });
    return {
      success: false,
      error:
        extracted.dedicatedTabMessage ||
        "Open the full job listing in its own tab, then try again.",
    };
  }

  const job = extracted.job;

  if (!job.title && !job.sections.length && !job.rawText) {
    debugWarnExtractFailed(url);
    return {
      success: false,
      error:
        "Could not find job listing content on this page. Open a supported job listing and try again.",
    };
  }

  debugInfo("content", "extract", "Extraction finished", {
    url,
    source: job.source,
    isSupported: job.isSupported,
    title: job.title,
    company: job.company,
    sectionCount: job.sections.length,
    sectionHeadings: job.sections.map((s) => s.heading),
    plainTextLength: job.plainText.length,
    reliabilityWarning: job.reliabilityWarning,
  });

  return { success: true, data: job };
}

function debugWarnExtractFailed(url: string) {
  debugInfo("content", "extract", "No job content found on page", {
    url,
    bodyTextLength: document.body?.innerText?.length ?? 0,
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MSG.EXTRACT_JOB || message?.type === MSG.SCRAPE_JOB) {
    try {
      sendResponse(scrapeResponse(window.location.href));
    } catch (error) {
      debugError("content", "extract", "Extraction threw", summarizeError(error));
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Unknown scraping error.",
      });
    }
    return false;
  }

  return false;
});
