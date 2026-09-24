import type { APIRoute } from "astro";
import { REGIONS } from "../data/regions";
import { MAJOR_CITIES } from "../data/cities";
import { citiesForRegion } from "../domain/city";

export const prerender = false;

export const GET: APIRoute = ({ site }) => {
  const base = site?.toString().replace(/\/$/, "") ?? "";
  const regionLines = REGIONS.map((r) => {
    const cities = citiesForRegion(MAJOR_CITIES, r.slug).map((c) => c.name);
    const cityNote = cities.length > 0 ? ` — main cities: ${cities.join(", ")}` : "";
    return `- [${r.namePl}](${base}/regions/${r.slug})${cityNote}`;
  }).join("\n");

  const body = `# Is Poland Safe Now?

> Independent, AI-assisted tracker of regional security-alert exposure across Poland's 16 voivodeships, covering the Russia-Ukraine war, Belarus border activity, Kaliningrad, airspace violations, drone or missile incidents, RCB warnings, and border/airport/transport disruptions. This is not an official warning system.

Current data mode: live. An hourly scheduled job collects news and calls TypeSafe AI to classify each region — see /methodology.

## Key pages

- [Homepage](${base}/)
- [Related news](${base}/news)
- [Live cameras and news streams](${base}/live)
- [Methodology](${base}/methodology)
- [About](${base}/about)

## Questions this site answers

- Is Poland safe to visit right now? — the homepage shows the current status of all 16 voivodeships, refreshed hourly.
- Is it safe to travel to Poland because of Russia or the war in Ukraine? — Poland is a NATO/EU member and is not at war; effects are regional (airspace incidents, border activity, transport disruption) and tracked per voivodeship.
- Is Poland at war? — no; there is no armed conflict on Polish territory.
- Is it safe to travel to a specific Polish city (Warsaw, Kraków, Gdańsk, Wrocław, Zakopane, ...)? — use the region list below to map the city to its voivodeship page.
- Is it safe to fly to Poland right now? — airports normally operate as usual, but eastern airspace has been closed temporarily during past incidents.
- How often is the status updated? — every hour, from public news reporting; see /methodology.

## Public API

- [GET /api/health](${base}/api/health) — service and database health
- [GET /api/status](${base}/api/status) — national status summary
- [GET /api/regions](${base}/api/regions) — per-region status list, including each region's capital and major cities

## Regions

Each voivodeship is listed with its best-known cities so a city name (e.g. Kraków, Gdańsk, Zakopane) can be mapped to the right regional status.

${regionLines}
`;

  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
