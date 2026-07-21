import type { JobObject, JobSection } from "./types";
import { normalizeWhitespace } from "./textUtils";

interface BuildInput {
  title: string;
  jobNumber: string;
  salary: string;
  company: string;
  location: string;
  workMode: string;
  employmentType: string;
  sections: JobSection[];
}

export function buildFormattedOutputs(data: BuildInput): {
  markdown: string;
  plainText: string;
} {
  const markdownLines: string[] = [];
  const plainLines: string[] = [];

  if (data.title) {
    markdownLines.push(`# Job Title: ${data.title}`, "");
    plainLines.push(`Job Title: ${data.title}`, "");
  }

  const metadata: [string, string][] = [
    ["Job Number", data.jobNumber],
    ["Salary", data.salary],
    ["Company", data.company],
    ["Location", data.location],
    ["Work Mode", data.workMode],
    ["Job Type", data.employmentType],
  ];

  const metadataEntries = metadata.filter(([, value]) => value);
  if (metadataEntries.length) {
    for (const [label, value] of metadataEntries) {
      markdownLines.push(`- **${label}:** ${value}`);
      plainLines.push(`${label}: ${value}`);
    }
    markdownLines.push("");
    plainLines.push("");
  }

  for (const section of data.sections) {
    markdownLines.push(`## ${section.heading}`, "");
    plainLines.push(section.heading, "");

    if (section.markdown) {
      markdownLines.push(section.markdown, "");
    }
    if (section.plain) {
      plainLines.push(section.plain, "");
    }
  }

  return {
    markdown: normalizeWhitespace(markdownLines.join("\n")),
    plainText: normalizeWhitespace(plainLines.join("\n")),
  };
}

export function attachFormattedOutputs(
  partial: Omit<JobObject, "markdown" | "plainText" | "rawText" | "url"> & {
    rawText?: string;
  }
): Pick<JobObject, "markdown" | "plainText"> {
  const formatted = buildFormattedOutputs({
    title: partial.title,
    jobNumber: partial.jobNumber,
    salary: partial.salary,
    company: partial.company,
    location: partial.location,
    workMode: partial.workMode,
    employmentType: partial.employmentType,
    sections: partial.sections,
  });

  return formatted;
}
