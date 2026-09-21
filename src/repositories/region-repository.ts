import { toAlertLevel } from "../domain/alert-level";
import { resolveEffectiveStatus } from "../domain/region";
import type { RegionWithStatus } from "../domain/region";
import { toStatusDriver } from "../domain/status-reason";

interface RegionRow {
  code: string;
  slug: string;
  name_pl: string;
  name_en: string;
  current_status: string;
  last_classified_at: string | null;
  status_reason: string | null;
  status_driver: string | null;
}

interface EvidenceRow {
  source_url: string;
  source_name: string | null;
  title: string | null;
  published_at: string | null;
}

/** One headline that backed a region's latest classification. */
export interface RegionEvidence {
  readonly sourceUrl: string;
  readonly sourceName: string | null;
  readonly title: string | null;
  readonly publishedAt: string | null;
}

const REGION_COLUMNS =
  "code, slug, name_pl, name_en, current_status, last_classified_at, status_reason, status_driver";

function rowToRegion(row: RegionRow): RegionWithStatus {
  const status = {
    currentStatus: toAlertLevel(row.current_status),
    lastClassifiedAt: row.last_classified_at,
    statusReason: row.status_reason,
    statusDriver: toStatusDriver(row.status_driver),
  };
  return {
    code: row.code,
    slug: row.slug,
    namePl: row.name_pl,
    nameEn: row.name_en,
    // A region that has never been classified reads as UNKNOWN; a
    // classified one keeps its status until a later run replaces it.
    ...status,
    currentStatus: resolveEffectiveStatus(status),
  };
}

/**
 * Typed access to the `regions` table using D1 prepared statements. No ORM:
 * every query here is a plain, reviewable SQL string.
 */
export class RegionRepository {
  constructor(private readonly db: D1Database) {}

  async listAll(): Promise<RegionWithStatus[]> {
    const { results } = await this.db
      .prepare(`SELECT ${REGION_COLUMNS} FROM regions ORDER BY code`)
      .all<RegionRow>();
    return results.map(rowToRegion);
  }

  async findBySlug(slug: string): Promise<RegionWithStatus | null> {
    const row = await this.db
      .prepare(`SELECT ${REGION_COLUMNS} FROM regions WHERE slug = ?1`)
      .bind(slug)
      .first<RegionRow>();
    return row ? rowToRegion(row) : null;
  }

  /**
   * The headlines stored with a region's most recent classification —
   * i.e. the reporting that produced its current colour. Empty when the
   * run found nothing naming that region, in which case callers fall
   * back to Poland-wide headlines.
   */
  async listLatestEvidence(regionCode: string, limit: number): Promise<RegionEvidence[]> {
    const { results } = await this.db
      .prepare(
        "SELECT e.source_url, e.source_name, e.title, e.published_at FROM classification_evidence e " +
          "WHERE e.classification_id = (" +
          "SELECT id FROM region_classifications WHERE region_code = ?1 ORDER BY classified_at DESC, id DESC LIMIT 1" +
          ") ORDER BY e.published_at DESC LIMIT ?2",
      )
      .bind(regionCode, limit)
      .all<EvidenceRow>();
    return results.map((row) => ({
      sourceUrl: row.source_url,
      sourceName: row.source_name,
      title: row.title,
      publishedAt: row.published_at,
    }));
  }

  async count(): Promise<number> {
    const row = await this.db.prepare("SELECT COUNT(*) as count FROM regions").first<{ count: number }>();
    return row?.count ?? 0;
  }
}
