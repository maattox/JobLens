import { describe, expect, it } from "vitest";
import {
  applyFieldResolutions,
  jobFieldsAgree,
  mergeScrapedAndAiFields,
  normalizeJobFieldForCompare,
} from "./fieldCompare";

describe("normalizeJobFieldForCompare", () => {
  it("normalizes work modes", () => {
    expect(normalizeJobFieldForCompare("workMode", "On-site")).toBe("onsite");
    expect(normalizeJobFieldForCompare("workMode", "Flexible/Hybrid")).toBe(
      "hybrid"
    );
  });

  it("normalizes employment types", () => {
    expect(normalizeJobFieldForCompare("employmentType", "FULL_TIME")).toBe(
      "fulltime"
    );
    expect(normalizeJobFieldForCompare("employmentType", "Full-time")).toBe(
      "fulltime"
    );
  });

  it("normalizes salary numbers and units", () => {
    expect(
      normalizeJobFieldForCompare("salary", "$34 - $40/hr")
    ).toBe("34-40|hour");
    expect(
      normalizeJobFieldForCompare("salary", "$34-$40 per hour")
    ).toBe("34-40|hour");
  });
});

describe("jobFieldsAgree", () => {
  it("treats format-only salary differences as agreement", () => {
    expect(
      jobFieldsAgree("salary", "$90,000.00 To $120,000.00 Annually", "$90000-$120000 a year")
    ).toBe(true);
  });

  it("flags real title conflicts", () => {
    expect(jobFieldsAgree("title", "Systems Engineer", "Software Engineer")).toBe(
      false
    );
  });
});

describe("mergeScrapedAndAiFields", () => {
  it("auto-fills empty scraped fields from AI", () => {
    const { merged, conflicts } = mergeScrapedAndAiFields(
      {
        title: "Systems Engineer",
        company: "",
        location: "Des Moines, WA",
        salary: "",
        workMode: "onsite",
        employmentType: "Full-time",
      },
      {
        title: "Systems Engineer",
        company: "Gravity Media",
        location: "Des Moines, WA, US",
        salary: "$90,000 To $120,000 Annually",
        workMode: "On-site",
        employmentType: "Full Time",
      }
    );

    expect(merged.company).toBe("Gravity Media");
    expect(merged.salary).toContain("90,000");
    expect(conflicts).toHaveLength(0);
  });

  it("records conflicts when both sides disagree", () => {
    const { conflicts } = mergeScrapedAndAiFields(
      {
        title: "A",
        company: "Acme",
        location: "Seattle, WA",
        salary: "$100k",
        workMode: "remote",
        employmentType: "Full-time",
      },
      {
        title: "A",
        company: "Other Co",
        location: "Seattle, WA",
        salary: "$100k",
        workMode: "onsite",
        employmentType: "Full-time",
      }
    );

    expect(conflicts.map((c) => c.field).sort()).toEqual([
      "company",
      "workMode",
    ]);
  });
});

describe("applyFieldResolutions", () => {
  it("applies scraped, ai, and manual choices", () => {
    const result = applyFieldResolutions(
      {
        title: "A",
        company: "Scraped Co",
        location: "X",
        salary: "",
        workMode: "remote",
        employmentType: "",
      },
      {
        title: "A",
        company: "Scraped Co",
        location: "X",
        salary: "$1",
        workMode: "remote",
        employmentType: "Full-time",
      },
      {
        title: "A",
        company: "AI Co",
        location: "Y",
        salary: "$2",
        workMode: "onsite",
        employmentType: "Part-time",
      },
      [
        { field: "company", choice: "ai" },
        { field: "workMode", choice: "manual", manualValue: "hybrid" },
      ]
    );

    expect(result.company).toBe("AI Co");
    expect(result.workMode).toBe("hybrid");
  });
});
