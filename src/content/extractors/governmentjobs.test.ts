import { describe, expect, it } from "vitest";
import { extractGovernmentJobs } from "./governmentjobs";
import { expectWorkMode, withFixture } from "./goldenTestUtils";

describe("governmentjobs extractor golden fixtures", () => {
  it("extracts core fields from governmentjobs fixture", () => {
    withFixture(
      "https://www.governmentjobs.com/careers/washington/jobs/123/test",
      "governmentjobs-Job-Listing.html",
      () => {
        const { job, isSupported } = extractGovernmentJobs();

        expect(job.title).toBe("IT Customer Support - Entry");
        expect(job.jobNumber).toBe("2026-3281-04890");
        expect(job.salary).toBe("$64,248.00 - $86,436.00 Annually");
        expect(job.company).toBe("Liquor and Cannabis Board");
        expect(job.location).toContain("Olympia, WA");
        expectWorkMode(job.workMode, "hybrid");
        expect(job.employmentType).toMatch(/full time/i);
        expect(job.sections.length).toBeGreaterThan(0);
        expect(isSupported).toBe(true);
      }
    );
  });
});
