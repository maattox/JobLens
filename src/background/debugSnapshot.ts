import { getTabPageUrl, isInjectableUrl } from "./tabUtils";
import { migrateAiSettings, migrateJobObject, migratePreferences, migrateProfile } from "../shared/migration";
import { STORAGE_KEYS } from "../shared/storage";
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_PREFERENCES,
  DEFAULT_PROFILE,
  type CheckHistoryItem,
} from "../shared/types";
import { sanitizeForReport } from "../shared/debug/sanitize";
import type { DebugRuntimeSnapshot } from "../shared/debug/types";

/** Background-only: environment + sanitized storage snapshot for issue reports. */
export async function collectRuntimeSnapshot(): Promise<{
  environment: DebugRuntimeSnapshot;
  state: Record<string, unknown>;
}> {
  const manifest = chrome.runtime.getManifest();
  const stored = await chrome.storage.local.get(null);
  const storageKeys = Object.keys(stored).sort();

  const aiSettings = migrateAiSettings(
    stored[STORAGE_KEYS.aiSettings] ?? DEFAULT_AI_SETTINGS
  );
  const profile = migrateProfile(stored[STORAGE_KEYS.profile] ?? DEFAULT_PROFILE);
  const preferences = migratePreferences(
    stored[STORAGE_KEYS.preferences] ?? DEFAULT_PREFERENCES
  );
  const history = (stored[STORAGE_KEYS.checkHistory] as CheckHistoryItem[] | undefined) ?? [];
  const lastScraped = migrateJobObject(stored[STORAGE_KEYS.lastScraped]);

  let activeTab: DebugRuntimeSnapshot["activeTab"];
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) {
      const url = getTabPageUrl(tab);
      activeTab = {
        id: tab.id,
        url: url && isInjectableUrl(url) ? url : url ? "[non-http tab]" : undefined,
        title: tab.title,
        status: tab.status,
      };
    }
  } catch {
    /* tabs may be unavailable */
  }

  const mostRecent = history[0];
  const environment: DebugRuntimeSnapshot = {
    extensionVersion: manifest.version,
    manifestVersion: manifest.manifest_version,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    extensionId: chrome.runtime.id,
    serviceWorkerAlive: true,
    storageKeys,
    activeTab,
    ai: {
      provider: aiSettings.provider,
      model: aiSettings.model,
      hasApiKey: Boolean(aiSettings.apiKey.trim()),
    },
    flags: {
      privacyAcknowledged: Boolean(stored[STORAGE_KEYS.privacyAcknowledged]),
      onboardingComplete: Boolean(stored[STORAGE_KEYS.onboardingComplete]),
      profileSetupComplete: profile.setupComplete,
      preferencesSetupComplete: preferences.setupComplete,
    },
    latestHistorySummary: {
      count: history.length,
      mostRecent: mostRecent
        ? {
            key: mostRecent.key,
            reportId: mostRecent.reportId ?? mostRecent.report?.reportId,
            title: mostRecent.title,
            url: mostRecent.url,
            overallScore: mostRecent.report?.overallScore,
            checkedAt: mostRecent.report?.checkedAt,
          }
        : undefined,
    },
    lastScrapedSummary: lastScraped
      ? {
          title: lastScraped.title,
          company: lastScraped.company,
          source: lastScraped.source,
          url: lastScraped.url,
          isSupported: lastScraped.isSupported,
        }
      : undefined,
  };

  const state = sanitizeForReport({
    profile: {
      setupComplete: profile.setupComplete,
      skillsLength: profile.skills.length,
      workExperienceCount: profile.workExperience.length,
      projectsCount: profile.projects.length,
      educationCount: profile.education.length,
      certificationsCount: profile.certifications.length,
      hasResumeFileName: Boolean(profile.resumeFileName),
      resumeFileName: profile.resumeFileName,
      parsedResumeTextLength: profile.parsedResumeText.length,
      additionalInformationLength: profile.additionalInformation.length,
      skills: profile.skills,
      workExperience: profile.workExperience,
      projects: profile.projects,
      education: profile.education,
      certifications: profile.certifications,
      additionalInformation: profile.additionalInformation,
      parsedResumeText: profile.parsedResumeText,
    },
    preferences,
    lastScraped: lastScraped
      ? {
          title: lastScraped.title,
          company: lastScraped.company,
          location: lastScraped.location,
          salary: lastScraped.salary,
          workMode: lastScraped.workMode,
          employmentType: lastScraped.employmentType,
          source: lastScraped.source,
          url: lastScraped.url,
          isSupported: lastScraped.isSupported,
          reliabilityWarning: lastScraped.reliabilityWarning,
          jobNumber: lastScraped.jobNumber,
          sectionHeadings: lastScraped.sections.map((s) => s.heading),
          plainTextLength: lastScraped.plainText.length,
          plainText: lastScraped.plainText,
          markdownLength: lastScraped.markdown.length,
        }
      : null,
    mostRecentReport: mostRecent
      ? {
          key: mostRecent.key,
          report: mostRecent.report,
          extractedJob: mostRecent.extractedJob
            ? {
                title: mostRecent.extractedJob.title,
                source: mostRecent.extractedJob.source,
                isSupported: mostRecent.extractedJob.isSupported,
              }
            : undefined,
          followUpCount: mostRecent.followUps?.length ?? 0,
          hasAiConversation: Boolean(mostRecent.aiConversation),
          aiConversationMeta: mostRecent.aiConversation
            ? {
                provider: mostRecent.aiConversation.provider,
                createdAt: mostRecent.aiConversation.createdAt,
                hasOpenaiResponseId: Boolean(
                  mostRecent.aiConversation.openaiResponseId
                ),
                hasGeminiInteractionId: Boolean(
                  mostRecent.aiConversation.geminiInteractionId
                ),
                anthropicMessageCount:
                  mostRecent.aiConversation.anthropicMessages?.length ?? 0,
              }
            : undefined,
        }
      : null,
  }) as Record<string, unknown>;

  return { environment, state };
}
