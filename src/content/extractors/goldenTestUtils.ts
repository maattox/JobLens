import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { expect } from "vitest";

export const examplesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../job-listing-examples"
);

export function withFixture(
  url: string,
  htmlPath: string,
  run: () => void
): void {
  const html = readFileSync(join(examplesDir, htmlPath), "utf8");
  const window = new Window({ url });
  window.document.write(html);
  window.document.close();
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = window.document as unknown as Document;
  globalThis.window = window as unknown as Window & typeof globalThis.window;
  try {
    run();
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  }
}

export function expectWorkMode(
  actual: string,
  expected: "onsite" | "hybrid" | "remote"
) {
  expect(actual.toLowerCase()).toContain(expected);
}
