import { REGIONS } from "../../src/data/regions";
import { TypeSafeAiClassificationService } from "../../src/domain/typesafe-ai-classification-service";
import { ClassificationWriter } from "../../src/repositories/classification-writer";

const JOB_TYPE = "classification";

/**
 * Runs hourly (see wrangler.jsonc `triggers.crons`). Classifies all 16
 * regions in one TypeSafe AI call and persists the result to D1. The
 * main site Worker never calls TypeSafe AI itself — it only reads what
 * this job writes (`RegionRepository`) — so per-visitor cost is flat
 * regardless of traffic, whether that's 10 users or 10,000.
 */
export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runClassificationJob(env));
  },
};

export async function runClassificationJob(env: Env): Promise<void> {
  const writer = new ClassificationWriter(env.DB);
  const jobRunId = await writer.startJobRun(JOB_TYPE);

  try {
    const service = new TypeSafeAiClassificationService(env.TYPESAFE_AI_API_KEY);
    const asOf = new Date().toISOString();
    const classifications = await service.classifyRegions({ regions: REGIONS, asOf });

    for (const classification of classifications) {
      await writer.writeClassification(classification, jobRunId);
    }

    const counts: Record<string, number> = {};
    for (const c of classifications) counts[c.status] = (counts[c.status] ?? 0) + 1;

    await writer.finishJobRun(jobRunId, "succeeded", { regionCount: classifications.length, counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[scheduler] classification job failed:", message);
    await writer.finishJobRun(jobRunId, "failed", {}, message);
    // Deliberately not re-thrown: a failed run leaves existing regions at
    // their last good status until it naturally expires (see
    // resolveEffectiveStatus) rather than forcing UNKNOWN immediately —
    // one missed hourly run shouldn't blank out the whole site.
  }
}
