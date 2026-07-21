import { useState } from "react";

interface SaveButtonProps {
  label: string;
  savedLabel: string;
  onSave: () => Promise<void>;
}

export function SaveButton({ label, savedLabel, onSave }: SaveButtonProps) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [notice, setNotice] = useState("");

  async function handleClick() {
    setState("saving");
    setNotice("");
    try {
      await onSave();
      setState("saved");
      setNotice(savedLabel);
      window.setTimeout(() => {
        setState("idle");
        setNotice("");
      }, 2000);
    } catch {
      setState("idle");
      setNotice("");
    }
  }

  return (
    <div className="save-section">
      <p
        className={`save-notice ${notice ? "visible" : "hidden"}`}
        aria-live="polite"
      >
        {notice || "\u00a0"}
      </p>
      <button
        type="button"
        className={`primary-btn save-btn ${state !== "idle" ? state : ""}${
          state === "saving" ? " is-loading" : ""
        }`}
        disabled={state === "saving"}
        onClick={() => void handleClick()}
      >
        {state === "saving" ? "Saving..." : state === "saved" ? "Saved" : label}
      </button>
    </div>
  );
}
