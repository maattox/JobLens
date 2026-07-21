export type ShellMode = "popup" | "tab" | "report";

export function detectShellMode(): ShellMode {
  const path = window.location.pathname.toLowerCase();
  if (path.includes("/report/")) return "report";
  if (path.includes("/app/")) return "tab";
  return "popup";
}
