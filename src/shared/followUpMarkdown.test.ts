import { describe, expect, it } from "vitest";
import { renderFollowUpMarkdown } from "./followUpMarkdown";

describe("renderFollowUpMarkdown", () => {
  it("renders links as safe anchors", () => {
    const html = renderFollowUpMarkdown(
      "See [docs](https://example.com/guide) for details."
    );
    expect(html).toContain(
      '<a href="https://example.com/guide" target="_blank" rel="noopener noreferrer">docs</a>'
    );
  });

  it("rejects non-http link protocols", () => {
    const html = renderFollowUpMarkdown("Click [x](javascript:alert(1)) now.");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("x");
  });

  it("renders lists and emphasis", () => {
    const html = renderFollowUpMarkdown(
      ["- **Bold** item", "- Second", "", "Plain paragraph"].join("\n")
    );
    expect(html).toContain("<ul class=\"md-list\">");
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<p>Plain paragraph</p>");
  });
});
