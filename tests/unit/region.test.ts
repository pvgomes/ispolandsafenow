import { describe, expect, it } from "vitest";
import { englishAlias, resolveEffectiveStatus } from "../../src/domain/region";

describe("resolveEffectiveStatus", () => {
  it("resolves to UNKNOWN when never classified", () => {
    const status = resolveEffectiveStatus({
      currentStatus: "CALM",
      lastClassifiedAt: null,
      statusReason: null,
      statusDriver: null,
    });
    expect(status).toBe("UNKNOWN");
  });

  it("keeps an old classification, because statuses do not expire", () => {
    const status = resolveEffectiveStatus({
      currentStatus: "ELEVATED",
      lastClassifiedAt: "2020-01-01T00:00:00.000Z",
      statusReason: "Drone, missile or airspace activity was reported in or near this region.",
      statusDriver: "AIRSPACE_INCIDENT",
    });
    expect(status).toBe("ELEVATED");
  });

  it("returns the stored status once classified", () => {
    const status = resolveEffectiveStatus({
      currentStatus: "LOW",
      lastClassifiedAt: "2020-01-01T00:00:00.000Z",
      statusReason: null,
      statusDriver: null,
    });
    expect(status).toBe("LOW");
  });
});

describe("englishAlias", () => {
  it("returns the bracketed English exonym", () => {
    expect(englishAlias({ namePl: "Mazowieckie", nameEn: "Mazowieckie (Masovia)" })).toBe("Masovia");
    expect(englishAlias({ namePl: "Dolnośląskie", nameEn: "Dolnoslaskie (Lower Silesia)" })).toBe("Lower Silesia");
  });

  it("returns undefined when the English name only transliterates the Polish one", () => {
    expect(englishAlias({ namePl: "Podlaskie", nameEn: "Podlaskie" })).toBeUndefined();
    expect(englishAlias({ namePl: "Łódzkie", nameEn: "Lodzkie" })).toBeUndefined();
    expect(englishAlias({ namePl: "Warmińsko-Mazurskie", nameEn: "Warminsko-Mazurskie" })).toBeUndefined();
  });
});
