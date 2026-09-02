import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type EffectCallback } from "react";

/**
 * Runs an effect once each time its screen is entered through the router:
 * on first mount while active, and again whenever the route becomes active
 * after having been inactive. Browser focus, reconnects, and in-screen tab
 * changes do not change the route and therefore never trigger another run.
 */
export function useScreenEntryEffect(screenPath: string, onEnter: EffectCallback, enabled = true) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;
  const isActive = enabled && pathname === screenPath;
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      // Left the screen (or never on it) — next activation counts as an entry.
      wasActiveRef.current = false;
      return;
    }
    // Already active: a re-render, not a new entry. (Also guards the
    // StrictMode double-effect, since refs persist across it.)
    if (wasActiveRef.current) return;
    wasActiveRef.current = true;
    return onEnterRef.current();
  }, [isActive, screenPath]);
}
