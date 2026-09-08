"use client";

import type { TabHistory } from "@/lib/tabHistory";

function timeAgo(at: number): string {
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(at).toLocaleDateString();
}

interface Props {
  history: TabHistory;
  /** Apply a saved run's inputs back to the view's fields. */
  onRestore: (inputs: Record<string, unknown>) => void;
  title?: string;
}

export default function TabHistoryPanel({ history, onRestore, title = "Run history" }: Props) {
  const { entries, remove, clear } = history;

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">
          {title}
          {entries.length ? <span className="ml-2 text-xs font-normal text-muted">{entries.length} saved</span> : null}
        </h3>
        {entries.length ? (
          <button
            onClick={clear}
            className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-muted transition hover:text-bad"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted">
          No runs saved yet. Each time you run this view, its inputs and headline results are recorded here.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded-xl border border-line bg-panel2 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium text-slate-100">{e.label}</span>
                    <span className="text-[11px] text-muted">{timeAgo(e.at)}</span>
                  </div>
                  {e.metrics.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {e.metrics.map((m, i) => (
                        <span key={i} className="rounded-md border border-line bg-panel px-1.5 py-0.5 text-[11px] tabular-nums text-slate-300">
                          <span className="text-muted">{m.label}</span> {m.value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => onRestore(e.inputs)}
                    className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:bg-panel"
                    title="Load these inputs back into the form"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => remove(e.id)}
                    aria-label="Delete run"
                    className="rounded-lg border border-line px-2 py-1 text-[11px] text-muted transition hover:text-bad"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
