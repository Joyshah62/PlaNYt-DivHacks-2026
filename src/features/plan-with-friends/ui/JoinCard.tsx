"use client";

import { useState, type SubmitEvent } from "react";
import { Button, Input } from "../bridge/ui";
import { defaultAvatar, type Avatar } from "../core/avatars";
import { AvatarPicker } from "./AvatarPicker";

export function JoinCard({ hostName, onJoin }: { hostName: string; onJoin: (name: string, avatar: Avatar) => void }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<Avatar>(() => defaultAvatar(String(Date.now())));

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (name.trim()) onJoin(name, avatar);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-brand/40 bg-card p-4 shadow-sm">
      <div>
        <p className="text-base font-semibold">{hostName} invited you to plan this day</p>
        <p className="text-xs text-muted-foreground">Pick a look and a name. You&apos;ll suggest places, vote, and decide together. No account needed.</p>
      </div>
      <AvatarPicker value={avatar} onChange={setAvatar} />
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Your name" aria-label="Your name" required />
        <Button type="submit" disabled={!name.trim()}>
          Join
        </Button>
      </div>
    </form>
  );
}
