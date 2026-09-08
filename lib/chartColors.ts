"use client";

import { useEffect, useState } from "react";
import { usePreferences } from "@/lib/preferences";

/**
 * Theme-aware colors for Recharts. SVG presentation attributes (stroke/fill on
 * axes, grids, reference lines) don't resolve CSS `var()`, so we read the
 * computed theme variables at runtime and hand concrete `rgb(...)` strings to
 * the charts. Recomputed whenever the active theme changes.
 */
export interface ChartColors {
  grid: string;
  axis: string;
  muted: string;
  text: string;
  tooltipBg: string;
  tooltipBorder: string;
}

const FALLBACK: ChartColors = {
  grid: "rgb(30 42 68)",
  axis: "rgb(142 161 192)",
  muted: "rgb(142 161 192)",
  text: "rgb(230 237 247)",
  tooltipBg: "rgb(14 22 38)",
  tooltipBorder: "rgb(30 42 68)",
};

function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `rgb(${v})` : fallback;
}

function compute(): ChartColors {
  return {
    grid: readVar("--line", FALLBACK.grid),
    axis: readVar("--muted", FALLBACK.axis),
    muted: readVar("--muted", FALLBACK.muted),
    text: readVar("--text", FALLBACK.text),
    tooltipBg: readVar("--panel2", FALLBACK.tooltipBg),
    tooltipBorder: readVar("--line", FALLBACK.tooltipBorder),
  };
}

export function useChartColors(): ChartColors {
  const prefs = usePreferences();
  const themeId = prefs?.prefs.theme ?? "amber";
  const [colors, setColors] = useState<ChartColors>(FALLBACK);

  useEffect(() => {
    // Read after the theme variables have been applied to the document for
    // this frame (the preferences provider sets them in its own effect).
    const id = requestAnimationFrame(() => setColors(compute()));
    return () => cancelAnimationFrame(id);
  }, [themeId]);

  return colors;
}
