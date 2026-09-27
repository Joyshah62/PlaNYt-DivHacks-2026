import { describe, expect, it } from "vitest";
import { upcoming } from "./time";

describe("the day to plan", () => {
  it("never plans a past day: a weekday from the week just gone means the coming one", () => {
    expect(upcoming("2026-10-03", "2026-09-27")).toBe("2026-10-03");
    expect(upcoming("2026-09-26", "2026-09-27")).toBe("2026-10-03");
    expect(upcoming("2026-09-27", "2026-09-27")).toBe("2026-09-27");
    expect(upcoming("2026-09-01", "2026-09-27")).toBeNull();
    expect(upcoming("Saturday", "2026-09-27")).toBeNull();
    expect(upcoming(null, "2026-09-27")).toBeNull();
  });
});
