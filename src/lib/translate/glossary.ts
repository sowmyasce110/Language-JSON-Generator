export type GlossaryEntry = { source: string; target: string };

/** Parse `Brand=Brand` or `BrandName=브랜드` lines. */
export function parseGlossary(raw: string | undefined): GlossaryEntry[] {
  if (!raw?.trim()) return [];

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const eq = line.indexOf("=");
      if (eq <= 0) return null;
      const source = line.slice(0, eq).trim();
      const target = line.slice(eq + 1).trim();
      if (!source) return null;
      return { source, target: target || source };
    })
    .filter((e): e is GlossaryEntry => e !== null)
    .sort((a, b) => b.source.length - a.source.length); // longer first
}

type ProtectResult = {
  text: string;
  placeholders: Map<string, string>;
};

/**
 * Replace glossary source terms with placeholders so the translator
 * does not alter brand/product names. Restore (with target forms) after.
 */
export function protectGlossary(
  text: string,
  glossary: GlossaryEntry[]
): ProtectResult {
  const placeholders = new Map<string, string>();
  if (glossary.length === 0) return { text, placeholders };

  let result = text;
  glossary.forEach((entry, i) => {
    const token = `__GLOSS_${i}__`;
    const re = new RegExp(escapeRegExp(entry.source), "gi");
    if (re.test(result)) {
      placeholders.set(token, entry.target);
      result = result.replace(re, token);
    }
  });

  return { text: result, placeholders };
}

export function restoreGlossary(
  text: string,
  placeholders: Map<string, string>
): string {
  let result = text;
  for (const [token, value] of placeholders) {
    result = result.split(token).join(value);
  }
  return result;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
