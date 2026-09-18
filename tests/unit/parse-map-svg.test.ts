import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseMapSvg } from "../../src/domain/parse-map-svg";

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
});
