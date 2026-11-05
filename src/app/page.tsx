"use client";

import { useCallback, useRef, useState } from "react";
import { JsonPreview } from "@/components/JsonPreview";
import { ProgressPanel } from "@/components/ProgressPanel";
import { UrlForm, type FormValues } from "@/components/UrlForm";
import type {
  ProgressEvent,
  ResultEvent,
  StreamEvent,
} from "@/lib/types";

export default function Home() {
  const [form, setForm] = useState<FormValues>({
    url: "",
    targetLang: "ko",
    sourceLang: "en",
    maxPages: 15,
    glossary: "",
  });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<ResultEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const appendLog = useCallback((line: string) => {
    setLogs((prev) => [...prev, line]);
  }, []);

  const start = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setError(null);
    setResult(null);
    setProgress({
      type: "progress",
      stage: "discover",
      message: "Connecting…",
      percent: 0,
    });
    setLogs([]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: form.url.trim(),
          targetLang: form.targetLang,
          sourceLang: form.sourceLang,
          maxPages: form.maxPages,
          glossary: form.glossary,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errBody = await res.json().catch(() => null);
        throw new Error(
          (errBody as { error?: string } | null)?.error ||
            `Request failed (${res.status})`
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = line.slice(6);
          let event: StreamEvent;
          try {
            event = JSON.parse(payload) as StreamEvent;
          } catch {
            continue;
          }

          if (event.type === "progress") {
            setProgress(event);
            appendLog(`[${event.stage}] ${event.message}`);
          } else if (event.type === "result") {
            setResult(event);
            appendLog(
              `Result ready: ${Object.keys(event.locales).join(", ")}`
            );
          } else if (event.type === "error") {
            setError(event.message);
            appendLog(`Error: ${event.message}`);
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Cancelled.");
        appendLog("Cancelled by user.");
      } else {
        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        setError(message);
        appendLog(`Error: ${message}`);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [form, appendLog]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <div className="relative min-h-full overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_#ccfbf1_0%,_#f8fafc_45%,_#e2e8f0_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230f766e' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <header className="border-b border-teal-900/10 bg-white/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="font-[family-name:var(--font-geist-sans)] text-lg font-bold tracking-tight text-teal-900 sm:text-xl">
              LocaleForge
            </p>
            <p className="text-xs text-zinc-500">
              Multilingual JSON Generator · local trailer
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Turn a website into i18n JSON
          </h1>
          <p className="mt-3 text-base text-zinc-600">
            Crawl a public URL, extract copy, translate with free LibreTranslate,
            and download <code className="text-sm">locales/*.json</code> — no
            cloud deploy required.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-xl border border-zinc-200 bg-white/80 p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-zinc-800">
              Generate
            </h2>
            <UrlForm
              values={form}
              onChange={setForm}
              onSubmit={start}
              onCancel={cancel}
              running={running}
            />
            {error && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}
          </section>

          <ProgressPanel
            progress={progress}
            logs={logs}
            running={running}
          />
        </div>

        <JsonPreview
          locales={result?.locales ?? null}
          fallbackKeys={result?.fallbackKeys ?? []}
          pages={result?.pages ?? []}
          demoMode={result?.demoMode ?? false}
          sourceLang={result?.sourceLang ?? form.sourceLang}
          targetLang={result?.targetLang ?? form.targetLang}
        />
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-center text-xs text-zinc-500 sm:px-6">
        Respects robots.txt · rate-limited crawl · download only (no auto-deploy)
      </footer>
    </div>
  );
}
