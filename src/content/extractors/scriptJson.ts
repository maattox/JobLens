function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractBalancedJson(text: string, startIndex: number): string | null {
  const open = text[startIndex];
  if (open !== "{" && open !== "[") return null;

  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
  }

  return null;
}

function findJsonAfterMarker(scriptText: string, marker: string): unknown | null {
  const idx = scriptText.indexOf(marker);
  if (idx < 0) return null;

  const after = scriptText.slice(idx + marker.length);
  const brace = after.search(/[{\[]/);
  if (brace < 0) return null;

  const jsonText = extractBalancedJson(after, brace);
  if (!jsonText) return null;
  return tryParseJson(jsonText);
}

export function scanScriptsForJson(
  markers: string[],
  doc: Document = document
): unknown | null {
  const scripts = doc.querySelectorAll("script:not([src])");

  for (const script of scripts) {
    const text = script.textContent || "";
    for (const marker of markers) {
      const parsed = findJsonAfterMarker(text, marker);
      if (parsed) return parsed;
    }
  }

  return null;
}

export interface IndeedSsrData {
  jobTitle?: string;
  jobLocation?: string;
  companyName?: string;
  salaryInfoModel?: {
    salaryText?: string;
    salaryMin?: number;
    salaryMax?: number;
    salaryType?: string;
  };
  commuteInfoModel?: {
    formattedStreetAddress?: string;
    companyLocation?: string;
  };
  jobInfoWrapperModel?: {
    jobInfoModel?: {
      sanitizedJobDescription?: string;
      jobInfoHeaderModel?: {
        companyName?: string;
        subtitle?: string;
      };
      jobDescriptionSectionModel?: {
        jobDescription?: string;
      };
    };
  };
  jobDescription?: string;
  description?: string;
}

function readNestedCompany(ssr: IndeedSsrData): string {
  return (
    ssr.companyName ||
    ssr.jobInfoWrapperModel?.jobInfoModel?.jobInfoHeaderModel?.companyName ||
    ""
  );
}

function readNestedLocation(ssr: IndeedSsrData): string {
  return (
    ssr.commuteInfoModel?.formattedStreetAddress ||
    ssr.commuteInfoModel?.companyLocation ||
    ssr.jobLocation ||
    ""
  );
}

function readNestedDescription(ssr: IndeedSsrData): string {
  const model = ssr.jobInfoWrapperModel?.jobInfoModel;
  return (
    model?.sanitizedJobDescription ||
    model?.jobDescriptionSectionModel?.jobDescription ||
    ssr.jobDescription ||
    ssr.description ||
    ""
  );
}

export function getIndeedCompanyFromSsr(ssr: IndeedSsrData | null): string {
  if (!ssr) return "";
  return readNestedCompany(ssr);
}

export function getIndeedLocationFromSsr(ssr: IndeedSsrData | null): string {
  if (!ssr) return "";
  return readNestedLocation(ssr);
}

export function getIndeedDescriptionFromSsr(ssr: IndeedSsrData | null): string {
  if (!ssr) return "";
  return readNestedDescription(ssr);
}

function isIndeedSsrData(value: unknown): value is IndeedSsrData {
  if (!isRecord(value)) return false;
  return (
    typeof value.jobTitle === "string" ||
    typeof value.companyName === "string" ||
    typeof value.jobLocation === "string"
  );
}

export function parseIndeedSsrData(doc: Document = document): IndeedSsrData | null {
  const assignmentMarkers = [
    "window._initialData.viewJobSSRData=",
    "viewJobSSRData=",
    "window._rootProps =",
    '"_rootProps":',
  ];

  for (const marker of assignmentMarkers) {
    const parsed = scanScriptsForJson([marker], doc);
    if (!isRecord(parsed)) continue;

    if (marker.includes("rootProps")) {
      const preloaded = (parsed as { preloadedVJData?: IndeedSsrData }).preloadedVJData;
      if (isIndeedSsrData(preloaded)) return preloaded;
      continue;
    }

    if (isIndeedSsrData(parsed)) return parsed;
  }

  const nested = scanScriptsForJson(['"preloadedVJData":'], doc);
  if (isIndeedSsrData(nested)) return nested;

  return null;
}

export interface ZipRecruiterJobDetails {
  listingKey?: string;
  title?: string;
  pay?: {
    min?: number;
    max?: number;
    interval?: string;
  };
  company?: { name?: string };
  location?: { displayName?: string; city?: string; state?: string };
  display?: {
    pay?: { text?: string };
    location?: string;
    locationTypes?: string;
    employmentTypes?: string;
  };
  employmentTypes?: Array<{ name?: string }>;
  locationTypes?: Array<{ name?: string }>;
  htmlFullDescription?: string;
}

/**
 * Next.js RSC flight scripts often embed JSON with escaped quotes
 * (`{\"__jobDetailsSerializedData\":...}`). Normalize those before parsing.
 */
function normalizeRscScriptText(text: string): string {
  if (!text.includes("__jobDetailsSerializedData")) return text;
  if (text.includes('"__jobDetailsSerializedData"')) return text;
  // Escaped form inside a JS string literal
  if (
    text.includes('\\"__jobDetailsSerializedData\\"') ||
    text.includes('\\\"__jobDetailsSerializedData\\\"')
  ) {
    return text.replace(/\\"/g, '"').replace(/\\n/g, "\n");
  }
  return text;
}

export function parseZipRecruiterSerializedData(
  doc: Document = document
): ZipRecruiterJobDetails | null {
  const scripts = doc.querySelectorAll("script:not([src])");

  for (const script of scripts) {
    const raw = script.textContent || "";
    if (!raw.includes("__jobDetailsSerializedData")) continue;

    const text = normalizeRscScriptText(raw);
    const marker = '"__jobDetailsSerializedData"';
    const idx = text.indexOf(marker);
    if (idx < 0) continue;

    const jobDetailsIdx = text.indexOf('"jobDetails":', idx);
    if (jobDetailsIdx < 0) continue;

    const brace = text.indexOf("{", jobDetailsIdx + '"jobDetails":'.length);
    if (brace < 0) continue;

    const jsonText = extractBalancedJson(text, brace);
    if (!jsonText) continue;

    const parsed = tryParseJson(jsonText);
    if (isRecord(parsed)) return parsed as ZipRecruiterJobDetails;
  }

  return null;
}

export function extractZipDescriptionHtml(doc: Document = document): string {
  const scripts = doc.querySelectorAll("script:not([src])");

  for (const script of scripts) {
    const text = script.textContent || "";
    if (!text.includes("Job Description") || !text.includes("__next_f.push")) continue;

    const match = text.match(
      /\\u003ch3\\u003eJob Description\\u003c\/h3\\u003e[\s\S]*?\\u003c\/div\\u003e/
    );
    if (match) {
      return match[0]
        .replace(/\\u003c/g, "<")
        .replace(/\\u003e/g, ">")
        .replace(/\\u0026/g, "&")
        .replace(/\\"/g, '"');
    }
  }

  return "";
}

export function extractJkFromUrl(url: string): string {
  try {
    const params = new URL(url).searchParams;
    return params.get("jk") || params.get("vjk") || "";
  } catch {
    return "";
  }
}
