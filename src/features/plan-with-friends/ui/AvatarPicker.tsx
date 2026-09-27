"use client";

import { AVATAR_COLORS, AVATAR_EMOJI, AVATAR_HEX, type Avatar } from "../core/avatars";
import { AvatarBubble } from "./Avatar";

export function AvatarPicker({ value, onChange }: { value: Avatar; onChange: (a: Avatar) => void }) {
  return (
    <div className="tr-picker">
      <div className="tr-row">
        <AvatarBubble avatar={value} size="lg" />
        <div role="radiogroup" aria-label="Avatar color" className="tr-swatches">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={value.color === c}
              aria-label={c}
              onClick={() => onChange({ ...value, color: c })}
              className="tr-swatch"
              style={{ background: AVATAR_HEX[c] }}
            />
          ))}
        </div>
      </div>
      <div role="radiogroup" aria-label="Avatar emoji" className="tr-avatars">
        {AVATAR_EMOJI.map((e) => (
          <button key={e} type="button" role="radio" aria-checked={value.emoji === e} aria-label={e} onClick={() => onChange({ ...value, emoji: e })}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
