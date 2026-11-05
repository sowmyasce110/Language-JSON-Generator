"use client";

import { useMemo, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

type Props = {
  locales: Record<string, Record<string, string>> | null;
  fallbackKeys: string[];
  pages: string[];
  demoMode: boolean;
  sourceLang: string;
  targetLang: string;
};

export function JsonPreview({
  locales,
  fallbackKeys,
  pages,
  demoMode,
  sourceLang,
  targetLang,
}: Props) {
  const langKeys = useMemo(
    () => (locales ? Object.keys(locales) : []),
    [locales]
  );

  // null = follow the preferred target/source; otherwise a user pick
  const [userLang, setUserLang] = useState<string | null>(null);

  const preferredLang = locales?.[targetLang]
    ? targetLang
    : locales?.[sourceLang]
      ? sourceLang
      : langKeys[0] || "en";

  const effectiveLang =
    userLang && locales?.[userLang] ? userLang : preferredLang;

  if (!locales || langKeys.length === 0) return null;

  const jsonText = JSON.stringify(locales[effectiveLang] ?? {}, null, 2);
  const keyCount = Object.keys(locales[effectiveLang] ?? {}).length;

  async function downloadZip() {
    if (!locales) return;
    const zip = new JSZip();
    const folder = zip.folder("locales");
    if (!folder) return;

    for (const [lang, data] of Object.entries(locales)) {
      folder.file(`${lang}.json`, JSON.stringify(data, null, 2));
    }

    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "locales.zip");
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800">
            JSON preview
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {keyCount} keys · {pages.length} page(s) crawled
            {demoMode && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                demo translation
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={downloadZip}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
        >
          Download ZIP
        </button>
      </div>

      {demoMode && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Translation services were unreachable, so strings were prefixed with{" "}
          <code>[{targetLang}]</code>. Restart the app with network access
          (MyMemory) or a local LibreTranslate at{" "}
          <code>LIBRETRANSLATE_URL</code>, then generate again.
        </p>
      )}

      {fallbackKeys.length > 0 && !demoMode && (
        <p className="text-xs text-amber-700">
          {fallbackKeys.length} key(s) fell back to the original text after a
          translation failure.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {langKeys.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setUserLang(lang)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              effectiveLang === lang
                ? "bg-teal-700 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            locales/{lang}.json
          </button>
        ))}
      </div>

      <pre className="max-h-[28rem] overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-relaxed text-teal-100">
        {jsonText}
      </pre>

      {pages.length > 0 && (
        <details className="text-xs text-zinc-600">
          <summary className="cursor-pointer font-medium text-zinc-700">
            Crawled pages
          </summary>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {pages.map((p) => (
              <li key={p} className="break-all">
                {p}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
