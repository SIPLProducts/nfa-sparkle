import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type EffectCallback } from "react";

type ScreenEntryWindow = Window & { __nfaEnteredPaths?: Set<string> };

function getEnteredPaths() {
  const target = window as ScreenEntryWindow;
  target.__nfaEnteredPaths ??= new Set<string>();
  return target.__nfaEnteredPaths;
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
    const enteredPaths = getEnteredPaths();
    if (!isActive) {
      enteredPaths.delete(screenPath);
      return;
    }
    if (enteredPaths.has(screenPath)) return;
    enteredPaths.add(screenPath);
    return onEnterRef.current();
  }, [isActive, screenPath]);
}