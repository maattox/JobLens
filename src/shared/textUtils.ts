export function normalizeWhitespace(text: string): string {
  return (text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function parseSalaryMax(salaryText: string): number | null {
  if (!salaryText) return null;

  const numbers = salaryText
    .replace(/,/g, "")
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((n) => n > 1000);

  if (!numbers?.length) return null;
  return Math.max(...numbers);
}

export function inferWorkMode(text: string): string {
  const lower = text.toLowerCase();

  if (
    /\b(flexible\s*\/\s*hybrid|hybrid\/flexible)\b/.test(lower) ||
    /\btelework\b[^.]{0,120}\boffice\b[^.]{0,80}\b\d+[- ]?\d*\s+days?\b/.test(
      lower
    ) ||
    /\brequired to work in the office\b/.test(lower)
  ) {
    return "hybrid";
  }

  if (
    /\b(remote|hybrid)\b[^.]{0,100}\bnot\s+(available|offered|an option)\b/.test(
      lower
    ) ||
    /\bnot\s+(available|offered)[^.]{0,100}\b(remote|hybrid)\b/.test(lower)
  ) {
    if (/\b(on[- ]?site|in[- ]?person|fully\s+onsite|work location:\s*in person)\b/.test(lower)) {
      return "onsite";
    }
  }

  if (/\bhybrid\b/.test(lower)) {
    return "hybrid";
  }
  if (
    /\b(fully remote|100%\s*remote|telework only|remote work|work from home|telecommute|wfh|remote)\b/.test(
      lower
    )
  ) {
    return "remote";
  }
  if (/\b(on-?site|in-?office|on premises|work location:\s*in person)\b/.test(lower)) {
    return "onsite";
  }
  return "";
}
