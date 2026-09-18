# Architecture

## Scope of this phase

This is the foundation and first vertical slice of *Is Poland Safe Now?*:
project scaffolding, Cloudflare configuration, Docker-based local
development, a D1 database foundation, the interactive Poland map, a
homepage backed by live TypeSafe AI classifications, a basic public status
API, and tests/documentation. `TypeSafeAiClassificationService` calls
TypeSafe AI's System One API directly with the model's own knowledge —
there is still no news-collection pipeline, scheduled classification, or
production deployment; those are designed for (see below) but not built.

## Why Astro

- **Server-rendered by default**, which the brief requires (region pages
  must render meaningful HTML with no JavaScript) and which SEO/AI-search
  discoverability depends on.
- **Islands architecture**: only the interactive map needs client-side
  JavaScript (React). Every other page is plain HTML/CSS, keeping the
  shipped JS minimal and the "no secrets in frontend output" guarantee easy
  to reason about (only `src/components/*.tsx` ever reaches the browser).
- **First-class Cloudflare Workers adapter** (`@astrojs/cloudflare`), so the
  same framework handles routing, SSR, static assets, and API routes inside
  a single Worker — no separate backend to stand up for this phase.

## Why Cloudflare D1

- The brief rules out Postgres/Supabase/Firebase/MongoDB and asks for a
  single Cloudflare-native database. D1 (SQLite at the edge) is Cloudflare's
  answer, integrates directly with Workers via a binding, and has a
  first-class migrations CLI (`wrangler d1 migrations apply`) that fits the
  "migrations + idempotent seed" requirement exactly.
- No ORM: `src/repositories/region-repository.ts` uses D1's prepared
  statements (`db.prepare(sql).bind(...).all()/.first()`) directly. Every
  query is a plain, reviewable SQL string.

## One Worker, not two

The brief allows preparing an interface for future scheduled jobs without
deploying a second Worker yet. `scheduler/` holds that interface
(`ClassificationService`) and a design note; there is no cron trigger, no
second `wrangler.jsonc`, and no deployed job. The single Astro app:

- renders the website (SSR),
- serves static assets (the `ASSETS` binding, wired up by the Cloudflare
  adapter),
- exposes `/api/*` routes, and
- reads from D1 via `RegionRepository`.

## Layering

```
src/
  domain/         Pure business rules: AlertLevel, Region, national summary,
                   the ClassificationService interface, the live TypeSafe
                   AI-backed implementation, missing-data-resolves-to-UNKNOWN
                   logic. No Astro imports (it does call `fetch`).
  data/            Static reference data: the 16 REGIONS.
  repositories/    D1 access, prepared statements only.
  services/        Orchestrates repositories + the ClassificationService.
  components/      Astro components (server-rendered) and one React island
                   (PolandMap.tsx) — the only client-hydrated code.
  layouts/         Shared HTML shell, meta tags, WebSite JSON-LD.
  pages/           Routes: homepage, region pages, methodology, about,
                   /api/*, robots.txt, llms.txt, sitemap-index.xml.
```

Domain code has zero framework dependencies, so it's unit-testable in
plain Vitest and will not need to change when D1 rows start holding real
classifications instead of demo ones.

## Live classification, and its current limits

`TypeSafeAiClassificationService` (`src/domain/typesafe-ai-classification-service.ts`)
is the only implementation of the `ClassificationService` interface today.
Pages and API routes call `RegionStatusService`, which combines D1-sourced
region *identity* (code, slug, names — always real) with whatever
`ClassificationService` is wired in. Swapping that one class is the entire
migration path to a different classifier — no caller changes.

Each request calls TypeSafe AI's System One API once, asking it to
classify all 16 regions from its own knowledge — there is no stored,
citable evidence trail yet (see `scheduler/README.md`). If the
`TYPESAFE_AI_API_KEY` binding is missing, the request fails, or the
response is unusable, affected regions resolve to `UNKNOWN` rather than a
guessed value; the D1 `regions` table itself always starts every region at
`UNKNOWN` with no classification timestamp until a real classification
succeeds. Every page and API response is stamped `"mode": "live"`.

## The Cloudflare build/dev model (a note on `wrangler.jsonc`)

`@astrojs/cloudflare` (v14, built on `@cloudflare/vite-plugin`) resolves
`wrangler.jsonc`'s `main` field even during `astro dev`/`astro build`, to
configure a real workerd-backed dev/build environment (so D1 bindings work
identically in dev and prod). The root `wrangler.jsonc` therefore points
`main` at `@astrojs/cloudflare/entrypoints/server`, a package export — this
is what the adapter expects; it is never actually deployed.

`npm run build` produces the real, deployable Worker at
`dist/server/entry.mjs` plus a matching, auto-generated
`dist/server/wrangler.json` (same D1/asset bindings, correct entry) and a
`.wrangler/deploy/config.json` redirect file. Because of that redirect,
running plain `wrangler dev` / `wrangler deploy` from the repo root after a
build automatically targets the real generated config — no `--config` flag
needed. `npm run db:migrate:*` targets the root `wrangler.jsonc` directly,
since D1 migrations don't need a built Worker.

## Deliberately deferred (interfaces exist, implementations don't)

- **News collection**: no code yet. The `job_runs` and
  `classification_evidence` tables exist so it can start writing
  immediately once built. `TypeSafeAiClassificationService` calls TypeSafe
  AI directly over HTTP (`fetch`, no SDK) with the model's own knowledge
  instead of collected evidence.
- **Scheduled jobs**: `scheduler/README.md` documents the intended design
  (a Cron Trigger calling the classification service and writing to D1);
  nothing is deployed.
- **Production deployment**: `wrangler.jsonc`'s `database_id` is a local
  placeholder; see `DEPLOYMENT.md` for the steps a later phase will need.
