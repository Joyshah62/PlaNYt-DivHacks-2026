import { describe, expect, it } from "vitest";
import { buildReport } from "./analyze";
import {
  ADDRESS,
  NOW,
  classRow,
  empty,
  failed,
  inputs,
  ok,
  problemRow,
  violationRow,
} from "./__fixtures__";

const CURRENT = NOW.getFullYear(); // 2026

describe("availability: missing records versus unavailable data", () => {
  it("reports zero when a violation query succeeds with no rows", () => {
    const report = buildReport(inputs());
    expect(report.snapshot.openClassC).toBe(0);
    expect(report.snapshot.totalOpenViolations).toBe(0);
    expect(report.notAssessed).toHaveLength(0);
  });

  it("reports null, not zero, when the violation query fails", () => {
    const report = buildReport(
      inputs({ violationClasses: failed("violationClasses") }),
    );
    expect(report.snapshot.openClassC).toBeNull();
    expect(report.snapshot.openClassB).toBeNull();
    expect(report.snapshot.totalOpenViolations).toBeNull();
  });

  it("names what could not be assessed for each failed query", () => {
    const violations = buildReport(
      inputs({ violationClasses: failed("violationClasses") }),
    );
    expect(violations.notAssessed.join(" ")).toMatch(/violations listed as open/i);

    const problems = buildReport(
      inputs({ problemCategories: failed("problemCategories") }),
    );
    expect(problems.notAssessed.join(" ")).toMatch(/residents have reported/i);

    const building = buildReport(inputs({ building: failed("building") }));
    expect(building.notAssessed.join(" ")).toMatch(/year built/i);

    const recent = buildReport(inputs({ problemsRecent: failed("problemsRecent") }));
    expect(recent.snapshot.reportedProblemsLast12Months).toBeNull();
    expect(recent.notAssessed.join(" ")).toMatch(/past 12 months/i);
  });

  it("does not claim a most-reported category when problems are unavailable", () => {
    const report = buildReport(
      inputs({ problemCategories: failed("problemCategories") }),
    );
    expect(report.snapshot.mostReportedIssue).toBeNull();
    expect(report.trend.direction).toBeNull();
    expect(report.trend.sentence).toMatch(/unavailable/i);
  });

  it("records per-query status and timing for every query", () => {
    const report = buildReport(inputs({ openViolations: failed("openViolations") }));
    expect(report.queries).toHaveLength(7);
    const failing = report.queries.find((q) => q.name === "openViolations")!;
    expect(failing.ok).toBe(false);
    expect(failing.empty).toBe(false);
    expect(failing.retrievedAt).toBeNull();

    const succeeding = report.queries.find((q) => q.name === "problemCategories")!;
    expect(succeeding.ok).toBe(true);
    expect(succeeding.empty).toBe(true); // succeeded, found nothing
    expect(succeeding.retrievedAt).not.toBeNull();
    expect(succeeding.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("trend: the year in progress is never compared with completed years", () => {
  it("compares the two most recent completed years, not the current one", () => {
    const report = buildReport(
      inputs({
        problemCategories: ok("problemCategories", [
          problemRow("Heating", CURRENT - 2, 40), // 2024
          problemRow("Heating", CURRENT - 1, 60), // 2025
          problemRow("Heating", CURRENT, 5), // 2026, partial
        ]),
      }),
    );

    expect(report.trend.comparison).toEqual({
      earlier: { year: CURRENT - 2, count: 40 },
      later: { year: CURRENT - 1, count: 60 },
    });
    expect(report.trend.yearToDate).toEqual({ year: CURRENT, count: 5 });
    expect(report.trend.direction).toBe("increased");
  });

  it("never turns a partial current year into a decline", () => {
    // The naive reading - 60 last year, 5 so far this year - looks like a crash.
    const report = buildReport(
      inputs({
        problemCategories: ok("problemCategories", [
          problemRow("Heating", CURRENT - 2, 40),
          problemRow("Heating", CURRENT - 1, 60),
          problemRow("Heating", CURRENT, 5),
        ]),
      }),
    );
    expect(report.trend.direction).not.toBe("decreased");
    expect(report.trend.sentence).not.toMatch(/fell|decreas|dropp/i);
    expect(report.trend.sentence).toMatch(/still in progress/i);
  });

  it("marks only the current year as partial", () => {
    const report = buildReport(inputs());
    const partial = report.trend.points.filter((p) => p.partial);
    expect(partial).toHaveLength(1);
    expect(partial[0].year).toBe(CURRENT);
  });

  it("states counts without direction below the volume floor", () => {
    const report = buildReport(
      inputs({
        problemCategories: ok("problemCategories", [
          problemRow("Leaks", CURRENT - 2, 1),
          problemRow("Leaks", CURRENT - 1, 2),
        ]),
      }),
    );
    expect(report.trend.direction).toBeNull();
    expect(report.trend.sentence).not.toMatch(/rose|fell|increas|decreas/i);
    expect(report.trend.sentence).toMatch(/1 problem in 2024 and 2 in 2025/);
  });

  it("still reports direction once volume clears the floor", () => {
    const report = buildReport(
      inputs({
        problemCategories: ok("problemCategories", [
          problemRow("Leaks", CURRENT - 2, 2),
          problemRow("Leaks", CURRENT - 1, 3),
        ]),
      }),
    );
    expect(report.trend.direction).toBe("increased");
  });
});

describe("recurrence: recent repetition versus historical repetition", () => {
  const recent = [
    problemRow("Heating", CURRENT - 3, 5), // 2023
    problemRow("Heating", CURRENT - 1, 4), // 2025
  ];
  const historical = [
    problemRow("Mold", CURRENT - 8, 5),
    problemRow("Mold", CURRENT - 7, 4),
    problemRow("Mold", CURRENT - 6, 6),
  ];

  it("treats two of the last three completed years as repeated recently", () => {
    const report = buildReport(
      inputs({ problemCategories: ok("problemCategories", recent) }),
    );
    const heating = report.issues.find((i) => i.name === "Heating")!;
    expect(heating.repeatedRecently).toBe(true);
    expect(heating.recentYears).toEqual([CURRENT - 3, CURRENT - 1]);
  });

  it("does not treat one recent year as repetition", () => {
    const report = buildReport(
      inputs({
        problemCategories: ok("problemCategories", [
          problemRow("Heating", CURRENT - 1, 9),
        ]),
      }),
    );
    expect(report.issues.find((i) => i.name === "Heating")!.repeatedRecently).toBe(
      false,
    );
  });

  it("keeps old repetition as history rather than a current pattern", () => {
    const report = buildReport(
      inputs({ problemCategories: ok("problemCategories", historical) }),
    );
    const mold = report.issues.find((i) => i.name === "Mold")!;
    expect(mold.repeatedRecently).toBe(false);
    expect(mold.recentYears).toEqual([]);
    expect(mold.historicalYears).toEqual([CURRENT - 8, CURRENT - 7, CURRENT - 6]);
    expect(report.insights.some((i) => i.id === "repeated-mold")).toBe(false);
  });

  it("lists the exact years and never implies continuous problems", () => {
    const report = buildReport(
      inputs({ problemCategories: ok("problemCategories", recent) }),
    );
    const insight = report.insights.find((i) => i.id === "repeated-heating")!;
    expect(insight.finding).toContain(String(CURRENT - 3));
    expect(insight.finding).toContain(String(CURRENT - 1));
    expect(insight.finding).not.toMatch(/for \d+ years|years running|continuous|ongoing/i);
  });
});

describe("insights: ordering, capping, and no manufactured concerns", () => {
  const busy = inputs({
    violationClasses: ok("violationClasses", [
      classRow("C", "Open", 4),
      classRow("B", "Open", 9),
    ]),
    problemCategories: ok("problemCategories", [
      problemRow("Heating", CURRENT - 2, 20),
      problemRow("Heating", CURRENT - 1, 15),
      problemRow("Leaks", CURRENT - 2, 8),
      problemRow("Leaks", CURRENT - 1, 6),
    ]),
  });

  it("orders Class C, then Class B, then repeated categories", () => {
    const report = buildReport(busy);
    expect(report.insights.map((i) => i.id)).toEqual([
      "open-class-c",
      "open-class-b",
      "repeated-heating",
    ]);
    expect(report.insights.map((i) => i.priority)).toEqual([1, 2, 3]);
  });

  it("caps at three findings", () => {
    expect(buildReport(busy).insights.length).toBeLessThanOrEqual(3);
  });

  it("produces the same order on repeated runs", () => {
    const a = buildReport(busy).insights.map((i) => i.id);
    const b = buildReport(busy).insights.map((i) => i.id);
    expect(a).toEqual(b);
  });

  it("breaks ties alphabetically so ordering is stable", () => {
    const tied = inputs({
      problemCategories: ok("problemCategories", [
        problemRow("Pests", CURRENT - 2, 7),
        problemRow("Pests", CURRENT - 1, 7),
        problemRow("Leaks", CURRENT - 2, 7),
        problemRow("Leaks", CURRENT - 1, 7),
      ]),
    });
    expect(buildReport(tied).insights.map((i) => i.id)).toEqual([
      "repeated-leaks",
      "repeated-pests",
    ]);
  });

  it("never lists the same category twice", () => {
    const report = buildReport(busy);
    const ids = report.insights.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not invent findings to reach three", () => {
    const quiet = buildReport(
      inputs({
        violationClasses: ok("violationClasses", [classRow("C", "Open", 1)]),
      }),
    );
    expect(quiet.insights.map((i) => i.id)).toEqual(["open-class-c"]);
  });

  it("shows a neutral summary rather than a concern when records are sparse", () => {
    const report = buildReport(inputs());
    expect(report.insights).toHaveLength(1);
    const summary = report.insights[0];
    expect(summary.id).toBe("record-summary");
    expect(summary.interpretation).toMatch(/not evidence that a building is well maintained/i);
    expect(report.checklist.length).toBeGreaterThan(0);
  });
});

describe("evidence must actually support the finding", () => {
  // The newest open violations are all Class A here, so the unfiltered list
  // cannot evidence the Class C finding - the severity query must supply it.
  const newestAreClassA = [
    violationRow("1", "A", "PAINT WITH LIGHT COLORED PAINT", "2026-06-01T00:00:00.000"),
    violationRow("2", "A", "REPAIR THE BROKEN FLOOR", "2026-05-30T00:00:00.000"),
  ];
  const seriousOnly = [
    violationRow("9", "C", "ABATE THE INFESTATION CONSISTING OF MICE", "2025-01-04T00:00:00.000"),
  ];

  it("cites Class C records even when absent from the newest twelve", () => {
    const report = buildReport(
      inputs({
        violationClasses: ok("violationClasses", [classRow("C", "Open", 3)]),
        openViolations: ok("openViolations", newestAreClassA),
        seriousOpenViolations: ok("seriousOpenViolations", seriousOnly),
      }),
    );
    const insight = report.insights.find((i) => i.id === "open-class-c")!;
    expect(insight.evidence.records).toHaveLength(1);
    expect(insight.evidence.records.every((r) => r.class === "C")).toBe(true);
  });

  it("labels capped record lists with the true total", () => {
    const report = buildReport(
      inputs({
        violationClasses: ok("violationClasses", [classRow("C", "Open", 444)]),
        seriousOpenViolations: ok("seriousOpenViolations", seriousOnly),
      }),
    );
    const insight = report.insights.find((i) => i.id === "open-class-c")!;
    expect(insight.evidence.recordsCappedFrom).toBe(444);
  });

  it("gives every insight an official source link", () => {
    const report = buildReport(
      inputs({
        violationClasses: ok("violationClasses", [classRow("B", "Open", 2)]),
      }),
    );
    for (const insight of report.insights) {
      expect(insight.evidence.links.length).toBeGreaterThan(0);
      expect(insight.evidence.links.some((l) => !l.raw)).toBe(true);
      for (const link of insight.evidence.links) {
        expect(link.url).toMatch(/^https:\/\/data\.cityofnewyork\.us\//);
      }
    }
  });
});

describe("language: reported problems are never described as complaints", () => {
  const report = buildReport(
    inputs({
      violationClasses: ok("violationClasses", [classRow("C", "Open", 2)]),
      problemCategories: ok("problemCategories", [
        problemRow("Heating", CURRENT - 2, 20),
        problemRow("Heating", CURRENT - 1, 15),
      ]),
    }),
  );

  const narrative = [
    report.trend.sentence,
    ...report.insights.flatMap((i) => [
      i.title,
      i.finding,
      i.interpretation,
      i.nextStep,
    ]),
    ...report.checklist.map((c) => c.text),
  ].join(" ");

  it("does not call problem rows complaints, residents, or incidents", () => {
    expect(narrative).not.toMatch(/\bcomplaints?\b/i);
    expect(narrative).not.toMatch(/\bresidents? (reported|filed)\b/i);
    expect(narrative).not.toMatch(/\bincidents?\b/i);
  });

  it("uses 'listed as open' rather than asserting a present-day condition", () => {
    const openFinding = report.insights.find((i) => i.id === "open-class-c")!;
    expect(openFinding.finding).toMatch(/listed as open|as open/i);
    expect(openFinding.interpretation).toMatch(/does not confirm/i);
  });

  it("never claims the building is safe or problem-free", () => {
    expect(narrative).not.toMatch(/\bsafe\b|well[- ]maintained|problem[- ]free|no issues/i);
  });

  it("never publishes a score or rating", () => {
    const serialized = JSON.stringify(report);
    expect(serialized).not.toMatch(/"score"|\/100\b|\brating\b/i);
  });
});

describe("building identity", () => {
  it("title-cases the address rather than shouting it", () => {
    expect(buildReport(inputs()).building.address).toBe("765 Lincoln Avenue");
  });

  it("carries the resolved identifiers through", () => {
    const report = buildReport(inputs());
    expect(report.building.bin).toBe(ADDRESS.bin);
    expect(report.building.bbl).toBe(ADDRESS.bbl);
  });

  it("omits building facts that PLUTO records as zero", () => {
    const report = buildReport(
      inputs({
        building: ok("building", [{ yearbuilt: "0", unitstotal: "0", numfloors: "0" }]),
      }),
    );
    expect(report.building.yearBuilt).toBeNull();
    expect(report.building.units).toBeNull();
    expect(report.building.floors).toBeNull();
  });

  it("has no complaints-per-apartment normalization anywhere", () => {
    const report = buildReport(
      inputs({
        building: ok("building", [{ unitstotal: "48" }]),
        problemsRecent: ok("problemsRecent", [{ n: "96" }]),
      }),
    );
    expect(JSON.stringify(report)).not.toMatch(/per (apartment|unit)/i);
  });
});

describe("empty upstream responses", () => {
  it("distinguishes empty from failed for each query independently", () => {
    const report = buildReport(
      inputs({
        violationCategories: empty("violationCategories"),
        problemCategories: empty("problemCategories"),
        openViolations: empty("openViolations"),
      }),
    );
    expect(report.notAssessed).toHaveLength(0);
    expect(report.issues).toHaveLength(0);
    expect(report.openViolations).toHaveLength(0);
    expect(report.queries.filter((q) => q.ok && q.empty).length).toBeGreaterThan(0);
  });
});
