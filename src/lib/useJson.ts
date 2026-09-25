"use client";

import { useCallback, useEffect, useState } from "react";

export type Fetched<T> =
  | { status: "idle" | "loading"; data: null; error: null }
  | { status: "ok"; data: T; error: null }
  | { status: "error"; data: null; error: { error: string; hint?: string; status: number } };

/**
 * One independent request per report section, so each renders the moment its
 * own data lands and fails without taking its neighbors down. A null url waits.
 */
export function useJson<T>(url: string | null): Fetched<T> & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string | null; value: Fetched<T> }>({
    key: null,
    value: { status: "idle", data: null, error: null },
  });
  const key = url ? `${url}#${attempt}` : null;

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        const body = await res.json();
        if (cancelled) return;
        setState({
          key,
          value: res.ok
            ? { status: "ok", data: body as T, error: null }
            : { status: "error", data: null, error: { ...body, status: res.status } },
        });
      } catch {
        if (!cancelled) {
          setState({
            key,
            value: { status: "error", data: null, error: { error: "Couldn't reach the server.", status: 0 } },
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, key]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  // A result for an older url or attempt is stale: show loading until ours lands.
  const value: Fetched<T> =
    !url
      ? { status: "idle", data: null, error: null }
      : state.key === key
        ? state.value
        : { status: "loading", data: null, error: null };
  return { ...value, retry };
}
