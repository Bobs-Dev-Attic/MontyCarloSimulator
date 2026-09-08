"use client";

import { useEffect, useState } from "react";

// Deliberately OUTSIDE the "mcs." profile namespace so a profile reset/import
// never clears the user's acknowledgement.
const CONSENT_KEY = "mcsConsentAccepted.v1";

export default function ConsentGate() {
  const [mounted, setMounted] = useState(false);
  const [accepted, setAccepted] = useState(true); // assume accepted until we check (avoids SSR flash)
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setAccepted(localStorage.getItem(CONSENT_KEY) === "true");
    } catch {
      setAccepted(false);
    }
  }, []);

  if (!mounted || accepted) return null;

  const accept = () => {
    if (!checked) return;
    try {
      localStorage.setItem(CONSENT_KEY, "true");
    } catch {
      // ignore — still let them in for this session
    }
    setAccepted(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xl">🎲</span>
          <h2 id="consent-title" className="text-lg font-bold text-white">
            Before you start
          </h2>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Monty Carlo Simulator is an <span className="font-semibold text-white">educational
          and entertainment</span> tool. It runs simplified, hypothetical models
          and does <span className="font-semibold text-white">not</span> use your
          real accounts or market data. Nothing here is financial, investment,
          tax, or legal advice.
        </p>
        <p className="mt-2 text-sm text-slate-300">
          Outcomes are illustrative only — do not rely on them for real financial
          decisions. Consult a qualified professional before acting.
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-panel2 p-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#f59e0b]"
          />
          <span className="text-sm text-slate-200">
            I understand this is <span className="font-semibold">not financial advice</span> and is
            for educational / entertainment purposes only.
          </span>
        </label>

        <button
          onClick={accept}
          disabled={!checked}
          className="mt-4 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enter simulator
        </button>
      </div>
    </div>
  );
}
