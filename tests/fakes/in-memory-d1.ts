/**
 * A minimal in-memory D1Database covering the specific INSERT/UPDATE
 * statements ClassificationWriter and the scheduler job issue — enough to
 * test real read-your-writes behavior without a real Workers runtime.
 * Not a general SQL engine: statements are matched by the table/verb they
 * touch, not actually parsed.
 */
export interface InMemoryRegionRow {
  code: string;
  slug: string;
  name_pl: string;
  name_en: string;
  current_status: string;
  last_classified_at: string | null;
  status_reason: string | null;
  status_driver: string | null;
  updated_at: string;
}

export interface InMemoryClassificationRow {
  id: number;
  region_code: string;
  status: string;
  confidence: number | null;
  rationale: string | null;
  driver: string | null;
  source: string;
  classified_at: string;
  job_run_id: number;
}

export interface InMemoryEvidenceRow {
  id: number;
  classification_id: number;
  source_url: string;
  source_name: string | null;
  title: string | null;
  published_at: string | null;
  excerpt: string | null;
  relevance_score: number | null;
}

export interface InMemoryNewsRow {
  id: number;
  url: string;
  title: string;
  title_en: string | null;
  source_name: string | null;
  published_at: string;
}

export interface InMemoryJobRunRow {
  id: number;
  job_type: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  summary: string | null;
}

class InMemoryStatement {
  private boundArgs: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly db: InMemoryD1Database,
  ) {}

  bind(...args: unknown[]): this {
    this.boundArgs = args;
    return this;
  }

  async run(): Promise<{ success: true }> {
    this.execute();
    return { success: true };
  }

  async first<T>(): Promise<T | null> {
    return (this.execute() as unknown as T) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const result = this.execute();
    return { results: (Array.isArray(result) ? result : [result]) as unknown as T[] };
  }

  private execute(): unknown {
    const sql = this.sql;
    const args = this.boundArgs;

    if (sql.startsWith("INSERT INTO job_runs")) {
      const row: InMemoryJobRunRow = {
        id: this.db.nextJobRunId++,
        job_type: args[0] as string,
        status: "running",
        started_at: args[1] as string,
        finished_at: null,
        error_message: null,
        summary: null,
      };
      this.db.jobRuns.push(row);
      return { id: row.id };
    }

    if (sql.startsWith("UPDATE job_runs")) {
      const [status, finishedAt, summary, errorMessage, id] = args as [string, string, string, string | null, number];
      const row = this.db.jobRuns.find((r) => r.id === id);
      if (row) Object.assign(row, { status, finished_at: finishedAt, summary, error_message: errorMessage });
      return undefined;
    }

    if (sql.startsWith("INSERT INTO region_classifications")) {
      const [regionCode, status, confidence, rationale, driver, classifiedAt, jobRunId] = args as [
        string,
        string,
        number | null,
        string | null,
        string | null,
        string,
        number,
      ];
      const row: InMemoryClassificationRow = {
        id: this.db.nextClassificationId++,
        region_code: regionCode,
        status,
        confidence,
        rationale,
        driver,
        source: "typesafe-ai",
        classified_at: classifiedAt,
        job_run_id: jobRunId,
      };
      this.db.classifications.push(row);
      return { id: row.id };
    }

    if (sql.startsWith("INSERT INTO classification_evidence")) {
      const [classificationId, sourceUrl, sourceName, title, publishedAt, excerpt, relevanceScore] = args as [
        number,
        string,
        string | null,
        string | null,
        string | null,
        string | null,
        number | null,
      ];
      this.db.evidence.push({
        id: this.db.nextEvidenceId++,
        classification_id: classificationId,
        source_url: sourceUrl,
        source_name: sourceName,
        title,
        published_at: publishedAt,
        excerpt,
        relevance_score: relevanceScore,
      });
      return undefined;
    }

    if (sql.startsWith("UPDATE regions")) {
      const [status, lastClassifiedAt, statusReason, statusDriver, updatedAt, code] = args as [
        string,
        string,
        string | null,
        string | null,
        string,
        string,
      ];
      const row = this.db.regions.find((r) => r.code === code);
      if (row) {
        Object.assign(row, {
          current_status: status,
          last_classified_at: lastClassifiedAt,
          status_reason: statusReason,
          status_driver: statusDriver,
          updated_at: updatedAt,
        });
      }
      return undefined;
    }

    if (sql.includes("FROM news_items")) {
      const hasSince = sql.includes("WHERE published_at >=");
      const since = hasSince ? (args[0] as string) : null;
      const limit = (hasSince ? args[1] : args[0]) as number;
      const offset = hasSince && sql.includes("OFFSET") ? (args[2] as number) : 0;
      return [...this.db.news]
        .filter((r) => since === null || r.published_at >= since)
        .sort((a, b) => b.published_at.localeCompare(a.published_at) || b.id - a.id)
        .slice(offset, offset + limit);
    }

    if (sql.includes("FROM classification_evidence")) {
      const [regionCode, limit] = args as [string, number];
      const latest = [...this.db.classifications]
        .filter((c) => c.region_code === regionCode)
        .sort((a, b) => b.classified_at.localeCompare(a.classified_at) || b.id - a.id)[0];
      if (!latest) return [];
      return this.db.evidence
        .filter((e) => e.classification_id === latest.id)
        .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
        .slice(0, limit);
    }

    if (sql.includes("FROM regions") && sql.includes("WHERE code")) {
      return this.db.regions.find((r) => r.code === args[0]) ?? null;
    }
    if (sql.includes("FROM regions")) {
      return [...this.db.regions].sort((a, b) => a.code.localeCompare(b.code));
    }

    throw new Error(`InMemoryD1Database: unhandled statement: ${sql}`);
  }
}

export class InMemoryD1Database {
  nextJobRunId = 1;
  nextClassificationId = 1;
  nextEvidenceId = 1;
  jobRuns: InMemoryJobRunRow[] = [];
  classifications: InMemoryClassificationRow[] = [];
  evidence: InMemoryEvidenceRow[] = [];

  constructor(
    public regions: InMemoryRegionRow[],
    public news: InMemoryNewsRow[] = [],
  ) {}

  prepare(sql: string) {
    return new InMemoryStatement(sql, this);
  }
}
