import { useEffect, useState } from "react";
import {
  buildSelectableModels,
  formatModelOptionLabel,
  normalizeModelId,
} from "../../shared/customModels";
import {
  AI_MODEL_OPTIONS,
  AI_PROVIDER_LINKS,
  type AiProvider,
  type AiSettings,
} from "../../shared/types";
import { SaveButton } from "../components/SaveButton";
import { useApp } from "../context/AppContext";

const PROVIDER_MODEL_HELP: Record<
  AiProvider,
  { idLabel: string; idHint: string; example: string }
> = {
  openai: {
    idLabel: "Model ID",
    idHint:
      "Exact id for OpenAI’s Responses API `model` field (same string as in the Models list).",
    example: "gpt-5.6",
  },
  anthropic: {
    idLabel: "Model ID",
    idHint:
      "Exact id for Anthropic’s Messages API `model` field (alias or dated id).",
    example: "claude-sonnet-5",
  },
  gemini: {
    idLabel: "Model ID",
    idHint:
      "Exact id for Gemini’s Interactions / generateContent `model` field. A leading models/ prefix is stripped automatically.",
    example: "gemini-3.6-flash",
  },
};

export function SettingsView() {
  const {
    aiSettings,
    modelCatalog,
    modelCatalogNotice,
    customModels,
    dismissModelCatalogNotice,
    saveAiSettings,
    addCustomModel,
    removeCustomModelEntry,
  } = useApp();
  const [draft, setDraft] = useState<AiSettings>(aiSettings);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualId, setManualId] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualError, setManualError] = useState("");
  const [manualStatus, setManualStatus] = useState("");

  useEffect(() => {
    setDraft(aiSettings);
  }, [aiSettings]);

  useEffect(() => {
    const models = buildSelectableModels(
      modelCatalog[draft.provider] ?? [],
      customModels[draft.provider]
    );
    if (!models.length) return;
    if (!models.includes(draft.model)) {
      setDraft((prev) => ({ ...prev, model: models[0] }));
    }
  }, [modelCatalog, customModels, draft.provider, draft.model]);

  function update<K extends keyof AiSettings>(key: K, value: AiSettings[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    await saveAiSettings(draft);
  }

  async function handleAddManualModel() {
    setManualError("");
    setManualStatus("");
    const id = normalizeModelId(manualId);
    if (!id) {
      setManualError("Enter a model ID.");
      return;
    }

    const saved = await addCustomModel(draft.provider, {
      id,
      label: manualLabel,
      notes: manualNotes,
    });
    if (!saved) {
      setManualError("Could not save that model ID.");
      return;
    }

    setDraft((prev) => ({ ...prev, model: saved.id }));
    setManualId("");
    setManualLabel("");
    setManualNotes("");
    setManualStatus(`Added “${saved.id}” and selected it.`);
    setShowManualForm(false);
  }

  const provider = draft.provider;
  const providerCustom = customModels[provider];
  const catalogModels = modelCatalog[provider] ?? [];
  const models = buildSelectableModels(
    catalogModels.length ? catalogModels : AI_MODEL_OPTIONS[provider],
    providerCustom
  );
  const help = PROVIDER_MODEL_HELP[provider];

  return (
    <section>
      <div className="info-banner">
        Testing was only done with Google Gemini, so while Anthropic and OpenAI
        models should work, you may encounter more issues with those providers.
      </div>

      {modelCatalogNotice && (
        <div className="info-banner" style={{ marginTop: 12 }} role="status">
          <p style={{ margin: "0 0 8px" }}>{modelCatalogNotice.message}</p>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => void dismissModelCatalogNotice()}
          >
            Dismiss
          </button>
        </div>
      )}

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
            const nextModels = buildSelectableModels(
              modelCatalog[nextProvider].length
                ? modelCatalog[nextProvider]
                : AI_MODEL_OPTIONS[nextProvider],
              customModels[nextProvider]
            );
            update("provider", nextProvider);
            update("model", nextModels[0] ?? AI_MODEL_OPTIONS[nextProvider][0]);
            setShowManualForm(false);
            setManualError("");
            setManualStatus("");
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
          value={models.includes(draft.model) ? draft.model : models[0] ?? ""}
          onChange={(e) => update("model", e.target.value)}
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {formatModelOptionLabel(model, providerCustom)}
            </option>
          ))}
        </select>
      </div>

      <div className="button-row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            setShowManualForm((open) => !open);
            setManualError("");
            setManualStatus("");
          }}
        >
          {showManualForm ? "Cancel add model" : "Add model (manual)"}
        </button>
      </div>

      {manualStatus && (
        <p className="field-success" style={{ marginTop: 8 }}>
          {manualStatus}
        </p>
      )}

      {showManualForm && (
        <div className="info-banner" style={{ marginTop: 12 }}>
          <p style={{ margin: "0 0 8px" }}>
            Last resort: add a model id by hand if it is missing from the list.
            JobLens only needs the provider’s <code>model</code> id (your API
            key is already set above).
          </p>

          <div className="field">
            <label className="field-heading" htmlFor="manualModelId">
              {help.idLabel} <span aria-hidden="true">*</span>
            </label>
            <input
              id="manualModelId"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder={help.example}
              autoComplete="off"
            />
            <p style={{ fontSize: 12, margin: "6px 0 0" }}>{help.idHint}</p>
          </div>

          <div className="field">
            <label className="field-heading" htmlFor="manualModelLabel">
              Display label (optional)
            </label>
            <input
              id="manualModelLabel"
              value={manualLabel}
              onChange={(e) => setManualLabel(e.target.value)}
              placeholder="Friendly name in the dropdown"
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label className="field-heading" htmlFor="manualModelNotes">
              Notes (optional)
            </label>
            <textarea
              id="manualModelNotes"
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="Not sent to the API — for your reference only"
              rows={2}
            />
          </div>

          {manualError && <p className="field-error">{manualError}</p>}

          <button
            type="button"
            className="accent-btn"
            onClick={() => void handleAddManualModel()}
          >
            Save manual model
          </button>
        </div>
      )}

      {providerCustom.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p className="field-heading" style={{ marginBottom: 6 }}>
            Manual models
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {providerCustom.map((entry) => (
              <li key={entry.id} style={{ marginBottom: 6 }}>
                <code>{entry.id}</code>
                {entry.label ? ` — ${entry.label}` : ""}
                <button
                  type="button"
                  className="inline-text-btn"
                  style={{ marginLeft: 8 }}
                  onClick={() => void removeCustomModelEntry(provider, entry.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
