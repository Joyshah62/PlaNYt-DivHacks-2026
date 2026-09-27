"use client";

import { useState } from "react";
import { Check, Loader2, Smartphone } from "lucide-react";
import { formatPhone } from "@/lib/phone";

const STORAGE_KEY = "roam.phone";

function readHandle(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** "Text it to me": the plan goes to iMessage, where it can be changed by text and nudges come on the day. */
export function PhoneSend({ planCode, defaultHandle = null }: { planCode: string; /** The account's number, used until they text a different one. */ defaultHandle?: string | null }) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/phone", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handle, plan: planCode }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't send the text.");
      setSentTo(handle.trim());
      try {
        window.localStorage.setItem(STORAGE_KEY, handle.trim());
      } catch {
        // Remembering the number is a convenience; sending worked either way.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the text.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (!open && !handle) setHandle(readHandle() || (defaultHandle ? formatPhone(defaultHandle) : ""));
          setOpen((v) => !v);
        }}
        className="pl-textbtn"
      >
        <Smartphone aria-hidden /> Text to my phone
      </button>
      {open && (
        <div className="pl-phone-form">
          {sentTo ? (
            <p className="pl-phone-success">
              <Check aria-hidden />
              <span>
                Sent to {sentTo}. Check Messages: reply there to change your day, and on the day you&apos;ll get a text when it&apos;s time to head to each stop.
              </span>
            </p>
          ) : (
            <form
              className="pl-phone-fields"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                value={handle}
                onChange={(e) => {
                  setHandle(e.target.value);
                  setError(null);
                }}
                type="text"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Phone number or Apple ID email"
                aria-label="Phone number or Apple ID email"
                className="pl-phone-input"
              />
              <button type="submit" disabled={busy || handle.trim().length < 3} className="ed-btn ed-btn--ghost">
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : "Send"}
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="pl-flag mt-2">
              {error}
            </p>
          )}
          {!sentTo && <p className="pl-fine">Sent by iMessage. Reply STOP any time to pause updates.</p>}
        </div>
      )}
    </>
  );
}
