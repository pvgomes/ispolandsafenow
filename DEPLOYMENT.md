# Deployment

## Main site: deployed, and auto-deploys on every push to `main`

`.github/workflows/deploy.yml` runs on every push to `main`: install →
test → typecheck/build → apply D1 migrations (`--remote`) → `wrangler
deploy`. It needs two GitHub Actions secrets (`CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`) already configured in the repo. Nothing manual
is needed for an ordinary code change — push to `main` and it ships.

The Worker is live at the `*.workers.dev` URL and at the custom domain
attached in the Cloudflare dashboard (Workers & Pages → the Worker →
Domains & Routes). `wrangler.jsonc`'s `database_id` points at the real
production D1 database, not a placeholder.

The main site Worker does **not** need a `TYPESAFE_AI_API_KEY` secret —
only the scheduler does (below), since the site itself never calls
TypeSafe AI, it only reads D1.

## Scheduler: deployed manually, not part of the GitHub Actions workflow

The scheduler (`scheduler/`, hourly Cron Trigger — see
`scheduler/README.md`) is a separate Worker with its own `wrangler.jsonc`
and is **not** wired into `.github/workflows/deploy.yml`. Deploy/update it
by hand when its code changes:

```bash
npm run scheduler:deploy   # npx wrangler deploy --config scheduler/wrangler.jsonc
```

It needs its own secret (separate from any secret on the main Worker —
Cloudflare secrets are per-Worker):

```bash
npm run scheduler:secret   # npx wrangler secret put TYPESAFE_AI_API_KEY --config scheduler/wrangler.jsonc
```

Run that once per environment; it persists across future
`scheduler:deploy` runs. Without it, the scheduler runs every hour but
every region resolves to `UNKNOWN` (see `METHODOLOGY.md`).

It shares the main app's D1 database (same `database_id`), so it needs no
separate `wrangler d1 create` or migration step — `migrations/` already
covers `job_runs`, `region_classifications`, and `classification_evidence`.

**Adding the scheduler deploy to CI** is reasonable future work (add a
job/step to `deploy.yml` that runs on changes under `scheduler/`), but
isn't done yet — a bad change to the scheduler is lower-stakes to catch
manually before deploying, since it only affects background
classification, not the site's ability to serve pages.

## Local vs. remote D1

Local development always uses `--local` (SQLite under `.wrangler/state`,
persisted via a named Docker volume — see `README.md`). Never run
`--remote` commands against production data without deliberately
intending to; `npm run db:migrate:remote` exists for manual/emergency use
but isn't invoked outside the GitHub Actions workflow.

## First-time setup (for reference — already done for this project)

1. `npx wrangler d1 create ispolandsafenow-db`, paste the `database_id`
   into both `wrangler.jsonc` and `scheduler/wrangler.jsonc`.
2. `npx wrangler login`, create a Cloudflare API token (Account → D1 →
   Edit, Account → Workers Scripts → Edit) and add it plus the account ID
   as `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` GitHub secrets.
3. Push to `main` once to deploy the site via CI.
4. `npm run scheduler:secret` then `npm run scheduler:deploy` to stand up
   the hourly classification job.
5. Attach the custom domain to the Worker in the Cloudflare dashboard.
