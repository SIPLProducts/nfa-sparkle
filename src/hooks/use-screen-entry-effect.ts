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

  useEffect(() => {
    if (!isActive) return;
    // React Strict Mode replays effects in development. Running the callback
    // again after its cleanup is required: the first request is aborted by
    // that cleanup, and the replay becomes the single live request.
    return onEnterRef.current();
  }, [isActive, screenPath]);
}
