import { crawlSite } from "@/lib/crawler";
import { translateTexts } from "@/lib/translate";
import type { GenerateRequest, StreamEvent } from "@/lib/types";
import { SUPPORTED_LANGUAGES } from "@/lib/types";

// Keep this a serverless Route Handler (not statically collected).
export const dynamic = "force-dynamic";
export const revalidate = 0;

function sseEncode(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function isValidLang(code: string): boolean {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

function clampMaxPages(requested: number | undefined): number {
  const fallback = 15;
  const raw = requested ?? fallback;
  const envCap = Number(process.env.NETLIFY_MAX_PAGES || "0");
  const onNetlify = process.env.NETLIFY === "true";
  const hardCap = onNetlify
    ? Math.min(envCap > 0 ? envCap : 5, 8)
    : 25;
  return Math.min(Math.max(raw, 1), hardCap);
}

export async function POST(request: Request) {
  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = body.url?.trim();
  const targetLang = body.targetLang?.trim();
  const sourceLang = (body.sourceLang || "en").trim();
  const maxPages = clampMaxPages(body.maxPages);
  const glossary = body.glossary;

  if (!url) {
    return new Response(JSON.stringify({ error: "URL is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    void new URL(url);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!targetLang || !isValidLang(targetLang)) {
    return new Response(JSON.stringify({ error: "Unsupported target language" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isValidLang(sourceLang)) {
    return new Response(JSON.stringify({ error: "Unsupported source language" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const abortFromClient = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(sseEncode(event)));
        } catch {
          // stream closed
        }
      };

      try {
        send({
          type: "progress",
          stage: "discover",
          message: "Starting crawl…",
          percent: 1,
        });

        const crawl = await crawlSite({
          startUrl: url,
          maxPages,
          signal: abortFromClient,
          onProgress: send,
        });

        if (crawl.pages.length === 0) {
          send({
            type: "error",
            message:
              "No pages could be crawled. Check the URL, robots.txt, or try a simpler public site.",
          });
          controller.close();
          return;
        }

        const keys = Object.keys(crawl.sourceLocale);
        const texts = keys.map((k) => crawl.sourceLocale[k]);

        send({
          type: "progress",
          stage: "translate",
          message: `Translating ${texts.length} string(s) to ${targetLang}…`,
          percent: 65,
          pagesFound: crawl.pages.length,
          totalStrings: texts.length,
          stringsTranslated: 0,
        });

        const translated = await translateTexts({
          texts,
          sourceLang,
          targetLang,
          glossaryRaw: glossary,
          signal: abortFromClient,
          onBatch: (done, total) => {
            send({
              type: "progress",
              stage: "translate",
              message: `Translated ${done}/${total} strings…`,
              percent: 65 + Math.round((done / Math.max(total, 1)) * 30),
              pagesFound: crawl.pages.length,
              totalStrings: total,
              stringsTranslated: done,
            });
          },
        });

        const targetLocale: Record<string, string> = {};
        const fallbackKeys: string[] = [];
        keys.forEach((key, i) => {
          targetLocale[key] = translated.translations[i];
          if (translated.fallbackIndexes.includes(i)) {
            fallbackKeys.push(key);
          }
        });

        send({
          type: "progress",
          stage: "package",
          message: "Packaging locale JSON…",
          percent: 96,
          pagesFound: crawl.pages.length,
          totalStrings: keys.length,
          stringsTranslated: keys.length,
        });

        const locales: Record<string, Record<string, string>> = {
          [sourceLang]: crawl.sourceLocale,
        };
        if (targetLang !== sourceLang) {
          locales[targetLang] = targetLocale;
        }

        send({
          type: "result",
          locales,
          sourceLang,
          targetLang,
          fallbackKeys,
          pages: crawl.pages,
          demoMode: translated.demoMode,
        });

        send({
          type: "progress",
          stage: "done",
          message: translated.demoMode
            ? "Done (demo translation mode — LibreTranslate unreachable)."
            : "Done.",
          percent: 100,
          pagesFound: crawl.pages.length,
          totalStrings: keys.length,
          stringsTranslated: keys.length,
        });
      } catch (err) {
        const aborted =
          err instanceof DOMException && err.name === "AbortError";
        send({
          type: "error",
          message: aborted
            ? "Cancelled."
            : err instanceof Error
              ? err.message
              : "Generation failed.",
        });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
