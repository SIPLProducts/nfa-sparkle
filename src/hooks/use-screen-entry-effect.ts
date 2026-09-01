import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type EffectCallback } from "react";

/** In-memory de-dupe markers — nothing is written to browser storage. */
const lastEntryAt = new Map<string, number>();

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
    const lastEntry = lastEntryAt.get(screenPath) ?? 0;
    if (now - lastEntry < 500) return;
    lastEntryAt.set(screenPath, now);
    return onEnterRef.current();
  }, [isActive, screenPath]);
}
