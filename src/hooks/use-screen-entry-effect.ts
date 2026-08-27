import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type EffectCallback } from "react";

const ENTRY_PREFIX = "screen-entry:";

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
    const now = Date.now();
    const key = ENTRY_PREFIX + screenPath;
    const lastEntry = Number(window.sessionStorage.getItem(key) ?? 0);
    if (now - lastEntry < 500) return;
    window.sessionStorage.setItem(key, String(now));
    return onEnterRef.current();
  }, [isActive, screenPath]);
}