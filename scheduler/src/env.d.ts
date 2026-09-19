interface Env {
  DB: D1Database;
  TYPESAFE_AI_API_KEY: string | undefined;
  /** Guards the manual POST /trigger endpoint — see src/index.ts. */
  SCHEDULER_TRIGGER_SECRET: string | undefined;
}
