import { extractFromHtml, extractLinks } from "./extract";
import { createKeyRegistry } from "./keys";
import { collectSitemapUrls } from "./sitemap";
import {
  fetchRobots,
  isAllowedByRobots,
  type RobotsRules,
} from "./robots";
import type { ExtractedString, ProgressEvent } from "./types";

export type CrawlResult = {
  pages: string[];
  strings: ExtractedString[];
  sourceLocale: Record<string, string>;
};

export type CrawlOptions = {
  startUrl: string;
  maxPages?: number;
  signal?: AbortSignal;
  onProgress?: (event: ProgressEvent) => void;
};

const DEFAULT_DELAY_MS = 600;
const REQUEST_TIMEOUT_MS = 12000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

async function fetchHtml(
  url: string,
  signal?: AbortSignal
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "LanguageJsonGenerator/1.0 (local trailer)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") || "";
    if (ctype && !ctype.includes("text/html") && !ctype.includes("application/xhtml")) {
      return null;
    }
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Discover routes (sitemap + BFS), respect robots.txt, extract text.
 */
export async function crawlSite(options: CrawlOptions): Promise<CrawlResult> {
  const maxPages = Math.min(Math.max(options.maxPages ?? 15, 1), 25);
  const start = new URL(options.startUrl);
  const origin = start.origin;
  const signal = options.signal;
  const emit = options.onProgress;

  emit?.({
    type: "progress",
    stage: "discover",
    message: "Fetching robots.txt…",
    percent: 2,
  });

  const robots: RobotsRules = await fetchRobots(origin, signal);
  const delayMs = robots.crawlDelayMs ?? DEFAULT_DELAY_MS;

  emit?.({
    type: "progress",
    stage: "discover",
    message: "Checking sitemap.xml…",
    percent: 5,
  });

  const sitemapUrls = await collectSitemapUrls(origin, maxPages, signal);

  const queue: string[] = [];
  const seen = new Set<string>();

  const enqueue = (raw: string) => {
    try {
      const u = new URL(raw);
      if (u.origin !== origin) return;
      u.hash = "";
      const href = u.toString();
      if (seen.has(href)) return;
      if (!isAllowedByRobots(href, robots)) return;
      seen.add(href);
      queue.push(href);
    } catch {
      // ignore
    }
  };

  enqueue(start.toString());
  for (const u of sitemapUrls) enqueue(u);

  emit?.({
    type: "progress",
    stage: "discover",
    message:
      sitemapUrls.length > 0
        ? `Found ${sitemapUrls.length} URL(s) in sitemap; starting crawl…`
        : "No sitemap found; starting BFS link crawl…",
    percent: 8,
    pagesFound: Math.min(seen.size, maxPages),
  });

  const registry = createKeyRegistry();
  const allStrings: ExtractedString[] = [];
  const crawledPages: string[] = [];
  const sourceLocale: Record<string, string> = {};

  let processed = 0;

  while (queue.length > 0 && crawledPages.length < maxPages) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const url = queue.shift()!;
    const html = await fetchHtml(url, signal);

    if (html) {
      crawledPages.push(url);

      emit?.({
        type: "progress",
        stage: "extract",
        message: `Extracting content from ${url}`,
        percent: Math.min(
          10 + Math.round((crawledPages.length / maxPages) * 50),
          60
        ),
        pagesFound: crawledPages.length,
      });

      const extracted = extractFromHtml(html, url, registry);
      for (const item of extracted) {
        if (!(item.key in sourceLocale)) {
          sourceLocale[item.key] = item.text;
          allStrings.push(item);
        }
      }

      // BFS expansion when under page budget
      if (crawledPages.length < maxPages) {
        for (const link of extractLinks(html, url, origin)) {
          if (crawledPages.length + queue.length >= maxPages * 3) break;
          enqueue(link);
        }
      }
    }

    processed += 1;
    if (queue.length > 0 && crawledPages.length < maxPages) {
      await sleep(delayMs, signal);
    }

    emit?.({
      type: "progress",
      stage: "discover",
      message: `Crawled ${crawledPages.length}/${maxPages} pages (${processed} requests)…`,
      percent: Math.min(
        10 + Math.round((crawledPages.length / maxPages) * 50),
        60
      ),
      pagesFound: crawledPages.length,
    });
  }

  emit?.({
    type: "progress",
    stage: "extract",
    message: `Extracted ${allStrings.length} unique string(s) from ${crawledPages.length} page(s)`,
    percent: 62,
    pagesFound: crawledPages.length,
    totalStrings: allStrings.length,
  });

  return {
    pages: crawledPages,
    strings: allStrings,
    sourceLocale,
  };
}
