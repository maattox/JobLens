import { z } from "zod";
import type { ResumeExtractResult } from "./types";

const jobFieldCorrectionsSchema = z
  .object({
    title: z.string().optional(),
    company: z.string().optional(),
    location: z.string().optional(),
    salary: z.string().optional(),
    workMode: z.string().optional(),
    employmentType: z.string().optional(),
  })
  .optional();

export const compatibilityReportSchema = z.object({
  overallScore: z.number().min(0).max(100),
  categoryScores: z.array(
    z.object({
      label: z.string(),
      score: z.number().min(0).max(100),
      summaryBullets: z.array(z.string()),
    })
  ),
  summaryBullets: z.array(z.string()),
  missingQualifications: z.array(
    z.object({
      item: z.string(),
      severity: z.enum(["easyToLearn", "majorGap"]),
    })
  ),
  actionableAdvice: z.array(z.string()).optional().default([]),
  jobFieldCorrections: jobFieldCorrectionsSchema,
  // reportId / debug are assigned client-side after parsing
  reportId: z.string().optional(),
});

export type ParsedCompatibilityReport = z.infer<typeof compatibilityReportSchema>;

export function parseCompatibilityReport(raw: unknown) {
  return compatibilityReportSchema.parse(raw);
}

const remoteWorkOptionSchema = z.enum([
  "remote",
  "hybrid",
  "onsite",
  "noPreference",
]);
const workScheduleOptionSchema = z.enum([
  "day",
  "evening",
  "night",
  "rotating",
  "onCall",
  "noPreference",
]);
const jobTypeOptionSchema = z.enum([
  "fullTime",
  "partTime",
  "contract",
  "temporary",
  "internship",
  "noPreference",
]);

export const resumeExtractSchema = z.object({
  profile: z.object({
    skills: z.string().default(""),
    workExperience: z
      .array(
        z.object({
          company: z.string().default(""),
          jobTitle: z.string().default(""),
          employmentPeriod: z.string().default(""),
          description: z.string().default(""),
        })
      )
      .default([]),
    projects: z
      .array(
        z.object({
          name: z.string().default(""),
          description: z.string().default(""),
        })
      )
      .default([]),
    education: z
      .array(
        z.object({
          level: z.string().default(""),
          fieldOfStudy: z.string().default(""),
          school: z.string().default(""),
          currentlyEnrolled: z.boolean().default(false),
        })
      )
      .default([]),
    certifications: z
      .array(
        z.object({
          name: z.string().default(""),
          description: z.string().default(""),
        })
      )
      .default([]),
    additionalInformation: z.string().default(""),
  }),
  preferences: z.object({
    minBasePay: z.number().nullable().default(null),
    remoteWork: z.array(remoteWorkOptionSchema).default(["noPreference"]),
    workSchedule: z.array(workScheduleOptionSchema).default(["noPreference"]),
    jobType: z.array(jobTypeOptionSchema).default(["noPreference"]),
  }),
});

export function parseResumeExtractResult(raw: unknown): ResumeExtractResult {
  return resumeExtractSchema.parse(raw);
}

export const jobFieldsExtractSchema = z.object({
  title: z.string().default(""),
  company: z.string().default(""),
  location: z.string().default(""),
  salary: z.string().default(""),
  workMode: z.string().default(""),
  employmentType: z.string().default(""),
});

export type ParsedJobFieldsExtract = z.infer<typeof jobFieldsExtractSchema>;

export function parseJobFieldsExtractResult(raw: unknown): ParsedJobFieldsExtract {
  return jobFieldsExtractSchema.parse(raw);
}

export function extractJsonFromText(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }

  throw new Error("No JSON object found in AI response.");
}
