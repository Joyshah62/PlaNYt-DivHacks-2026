"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

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

  function toggle() {
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
    notifyThemeListeners();
  }

  if (!mounted) {
    return (
      <div
        className={`neo-control grid size-10 place-items-center rounded-xl opacity-60 ${className}`}
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
      className={`neo-control grid size-10 place-items-center rounded-xl transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${className}`}
    >
      {dark ? (
        <Sun className="size-4.5 text-amber-400 transition-transform duration-300 hover:rotate-45" aria-hidden />
      ) : (
        <Moon className="size-4.5 text-slate-700 transition-transform duration-300 hover:-rotate-12" aria-hidden />
      )}
    </button>
  );
}
