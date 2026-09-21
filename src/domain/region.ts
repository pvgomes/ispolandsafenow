import type { AlertLevel } from "./alert-level";
import type { StatusDriver } from "./status-reason";

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
  /** Short "why this colour" sentence; `null` until first classified. */
  readonly statusReason: string | null;
  /** Machine-readable driver behind the colour; `null` when unavailable. */
  readonly statusDriver: StatusDriver | null;
}

/** A region with its current status attached, as shown on the map and API. */
export interface RegionWithStatus extends RegionIdentity, RegionStatus {}

/**
 * A region that has never been classified resolves to UNKNOWN — missing
 * data must never resolve to GREEN.
 *
 * Statuses deliberately do not expire: a classification stands until the
 * hourly job replaces it, so a run of failed or skipped runs leaves the
 * last real assessment visible instead of blanking the map.
 */
export function resolveEffectiveStatus(status: RegionStatus): AlertLevel {
  if (!status.lastClassifiedAt) {
    return "UNKNOWN";
  }
  return status.currentStatus;
}
