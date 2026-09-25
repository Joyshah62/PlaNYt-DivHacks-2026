import { describe, expect, it } from "vitest";
import {
  complaintCaseExpression,
  classifyComplaint,
  classifyText,
  violationCaseExpression,
} from "./classify";

describe("classification", () => {
  it("folds both of HPD's heating vocabularies into one category", () => {
    // Older records say HEATING, newer ones HEAT/HOT WATER. Matching only one
    // silently halves every heating count in the city.
    expect(classifyComplaint("HEATING", null, "NO HEAT")).toBe("Heating");
    expect(classifyComplaint("HEAT/HOT WATER", null, "NO HEAT")).toBe("Heating");
  });

  it("puts combined heat-and-hot-water reports in Heating, not both", () => {
    expect(classifyComplaint("HEAT/HOT WATER", null, "NO HEAT AND NO HOT WATER")).toBe("Heating");
    expect(classifyComplaint("HEATING", null, "NO HEAT& HOT WATER")).toBe("Heating");
  });

  it("still recognises hot water on its own", () => {
    expect(classifyComplaint("HEAT/HOT WATER", null, "NO HOT WATER")).toBe("Hot Water");
  });

  it("classifies violation text from its legal wording", () => {
    expect(classifyText("ABATE THE INFESTATION CONSISTING OF MICE IN THE ENTIRE APARTMENT")).toBe("Pests");
    expect(classifyText("REPAIR THE LEAKY AND/OR DEFECTIVE FAUCET")).toBe("Leaks");
    expect(classifyText("PAINT WITH LIGHT COLORED PAINT THE EAST WALL")).toBe("Other");
  });

  it("does not let a bare 'rat' substring create pest reports", () => {
    // LIKE has no word boundaries, so "%RAT%" would match SEPARATE.
    expect(classifyText("PROVIDE A SEPARATE ENTRANCE")).toBe("Other");
    expect(violationCaseExpression()).not.toContain("'%RAT%'");
  });

  it("compiles a SoQL case expression covering the same categories", () => {
    const expr = violationCaseExpression();
    for (const category of ["Heating", "Hot Water", "Pests", "Mold", "Leaks", "Electrical"]) {
      expect(expr).toContain(`'${category}'`);
    }
    expect(expr.endsWith("true, 'Other')")).toBe(true);
  });

  it("keeps heating equipment codes in Heating even without a keyword", () => {
    expect(classifyComplaint("HEATING", null, "OTHER")).toBe("Heating");
    expect(classifyComplaint("HEATING", null, "NO OIL TO BURNER")).toBe("Heating");
    // Would otherwise be filed under Leaks by the word "STEAM LEAK".
    expect(classifyComplaint("HEATING", null, "AIR VALVE MISSING OR STEAM LEAK")).toBe("Heating");
  });

  it("strips the ambiguous category labels in the SoQL expression too", () => {
    const expr = complaintCaseExpression();
    expect(expr).toContain("replace(");
    expect(expr).toContain("'HEAT/HOT WATER'");
    // And keeps the same Heating fallback the JS path uses.
    expect(expr).toContain("'Heating', true, 'Other')");
  });

  it("orders the SoQL branches the same way as the JS rules", () => {
    // First match wins in both, so Heating must be tested before Hot Water.
    const expr = complaintCaseExpression();
    expect(expr.indexOf("'Heating'")).toBeLessThan(expr.indexOf("'Hot Water'"));
  });
});
