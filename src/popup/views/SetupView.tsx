import { useApp } from "../context/AppContext";

export function SetupView() {
  const { setView, completeOnboarding, profile, preferences } = useApp();

  const steps = [
    { label: "Profile", done: profile.setupComplete, view: "profile" as const },
    {
      label: "Preferences",
      done: preferences.setupComplete,
      view: "preferences" as const,
    },
  ];

  const allDone = steps.every((step) => step.done);

  return (
    <section>
      <h2 style={{ marginTop: 0, fontSize: 15 }}>Welcome — first-time setup</h2>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>
        Complete these steps to run one-click job compatibility checks.
      </p>

      <ol style={{ paddingLeft: 18, fontSize: 12 }}>
        {steps.map((step) => (
          <li key={step.label} style={{ marginBottom: 8 }}>
            {step.done ? "✓" : "○"} {step.label}{" "}
            <button
              type="button"
              className="nav-btn"
              onClick={() => setView(step.view)}
            >
              Open
            </button>
          </li>
        ))}
      </ol>

      <div className="button-row">
        <button
          type="button"
          className="primary-btn"
          disabled={!allDone}
          onClick={() => void completeOnboarding()}
        >
          Finish setup
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => void completeOnboarding()}
        >
          Skip setup
        </button>
      </div>
    </section>
  );
}
