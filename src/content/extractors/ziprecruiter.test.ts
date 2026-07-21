import { describe, expect, it } from "vitest";
import { extractZipRecruiter } from "./ziprecruiter";
import { expectWorkMode, withFixture } from "./goldenTestUtils";

describe("ziprecruiter extractor golden fixtures", () => {
  it("extracts core fields from Version2 detail fixture", () => {
    withFixture(
      "https://www.ziprecruiter.com/jobs/abc123",
      "ZipRecruiter-Job-Listing-Version2-Complete.html",
      () => {
        const { job, isSupported } = extractZipRecruiter();

        expect(job.title).toBe("Maintenance Tech");
        expect(job.company).toBe(
          "Express Employment Professionals - Olympia, WA"
        );
        expect(job.location).toBe("Tumwater, WA");
        expect(job.salary).toMatch(/\$34\s*-\s*\$40\/hr/i);
        expect(job.employmentType).toMatch(/full[- ]?time/i);
        expectWorkMode(job.workMode, "onsite");
        expect(job.sections[0]?.plain).toContain("Maintenance Technician");
        expect(isSupported).toBe(true);
      }
    );
  });

  it("extracts gov-style listing from escaped RSC payload (failed report fixture)", () => {
    withFixture(
      "https://www.ziprecruiter.com/jobs/it-data-management-entry-level",
      "Failed-ZipRecruiter-Report-Job-Listing.html",
      () => {
        const { job, isSupported } = extractZipRecruiter();

        expect(job.title).toMatch(/IT Data Management - Entry level/i);
        expect(job.company).toBe(
          "Washington State Department of Transportation"
        );
        expect(job.location).toBe("Tumwater, WA");
        expect(job.salary).toMatch(/\$5\.7K\s*-\s*\$7\.7K\/mo/i);
        expectWorkMode(job.workMode, "hybrid");
        expect(job.location.toLowerCase()).not.toBe("close");
        expect(job.sections[0]?.plain.length).toBeGreaterThan(200);
        expect(isSupported).toBe(true);
      }
    );
  });
});
