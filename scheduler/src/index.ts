import { REGIONS } from "../../src/data/regions";
import { TypeSafeAiClassificationService } from "../../src/domain/typesafe-ai-classification-service";
import { ClassificationWriter } from "../../src/repositories/classification-writer";
import { NewsRepository } from "../../src/repositories/news-repository";

const JOB_TYPE = "classification";

/** How far back in `news_items` a run looks for evidence. */
const EVIDENCE_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const EVIDENCE_LIMIT = 40;

export interface ClassificationJobResult {
  readonly status: "succeeded" | "failed";
  readonly regionCount?: number;
  readonly counts?: Record<string, number>;
  /** Regions left untouched because this run produced no usable answer for them. */
  readonly skippedRegions?: string[];
  readonly error?: string;
}

/**
 * Runs hourly (see wrangler.jsonc `triggers.crons`), and can also be
 * fired on demand via `POST /trigger` (see `fetch` below) — e.g. right
 * after a deploy, so a fresh environment doesn't sit empty for up to an
 * hour waiting for the next cron tick. The main site Worker never calls
 * TypeSafe AI itself — it only reads what this job writes
 * (`RegionRepository`) — so per-visitor cost is flat regardless of
 * traffic, whether that's 10 users or 10,000.
 */
export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runClassificationJob(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/trigger") {
      return new Response("Not found", { status: 404 });
    }

    const provided = request.headers.get("x-trigger-secret");
    if (!env.SCHEDULER_TRIGGER_SECRET || provided !== env.SCHEDULER_TRIGGER_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const result = await runClassificationJob(env);
    return Response.json(result, { status: result.status === "succeeded" ? 200 : 502 });
  },
};

export interface ClassificationJobOptions {
  /** Retry backoff for the upstream call; overridable so tests don't wait. */
  readonly retryDelaysMs?: readonly number[];
}

export async function runClassificationJob(env: Env, options: ClassificationJobOptions = {}): Promise<ClassificationJobResult> {
  const writer = new ClassificationWriter(env.DB);
  const jobRunId = await writer.startJobRun(JOB_TYPE);

  try {
    const asOf = new Date().toISOString();
    // Evidence comes from `news_items`, filled by scripts/fetch-news.ts
    // from GitHub Actions — Google News blocks fetches made from Workers,
    // so this Worker deliberately never fetches RSS itself.
    const newsRepository = new NewsRepository(env.DB);
    const since = new Date(Date.parse(asOf) - EVIDENCE_LOOKBACK_MS).toISOString();
    const service = new TypeSafeAiClassificationService(
      env.TYPESAFE_AI_API_KEY,
      () => newsRepository.listPublishedSince(since, EVIDENCE_LIMIT),
      options.retryDelaysMs,
    );
    // Throws ClassificationUnavailableError if the pipeline itself failed,
    // and omits any region it has no usable answer for. Both cases mean
    // "we learned nothing about those regions", so nothing is written for
    // them and their stored status is left exactly as it was.
    const classifications = await service.classifyRegions({ regions: REGIONS, asOf });

    for (const classification of classifications) {
      await writer.writeClassification(classification, jobRunId);
    }

    const counts: Record<string, number> = {};
    for (const c of classifications) counts[c.status] = (counts[c.status] ?? 0) + 1;

    const classified = new Set(classifications.map((c) => c.regionCode));
    const skippedRegions = REGIONS.filter((r) => !classified.has(r.code)).map((r) => r.code);

    await writer.finishJobRun(jobRunId, "succeeded", { regionCount: classifications.length, counts, skippedRegions });
    return { status: "succeeded", regionCount: classifications.length, counts, skippedRegions };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[scheduler] classification job failed:", message);
    await writer.finishJobRun(jobRunId, "failed", {}, message);
    // Deliberately not re-thrown: a failed run leaves existing regions at
    // their last good status until it naturally expires (see
    // resolveEffectiveStatus) rather than forcing UNKNOWN immediately —
    // one missed hourly run shouldn't blank out the whole site. The
    // failure is still recorded on the job_runs row for diagnosis.
    return { status: "failed", error: message };
  }
}
