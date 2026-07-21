import { useEffect, useState } from "react";
import {
  AI_MODEL_OPTIONS,
  AI_PROVIDER_LINKS,
  type AiProvider,
  type AiSettings,
} from "../../shared/types";
import { SaveButton } from "../components/SaveButton";
import { useApp } from "../context/AppContext";

export function SettingsView() {
  const { aiSettings, modelCatalog, saveAiSettings } = useApp();
  const [draft, setDraft] = useState<AiSettings>(aiSettings);

  useEffect(() => {
    setDraft(aiSettings);
  }, [aiSettings]);

  function update<K extends keyof AiSettings>(key: K, value: AiSettings[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    await saveAiSettings(draft);
  }

  const provider = draft.provider;
  const catalogModels = modelCatalog[provider];
  const models = catalogModels.length
    ? catalogModels.includes(draft.model)
      ? catalogModels
      : [draft.model, ...catalogModels]
    : AI_MODEL_OPTIONS[provider];

  return (
    <section>
      <div className="info-banner">
        Testing was only done with Google Gemini, so while Anthropic and OpenAI
        models should work, you may encounter more issues with those providers.
      </div>

      <div className="info-banner">
        This extension uses a bring-your-own-key (BYOK) model. Your API key stays
        in local browser storage and is only used for requests you initiate.
      </div>

      <div className="field">
        <label className="field-heading" htmlFor="provider">
          AI provider
        </label>
        <select
          id="provider"
          value={draft.provider}
          onChange={(e) => {
            const nextProvider = e.target.value as AiProvider;
            const nextModels = modelCatalog[nextProvider].length
              ? modelCatalog[nextProvider]
              : AI_MODEL_OPTIONS[nextProvider];
            update("provider", nextProvider);
            update("model", nextModels[0]);
          }}
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="gemini">Google Gemini</option>
        </select>
      </div>

      <div className="field">
        <label className="field-heading" htmlFor="apiKey">
          API key
        </label>
        <input
          id="apiKey"
          type="password"
          value={draft.apiKey}
          onChange={(e) => update("apiKey", e.target.value)}
          placeholder="Paste your API key"
        />
      </div>

      <div className="field">
        <label className="field-heading" htmlFor="model">
          Model
        </label>
        <select
          id="model"
          value={draft.model}
          onChange={(e) => update("model", e.target.value)}
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      <p style={{ fontSize: 12 }}>
        Get a key:{" "}
        <a href={AI_PROVIDER_LINKS[provider].url} target="_blank" rel="noreferrer">
          {AI_PROVIDER_LINKS[provider].label}
        </a>
      </p>

      <SaveButton
        label="Save settings"
        savedLabel="Settings Saved"
        onSave={handleSave}
      />
    </section>
  );
}
