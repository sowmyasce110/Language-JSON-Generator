/** Collect page URLs from sitemap.xml (and one level of sitemap index). */
export async function collectSitemapUrls(
  origin: string,
  maxUrls: number,
  signal?: AbortSignal
): Promise<string[]> {
  const sitemapUrl = new URL("/sitemap.xml", origin).toString();
  const urls = await parseSitemap(sitemapUrl, maxUrls, signal, 0);
  return urls.filter((u) => {
    try {
      return new URL(u).origin === origin;
    } catch {
      return false;
    }
  });
}

async function parseSitemap(
  sitemapUrl: string,
  maxUrls: number,
  signal: AbortSignal | undefined,
  depth: number
): Promise<string[]> {
  if (depth > 1) return [];

  try {
    const res = await fetch(sitemapUrl, {
      signal,
      headers: { "User-Agent": "LanguageJsonGenerator/1.0 (local trailer)" },
      redirect: "follow",
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const locTags = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) =>
      m[1].trim()
    );

    const isIndex =
      /<sitemapindex[\s>]/i.test(xml) ||
      locTags.some((u) => /sitemap.*\.xml/i.test(u));

    if (isIndex && depth === 0) {
      const collected: string[] = [];
      for (const child of locTags) {
        if (collected.length >= maxUrls) break;
        const childUrls = await parseSitemap(
          child,
          maxUrls - collected.length,
          signal,
          depth + 1
        );
        collected.push(...childUrls);
      }
      return collected.slice(0, maxUrls);
    }

    return locTags.slice(0, maxUrls);
  } catch {
    return [];
  }
}
