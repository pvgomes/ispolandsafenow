/**
 * Simple keyword heuristic to identify Russia-Ukraine war related
 * headlines within the broader set of collected news (which also covers
 * Belarus border activity, Kaliningrad, drone/airspace incidents, and
 * RCB warnings — see `src/domain/news-collection.ts`). Good enough for
 * the `/news` page's filter; not used anywhere classification-related.
 */
const WAR_KEYWORDS = [
  "russia",
  "rosj", // Rosja, rosyjsk-, Rosję, etc.
  "ukrain",
  "wojn", // wojna, wojnie, wojny
  " war ",
  "kremlin",
  "kreml",
  "putin",
  "zelensk",
  "invasion",
  "inwazj",
  "moscow",
  "moskw",
];

export function isRussiaWarRelated(title: string): boolean {
  const lower = ` ${title.toLowerCase()} `;
  return WAR_KEYWORDS.some((keyword) => lower.includes(keyword));
}
