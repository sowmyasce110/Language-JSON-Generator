import {
  parseGlossary,
  protectGlossary,
  restoreGlossary,
  type GlossaryEntry,
} from "./glossary";
import { translateWithMyMemory } from "./mymemory";

export type TranslateOptions = {
  texts: string[];
  sourceLang: string;
  targetLang: string;
  glossaryRaw?: string;
  signal?: AbortSignal;
  onBatch?: (done: number, total: number) => void;
};

export type TranslateResult = {
  translations: string[];
  fallbackIndexes: number[];
  demoMode: boolean;
};

const BATCH_SIZE = 5;

function libreBaseUrl(): string {
  return (
    process.env.LIBRETRANSLATE_URL?.replace(/\/+$/, "") ||
    "http://localhost:5000"
  );
}

async function translateOneLibre(
  text: string,
  sourceLang: string,
  targetLang: string,
  glossary: GlossaryEntry[],
  baseUrl: string,
  signal?: AbortSignal
): Promise<{ text: string; ok: boolean }> {
  const { text: protectedText, placeholders } = protectGlossary(text, glossary);

  try {
    const res = await fetch(`${baseUrl}/translate`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: protectedText,
        source: sourceLang === "auto" ? "auto" : sourceLang,
        target: targetLang,
        format: "text",
      }),
    });

    if (!res.ok) {
      return { text, ok: false };
    }

    const data = (await res.json()) as { translatedText?: string };
    const translated = data.translatedText;
    if (typeof translated !== "string") {
      return { text, ok: false };
    }

    return {
      text: restoreGlossary(translated, placeholders),
      ok: true,
    };
  } catch {
    return { text, ok: false };
  }
}

/** Demo/offline mode: prefix with [lang] so the UI still works offline. */
function demoTranslate(
  texts: string[],
  targetLang: string,
  glossary: GlossaryEntry[]
): TranslateResult {
  const translations = texts.map((t) => {
    const { text, placeholders } = protectGlossary(t, glossary);
    return restoreGlossary(`[${targetLang}] ${text}`, placeholders);
  });
  return {
    translations,
    fallbackIndexes: [],
    demoMode: true,
  };
}

async function probeLibre(
  baseUrl: string,
  signal?: AbortSignal
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);

    try {
      const res = await fetch(`${baseUrl}/languages`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      return res.ok;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  } catch {
    return false;
  }
}

/**
 * Translate via LibreTranslate when available, else free MyMemory API,
 * else demo mode.
 */
export async function translateTexts(
  options: TranslateOptions
): Promise<TranslateResult> {
  const { texts, sourceLang, targetLang, glossaryRaw, signal, onBatch } =
    options;

  if (texts.length === 0) {
    return { translations: [], fallbackIndexes: [], demoMode: false };
  }

  if (sourceLang === targetLang) {
    return {
      translations: [...texts],
      fallbackIndexes: [],
      demoMode: false,
    };
  }

  const glossary = parseGlossary(glossaryRaw);
  const forceDemo = process.env.TRANSLATE_DEMO_MODE === "1";
  if (forceDemo) {
    onBatch?.(texts.length, texts.length);
    return demoTranslate(texts, targetLang, glossary);
  }

  const baseUrl = libreBaseUrl();
  const useLibre = await probeLibre(baseUrl, signal);

  const translations: string[] = new Array(texts.length);
  const fallbackIndexes: number[] = [];
  let done = 0;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const slice = texts.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      slice.map(async (text) => {
        if (useLibre) {
          const libre = await translateOneLibre(
            text,
            sourceLang,
            targetLang,
            glossary,
            baseUrl,
            signal
          );
          if (libre.ok) return libre;
        }
        return translateWithMyMemory(
          text,
          sourceLang,
          targetLang,
          glossary,
          signal
        );
      })
    );

    results.forEach((r, j) => {
      const idx = i + j;
      translations[idx] = r.text;
      if (!r.ok) fallbackIndexes.push(idx);
    });

    done += slice.length;
    onBatch?.(done, texts.length);

    // Rate-limit free APIs
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, useLibre ? 250 : 400));
    }
  }

  if (fallbackIndexes.length === texts.length) {
    return demoTranslate(texts, targetLang, glossary);
  }

  return { translations, fallbackIndexes, demoMode: false };
}
