"use client";

import { useState } from "react";
import { clearAllSettings } from "@/lib/profile";
import ProfileDialog from "@/components/ProfileDialog";

export default function ProfileBar() {
  const [dialog, setDialog] = useState<"export" | "import" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted">Profile</span>
      <button
        onClick={() => setDialog("export")}
        className="rounded-lg border border-line bg-panel px-2.5 py-1 text-[11px] text-slate-200 transition hover:bg-panel2"
        title="Choose which settings to export as a JSON file"
      >
        Export
      </button>
      <button
        onClick={() => setDialog("import")}
        className="rounded-lg border border-line bg-panel px-2.5 py-1 text-[11px] text-slate-200 transition hover:bg-panel2"
        title="Load settings from a profile file"
      >
        Import
      </button>
      <button
        onClick={() => {
          clearAllSettings();
          setMsg("Cleared — reloading…");
          setTimeout(() => window.location.reload(), 500);
        }}
        className="rounded-lg border border-line bg-panel px-2.5 py-1 text-[11px] text-muted transition hover:text-bad"
        title="Reset all settings to defaults"
      >
        Reset
      </button>
      {msg ? <span className="text-[11px] text-good">{msg}</span> : null}
      {dialog ? <ProfileDialog mode={dialog} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
