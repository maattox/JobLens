import {
  AI_MODEL_OPTIONS as CURATED_AI_MODEL_OPTIONS,
  DEFAULT_MODEL_BY_PROVIDER,
} from "./aiModelDefaults";

export type RemoteWorkOption = "remote" | "hybrid" | "onsite" | "noPreference";

export type WorkScheduleOption =
  | "day"
  | "evening"
  | "night"
  | "rotating"
  | "onCall"
  | "noPreference";

export type JobTypeOption =
  | "fullTime"
  | "partTime"
  | "contract"
  | "temporary"
  | "internship"
  | "noPreference";

export type JobSource =
  | "governmentjobs"
  | "indeed"
  | "ziprecruiter"
  | "linkedin"
  | "unsupported";

export type AiProvider = "openai" | "anthropic" | "gemini";

/** Result of syncing the live provider model list into local storage. */
export interface ModelCatalogSyncResult {
  provider: AiProvider;
  models: string[];
  /** True when the stored model list differed from the live API list. */
  changed: boolean;
  /** True when the user's selected model was replaced because it left the catalog. */
  modelSwitched: boolean;
  previousModel: string;
  currentModel: string;
  /** True when a live API refresh ran (false when skipped due to TTL cache). */
  refreshed: boolean;
  /** Human-readable notice for the UI when changed/switched. */
  notice: string | null;
}

export interface ModelCatalogNotice {
  message: string;
  updatedAt: string;
  provider: AiProvider;
}

export interface ModelCatalogMeta {
  lastSyncedAt: Partial<Record<AiProvider, number>>;
}

export interface JobSection {
  heading: string;
  markdown: string;
  plain: string;
}

export interface JobObject {
  title: string;
  jobNumber: string;
  salary: string;
  company: string;
  location: string;
  workMode: string;
  employmentType: string;
  url: string;
  source: JobSource;
  sections: JobSection[];
  rawText: string;
  markdown: string;
  plainText: string;
  isSupported: boolean;
  reliabilityWarning?: string;
}

export interface WorkExperienceEntry {
  company: string;
  jobTitle: string;
  employmentPeriod: string;
  description: string;
}

export interface ProjectEntry {
  name: string;
  description: string;
}

export interface EducationEntry {
  level: string;
  fieldOfStudy: string;
  school: string;
  currentlyEnrolled: boolean;
}

export interface CertificationEntry {
  name: string;
  description: string;
}

export interface UserProfile {
  skills: string;
  workExperience: WorkExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  additionalInformation: string;
  resumeFileName?: string;
  parsedResumeText: string;
  setupComplete: boolean;
}

export interface UserPreferences {
  minBasePay: number | null;
  maxCommuteMinutes: number | null;
  remoteWork: RemoteWorkOption[];
  workSchedule: WorkScheduleOption[];
  jobType: JobTypeOption[];
  setupComplete: boolean;
}

export interface AiSettings {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

export type ModelCatalog = Record<AiProvider, string[]>;

export interface CategoryScore {
  label: string;
  score: number;
  summaryBullets: string[];
}

export interface MissingQualification {
  item: string;
  severity: "easyToLearn" | "majorGap";
}

export interface JobFieldCorrections {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  workMode?: string;
  employmentType?: string;
}

/** Structured job metadata fields used for Zip/LinkedIn verification. */
export type JobMetaField = keyof JobFieldCorrections;

export const JOB_META_FIELDS: JobMetaField[] = [
  "title",
  "company",
  "location",
  "salary",
  "workMode",
  "employmentType",
];

export interface JobFieldsExtractResult {
  title: string;
  company: string;
  location: string;
  salary: string;
  workMode: string;
  employmentType: string;
}

export interface JobFieldConflict {
  field: JobMetaField;
  scrapedValue: string;
  aiValue: string;
}

export type FieldResolutionChoice = "scraped" | "ai" | "manual";

export interface FieldResolution {
  field: JobMetaField;
  choice: FieldResolutionChoice;
  /** Required when choice is "manual"; otherwise ignored. */
  manualValue?: string;
}

export interface FieldVerificationState {
  job: JobObject;
  scrapedFields: JobFieldsExtractResult;
  aiFields: JobFieldsExtractResult;
  conflicts: JobFieldConflict[];
}

export interface FollowUpEntry {
  id: string;
  question: string;
  answer: string;
  askedAt: string;
}

export interface AiConversationContext {
  provider: AiProvider;
  openaiResponseId?: string;
  geminiInteractionId?: string;
  anthropicMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  createdAt: string;
}

export type ReportViewSource = "fresh" | "liveCache" | "history";

export interface ReportDebugInfo {
  /** Snapshot of job fields as extracted before AI corrections. */
  extractedJob: Pick<
    JobObject,
    | "title"
    | "company"
    | "location"
    | "salary"
    | "workMode"
    | "employmentType"
    | "source"
    | "isSupported"
  >;
  /** Fields changed by AI jobFieldCorrections, if any. */
  appliedFieldCorrections?: {
    fields: string[];
    before: Record<string, string>;
    after: Record<string, string>;
  };
  extractionSupported: boolean;
  reliabilityWarning?: string;
}

export interface CompatibilityReport {
  /** Stable ID for this report (for debugging / support). */
  reportId: string;
  overallScore: number;
  categoryScores: CategoryScore[];
  summaryBullets: string[];
  missingQualifications: MissingQualification[];
  actionableAdvice: string[];
  checkedAt: string;
  cached: boolean;
  jobFieldCorrections?: JobFieldCorrections;
  debug?: ReportDebugInfo;
}

export interface CheckHistoryItem {
  key: string;
  reportId?: string;
  jobNumber: string;
  title: string;
  salary: string;
  company: string;
  location: string;
  url: string;
  source: JobSource;
  report: CompatibilityReport;
  job: JobObject;
  /** Pre-correction extraction snapshot when available. */
  extractedJob?: JobObject;
  followUps?: FollowUpEntry[];
  aiConversation?: AiConversationContext;
}

export interface ScrapedJobMemory {
  key: string;
  jobNumber: string;
  title: string;
  salary: string;
  company: string;
  scrapedAt: string;
}

export interface ResumeExtractResult {
  profile: Pick<
    UserProfile,
    | "skills"
    | "workExperience"
    | "projects"
    | "education"
    | "certifications"
    | "additionalInformation"
  >;
  preferences: Pick<
    UserPreferences,
    "minBasePay" | "remoteWork" | "workSchedule" | "jobType"
  >;
}

export interface PreCheckResult {
  passed: boolean;
  hardMismatch: boolean;
  reasons: string[];
}

export interface ScrapeResponse {
  success: boolean;
  data?: JobObject;
  error?: string;
  isDuplicate?: boolean;
}

export interface CompatibilityCheckResponse {
  success: boolean;
  report?: CompatibilityReport;
  job?: JobObject;
  preCheck?: PreCheckResult;
  skippedAi?: boolean;
  isCached?: boolean;
  reportViewSource?: ReportViewSource;
  followUps?: FollowUpEntry[];
  aiConversation?: AiConversationContext;
  historyKey?: string;
  error?: string;
  /**
   * ZipRecruiter / LinkedIn: scraped vs AI field extract disagreed.
   * Popup must resolve conflicts before continuing the check.
   */
  needsFieldVerification?: boolean;
  scrapedFields?: JobFieldsExtractResult;
  aiFields?: JobFieldsExtractResult;
  fieldConflicts?: JobFieldConflict[];
}

export type HistorySortOption =
  | "overall"
  | "skills"
  | "experience"
  | "preferences"
  | "date";

export const EMPTY_WORK_EXPERIENCE: WorkExperienceEntry = {
  company: "",
  jobTitle: "",
  employmentPeriod: "",
  description: "",
};

export const EMPTY_PROJECT: ProjectEntry = {
  name: "",
  description: "",
};

export const EMPTY_EDUCATION: EducationEntry = {
  level: "",
  fieldOfStudy: "",
  school: "",
  currentlyEnrolled: false,
};

export const EMPTY_CERTIFICATION: CertificationEntry = {
  name: "",
  description: "",
};

export const DEFAULT_PROFILE: UserProfile = {
  skills: "",
  workExperience: [],
  projects: [],
  education: [],
  certifications: [],
  additionalInformation: "",
  parsedResumeText: "",
  setupComplete: false,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  minBasePay: null,
  maxCommuteMinutes: null,
  remoteWork: ["noPreference"],
  workSchedule: ["noPreference"],
  jobType: ["noPreference"],
  setupComplete: false,
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "gemini",
  apiKey: "",
  model: DEFAULT_MODEL_BY_PROVIDER.gemini,
};

export const AI_MODEL_OPTIONS: Record<AiProvider, string[]> = {
  openai: [...CURATED_AI_MODEL_OPTIONS.openai],
  anthropic: [...CURATED_AI_MODEL_OPTIONS.anthropic],
  gemini: [...CURATED_AI_MODEL_OPTIONS.gemini],
};

export const AI_PROVIDER_LINKS: Record<AiProvider, { label: string; url: string }> = {
  openai: {
    label: "OpenAI API keys",
    url: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    label: "Anthropic API keys",
    url: "https://console.anthropic.com/settings/keys",
  },
  gemini: {
    label: "Google AI Studio API keys",
    url: "https://aistudio.google.com/apikey",
  },
};
