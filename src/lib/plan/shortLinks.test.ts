import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongo", () => ({ hasMongo: () => false, getDb: vi.fn() }));
const { readShortLink, saveShortLink, shortId } = await import("./shortLinks");

describe("short plan links", () => {
  it("gives the same day the same short id, and reads it back", async () => {
    const code = "eyJ2IjoxLCJzIjpbWyJtZXQiXV0sImQiOiIyMDI2LTEwLTAzIn0";
    const id = await saveShortLink(code);
    expect(id).toMatch(/^[\w-]{8}$/);
    expect(shortId(code)).toBe(id);
    expect(await readShortLink(id)).toBe(code);
  });

  it("ignores ids that aren't ours", async () => {
    expect(await readShortLink("../../etc")).toBeNull();
    expect(await readShortLink("zzzzzzzz")).toBeNull();
  });
});
