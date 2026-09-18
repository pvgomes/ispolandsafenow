# Deployment

**Nothing in this phase has been deployed, and no DNS has been changed.**
This document describes the steps a later phase will need; it is
preparation, not an executed action.

## What's already in place

- `wrangler.jsonc` declares the Worker name, the `DB` (D1) binding, the
  `ASSETS` binding, and `compatibility_date`/`compatibility_flags`.
- `migrations/` contains the full schema and the idempotent region seed,
  ready for `wrangler d1 migrations apply --remote`.
- `npm run build` produces a deployable Worker at `dist/server/entry.mjs`
  with a matching `dist/server/wrangler.json`.

## What a real deployment would still need

1. **Create the remote D1 database** (this repo's `database_id` is the
   local-dev placeholder `local-dev-placeholder`):
   ```bash
   npx wrangler d1 create ispolandsafenow-db
   ```
   Copy the returned `database_id` into `wrangler.jsonc`'s `d1_databases[0].database_id`.

2. **Apply migrations to the remote database:**
   ```bash
   npm run db:migrate:remote
   ```

3. **Authenticate wrangler** with a Cloudflare account (`npx wrangler
   login`) that has access to the target account/zone.

4. **Build and deploy:**
   ```bash
   npm run build
   npx wrangler deploy
   ```
   (Plain `wrangler deploy` from the repo root, no `--config` flag needed —
   see `ARCHITECTURE.md`'s note on the generated `dist/server/wrangler.json`
   redirect.)

5. **Point the domain at the Worker.** `ispolandsafenow.com` is referenced
   as the canonical site (`astro.config.mjs`'s `site` field, and every
   canonical/OG URL and the sitemap), but no Cloudflare route, custom
   domain, or DNS record has been configured. That's a Cloudflare dashboard
   (or `wrangler.jsonc` `routes`) step for whoever owns the zone.

6. **Secrets**, once the TypeSafe AI integration exists: `npx wrangler
   secret put TYPESAFE_AI_API_KEY` (or equivalent) rather than committing
   it to `.dev.vars` or `wrangler.jsonc`. Nothing reads a secret in this
   phase, so there is nothing to configure yet.

## Local vs. remote D1

Local development always uses `--local` (SQLite under `.wrangler/state`,
persisted via a named Docker volume — see `README.md`). Never run
`--remote` commands against production data without deliberately intending
to; `npm run db:migrate:remote` is provided but not wired into any
automated workflow.
