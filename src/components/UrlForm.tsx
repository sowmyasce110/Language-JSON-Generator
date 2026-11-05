"use client";

import { SUPPORTED_LANGUAGES } from "@/lib/types";

export type FormValues = {
  url: string;
  targetLang: string;
  sourceLang: string;
  maxPages: number;
  glossary: string;
};

type Props = {
  values: FormValues;
  onChange: (values: FormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  running: boolean;
};

export function UrlForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  running,
}: Props) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!running) onSubmit();
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-zinc-700">Website URL</span>
        <input
          type="url"
          required
          placeholder="https://example.com"
          value={values.url}
          disabled={running}
          onChange={(e) => onChange({ ...values, url: e.target.value })}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 shadow-sm outline-none ring-teal-600/30 placeholder:text-zinc-400 focus:border-teal-600 focus:ring-2 disabled:opacity-60"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-700">Source language</span>
          <select
            value={values.sourceLang}
            disabled={running}
            onChange={(e) =>
              onChange({ ...values, sourceLang: e.target.value })
            }
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30 disabled:opacity-60"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label} ({l.code})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-700">Target language</span>
          <select
            value={values.targetLang}
            disabled={running}
            onChange={(e) =>
              onChange({ ...values, targetLang: e.target.value })
            }
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30 disabled:opacity-60"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label} ({l.code})
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-zinc-700">
          Max pages <span className="font-normal text-zinc-500">(1–25)</span>
        </span>
        <input
          type="number"
          min={1}
          max={25}
          value={values.maxPages}
          disabled={running}
          onChange={(e) =>
            onChange({
              ...values,
              maxPages: Number(e.target.value) || 15,
            })
          }
          className="w-28 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 shadow-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30 disabled:opacity-60"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-zinc-700">
          Glossary{" "}
          <span className="font-normal text-zinc-500">
            (optional, one <code className="text-xs">Term=Translation</code> per
            line)
          </span>
        </span>
        <textarea
          rows={3}
          placeholder={"Acme=Acme\nProductName=ProductName"}
          value={values.glossary}
          disabled={running}
          onChange={(e) => onChange({ ...values, glossary: e.target.value })}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 font-mono text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30 disabled:opacity-60"
        />
      </label>

      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="submit"
          disabled={running || !values.url.trim()}
          className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? "Generating…" : "Start generation"}
        </button>
        {running && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
