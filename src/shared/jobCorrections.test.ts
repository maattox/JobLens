import { describe, expect, it } from "vitest";
import { applyJobFieldCorrections } from "./jobCorrections";
import type { JobObject } from "./types";

const baseJob: JobObject = {
  title: "IT Data Management - Entry level",
  jobNumber: "",
  salary: "$5.7K - $7.7K/mo",
  company: "Washington State Department of Transportation",
  location: "Tumwater, WA",
  workMode: "onsite",
  employmentType: "Full-time",
  url: "https://www.ziprecruiter.com/jobs/example",
  source: "ziprecruiter",
  sections: [],
  rawText: "",
  markdown: "",
  plainText: "",
  isSupported: true,
};

describe("applyJobFieldCorrections", () => {
  it("rejects UI chrome values like Close for location", () => {
    const { job, applied } = applyJobFieldCorrections(baseJob, {
      location: "Close",
      workMode: "Flexible/Hybrid",
    });

    expect(job.location).toBe("Tumwater, WA");
    expect(job.workMode).toBe("Flexible/Hybrid");
    expect(applied?.fields).toEqual(["workMode"]);
  });

  it("fills missing company and salary from corrections", () => {
    const incomplete = { ...baseJob, company: "", salary: "" };
    const { job, applied } = applyJobFieldCorrections(incomplete, {
      company: "Washington State Department of Transportation",
      salary: "$5.7K - $7.7K/mo",
    });

    expect(job.company).toContain("Transportation");
    expect(job.salary).toContain("$5.7K");
    expect(applied?.fields).toEqual(["company", "salary"]);
  });
});
