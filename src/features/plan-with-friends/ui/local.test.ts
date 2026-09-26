import { afterEach, describe, expect, it, vi } from "vitest";
import { clearIdentity, parseIdentity, readIdentityRaw, storeIdentity } from "./local";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("trip identity", () => {
  it("round-trips through localStorage", () => {
    vi.stubGlobal("localStorage", fakeStorage());
    vi.stubGlobal("window", { dispatchEvent: () => true });
    expect(storeIdentity("abcdefghij", { memberId: "m1234567", organizerKey: "k".repeat(32) })).toBe(true);
    expect(parseIdentity(readIdentityRaw("abcdefghij"))).toEqual({ memberId: "m1234567", organizerKey: "k".repeat(32) });
    clearIdentity("abcdefghij");
    expect(readIdentityRaw("abcdefghij")).toBe("");
  });

  it("treats garbage as no identity", () => {
    expect(parseIdentity("")).toBeNull();
    expect(parseIdentity("{not json")).toBeNull();
    expect(parseIdentity(JSON.stringify({ memberId: 5 }))).toBeNull();
  });

  it("survives storage that throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readIdentityRaw("abcdefghij")).toBe("");
    expect(storeIdentity("abcdefghij", { memberId: "m1234567" })).toBe(false);
  });
});
