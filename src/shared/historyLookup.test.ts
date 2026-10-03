import { describe, expect, it } from "vitest";
import {
  findCachedHistoryItem,
  findHistoryItemByListingUrl,
  type HistoryLookupItem,
} from "./utils";

function item(
  key: string,
  url: string,
  jobUrl = url
): HistoryLookupItem {
  return { key, url, job: { url: jobUrl } };
}

describe("findCachedHistoryItem", () => {
  it("matches a saved report by job number when the page URL changed", () => {
    const history = [
      item(
        "jobNumber:2026-3281",
        "https://www.governmentjobs.com/jobs/1?utm=old"
      ),
    ];

    const match = findCachedHistoryItem(
      {
        jobNumber: "2026-3281",
        title: "Analyst",
        salary: "",
        company: "City",
        url: "https://www.governmentjobs.com/jobs/1?utm=new",
      },
      history
    );

    expect(match?.key).toBe("jobNumber:2026-3281");
  });

  it("matches by listing URL when corrected title and company changed the meta key", () => {
    const url = "https://www.indeed.com/viewjob?jk=abc";
    const history = [
      item(`meta:Corrected title||Acme Inc|${url}`, url),
    ];

    const match = findCachedHistoryItem(
      {
        jobNumber: "",
        title: "Scraped title",
        salary: "",
        company: "Acme",
        url,
      },
      history
    );

    expect(match?.url).toBe(url);
  });

  it("prefers the job-key match over a different listing that shares no URL", () => {
    const history = [
      item("jobNumber:other", "https://example.com/other"),
      item("jobNumber:this", "https://example.com/this"),
    ];

    const match = findCachedHistoryItem(
      {
        jobNumber: "this",
        title: "Role",
        salary: "",
        company: "Co",
        url: "https://example.com/this?from=search",
      },
      history
    );

    expect(match?.key).toBe("jobNumber:this");
  });

  it("returns the newest URL match", () => {
    const url = "https://www.indeed.com/viewjob?jk=abc";
    const history = [
      item("meta:new", url),
      item("meta:old", url),
    ];

    expect(findHistoryItemByListingUrl(url, history)?.key).toBe("meta:new");
  });

  it("treats a trailing slash and hash as the same listing", () => {
    const history = [item("jobNumber:1", "https://example.com/jobs/1/")];

    expect(
      findHistoryItemByListingUrl("https://example.com/jobs/1#apply", history)?.key
    ).toBe("jobNumber:1");
  });

  it("returns undefined when nothing matches", () => {
    expect(
      findCachedHistoryItem(
        {
          jobNumber: "",
          title: "Other",
          salary: "",
          company: "Other",
          url: "https://example.com/other",
        },
        [item("meta:Role||Co|https://example.com/job", "https://example.com/job")]
      )
    ).toBeUndefined();
  });
});
