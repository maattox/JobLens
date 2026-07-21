export const STORAGE_KEYS = {
  lastScraped: "lastScraped",
  scrapedJobs: "scrapedJobs",
  viewFormat: "viewFormat",
  profile: "profile",
  preferences: "preferences",
  aiSettings: "aiSettings",
  modelCatalog: "modelCatalog",
  /** Per-provider last successful API catalog sync timestamps (ms). */
  modelCatalogMeta: "modelCatalogMeta",
  /** Dismissible UI notice when the live model list changes. */
  modelCatalogNotice: "modelCatalogNotice",
  /** User-added model ids (manual last-resort overrides). */
  customModels: "customModels",
  fieldExtractModels: "fieldExtractModels",
  checkHistory: "checkHistory",
  privacyAcknowledged: "privacyAcknowledged",
  onboardingComplete: "onboardingComplete",
  historySort: "historySort",
} as const;
