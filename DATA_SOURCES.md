# Data sources

## Voivodeship boundaries (the interactive map)

**Source:** [`ppatrzyk/polska-geojson`](https://github.com/ppatrzyk/polska-geojson) —
`wojewodztwa/wojewodztwa-min.geojson`.

**License of that repository:** MIT.

**Underlying geodata:** the repository states that its boundary data is
converted from shapefiles derived from the *Państwowy Rejestr Granic i
Powierzchni Jednostek Podziałów Terytorialnych Kraju* (PRG) — Poland's
official State Register of Borders, maintained by *Główny Urząd Geodezji i
Kartografii* (GUGiK, the Head Office of Geodesy and Cartography). PRG data
is published as open public-sector information under Polish law.

**What we did with it:**

1. Downloaded `wojewodztwa-min.geojson` (16 `Polygon` features, one per
   voivodeship, each carrying a Polish name in `properties.nazwa`).
2. Committed the source file unmodified at
   `scripts/source-data/wojewodztwa-min.geojson`.
3. Wrote `scripts/convert-map.mjs`, a small, deterministic Node script that:
   - projects the WGS84 coordinates to a flat SVG viewBox using an
     equirectangular projection scaled by `cos(mean latitude)` (accurate
     enough at Poland's latitude and small east–west extent to render
     correctly without a full map-projection library),
   - maps each feature's Polish name to our canonical region record (ISO
     3166-2:PL code, English-compatible slug, Polish name), and
   - writes one `<path>` per region to `src/assets/maps/poland-voivodeships.svg`,
     each carrying `data-code`, `data-slug`, and `data-name` attributes,
     and writes the projection constants (`data-lon-min`, `data-lat-max`,
     `data-cos-lat`, `data-scale`) onto the `<svg>` root so point features
     can be placed at runtime with the same projection.
4. Committed the generated SVG. **Production never re-fetches or
   regenerates this file** — `npm run map:convert` is a development-time
   tool only, run again solely if the source data needs to be refreshed.

## City markers and search (`src/data/cities.ts`)

The "Find your city" search and the city labels on the map use a small,
hand-maintained list of the best-known cities in each voivodeship
(capital first). Coordinates are approximate city-centre WGS84 positions
from general reference knowledge — accurate to well under a kilometre,
which is far finer than a country-scale map can show. They are projected
at render time with the constants embedded in the SVG, so they always line
up with the boundaries.

**Attribution:** boundary geometry © GUGiK (Główny Urząd Geodezji i
Kartografii), redistributed as GeoJSON by `ppatrzyk/polska-geojson` (MIT
license).

**Why not Leaflet/Mapbox/Google Maps/external tiles:** the brief requires a
Poland-only map with no neighboring countries and no external tile
requests at runtime. A single local, pre-built SVG satisfies this exactly,
with no map-library runtime dependency, no API keys, and no network calls
from the browser.

## Region identity data (`src/data/regions.ts`, `migrations/0002_seed_regions.sql`)

Voivodeship names, ISO 3166-2:PL codes, and slugs are well-established public
facts (Poland's 16 administrative regions), hand-transcribed once and kept
in sync across three places — the SVG map, the `REGIONS` TypeScript
constant, and the D1 seed migration — which
`tests/unit/region-consistency.test.ts` checks automatically.

## Regional classifications (live)

Alert-level classifications come from TypeSafe AI's System One API,
called by `TypeSafeAiClassificationService`
(`src/domain/typesafe-ai-classification-service.ts`), using the last
48 hours of the stored news feed as evidence.

## News feed (live)

Headlines are collected from Google News RSS search
(`src/domain/news-collection.ts`) by `scripts/fetch-news.ts`, which runs in
GitHub Actions every two hours (and on each deploy) and stores the
results in the `news_items` D1 table — title, source outlet, publication
time and the Google News link, deduplicated by link. Queries cover Poland
and the Russia–Ukraine war as it touches Poland: airspace and drone
incidents, the Belarus border, Kaliningrad, RCB alerts, NATO's eastern
flank; results are mostly Polish portals (Onet, WP, Interia, PAP, TVN24,
RMF, …) plus international outlets, filtered by a keyword relevance check
(`src/domain/news-relevance.ts`). The window is 8 days, so a fresh
database is backfilled with about a week of history on the first run.

Headlines are stored in their original language and shown in English:
non-English titles are translated once, by the same script, with
Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct-fast`) into the
`title_en` column (`src/domain/headline-translator.ts`); the original
title is kept and shown as a tooltip. The classifier reads the original
titles. The feed is shown on the homepage ticker and `/news` (which
loads further pages from `/api/news` as you scroll); see
`METHODOLOGY.md` for how the classifier uses it.
