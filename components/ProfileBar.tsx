"use client";

import { useRef, useState } from "react";
import { downloadProfile, applyProfile, clearAllSettings } from "@/lib/profile";

export default function ProfileBar() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const flash = (m: string) => {
    setErr(null);
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  };

  const onImport = async (file: File) => {
    setMsg(null);
    setErr(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const n = applyProfile(parsed);
      // Reload so every tab re-initializes from the restored settings.
      setMsg(`Imported ${n} settings — reloading…`);
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not import that file.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted">Profile</span>
      <button
        onClick={() => downloadProfile()}
        className="rounded-lg border border-line bg-panel px-2.5 py-1 text-[11px] text-slate-200 transition hover:bg-panel2"
        title="Download all your settings as a JSON file"
      >
        Export
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        className="rounded-lg border border-line bg-panel px-2.5 py-1 text-[11px] text-slate-200 transition hover:bg-panel2"
        title="Load settings from a profile file"
      >
        Import
      </button>
      <button
        onClick={() => {
          clearAllSettings();
          flash("Cleared — reloading…");
          setTimeout(() => window.location.reload(), 500);
        }}
        className="rounded-lg border border-line bg-panel px-2.5 py-1 text-[11px] text-muted transition hover:text-bad"
        title="Reset all settings to defaults"
      >
        Reset
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImport(f);
          e.target.value = "";
        }}
      />
      {msg ? <span className="text-[11px] text-good">{msg}</span> : null}
      {err ? <span className="text-[11px] text-bad">{err}</span> : null}
    </div>
  );
}
