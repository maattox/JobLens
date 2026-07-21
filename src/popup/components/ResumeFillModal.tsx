import { useState } from "react";
import { extractTextFromPdf } from "../../shared/pdfExtract";
import type { ResumeExtractResult } from "../../shared/types";
import { Modal } from "./Ui";
import { useApp } from "../context/AppContext";

interface ResumeFillModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (data: ResumeExtractResult) => void;
}

export function ResumeFillModal({ open, onClose, onApply }: ResumeFillModalProps) {
  const {
    extractFromResume,
    aiSettings,
    setView,
    privacyAcknowledged,
    acknowledgePrivacy,
  } = useApp();
  const [fileName, setFileName] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleFileChange(file: File | null) {
    setError("");
    setResumeText("");
    setFileName("");

    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }

    try {
      const text = await extractTextFromPdf(file);
      setResumeText(text);
      setFileName(file.name);
    } catch {
      setError("Could not read the PDF. Try another file.");
    }
  }

  async function handleExtract() {
    setError("");
    setLoading(true);

    try {
      if (!privacyAcknowledged) {
        setError("Acknowledge the privacy notice before extracting from a resume.");
        return;
      }

      if (!aiSettings.apiKey.trim()) {
        setError("Add your API key in Settings first.");
        setView("settings");
        return;
      }

      const data = await extractFromResume(resumeText);
      onApply(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume extraction failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Fill from resume" onClose={onClose}>
      <div className="info-banner" style={{ marginBottom: 12 }}>
        Your resume will be sent to your chosen AI provider. Review all extracted
        fields before saving — automated extraction may be inaccurate.
      </div>

      {!privacyAcknowledged && (
        <div className="info-banner" style={{ marginBottom: 12 }}>
          <p style={{ margin: "0 0 8px" }}>
            Resume extraction sends resume text to your chosen third-party AI
            provider. Acknowledge this before continuing.
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

      <div className="field">
        <label className="field-heading" htmlFor="resume-upload">
          Resume (PDF)
        </label>
        <input
          id="resume-upload"
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => void handleFileChange(e.target.files?.[0] || null)}
        />
        {fileName && (
          <p style={{ fontSize: 12, marginTop: 6 }}>Selected: {fileName}</p>
        )}
      </div>

      {error && (
        <p style={{ color: "var(--color-warning-text)", fontSize: 12, marginTop: 8 }}>{error}</p>
      )}

      <div className="button-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className={`primary-btn${loading ? " is-loading" : ""}`}
          disabled={!resumeText.trim() || loading || !privacyAcknowledged}
          onClick={() => void handleExtract()}
        >
          {loading ? "Extracting..." : "Extract info from resume"}
        </button>
        <button type="button" className="secondary-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
