import { useEffect, useState } from "react";
import logoUrl from "../../assets/JobLens-icon-48.png";
import { isDevMode } from "../../shared/devMode";
import { isDebugTelemetryEnabled } from "../../shared/debug";
import { Modal } from "./Ui";
import { ReportIssueButton } from "./ReportIssueModal";
import { useApp } from "../context/AppContext";

export function AppHeader() {
  const { resetAllData, openDedicatedTab, shellMode } = useApp();
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (!showInfo) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowInfo(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showInfo]);

  return (
    <>
      <header className="app-header">
        <div className="app-header-row">
          <div className="app-brand">
            <img
              className="app-brand-logo"
              src={logoUrl}
              alt=""
              width={28}
              height={28}
            />
            <h1>JobLens</h1>
          </div>
          <div className="app-header-actions">
            {shellMode === "popup" && (
              <button
                type="button"
                className="header-btn"
                onClick={openDedicatedTab}
              >
                Open in new tab
              </button>
            )}
            {isDevMode() && (
              <button
                type="button"
                className="header-btn header-btn-danger"
                onClick={() => void resetAllData()}
              >
                Reset
              </button>
            )}
            {isDebugTelemetryEnabled() && <ReportIssueButton />}
            <button
              type="button"
              className="header-btn"
              onClick={() => setShowInfo(true)}
            >
              Extension Information
            </button>
          </div>
        </div>
      </header>

      {showInfo && (
        <Modal title="About JobLens" onClose={() => setShowInfo(false)}>
          <div className="info-modal-content">
            <h3>How it works</h3>
            <ol>
              <li>Extract job data from the active browser tab.</li>
              <li>Run local pre-checks against your saved preferences.</li>
              <li>
                Send your profile, preferences, and job listing to your chosen AI
                provider using your own API key.
              </li>
              <li>Show scored compatibility results and keep a local history.</li>
            </ol>

            <h3>Works with listings on</h3>
            <ul>
              <li>GovernmentJobs.com</li>
              <li>Indeed.com</li>
              <li>ZipRecruiter.com (partial extraction support)</li>
              <li>LinkedIn.com (partial extraction support)</li>
            </ul>
            <p>
              When you run a check on other pages, JobLens reads the active tab
              on demand and falls back to page text; results may be less reliable.
              JobLens is not affiliated with or endorsed by these sites.
            </p>

            <button
              type="button"
              className="secondary-btn"
              onClick={() => setShowInfo(false)}
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
