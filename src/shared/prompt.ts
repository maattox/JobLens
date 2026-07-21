import type { JobObject, UserPreferences, UserProfile } from "./types";

function formatWorkExperience(profile: UserProfile): string {
  if (!profile.workExperience.length) return "None provided";
  return profile.workExperience
    .map((entry, index) => {
      const lines = [
        `${index + 1}. ${entry.jobTitle || "Role"} at ${entry.company || "Company"}`,
        entry.employmentPeriod ? `Period: ${entry.employmentPeriod}` : "",
        entry.description ? `Description: ${entry.description}` : "",
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");
}

function formatProjects(profile: UserProfile): string {
  if (!profile.projects.length) return "None provided";
  return profile.projects
    .map((entry, index) => {
      const lines = [
        `${index + 1}. ${entry.name || "Project"}`,
        entry.description ? `Description: ${entry.description}` : "",
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");
}

function formatEducation(profile: UserProfile): string {
  if (!profile.education.length) return "None provided";
  return profile.education
    .map((entry, index) => {
      const lines = [
        `${index + 1}. ${entry.level || "Level"} in ${entry.fieldOfStudy || "Field"} — ${entry.school || "School"}`,
        entry.currentlyEnrolled ? "Currently enrolled" : "",
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");
}

function formatCertifications(profile: UserProfile): string {
  if (!profile.certifications.length) return "None provided";
  return profile.certifications
    .map((entry, index) => {
      const lines = [
        `${index + 1}. ${entry.name || "Certification"}`,
        entry.description ? `Description: ${entry.description}` : "",
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");
}

export function buildCompatibilityPrompt(
  profile: UserProfile,
  preferences: UserPreferences,
  job: JobObject
): string {
  const preferenceSummary = {
    minBasePay: preferences.minBasePay,
    maxCommuteMinutes: preferences.maxCommuteMinutes,
    remoteWork: preferences.remoteWork,
    workSchedule: preferences.workSchedule,
    jobType: preferences.jobType,
  };

  return `You are a job compatibility analyst. Evaluate how well this candidate fits the job.

Return ONLY valid JSON matching this schema:
{
  "overallScore": number (0-100),
  "categoryScores": [
    { "label": "Skills", "score": number, "summaryBullets": string[] },
    { "label": "Experience", "score": number, "summaryBullets": string[] },
    { "label": "Preferences", "score": number, "summaryBullets": string[] }
  ],
  "summaryBullets": string[],
  "missingQualifications": [
    { "item": string, "severity": "easyToLearn" | "majorGap" }
  ],
  "actionableAdvice": string[],
  "jobFieldCorrections": {
    "title"?: string,
    "company"?: string,
    "location"?: string,
    "salary"?: string,
    "workMode"?: string,
    "employmentType"?: string
  }
}

Rules:
- Use concise bullet points.
- Distinguish missing qualifications as easyToLearn vs majorGap.
- actionableAdvice is optional but helpful (resume keyword tweaks, etc.).
- Be realistic; do not inflate scores.
- In jobFieldCorrections, only include fields you can verify or improve from the job listing text. Clean polluted values (e.g. location should not include employment type). Fill missing fields when the listing clearly states them.
- Never use UI chrome as field values (e.g. "Close", "Apply", "Save", "Share").
- Location must be a geographic place (city/region/address), never a button label or work-mode word alone.
- Prefer filling empty company/salary/location/workMode/employmentType from the listing over leaving them blank.
- For unstructured or partially extracted listings (especially LinkedIn), carefully read the job listing text and fill jobFieldCorrections for any missing or polluted metadata fields that are clearly stated (title, company, location, salary, workMode, employmentType).
- workMode should be one of: remote, hybrid, onsite (or a clear equivalent phrase). Prefer an explicit workplace type near the top of the listing over incidental mentions deeper in the description.

Extracted job metadata (may be incomplete or inaccurate):
- Title: ${job.title || "unknown"}
- Company: ${job.company || "unknown"}
- Location: ${job.location || "unknown"}
- Salary: ${job.salary || "unknown"}
- Work mode: ${job.workMode || "unknown"}
- Employment type: ${job.employmentType || "unknown"}
- Source: ${job.source}${job.reliabilityWarning ? ` (note: ${job.reliabilityWarning})` : ""}

CANDIDATE PROFILE:
Skills: ${profile.skills || "None provided"}

Work experience:
${formatWorkExperience(profile)}

Projects:
${formatProjects(profile)}

Education:
${formatEducation(profile)}

Certifications:
${formatCertifications(profile)}
${profile.additionalInformation.trim() ? `\nAdditional information:\n${profile.additionalInformation}` : ""}
${profile.parsedResumeText ? `\nAdditional resume notes:\n${profile.parsedResumeText}` : ""}

CANDIDATE PREFERENCES:
${JSON.stringify(preferenceSummary, null, 2)}

JOB LISTING (${job.source}${job.isSupported ? "" : " — unstructured fallback"}):
${job.plainText}`;
}

export const SYSTEM_PROMPT =
  "You analyze job fit and respond with strict JSON only. No markdown fences or commentary outside JSON.";

export const FOLLOW_UP_SYSTEM_PROMPT =
  "You answer follow-up questions about a job compatibility analysis. Be concise, practical, and grounded in the candidate profile, preferences, and job listing already provided in this conversation. Respond in Markdown (not JSON): use short paragraphs, bullet lists when helpful, **bold** for emphasis, and Markdown links like [label](https://example.com) when citing resources. Do not wrap the whole answer in a code fence.";

export function buildFollowUpRebuildPrompt(
  profile: UserProfile,
  preferences: UserPreferences,
  job: JobObject,
  priorFollowUps: { question: string; answer: string }[],
  question: string
): string {
  const history = priorFollowUps.length
    ? priorFollowUps
        .map(
          (entry, index) =>
            `Q${index + 1}: ${entry.question}\nA${index + 1}: ${entry.answer}`
        )
        .join("\n\n")
    : "None";

  return `${buildCompatibilityPrompt(profile, preferences, job)}

PRIOR FOLLOW-UP Q&A:
${history}

NEW QUESTION:
${question}

Answer the new question only. Use Markdown (not JSON): short paragraphs, lists when helpful, and Markdown links for any URLs. Do not wrap the whole answer in a code fence.`;
}

export function buildResumeExtractPrompt(resumeText: string): string {
  return `You extract structured job-search profile data from a resume.

Return ONLY valid JSON matching this schema:
{
  "profile": {
    "skills": string,
    "workExperience": [
      {
        "company": string,
        "jobTitle": string,
        "employmentPeriod": string,
        "description": string
      }
    ],
    "projects": [
      { "name": string, "description": string }
    ],
    "education": [
      {
        "level": string,
        "fieldOfStudy": string,
        "school": string,
        "currentlyEnrolled": boolean
      }
    ],
    "certifications": [
      { "name": string, "description": string }
    ],
    "additionalInformation": string
  },
  "preferences": {
    "minBasePay": number | null,
    "remoteWork": ("remote" | "hybrid" | "onsite" | "noPreference")[],
    "workSchedule": ("day" | "evening" | "night" | "rotating" | "onCall" | "noPreference")[],
    "jobType": ("fullTime" | "partTime" | "contract" | "temporary" | "internship" | "noPreference")[]
  }
}

Rules:
- Extract only what is supported by the resume text.
- Use empty strings or empty arrays when unknown.
- For preference arrays, use ["noPreference"] when the resume does not indicate a choice.
- minBasePay should be null unless an explicit salary expectation appears.
- Do not invent employers, degrees, or certifications.

RESUME TEXT:
${resumeText}`;
}

export function buildJobFieldsExtractPrompt(pageText: string, source: string): string {
  return `You extract structured job listing metadata from visible page text.

Return ONLY valid JSON matching this schema:
{
  "title": string,
  "company": string,
  "location": string,
  "salary": string,
  "workMode": string,
  "employmentType": string
}

Rules:
- Use empty strings when a field is not clearly stated.
- location must be a geographic place (city/region/address), never a button label.
- workMode should be one of: remote, hybrid, onsite (or a clear equivalent like "On-site", "Flexible/Hybrid"). Prefer an explicit workplace type near the top of the listing over incidental mentions deeper in the description.
- employmentType examples: Full-time, Part-time, Contract, Temporary, Internship.
- salary should preserve the listing's pay text when present (range and period).
- Never use UI chrome as values (Close, Apply, Save, Share, Show more, etc.).
- Do not invent details that are not supported by the text.
- Source site hint: ${source}

PAGE TEXT:
${pageText}`;
}
