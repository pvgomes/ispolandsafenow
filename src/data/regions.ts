import type { RegionIdentity } from "../domain/region";

/**
 * Canonical identity data for the 16 Polish voivodeships. This mirrors
 * migrations/0002_seed_regions.sql — it exists so map/UI code and tests
 * don't need a database round trip just to know the region list, and it
 * matches map SVG `data-code`/`data-slug` attributes produced by
 * scripts/convert-map.mjs.
 */
export const REGIONS: readonly RegionIdentity[] = [
  { code: "PL-02", slug: "dolnoslaskie", namePl: "Dolnośląskie", nameEn: "Dolnoslaskie (Lower Silesia)" },
  { code: "PL-04", slug: "kujawsko-pomorskie", namePl: "Kujawsko-Pomorskie", nameEn: "Kujawsko-Pomorskie" },
  { code: "PL-06", slug: "lubelskie", namePl: "Lubelskie", nameEn: "Lubelskie" },
  { code: "PL-08", slug: "lubuskie", namePl: "Lubuskie", nameEn: "Lubuskie" },
  { code: "PL-10", slug: "lodzkie", namePl: "Łódzkie", nameEn: "Lodzkie" },
  { code: "PL-12", slug: "malopolskie", namePl: "Małopolskie", nameEn: "Malopolskie (Lesser Poland)" },
  { code: "PL-14", slug: "mazowieckie", namePl: "Mazowieckie", nameEn: "Mazowieckie (Masovia)" },
  { code: "PL-16", slug: "opolskie", namePl: "Opolskie", nameEn: "Opolskie" },
  { code: "PL-18", slug: "podkarpackie", namePl: "Podkarpackie", nameEn: "Podkarpackie" },
  { code: "PL-20", slug: "podlaskie", namePl: "Podlaskie", nameEn: "Podlaskie" },
  { code: "PL-22", slug: "pomorskie", namePl: "Pomorskie", nameEn: "Pomorskie (Pomerania)" },
  { code: "PL-24", slug: "slaskie", namePl: "Śląskie", nameEn: "Slaskie (Silesia)" },
  { code: "PL-26", slug: "swietokrzyskie", namePl: "Świętokrzyskie", nameEn: "Swietokrzyskie" },
  { code: "PL-28", slug: "warminsko-mazurskie", namePl: "Warmińsko-Mazurskie", nameEn: "Warminsko-Mazurskie" },
  { code: "PL-30", slug: "wielkopolskie", namePl: "Wielkopolskie", nameEn: "Wielkopolskie (Greater Poland)" },
  { code: "PL-32", slug: "zachodniopomorskie", namePl: "Zachodniopomorskie", nameEn: "Zachodniopomorskie" },
];

export function findRegionBySlug(slug: string): RegionIdentity | undefined {
  return REGIONS.find((region) => region.slug === slug);
}
