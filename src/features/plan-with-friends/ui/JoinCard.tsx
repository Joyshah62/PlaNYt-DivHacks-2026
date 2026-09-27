"use client";

import { useState, type SubmitEvent } from "react";
import { Button, Input } from "../bridge/ui";
import { defaultAvatar, type Avatar } from "../core/avatars";
import { AvatarPicker } from "./AvatarPicker";

export function JoinCard({ hostName, accountName = null, onJoin }: {
  hostName: string;
  /** Signed in: they join as their account, so there's no name to type. */
  accountName?: string | null;
  onJoin: (name: string, avatar: Avatar) => void;
}) {
  const [name, setName] = useState(accountName ?? "");
  const [avatar, setAvatar] = useState<Avatar>(() => defaultAvatar(String(Date.now())));

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (name.trim()) onJoin(name, avatar);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-brand/40 bg-card p-4 shadow-sm">
      <div>
        <p className="text-base font-semibold">{hostName} invited you to plan this day</p>
        <p className="text-xs text-muted-foreground">
          {accountName ? `Pick a look and join as ${accountName}.` : "Pick a look and a name."} You&apos;ll suggest places, vote, and decide together.
        </p>
      </div>
      <AvatarPicker value={avatar} onChange={setAvatar} />
      <div className="flex gap-2">
        {!accountName && <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Your name" aria-label="Your name" required />}
        <Button type="submit" disabled={!name.trim()} className={accountName ? "w-full" : undefined}>
          {accountName ? `Join as ${accountName}` : "Join"}
        </Button>
      </div>
    </form>
  );
}
