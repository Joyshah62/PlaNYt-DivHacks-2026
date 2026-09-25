import { describe, expect, it } from "vitest";
import { exploreIssues } from "./explorer";
import type { BuildingReport } from "./types";

function report(available = true): BuildingReport {
  return {
    generatedAt: "2026-09-20T12:00:00Z",
    queries: [{ name: "problemCategories", ok: available }],
    issues: [{ name: "Heating", byYear: [{ year: 2018, count: 20 }, { year: 2023, count: 2 }, { year: 2025, count: 3 }, { year: 2026, count: 1 }] }],
  } as BuildingReport;
}

describe("problem explorer evidence", () => {
  it("distinguishes unavailable data from no reported problems across every category", () => {
    expect(exploreIssues(report(false), 4).every((i) => i.total === null && i.points.every((p) => p.count === null))).toBe(true);
    expect(exploreIssues(report(), 4).find((i) => i.category === "Pests")?.status).toBe("No reports in this period");
  });
  it("counts only the selected window and exposes zeros for missing years", () => {
    const recent = exploreIssues(report(), 4)[0];
    expect(recent.category).toBe("Heating");
    expect(recent.total).toBe(6);
    expect(recent.points.find((p) => p.year === 2024)?.count).toBe(0);
    expect(exploreIssues(report(), 10)[0].total).toBe(26);
  });
  it("does not use the incomplete year to establish completed-year repetition", () => {
    const input = report();
    input.issues[0].byYear = [{ year: 2025, count: 10 }, { year: 2026, count: 1 }];
    expect(exploreIssues(input, 4)[0].status).toBe("Reported this year");
  });
  it("keeps old reports out of recent status", () => {
    const input = report();
    input.issues[0].byYear = [{ year: 2018, count: 20 }];
    expect(exploreIssues(input, 4).find((i) => i.category === "Heating")?.total).toBe(0);
    expect(exploreIssues(input, 10)[0].status).toBe("Last reported 2018");
  });
});
