export const AVATAR_EMOJI = [
  "🦊", "🐙", "🌸", "🐼", "🦄", "🐸", "🦁", "🐧",
  "🍕", "🌮", "🍩", "🍜", "🎧", "🎨", "📸", "🚲",
  "🛹", "⚡", "🌙", "🌈", "🔥", "💎", "🎈", "🪩",
] as const;

export const AVATAR_COLORS = ["blue", "orange", "violet", "green", "pink", "teal", "yellow", "red"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const AVATAR_HEX: Record<AvatarColor, string> = {
  blue: "#6d8dff",
  orange: "#f0a44b",
  violet: "#b57bff",
  green: "#4fc28a",
  pink: "#f27ab5",
  teal: "#3fc1c9",
  yellow: "#e8c547",
  red: "#ef6a5b",
};

export interface Avatar {
  emoji: string;
  color: AvatarColor;
}

export function isAvatar(v: unknown): v is Avatar {
  if (!v || typeof v !== "object") return false;
  const { emoji, color } = v as Partial<Avatar>;
  return (AVATAR_EMOJI as readonly string[]).includes(emoji as string) && (AVATAR_COLORS as readonly string[]).includes(color as string);
}

export function defaultAvatar(seed: string): Avatar {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { emoji: AVATAR_EMOJI[h % AVATAR_EMOJI.length], color: AVATAR_COLORS[(h >>> 5) % AVATAR_COLORS.length] };
}
