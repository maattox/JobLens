import { describe, expect, it } from "vitest";
import { extractIndeed } from "./indeed";
import { expectWorkMode, withFixture } from "./goldenTestUtils";

describe("indeed extractor golden fixtures", () => {
  const url = "https://www.indeed.com/viewjob?jk=f757e6cb9bcb5cde";

  it("extracts core fields from dedicated Version2 fixture", () => {
    withFixture(url, "Indeed-Job-Listing-Version2.html", () => {
      const { job, isSupported } = extractIndeed();

      expect(job.title).toBe(
        "Software QA Engineer (1 year experience preferred)"
      );
      expect(job.company).toBe("ImageSource, Inc.");
      expect(job.location).toContain("Tumwater, WA 98501");
      expect(job.salary).toBe("$60,000 - $75,000 a year");
      expectWorkMode(job.workMode, "onsite");
      if (job.employmentType) {
        expect(job.employmentType).toMatch(/full[- ]?time/i);
      }
      expect(job.sections[0]?.plain.length).toBeGreaterThan(80);
      expect(isSupported).toBe(true);
    });
  });
});
