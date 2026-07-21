import { normalizeWhitespace } from "../../shared/textUtils";
import type { ExtractorResult } from "./types";

function extractVisiblePlainText(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      "script, style, nav, header, footer, noscript, iframe, svg"
    )
    .forEach((el) => el.remove());

  return normalizeWhitespace(clone.innerText || "");
}

function extractFullHtmlText(): string {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script, style").forEach((el) => el.remove());
  return normalizeWhitespace(clone.innerText || "");
}

export function extractFallback(): ExtractorResult {
  let plain = extractVisiblePlainText();
  if (!plain) {
    plain = extractFullHtmlText();
  }

  const sections = plain
    ? [{ heading: "Page Content", markdown: plain, plain }]
    : [];

  return {
    isSupported: false,
    reliabilityWarning:
      "This page is not a supported job site. Using unstructured page text; results may be less reliable.",
    job: {
      title: document.title || "",
      jobNumber: "",
      salary: "",
      company: "",
      location: "",
      workMode: "",
      employmentType: "",
      source: "unsupported",
      sections,
      isSupported: false,
      rawText: plain,
    },
  };
}
