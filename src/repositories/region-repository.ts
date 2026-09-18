import { toAlertLevel } from "../domain/alert-level";
import type { RegionWithStatus } from "../domain/region";

interface RegionRow {
  code: string;
  slug: string;
  name_pl: string;
  name_en: string;
  current_status: string;
  last_classified_at: string | null;
  status_expires_at: string | null;
}

function rowToRegion(row: RegionRow): RegionWithStatus {
  return {
    code: row.code,
    slug: row.slug,
    namePl: row.name_pl,
    nameEn: row.name_en,
    currentStatus: toAlertLevel(row.current_status),
    lastClassifiedAt: row.last_classified_at,
    statusExpiresAt: row.status_expires_at,
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
      .prepare(
        "SELECT code, slug, name_pl, name_en, current_status, last_classified_at, status_expires_at FROM regions ORDER BY code",
      )
      .all<RegionRow>();
    return results.map(rowToRegion);
  }

  async findBySlug(slug: string): Promise<RegionWithStatus | null> {
    const row = await this.db
      .prepare(
        "SELECT code, slug, name_pl, name_en, current_status, last_classified_at, status_expires_at FROM regions WHERE slug = ?1",
      )
      .bind(slug)
      .first<RegionRow>();
    return row ? rowToRegion(row) : null;
  }

  async count(): Promise<number> {
    const row = await this.db.prepare("SELECT COUNT(*) as count FROM regions").first<{ count: number }>();
    return row?.count ?? 0;
  }
}
