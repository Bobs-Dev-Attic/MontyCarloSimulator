"use client";

import { useCallback } from "react";
import { usePersistentState } from "./persist";

/**
 * A lightweight, per-view run history. Each view records a compact entry when a
 * simulation succeeds — the inputs (so a run can be restored) plus a few
 * headline metrics for display. Stored under `mcs.history.<tab>.v1`, so it lives
 * in the `history` profile category and rides along with export / import.
 */
export interface TabHistoryEntry {
  id: string;
  at: number; // epoch ms
  label: string;
  /** Full input set for this run, so it can be restored. Arbitrary JSON. */
  inputs: Record<string, unknown>;
  /** A few headline results shown as chips. */
  metrics: { label: string; value: string }[];
}

const MAX_ENTRIES = 30;

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface TabHistory {
  entries: TabHistoryEntry[];
  add: (entry: Omit<TabHistoryEntry, "id" | "at">) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export function useTabHistory(tab: string): TabHistory {
  const [entries, setEntries] = usePersistentState<TabHistoryEntry[]>(
    `history.${tab}.v1`,
    []
  );

  const add = useCallback(
    (entry: Omit<TabHistoryEntry, "id" | "at">) => {
      setEntries((prev) =>
        [{ id: uid(), at: Date.now(), ...entry }, ...prev].slice(0, MAX_ENTRIES)
      );
    },
    [setEntries]
  );

  const remove = useCallback(
    (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id)),
    [setEntries]
  );

  const clear = useCallback(() => setEntries([]), [setEntries]);

  return { entries, add, remove, clear };
}
