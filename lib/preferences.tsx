"use client";

import { createContext, useContext, useEffect } from "react";
import { usePersistentState } from "./persist";
import { applyTheme, themeById, type ThemeMode } from "./themes";
import type { SharedKey } from "./broadcast";

export interface ParamPref {
  min: number;
  max: number;
  step: number;
  def: number;
}

/** Built-in ranges/defaults for the configurable shared parameters. */
export const BUILTIN_PARAMS: Record<SharedKey, ParamPref> = {
  beginningValue: { min: 1000, max: 5_000_000, step: 1000, def: 100_000 },
  mu: { min: -0.05, max: 0.2, step: 0.005, def: 0.07 },
  sigma: { min: 0.01, max: 0.6, step: 0.005, def: 0.15 },
  years: { min: 1, max: 50, step: 1, def: 20 },
  nSims: { min: 1000, max: 50_000, step: 1000, def: 10_000 },
};

export const PARAM_LABELS: Record<SharedKey, string> = {
  beginningValue: "Starting amount",
  mu: "Expected return (μ)",
  sigma: "Volatility (σ)",
  years: "Time horizon",
  nSims: "Simulations",
};

/** Which params display as percentages in the editor. */
export const PARAM_IS_PCT: Record<SharedKey, boolean> = {
  beginningValue: false,
  mu: true,
  sigma: true,
  years: false,
  nSims: false,
};

export interface Prefs {
  theme: string;
  params: Partial<Record<SharedKey, ParamPref>>;
  /** Last theme chosen in each mode, so the light/dark toggle can restore it. */
  lastDark?: string;
  lastLight?: string;
}

const DEFAULT_PREFS: Prefs = {
  theme: "amber",
  params: {},
  lastDark: "amber",
  lastLight: "light",
};

interface PrefsCtx {
  prefs: Prefs;
  setTheme: (id: string) => void;
  /** Current theme's mode. */
  mode: ThemeMode;
  /** Flip between light and dark, restoring the last theme used in that mode. */
  toggleMode: () => void;
  setParam: (key: SharedKey, patch: Partial<ParamPref>) => void;
  resetParam: (key: SharedKey) => void;
  resetAll: () => void;
  /** Effective range override for a shared key, or null to use the field's own. */
  rangeFor: (key: SharedKey) => { min: number; max: number; step: number } | null;
  /** Effective default (override or built-in) for a shared key. */
  defaultFor: (key: SharedKey) => number;
}

const Ctx = createContext<PrefsCtx | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = usePersistentState<Prefs>("prefs.v1", DEFAULT_PREFS);

  useEffect(() => {
    applyTheme(prefs.theme);
  }, [prefs.theme]);

  const setTheme = (id: string) =>
    setPrefs((p) => {
      const mode = themeById(id).mode;
      return {
        ...p,
        theme: id,
        ...(mode === "dark" ? { lastDark: id } : { lastLight: id }),
      };
    });

  const mode = themeById(prefs.theme).mode;

  const toggleMode = () =>
    setPrefs((p) => {
      const curMode = themeById(p.theme).mode;
      const next =
        curMode === "dark" ? p.lastLight ?? "light" : p.lastDark ?? "amber";
      const nextMode = themeById(next).mode;
      return {
        ...p,
        theme: next,
        ...(nextMode === "dark" ? { lastDark: next } : { lastLight: next }),
      };
    });
  const setParam = (key: SharedKey, patch: Partial<ParamPref>) =>
    setPrefs((p) => {
      const base = p.params[key] ?? BUILTIN_PARAMS[key];
      return { ...p, params: { ...p.params, [key]: { ...base, ...patch } } };
    });
  const resetParam = (key: SharedKey) =>
    setPrefs((p) => {
      const next = { ...p.params };
      delete next[key];
      return { ...p, params: next };
    });
  const resetAll = () => setPrefs((p) => ({ ...p, params: {} }));

  const rangeFor = (key: SharedKey) => {
    const o = prefs.params[key];
    return o ? { min: o.min, max: o.max, step: o.step } : null;
  };
  const defaultFor = (key: SharedKey) =>
    prefs.params[key]?.def ?? BUILTIN_PARAMS[key].def;

  return (
    <Ctx.Provider value={{ prefs, setTheme, mode, toggleMode, setParam, resetParam, resetAll, rangeFor, defaultFor }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePreferences(): PrefsCtx | null {
  return useContext(Ctx);
}
