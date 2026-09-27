"use client";

import { cn } from "../bridge/ui";
import { AVATAR_COLORS, AVATAR_EMOJI, AVATAR_HEX, type Avatar } from "../core/avatars";
import { AvatarBubble } from "./Avatar";

export function AvatarPicker({ value, onChange }: { value: Avatar; onChange: (a: Avatar) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <AvatarBubble avatar={value} size="lg" />
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Avatar color">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={value.color === c}
              aria-label={c}
              onClick={() => onChange({ ...value, color: c })}
              className={cn("size-6 rounded-full border-2 transition", value.color === c ? "scale-110 border-foreground" : "border-transparent hover:scale-105")}
              style={{ background: AVATAR_HEX[c] }}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-8 gap-1" role="radiogroup" aria-label="Avatar emoji">
        {AVATAR_EMOJI.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={value.emoji === e}
            aria-label={e}
            onClick={() => onChange({ ...value, emoji: e })}
            className={cn("grid aspect-square place-items-center rounded-lg text-lg transition", value.emoji === e ? "bg-brand-soft ring-2 ring-brand" : "hover:bg-muted")}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
