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

## Scheduler: deployed automatically by the same GitHub Actions workflow

The scheduler (`scheduler/`, hourly Cron Trigger — see
`scheduler/README.md`) is a separate Worker with its own `wrangler.jsonc`.
`.github/workflows/deploy.yml` deploys it right after the main site, on
every push to `main`, using the same `CLOUDFLARE_API_TOKEN` /
`CLOUDFLARE_ACCOUNT_ID` secrets — no separate manual step needed for an
ordinary code change.

The workflow also fires an immediate classification run after each
deploy, rather than waiting for the next hourly cron tick: it generates a
one-off random secret, sets it as the scheduler's `SCHEDULER_TRIGGER_SECRET`
(a fresh value every deploy — never stored anywhere), then calls the
Worker's `POST /trigger` endpoint with it (see `scheduler/src/index.ts`).
This is what keeps the site from sitting empty right after a fresh
deploy or a long gap.

It needs its own `TYPESAFE_AI_API_KEY` secret (separate from any secret on
the main Worker — Cloudflare secrets are per-Worker; the key that was set
directly on the main Worker early on, before the scheduler existed as a
separate Worker, never carried over). A `TYPESAFE_AI_API_KEY` GitHub
Actions secret is now configured, so the workflow sets it on the
scheduler automatically on every deploy — if it's ever removed, that step
is simply skipped and the scheduler keeps whatever value (if any) was set
on it directly before. Without it configured one way or another, the
scheduler still runs every hour, but every region resolves to `UNKNOWN`
(see `METHODOLOGY.md`). To set it directly instead of via a GitHub
secret:

```bash
npm run scheduler:secret   # npx wrangler secret put TYPESAFE_AI_API_KEY --config scheduler/wrangler.jsonc
```

It shares the main app's D1 database (same `database_id`), so it needs no
separate `wrangler d1 create` or migration step — `migrations/` already
covers `job_runs`, `region_classifications`, `classification_evidence`,
and `news_items`.

## News feed

Headlines are not fetched by either Worker (Google blocks RSS requests
from Cloudflare Workers). `.github/workflows/fetch-news.yml` runs
`scripts/fetch-news.ts` every two hours — and `deploy.yml` runs it once
per deploy, before triggering a classification — writing into the
`news_items` table with the same `CLOUDFLARE_API_TOKEN` /
`CLOUDFLARE_ACCOUNT_ID` secrets. To backfill or refresh by hand:

```bash
npm run news:fetch                 # remote D1, last 8 days
npm run news:fetch -- --days=3     # shorter window
npm run news:fetch:local           # local D1 for `npm run dev`
node scripts/fetch-news.ts --dry-run   # print the SQL, write nothing
```

Re-running is safe: rows are keyed by link (`INSERT OR IGNORE`).

After inserting, the same script translates every headline that still
lacks an English title (`title_en`, migration 0004) with Workers AI
(`@cf/meta/llama-3.1-8b-instruct-fast`, via the REST API — see
`src/domain/headline-translator.ts`), up to 300 per run, newest first.
This needs the `CLOUDFLARE_API_TOKEN` to carry the **Workers AI: Read**
permission (Account scope). Without it the step logs a clear HTTP 401/403
error and fails the run; without credentials at all it is skipped with a
warning. Either way, nothing is lost — untranslated rows show their
original title and are picked up by a later run. `--no-translate` skips
the step; headlines that already look English are never sent to the
model (`src/domain/headline-language.ts`). Cost is roughly one neuron per
translated headline, well inside the Workers AI free allowance.

`npm run scheduler:deploy` still works for a manual/local deploy (e.g. to
test a scheduler-only change before pushing), it's just no longer the only
way it gets deployed.

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
3. Optionally add a `TYPESAFE_AI_API_KEY` GitHub secret so the workflow can
   set it on the scheduler automatically (see above) — otherwise run
   `npm run scheduler:secret` once by hand instead.
4. Push to `main` once to deploy the site and the scheduler via CI, and
   fire the first classification run.
5. Attach the custom domain to the Worker in the Cloudflare dashboard.
