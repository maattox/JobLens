import { describe, expect, it } from "vitest";
import { DEBUG_TELEMETRY_ENABLED } from "./config";
import {
  appendDebugEntry,
  buildIssueReport,
  clearDebugBuffer,
  createDebugLogEntry,
  formatIssueReportMarkdown,
  getDebugEntries,
  sanitizeForReport,
} from "./index";

describe("debug sanitizeForReport", () => {
  it("redacts apiKey fields", () => {
    const result = sanitizeForReport({
      apiKey: "sk-secret",
      provider: "gemini",
    }) as Record<string, unknown>;

    expect(result.apiKey).toBe("[REDACTED]");
    expect(result.provider).toBe("gemini");
  });

  it("truncates long strings", () => {
    const long = "x".repeat(5000);
    const result = sanitizeForReport(long) as string;
    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain("truncated");
  });
});

describe("debug buffer", () => {
  it("keeps appended entries until cleared", () => {
    clearDebugBuffer();
    appendDebugEntry(
      createDebugLogEntry({
        source: "background",
        category: "test",
        message: "hello",
        level: "info",
      })
    );

    if (!DEBUG_TELEMETRY_ENABLED) {
      // User/release mode: buffer writes are disabled via DEV_MODE.
      expect(getDebugEntries()).toHaveLength(0);
      return;
    }

    expect(getDebugEntries()).toHaveLength(1);
    clearDebugBuffer();
    expect(getDebugEntries()).toHaveLength(0);
  });
});

describe("issue report markdown", () => {
  it("includes developer description and report id", () => {
    const report = buildIssueReport({
      description: "Extraction failed on Indeed",
      environment: {
        extensionVersion: "1.0.0",
        manifestVersion: 3,
        userAgent: "test",
        platform: "Win32",
        language: "en-US",
        extensionId: "id",
        serviceWorkerAlive: true,
        storageKeys: [],
      },
      ui: {
        shellMode: "popup",
        view: "home",
        status: "",
        statusType: "",
        loading: false,
        followUpLoading: false,
        checkPhase: "",
        historySort: "overall",
        historyCount: 0,
        hasLatestCheck: false,
      },
      state: {},
      telemetry: [
        createDebugLogEntry({
          source: "content",
          category: "extract",
          message: "Extraction finished",
          level: "info",
          data: { source: "indeed" },
        }),
      ],
    });

    const md = formatIssueReportMarkdown(report);
    expect(md).toContain(report.reportId);
    expect(md).toContain("Extraction failed on Indeed");
    expect(md).toContain("content/extract");
  });
});
