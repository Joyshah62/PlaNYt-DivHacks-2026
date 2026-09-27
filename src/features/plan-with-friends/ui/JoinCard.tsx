"use client";

import { useState, type SubmitEvent } from "react";
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
    <form onSubmit={submit} className="ed-card tr-join">
      <div>
        <p className="ed-h3">{hostName} invited you to plan this day</p>
        <p className="ed-small ed-muted tr-lede">
          {accountName ? `Pick a look and join as ${accountName}.` : "Pick a look and a name."} You&apos;ll suggest places, vote, and decide together.
        </p>
      </div>
      <AvatarPicker value={avatar} onChange={setAvatar} />
      <div className="tr-join-row">
        {!accountName && (
          <div className="ed-field">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder="Your name"
              aria-label="Your name"
              required
            />
          </div>
        )}
        <button type="submit" disabled={!name.trim()} className="ed-btn">
          {accountName ? `Join as ${accountName}` : "Join"}
        </button>
      </div>
    </form>
  );
}
