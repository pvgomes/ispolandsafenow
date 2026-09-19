const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const CYRILLIC = /[\u0400-\u04FF]/;
// Very common Polish function words that never appear as English words.
const POLISH_FUNCTION_WORDS =
  /(^|\s)(się|nie|jest|oraz|przy|dla|już|tylko|który|która|które|jak|ale|czy|też|są|był|była|było|będzie|może|nad|pod|przed|przez|bez|wobec|że|po|od|ze|na|w|z|i|o|u)(\s|$|[.,:;!?])/i;
// Letter clusters that are everywhere in Polish and (almost) absent from
// English — catch headlines made only of names and nouns, e.g. "Drony nad Podlasiem".
const POLISH_SPELLING = /rz|cz|sz|(?:ów|ego|ych|ymi|ami|iem)\b/i;

/**
 * Cheap, offline guess at whether a headline still needs translating.
 * Errs towards "yes": anything with Polish diacritics, Cyrillic, or a
 * couple of Polish function words is sent to the translator; the model
 * returns English input unchanged, so a false positive only costs a few
 * neurons — a false negative would leave a Polish headline on the site.
 */
export function looksEnglish(title: string): boolean {
  if (POLISH_DIACRITICS.test(title) || CYRILLIC.test(title)) return false;
  return !POLISH_FUNCTION_WORDS.test(title) && !POLISH_SPELLING.test(title);
}
