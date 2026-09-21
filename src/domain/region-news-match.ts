import { MAJOR_CITIES } from "../data/cities";
import { citiesForRegion, normalizeForSearch } from "./city";
import type { MajorCity } from "./city";
import type { NewsItem } from "./news-item";
import type { RegionIdentity } from "./region";

/**
 * Colloquial / historical names a headline is far more likely to use than
 * the official adjectival voivodeship name ("Podlasie", not "Podlaskie";
 * "Śląsk", not "Śląskie"). Stored per slug, normalized at match time.
 */
const REGION_NEWS_ALIASES: Record<string, readonly string[]> = {
  dolnoslaskie: ["Dolny Śląsk", "Dolnym Śląsku", "Dolnego Śląska", "Lower Silesia"],
  "kujawsko-pomorskie": ["Kujawy"],
  lubelskie: ["Lubelszczyzna", "Lubelszczyźnie"],
  lubuskie: ["Ziemia Lubuska"],
  lodzkie: ["Ziemia Łódzka"],
  malopolskie: ["Małopolska", "Małopolsce", "Lesser Poland"],
  mazowieckie: ["Mazowsze", "Mazowszu", "Masovia"],
  opolskie: ["Opolszczyzna", "Opolszczyźnie"],
  podkarpackie: ["Podkarpacie", "Podkarpaciu"],
  podlaskie: ["Podlasie", "Podlasiu"],
  pomorskie: ["Pomorze", "Pomorzu", "Kaszuby", "Pomerania"],
  slaskie: ["Śląsk", "Śląsku", "Silesia", "Zagłębie"],
  swietokrzyskie: ["Kielecczyzna"],
  "warminsko-mazurskie": ["Warmia", "Warmii", "Mazury", "Mazurach", "Masuria"],
  wielkopolskie: ["Wielkopolska", "Wielkopolsce", "Greater Poland"],
  zachodniopomorskie: ["Pomorze Zachodnie", "Zachodniopomorskiem"],
};

/** Words that carry no regional signal on their own. */
const STOP_WORDS = new Set(["poland", "polska", "nowy", "nowa", "gora", "wola", "ziemia", "zachodnie"]);

/**
 * Trims Polish inflectional endings down to a stable prefix so that
 * "Mazowieckie", "mazowieckiego" and "na Mazowszu" all match the same
 * region. Matching is prefix-based, so the stem only has to be the part
 * that never changes.
 */
function stem(value: string): string {
  const normalized = normalizeForSearch(value);
  if (normalized.length > 6 && normalized.endsWith("ie")) return normalized.slice(0, -2);
  if (normalized.length > 5 && /[aeiouy]$/.test(normalized)) return normalized.slice(0, -1);
  return normalized;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every term whose presence in a headline means "this story is about this
 * region": the official name, colloquial names, and the region's major
 * cities (including their exonyms, so "Cracow" counts for Małopolskie).
 */
export function regionNewsTerms(region: RegionIdentity, cities: readonly MajorCity[] = MAJOR_CITIES): string[] {
  const raw = [
    region.namePl,
    // "Malopolskie (Lesser Poland)" → the bare name; the parenthetical is
    // already covered by REGION_NEWS_ALIASES where it is a real exonym.
    region.nameEn.replace(/\s*\(.*\)\s*$/, ""),
    ...(REGION_NEWS_ALIASES[region.slug] ?? []),
  ];

  for (const city of citiesForRegion(cities, region.slug)) {
    raw.push(city.name, ...(city.aliases ?? []));
    const [firstWord] = city.name.split(/\s+/);
    if (firstWord && normalizeForSearch(firstWord).length >= 5) raw.push(firstWord);
  }

  const terms = new Set<string>();
  for (const value of raw) {
    const stemmed = stem(value);
    if (stemmed.length >= 4 && !STOP_WORDS.has(stemmed)) terms.add(stemmed);
  }
  return [...terms];
}

/**
 * A term matches only at the start of a word, so "Pomorsk" does not fire
 * on "kujawsko-pomorskie" or "zachodniopomorskie" — each voivodeship keeps
 * its own news.
 */
export function headlineMatchesTerms(headline: string, terms: readonly string[]): boolean {
  const normalized = normalizeForSearch(headline);
  return terms.some((term) => new RegExp(`(?<![\\p{L}-])${escapeRegExp(term)}`, "u").test(normalized));
}

/**
 * The subset of collected headlines that actually name a region or one of
 * its cities — the stories shown on the region page as the reason for its
 * colour, and the evidence stored with its classification.
 */
export function newsForRegion(
  news: readonly NewsItem[],
  region: RegionIdentity,
  cities: readonly MajorCity[] = MAJOR_CITIES,
): NewsItem[] {
  const terms = regionNewsTerms(region, cities);
  return news.filter((item) => headlineMatchesTerms(item.title, terms) || (item.titleEn !== null && headlineMatchesTerms(item.titleEn, terms)));
}
