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
 * Usage (needs CLOUDFLARE_API_TOKEN/ACCOUNT_ID or a logged-in wrangler
 * for --remote):
 *   node scripts/fetch-news.ts                 # remote D1, last 8 days
 *   node scripts/fetch-news.ts --local         # local wrangler D1
 *   node scripts/fetch-news.ts --days=3        # shorter lookback
 *   node scripts/fetch-news.ts --dry-run       # print the SQL, write nothing
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectRecentNews, DEFAULT_LOOKBACK_DAYS } from "../src/domain/news-collection.ts";
import type { NewsItem } from "../src/domain/news-item.ts";

const DATABASE_NAME = "ispolandsafenow-db";

interface CliOptions {
  readonly local: boolean;
  readonly dryRun: boolean;
  readonly lookbackDays: number;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let lookbackDays = DEFAULT_LOOKBACK_DAYS;
  for (const arg of argv) {
    const match = arg.match(/^--days=(\d+)$/);
    if (match) lookbackDays = Number(match[1]);
  }
  return { local: argv.includes("--local"), dryRun: argv.includes("--dry-run"), lookbackDays };
}

function sqlString(value: string | null): string {
  return value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`;
}

function buildInsertSql(items: readonly NewsItem[]): string {
  const lines = items.map(
    (item) =>
      "INSERT OR IGNORE INTO news_items (url, title, source_name, published_at) VALUES " +
      `(${sqlString(item.url)}, ${sqlString(item.title)}, ${sqlString(item.sourceName)}, ${sqlString(item.publishedAt)});`,
  );
  return lines.join("\n") + "\n";
}

function runWrangler(sqlFile: string, local: boolean): void {
  const args = ["wrangler", "d1", "execute", DATABASE_NAME, local ? "--local" : "--remote", "--file", sqlFile, "--yes"];
  const result = spawnSync("npx", args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    throw new Error(`wrangler d1 execute exited with status ${result.status}`);
  }
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

  const dir = mkdtempSync(join(tmpdir(), "ispolandsafenow-news-"));
  const sqlFile = join(dir, "news.sql");
  try {
    writeFileSync(sqlFile, sql, "utf8");
    runWrangler(sqlFile, options.local);
    console.log(`[fetch-news] upserted into ${options.local ? "local" : "remote"} D1 (${DATABASE_NAME}).`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("[fetch-news] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
