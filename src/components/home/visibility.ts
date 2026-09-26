"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

/** Whether `ref` intersects the viewport (grown by `rootMargin`). With `once`, it latches true. */
export function useInView(ref: RefObject<Element | null>, { rootMargin = "0px", once = false }: { rootMargin?: string; once?: boolean } = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (once && entry.isIntersecting) io.disconnect();
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, once]);
  return inView;
}

const onVisibility = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};
export const usePageVisible = () =>
  useSyncExternalStore(onVisibility, () => document.visibilityState === "visible", () => true);

const REDUCE = "(prefers-reduced-motion: reduce)";
const onReduce = (cb: () => void) => {
  const mql = matchMedia(REDUCE);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
};
export const usePrefersReducedMotion = () =>
  useSyncExternalStore(onReduce, () => matchMedia(REDUCE).matches, () => false);
