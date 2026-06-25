import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Incremental render helper for long mobile lists. Returns the count of items
 * to render and a ref to attach to a sentinel element near the end of the list;
 * when the sentinel scrolls into view the count grows by `step` until it hits
 * `total`. Resets to `pageSize` when `total` changes (e.g. filter applied).
 */
export function useInfiniteVisible(total: number, pageSize = 10, step = 10) {
  const [count, setCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset when the underlying dataset size changes (search/filter).
  useEffect(() => { setCount(pageSize); }, [total, pageSize]);

  const setSentinel = useCallback((node: HTMLDivElement | null) => {
    sentinelRef.current = node;
  }, []);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || count >= total) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setCount((c) => Math.min(c + step, total));
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [count, total, step]);

  return { count: Math.min(count, total), setSentinel, hasMore: count < total };
}