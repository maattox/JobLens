import { describe, expect, it } from "vitest";
import { extractJobFromPage } from "./registry";
import {
  detectIndeedPageView,
  detectZipRecruiterPageView,
  INDEED_DEDICATED_TAB_MESSAGE,
  ZIPRECRUITER_DEDICATED_TAB_MESSAGE,
} from "./pageView";
import { withFixture } from "./goldenTestUtils";

describe("page view detection", () => {
  it("treats Indeed /viewjob as dedicated", () => {
    expect(
      detectIndeedPageView("https://www.indeed.com/viewjob?jk=abc")
    ).toBe("dedicated");
    expect(
      detectIndeedPageView("https://www.indeed.com/m/viewjob?jk=abc")
    ).toBe("dedicated");
  });

  it("treats Indeed search/home URLs as split_or_modal", () => {
    expect(
      detectIndeedPageView(
        "https://www.indeed.com/jobs?q=qa&l=Tumwater%2C+WA&vjk=abc"
      )
    ).toBe("split_or_modal");
    expect(detectIndeedPageView("https://www.indeed.com/")).toBe(
      "split_or_modal"
    );
  });

  it("treats ZipRecruiter /jobs/slug as dedicated and jobs-search as modal", () => {
    expect(
      detectZipRecruiterPageView(
        "https://www.ziprecruiter.com/jobs/maintenance-tech-abc123"
      )
    ).toBe("dedicated");
    expect(
      detectZipRecruiterPageView(
        "https://www.ziprecruiter.com/jobs/v2/eyJsaXN0aW5nX2tleSI6IkY2azJmVFVWOEZFVlFsSVl2LWl6MGci"
      )
    ).toBe("dedicated");
    expect(
      detectZipRecruiterPageView(
        "https://www.ziprecruiter.com/jobs-search?search=maintenance"
      )
    ).toBe("split_or_modal");
  });

  it("keeps /jobs/v2 dedicated even when a ZDS modal exists in the DOM", () => {
    // Live dedicated tabs often include a hidden Settings dialog; that must not
    // override a /jobs/v2/... URL (issue_mrtjl25g_1t7ss5).
    withFixture(
      "https://www.ziprecruiter.com/jobs/v2/eyJsaXN0aW5nX2tleSI6IkY2azJmVFVWOEZFVlFsSVl2LWl6MGci",
      "ZipRecruiter-Job-Listing-Version1-Complete.html",
      () => {
        expect(
          detectZipRecruiterPageView(
            "https://www.ziprecruiter.com/jobs/v2/eyJsaXN0aW5nX2tleSI6IkY2azJmVFVWOEZFVlFsSVl2LWl6MGci"
          )
        ).toBe("dedicated");
        expect(
          document.querySelector(
            '[role="dialog"][aria-modal="true"][data-zds-component="modal"]'
          )
        ).not.toBeNull();
      }
    );
  });
});

describe("dedicated-tab gate via extractJobFromPage", () => {
  it("blocks Indeed Version1 split-pane fixture", () => {
    withFixture(
      "https://www.indeed.com/jobs?q=qa&vjk=f757e6cb9bcb5cde",
      "Indeed-Job-Listing-Version1.html",
      () => {
        const result = extractJobFromPage(
          "https://www.indeed.com/jobs?q=qa&vjk=f757e6cb9bcb5cde"
        );
        expect(result.requiresDedicatedTab).toBe(true);
        expect(result.dedicatedTabMessage).toBe(INDEED_DEDICATED_TAB_MESSAGE);
        expect(result.job.title).toBe("");
      }
    );
  });

  it("allows Indeed Version2 dedicated fixture", () => {
    withFixture(
      "https://www.indeed.com/viewjob?jk=f757e6cb9bcb5cde",
      "Indeed-Job-Listing-Version2.html",
      () => {
        const result = extractJobFromPage(
          "https://www.indeed.com/viewjob?jk=f757e6cb9bcb5cde"
        );
        expect(result.requiresDedicatedTab).toBeUndefined();
        expect(result.job.title).toBe(
          "Software QA Engineer (1 year experience preferred)"
        );
      }
    );
  });

  it("blocks ZipRecruiter Version1 modal fixture", () => {
    withFixture(
      "https://www.ziprecruiter.com/jobs-search?search=maintenance",
      "ZipRecruiter-Job-Listing-Version1-Complete.html",
      () => {
        const result = extractJobFromPage(
          "https://www.ziprecruiter.com/jobs-search?search=maintenance"
        );
        expect(result.requiresDedicatedTab).toBe(true);
        expect(result.dedicatedTabMessage).toBe(
          ZIPRECRUITER_DEDICATED_TAB_MESSAGE
        );
      }
    );
  });

  it("allows ZipRecruiter Version2 dedicated fixture", () => {
    withFixture(
      "https://www.ziprecruiter.com/jobs/maintenance-tech-abc123",
      "ZipRecruiter-Job-Listing-Version2-Complete.html",
      () => {
        const result = extractJobFromPage(
          "https://www.ziprecruiter.com/jobs/maintenance-tech-abc123"
        );
        expect(result.requiresDedicatedTab).toBeUndefined();
        expect(result.job.title).toBe("Maintenance Tech");
      }
    );
  });

  it("allows ZipRecruiter /jobs/v2 dedicated URL even with modal DOM present", () => {
    const url =
      "https://www.ziprecruiter.com/jobs/v2/eyJsaXN0aW5nX2tleSI6IkY2azJmVFVWOEZFVlFsSVl2LWl6MGci";
    withFixture(url, "ZipRecruiter-Job-Listing-Version2-Complete.html", () => {
      const result = extractJobFromPage(url);
      expect(result.requiresDedicatedTab).toBeUndefined();
      expect(result.job.title).toBe("Maintenance Tech");
    });
  });
});
