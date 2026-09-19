/**
 * Simple keyword heuristic to identify headlines connected to Russia and/or
 * Ukraine — the war, Russian military/political threats, sanctions, border
 * tension, etc. — within the broader set of collected news (which also
 * covers Belarus border activity, Kaliningrad, drone/airspace incidents, and
 * RCB warnings — see `src/domain/news-collection.ts`). Good enough for the
 * `/news` page's filter; not used anywhere classification-related.
 */
const KEYWORDS = [
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
  "crimea",
  "krym",
  "donbas",
  "sankcj", // sankcje, sankcji (sanctions)
  "sanction",
  "agresj", // agresja, agresji (aggression)
  "aggression",
  "zagroż", // zagrożenie, zagrożenia (threat)
  "threat",
];

export function isRussiaUkraineRelated(title: string): boolean {
  const lower = ` ${title.toLowerCase()} `;
  return KEYWORDS.some((keyword) => lower.includes(keyword));
}
