/**
 * Controls where a city is drawn on the interactive map. Every city is
 * always listed in the region details panel and region page regardless.
 *
 * - "always": drawn at every viewport size (regional capitals).
 * - "wide":   only drawn on wider screens, where there is room for a second
 *             label without turning the map into a road atlas.
 * - "never":  listed in text only.
 */
export type CityMapVisibility = "always" | "wide" | "never";

/** Where the text label sits relative to the city marker. */
export type CityLabelAnchor = "start" | "middle" | "end";

export interface MajorCity {
  /** Display name — the form most recognisable to an English-speaking visitor. */
  readonly name: string;
  /** Slug of the voivodeship this city belongs to (see src/data/regions.ts). */
  readonly regionSlug: string;
  /** WGS84 latitude, decimal degrees. */
  readonly lat: number;
  /** WGS84 longitude, decimal degrees. */
  readonly lon: number;
  /** True for the seat of the voivodeship (Warsaw, Kraków, Gdańsk, ...). */
  readonly isCapital: boolean;
  /** Alternate spellings/exonyms used for search only (e.g. "Warszawa", "Cracow"). */
  readonly aliases?: readonly string[];
  readonly mapVisibility: CityMapVisibility;
  /** Defaults to "start" (label to the right of the marker). */
  readonly labelAnchor?: CityLabelAnchor;
  /** Optional vertical nudge for the label, in SVG user units. */
  readonly labelDy?: number;
}

/**
 * Lower-cases and strips diacritics so "Krakow", "kraków" and "KRAKÓW" all
 * compare equal — visitors rarely type Polish letters. Also handles the
 * stroked Ł, which NFD does not decompose.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase()
    .trim();
}

export function cityMatchesQuery(city: MajorCity, query: string): boolean {
  const normalized = normalizeForSearch(query);
  if (normalized.length === 0) return false;
  const candidates = [city.name, ...(city.aliases ?? [])];
  return candidates.some((candidate) => normalizeForSearch(candidate).startsWith(normalized));
}

/** Capital first, then in the order the dataset lists them. */
export function citiesForRegion(cities: readonly MajorCity[], regionSlug: string): MajorCity[] {
  return cities
    .filter((city) => city.regionSlug === regionSlug)
    .sort((a, b) => Number(b.isCapital) - Number(a.isCapital));
}

export function capitalOfRegion(cities: readonly MajorCity[], regionSlug: string): MajorCity | undefined {
  return cities.find((city) => city.regionSlug === regionSlug && city.isCapital);
}

/** "Kraków (capital), Tarnów, Nowy Sącz, Zakopane" */
export function formatCityList(cities: readonly MajorCity[]): string {
  return cities.map((city) => (city.isCapital ? `${city.name} (capital)` : city.name)).join(", ");
}
