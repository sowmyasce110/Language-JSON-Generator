export type RobotsRules = {
  disallow: string[];
  allow: string[];
  crawlDelayMs: number | null;
};

const DEFAULT_RULES: RobotsRules = {
  disallow: [],
  allow: [],
  crawlDelayMs: null,
};

/** Fetch and parse robots.txt for the given origin. Fails open (allow all). */
export async function fetchRobots(
  origin: string,
  signal?: AbortSignal
): Promise<RobotsRules> {
  try {
    const res = await fetch(new URL("/robots.txt", origin).toString(), {
      signal,
      headers: { "User-Agent": "LanguageJsonGenerator/1.0 (local trailer)" },
      redirect: "follow",
    });
    if (!res.ok) return { ...DEFAULT_RULES };

    const text = await res.text();
    return parseRobots(text);
  } catch {
    return { ...DEFAULT_RULES };
  }
}

export function parseRobots(text: string): RobotsRules {
  const lines = text.split(/\r?\n/);
  let inStar = false;
  const disallow: string[] = [];
  const allow: string[] = [];
  let crawlDelayMs: number | null = null;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;

    const [keyRaw, ...rest] = line.split(":");
    const key = keyRaw.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      inStar = value === "*";
      continue;
    }

    if (!inStar) continue;

    if (key === "disallow" && value) disallow.push(value);
    if (key === "allow" && value) allow.push(value);
    if (key === "crawl-delay") {
      const seconds = Number(value);
      if (!Number.isNaN(seconds) && seconds > 0) {
        crawlDelayMs = Math.min(seconds * 1000, 5000);
      }
    }
  }

  return { disallow, allow, crawlDelayMs };
}

/** Return true if the path is allowed by robots rules. */
export function isAllowedByRobots(pageUrl: string, rules: RobotsRules): boolean {
  let path: string;
  try {
    path = new URL(pageUrl).pathname;
  } catch {
    return false;
  }

  // Longest Allow/Disallow match wins (common robots convention)
  let bestAllow = -1;
  let bestDisallow = -1;

  for (const rule of rules.allow) {
    if (pathMatches(path, rule) && rule.length > bestAllow) {
      bestAllow = rule.length;
    }
  }
  for (const rule of rules.disallow) {
    if (pathMatches(path, rule) && rule.length > bestDisallow) {
      bestDisallow = rule.length;
    }
  }

  if (bestAllow < 0 && bestDisallow < 0) return true;
  if (bestAllow >= bestDisallow) return true;
  return false;
}

function pathMatches(path: string, pattern: string): boolean {
  if (pattern === "/") return true;
  if (pattern.endsWith("*")) {
    return path.startsWith(pattern.slice(0, -1));
  }
  return path.startsWith(pattern);
}
