import { useEffect, useState } from "react";
import type {
  CompatibilityReport,
  FollowUpEntry,
  JobObject,
  ReportViewSource,
} from "../../shared/types";
import { formatRelativeTime, getJobKey, openExtensionPage } from "../../shared/utils";
import { FollowUpMarkdown } from "./FollowUpMarkdown";
import { JobMeta } from "./JobMeta";

interface ReportDetailsProps {
  report: CompatibilityReport;
  job?: JobObject | null;
  reportViewSource?: ReportViewSource;
  followUps?: FollowUpEntry[];
  historyKey?: string;
  loading?: boolean;
  followUpLoading?: boolean;
  onRecheck?: () => void;
  onAskFollowUp?: (question: string) => Promise<void>;
  showOpenInTab?: boolean;
  defaultExpanded?: boolean;
  collapseFollowUps?: boolean;
}

function oneLineEllipsis(text: string, max = 72): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function ReportDetails({
  report,
  job,
  reportViewSource = "fresh",
  followUps = [],
  historyKey,
  loading = false,
  followUpLoading = false,
  onRecheck,
  onAskFollowUp,
  showOpenInTab = false,
  defaultExpanded = false,
  collapseFollowUps = false,
}: ReportDetailsProps) {
  const [showDetails, setShowDetails] = useState(defaultExpanded);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [expandedFollowUpId, setExpandedFollowUpId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!followUps.length) {
      setExpandedFollowUpId(null);
      return;
    }

    if (collapseFollowUps) {
      setExpandedFollowUpId(null);
      return;
    }

    setExpandedFollowUpId(followUps[followUps.length - 1]?.id ?? null);
  }, [collapseFollowUps, followUps]);

  const showCacheBanner = reportViewSource === "liveCache";

  async function handleAskFollowUp() {
    if (!onAskFollowUp || !question.trim()) return;
    await onAskFollowUp(question.trim());
    setQuestion("");
    setShowFollowUpForm(false);
  }

  function handleOpenInTab() {
    if (!job) return;
    openExtensionPage("src/report/index.html", { key: getJobKey(job) });
  }

  return (
    <>
      {showCacheBanner && (
        <div className="info-banner">
          Previously cached check from {formatRelativeTime(report.checkedAt)}.
          {onRecheck && (
            <div className="button-row">
              <button
                type="button"
                className="secondary-btn"
                disabled={loading}
                onClick={onRecheck}
              >
                {loading ? "Checking..." : "Re-check anyway"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="score-grid">
        <div className="score-card overall">
          <div className="score-value">{report.overallScore}</div>
          <div className="score-label">Overall compatibility</div>
        </div>
        {report.categoryScores.map((category) => (
          <div key={category.label} className="score-card">
            <div className="score-value" style={{ fontSize: 22 }}>
              {category.score}
            </div>
            <div className="score-label">{category.label}</div>
          </div>
        ))}
      </div>

      {report.summaryBullets.length > 0 && (
        <div className="details-panel">
          <h3>Summary</h3>
          <ul>
            {report.summaryBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="button-row">
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? "Hide details" : "More details"}
        </button>
        {showOpenInTab && job && (
          <button
            type="button"
            className="secondary-btn"
            onClick={handleOpenInTab}
          >
            Open in new tab
          </button>
        )}
      </div>

      {showDetails && (
        <div className="details-panel">
          {report.categoryScores.map((category) => (
            <div key={category.label} style={{ marginBottom: 12 }}>
              <h3>{category.label}</h3>
              <ul>
                {category.summaryBullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}

          {report.missingQualifications.length > 0 && (
            <>
              <h3>Missing qualifications</h3>
              <ul>
                {report.missingQualifications.map((item) => (
                  <li key={item.item}>
                    {item.item} (
                    {item.severity === "easyToLearn"
                      ? "easy to learn"
                      : "major gap"}
                    )
                  </li>
                ))}
              </ul>
            </>
          )}

          {report.actionableAdvice.length > 0 && (
            <>
              <h3>Actionable advice</h3>
              <ul>
                {report.actionableAdvice.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {historyKey && onAskFollowUp && (
        <section className="follow-up-section">
          {!showFollowUpForm ? (
            <button
              type="button"
              className="secondary-btn"
              disabled={followUpLoading}
              onClick={() => setShowFollowUpForm(true)}
            >
              Ask additional questions
            </button>
          ) : (
            <div className="follow-up-form">
              <label className="field">
                <span className="field-heading">Your question</span>
                <textarea
                  rows={3}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about this job listing or your fit…"
                />
              </label>
              <div className="button-row">
                <button
                  type="button"
                  className={`primary-btn${followUpLoading ? " is-loading" : ""}`}
                  disabled={followUpLoading || !question.trim()}
                  onClick={() => void handleAskFollowUp()}
                >
                  {followUpLoading ? "Asking…" : "Ask"}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={followUpLoading}
                  onClick={() => {
                    setShowFollowUpForm(false);
                    setQuestion("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {followUps.length > 0 && (
            <div className="follow-up-list">
              {followUps.map((entry) => {
                const expanded = expandedFollowUpId === entry.id;
                return (
                  <details
                    key={entry.id}
                    className="follow-up-item"
                    open={expanded}
                    onToggle={(e) => {
                      const open = (e.currentTarget as HTMLDetailsElement).open;
                      setExpandedFollowUpId(open ? entry.id : null);
                    }}
                  >
                    <summary className="follow-up-summary">
                      {oneLineEllipsis(entry.question)}
                    </summary>
                    <FollowUpMarkdown markdown={entry.answer} />
                    <div className="follow-up-meta">
                      {formatRelativeTime(entry.askedAt)}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      )}

      <JobMeta job={job} reportId={report.reportId} />
    </>
  );
}
