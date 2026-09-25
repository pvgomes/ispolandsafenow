# Is Poland Safe Now?

An independent information service tracking publicly reported
security-alert exposure across Poland's 16 voivodeships — covering
developments connected to the Russia-Ukraine war, Belarus border
activity, Kaliningrad, airspace violations, drone or missile incidents,
RCB warnings, and border, airport, or transport disruptions.

**This is not an official warning system.** For emergencies, call 112.
Always follow instructions from Polish authorities and RCB.

## Current phase

Project scaffolding, Cloudflare configuration, Docker-based local
development, a D1 database foundation, the interactive Poland map, a
homepage classified by an **hourly scheduled job** (`scheduler/`) that
calls TypeSafe AI with real headlines as evidence, a **news feed**
(homepage ticker and `/news`, last 8 days) collected from Google News by
a GitHub Actions cron into D1 and shown in English (non-English headlines
translated once with Workers AI), plus a public status API and
tests/documentation. The main site never calls TypeSafe AI itself — it
only reads D1 — so traffic has no effect on AI cost. See
`ARCHITECTURE.md` and `METHODOLOGY.md` for how classification and the
CALM/UNKNOWN split work, and `scheduler/README.md` for the job itself.

## Stack

Astro (server output) · TypeScript (strict) · React (map island only) ·
Tailwind CSS · Cloudflare Workers · Cloudflare D1 · Wrangler · Vitest ·
Docker Compose · npm. No ORM, no traditional Node server, no external map
tiles. See `ARCHITECTURE.md` for why.

## Quick start (Docker — the canonical workflow)

You need Git, Docker, and Docker Compose. Nothing else.

```bash
cp .dev.vars.example .dev.vars
docker compose up --build
```

The entrypoint (`docker/dev-entrypoint.sh`) installs dependencies, applies
D1 migrations and seeds the 16 regions (idempotent — safe to re-run, never
wipes existing data), builds the Astro/Cloudflare worker, and starts
Wrangler on `0.0.0.0:8787`. Once it logs "Ready on http://localhost:8787",
open **http://localhost:8787**.

Other commands, run against the same container:

```bash
docker compose run --rm app npm test
docker compose run --rm app npm run typecheck
docker compose run --rm app npm run build
docker compose down
```

`docker compose down --volumes` also erases local D1 state (the named
`wrangler-state` volume) — use it deliberately, not as a routine command.

Local D1 data (and installed `node_modules`) persist across ordinary
`docker compose down` / `up` cycles via named volumes (`wrangler-state`,
`node_modules`); only `--volumes` clears them.

## Quick start (without Docker)

Requires Node.js 22+.

```bash
npm install
npx wrangler d1 migrations apply ispolandsafenow-db --local
npm run news:fetch:local   # optional: seed the last 8 days of headlines
npm run build
npm run worker:dev   # wrangler dev on 0.0.0.0:8787, production-parity
```

For iterative development with fast rebuilds, `npm run dev` runs Astro's
own dev server (still backed by a real local D1 via Cloudflare's platform
proxy), though the canonical, Workers-accurate path is the one above.

## Project layout

```
src/
  domain/         Pure business rules (AlertLevel, Region, national
                   summary, the ClassificationService interface, the
                   TypeSafe AI-backed implementation, news collection).
                   No framework imports (it does call fetch).
  data/           The 16 REGIONS and MAJOR_CITIES (well-known cities per
                   region, shown on the map and searchable).
  repositories/   D1 access via prepared statements. No ORM. Reads for
                   the site, writes (ClassificationWriter) for the
                   scheduler.
  components/     Astro components + the one React island (PolandMap.tsx).
  layouts/        Shared HTML shell, meta tags, WebSite JSON-LD.
  pages/          Routes, including /api/* and SEO files.
  assets/maps/    The committed, pre-built Poland SVG (see DATA_SOURCES.md).
migrations/       D1 schema + idempotent region seed.
scheduler/        A separate Worker: hourly Cron Trigger that classifies
                   all 16 regions and writes the result to D1. Its own
                   wrangler.jsonc; see scheduler/README.md.
tests/            Vitest: domain/repository/API/writer/scheduler logic
                   (unit/) and the map component (dom/).
scripts/          Dev-time tooling (map SVG conversion).
docker/           Compose entrypoint script.
```

## Routes

`/`, `/regions/[slug]`, `/methodology`, `/about`, `/api/health`,
`/api/status`, `/api/regions`, `/api/news`, `/news`, `/robots.txt`,
`/llms.txt`, `/sitemap.xml` (also served as `/sitemap-index.xml`).

The sitemap is generated from D1 on each request (cached for an hour):
`lastmod` reflects the latest classification / headline rather than the
request time, so search engines can trust it. `/api/*` is disallowed in
`robots.txt`.

Region pages render meaningful, complete HTML with no JavaScript required.
API responses always include `"mode": "live"` and are always plain D1
reads — no per-request AI call, so response time and cost don't depend on
traffic.

## Testing

```bash
npm test          # vitest run — domain, repositories, the classification
                   # writer, the scheduler job, API logic (via a fake D1),
                   # the map SVG/DB consistency, and the map React
                   # component (keyboard, mouse, selection, status colors)
npm run typecheck  # astro check + tsc --noEmit (covers scheduler/ too)
npm run build      # astro check + astro build
```

D1-dependent logic is tested against in-memory fake `D1Database`
implementations (`tests/fakes/fake-d1.ts`, `tests/fakes/in-memory-d1.ts`)
rather than a real Workers runtime, keeping the suite fast and
dependency-light; the real D1/Workers path is exercised manually via
`npm run worker:dev` (documented above) and is what Docker runs, plus
`npm run scheduler:trigger` for the scheduled job (see
`scheduler/README.md`).

## Further reading

- `ARCHITECTURE.md` — design decisions, layering, why Astro/D1, the
  Cloudflare build/dev model.
- `DATA_SOURCES.md` — the map's geodata source and license, and how the
  committed SVG was produced.
- `METHODOLOGY.md` — status levels, how live TypeSafe AI classification
  works today and its limits, the planned pipeline.
- `DEPLOYMENT.md` — what production deployment will need (not yet done).
