import { describe, expect, it } from "vitest";
import {
  extractGovernmentJobsStateSlug,
  formatGovernmentJobsCompany,
  titleCaseSlug,
} from "./governmentJobsUtils";

describe("governmentJobsUtils", () => {
  it("extracts state slug from careers URL", () => {
    expect(
      extractGovernmentJobsStateSlug(
        "https://www.governmentjobs.com/careers/washington/jobs/5370045/test"
      )
    ).toBe("washington");
  });

  it("title-cases slug segments", () => {
    expect(titleCaseSlug("new_york")).toBe("New York");
  });

  it("prefixes department with state for company label", () => {
    expect(
      formatGovernmentJobsCompany(
        "Liquor and Cannabis Board",
        "https://www.governmentjobs.com/careers/washington/jobs/1/test"
      )
    ).toBe("Washington - Liquor and Cannabis Board");
  });
});
