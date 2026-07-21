import { useEffect, useRef, useState } from "react";

type SaveState = "idle" | "saving" | "saved";

interface SaveStatusProps {
  state: SaveState;
  savedLabel?: string;
}

export function SaveStatus({
  state,
  savedLabel = "Saved",
}: SaveStatusProps) {
  return (
    <div className="save-section save-section-sticky" aria-live="polite">
      <p className={`save-notice ${state === "saved" ? "visible" : "hidden"}`}>
        {state === "saved" ? savedLabel : "\u00a0"}
      </p>
      {state === "saving" && (
        <p className="save-notice visible" style={{ color: "var(--color-muted)" }}>
          Saving…
        </p>
      )}
    </div>
  );
}

export function useDebouncedSave<T>(
  value: T,
  onSave: (value: T) => Promise<void>,
  delayMs = 500
): SaveState {
  const [state, setState] = useState<SaveState>("idle");
  const isFirstRun = useRef(true);
  const timerRef = useRef<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    if (savedTimerRef.current) {
      window.clearTimeout(savedTimerRef.current);
    }

    setState("saving");
    timerRef.current = window.setTimeout(() => {
      void onSave(value)
        .then(() => {
          setState("saved");
          savedTimerRef.current = window.setTimeout(() => {
            setState("idle");
          }, 2000);
        })
        .catch(() => {
          setState("idle");
        });
    }, delayMs);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [value, onSave, delayMs]);

  return state;
}
