import type { AlertLevel } from "./alert-level";
import type { RegionWithStatus } from "./region";

export interface NationalSummary {
  /** The most severe status found across all regions. */
  readonly headlineLevel: AlertLevel;
  readonly counts: Record<AlertLevel, number>;
  readonly totalRegions: number;
}

// RED is most severe; UNKNOWN is treated as more cautionary than GREEN.
const SEVERITY_RANK: Record<AlertLevel, number> = {
  RED: 3,
  YELLOW: 2,
  UNKNOWN: 1,
  GREEN: 0,
};

/** Deterministic national roll-up: no averaging, just the worst regional signal. */
export function summarizeNational(regions: readonly RegionWithStatus[]): NationalSummary {
  const counts: Record<AlertLevel, number> = { GREEN: 0, YELLOW: 0, RED: 0, UNKNOWN: 0 };
  let headlineLevel: AlertLevel = "UNKNOWN";
  let headlineRank = -1;

  for (const region of regions) {
    counts[region.currentStatus] += 1;
    const rank = SEVERITY_RANK[region.currentStatus];
    if (rank > headlineRank) {
      headlineRank = rank;
      headlineLevel = region.currentStatus;
    }
  }

  if (regions.length === 0) {
    headlineLevel = "UNKNOWN";
  }

  return { headlineLevel, counts, totalRegions: regions.length };
}
