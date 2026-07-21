import { describe, expect, it } from "vitest";
import { readJsonFile } from "./jsonFile";

describe("readJsonFile", () => {
  it("parses JSON from a file", async () => {
    const file = new File(['{"skills":"TypeScript"}'], "profile.json", {
      type: "application/json",
    });

    const parsed = await readJsonFile(file);
    expect(parsed).toEqual({ skills: "TypeScript" });
  });
});
