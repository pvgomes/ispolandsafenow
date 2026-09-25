import { ALERT_LEVEL_PRESENTATION, type AlertLevel } from "./alert-level";
import type { NationalSummary } from "./national-summary";

/**
 * A visible question-and-answer pair. These exist because the way people
 * actually search for this site is as a question ("is Poland safe to visit
 * right now?", "is it safe to travel to Poland because of Russia?"), so the
 * pages answer those questions in words, from the same live data the map
 * uses — never as invented reassurance.
 */
export interface FaqEntry {
  readonly question: string;
  readonly answer: string;
}

/** Plain-English sentence describing what the current national colour means. */
function nationalVerdict(summary: NationalSummary): string {
  const { headlineLevel, counts, totalRegions } = summary;
  if (totalRegions === 0 || headlineLevel === "UNKNOWN") {
    return "There is currently not enough verified information to summarize the situation across Poland, so no region is being reported as clear.";
  }
  if (headlineLevel === "CALM") {
    return `Nothing notable has been reported in any of Poland's ${totalRegions} voivodeships in the latest update. Poland is not at war, and day-to-day life in cities such as Warsaw, Kraków and Gdańsk is running normally.`;
  }
  if (headlineLevel === "LOW") {
    return `${counts.LOW} of Poland's ${totalRegions} voivodeships show minor or indirect signals in the news, and nothing beyond that. Poland is not at war, and normal life — travel, work, tourism — is unaffected.`;
  }
  if (headlineLevel === "ELEVATED") {
    return `${counts.ELEVATED} of Poland's ${totalRegions} voivodeships currently show a situation worth paying attention to, and there is no confirmed attack on the ground anywhere in Poland. Poland is not at war, but it borders Ukraine, Belarus and Kaliningrad, so local disruption is possible.`;
  }
  return `${counts.CRITICAL} of Poland's ${totalRegions} voivodeships have had a confirmed impact on the ground — an attack, explosion or crash causing damage${
    counts.ELEVATED > 0 ? `, and ${counts.ELEVATED} more show a situation worth paying attention to` : ""
  }. Check the affected regions before travelling and follow instructions from Polish authorities.`;
}

function formatUpdated(lastUpdatedIso: string): string {
  const date = new Date(lastUpdatedIso);
  if (Number.isNaN(date.getTime())) return "the most recent update";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/**
 * Homepage FAQ: the questions visitors type into a search engine before they
 * travel, answered from the current national roll-up.
 */
export function buildNationalFaq(summary: NationalSummary, lastUpdatedIso: string): FaqEntry[] {
  const verdict = nationalVerdict(summary);
  const updated = formatUpdated(lastUpdatedIso);

  return [
    {
      question: "Is Poland safe to visit right now?",
      answer: `${verdict} This page is refreshed every hour from public news reporting — last updated ${updated}. It is an independent information service, not an official warning system, so always check your government's travel advice before you go.`,
    },
    {
      question: "Is it safe to travel to Poland because of Russia and the war in Ukraine?",
      answer:
        "Poland is a NATO and EU member and is not a party to the war in Ukraine. The war does affect Poland indirectly: drone and airspace violations, temporary airport or airspace closures, and military activity near the eastern border have all been reported. Those effects are regional, which is why this site tracks each of the 16 voivodeships separately rather than giving Poland a single score.",
    },
    {
      question: "Is Poland at war with Russia?",
      answer:
        "No. Poland is not at war. It borders Ukraine, Belarus and the Russian exclave of Kaliningrad, and it hosts NATO forces, but there is no armed conflict on Polish territory. Incidents that do occur — such as drones crossing into Polish airspace — are reported here per region, with the news stories behind each status.",
    },
    {
      question: "Which parts of Poland should travellers pay the most attention to?",
      answer:
        "The eastern and north-eastern voivodeships along the Ukrainian, Belarusian and Kaliningrad borders — Lubelskie, Podkarpackie, Podlaskie and Warmińsko-mazurskie — are the ones most often named in security reporting. Central and western Poland, including Warsaw, Kraków, Wrocław and Poznań, is usually unaffected. Open any region on the map to see its current colour and why.",
    },
    {
      question: "Is it safe to fly to Poland right now?",
      answer:
        "Polish airports operate normally most of the time, but airspace over eastern Poland has been closed temporarily during past incidents, which can delay or divert flights. Check the current status of the region you are flying into, and confirm directly with your airline before travelling.",
    },
    {
      question: "How often is this safety status updated?",
      answer: `Every hour. A scheduled job collects recent Polish and international news coverage and an AI model assigns each voivodeship a status based only on what that reporting says. The latest status shown here is from ${updated}. See the methodology page for how it works and where it falls short.`,
    },
    {
      question: "What should I do if there is an emergency in Poland?",
      answer:
        "Call 112, the pan-European emergency number, which works throughout Poland. Follow instructions from Polish authorities and RCB alerts sent to mobile phones. This site cannot guarantee safety and is not affiliated with the Polish government or any emergency service.",
    },
  ];
}

export interface RegionFaqInput {
  readonly namePl: string;
  /** English exonym ("Masovia"), when the region has one worth showing. */
  readonly englishName?: string;
  readonly currentStatus: AlertLevel;
  readonly statusReason: string | null;
  readonly capitalName?: string;
  readonly cityNames: readonly string[];
}

/**
 * Region FAQ: the same travel questions, narrowed to one voivodeship and its
 * best-known cities, so a search for "is Kraków safe to visit right now"
 * lands on the page that actually answers it.
 */
export function buildRegionFaq(region: RegionFaqInput): FaqEntry[] {
  const presentation = ALERT_LEVEL_PRESENTATION[region.currentStatus];
  const place = region.capitalName ? `${region.namePl} (${region.capitalName})` : region.namePl;
  const reason = region.statusReason ?? presentation.description;
  const cityList = region.cityNames.slice(0, 3).join(", ");
  const travelName = region.englishName ? `${region.namePl} (${region.englishName})` : region.namePl;

  const entries: FaqEntry[] = [
    {
      question: `Is ${region.namePl} safe to visit right now?`,
      answer: `The current status for ${place} is ${presentation.label.toLowerCase()} — ${presentation.description.toLowerCase().replace(/\.$/, "")}. ${reason} This status is refreshed every hour from public news reporting and is not an official warning.`,
    },
    {
      question: `Is it safe to travel to ${travelName} because of Russia and the war in Ukraine?`,
      answer: `Poland is a NATO and EU member and is not at war. The war in Ukraine can still affect Polish regions indirectly through airspace incidents, border activity and transport disruption, so ${region.namePl} is assessed separately every hour against recent news coverage. Its status right now is ${presentation.label.toLowerCase()}.`,
    },
  ];

  if (cityList.length > 0) {
    entries.push({
      question: `Is it safe to travel to ${cityList} right now?`,
      answer: `${cityList} ${region.cityNames.length === 1 ? "is" : "are"} in ${region.namePl}, so the status on this page applies: ${presentation.label.toLowerCase()}. ${reason}`,
    });
  }

  entries.push({
    question: `What should I do in an emergency in ${region.namePl}?`,
    answer:
      "Call 112, which works anywhere in Poland, follow instructions from Polish authorities, and pay attention to RCB alerts sent to mobile phones. This site is an independent information service and cannot guarantee safety.",
  });

  return entries;
}

/** Schema.org FAQPage graph, so the answers can appear directly in search results. */
export function faqPageJsonLd(entries: readonly FaqEntry[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}
