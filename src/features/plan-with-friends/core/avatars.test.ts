import { describe, expect, it } from "vitest";
import { AVATAR_COLORS, AVATAR_EMOJI, defaultAvatar, isAvatar } from "./avatars";

describe("avatars", () => {
  it("accepts an emoji and color from the lists", () => {
    expect(isAvatar({ emoji: AVATAR_EMOJI[0], color: AVATAR_COLORS[0] })).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isAvatar({ emoji: "💀", color: "blue" })).toBe(false);
    expect(isAvatar({ emoji: AVATAR_EMOJI[0], color: "chartreuse" })).toBe(false);
    expect(isAvatar({ emoji: AVATAR_EMOJI[0] })).toBe(false);
    expect(isAvatar("🦊")).toBe(false);
    expect(isAvatar(null)).toBe(false);
  });

  it("gives the same valid default avatar for the same seed", () => {
    const a = defaultAvatar("member-123");
    expect(isAvatar(a)).toBe(true);
    expect(defaultAvatar("member-123")).toEqual(a);
  });
});
