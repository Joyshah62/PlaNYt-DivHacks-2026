import type { KeyboardEvent } from "react";

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Arrow keys, Home and End move between the items of a tab list, radio group or menu (the
 * ARIA pattern: one Tab stop for the group, arrows inside it). `select` also picks the item
 * reached, as tabs and radios do; a menu only moves focus.
 */
export function arrowKeys(e: KeyboardEvent<HTMLElement>, items: string, select = true) {
  if (!(e.key in STEP) && e.key !== "Home" && e.key !== "End") return;
  const list = [...e.currentTarget.querySelectorAll<HTMLElement>(items)].filter((el) => !(el as HTMLButtonElement).disabled);
  const i = list.indexOf(document.activeElement as HTMLElement);
  if (i === -1) return;
  e.preventDefault();
  const next = list[e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : (i + STEP[e.key] + list.length) % list.length];
  next.focus();
  if (select) next.click();
}
