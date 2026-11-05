import * as cheerio from "cheerio";
import { createKeyRegistry, pageSlugFromUrl } from "./keys";
import type { ExtractedString } from "./types";

const NOISE_RE =
  /^(cookie|accept|reject|close|menu|skip to|©|\d+$|login|sign in|sign up)$/i;

function isUsefulText(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 2 || t.length > 500) return false;
  if (NOISE_RE.test(t)) return false;
  if (/^https?:\/\//i.test(t)) return false;
  // Skip mostly-punctuation
  if ((t.match(/[a-zA-Z0-9\u00C0-\u024F\u0900-\u097F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g) || []).length < 2) {
    return false;
  }
  return true;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Extract translatable strings from HTML into flat i18n key-value pairs. */
export function extractFromHtml(
  html: string,
  pageUrl: string,
  registry: ReturnType<typeof createKeyRegistry>
): ExtractedString[] {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, code, pre").remove();

  const slug = pageSlugFromUrl(pageUrl);
  const results: ExtractedString[] = [];

  const push = (section: string, raw: string) => {
    const text = cleanText(raw);
    if (!isUsefulText(text)) return;
    const key = registry.allocate(slug, section, text);
    // Only push if this is the first time we see this text→key mapping added for this page pass
    // Dedup across pages is handled by registry; we still want one entry per unique text overall
    if (!results.some((r) => r.key === key)) {
      results.push({ key, text, pageUrl });
    }
  };

  const title = $("title").first().text();
  if (title) push("title", title);

  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content");
  if (description) push("description", description);

  $("h1, h2, h3").each((_, el) => {
    const tag = ($(el).prop("tagName") as string | undefined)?.toLowerCase() || "h";
    push(tag, $(el).text());
  });

  $("p").each((_, el) => {
    push("p", $(el).text());
  });

  $("button, label, [role='button']").each((_, el) => {
    push("label", $(el).text());
  });

  $("a").each((_, el) => {
    const text = $(el).text();
    // Prefer short link labels only
    if (cleanText(text).split(" ").length <= 8) {
      push("link", text);
    }
  });

  $("img[alt]").each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt) push("alt", alt);
  });

  return results;
}

/** Collect same-origin hrefs from a page. */
export function extractLinks(html: string, pageUrl: string, origin: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      return;
    }
    try {
      const absolute = new URL(href, pageUrl);
      if (absolute.origin !== origin) return;
      absolute.hash = "";
      // Drop common asset extensions
      if (/\.(pdf|png|jpe?g|gif|svg|webp|zip|css|js|mp4|mp3|ico)$/i.test(absolute.pathname)) {
        return;
      }
      links.add(absolute.toString());
    } catch {
      // ignore
    }
  });

  return [...links];
}
