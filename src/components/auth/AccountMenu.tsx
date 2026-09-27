"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Smartphone } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { formatPhone } from "@/lib/phone";

export interface Account {
  name: string;
  email: string;
  phoneNumber: string | null;
}

/** The signed-in traveler: who they are, and a way out. */
export function AccountMenu({ account }: { account: Account }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const initial = (account.name.trim() || account.email)[0]?.toUpperCase() ?? "?";

  // Closes on a click elsewhere or Escape, like any menu.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function signOut() {
    setLeaving(true);
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${account.name || account.email}`}
        className="grid size-8 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand ring-offset-2 ring-offset-background transition hover:ring-2 hover:ring-brand/40 aria-expanded:ring-2 aria-expanded:ring-brand"
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="animate-rise absolute top-full right-0 z-50 mt-2 w-64 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-[0_24px_60px_-24px_oklch(0_0_0/0.45)]">
          <div className="px-3 pt-2 pb-3">
            <p className="truncate text-sm font-semibold">{account.name || "Your account"}</p>
            <p className="truncate text-xs text-muted-foreground">{account.email}</p>
            {account.phoneNumber && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Smartphone className="size-3" aria-hidden /> {formatPhone(account.phoneNumber)}
              </p>
            )}
          </div>
          <div className="h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            disabled={leaving}
            className="mt-1.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition hover:bg-muted disabled:opacity-60"
          >
            {leaving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4 text-muted-foreground" aria-hidden />}
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
