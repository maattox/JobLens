import { describe, expect, it } from "vitest";
import {
  getTabPageUrl,
  isInjectableUrl,
  pickInjectableTab,
} from "./tabUtils";

describe("isInjectableUrl", () => {
  it("allows http and https pages", () => {
    expect(isInjectableUrl("https://www.governmentjobs.com/careers/wa/jobs/1")).toBe(
      true
    );
    expect(isInjectableUrl("http://example.com")).toBe(true);
  });

  it("rejects extension and browser internal pages", () => {
    expect(isInjectableUrl("edge://extensions")).toBe(false);
    expect(isInjectableUrl("chrome://newtab")).toBe(false);
    expect(isInjectableUrl(undefined)).toBe(false);
  });
});

describe("getTabPageUrl", () => {
  it("prefers url over pendingUrl", () => {
    expect(
      getTabPageUrl({
        url: "https://www.indeed.com/viewjob",
        pendingUrl: "https://www.indeed.com/pending",
      })
    ).toBe("https://www.indeed.com/viewjob");
  });

  it("falls back to pendingUrl while loading", () => {
    expect(
      getTabPageUrl({
        pendingUrl: "https://www.ziprecruiter.com/jobs/123",
      })
    ).toBe("https://www.ziprecruiter.com/jobs/123");
  });
});

describe("pickInjectableTab", () => {
  it("returns the first tab with an injectable page URL", () => {
    const tabs = [
      { id: 1, url: "edge://newtab" },
      { id: 2, url: "https://www.indeed.com/viewjob" },
      { id: 3, url: "https://www.governmentjobs.com/jobs/1" },
    ];

    expect(pickInjectableTab(tabs)?.id).toBe(2);
  });

  it("uses pendingUrl when url is missing", () => {
    const tabs = [
      { id: 1, pendingUrl: "https://www.indeed.com/viewjob" },
      { id: 2, url: "chrome://settings" },
    ];

    expect(pickInjectableTab(tabs)?.id).toBe(1);
  });

  it("returns undefined when no injectable tab exists", () => {
    const tabs = [
      { id: 1, url: "edge://extensions" },
      { id: 2 },
    ];

    expect(pickInjectableTab(tabs)).toBeUndefined();
  });
});
