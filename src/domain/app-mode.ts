/**
 * Data mode for the whole site. This phase only ever runs in
 * "demonstration" mode: there is no news collection or classification
 * pipeline yet, so every status shown comes from the fixed demo fixture.
 * A future "live" mode will be introduced alongside the real pipeline.
 */
export type AppMode = "demonstration" | "live";

export const APP_MODE: AppMode = "demonstration";
