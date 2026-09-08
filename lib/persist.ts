"use client";

import { useEffect, useRef, useState } from "react";

/**
 * All persisted keys share this prefix so a Profile export can round-trip
 * every app setting in one shot.
 */
export const PERSIST_PREFIX = "mcs.";

/**
 * A drop-in replacement for useState that mirrors its value into localStorage.
 *
 * The initial render always uses `initial` (so server and client markup match —
 * no hydration mismatch); the stored value, if any, is loaded on mount. Writes
 * are debounced to the next tick via an effect. Safe when localStorage is
 * unavailable (private mode, SSR).
 */
export function usePersistentState<T>(
  key: string,
  initial: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const fullKey = key.startsWith(PERSIST_PREFIX) ? key : PERSIST_PREFIX + key;
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);

  // Load once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // ignore
    }
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on change (but not before the initial load has run).
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(fullKey, JSON.stringify(value));
    } catch {
      // ignore (quota / unavailable)
    }
  }, [fullKey, value]);

  return [value, setValue];
}
