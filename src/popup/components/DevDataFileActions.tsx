import { useRef, useState } from "react";
import { isDevMode } from "../../shared/devMode";
import { downloadJsonFile, readJsonFile } from "../../shared/jsonFile";

interface DevDataFileActionsProps<T> {
  fileName: string;
  data: T;
  migrate: (raw: unknown) => T;
  onLoad: (data: T) => void;
}

export function DevDataFileActions<T>({
  fileName,
  data,
  migrate,
  onLoad,
}: DevDataFileActionsProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  if (!isDevMode()) {
    return null;
  }

  function handleDownload() {
    setError("");
    downloadJsonFile(fileName, data);
  }

  async function handleFileChange(file: File | null) {
    if (!file) return;

    setError("");
    try {
      const raw = await readJsonFile(file);
      onLoad(migrate(raw));
    } catch {
      setError("Could not load file. Use a valid JSON export from this extension.");
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div className="button-row">
        <button
          type="button"
          className="download-btn"
          onClick={handleDownload}
        >
          Download JSON
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => inputRef.current?.click()}
        >
          Load from file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => void handleFileChange(e.target.files?.[0] || null)}
        />
      </div>
      {error && (
        <p className="field-error" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
