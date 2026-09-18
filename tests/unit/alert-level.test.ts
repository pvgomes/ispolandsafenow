import { describe, expect, it } from "vitest";
import { ALERT_LEVELS, ALERT_LEVEL_PRESENTATION, isAlertLevel, toAlertLevel } from "../../src/domain/alert-level";

describe("alert-level", () => {
  it("recognizes exactly the four documented levels", () => {
    expect(ALERT_LEVELS).toEqual(["GREEN", "YELLOW", "RED", "UNKNOWN"]);
  });

  it("isAlertLevel accepts only the four documented values", () => {
    for (const level of ALERT_LEVELS) {
      expect(isAlertLevel(level)).toBe(true);
    }
    expect(isAlertLevel("green")).toBe(false);
    expect(isAlertLevel("ORANGE")).toBe(false);
    expect(isAlertLevel(null)).toBe(false);
    expect(isAlertLevel(undefined)).toBe(false);
  });

  it("toAlertLevel resolves any missing or invalid value to UNKNOWN, never GREEN", () => {
    expect(toAlertLevel(null)).toBe("UNKNOWN");
    expect(toAlertLevel(undefined)).toBe("UNKNOWN");
    expect(toAlertLevel("")).toBe("UNKNOWN");
    expect(toAlertLevel("bogus")).toBe("UNKNOWN");
    expect(toAlertLevel("GREEN")).toBe("GREEN");
  });

  it("has presentation metadata for every level", () => {
    for (const level of ALERT_LEVELS) {
      const presentation = ALERT_LEVEL_PRESENTATION[level];
      expect(presentation.label).toBeTruthy();
      expect(presentation.description).toBeTruthy();
    }
  });
});
