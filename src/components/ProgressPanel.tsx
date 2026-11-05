"use client";

import type { ProgressEvent } from "@/lib/types";

type Props = {
  progress: ProgressEvent | null;
  logs: string[];
  running: boolean;
};

export function ProgressPanel({ progress, logs, running }: Props) {
  if (!progress && logs.length === 0) return null;

  const percent = progress?.percent ?? 0;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-800">Progress</h2>
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {progress?.stage ?? (running ? "…" : "idle")}
        </span>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-teal-600 transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>

      <p className="text-sm text-zinc-700">
        {progress?.message || (running ? "Working…" : "")}
      </p>

      {(progress?.pagesFound != null || progress?.totalStrings != null) && (
        <p className="text-xs text-zinc-500">
          {progress.pagesFound != null && (
            <span>Pages: {progress.pagesFound}</span>
          )}
          {progress.pagesFound != null && progress.totalStrings != null && (
            <span> · </span>
          )}
          {progress.totalStrings != null && (
            <span>
              Strings: {progress.stringsTranslated ?? 0}/
              {progress.totalStrings}
            </span>
          )}
        </p>
      )}

      {logs.length > 0 && (
        <ul className="max-h-36 overflow-y-auto rounded-lg bg-zinc-50 p-2 font-mono text-[11px] leading-relaxed text-zinc-600">
          {logs.slice(-40).map((line, i) => (
            <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
