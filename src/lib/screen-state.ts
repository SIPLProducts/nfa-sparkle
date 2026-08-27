import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Screen-level state that survives route unmounts (navigating away and back)
 * and a browser refresh within the same tab session.
 *
 * Backed by a module-level Map for instant restore plus sessionStorage so a
 * reload keeps the screen as the user left it. Only store serialisable UI
 * state here (tabs, filters, search text, selection, cached rows) — never
 * dialog open flags or functions.
 */
const memory = new Map<string, unknown>();

const PREFIX = "screen-state:";

function readInitial<T>(key: string, initial: T): T {
  if (memory.has(key)) return memory.get(key) as T;
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(PREFIX + key);
      if (raw != null) {
        const parsed = JSON.parse(raw) as T;
        memory.set(key, parsed);
        return parsed;
      }
    } catch {
      /* ignore malformed cache */
    }
  }
  return initial;
}

function persist(key: string, value: unknown) {
  memory.set(key, value);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota or non-serialisable — memory cache still holds it */
  }
}

/**
 * Memory-only screen state: survives navigating between screens, but never a
 * hard refresh, a new tab, or a fresh login. Use for fetched data (rows,
 * last-fetched timestamps) so reloading always re-fetches from the source.
 */
export function useScreenMemory<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => (memory.has(key) ? (memory.get(key) as T) : initial));
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    setValue(memory.has(key) ? (memory.get(key) as T) : initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      memory.set(keyRef.current, resolved);
      return resolved;
    });
  }, []);

  return [value, set] as const;
}

export function useScreenState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readInitial(key, initial));
  const keyRef = useRef(key);
  keyRef.current = key;

  // Restore when the key changes (e.g. per-user scoped keys).
  useEffect(() => {
    setValue(readInitial(key, initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      persist(keyRef.current, resolved);
      return resolved;
    });
  }, []);

  return [value, set] as const;
}

/** Clears every cached screen state (used on sign-out). */
export function clearScreenState() {
  memory.clear();
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
