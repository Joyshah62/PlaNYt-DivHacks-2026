"use client";

import { useState } from "react";
import { Check, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "roam.phone";

function readHandle(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** "Text it to me": the plan goes to iMessage, where it can be changed by text and nudges come on the day. */
export function PhoneSend({ planCode }: { planCode: string }) {
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
      <Button
        size="sm"
        variant="outline"
        aria-expanded={open}
        onClick={() => {
          if (!open && !handle) setHandle(readHandle());
          setOpen((v) => !v);
        }}
        className="rounded-full"
      >
        <Smartphone aria-hidden /> Text to my phone
      </Button>
      {open && (
        <div className="basis-full rounded-2xl border border-border bg-card p-3">
          {sentTo ? (
            <p className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              <span>
                Sent to {sentTo}. Check Messages: reply there to change your day, and on the day you&apos;ll get a text when it&apos;s time to head to each stop.
              </span>
            </p>
          ) : (
            <form
              className="flex gap-2"
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
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <Button type="submit" disabled={busy || handle.trim().length < 3} className="rounded-xl bg-brand text-on-color hover:bg-brand/90">
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : "Send"}
              </Button>
            </form>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-sev-c">
              {error}
            </p>
          )}
          {!sentTo && <p className="mt-2 text-[11px] text-muted-foreground">Sent by iMessage. Reply STOP any time to pause updates.</p>}
        </div>
      )}
    </>
  );
}
