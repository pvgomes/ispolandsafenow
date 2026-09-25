import { describe, expect, it } from "vitest";
import { ALERT_LEVELS, ALERT_LEVEL_PRESENTATION, isAlertLevel, toAlertLevel } from "../../src/domain/alert-level";

describe("alert-level", () => {
  it("recognizes exactly the five documented levels", () => {
    expect(ALERT_LEVELS).toEqual(["CALM", "LOW", "ELEVATED", "CRITICAL", "UNKNOWN"]);
  });

  it("isAlertLevel accepts only the five documented values", () => {
    for (const level of ALERT_LEVELS) {
      expect(isAlertLevel(level)).toBe(true);
    }
    expect(isAlertLevel("green")).toBe(false);
    expect(isAlertLevel("ORANGE")).toBe(false);
    expect(isAlertLevel(null)).toBe(false);
    expect(isAlertLevel(undefined)).toBe(false);
  });

  it("toAlertLevel resolves any missing or invalid value to UNKNOWN, never CALM", () => {
    expect(toAlertLevel(null)).toBe("UNKNOWN");
    expect(toAlertLevel(undefined)).toBe("UNKNOWN");
    expect(toAlertLevel("")).toBe("UNKNOWN");
    expect(toAlertLevel("bogus")).toBe("UNKNOWN");
    expect(toAlertLevel("CALM")).toBe("CALM");
  });

  it("rescales values written on the old three-level scale", () => {
    expect(toAlertLevel("GREEN")).toBe("CALM");
    expect(toAlertLevel("YELLOW")).toBe("LOW");
    // Old RED meant "serious active warning", which is ELEVATED now — red
    // is reserved for a confirmed impact on the ground.
    expect(toAlertLevel("RED")).toBe("ELEVATED");
  });

  it("has presentation metadata for every level", () => {
    for (const level of ALERT_LEVELS) {
      const presentation = ALERT_LEVEL_PRESENTATION[level];
      expect(presentation.label).toBeTruthy();
      expect(presentation.description).toBeTruthy();
    }
  });
});
