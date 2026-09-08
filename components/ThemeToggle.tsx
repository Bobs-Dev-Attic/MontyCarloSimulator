"use client";

import { usePreferences } from "@/lib/preferences";

/** A compact light/dark switch for the header. */
export default function ThemeToggle() {
  const prefs = usePreferences();
  if (!prefs) return null;
  const isDark = prefs.mode === "dark";

  return (
    <button
      onClick={prefs.toggleMode}
      role="switch"
      aria-checked={!isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 text-slate-200 transition hover:bg-panel2"
    >
      {isDark ? (
        // Moon
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M17 11.5A7 7 0 0 1 8.5 3a7 7 0 1 0 8.5 8.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // Sun
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M15.8 4.2l-1.4 1.4M5.6 14.4l-1.4 1.4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}
      <span className="text-xs font-semibold">{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}
