import { inferWorkMode, normalizeWhitespace } from "../../shared/textUtils";

export interface ParsedLocation {
  location: string;
  workMode: string;
}

export function splitLocationAndWorkMode(raw: string): ParsedLocation {
  const text = normalizeWhitespace(
    raw.replace(/[\u0080-\u009f]/g, " ").replace(/\s+/g, " ")
  );
  if (!text) return { location: "", workMode: "" };

  const dashWorkMode = text.match(
    /^(.+?)\s*[-–—]\s*(on[- ]?site|remote|hybrid|in[- ]?person)\s*$/i
  );
  if (dashWorkMode) {
    return {
      location: dashWorkMode[1].trim(),
      workMode: inferWorkMode(dashWorkMode[2]),
    };
  }

  const onsiteSuffix = text.match(/^(.+?)\s+On[- ]?site\s*$/i);
  if (onsiteSuffix) {
    return {
      location: onsiteSuffix[1].trim(),
      workMode: "onsite",
    };
  }

  const onsiteIndex = text.toLowerCase().lastIndexOf("on-site");
  if (onsiteIndex > 0) {
    const locationPart = text
      .slice(0, onsiteIndex)
      .replace(/[^\w\s,.-]+$/g, "")
      .trim();
    if (locationPart) {
      return { location: locationPart, workMode: "onsite" };
    }
  }

  const parts = text.split(/\s*[•·|]\s*/).map((p) => p.trim()).filter(Boolean);

  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const workMode = inferWorkMode(last);
    if (workMode) {
      return {
        location: parts.slice(0, -1).join(", "),
        workMode,
      };
    }
  }

  const dashMatch = text.match(/^(.+?)\s*[-–—]\s*(full[- ]?time|part[- ]?time|remote|hybrid|on[- ]?site.*)$/i);
  if (dashMatch) {
    const loc = dashMatch[1].trim();
    const tail = dashMatch[2];
    const workMode = inferWorkMode(tail);
    if (workMode) return { location: loc, workMode };
  }

  return { location: text, workMode: inferWorkMode(text) };
}

export function normalizePayText(text: string): string {
  return text.replace(/\$\$/g, "$").trim();
}

export function formatZipPay(
  pay:
    | {
        min?: number;
        max?: number;
        interval?: string;
      }
    | undefined,
  displayText?: string
): string {
  const fromDisplay = normalizePayText(displayText || "");
  if (fromDisplay) return fromDisplay;
  if (pay?.min == null || pay?.max == null) return "";

  const interval = String(pay.interval || "").toUpperCase();
  const fmt = (n: number) => n.toLocaleString("en-US");

  if (interval.includes("HOUR")) return `$${fmt(pay.min)} - $${fmt(pay.max)}/hr`;
  if (interval.includes("MONTH")) return `$${fmt(pay.min)} - $${fmt(pay.max)}/mo`;
  if (interval.includes("YEAR") || interval.includes("ANNUAL")) {
    return `$${fmt(pay.min)} - $${fmt(pay.max)} a year`;
  }
  return `$${fmt(pay.min)} - $${fmt(pay.max)}`;
}

export function mapZipLocationType(name: string | undefined): string {
  if (!name) return "";
  if (name.includes("IN_PERSON") || /on[- ]?site/i.test(name)) return "onsite";
  if (name.includes("REMOTE")) return "remote";
  if (name.includes("HYBRID")) return "hybrid";
  return inferWorkMode(name);
}

export function cleanLocationLabel(location: string): string {
  return location
    .replace(/[•·|]\s*$/g, "")
    .replace(/[^\w\s,.-]+$/g, "")
    .trim();
}

export function mapZipEmploymentType(name: string | undefined): string {
  if (!name) return "";
  if (name.includes("FULL_TIME")) return "Full-time";
  if (name.includes("PART_TIME")) return "Part-time";
  if (name.includes("CONTRACT")) return "Contract";
  if (name.includes("TEMPORARY")) return "Temporary";
  if (name.includes("INTERN")) return "Internship";
  return name.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
