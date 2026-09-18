/**
 * Regional alert level shown on the map, region pages, and API.
 *
 * Meanings:
 * - GREEN: no elevated regional signal found.
 * - YELLOW: elevated situation requiring attention.
 * - RED: serious active warning or confirmed incident.
 * - UNKNOWN: missing, stale, conflicting, or insufficient information.
 *
 * Missing data must always resolve to UNKNOWN, never GREEN.
 */
export type AlertLevel = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

export const ALERT_LEVELS: readonly AlertLevel[] = ["GREEN", "YELLOW", "RED", "UNKNOWN"];

export function isAlertLevel(value: unknown): value is AlertLevel {
  return typeof value === "string" && (ALERT_LEVELS as readonly string[]).includes(value);
}

/** Normalizes any unrecognized, missing, or stale value to UNKNOWN. */
export function toAlertLevel(value: unknown): AlertLevel {
  return isAlertLevel(value) ? value : "UNKNOWN";
}

export interface AlertLevelPresentation {
  readonly label: string;
  readonly description: string;
  readonly colorClass: string;
  readonly badgeClass: string;
  readonly dotClass: string;
}

export const ALERT_LEVEL_PRESENTATION: Record<AlertLevel, AlertLevelPresentation> = {
  GREEN: {
    label: "Green",
    description: "No elevated regional signal found.",
    colorClass: "text-status-green-700",
    badgeClass: "bg-status-green-100 text-status-green-800 border-status-green-300",
    dotClass: "bg-status-green-500",
  },
  YELLOW: {
    label: "Yellow",
    description: "Elevated situation requiring attention.",
    colorClass: "text-status-yellow-700",
    badgeClass: "bg-status-yellow-100 text-status-yellow-800 border-status-yellow-300",
    dotClass: "bg-status-yellow-500",
  },
  RED: {
    label: "Red",
    description: "Serious active warning or confirmed incident.",
    colorClass: "text-status-red-700",
    badgeClass: "bg-status-red-100 text-status-red-800 border-status-red-300",
    dotClass: "bg-status-red-500",
  },
  UNKNOWN: {
    label: "Unknown",
    description: "Missing, stale, conflicting, or insufficient information.",
    colorClass: "text-status-unknown-700",
    badgeClass: "bg-status-unknown-100 text-status-unknown-800 border-status-unknown-300",
    dotClass: "bg-status-unknown-400",
  },
};
