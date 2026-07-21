import packageJson from "../../../package.json";

export function ExtensionVersion() {
  return (
    <p className="app-version" aria-label={`Version ${packageJson.version}`}>
      v{packageJson.version}
    </p>
  );
}
