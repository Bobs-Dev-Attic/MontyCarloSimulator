"use client";

import type { HistoryEntry } from "@/lib/history";
import { toJson, toCsv, downloadText } from "@/lib/history";
import { formatCurrency, formatPercent } from "@/lib/format";

interface Props {
  entries: HistoryEntry[];
  selected: string[];
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onCompare: () => void;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function HistoryPanel({
  entries,
  selected,
  onToggleSelect,
  onDelete,
  onClear,
  onCompare,
}: Props) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">
          Simulation history
          <span className="ml-2 text-xs font-normal text-muted">
            {entries.length} run{entries.length === 1 ? "" : "s"}
          </span>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onCompare}
            disabled={selected.length !== 2}
            className="rounded-lg bg-accent2 px-3 py-1.5 text-xs font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            title="Select exactly two runs to compare"
          >
            Compare ({selected.length}/2)
          </button>
          <button
            onClick={() =>
              downloadText(
                `mcs-history-${stamp}.json`,
                toJson(entries),
                "application/json"
              )
            }
            disabled={entries.length === 0}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-slate-200 transition hover:bg-panel2 disabled:opacity-40"
          >
            Export JSON
          </button>
          <button
            onClick={() =>
              downloadText(`mcs-history-${stamp}.csv`, toCsv(entries), "text/csv")
            }
            disabled={entries.length === 0}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-slate-200 transition hover:bg-panel2 disabled:opacity-40"
          >
            Export CSV
          </button>
          <button
            onClick={onClear}
            disabled={entries.length === 0}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-bad disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          Runs you make are saved here (in your browser). Select two to compare,
          or export them all.
        </p>
      ) : (
        <ul className="divide-y divide-line/50">
          {entries.map((e) => {
            const isSel = selected.includes(e.id);
            const headline =
              e.model === "retirement"
                ? `${formatPercent(e.summary.successRate)} success`
                : `${formatPercent(e.summary.probLoss)} loss`;
            return (
              <li key={e.id} className="flex items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => onToggleSelect(e.id)}
                  className="h-4 w-4 shrink-0 accent-[#38bdf8]"
                  aria-label={`Select ${e.label} for comparison`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        e.model === "gbm"
                          ? "bg-accent/15 text-accent"
                          : "bg-accent2/15 text-accent2"
                      }`}
                    >
                      {e.model === "gbm" ? "GBM" : "Retire"}
                    </span>
                    <span className="truncate text-sm text-slate-200">{e.label}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {timeAgo(e.createdAt)} · {e.meta.nSims.toLocaleString()} sims
                    {e.meta.seed !== null ? ` · seed ${e.meta.seed}` : ""} · median{" "}
                    {formatCurrency(e.summary.median)}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-slate-300">
                  {headline}
                </span>
                <button
                  onClick={() => onDelete(e.id)}
                  className="shrink-0 rounded px-1.5 py-1 text-muted transition hover:text-bad"
                  aria-label="Delete run"
                  title="Delete run"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
