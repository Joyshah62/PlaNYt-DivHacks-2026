"use client";

import { useEffect, useImperativeHandle, useRef, useState, type ReactElement, type Ref } from "react";
import { MessageCircle, X } from "lucide-react";

/**
 * The trip assistant, waiting in the map's bottom-right corner. It opens on a click, tap or
 * Enter (or through `handle.open()`, from the "Ask the planner" button in the day), and closes
 * with ×, Escape, or a click in the column. Clicks on the map leave it open, so the places it
 * found can be looked at. The chat stays mounted while closed, so the conversation is kept.
 */
export interface AssistantHandle {
  open: () => void;
}

export function Assistant({ children, unread, onOpenChange, handle }: { children: ReactElement; unread: boolean; onOpenChange: (open: boolean) => void; handle: Ref<AssistantHandle> }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  // Where focus goes once the panel has opened or closed: keyboard users stay in the flow.
  const focusNext = useRef<"input" | "launcher" | null>(null);

  const show = () => {
    // Opened on purpose: ready to type.
    focusNext.current = "input";
    setOpen(true);
  };
  /** Close from inside (Escape, ×): focus goes back to the button that opened it. */
  const closeFromInside = () => {
    if (root.current?.contains(document.activeElement)) focusNext.current = "launcher";
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (!root.current?.contains(target) && !target.closest?.(".pl-frame")) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeFromInside();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => {
    onOpenChange(open);
    const next = focusNext.current;
    focusNext.current = null;
    if (next === "input") root.current?.querySelector<HTMLInputElement>(".pl-assist-panel input")?.focus();
    if (next === "launcher") launcher.current?.focus();
  }, [open, onOpenChange]);
  // Opened from elsewhere on the page.
  useImperativeHandle(handle, () => ({ open: show }));

  return (
    <div ref={root} className="pl-assist">
      <div id="trip-assistant" role="dialog" aria-label="Ask the planner" hidden={!open} className="pl-assist-panel">
        <div className="pl-assist-head">
          <span className="pl-mono pl-kicker">Ask the planner</span>
          <button type="button" onClick={closeFromInside} aria-label="Close the assistant" className="pl-icon">
            <X aria-hidden />
          </button>
        </div>
        {children}
      </div>
      {!open && (
        <button
          ref={launcher}
          type="button"
          onClick={show}
          aria-expanded={false}
          aria-controls="trip-assistant"
          className="pl-assist-launch"
        >
          <MessageCircle aria-hidden />
          <span>Ask the planner</span>
          {unread && <i className="pl-assist-dot" aria-label="New reply" />}
        </button>
      )}
    </div>
  );
}
