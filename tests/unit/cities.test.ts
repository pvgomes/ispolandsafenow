import { describe, expect, it } from "vitest";
import { MAJOR_CITIES } from "../../src/data/cities";
import { REGIONS } from "../../src/data/regions";
import {
  capitalOfRegion,
  citiesForRegion,
  cityMatchesQuery,
  formatCityList,
  normalizeForSearch,
} from "../../src/domain/city";

const regionSlugs = new Set(REGIONS.map((r) => r.slug));

describe("MAJOR_CITIES dataset", () => {
  it("only references real region slugs", () => {
    for (const city of MAJOR_CITIES) {
      expect(regionSlugs.has(city.regionSlug), `${city.name} -> ${city.regionSlug}`).toBe(true);
    }
  });

  it("gives every one of the 16 regions exactly one capital, and it is always drawn on the map", () => {
    for (const slug of regionSlugs) {
      const capitals = MAJOR_CITIES.filter((c) => c.regionSlug === slug && c.isCapital);
      expect(capitals, slug).toHaveLength(1);
      expect(capitals[0]?.mapVisibility).toBe("always");
    }
  });

  it("has no duplicate city names", () => {
    const names = MAJOR_CITIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("keeps every coordinate inside Poland's bounding box", () => {
    for (const city of MAJOR_CITIES) {
      expect(city.lat, city.name).toBeGreaterThan(49);
      expect(city.lat, city.name).toBeLessThan(54.9);
      expect(city.lon, city.name).toBeGreaterThan(14.1);
      expect(city.lon, city.name).toBeLessThan(24.2);
    }
  });

  it("includes the cities foreign visitors most commonly ask about", () => {
    const names = new Set(MAJOR_CITIES.map((c) => c.name));
    for (const expected of ["Warsaw", "Kraków", "Gdańsk", "Wrocław", "Poznań", "Zakopane", "Łódź"]) {
      expect(names.has(expected), expected).toBe(true);
    }
  });
});

describe("city helpers", () => {
  it("normalizes Polish diacritics, including the stroked Ł", () => {
    expect(normalizeForSearch("Kraków")).toBe("krakow");
    expect(normalizeForSearch("Łódź")).toBe("lodz");
    expect(normalizeForSearch("  Gdańsk ")).toBe("gdansk");
  });

  it("matches by prefix, ignoring case and diacritics, and via aliases", () => {
    const krakow = MAJOR_CITIES.find((c) => c.name === "Kraków")!;
    expect(cityMatchesQuery(krakow, "krak")).toBe(true);
    expect(cityMatchesQuery(krakow, "KRAKÓW")).toBe(true);
    expect(cityMatchesQuery(krakow, "Cracow")).toBe(true);
    expect(cityMatchesQuery(krakow, "gda")).toBe(false);
    expect(cityMatchesQuery(krakow, "")).toBe(false);
    expect(cityMatchesQuery(krakow, "   ")).toBe(false);
  });

  it("lists a region's cities with the capital first and formats them for display", () => {
    const cities = citiesForRegion(MAJOR_CITIES, "malopolskie");
    expect(cities[0]?.name).toBe("Kraków");
    expect(capitalOfRegion(MAJOR_CITIES, "malopolskie")?.name).toBe("Kraków");
    expect(formatCityList(cities)).toMatch(/^Kraków \(capital\), /);
    expect(formatCityList(cities)).toContain("Zakopane");
  });

  it("returns an empty list for an unknown region", () => {
    expect(citiesForRegion(MAJOR_CITIES, "nowhere")).toEqual([]);
    expect(capitalOfRegion(MAJOR_CITIES, "nowhere")).toBeUndefined();
  });
});
