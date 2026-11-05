/** Turn a URL path into a stable page slug for i18n keys. */
export function pageSlugFromUrl(pageUrl: string): string {
  try {
    const url = new URL(pageUrl);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (path === "/") return "home";

    const slug = path
      .replace(/^\//, "")
      .replace(/\//g, ".")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^\.+|\.+$/g, "");

    return slug || "page";
  } catch {
    return "page";
  }
}

/** Sanitize a fragment used inside a key. */
export function sanitizeKeyPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "item";
}

/**
 * Build a flat key like `home.title` or `about.h1.0`.
 * Dedupes by returning an existing key when the same text was seen before.
 */
export function createKeyRegistry() {
  const textToKey = new Map<string, string>();
  const usedKeys = new Set<string>();
  const counters = new Map<string, number>();

  function nextIndex(base: string): number {
    const n = counters.get(base) ?? 0;
    counters.set(base, n + 1);
    return n;
  }

  function allocate(pageSlug: string, section: string, text: string): string {
    const normalized = text.trim();
    const existing = textToKey.get(normalized);
    if (existing) return existing;

    let key: string;
    if (section === "title" || section === "description") {
      key = `${pageSlug}.${section}`;
      if (usedKeys.has(key)) {
        key = `${pageSlug}.${section}.${nextIndex(`${pageSlug}.${section}`)}`;
      }
    } else {
      const idx = nextIndex(`${pageSlug}.${section}`);
      key = `${pageSlug}.${section}.${idx}`;
    }

    // Avoid collisions
    let finalKey = key;
    let suffix = 1;
    while (usedKeys.has(finalKey)) {
      finalKey = `${key}_${suffix++}`;
    }

    usedKeys.add(finalKey);
    textToKey.set(normalized, finalKey);
    return finalKey;
  }

  return { allocate, textToKey };
}
