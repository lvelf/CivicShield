"use client";

import { useEffect, useState } from "react";
import { readCache, writeCache } from "./cache";

// Stale-while-revalidate backed by localStorage.
//   1. First render uses `fallback` on BOTH server and client — keeps hydration in sync (no mismatch).
//   2. On mount, synchronously paint the last cached value (instant, no network wait).
//   3. In the background run `fetcher()`; when it resolves, update state + rewrite the cache.
// `fetcher` is expected to be a stable module-level function; we intentionally key the effect on
// `key` only so a changing closure identity doesn't retrigger the fetch.
export function useCached<T>(key: string, fetcher: () => Promise<T>, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    let alive = true;
    const cached = readCache<T>(key);
    if (cached !== null) setValue(cached);
    fetcher()
      .then((fresh) => {
        if (!alive) return;
        setValue(fresh);
        writeCache(key, fresh);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return value;
}
