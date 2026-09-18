/**
 * Data mode for the whole site. "live" means classifications come from
 * `TypeSafeAiClassificationService` (TypeSafe AI's System One API);
 * regions resolve to UNKNOWN wherever that call is unconfigured, fails,
 * or returns nothing usable — never to a fixed demo fixture.
 */
export type AppMode = "demonstration" | "live";

export const APP_MODE: AppMode = "live";
