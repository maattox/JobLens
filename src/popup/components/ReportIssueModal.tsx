import { useEffect, useState } from "react";
import {
  buildIssueReport,
  formatIssueReportMarkdown,
  isDebugTelemetryEnabled,
  issueReportFileName,
  type DebugRuntimeSnapshot,
  type DebugUiSnapshot,
} from "../../shared/debug";
import { downloadTextFile } from "../../shared/jsonFile";
import { MSG } from "../../shared/messages";
import { useApp } from "../context/AppContext";
import { Modal } from "./Ui";

interface ReportContextResponse {
  success: boolean;
  telemetry?: import("../../shared/debug").DebugLogEntry[];
  environment?: DebugRuntimeSnapshot;
  state?: Record<string, unknown>;
  error?: string;
}

export function ReportIssueButton() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, busy]);

  if (!isDebugTelemetryEnabled()) return null;

  async function createReport() {
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = (await chrome.runtime.sendMessage({
        type: MSG.DEBUG_GET_REPORT_CONTEXT,
      })) as ReportContextResponse;

      if (!response?.success || !response.environment || !response.state) {
        throw new Error(response?.error || "Could not collect debug context.");
      }

      const ui: DebugUiSnapshot = {
        shellMode: app.shellMode,
        view: app.view,
        status: app.status,
        statusType: app.statusType,
        loading: app.loading,
        followUpLoading: app.followUpLoading,
        checkPhase: app.checkPhase,
        historySort: app.historySort,
        historyCount: app.checkHistory.length,
        hasLatestCheck: Boolean(app.latestCheck),
        latestCheckSummary: app.latestCheck
          ? {
              success: app.latestCheck.success,
              skippedAi: app.latestCheck.skippedAi,
              isCached: app.latestCheck.isCached,
              reportViewSource: app.latestCheck.reportViewSource,
              historyKey: app.latestCheck.historyKey,
              reportId: app.latestCheck.report?.reportId,
              overallScore: app.latestCheck.report?.overallScore,
              error: app.latestCheck.error,
              preCheck: app.latestCheck.preCheck
                ? {
                    passed: app.latestCheck.preCheck.passed,
                    hardMismatch: app.latestCheck.preCheck.hardMismatch,
                    reasons: app.latestCheck.preCheck.reasons,
                  }
                : undefined,
            }
          : undefined,
      };

      const report = buildIssueReport({
        description,
        environment: response.environment,
        ui,
        state: response.state,
        telemetry: response.telemetry ?? [],
      });

      const markdown = formatIssueReportMarkdown(report);
      const fileName = issueReportFileName(report);
      downloadTextFile(fileName, markdown);

      setSuccess(
        `Downloaded ${fileName}. Save it under debug-reports/ in the repo, then attach it in a Cursor chat.`
      );
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="header-btn"
        onClick={() => {
          setError("");
          setSuccess("");
          setOpen(true);
        }}
      >
        Report Issue
      </button>

      {open && (
        <Modal
          title="Report Issue"
          className="modal-report-issue"
          onClose={busy ? undefined : () => setOpen(false)}
        >
          <div className="report-issue-modal">
            <p>
              Describe what went wrong. The report includes recent extension
              telemetry, UI state, and sanitized storage (API keys redacted).
            </p>
            <label className="report-issue-label" htmlFor="issue-description">
              What happened?
            </label>
            <textarea
              id="issue-description"
              className="report-issue-textarea"
              rows={6}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Steps to reproduce, expected vs actual behavior, any error text…"
              disabled={busy}
            />
            {error && <p className="report-issue-error">{error}</p>}
            {success && <p className="report-issue-success">{success}</p>}
            <div className="button-row">
              <button
                type="button"
                className={`primary-btn${busy ? " is-loading" : ""}`}
                disabled={busy || !description.trim()}
                onClick={() => void createReport()}
              >
                {busy ? "Creating…" : "Create Report"}
              </button>
              <button
                type="button"
                className="secondary-btn"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="report-issue-hint">
              Dev-only. Save downloads to <code>debug-reports/</code>. Turn off
              via <code>DEBUG_TELEMETRY_ENABLED</code>.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
