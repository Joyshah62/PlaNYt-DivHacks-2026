import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

// The quota reads its caps at import and keeps its counts in ./.data: run it in a scratch directory.
let quota: typeof import("./quota");
beforeAll(async () => {
  process.chdir(await mkdtemp(path.join(tmpdir(), "roam-quota-")));
  vi.stubEnv("GOOGLE_SEARCH_MONTHLY_CAP", "3");
  vi.stubEnv("GOOGLE_SEARCH_DAILY_CAP", "2");
  vi.stubEnv("GOOGLE_PHOTOS_MONTHLY_CAP", "5");
  quota = await import("./quota");
});

describe("Google quota", () => {
  it("refuses once a SKU's daily cap is used, without touching the other SKU", async () => {
    expect(await quota.reserve("search")).toBe(true);
    expect(await quota.reserve("search")).toBe(true);
    expect(await quota.reserve("search")).toBe(false);
    expect(await quota.reserve("photos")).toBe(true);
  });

  it("gives back calls Google refused outright", async () => {
    quota.release("search");
    expect(await quota.reserve("search")).toBe(true);
    const report = await quota.usageReport();
    expect(report.find((r) => r.sku === "search")?.used).toEqual({ month: 2, day: 2 });
  });
});
