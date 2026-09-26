import { describe, expect, it } from "vitest";
import { googleHours, parseOsmHours } from "./hours";

describe("opening hours", () => {
  it("reads common OpenStreetMap shapes", () => {
    expect(parseOsmHours("24/7")?.[3]).toEqual([0, 1440]);
    expect(parseOsmHours("Mo-Su 11:00-22:00")?.[0]).toEqual([660, 1320]);
    const week = parseOsmHours("Mo-Fr 08:00-18:00; Sa 09:00-17:00; Su off")!;
    expect(week[1]).toEqual([480, 1080]);
    expect(week[6]).toEqual([540, 1020]);
    expect(week[0]).toBeNull();
  });

  it("spans split shifts and runs past midnight", () => {
    expect(parseOsmHours("Tu-Su 11:30-15:00,17:00-22:00")?.[2]).toEqual([690, 1320]);
    expect(parseOsmHours("Fr,Sa 18:00-02:00")?.[5]).toEqual([1080, 1560]);
  });

  it("returns null rather than guessing", () => {
    expect(parseOsmHours("Mo-Fr 09:00-17:00; PH off")).toBeNull();
    expect(parseOsmHours("sunrise-sunset")).toBeNull();
    expect(parseOsmHours("")).toBeNull();
  });

  it("folds Google periods into a window a day", () => {
    const week = googleHours([
      { open: { day: 5, hour: 17 }, close: { day: 6, hour: 1 } },
      { open: { day: 1, hour: 11, minute: 30 }, close: { day: 1, hour: 15 } },
      { open: { day: 1, hour: 17 }, close: { day: 1, hour: 22 } },
    ])!;
    expect(week[5]).toEqual([1020, 1500]);
    expect(week[1]).toEqual([690, 1320]);
    expect(week[0]).toBeNull();
  });
});
