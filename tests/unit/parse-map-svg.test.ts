import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseMapSvg, projectPoint } from "../../src/domain/parse-map-svg";

const svgPath = path.resolve(__dirname, "../../src/assets/maps/poland-voivodeships.svg");
const svgSource = readFileSync(svgPath, "utf-8");

describe("parseMapSvg", () => {
  it("finds exactly 16 region paths", () => {
    const { paths } = parseMapSvg(svgSource);
    expect(paths).toHaveLength(16);
  });

  it("gives every path a non-empty code, slug, name, and geometry", () => {
    const { paths } = parseMapSvg(svgSource);
    for (const p of paths) {
      expect(p.code).toMatch(/^PL-\d{2}$/);
      expect(p.slug.length).toBeGreaterThan(0);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.d.startsWith("M")).toBe(true);
    }
  });

  it("has no duplicate slugs or codes", () => {
    const { paths } = parseMapSvg(svgSource);
    expect(new Set(paths.map((p) => p.slug)).size).toBe(16);
    expect(new Set(paths.map((p) => p.code)).size).toBe(16);
  });

  it("exposes a valid viewBox", () => {
    const { viewBox } = parseMapSvg(svgSource);
    const parts = viewBox.split(" ").map(Number);
    expect(parts).toHaveLength(4);
    expect(parts.every((n) => Number.isFinite(n))).toBe(true);
  });

  it("exposes the projection constants written by scripts/convert-map.mjs", () => {
    const { projection } = parseMapSvg(svgSource);
    expect(projection.lonMin).toBeCloseTo(14.12, 1);
    expect(projection.latMax).toBeCloseTo(54.84, 1);
    expect(projection.cosLat).toBeGreaterThan(0.5);
    expect(projection.scale).toBeGreaterThan(0);
  });

  it("rejects an SVG without projection metadata", () => {
    expect(() => parseMapSvg('<svg viewBox="0 0 1 1"></svg>')).toThrow(/data-lon-min/);
  });
});

describe("projectPoint", () => {
  it("places Warsaw inside the viewBox, to the east and south of the north-west corner", () => {
    const { projection, viewBox } = parseMapSvg(svgSource);
    const [, , width, height] = viewBox.split(" ").map(Number);
    const warsaw = projectPoint(projection, 52.23, 21.01);
    expect(warsaw.x).toBeGreaterThan(width! / 2);
    expect(warsaw.x).toBeLessThan(width!);
    expect(warsaw.y).toBeGreaterThan(0);
    expect(warsaw.y).toBeLessThan(height! / 2);
  });

  it("maps the projection origin to (0, 0)", () => {
    const { projection } = parseMapSvg(svgSource);
    expect(projectPoint(projection, projection.latMax, projection.lonMin)).toEqual({ x: 0, y: 0 });
  });
});
