/**
 * Keyword heuristic applied to collected headlines before they are stored
 * in `news_items`. Google News search results are topical but noisy
 * (sports, culture, unrelated politics), so a headline must match at least
 * one *actor/place* term (Poland, Russia, Ukraine, Belarus, Kaliningrad,
 * NATO) and at least one *security-context* term (war, drone, border,
 * attack, warning, ...). Polish stems are matched as substrings so that
 * inflected forms (Rosja/Rosji/rosyjski, wojna/wojny/wojennej) all count;
 * English terms are matched on word boundaries so that e.g. "war" does not
 * fire on "Warsaw" or "warning".
 */
const ACTOR_STEMS = [
  // Poland
  "polsk", // Polska, polski, polskiej, polsko-
  "poland",
  "polish",
  "warszaw",
  "warsaw",
  "rzeszów",
  "rzeszow",
  "lublin",
  "podlas",
  "podkarpac",
  "mazowie",
  // Russia / Ukraine / Belarus / Kaliningrad / NATO / RCB
  "rosj",
  "rosyjsk",
  "russia",
  "kreml",
  "kremlin",
  "putin",
  "moskw",
  "moscow",
  "ukrain",
  "kijów",
  "kijow",
  "kyiv",
  "zełensk",
  "zelensk",
  "białoru",
  "bialoru",
  "belarus",
  "łukaszenk",
  "lukashenk",
  "kaliningrad",
  "królewiec",
  "nato",
  "rcb",
];

const CONTEXT_STEMS = [
  "wojn", // wojna, wojny, wojenny
  "wojsk", // wojsko, wojskowy
  "armi",
  "żołnierz",
  "dron",
  "rakiet",
  "pocisk",
  "atak",
  "ostrzał",
  "uderzen",
  "eksplozj",
  "wybuch",
  "granic",
  "przestrze", // przestrzeń powietrzna
  "lotnisk",
  "myśliw",
  "alarm",
  "ostrzeż",
  "zagroż",
  "bezpiecze",
  "obron",
  "sankcj",
  "agresj",
  "inwazj",
  "prowokac",
  "sabota",
  "dywersj",
  "szpieg",
  "hybrydow",
  "cyberatak",
  "mobilizac",
  "ewakuac",
  "schron",
  "migran",
  "zapor",
  "tarcza",
  "rozejm",
  "pokojow",
  "eskalac",
  "groź", // groźba, groźby
  "grozi",
  "napię", // napięcie
  "konflikt",
  "kryzys",
  "front",
];

const CONTEXT_WORDS =
  /\b(?:wars?|warfare|wartime|militar\w*|troops?|soldiers?|army|drones?|missiles?|rockets?|attack\w*|strikes?|shelling|explosions?|border\w*|airspace|airports?|fighter jets?|alerts?|warnings?|threat\w*|security|defen[cs]e|sanction\w*|aggression|invasion|provocation\w*|sabotage|spy|spies|espionage|hybrid|cyberattack\w*|mobili[sz]ation|evacuat\w*|shelters?|migrants?|ceasefire|peace talks|escalat\w*|conflict|crisis|frontline|front line)\b/i;

function containsAny(haystack: string, stems: readonly string[]): boolean {
  return stems.some((stem) => haystack.includes(stem));
}

// Social aggregators (e.g. wykop.pl) surface user posts that are little
// more than a hashtag cloud; they match every stem and say nothing.
const HASHTAG_SPAM_THRESHOLD = 3;

export function isRelevantHeadline(title: string): boolean {
  if ((title.match(/#\w/g)?.length ?? 0) >= HASHTAG_SPAM_THRESHOLD) return false;
  const lower = title.toLowerCase();
  return containsAny(lower, ACTOR_STEMS) && (containsAny(lower, CONTEXT_STEMS) || CONTEXT_WORDS.test(title));
}
