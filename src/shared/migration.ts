import {
  AI_MODEL_OPTIONS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_PREFERENCES,
  DEFAULT_PROFILE,
  type AiProvider,
  type AiSettings,
  type CertificationEntry,
  type CheckHistoryItem,
  type EducationEntry,
  type JobObject,
  type JobTypeOption,
  type RemoteWorkOption,
  type ScrapedJobMemory,
  type UserPreferences,
  type UserProfile,
  type WorkExperienceEntry,
  type WorkScheduleOption,
} from "./types";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBool(value: unknown): boolean {
  return Boolean(value);
}

function migrateWorkExperience(raw: unknown): WorkExperienceEntry[] {
  if (Array.isArray(raw)) {
    return raw.map((entry) => ({
      company: asString((entry as WorkExperienceEntry)?.company),
      jobTitle: asString((entry as WorkExperienceEntry)?.jobTitle),
      employmentPeriod: asString((entry as WorkExperienceEntry)?.employmentPeriod),
      description: asString((entry as WorkExperienceEntry)?.description),
    }));
  }

  const summary = asString(raw);
  if (!summary.trim()) return [];
  return [
    {
      company: "",
      jobTitle: "",
      employmentPeriod: "",
      description: summary,
    },
  ];
}

function migrateEducation(raw: unknown): EducationEntry[] {
  if (Array.isArray(raw)) {
    return raw.map((entry) => ({
      level: asString((entry as EducationEntry)?.level),
      fieldOfStudy: asString((entry as EducationEntry)?.fieldOfStudy),
      school: asString((entry as EducationEntry)?.school),
      currentlyEnrolled: asBool((entry as EducationEntry)?.currentlyEnrolled),
    }));
  }

  const text = asString(raw);
  if (!text.trim()) return [];
  return [
    {
      level: "",
      fieldOfStudy: text,
      school: "",
      currentlyEnrolled: false,
    },
  ];
}

function migrateCertifications(raw: unknown): CertificationEntry[] {
  if (Array.isArray(raw)) {
    return raw.map((entry) => ({
      name: asString((entry as CertificationEntry)?.name),
      description: asString((entry as CertificationEntry)?.description),
    }));
  }

  const text = asString(raw);
  if (!text.trim()) return [];
  return [{ name: "", description: text }];
}

function migrateRemoteWork(raw: unknown): RemoteWorkOption[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw as RemoteWorkOption[];
  }

  const legacy = asString(raw);
  switch (legacy) {
    case "remote":
      return ["remote"];
    case "hybrid":
      return ["hybrid"];
    case "onsite":
      return ["onsite"];
    default:
      return ["noPreference"];
  }
}

function migrateCheckboxGroup<T extends string>(
  raw: unknown,
  fallback: T[]
): T[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw as T[];
  }
  return fallback;
}

export function migrateProfile(raw: unknown): UserProfile {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PROFILE };
  }

  const data = raw as Record<string, unknown>;

  if (Array.isArray(data.workExperience)) {
    return {
      skills: asString(data.skills),
      workExperience: migrateWorkExperience(data.workExperience),
      projects: Array.isArray(data.projects)
        ? data.projects.map((entry) => ({
            name: asString((entry as { name?: string })?.name),
            description: asString((entry as { description?: string })?.description),
          }))
        : [],
      education: migrateEducation(data.education),
      certifications: migrateCertifications(data.certifications),
      additionalInformation: asString(data.additionalInformation),
      resumeFileName: asString(data.resumeFileName) || undefined,
      parsedResumeText: asString(data.parsedResumeText),
      setupComplete: asBool(data.setupComplete),
    };
  }

  return {
    skills: asString(data.skills),
    workExperience: migrateWorkExperience(data.experienceSummary),
    projects: [],
    education: migrateEducation(data.education),
    certifications: migrateCertifications(data.certifications),
    additionalInformation: asString(data.additionalInformation),
    resumeFileName: undefined,
    parsedResumeText: asString(data.parsedResumeText),
    setupComplete: asBool(data.setupComplete),
  };
}

export function migratePreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PREFERENCES };
  }

  const data = raw as Record<string, unknown>;

  if ("minBasePay" in data || Array.isArray(data.remoteWork)) {
    return {
      minBasePay:
        typeof data.minBasePay === "number"
          ? data.minBasePay
          : data.minBasePay === null
            ? null
            : null,
      maxCommuteMinutes:
        typeof data.maxCommuteMinutes === "number"
          ? data.maxCommuteMinutes
          : data.maxCommuteMinutes === null
            ? null
            : null,
      remoteWork: migrateCheckboxGroup<RemoteWorkOption>(
        data.remoteWork,
        DEFAULT_PREFERENCES.remoteWork
      ),
      workSchedule: migrateCheckboxGroup<WorkScheduleOption>(
        data.workSchedule,
        DEFAULT_PREFERENCES.workSchedule
      ),
      jobType: migrateCheckboxGroup<JobTypeOption>(
        data.jobType,
        DEFAULT_PREFERENCES.jobType
      ),
      setupComplete: asBool(data.setupComplete),
    };
  }

  const minSalary =
    typeof data.minSalary === "number"
      ? data.minSalary
      : data.minSalary === null
        ? null
        : null;

  return {
    minBasePay: minSalary,
    maxCommuteMinutes:
      typeof data.maxCommuteMinutes === "number"
        ? data.maxCommuteMinutes
        : data.maxCommuteMinutes === null
          ? null
          : null,
    remoteWork: migrateRemoteWork(data.workModePreference),
    workSchedule: ["noPreference"],
    jobType: ["noPreference"],
    setupComplete: asBool(data.setupComplete),
  };
}

const RETIRED_MODEL_ALIASES: Partial<Record<AiProvider, Record<string, string>>> = {
  openai: {
    "gpt-4o-mini": "gpt-5.4-mini",
    "gpt-4o": "gpt-5.6",
    "gpt-4.1": "gpt-5.6",
    "gpt-4.1-mini": "gpt-5.4-mini",
    "gpt-5.4": "gpt-5.6",
    "gpt-5.5": "gpt-5.6",
  },
  anthropic: {
    "claude-3-5-haiku-latest": "claude-haiku-4-5",
    "claude-3-5-sonnet-latest": "claude-sonnet-5",
    "claude-sonnet-4-20250514": "claude-sonnet-5",
  },
  gemini: {
    "gemini-1.5-flash": "gemini-3.6-flash",
    "gemini-2.5-flash": "gemini-3.6-flash",
    "gemini-2.5-pro": "gemini-3.6-flash",
    "gemini-3-flash-preview": "gemini-3.6-flash",
    "gemini-3.5-flash": "gemini-3.6-flash",
    "gemini-3.1-flash-lite": "gemini-3.5-flash-lite",
    "gemini-3.1-pro-preview": "gemini-3.6-flash",
  },
};

export function migrateAiSettings(raw: unknown): AiSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_AI_SETTINGS };
  }

  const data = raw as Partial<AiSettings>;
  const provider: AiProvider =
    data.provider === "openai" ||
    data.provider === "anthropic" ||
    data.provider === "gemini"
      ? data.provider
      : DEFAULT_AI_SETTINGS.provider;

  const allowedModels = AI_MODEL_OPTIONS[provider];
  const requestedModel =
    typeof data.model === "string" ? data.model.trim() : "";
  const aliasedModel =
    requestedModel && RETIRED_MODEL_ALIASES[provider]?.[requestedModel]
      ? RETIRED_MODEL_ALIASES[provider]![requestedModel]
      : requestedModel;
  // Keep curated, aliased, or user-entered custom model ids.
  const model = aliasedModel || allowedModels[0];

  return {
    provider,
    apiKey: typeof data.apiKey === "string" ? data.apiKey : "",
    model,
  };
}

function migrateCompanyField(
  data: Record<string, unknown>
): string {
  if (typeof data.company === "string" && data.company.trim()) {
    return data.company;
  }
  return asString(data.department);
}

export function migrateJobObject(raw: unknown): JobObject | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  return {
    title: asString(data.title),
    jobNumber: asString(data.jobNumber),
    salary: asString(data.salary),
    company: migrateCompanyField(data),
    location: asString(data.location),
    workMode: asString(data.workMode),
    employmentType: asString(data.employmentType),
    url: asString(data.url),
    source:
      data.source === "governmentjobs" ||
      data.source === "indeed" ||
      data.source === "ziprecruiter" ||
      data.source === "linkedin" ||
      data.source === "unsupported"
        ? data.source
        : "unsupported",
    sections: Array.isArray(data.sections)
      ? data.sections.map((section) => ({
          heading: asString((section as { heading?: string })?.heading),
          markdown: asString((section as { markdown?: string })?.markdown),
          plain: asString((section as { plain?: string })?.plain),
        }))
      : [],
    rawText: asString(data.rawText),
    markdown: asString(data.markdown),
    plainText: asString(data.plainText),
    isSupported: asBool(data.isSupported),
    reliabilityWarning:
      typeof data.reliabilityWarning === "string"
        ? data.reliabilityWarning
        : undefined,
  };
}

export function migrateCheckHistoryItem(raw: unknown): CheckHistoryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const job = migrateJobObject(data.job);
  if (!job || !data.report || typeof data.report !== "object") return null;

  return {
    key: asString(data.key),
    reportId:
      asString(data.reportId) ||
      asString((data.report as { reportId?: string } | undefined)?.reportId) ||
      undefined,
    jobNumber: asString(data.jobNumber) || job.jobNumber,
    title: asString(data.title) || job.title,
    salary: asString(data.salary) || job.salary,
    company: migrateCompanyField(data) || job.company,
    location: asString(data.location) || job.location,
    url: asString(data.url) || job.url,
    source: job.source,
    report: {
      ...(data.report as CheckHistoryItem["report"]),
      reportId:
        asString((data.report as { reportId?: string })?.reportId) ||
        asString(data.reportId) ||
        `legacy_${asString(data.key).slice(0, 24) || "unknown"}`,
    },
    job,
    extractedJob: data.extractedJob
      ? migrateJobObject(data.extractedJob) || undefined
      : undefined,
    followUps: Array.isArray(data.followUps)
      ? data.followUps.map((entry) => ({
          id: asString((entry as { id?: string })?.id),
          question: asString((entry as { question?: string })?.question),
          answer: asString((entry as { answer?: string })?.answer),
          askedAt: asString((entry as { askedAt?: string })?.askedAt),
        }))
      : [],
    aiConversation:
      data.aiConversation && typeof data.aiConversation === "object"
        ? (data.aiConversation as CheckHistoryItem["aiConversation"])
        : undefined,
  };
}

export function migrateCheckHistory(raw: unknown): CheckHistoryItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => migrateCheckHistoryItem(item))
    .filter((item): item is CheckHistoryItem => item !== null);
}

export function migrateScrapedJobMemory(raw: unknown): ScrapedJobMemory | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  return {
    key: asString(data.key),
    jobNumber: asString(data.jobNumber),
    title: asString(data.title),
    salary: asString(data.salary),
    company: migrateCompanyField(data),
    scrapedAt: asString(data.scrapedAt),
  };
}

export function migrateScrapedJobs(raw: unknown): ScrapedJobMemory[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => migrateScrapedJobMemory(item))
    .filter((item): item is ScrapedJobMemory => item !== null);
}
