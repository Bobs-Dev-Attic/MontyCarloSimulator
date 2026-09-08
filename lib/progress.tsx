"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { estimateMs, recordRun } from "./progressEstimator";

interface RunHandle {
  /** Call when the run finishes (success or error). */
  done: () => void;
}

interface ProgressCtx {
  /**
   * Begin tracking a running simulation. `work` ≈ simulations × steps/years, used
   * only to size the ETA. Returns a handle whose `done()` closes the dialog.
   */
  track: (model: string, work: number, label?: string) => RunHandle;
}

const Ctx = createContext<ProgressCtx | null>(null);

interface ActiveRun {
  model: string;
  work: number;
  label: string;
  startedAt: number;
  estimateMs: number;
}

function formatRemaining(ms: number, finishing: boolean): string {
  if (finishing || ms < 350) return "Finishing…";
  const s = ms / 1000;
  if (s < 10) return `~${Math.max(1, Math.ceil(s))}s remaining`;
  if (s < 60) return `~${Math.ceil(s / 5) * 5}s remaining`;
  const m = Math.floor(s / 60);
  const rem = Math.ceil((s % 60) / 15) * 15;
  return `~${m}m ${rem === 60 ? 0 : rem}s remaining`;
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState<ActiveRun | null>(null);
  const [pct, setPct] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const activeRef = useRef<ActiveRun | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  const tick = useCallback(() => {
    const a = activeRef.current;
    if (!a) return;
    const elapsed = performance.now() - a.startedAt;
    // Asymptotic fill: reaches ~90% around the estimated duration and eases
    // toward (but never hits) 100% if the run overruns — it only completes when
    // done() is called.
    const tau = a.estimateMs / 2.3;
    const frac = 1 - Math.exp(-elapsed / tau);
    setPct(Math.min(0.985, frac));
    setRemainingMs(Math.max(0, a.estimateMs - elapsed));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const track = useCallback(
    (model: string, work: number, label = "Running simulation"): RunHandle => {
      const run: ActiveRun = {
        model,
        work,
        label,
        startedAt: performance.now(),
        estimateMs: estimateMs(model, work),
      };
      activeRef.current = run;
      setActive(run);
      setFinishing(false);
      setPct(0);
      setRemainingMs(run.estimateMs);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (finishTimer.current != null) clearTimeout(finishTimer.current);
      rafRef.current = requestAnimationFrame(tick);

      return {
        done: () => {
          recordRun(model, work, performance.now() - run.startedAt);
          // A newer run may have superseded this one; if so, leave it alone.
          if (activeRef.current !== run) return;
          if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
          setPct(1);
          setRemainingMs(0);
          setFinishing(true);
          finishTimer.current = setTimeout(() => {
            if (activeRef.current === run) {
              activeRef.current = null;
              setActive(null);
              setFinishing(false);
            }
          }, 450);
        },
      };
    },
    [tick]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (finishTimer.current != null) clearTimeout(finishTimer.current);
    };
  }, []);

  const percent = Math.round(pct * 100);

  return (
    <Ctx.Provider value={{ track }}>
      {children}
      {mounted && active
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Simulation progress"
            >
              <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" />
              <div className="relative w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-2xl">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <div className="text-sm font-semibold text-white">
                    {finishing ? "Wrapping up…" : active.label}
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <span className="text-3xl font-bold tabular-nums text-white">{percent}%</span>
                  <span className="pb-1 text-xs text-muted" aria-live="polite">
                    {formatRemaining(remainingMs, finishing)}
                  </span>
                </div>

                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-panel2">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-150 ease-out"
                    style={{ width: `${Math.max(2, percent)}%` }}
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>

                <p className="mt-3 text-[11px] text-muted">
                  Estimated from your recent runs — actual time may vary.
                </p>
              </div>
            </div>,
            document.body
          )
        : null}
    </Ctx.Provider>
  );
}

export function useProgress(): ProgressCtx {
  const ctx = useContext(Ctx);
  // A no-op fallback keeps callers safe if the provider isn't mounted.
  return ctx ?? { track: () => ({ done: () => {} }) };
}
