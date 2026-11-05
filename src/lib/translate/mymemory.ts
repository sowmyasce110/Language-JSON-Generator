import {
  protectGlossary,
  restoreGlossary,
  type GlossaryEntry,
} from "./glossary";

/** Free MyMemory API — no key needed for light local use. */
export async function translateWithMyMemory(
  text: string,
  sourceLang: string,
  targetLang: string,
  glossary: GlossaryEntry[],
  signal?: AbortSignal
): Promise<{ text: string; ok: boolean }> {
  const { text: protectedText, placeholders } = protectGlossary(text, glossary);

  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", protectedText);
    url.searchParams.set(
      "langpair",
      `${sourceLang === "auto" ? "en" : sourceLang}|${targetLang}`
    );

    const res = await fetch(url.toString(), {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { text, ok: false };

    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number | string;
    };

    const translated = data.responseData?.translatedText;
    const status = Number(data.responseStatus);
    if (!translated || (status && status !== 200)) {
      return { text, ok: false };
    }

    // MyMemory sometimes returns "QUERY LENGTH LIMIT EXCEEDED..." as the text
    if (/QUERY LENGTH LIMIT|MYMEMORY WARNING/i.test(translated)) {
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
