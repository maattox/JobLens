import type {
  DebugLogEntry,
  DebugRuntimeSnapshot,
  DebugUiSnapshot,
  IssueReportPayload,
} from "./types";

export function createIssueReportId(): string {
  return `issue_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildIssueReport(input: {
  description: string;
  environment: DebugRuntimeSnapshot;
  ui: DebugUiSnapshot;
  state: Record<string, unknown>;
  telemetry: DebugLogEntry[];
}): IssueReportPayload {
  return {
    reportId: createIssueReportId(),
    createdAt: new Date().toISOString(),
    developerDescription: input.description.trim(),
    environment: input.environment,
    ui: input.ui,
    state: input.state,
    telemetry: input.telemetry,
    instructionsForAgent: [
      "This file is a developer issue report from the JobLens extension.",
      "Use the repository Debugging skill (.agents/skills/debugging/SKILL.md).",
      "Diagnose from developerDescription, telemetry, environment, ui, and sanitized state.",
      "Do not ask the user to re-describe details already present in this report.",
      "Prefer fixing the root cause with a focused change; cite reportId when summarizing.",
    ].join(" "),
  };
}

function fence(value: unknown): string {
  return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
}

export function formatIssueReportMarkdown(report: IssueReportPayload): string {
  const lines: string[] = [
    `# Issue Report \`${report.reportId}\``,
    "",
    `Created: ${report.createdAt}`,
    "",
    "## Agent instructions",
    "",
    report.instructionsForAgent,
    "",
    "## Developer description",
    "",
    report.developerDescription || "(No description provided.)",
    "",
    "## Environment",
    "",
    fence(report.environment),
    "",
    "## UI snapshot",
    "",
    fence(report.ui),
    "",
    "## Sanitized extension state",
    "",
    fence(report.state),
    "",
    `## Telemetry log (${report.telemetry.length} entries)`,
    "",
  ];

  if (report.telemetry.length === 0) {
    lines.push("_No telemetry entries were captured. Ensure debug telemetry is enabled and reproduce the issue before creating a report._");
    lines.push("");
  } else {
    for (const entry of report.telemetry) {
      lines.push(
        `### ${entry.ts} · ${entry.level.toUpperCase()} · ${entry.source}/${entry.category}`
      );
      lines.push("");
      lines.push(entry.message);
      lines.push("");
      if (entry.data !== undefined) {
        lines.push(fence(entry.data));
        lines.push("");
      }
    }
  }

  lines.push("## Raw report JSON");
  lines.push("");
  lines.push(fence(report));
  lines.push("");

  return lines.join("\n");
}

export function issueReportFileName(report: IssueReportPayload): string {
  const stamp = report.createdAt.replace(/[:.]/g, "-");
  return `issue-report-${stamp}-${report.reportId}.md`;
}
