import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, PhoneSchema } from "./phone";

describe("phone numbers", () => {
  it("stores US and international numbers in E.164", () => {
    expect(normalizePhone("(212) 555-0123")).toBe("+12125550123");
    expect(normalizePhone("1-212-555-0123")).toBe("+12125550123");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
  });
  it("turns away what isn't a phone number", () => {
    for (const bad of ["", "555-0123", "me@example.com", "call me", "+1 23"]) expect(normalizePhone(bad)).toBeNull();
  });
  it("validates for sign-up with a message for the traveler", () => {
    expect(PhoneSchema.parse("212.555.0123")).toBe("+12125550123");
    expect(PhoneSchema.safeParse("12345").error?.issues[0].message).toMatch(/valid phone number/);
  });
  it("reads a US number back the familiar way", () => {
    expect(formatPhone("+12125550123")).toBe("(212) 555-0123");
    expect(formatPhone("+442079460958")).toBe("+442079460958");
  });
});
