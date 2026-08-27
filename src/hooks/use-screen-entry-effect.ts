import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type EffectCallback } from "react";

/**
 * Runs an effect when its screen is entered through the router.
 * Browser focus, reconnects, and local tab changes do not change the route and
 * therefore do not trigger another run.
 */
export function useScreenEntryEffect(onEnter: EffectCallback) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  useEffect(() => onEnterRef.current(), [pathname]);
}