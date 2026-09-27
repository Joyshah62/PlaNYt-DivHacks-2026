import { describe, expect, it } from "vitest";
import { guestIdentity, type IdentityProvider } from "../identity";
import { memberIdFor, resolveMember } from "./member";

const req = new Request("http://test/api");
const signedIn: IdentityProvider = {
  current: async () => ({ userId: "user_2Ab!c@d", name: "Khyati Amin", photoUrl: null }),
  loginUrl: (returnTo) => `/login?next=${encodeURIComponent(returnTo)}`,
};

describe("resolveMember", () => {
  it("uses the member id from the request for guests", async () => {
    expect(await resolveMember(req, "guest-12345", guestIdentity)).toEqual({ memberId: "guest-12345", user: null });
  });

  it("prefers the signed-in user over whatever the request says", async () => {
    const r = await resolveMember(req, "someone-else1", signedIn);
    expect(r.memberId).toBe(memberIdFor("user_2Ab!c@d"));
    expect(r.user?.name).toBe("Khyati Amin");
  });

  it("makes a stable, URL-safe member id from any user id", () => {
    expect(memberIdFor("user_2Ab!c@d")).toBe("u_user_2Abcd");
    expect(memberIdFor("x".repeat(80))).toHaveLength(40);
  });
});
