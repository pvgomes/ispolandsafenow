import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseMapSvg } from "../../src/domain/parse-map-svg";
import { REGIONS } from "../../src/data/regions";

const svgPath = path.resolve(__dirname, "../../src/assets/maps/poland-voivodeships.svg");
const svgSource = readFileSync(svgPath, "utf-8");

const seedSqlPath = path.resolve(__dirname, "../../migrations/0002_seed_regions.sql");
const seedSql = readFileSync(seedSqlPath, "utf-8");

function extractSeedSlugs(sql: string): string[] {
  // Each seed row looks like: ('PL-02', 'dolnoslaskie', 'Dolnośląskie', ...)
  const rowPattern = /\('(PL-\d{2})',\s*'([a-z-]+)'/g;
  return [...sql.matchAll(rowPattern)].map((m) => m[2] ?? "");
}

describe("region identity data stays in sync across the map SVG, the TS constant, and the D1 seed", () => {
  const svgSlugs = new Set(parseMapSvg(svgSource).paths.map((p) => p.slug));
  const constantSlugs = new Set(REGIONS.map((r) => r.slug));
  const seedSlugs = new Set(extractSeedSlugs(seedSql));

  it("every source lists exactly 16 regions", () => {
    expect(svgSlugs.size).toBe(16);
    expect(constantSlugs.size).toBe(16);
    expect(seedSlugs.size).toBe(16);
  });

  it("the SVG map, the REGIONS constant, and the D1 seed agree on every slug", () => {
    expect(svgSlugs).toEqual(constantSlugs);
    expect(seedSlugs).toEqual(constantSlugs);
  });
});
