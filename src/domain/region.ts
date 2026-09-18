import type { AlertLevel } from "./alert-level";

/** Stable identity data for one of the 16 Polish voivodeships. */
export interface RegionIdentity {
  /** ISO 3166-2:PL code, e.g. "PL-14". Stable primary key. */
  readonly code: string;
  /** English-compatible URL slug, e.g. "mazowieckie". */
  readonly slug: string;
  /** Polish name, e.g. "Mazowieckie". */
  readonly namePl: string;
  /** English-compatible display name. */
  readonly nameEn: string;
}

/** A region's current classification as stored/read from D1. */
export interface RegionStatus {
  readonly currentStatus: AlertLevel;
  readonly lastClassifiedAt: string | null;
  readonly statusExpiresAt: string | null;
}

/** A region with its current status attached, as shown on the map and API. */
export interface RegionWithStatus extends RegionIdentity, RegionStatus {}

/**
 * A region's status is stale once past its expiry, or once it has never
 * been classified. Stale/missing data must resolve to UNKNOWN, never GREEN.
 */
export function resolveEffectiveStatus(status: RegionStatus, now: Date = new Date()): AlertLevel {
  if (!status.lastClassifiedAt) {
    return "UNKNOWN";
  }
  if (status.statusExpiresAt && new Date(status.statusExpiresAt).getTime() <= now.getTime()) {
    return "UNKNOWN";
  }
  return status.currentStatus;
}
