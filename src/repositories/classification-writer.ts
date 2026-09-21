import type { RegionClassification } from "../domain/classification-service";

export type JobStatus = "running" | "succeeded" | "failed";

/**
 * Writes classification results to D1: a `job_runs` row per scheduler
 * invocation, a `region_classifications` + `classification_evidence` row
 * per region per run (full history, nothing overwritten), and updates
 * each `regions` row's current snapshot (`current_status`,
 * `last_classified_at`, `status_reason`, `status_driver`) so `RegionRepository` reads
 * stay O(1) — no join or "latest classification" query needed on the
 * site's hot read path.
 */
export class ClassificationWriter {
  constructor(private readonly db: D1Database) {}

  async startJobRun(jobType: string): Promise<number> {
    const now = new Date().toISOString();
    const row = await this.db
      .prepare("INSERT INTO job_runs (job_type, status, started_at) VALUES (?1, 'running', ?2) RETURNING id")
      .bind(jobType, now)
      .first<{ id: number }>();
    if (!row) throw new Error("Failed to insert job_runs row");
    return row.id;
  }

  async finishJobRun(jobRunId: number, status: JobStatus, summary: Record<string, unknown>, errorMessage?: string): Promise<void> {
    await this.db
      .prepare("UPDATE job_runs SET status = ?1, finished_at = ?2, summary = ?3, error_message = ?4 WHERE id = ?5")
      .bind(status, new Date().toISOString(), JSON.stringify(summary), errorMessage ?? null, jobRunId)
      .run();
  }

  /** Persists one region's classification (+ its evidence) and updates that region's live snapshot. */
  async writeClassification(classification: RegionClassification, jobRunId: number): Promise<void> {
    const classificationRow = await this.db
      .prepare(
        "INSERT INTO region_classifications (region_code, status, confidence, rationale, driver, source, classified_at, job_run_id) " +
          "VALUES (?1, ?2, ?3, ?4, ?5, 'typesafe-ai', ?6, ?7) RETURNING id",
      )
      .bind(
        classification.regionCode,
        classification.status,
        classification.confidence,
        classification.rationale,
        classification.driver,
        classification.classifiedAt,
        jobRunId,
      )
      .first<{ id: number }>();
    if (!classificationRow) throw new Error(`Failed to insert region_classifications row for ${classification.regionCode}`);

    for (const item of classification.evidence) {
      await this.db
        .prepare(
          "INSERT INTO classification_evidence (classification_id, source_url, source_name, title, published_at, excerpt, relevance_score) " +
            "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        )
        .bind(
          classificationRow.id,
          item.sourceUrl,
          item.sourceName,
          item.title,
          item.publishedAt,
          item.excerpt,
          item.relevanceScore,
        )
        .run();
    }

    await this.db
      .prepare(
        "UPDATE regions SET current_status = ?1, last_classified_at = ?2, status_reason = ?3, status_driver = ?4, updated_at = ?5 WHERE code = ?6",
      )
      .bind(
        classification.status,
        classification.classifiedAt,
        classification.rationale,
        classification.driver,
        new Date().toISOString(),
        classification.regionCode,
      )
      .run();
  }
}
