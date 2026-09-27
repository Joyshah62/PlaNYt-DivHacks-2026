"use client";

import { useSyncExternalStore, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "@phosphor-icons/react";

const themeListeners = new Set<() => void>();

function notifyThemeListeners() {
  for (const listener of themeListeners) {
    listener();
  }
}

function subscribeTheme(callback: () => void) {
  themeListeners.add(callback);
  if (typeof window === "undefined") {
    return () => {
      themeListeners.delete(callback);
    };
  }
  const observer = new MutationObserver(() => callback());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", callback);
  return () => {
    themeListeners.delete(callback);
    observer.disconnect();
    mql.removeEventListener("change", callback);
  };
}

function getThemeSnapshot() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

function getServerThemeSnapshot() {
  return false;
}

const subscribeMounted = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const mounted = useSyncExternalStore(subscribeMounted, getMountedSnapshot, getServerMountedSnapshot);
  const dark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  function applyTheme() {
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      localStorage.setItem("roam_theme", "light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
      localStorage.setItem("roam_theme", "dark");
    }
    flushSync(notifyThemeListeners); // the new icon must be in the "after" snapshot
  }

  // The new theme spreads out as a circle from the button (View Transitions). Browsers
  // without it, and reduced motion, switch instantly.
  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const html = document.documentElement;
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyTheme();
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2, y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    // Colour transitions would still be mid-way when the "after" snapshot is taken.
    html.classList.add("theme-switching");
    const transition = document.startViewTransition(applyTheme);
    transition.ready.then(() =>
      html.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 750, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" },
      ),
    );
    transition.finished.finally(() => html.classList.remove("theme-switching"));
  }

  if (!mounted) {
    return (
      <div
        className={`grid size-10 place-items-center opacity-60 ${className}`}
        aria-hidden
      >
        <span className="size-4.5" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={`grid size-10 cursor-pointer place-items-center transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${className}`}
    >
      {dark ? (
        <Sun weight="duotone" className="size-4.5 text-amber-400 transition-transform duration-300 hover:rotate-45" aria-hidden />
      ) : (
        <Moon weight="duotone" className="size-4.5 text-slate-700 transition-transform duration-300 hover:-rotate-12" aria-hidden />
      )}
    </button>
  );
}
