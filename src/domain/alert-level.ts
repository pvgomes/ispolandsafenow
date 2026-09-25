/**
 * Regional alert level shown on the map, region pages, and API.
 *
 * The scale is deliberately weighted towards the calm end: most of Poland,
 * most of the time, is simply going about its day, and a map that shouts
 * red at a routine drone report is both inaccurate and needlessly
 * frightening. So the four levels are:
 *
 * - CALM (dark green): nothing notable reported. The normal state.
 * - LOW (green): background noise — minor or indirect signals, nothing
 *   that changes what a resident or visitor should do.
 * - ELEVATED (yellow): a real, current situation worth paying attention
 *   to — the highest level short of an actual attack.
 * - CRITICAL (red): reserved for a confirmed physical impact on the
 *   ground in that region — a strike, explosion, crash or debris causing
 *   damage or casualties. Nothing else earns red.
 * - UNKNOWN: missing, stale, conflicting, or insufficient information.
 *
 * Missing data must always resolve to UNKNOWN, never CALM.
 */
export type AlertLevel = "CALM" | "LOW" | "ELEVATED" | "CRITICAL" | "UNKNOWN";

export const ALERT_LEVELS: readonly AlertLevel[] = ["CALM", "LOW", "ELEVATED", "CRITICAL", "UNKNOWN"];

/**
 * The three-level scale used before the rescale of 2026-09-25, mapped onto
 * its equivalent on the current scale. Rows written by an older job run,
 * and the historical `region_classifications` table, still carry these
 * values, so reads normalize them instead of degrading them to UNKNOWN.
 * Note that old RED becomes ELEVATED, not CRITICAL: the old red meant
 * "serious active warning", which is exactly what yellow means now.
 */
const LEGACY_ALERT_LEVELS: Record<string, AlertLevel> = {
  GREEN: "CALM",
  YELLOW: "LOW",
  RED: "ELEVATED",
};

export function isAlertLevel(value: unknown): value is AlertLevel {
  return typeof value === "string" && (ALERT_LEVELS as readonly string[]).includes(value);
}

/** Normalizes any unrecognized, missing, or stale value to UNKNOWN. */
export function toAlertLevel(value: unknown): AlertLevel {
  if (isAlertLevel(value)) {
    return value;
  }
  return (typeof value === "string" ? LEGACY_ALERT_LEVELS[value] : undefined) ?? "UNKNOWN";
}

export interface AlertLevelPresentation {
  readonly label: string;
  readonly description: string;
  readonly colorClass: string;
  readonly badgeClass: string;
  readonly dotClass: string;
}

export const ALERT_LEVEL_PRESENTATION: Record<AlertLevel, AlertLevelPresentation> = {
  CALM: {
    label: "Calm",
    description: "Nothing notable reported — the normal, everyday situation.",
    colorClass: "text-status-calm-700",
    badgeClass: "bg-status-calm-100 text-status-calm-800 border-status-calm-300",
    dotClass: "bg-status-calm-500",
  },
  LOW: {
    label: "Low",
    description: "Minor or indirect signals in the news; nothing that changes daily life.",
    colorClass: "text-status-low-700",
    badgeClass: "bg-status-low-100 text-status-low-800 border-status-low-300",
    dotClass: "bg-status-low-500",
  },
  ELEVATED: {
    label: "Elevated",
    description: "A current situation worth paying attention to, without any attack on the ground.",
    colorClass: "text-status-elevated-700",
    badgeClass: "bg-status-elevated-100 text-status-elevated-800 border-status-elevated-300",
    dotClass: "bg-status-elevated-500",
  },
  CRITICAL: {
    label: "Critical",
    description: "A confirmed attack or impact on the ground here — damage, casualties or wreckage.",
    colorClass: "text-status-critical-700",
    badgeClass: "bg-status-critical-100 text-status-critical-800 border-status-critical-300",
    dotClass: "bg-status-critical-500",
  },
  UNKNOWN: {
    label: "Unknown",
    description: "Missing, stale, conflicting, or insufficient information.",
    colorClass: "text-status-unknown-700",
    badgeClass: "bg-status-unknown-100 text-status-unknown-800 border-status-unknown-300",
    dotClass: "bg-status-unknown-400",
  },
};
