import { normalizeWhitespace } from "../../shared/textUtils";

export function getTermBlockValue(labelElement: Element | null): string {
  if (!labelElement) return "";

  const termBlock = labelElement.closest(".term-block");
  if (!termBlock) return "";

  const valueEl = termBlock.querySelector(".span8 p");
  if (!valueEl) return "";

  return normalizeWhitespace(valueEl.textContent || "");
}

export function extractTermValue(labelText: string): string {
  const labels = document.querySelectorAll(".term-description");
  for (const label of labels) {
    if (normalizeWhitespace(label.textContent || "") === labelText) {
      return getTermBlockValue(label);
    }
  }
  return "";
}

export function shouldSkipNode(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (tag === "img" || tag === "script" || tag === "style") return true;
  if (el.classList?.contains("hide-aria-label")) return true;
  return false;
}

export function inlineToMarkdown(node: Node, plain: boolean): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || "").replace(/\u00a0/g, " ");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  if (shouldSkipNode(node)) return "";

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const childText = () =>
    Array.from(el.childNodes)
      .map((child) => inlineToMarkdown(child, plain))
      .join("");

  switch (tag) {
    case "br":
      return "\n";
    case "strong":
    case "b": {
      const inner = childText().trim();
      if (!inner) return "";
      return plain ? inner : `**${inner}**`;
    }
    case "em":
    case "i": {
      const inner = childText().trim();
      if (!inner) return "";
      return plain ? inner : `*${inner}*`;
    }
    case "a":
      return normalizeWhitespace(childText());
    default:
      return childText();
  }
}

export function listToText(listEl: Element, plain: boolean, depth = 0): string {
  const items = Array.from(listEl.children).filter(
    (child) => child.tagName.toLowerCase() === "li"
  );

  const lines: string[] = [];
  const indent = "  ".repeat(depth);

  for (const li of items) {
    const liClone = li.cloneNode(true) as Element;
    liClone.querySelectorAll(":scope > ul, :scope > ol").forEach((list) => list.remove());

    const itemText = normalizeWhitespace(inlineToMarkdown(liClone, plain));
    if (itemText) {
      lines.push(`${indent}- ${itemText}`);
    }

    const directLists = Array.from(li.children).filter((child) => {
      const t = child.tagName.toLowerCase();
      return t === "ul" || t === "ol";
    });

    for (const nested of directLists) {
      lines.push(listToText(nested, plain, depth + 1));
    }
  }

  return lines.filter(Boolean).join("\n");
}

export function blockToText(container: Element, plain: boolean): string {
  const parts: string[] = [];

  for (const node of container.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalizeWhitespace(node.textContent || "");
      if (text) parts.push(text);
      continue;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    if (shouldSkipNode(node)) continue;

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === "ul" || tag === "ol") {
      const listText = listToText(el, plain);
      if (listText) parts.push(listText);
      continue;
    }

    if (tag === "p" || tag === "div") {
      const text = normalizeWhitespace(inlineToMarkdown(el, plain));
      if (text) parts.push(text);
      continue;
    }

    if (tag === "h2" || tag === "h3" || tag === "h4") {
      const heading = normalizeWhitespace(el.textContent || "");
      if (heading) {
        parts.push(plain ? heading : `### ${heading}`);
      }
      continue;
    }

    const fallback = normalizeWhitespace(inlineToMarkdown(el, plain));
    if (fallback) parts.push(fallback);
  }

  return parts.join("\n\n");
}
