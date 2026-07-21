import { describe, expect, it } from "vitest";
import { toggleCheckboxGroup } from "./checkboxGroup";
import { migratePreferences, migrateProfile, migrateAiSettings, migrateJobObject } from "./migration";
import { runPreCheck } from "./precheck";
import { parseCompatibilityReport, parseResumeExtractResult } from "./schema";
import type { JobObject, UserPreferences } from "./types";
import { DEFAULT_AI_SETTINGS, DEFAULT_PREFERENCES, DEFAULT_PROFILE } from "./types";

const baseJob: JobObject = {
  title: "Test Job",
  jobNumber: "JOB-1",
  salary: "$40,000 - $50,000 Annually",
  company: "IT",
  location: "Olympia, WA",
  workMode: "onsite",
  employmentType: "",
  url: "https://example.com/job",
  source: "governmentjobs",
  sections: [],
  rawText: "onsite only position",
  markdown: "",
  plainText: "onsite only position",
  isSupported: true,
};

describe("runPreCheck", () => {
  it("flags salary below minimum base pay as hard mismatch", () => {
    const preferences: UserPreferences = {
      ...DEFAULT_PREFERENCES,
      minBasePay: 80000,
      setupComplete: true,
    };

    const result = runPreCheck(baseJob, preferences);
    expect(result.hardMismatch).toBe(true);
    expect(result.reasons.some((r) => r.includes("minimum base pay"))).toBe(true);
  });

  it("flags remote work conflicts when preferences exclude job mode", () => {
    const preferences: UserPreferences = {
      ...DEFAULT_PREFERENCES,
      remoteWork: ["remote"],
      setupComplete: true,
    };

    const result = runPreCheck(baseJob, preferences);
    expect(result.hardMismatch).toBe(true);
    expect(result.reasons.some((r) => r.includes("remote work"))).toBe(true);
  });

  it("ignores job-type text mistakenly stored as workMode", () => {
    const preferences: UserPreferences = {
      ...DEFAULT_PREFERENCES,
      remoteWork: ["remote", "hybrid"],
      setupComplete: true,
    };

    const result = runPreCheck(
      {
        ...baseJob,
        workMode: "Full Time - Permanent",
        plainText: "Location: Olympia, WA – Hybrid\nThis is a hybrid role.",
      },
      preferences
    );

    expect(result.passed).toBe(true);
    expect(result.hardMismatch).toBe(false);
  });

  it("passes when remote work is no preference", () => {
    const preferences: UserPreferences = {
      ...DEFAULT_PREFERENCES,
      remoteWork: ["noPreference"],
      setupComplete: true,
    };

    const result = runPreCheck(baseJob, preferences);
    expect(result.passed).toBe(true);
  });
});

describe("toggleCheckboxGroup", () => {
  it("selects no preference exclusively", () => {
    expect(
      toggleCheckboxGroup(["remote", "hybrid"], "noPreference", "noPreference")
    ).toEqual(["noPreference"]);
  });

  it("clears no preference when another option is selected", () => {
    expect(
      toggleCheckboxGroup(["noPreference"], "remote", "noPreference")
    ).toEqual(["remote"]);
  });
});

describe("migrateProfile", () => {
  it("maps legacy flat fields into structured entries", () => {
    const migrated = migrateProfile({
      skills: "Agile",
      experienceSummary: "10 years PM",
      education: "MBA",
      certifications: "PMP",
      setupComplete: true,
    });

    expect(migrated.workExperience).toHaveLength(1);
    expect(migrated.workExperience[0].description).toBe("10 years PM");
    expect(migrated.education[0].fieldOfStudy).toBe("MBA");
    expect(migrated.certifications[0].description).toBe("PMP");
  });

  it("returns defaults for invalid input", () => {
    expect(migrateProfile(null)).toEqual(DEFAULT_PROFILE);
  });
});

describe("migratePreferences", () => {
  it("maps legacy salary and work mode fields", () => {
    const migrated = migratePreferences({
      minSalary: 90000,
      workModePreference: "remote",
      setupComplete: true,
    });

    expect(migrated.minBasePay).toBe(90000);
    expect(migrated.remoteWork).toEqual(["remote"]);
  });
});

describe("migrateJobObject", () => {
  it("maps legacy department field to company", () => {
    const migrated = migrateJobObject({
      title: "Analyst",
      department: "Acme Corp",
      source: "indeed",
      isSupported: true,
    });

    expect(migrated?.company).toBe("Acme Corp");
  });
});

describe("migrateAiSettings", () => {
  it("replaces retired Gemini model ids with a current default", () => {
    const migrated = migrateAiSettings({
      provider: "gemini",
      apiKey: "test-key",
      model: "gemini-1.5-flash",
    });

    expect(migrated.model).toBe(DEFAULT_AI_SETTINGS.model);
    expect(migrated.apiKey).toBe("test-key");
  });

  it("replaces gemini-2.5-flash with the current default", () => {
    const migrated = migrateAiSettings({
      provider: "gemini",
      apiKey: "test-key",
      model: "gemini-2.5-flash",
    });

    expect(migrated.model).toBe("gemini-3.6-flash");
  });

  it("replaces retired OpenAI models with current defaults", () => {
    const migrated = migrateAiSettings({
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-4o-mini",
    });

    expect(migrated.model).toBe("gpt-5.4-mini");
  });

  it("replaces retired Anthropic models with current defaults", () => {
    const migrated = migrateAiSettings({
      provider: "anthropic",
      apiKey: "test-key",
      model: "claude-3-5-sonnet-latest",
    });

    expect(migrated.model).toBe("claude-sonnet-5");
  });
});

describe("parseCompatibilityReport", () => {
  it("parses a valid AI payload", () => {
    const parsed = parseCompatibilityReport({
      overallScore: 82,
      categoryScores: [
        { label: "Skills", score: 80, summaryBullets: ["Strong PM fit"] },
      ],
      summaryBullets: ["Good match overall"],
      missingQualifications: [
        { item: "PMP", severity: "easyToLearn" },
      ],
      actionableAdvice: ["Highlight Agile experience"],
    });

    expect(parsed.overallScore).toBe(82);
    expect(parsed.missingQualifications[0].severity).toBe("easyToLearn");
  });
});

describe("parseResumeExtractResult", () => {
  it("parses resume extraction payload", () => {
    const parsed = parseResumeExtractResult({
      profile: {
        skills: "TypeScript",
        workExperience: [
          {
            company: "Acme",
            jobTitle: "Engineer",
            employmentPeriod: "2020-2024",
            description: "Built APIs",
          },
        ],
        projects: [],
        education: [],
        certifications: [],
        additionalInformation: "",
      },
      preferences: {
        minBasePay: null,
        remoteWork: ["remote"],
        workSchedule: ["noPreference"],
        jobType: ["fullTime"],
      },
    });

    expect(parsed.profile.skills).toBe("TypeScript");
    expect(parsed.preferences.remoteWork).toEqual(["remote"]);
  });
});
