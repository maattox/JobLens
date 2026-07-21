import { useState } from "react";
import {
  AI_MODEL_OPTIONS,
  AI_PROVIDER_LINKS,
  type AiProvider,
  type AiSettings,
} from "../../shared/types";
import { useApp } from "../context/AppContext";

export function ApiKeySetupView() {
  const { aiSettings, saveAiSettings, completeApiKeySetup } = useApp();
  const [provider, setProvider] = useState<AiProvider>(aiSettings.provider);
  const [apiKey, setApiKey] = useState(aiSettings.apiKey);

  const canContinue = apiKey.trim().length > 0;

  async function handleContinue() {
    const next: AiSettings = {
      provider,
      apiKey: apiKey.trim(),
      model: AI_MODEL_OPTIONS[provider][0],
    };
    await saveAiSettings(next);
    await completeApiKeySetup();
  }

  return (
    <section className="api-key-setup">
      <h2 style={{ marginTop: 0, fontSize: 15 }}>Connect your AI provider</h2>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 12, marginTop: 0 }}>
        This extension uses a bring-your-own-key (BYOK) model. Your API key stays
        in local browser storage and is only sent to the provider you choose when
        you run a compatibility check.
      </p>

      <div className="field">
        <label className="field-heading" htmlFor="setup-provider">
          AI provider
        </label>
        <select
          id="setup-provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as AiProvider)}
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="gemini">Google Gemini</option>
        </select>
      </div>

      <div className="field">
        <label className="field-heading" htmlFor="setup-apiKey">
          API key
        </label>
        <input
          id="setup-apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste your API key"
        />
      </div>

      <button
        type="button"
        className="primary-btn"
        disabled={!canContinue}
        onClick={() => void handleContinue()}
      >
        Continue
      </button>

      <div className="api-key-guide">
        <h3>No AI subscription yet?</h3>
        <p>
          Google Gemini offers a free tier that works well for compatibility checks.
          You only need a Google account and an API key from AI Studio.
        </p>
        <ol>
          <li>
            Open{" "}
            <a href={AI_PROVIDER_LINKS.gemini.url} target="_blank" rel="noreferrer">
              Google AI Studio
            </a>{" "}
            and sign in with your Google account.
          </li>
          <li>Click <strong>Get API key</strong> (or open the API keys page).</li>
          <li>Create a key for a new or existing Google Cloud project.</li>
          <li>Copy the key, choose <strong>Google Gemini</strong> above, and paste it here.</li>
        </ol>
        <p style={{ marginBottom: 0 }}>
          Other providers:{" "}
          <a href={AI_PROVIDER_LINKS.openai.url} target="_blank" rel="noreferrer">
            OpenAI
          </a>
          {" · "}
          <a href={AI_PROVIDER_LINKS.anthropic.url} target="_blank" rel="noreferrer">
            Anthropic
          </a>
        </p>
      </div>
    </section>
  );
}
