/**
 * Lightweight markdown → safe HTML for follow-up answers.
 * Supports paragraphs, headings, lists, bold/italic, inline code, and http(s) links.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeHref(href: string): string | null {
  const trimmed = href.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function renderInline(text: string): string {
  let html = escapeHtml(text);

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, url: string) => {
    const safe = sanitizeHref(url);
    if (!safe) {
      return label;
    }
    return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  html = html.replace(
    /(^|[^"'>])(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/gi,
    (_match, prefix: string, url: string) => {
      const safe = sanitizeHref(url);
      if (!safe) return `${prefix}${url}`;
      return `${prefix}<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
    }
  );

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>");

  return html;
}

function getListDepth(indent: string): number {
  return Math.floor(indent.length / 2);
}

export function renderFollowUpMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  const listDepths: number[] = [];
  let listTag: "ul" | "ol" | null = null;

  function closeListsToDepth(targetDepth: number) {
    while (listDepths.length > targetDepth) {
      parts.push(`</${listTag ?? "ul"}>`);
      listDepths.pop();
    }
    if (!listDepths.length) {
      listTag = null;
    }
  }

  function closeAllLists() {
    closeListsToDepth(0);
  }

  function ensureList(tag: "ul" | "ol", depth: number) {
    if (listTag && listTag !== tag) {
      closeAllLists();
    }
    listTag = tag;

    if (listDepths.length <= depth) {
      while (listDepths.length <= depth) {
        parts.push(`<${tag} class="md-list">`);
        listDepths.push(listDepths.length);
      }
    } else {
      closeListsToDepth(depth + 1);
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      closeAllLists();
      continue;
    }

    const ulMatch = line.match(/^(\s*)[-*] (.+)$/);
    if (ulMatch) {
      const depth = getListDepth(ulMatch[1]);
      ensureList("ul", depth);
      parts.push(`<li>${renderInline(ulMatch[2])}</li>`);
      continue;
    }

    const olMatch = line.match(/^(\s*)\d+\. (.+)$/);
    if (olMatch) {
      const depth = getListDepth(olMatch[1]);
      ensureList("ol", depth);
      parts.push(`<li>${renderInline(olMatch[2])}</li>`);
      continue;
    }

    closeAllLists();

    if (trimmed.startsWith("### ")) {
      parts.push(`<h3>${renderInline(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("## ")) {
      parts.push(`<h2>${renderInline(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("# ")) {
      parts.push(`<h1>${renderInline(trimmed.slice(2))}</h1>`);
    } else {
      parts.push(`<p>${renderInline(trimmed)}</p>`);
    }
  }

  closeAllLists();
  return parts.join("");
}
