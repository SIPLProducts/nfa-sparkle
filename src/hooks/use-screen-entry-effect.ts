import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type EffectCallback } from "react";

const enteredPaths = new Set<string>();

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
    if (!isActive) {
      enteredPaths.delete(screenPath);
      return;
    }
    if (enteredPaths.has(screenPath)) return;
    enteredPaths.add(screenPath);
    return onEnterRef.current();
  }, [isActive, screenPath]);
}