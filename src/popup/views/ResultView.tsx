import { JobMeta } from "../components/JobMeta";
import { ReportDetails } from "../components/ReportDetails";
import { StatusMessage } from "../components/Ui";
import { useApp } from "../context/AppContext";

export function ResultView() {
  const {
    latestCheck,
    runCompatibilityCheck,
    loading,
    followUpLoading,
    status,
    statusType,
    lastScraped,
    askFollowUp,
  } = useApp();

  if (!latestCheck) {
    return (
      <p style={{ color: "var(--color-muted)", fontSize: 12 }}>
        No compatibility result yet.
      </p>
    );
  }

  const {
    report,
    job,
    preCheck,
    skippedAi,
    reportViewSource,
    followUps,
    historyKey,
  } = latestCheck;
  const reliabilityWarning =
    job?.reliabilityWarning || lastScraped?.reliabilityWarning;

  if (skippedAi && preCheck) {
    return (
      <section>
        {reliabilityWarning && (
          <div className="info-banner" style={{ marginBottom: 12 }}>
            {reliabilityWarning}
          </div>
        )}
        <div className="warning-banner">
          <p style={{ margin: "0 0 8px" }}>
            Deterministic pre-check flagged a likely mismatch before contacting
            the AI:
          </p>
          <ul>
            {preCheck.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <button
            type="button"
            className="secondary-btn"
            disabled={loading}
            onClick={() => void runCompatibilityCheck(true)}
          >
            {loading ? "Checking..." : "Ask AI anyway"}
          </button>
        </div>
        <StatusMessage message={status} type={statusType} />
        <JobMeta job={job} />
      </section>
    );
  }

  if (!report) {
    return (
      <p style={{ color: "var(--color-muted)", fontSize: 12 }}>
        No compatibility result yet.
      </p>
    );
  }

  return (
    <section>
      {reliabilityWarning && (
        <div className="info-banner" style={{ marginBottom: 12 }}>
          {reliabilityWarning}
        </div>
      )}
      <StatusMessage message={status} type={statusType} />
      <ReportDetails
        report={report}
        job={job}
        reportViewSource={reportViewSource}
        followUps={followUps}
        historyKey={historyKey}
        loading={loading}
        followUpLoading={followUpLoading}
        onRecheck={() => void runCompatibilityCheck(true)}
        onAskFollowUp={askFollowUp}
        collapseFollowUps={reportViewSource === "history"}
        showOpenInTab
      />
    </section>
  );
}
