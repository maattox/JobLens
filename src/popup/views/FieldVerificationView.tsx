import { useMemo, useState } from "react";
import {
  applyFieldResolutions,
  JOB_META_FIELD_LABELS,
} from "../../shared/fieldCompare";
import type {
  FieldResolution,
  FieldResolutionChoice,
  JobFieldConflict,
  JobFieldsExtractResult,
  JobMetaField,
} from "../../shared/types";
import { useApp } from "../context/AppContext";
import { StatusMessage } from "../components/Ui";

function ConflictCard({
  conflict,
  choice,
  manualValue,
  onChoice,
  onManualValue,
}: {
  conflict: JobFieldConflict;
  choice: FieldResolutionChoice;
  manualValue: string;
  onChoice: (choice: FieldResolutionChoice) => void;
  onManualValue: (value: string) => void;
}) {
  const label = JOB_META_FIELD_LABELS[conflict.field];

  return (
    <div className="field-conflict-card">
      <h3 className="field-conflict-title">{label}</h3>
      <div className="field-conflict-options">
        <label className={`field-conflict-option ${choice === "scraped" ? "selected" : ""}`}>
          <input
            type="radio"
            name={`field-${conflict.field}`}
            checked={choice === "scraped"}
            onChange={() => onChoice("scraped")}
          />
          <span>
            <span className="field-conflict-option-label">Extension extract</span>
            <span className="field-conflict-option-value">
              {conflict.scrapedValue || "(empty)"}
            </span>
          </span>
        </label>
        <label className={`field-conflict-option ${choice === "ai" ? "selected" : ""}`}>
          <input
            type="radio"
            name={`field-${conflict.field}`}
            checked={choice === "ai"}
            onChange={() => onChoice("ai")}
          />
          <span>
            <span className="field-conflict-option-label">AI from page text</span>
            <span className="field-conflict-option-value">
              {conflict.aiValue || "(empty)"}
            </span>
          </span>
        </label>
        <label className={`field-conflict-option ${choice === "manual" ? "selected" : ""}`}>
          <input
            type="radio"
            name={`field-${conflict.field}`}
            checked={choice === "manual"}
            onChange={() => onChoice("manual")}
          />
          <span>
            <span className="field-conflict-option-label">Both are incorrect</span>
            <span className="field-conflict-option-value">Enter the correct value</span>
          </span>
        </label>
      </div>
      {choice === "manual" && (
        <input
          type="text"
          className="field-conflict-manual"
          value={manualValue}
          onChange={(event) => onManualValue(event.target.value)}
          placeholder={`Correct ${label.toLowerCase()}`}
        />
      )}
    </div>
  );
}

export function FieldVerificationView() {
  const {
    fieldVerification,
    clearFieldVerification,
    continueCompatibilityCheck,
    loading,
    checkPhase,
    status,
    statusType,
    setView,
  } = useApp();

  const conflicts = fieldVerification?.conflicts ?? [];

  const [choices, setChoices] = useState<Record<JobMetaField, FieldResolutionChoice>>(
    () => {
      const initial = {} as Record<JobMetaField, FieldResolutionChoice>;
      for (const conflict of conflicts) {
        initial[conflict.field] = "scraped";
      }
      return initial;
    }
  );
  const [manualValues, setManualValues] = useState<Partial<Record<JobMetaField, string>>>(
    {}
  );

  const canSubmit = useMemo(() => {
    return conflicts.every((conflict) => {
      const choice = choices[conflict.field] || "scraped";
      if (choice !== "manual") return true;
      return Boolean((manualValues[conflict.field] || "").trim());
    });
  }, [choices, conflicts, manualValues]);

  if (!fieldVerification) {
    return (
      <section>
        <p className="muted-copy">No field verification pending.</p>
        <button type="button" className="secondary-btn" onClick={() => setView("home")}>
          Back to Compatibility Check
        </button>
      </section>
    );
  }

  async function handleContinue() {
    if (!fieldVerification) return;

    const resolutions: FieldResolution[] = conflicts.map((conflict) => ({
      field: conflict.field,
      choice: choices[conflict.field] || "scraped",
      manualValue: manualValues[conflict.field],
    }));

    const base: JobFieldsExtractResult = {
      title: fieldVerification.job.title || "",
      company: fieldVerification.job.company || "",
      location: fieldVerification.job.location || "",
      salary: fieldVerification.job.salary || "",
      workMode: fieldVerification.job.workMode || "",
      employmentType: fieldVerification.job.employmentType || "",
    };

    const verifiedFields = applyFieldResolutions(
      base,
      fieldVerification.scrapedFields,
      fieldVerification.aiFields,
      resolutions
    );

    await continueCompatibilityCheck(verifiedFields);
  }

  return (
    <section className="field-verification">
      <div className="warning-banner">
        <p style={{ margin: 0 }}>
          Some job details from the page extractor don&apos;t match what the AI
          read from the page text. Choose the correct value for each field before
          running the compatibility check.
        </p>
      </div>

      <p className="field-verification-source">
        Source: {fieldVerification.job.source}
        {fieldVerification.job.title
          ? ` · ${fieldVerification.job.title}`
          : ""}
      </p>

      {conflicts.map((conflict) => (
        <ConflictCard
          key={conflict.field}
          conflict={conflict}
          choice={choices[conflict.field] || "scraped"}
          manualValue={manualValues[conflict.field] || ""}
          onChoice={(choice) =>
            setChoices((prev) => ({ ...prev, [conflict.field]: choice }))
          }
          onManualValue={(value) =>
            setManualValues((prev) => ({ ...prev, [conflict.field]: value }))
          }
        />
      ))}

      {loading && (
        <div className="loading-panel" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          <span className="loading-text">{checkPhase || "Working…"}</span>
        </div>
      )}

      <div className="button-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className={`primary-btn${loading ? " is-loading" : ""}`}
          disabled={loading || !canSubmit}
          onClick={() => void handleContinue()}
        >
          {loading ? "Checking…" : "Continue compatibility check"}
        </button>
        <button
          type="button"
          className="secondary-btn"
          disabled={loading}
          onClick={() => {
            clearFieldVerification();
            setView("home");
          }}
        >
          Cancel
        </button>
      </div>

      <StatusMessage message={status} type={statusType} />
    </section>
  );
}
