import { REGIONS } from "../../src/data/regions";
import type { FakeRegionRow } from "./fake-d1";

/** Mirrors what migrations/0002_seed_regions.sql produces: 16 rows, all UNKNOWN until classified. */
export function buildSeededRows(): FakeRegionRow[] {
  return REGIONS.map((region) => ({
    code: region.code,
    slug: region.slug,
    name_pl: region.namePl,
    name_en: region.nameEn,
    current_status: "UNKNOWN",
    last_classified_at: null,
    status_reason: null,
    status_driver: null,
  }));
}
