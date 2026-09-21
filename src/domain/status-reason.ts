import type { AlertLevel } from "./alert-level";

/**
 * The main driver behind a region's current colour.
 *
 * TypeSafe AI's System One only returns structured answers (choice/score),
 * never free text, so the "why" is asked as a second `choice` question per
 * region (see `typesafe-ai-classification-service.ts`) and rendered into a
 * sentence here. That keeps the explanation grounded in the same call that
 * produced the colour, instead of being invented by a separate generator.
 */
export type StatusDriver =
  | "AIRSPACE_INCIDENT"
  | "BORDER_PRESSURE"
  | "MILITARY_ACTIVITY"
  | "SABOTAGE_INFRASTRUCTURE"
  | "CYBER_DISINFORMATION"
  | "WAR_SPILLOVER"
  | "NOTHING_NOTABLE";

interface StatusDriverPresentation {
  /** Short label for badges and lists. */
  readonly label: string;
  /** Criteria text handed to the classifier for this option. */
  readonly criteria: string;
  /** First sentence of the rendered reason. */
  readonly phrase: string;
}

export const STATUS_DRIVERS: Record<StatusDriver, StatusDriverPresentation> = {
  AIRSPACE_INCIDENT: {
    label: "Airspace / drone incident",
    criteria: "Drones, missiles, airspace violations, closed airports or scrambled fighter jets in or near this region.",
    phrase: "Drone, missile or airspace activity was reported in or near this region.",
  },
  BORDER_PRESSURE: {
    label: "Border pressure",
    criteria: "Incidents, migration pressure, closures or provocations at a national border touching this region.",
    phrase: "Incidents or pressure at the border were reported.",
  },
  MILITARY_ACTIVITY: {
    label: "Military activity",
    criteria: "Troop movements, exercises, deployments or base activity concentrated in this region.",
    phrase: "Heightened military or troop activity was reported here.",
  },
  SABOTAGE_INFRASTRUCTURE: {
    label: "Sabotage / infrastructure",
    criteria: "Sabotage, arson, rail or energy infrastructure damage, or espionage arrests in this region.",
    phrase: "Suspected sabotage, espionage or damage to infrastructure was reported.",
  },
  CYBER_DISINFORMATION: {
    label: "Cyber / disinformation",
    criteria: "Cyberattacks, hybrid operations or disinformation campaigns aimed at this region.",
    phrase: "Cyberattacks or hybrid/disinformation activity were reported.",
  },
  WAR_SPILLOVER: {
    label: "War spillover",
    criteria: "General spillover from the war in Ukraine — refugee flows, logistics hubs, alerts — without a single local incident.",
    phrase: "General spillover from the war in Ukraine is affecting this region.",
  },
  NOTHING_NOTABLE: {
    label: "Nothing notable",
    criteria: "Nothing specific to this region was reported — the expected answer for a calm region.",
    phrase: "No incident specific to this region was reported.",
  },
};

const DRIVER_VALUES = Object.keys(STATUS_DRIVERS) as StatusDriver[];

export function isStatusDriver(value: unknown): value is StatusDriver {
  return typeof value === "string" && (DRIVER_VALUES as string[]).includes(value);
}

export function toStatusDriver(value: unknown): StatusDriver | null {
  return isStatusDriver(value) ? value : null;
}

export interface StatusReasonInput {
  readonly status: AlertLevel;
  /** `null` when the classifier gave no usable driver answer for this region. */
  readonly driver: StatusDriver | null;
  /** Display name of the region, e.g. "Mazowieckie". */
  readonly regionName: string;
  /** How many collected headlines actually name this region or one of its cities. */
  readonly matchedHeadlineCount: number;
}

/**
 * Renders the short "why this colour" sentence shown on the map panel, the
 * region page and `/api/regions`.
 *
 * When the classifier returned no driver, the sentence degrades to the
 * evidence half alone — still concrete ("based on N headlines mentioning
 * X"), never a bare restatement of the colour.
 */
export function buildStatusReason({ status, driver, regionName, matchedHeadlineCount }: StatusReasonInput): string {
  const evidence =
    matchedHeadlineCount > 0
      ? `Based on ${matchedHeadlineCount} recent headline${matchedHeadlineCount === 1 ? "" : "s"} mentioning ${regionName}.`
      : `Based on Poland-wide reporting from the last 48 hours; nothing named ${regionName} directly.`;

  if (status === "UNKNOWN") {
    return `Not enough current, trustworthy information about ${regionName}.`;
  }
  if (!driver) {
    return evidence;
  }
  return `${STATUS_DRIVERS[driver].phrase} ${evidence}`;
}
