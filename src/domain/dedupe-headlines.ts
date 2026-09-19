export interface RecentHeadline {
  readonly sourceUrl: string;
  readonly title: string;
  readonly sourceName: string | null;
}

/**
 * Keeps the first (most recent, since callers order by insertion desc)
 * occurrence of each `sourceUrl` and drops the rest, up to `limit`
 * results. Needed because the scheduler currently attaches the same
 * shared evidence list to every region's classification in a run (see
 * `scheduler/src/index.ts`), so `classification_evidence` holds up to 16
 * duplicate rows per headline per run.
 */
export function dedupeHeadlinesByUrl(items: readonly RecentHeadline[], limit: number): RecentHeadline[] {
  const seen = new Set<string>();
  const result: RecentHeadline[] = [];
  for (const item of items) {
    if (seen.has(item.sourceUrl)) continue;
    seen.add(item.sourceUrl);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}
