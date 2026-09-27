import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
const { safeNext } = await import("./session");

describe("where signing in goes next", () => {
  it("keeps a path on this site, with its query", () => {
    expect(safeNext("/plan?q=the%20Met")).toBe("/plan?q=the%20Met");
    expect(safeNext(["/plan?plan=abc"])).toBe("/plan?plan=abc");
  });
  it("never leaves the site", () => {
    for (const next of ["https://evil.example", "//evil.example", "/\\evil.example", undefined, 3]) expect(safeNext(next)).toBe("/plan");
  });
});
