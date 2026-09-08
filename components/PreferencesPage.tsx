"use client";

import { useState } from "react";
import {
  usePreferences,
  BUILTIN_PARAMS,
  PARAM_LABELS,
  PARAM_IS_PCT,
  type ParamPref,
} from "@/lib/preferences";
import { THEMES } from "@/lib/themes";
import { useBroadcast, type SharedKey } from "@/lib/broadcast";
import { clearAllSettings } from "@/lib/profile";
import ProfileDialog from "@/components/ProfileDialog";
import RealToggle from "@/components/RealToggle";

const KEYS: SharedKey[] = ["beginningValue", "mu", "sigma", "years", "nSims"];

function NumBox({
  value,
  onChange,
  pct,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  pct: boolean;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={pct ? Number((value * 100).toFixed(2)) : value}
      step={pct ? 0.5 : step}
      onChange={(e) => {
        const raw = parseFloat(e.target.value);
        if (!Number.isFinite(raw)) return;
        onChange(pct ? raw / 100 : raw);
      }}
      className="w-20 rounded border border-line bg-panel2 px-1.5 py-1 text-right text-xs tabular-nums text-slate-100 focus:border-accent focus:outline-none"
    />
  );
}

export default function PreferencesPage() {
  const prefs = usePreferences();
  const bc = useBroadcast();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"export" | "import" | null>(null);

  if (!prefs) return null;

  const eff = (k: SharedKey): ParamPref => prefs.prefs.params[k] ?? BUILTIN_PARAMS[k];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Color theme */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Color theme</h2>
          <button
            onClick={prefs.toggleMode}
            className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-slate-200 transition hover:bg-panel2"
            title="Toggle light / dark"
          >
            {prefs.mode === "dark" ? "Switch to light" : "Switch to dark"}
          </button>
        </div>
        <p className="mb-4 text-xs text-muted">
          Applies instantly across the app and is saved with your profile. Use the
          sun / moon toggle in the menu for a quick light / dark switch.
        </p>
        {(["dark", "light"] as const).map((m) => (
          <div key={m} className="mb-4 last:mb-0">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {m === "dark" ? "Dark themes" : "Light themes"}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {THEMES.filter((t) => t.mode === m).map((t) => (
                <button
                  key={t.id}
                  onClick={() => prefs.setTheme(t.id)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    prefs.prefs.theme === t.id ? "border-accent bg-accent/10" : "border-line hover:bg-panel2"
                  }`}
                >
                  <span className="flex -space-x-1">
                    <span className="h-5 w-5 rounded-full border border-ink" style={{ background: t.swatch[0] }} />
                    <span className="h-5 w-5 rounded-full border border-ink" style={{ background: t.swatch[1] }} />
                  </span>
                  <span className="text-sm text-slate-200">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Display options */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="mb-1 text-sm font-semibold text-white">Display options</h2>
        <p className="mb-4 text-xs text-muted">
          Show results in nominal dollars or in today&apos;s purchasing power
          (inflation-adjusted). This applies across every view and is saved with
          your profile.
        </p>
        <RealToggle />
      </section>

      {/* Parameter ranges & defaults */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Parameter ranges &amp; defaults</h2>
          <button onClick={prefs.resetAll} className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-muted transition hover:text-slate-200">
            Reset all
          </button>
        </div>
        <p className="mb-4 text-xs text-muted">
          Customize the slider range (min / max / step) for shared inputs, and set the default values you prefer.
          Ranges apply everywhere those inputs appear.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="pb-2 font-medium">Parameter</th>
                <th className="pb-2 text-right font-medium">Min</th>
                <th className="pb-2 text-right font-medium">Max</th>
                <th className="pb-2 text-right font-medium">Step</th>
                <th className="pb-2 text-right font-medium">Default</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {KEYS.map((k) => {
                const p = eff(k);
                const pct = PARAM_IS_PCT[k];
                const customized = Boolean(prefs.prefs.params[k]);
                return (
                  <tr key={k} className="border-t border-line/50">
                    <td className="py-2 text-slate-200">
                      {PARAM_LABELS[k]} {pct ? <span className="text-[10px] text-muted">(%)</span> : null}
                    </td>
                    <td className="py-2 text-right"><NumBox value={p.min} pct={pct} onChange={(v) => prefs.setParam(k, { min: v })} /></td>
                    <td className="py-2 text-right"><NumBox value={p.max} pct={pct} onChange={(v) => prefs.setParam(k, { max: v })} /></td>
                    <td className="py-2 text-right"><NumBox value={p.step} pct={pct} onChange={(v) => prefs.setParam(k, { step: v })} /></td>
                    <td className="py-2 text-right"><NumBox value={p.def} pct={pct} onChange={(v) => prefs.setParam(k, { def: v })} /></td>
                    <td className="py-2 text-right">
                      {customized ? (
                        <button onClick={() => prefs.resetParam(k)} className="text-[11px] text-muted hover:text-bad" title="Reset to built-in">reset</button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <button
            onClick={() => {
              KEYS.forEach((k) => bc?.applyAll(k, prefs.defaultFor(k)));
              setMsg("Applied your default values to all tabs.");
              setErr(null);
              setTimeout(() => setMsg(null), 3000);
            }}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-110"
          >
            Apply my defaults to all tabs
          </button>
        </div>
      </section>

      {/* Data: export / import */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="mb-1 text-sm font-semibold text-white">Export &amp; import</h2>
        <p className="mb-4 text-xs text-muted">
          A profile file stores your settings (any of: all tabs, preferences, theme, and your simulation history) as
          JSON — back it up or move it to another device. Export lets you choose exactly what to include; import
          examines the file for validity and lets you pick which categories to bring in. (Simulation history can also be
          exported as CSV from the Portfolio / Retirement results.)
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setDialog("export")} className="rounded-lg border border-line px-3 py-1.5 text-sm text-slate-200 transition hover:bg-panel2">
            Export profile…
          </button>
          <button onClick={() => setDialog("import")} className="rounded-lg border border-line px-3 py-1.5 text-sm text-slate-200 transition hover:bg-panel2">
            Import profile…
          </button>
          <button
            onClick={() => {
              clearAllSettings();
              setMsg("All settings cleared — reloading…");
              setErr(null);
              setTimeout(() => window.location.reload(), 500);
            }}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition hover:text-bad"
          >
            Reset all settings
          </button>
        </div>
        {msg ? <p className="mt-3 text-xs text-good">{msg}</p> : null}
        {err ? <p className="mt-3 text-xs text-bad">{err}</p> : null}
      </section>

      {dialog ? <ProfileDialog mode={dialog} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
