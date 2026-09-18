#!/usr/bin/env node
// Converts the committed source GeoJSON (see scripts/source-data/) into the
// local SVG used by the interactive map. This is a development-time tool
// only: production never fetches or regenerates map geometry, it just
// serves the committed public/maps/poland-voivodeships.svg file.
//
// Source data: GUGiK PRG (Panstwowy Rejestr Granic), redistributed as
// GeoJSON by ppatrzyk/polska-geojson (MIT). See DATA_SOURCES.md.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(__dirname, "source-data", "wojewodztwa-min.geojson");
const OUTPUT = path.join(__dirname, "..", "src", "assets", "maps", "poland-voivodeships.svg");

/** @type {Record<string, { code: string; slug: string; name: string }>} */
const REGION_BY_POLISH_NAME = {
  "dolnośląskie": { code: "PL-02", slug: "dolnoslaskie", name: "Dolnośląskie" },
  "kujawsko-pomorskie": { code: "PL-04", slug: "kujawsko-pomorskie", name: "Kujawsko-Pomorskie" },
  "lubelskie": { code: "PL-06", slug: "lubelskie", name: "Lubelskie" },
  "lubuskie": { code: "PL-08", slug: "lubuskie", name: "Lubuskie" },
  "łódzkie": { code: "PL-10", slug: "lodzkie", name: "Łódzkie" },
  "małopolskie": { code: "PL-12", slug: "malopolskie", name: "Małopolskie" },
  "mazowieckie": { code: "PL-14", slug: "mazowieckie", name: "Mazowieckie" },
  "opolskie": { code: "PL-16", slug: "opolskie", name: "Opolskie" },
  "podkarpackie": { code: "PL-18", slug: "podkarpackie", name: "Podkarpackie" },
  "podlaskie": { code: "PL-20", slug: "podlaskie", name: "Podlaskie" },
  "pomorskie": { code: "PL-22", slug: "pomorskie", name: "Pomorskie" },
  "śląskie": { code: "PL-24", slug: "slaskie", name: "Śląskie" },
  "świętokrzyskie": { code: "PL-26", slug: "swietokrzyskie", name: "Świętokrzyskie" },
  "warmińsko-mazurskie": { code: "PL-28", slug: "warminsko-mazurskie", name: "Warmińsko-Mazurskie" },
  "wielkopolskie": { code: "PL-30", slug: "wielkopolskie", name: "Wielkopolskie" },
  "zachodniopomorskie": { code: "PL-32", slug: "zachodniopomorskie", name: "Zachodniopomorskie" },
};

const WIDTH = 800;

function project(lonMin, latMax, cosLat, scale) {
  return (lon, lat) => [
    (lon - lonMin) * cosLat * scale,
    (latMax - lat) * scale,
  ];
}

function ringToPath(ring, projectFn) {
  const points = ring.map(([lon, lat]) => projectFn(lon, lat));
  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  return `${d} Z`;
}

function main() {
  const geojson = JSON.parse(readFileSync(SOURCE, "utf-8"));

  let lonMin = Infinity;
  let lonMax = -Infinity;
  let latMin = Infinity;
  let latMax = -Infinity;

  for (const feature of geojson.features) {
    const rings = feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates
      : feature.geometry.coordinates.flat();
    for (const ring of rings) {
      for (const [lon, lat] of ring) {
        if (lon < lonMin) lonMin = lon;
        if (lon > lonMax) lonMax = lon;
        if (lat < latMin) latMin = lat;
        if (lat > latMax) latMax = lat;
      }
    }
  }

  const latMid = (latMin + latMax) / 2;
  const cosLat = Math.cos((latMid * Math.PI) / 180);
  const projWidth = (lonMax - lonMin) * cosLat;
  const scale = WIDTH / projWidth;
  const height = (latMax - latMin) * scale;
  const projectFn = project(lonMin, latMax, cosLat, scale);

  const entries = geojson.features.map((feature) => {
    const region = REGION_BY_POLISH_NAME[feature.properties.nazwa];
    if (!region) {
      throw new Error(`Unmapped region name in source data: ${feature.properties.nazwa}`);
    }
    const rings = feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates
      : feature.geometry.coordinates.flat();
    const d = rings.map((ring) => ringToPath(ring, projectFn)).join(" ");
    return { ...region, d };
  });

  entries.sort((a, b) => a.code.localeCompare(b.code));

  if (entries.length !== 16) {
    throw new Error(`Expected 16 regions, got ${entries.length}`);
  }

  const paths = entries
    .map(
      (e) =>
        `  <path id="${e.slug}" data-code="${e.code}" data-slug="${e.slug}" data-name="${e.name}" d="${e.d}" />`,
    )
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH.toFixed(2)} ${height.toFixed(2)}" role="group">\n${paths}\n</svg>\n`;

  writeFileSync(OUTPUT, svg, "utf-8");
  console.log(`Wrote ${entries.length} region paths to ${path.relative(process.cwd(), OUTPUT)}`);
}

main();
