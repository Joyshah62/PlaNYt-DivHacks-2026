import { describe, expect, it, vi } from "vitest";

import { secureLinkedAccount } from "./authLinking";

function adapter(user: { emailVerified?: boolean } | null, accounts: { id: string; providerId: string }[]) {
  return {
    findUserById: vi.fn(async () => user),
    findAccounts: vi.fn(async () => accounts),
    deleteAccount: vi.fn(async () => {}),
    deleteUserSessions: vi.fn(async () => {}),
  };
}

describe("linking Google to an existing account", () => {
  it("drops an unverified password and signs out other sessions: whoever set it may not own the email", async () => {
    const a = adapter({ emailVerified: false }, [{ id: "pw", providerId: "credential" }, { id: "g", providerId: "google" }]);
    await secureLinkedAccount("u1", a);
    expect(a.deleteAccount).toHaveBeenCalledWith("pw");
    expect(a.deleteAccount).toHaveBeenCalledTimes(1);
    expect(a.deleteUserSessions).toHaveBeenCalledWith("u1");
  });

  it("leaves a verified account, or a new Google-only one, alone", async () => {
    const verified = adapter({ emailVerified: true }, [{ id: "pw", providerId: "credential" }]);
    await secureLinkedAccount("u2", verified);
    const fresh = adapter({ emailVerified: false }, [{ id: "g", providerId: "google" }]);
    await secureLinkedAccount("u3", fresh);
    expect(verified.deleteAccount).not.toHaveBeenCalled();
    expect(fresh.deleteAccount).not.toHaveBeenCalled();
    expect(fresh.deleteUserSessions).not.toHaveBeenCalled();
  });
});
