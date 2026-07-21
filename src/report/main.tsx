import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ReportDetails } from "../popup/components/ReportDetails";
import { migrateCheckHistory } from "../shared/migration";
import { STORAGE_KEYS } from "../shared/storage";
import type { CheckHistoryItem } from "../shared/types";
import "../styles/tokens.css";

function ReportPage() {
  const [item, setItem] = useState<CheckHistoryItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key");
    if (!key) {
      setError("No report key provided.");
      return;
    }

    void chrome.storage.local.get(STORAGE_KEYS.checkHistory).then((data) => {
      const history = migrateCheckHistory(data[STORAGE_KEYS.checkHistory]);
      const match = history.find((entry) => entry.key === key);
      if (!match) {
        setError("Report not found in local history.");
        return;
      }
      setItem(match);
    });
  }, []);

  if (error) {
    return (
      <div className="app-shell app-shell-report">
        <main className="app-main">
          <p style={{ color: "var(--color-warning-text)", fontSize: 13 }}>{error}</p>
        </main>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="app-shell app-shell-report">
        <main className="app-main">
          <p style={{ color: "#6b7280", fontSize: 13 }}>Loading report...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell app-shell-report">
      <header className="app-header">
        <div className="app-header-row">
          <h1>Compatibility Report</h1>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#4b5563" }}>
          {item.title}
          {item.company ? ` · ${item.company}` : ""}
        </p>
      </header>
      <main className="app-main">
        <ReportDetails
          report={item.report}
          job={item.job}
          reportViewSource="history"
          followUps={item.followUps}
          historyKey={item.key}
          collapseFollowUps
          defaultExpanded
        />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ReportPage />
  </React.StrictMode>
);
