"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, Loader2, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { formatPhone } from "@/lib/phone";

export interface Account {
  name: string;
  email: string;
  phoneNumber: string | null;
}

/** The signed-in traveler: who they are, their trips and chats, and a way out. */
export function AccountMenu({ account }: { account: Account }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initial = (account.name.trim() || account.email)[0]?.toUpperCase() ?? "?";

  // Opens onto its first item; closes on a click elsewhere or Escape (which hands focus back).
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();

    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
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
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${account.name || account.email}`}
        className="pl-account"
      >
        {initial}
      </button>
      {open && (
        <div ref={menuRef} role="menu" className="pl-account-menu">
          <div className="pl-account-who">
            <p className="pl-account-name">{account.name || "Your account"}</p>
            <p className="pl-small pl-muted">{account.email}</p>
            {account.phoneNumber && <p className="pl-mono pl-muted">{formatPhone(account.phoneNumber)}</p>}
          </div>
          <Link href="/trips" role="menuitem" className="pl-textbtn" onClick={() => setOpen(false)}>
            <History className="size-4" aria-hidden />
            Your trips &amp; chats
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            disabled={leaving}
            className="pl-textbtn"
          >
            {leaving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
