/**
 * Collects recent headlines about Poland's security situation (Russia-
 * Ukraine war spillover, Belarus border, Kaliningrad, airspace incidents,
 * RCB warnings) from Google News RSS and upserts them into the D1
 * `news_items` table.
 *
 * Runs from GitHub Actions (.github/workflows/fetch-news.yml) — every
 * couple of hours, on every deploy, and on demand — because Google
 * blocks these RSS requests when they come from Cloudflare Workers.
 * `INSERT OR IGNORE` on the unique `url` column makes every run
 * idempotent: the first run backfills the whole lookback window (8 days
 * by default), later runs just append whatever is new.
 *
 * After inserting, it translates every headline still missing `title_en`
 * (newest first, capped per run) with Workers AI — see
 * `src/domain/headline-translator.ts` — so the site can show English
 * regardless of the source language. Translation needs
 * CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (token with Workers AI
 * read permission); without them the step is skipped with a warning and
 * caught up on a later run.
 *
 * Usage (needs CLOUDFLARE_API_TOKEN/ACCOUNT_ID or a logged-in wrangler
 * for --remote):
 *   node scripts/fetch-news.ts                 # remote D1, last 8 days
 *   node scripts/fetch-news.ts --local         # local wrangler D1
 *   node scripts/fetch-news.ts --days=3        # shorter lookback
 *   node scripts/fetch-news.ts --dry-run       # print the SQL, write nothing
 *   node scripts/fetch-news.ts --no-translate  # skip the Workers AI step
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { looksEnglish } from "../src/domain/headline-language.ts";
import { translateHeadlines } from "../src/domain/headline-translator.ts";
import { collectRecentNews, DEFAULT_LOOKBACK_DAYS } from "../src/domain/news-collection.ts";
import type { NewsItem } from "../src/domain/news-item.ts";

const DATABASE_NAME = "ispolandsafenow-db";
/** Untranslated rows handled per run — enough to absorb a fresh backfill in a couple of runs. */
const TRANSLATE_BATCH_LIMIT = 300;

interface CliOptions {
  readonly local: boolean;
  readonly dryRun: boolean;
  readonly translate: boolean;
  readonly lookbackDays: number;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let lookbackDays = DEFAULT_LOOKBACK_DAYS;
  for (const arg of argv) {
    const match = arg.match(/^--days=(\d+)$/);
    if (match) lookbackDays = Number(match[1]);
  }
  return {
    local: argv.includes("--local"),
    dryRun: argv.includes("--dry-run"),
    translate: !argv.includes("--no-translate"),
    lookbackDays,
  };
}

function sqlString(value: string | null): string {
  return value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`;
}

function buildInsertSql(items: readonly NewsItem[]): string {
  // Headlines that are already English get title_en right away; the rest
  // stay NULL for the translation step below.
  const lines = items.map(
    (item) =>
      "INSERT OR IGNORE INTO news_items (url, title, title_en, source_name, published_at) VALUES " +
      `(${sqlString(item.url)}, ${sqlString(item.title)}, ${sqlString(looksEnglish(item.title) ? item.title : null)}, ` +
      `${sqlString(item.sourceName)}, ${sqlString(item.publishedAt)});`,
  );
  return lines.join("\n") + "\n";
}

function buildTranslationSql(rows: ReadonlyArray<{ id: number; titleEn: string }>): string {
  return rows.map((row) => `UPDATE news_items SET title_en = ${sqlString(row.titleEn)} WHERE id = ${row.id};`).join("\n") + "\n";
}

function wranglerTarget(local: boolean): string {
  return local ? "--local" : "--remote";
}

function runWranglerFile(sqlFile: string, local: boolean): void {
  const args = ["wrangler", "d1", "execute", DATABASE_NAME, wranglerTarget(local), "--file", sqlFile, "--yes"];
  // Capture stdout: wrangler echoes one result block per statement, which
  // is hundreds of lines of nothing useful on a backfill.
  const result = spawnSync("npx", args, { encoding: "utf8", env: process.env, stdio: ["ignore", "pipe", "inherit"] });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    throw new Error(`wrangler d1 execute exited with status ${result.status}`);
  }
}

function queryWrangler<T>(command: string, local: boolean): T[] {
  const args = ["wrangler", "d1", "execute", DATABASE_NAME, wranglerTarget(local), "--json", "--command", command];
  const result = spawnSync("npx", args, { encoding: "utf8", env: process.env, stdio: ["ignore", "pipe", "inherit"] });
  if (result.status !== 0) {
    throw new Error(`wrangler d1 execute exited with status ${result.status}`);
  }
  const parsed = JSON.parse(result.stdout) as Array<{ results?: T[] }>;
  return parsed.flatMap((statement) => statement.results ?? []);
}

function executeSql(sql: string, local: boolean): void {
  const dir = mkdtempSync(join(tmpdir(), "ispolandsafenow-news-"));
  const sqlFile = join(dir, "news.sql");
  try {
    writeFileSync(sqlFile, sql, "utf8");
    runWranglerFile(sqlFile, local);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function translateMissing(local: boolean): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    console.warn("[fetch-news] CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN not set — skipping translation this run.");
    return;
  }

  const pending = queryWrangler<{ id: number; title: string }>(
    `SELECT id, title FROM news_items WHERE title_en IS NULL ORDER BY published_at DESC LIMIT ${TRANSLATE_BATCH_LIMIT}`,
    local,
  );
  if (pending.length === 0) {
    console.log("[fetch-news] every headline already has an English title.");
    return;
  }
  console.log(`[fetch-news] translating ${pending.length} headline(s) with Workers AI…`);

  const translated = await translateHeadlines(
    pending.map((row) => row.title),
    { accountId, apiToken },
    { log: (message) => console.warn(`[fetch-news] ${message}`) },
  );
  const updates = pending.flatMap((row, index) => {
    const titleEn = translated[index];
    return titleEn ? [{ id: row.id, titleEn }] : [];
  });
  if (updates.length === 0) {
    console.warn("[fetch-news] no translations succeeded; will retry next run.");
    return;
  }
  executeSql(buildTranslationSql(updates), local);
  console.log(`[fetch-news] stored ${updates.length} English title(s)${updates.length < pending.length ? ` (${pending.length - updates.length} left for next run)` : ""}.`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  console.log(`[fetch-news] collecting headlines from the last ${options.lookbackDays} day(s)…`);
  const items = await collectRecentNews({ lookbackDays: options.lookbackDays });
  console.log(`[fetch-news] ${items.length} relevant item(s) collected`);
  if (items.length === 0) {
    console.error("[fetch-news] nothing collected — feeds unreachable or blocked? Not touching the database.");
    process.exitCode = 1;
    return;
  }

  const oldest = items.at(-1)?.publishedAt;
  const newest = items[0]?.publishedAt;
  console.log(`[fetch-news] range: ${oldest} → ${newest}`);

  const sql = buildInsertSql(items);
  if (options.dryRun) {
    process.stdout.write(sql);
    return;
  }

  executeSql(sql, options.local);
  console.log(`[fetch-news] upserted into ${options.local ? "local" : "remote"} D1 (${DATABASE_NAME}).`);

  if (options.translate) {
    try {
      await translateMissing(options.local);
    } catch (error) {
      // Translation is best-effort: a missing Workers AI permission must
      // not block the deploy or the news upsert that just succeeded.
      // Untranslated rows show their original title and are retried later.
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`${process.env.GITHUB_ACTIONS ? "::warning::" : ""}[fetch-news] translation skipped: ${message}`);
    }
  }
}

main().catch((error) => {
  console.error("[fetch-news] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
