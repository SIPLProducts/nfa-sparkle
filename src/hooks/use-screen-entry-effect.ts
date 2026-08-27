import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type EffectCallback } from "react";

type ScreenEntryWindow = Window & { __nfaScreenEntries?: Map<string, number> };

function getScreenEntries() {
  const target = window as ScreenEntryWindow;
  target.__nfaScreenEntries ??= new Map<string, number>();
  return target.__nfaScreenEntries;
}

/**
 * Runs an effect when its screen is entered through the router.
 * Browser focus, reconnects, and local tab changes do not change the route and
 * therefore do not trigger another run.
 */
export function useScreenEntryEffect(screenPath: string, onEnter: EffectCallback) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;
  const isActive = pathname === screenPath;

  useEffect(() => {
    if (!isActive) return;
    const entries = getScreenEntries();
    const now = Date.now();
    const lastEntry = entries.get(screenPath) ?? 0;
    if (now - lastEntry < 500) return;
    entries.set(screenPath, now);
    return onEnterRef.current();
  }, [isActive, screenPath]);
}