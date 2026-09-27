import { afterEach, describe, expect, it, vi } from "vitest";
import { googlePhone } from "./googlePhone";

const answer = (body: unknown, status = 200) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the phone number on a Google profile", () => {
  it("prefers the primary number, in E.164", async () => {
    answer({ phoneNumbers: [{ value: "020 7946 0958" }, { value: "(212) 555-0123", canonicalForm: "+12125550123", metadata: { primary: true } }] });
    expect(await googlePhone("token")).toBe("+12125550123");
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ headers: { authorization: "Bearer token" } });
  });
  it("is null when the profile has none, or Google says no", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    answer({});
    expect(await googlePhone("token")).toBeNull();
    answer({ error: { message: "People API has not been used in project" } }, 403);
    expect(await googlePhone("token")).toBeNull();
  });
});
