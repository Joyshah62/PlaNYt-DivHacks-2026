import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongo", () => ({ hasMongo: () => false, getDb: vi.fn() }));
const { POST } = await import("./route");
const { encodePlan } = await import("@/lib/plan/share");
const { DEFAULT_PROFILE } = await import("@/lib/plan/profile");

const code = encodePlan({ stops: [], date: "2026-10-03", startMin: 600, endMin: 1260, mode: "transit", crowd: "avoid", origin: null, returnToOrigin: false, profile: DEFAULT_PROFILE, meals: { lunch: false, dinner: false } });
const ask = (body: unknown, auth?: string) =>
  POST(new Request("http://x/api/plan/short", { method: "POST", headers: { "content-type": "application/json", ...(auth && { authorization: auth }) }, body: JSON.stringify(body) }));

describe("POST /api/plan/short", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("shortens a plan for the bot, and only for the bot when the bridge token is set", async () => {
    vi.stubEnv("PHONE_BRIDGE_TOKEN", "secret");
    expect((await ask({ code })).status).toBe(401);
    const res = await ask({ code }, "Bearer secret");
    expect(res.status).toBe(200);
    expect((await res.json()).id).toMatch(/^[\w-]{8}$/);
  });

  it("refuses what isn't a plan", async () => {
    vi.stubEnv("PHONE_BRIDGE_TOKEN", "");
    expect((await ask({ code: "junk" })).status).toBe(400);
    expect((await ask({ code: "a".repeat(4001) })).status).toBe(400);
  });
});
