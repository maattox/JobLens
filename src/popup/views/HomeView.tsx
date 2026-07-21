import { useEffect, useState } from "react";
import {
  AI_MODEL_OPTIONS,
  type AiSettings,
} from "../../shared/types";
import { useApp } from "../context/AppContext";
import { StatusMessage } from "../components/Ui";

function urlsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.href === right.href;
  } catch {
    return a === b;
  }
}

export function HomeView() {
  const {
    loading,
    checkPhase,
    runCompatibilityCheck,
    profile,
    preferences,
    aiSettings,
    modelCatalog,
    saveAiSettings,
    privacyAcknowledged,
    acknowledgePrivacy,
    setView,
    status,
    statusType,
    lastScraped,
  } = useApp();

  const [activeTabUrl, setActiveTabUrl] = useState("");
  const [modelDraft, setModelDraft] = useState(aiSettings.model);

  useEffect(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setActiveTabUrl(tab?.url ?? "");
    });
  }, []);

  useEffect(() => {
    setModelDraft(aiSettings.model);
  }, [aiSettings.model]);

  const ready =
    profile.setupComplete && preferences.setupComplete && aiSettings.apiKey.trim();

  const showReliabilityWarning =
    Boolean(lastScraped?.reliabilityWarning) &&
    urlsMatch(lastScraped?.url ?? "", activeTabUrl);

  const provider = aiSettings.provider;
  const catalogModels = modelCatalog[provider];
  const models = catalogModels.length
    ? catalogModels.includes(modelDraft)
      ? catalogModels
      : [modelDraft, ...catalogModels]
    : AI_MODEL_OPTIONS[provider];

  async function handleModelChange(model: string) {
    setModelDraft(model);
    const next: AiSettings = { ...aiSettings, model };
    await saveAiSettings(next);
  }

  return (
    <section>
      <button
        type="button"
        className={`primary-btn${loading ? " is-loading" : ""}`}
        disabled={loading}
        onClick={() => void runCompatibilityCheck()}
      >
        {loading ? "Checking…" : "Check Job Compatibility"}
      </button>

      <div className="field home-model-field">
        <label className="field-heading" htmlFor="home-model">
          AI model
        </label>
        <select
          id="home-model"
          value={modelDraft}
          disabled={loading || !aiSettings.apiKey.trim()}
          onChange={(e) => void handleModelChange(e.target.value)}
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="loading-panel" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          <span className="loading-text">{checkPhase || "Working…"}</span>
        </div>
      )}

      <div className="home-instructions">
        <ol className="home-instructions-list">
          <li>
            Open a full job listing in its own tab (not as a search result or list
            preview)
          </li>
          <li>
            Click the button above to run a compatibility check with the
            information in your{" "}
            <button
              type="button"
              className="inline-text-btn"
              onClick={() => setView("profile")}
            >
              Profile
            </button>{" "}
            and{" "}
            <button
              type="button"
              className="inline-text-btn"
              onClick={() => setView("preferences")}
            >
              Preferences
            </button>
          </li>
        </ol>
        <p className="home-instructions-note">
          Works best on listings from Indeed.com and GovernmentJobs.com
        </p>
        <p className="home-instructions-note">
          Partial extraction support on ZipRecruiter.com and LinkedIn.com
        </p>
        <p className="home-instructions-note">
          You can also run a check on other sites when you click the button above;
          extraction may be less accurate on unsupported pages
        </p>
      </div>

      {showReliabilityWarning && (
        <div className="info-banner" style={{ marginTop: 12 }}>
          {lastScraped?.reliabilityWarning}
        </div>
      )}

      {!privacyAcknowledged && (
        <div className="info-banner" style={{ marginTop: 12 }}>
          <p style={{ margin: "0 0 8px" }}>
            Compatibility checks and resume extraction send your profile,
            preferences, job listing, and/or resume text to your chosen
            third-party AI provider (OpenAI, Anthropic, or Google Gemini). Data
            is sent only when you start those actions.
          </p>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => void acknowledgePrivacy()}
          >
            I understand — continue
          </button>
        </div>
      )}

      {!ready && (
        <div className="info-banner" style={{ marginTop: 12 }}>
          Complete setup to run checks:{" "}
          {!profile.setupComplete && (
            <button
              type="button"
              className="inline-text-btn"
              onClick={() => setView("profile")}
            >
              Profile
            </button>
          )}
          {!preferences.setupComplete && (
            <button
              type="button"
              className="inline-text-btn"
              onClick={() => setView("preferences")}
            >
              Preferences
            </button>
          )}
        </div>
      )}

      <StatusMessage message={status} type={statusType} />
    </section>
  );
}
