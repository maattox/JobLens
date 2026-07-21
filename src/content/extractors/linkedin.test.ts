import { describe, expect, it } from "vitest";
import { extractLinkedIn } from "./linkedin";
import { expectWorkMode, withFixture } from "./goldenTestUtils";

describe("linkedin extractor golden fixtures", () => {
  it("extracts core fields from LinkedIn job details fixture", () => {
    withFixture(
      "https://www.linkedin.com/jobs/view/4319191550",
      "LinkedIn-Job-Listing.html",
      () => {
        const { job, isSupported, reliabilityWarning } = extractLinkedIn();

        expect(job.title).toBe("Systems Engineer");
        expect(job.company).toBe("Gravity Media");
        expect(job.location).toMatch(/Des Moines,\s*WA/i);
        expect(job.salary).toMatch(/\$90,000\.00\s+To\s+\$120,000\.00\s+Annually/i);
        expect(job.employmentType).toMatch(/full[- ]?time/i);
        expectWorkMode(job.workMode, "onsite");
        expect(job.jobNumber).toBe("4319191550");
        expect(job.sections[0]?.plain).toContain("Systems Engineer");
        expect(job.sections[0]?.plain.length).toBeGreaterThan(200);
        expect(isSupported).toBe(true);
        expect(reliabilityWarning).toMatch(/unstructured|AI/i);
      }
    );
  });
});
