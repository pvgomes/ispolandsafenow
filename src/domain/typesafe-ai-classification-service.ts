import { isAlertLevel, toAlertLevel, type AlertLevel } from "./alert-level";
import { ClassificationUnavailableError } from "./classification-service";
import type { ClassificationEvidence, ClassificationInput, ClassificationService, RegionClassification } from "./classification-service";
import type { MajorCity } from "./city";
import type { NewsItem } from "./news-item";
import { newsForRegion } from "./region-news-match";
import type { RegionIdentity } from "./region";
import { buildStatusReason, STATUS_DRIVERS, toStatusDriver } from "./status-reason";
import { MAJOR_CITIES } from "../data/cities";

const TYPESAFE_AI_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const TYPESAFE_AI_MODEL = "jev-latest";

/** Most region-specific headlines stored as evidence for one region. */
const MAX_EVIDENCE_PER_REGION = 8;

/** Suffix of the second question asked per region: why that colour. */
const DRIVER_QUESTION_SUFFIX = ":driver";

/** Attempts (including the first) for one System One request. */
const MAX_ATTEMPTS = 3;
/** Backoff before attempt 2 and attempt 3. */
const RETRY_DELAYS_MS = [2_000, 5_000];

/** Transient upstream conditions worth retrying within the same run. */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/** Supplies the headlines used as evidence for one classification run. */
export type EvidenceSource = () => Promise<readonly NewsItem[]>;

interface ChoiceAnswer {
  readonly type: "choice";
  readonly choice: string;
  readonly confidence?: number;
}

interface SystemOneResponse {
  readonly answers?: Record<string, { type?: string; choice?: string; confidence?: number }>;
}

function buildStatePrompt(asOf: string, news: readonly NewsItem[]): string {
  const newsBlock =
    news.length > 0
      ? news
          .map((item) => `- [${item.publishedAt}]${item.sourceName ? ` (${item.sourceName})` : ""} ${item.title} — ${item.url}`)
          .join("\n")
      : "(No recent news items could be retrieved for this run.)";

  return (
    `You are assessing the current regional security-alert exposure across Poland's 16 voivodeships, as of ${asOf}. ` +
    `Below are recent headlines collected from public news portals (mainly Polish, plus some international ` +
    `coverage), covering roughly the last 48 hours:\n\n${newsBlock}\n\n` +
    `Treat these headlines as your primary evidence. Default to CALM for any region with no relevant headline ` +
    `above and no other strong, current signal — do not invent incidents the headlines don't mention.\n\n` +
    `Be conservative and proportionate: this site is read by ordinary residents and travellers, and an ` +
    `overstated level is a real harm, not a safe error. Routine reporting — NATO exercises, political ` +
    `statements, general war coverage, a distant incident elsewhere in Poland — is CALM or at most LOW for a ` +
    `given region. Reserve ELEVATED for a concrete, current situation actually affecting that region. ` +
    `CRITICAL means one thing only: something physically struck the ground in that region — a missile, drone, ` +
    `aircraft, explosion or falling debris that caused damage, casualties or wreckage there. Threats, ` +
    `overflights, airspace violations with no impact, intercepted or shot-down objects with no damage, ` +
    `sabotage suspicions and warnings are never CRITICAL, no matter how prominent the headline.\n\n` +
    `For each region you are asked twice: once for the alert level, and once for the single main reason behind ` +
    `that level. The reason must be consistent with the level you chose and with the headlines above — visitors ` +
    `are shown it as the explanation for the colour on the map.`
  );
}

function driverCriteria(): Record<string, string> {
  const criteria: Record<string, string> = {};
  for (const [driver, presentation] of Object.entries(STATUS_DRIVERS)) {
    criteria[driver] = presentation.criteria;
  }
  return criteria;
}

/**
 * Two questions per region: the colour, and the single main reason for
 * it. System One only answers in structured form, so the "why" is a
 * second `choice` question rather than free text — the sentence visitors
 * read is rendered from that choice by `buildStatusReason`.
 */
function buildQuestions(regions: readonly RegionIdentity[]) {
  const questions: Record<string, unknown> = {};
  for (const region of regions) {
    questions[region.code] = {
      type: "choice",
      instructions: `Based on the headlines above, what is the current security-alert level for the ${region.nameEn} voivodeship (Polish: ${region.namePl}), Poland?`,
      criteria: {
        CALM: "Nothing notable was reported for this region — the default, and the expected answer for most regions on most days.",
        LOW: "Only minor or indirect signals concern this region: routine military exercises, political or diplomatic news, general war-in-Ukraine coverage, or an incident far away in another part of Poland. Nothing that changes what a resident or visitor should do.",
        ELEVATED: "A concrete, current situation is actually affecting this region — for example an airspace violation, a closed airport, a sabotage investigation, or a serious official warning. Use this even for serious situations, as long as nothing has physically struck the ground here.",
        CRITICAL: "Only when the evidence confirms a physical impact on the ground in this region: a missile, drone, aircraft, explosion or falling debris that caused damage, casualties or wreckage here. Threats, overflights, interceptions without damage and warnings do not qualify.",
      },
    };
    questions[`${region.code}${DRIVER_QUESTION_SUFFIX}`] = {
      type: "choice",
      instructions: `What is the single main reason for that level in the ${region.nameEn} voivodeship (Polish: ${region.namePl})? Pick NOTHING_NOTABLE whenever the level is CALM and no headline above concerns this region.`,
      criteria: driverCriteria(),
    };
  }
  return questions;
}

function isChoiceAnswer(value: unknown): value is ChoiceAnswer {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "choice" &&
    typeof (value as { choice?: unknown }).choice === "string"
  );
}

function toEvidence(news: readonly NewsItem[]): ClassificationEvidence[] {
  return news.map((item) => ({
    sourceUrl: item.url,
    sourceName: item.sourceName,
    title: item.title,
    publishedAt: item.publishedAt,
    excerpt: null,
    relevanceScore: null,
  }));
}

/**
 * The current, live implementation of `ClassificationService`: takes the
 * recent headlines supplied by `evidenceSource` (in production, the last
 * 48 hours of `news_items` via `NewsRepository`) and calls TypeSafe AI's
 * System One API (`jev-latest`) with that evidence, one "choice" question
 * per region. Intended to be called by the scheduled worker
 * (`scheduler/src/index.ts`), roughly once per hour — not per site
 * visitor — so the site itself only ever reads the persisted result from
 * D1 (see `RegionRepository`); it never calls this service directly.
 *
 * The model is only ever offered CALM/LOW/ELEVATED/CRITICAL — that is
 * its *assessment* of the evidence, and CALM is the correct, safe answer
 * when there is genuinely nothing to report, never "we don't know."
 *
 * This service never returns UNKNOWN. A pipeline failure (missing API
 * key, unreachable or erroring upstream after retries, unparseable body,
 * no usable answer for any region) raises
 * `ClassificationUnavailableError`, and a region whose individual answer
 * is missing or unrecognized is simply omitted from the result. Either
 * way the caller writes nothing for the affected regions, so their last
 * good status simply stands until a later run replaces it (see
 * `resolveEffectiveStatus`). Missing or untrustworthy data still never
 * resolves to CALM — it just no longer destroys the previous assessment
 * the moment upstream hiccups.
 */
export class TypeSafeAiClassificationService implements ClassificationService {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly evidenceSource: EvidenceSource,
    /** Backoff between retries; overridable so tests don't actually wait. */
    private readonly retryDelaysMs: readonly number[] = RETRY_DELAYS_MS,
    /** City list used to decide which headlines concern which region. */
    private readonly cities: readonly MajorCity[] = MAJOR_CITIES,
  ) {}

  async classifyRegions(input: ClassificationInput): Promise<RegionClassification[]> {
    if (!this.apiKey) {
      throw new ClassificationUnavailableError("TYPESAFE_AI_API_KEY is not configured.");
    }

    const news = await this.evidenceSource();

    const response = await this.requestWithRetry({
      state: buildStatePrompt(input.asOf, news),
      model: TYPESAFE_AI_MODEL,
      questions: buildQuestions(input.regions),
    });

    let body: SystemOneResponse;
    try {
      body = (await response.json()) as SystemOneResponse;
    } catch {
      throw new ClassificationUnavailableError("TypeSafe AI response was not valid JSON.");
    }

    const classifications: RegionClassification[] = [];

    for (const region of input.regions) {
      const answer = body.answers?.[region.code];
      if (!isChoiceAnswer(answer)) {
        // One missing answer is missing data for that region only: skip it
        // so its stored status is left untouched rather than overwritten.
        console.warn(`[typesafe-ai] no usable answer for ${region.code}; leaving its stored status untouched`);
        continue;
      }

      if (!isAlertLevel(answer.choice) || answer.choice === "UNKNOWN") {
        console.warn(`[typesafe-ai] unrecognized choice "${answer.choice}" for ${region.code}; leaving its stored status untouched`);
        continue;
      }

      const status: AlertLevel = toAlertLevel(answer.choice);
      const confidence = typeof answer.confidence === "number" ? answer.confidence : null;

      const driverAnswer = body.answers?.[`${region.code}${DRIVER_QUESTION_SUFFIX}`];
      const driver = isChoiceAnswer(driverAnswer) ? toStatusDriver(driverAnswer.choice) : null;

      // Only the headlines that actually name this region are kept, so a
      // region page shows the stories behind *its* colour rather than the
      // whole national feed repeated 16 times.
      const regionNews = newsForRegion(news, region, this.cities).slice(0, MAX_EVIDENCE_PER_REGION);

      classifications.push({
        regionCode: region.code,
        status,
        confidence,
        rationale: buildStatusReason({
          status,
          driver,
          regionName: region.namePl,
          matchedHeadlineCount: regionNews.length,
        }),
        driver,
        classifiedAt: input.asOf,
        evidence: toEvidence(regionNews),
      });
    }

    if (classifications.length === 0) {
      throw new ClassificationUnavailableError("TypeSafe AI returned no usable answer for any region.");
    }

    return classifications;
  }

  /**
   * One POST to System One, retried on the failures that are typically
   * transient (network errors, HTTP 429, HTTP 5xx — the class of failure
   * that blanked the map on 2026-09-21). Anything still failing after the
   * last attempt raises `ClassificationUnavailableError`, which keeps the
   * previously stored statuses in place.
   */
  private async requestWithRetry(payload: unknown): Promise<Response> {
    let lastReason = "unknown error";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(TYPESAFE_AI_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        lastReason = `request failed: ${error instanceof Error ? error.message : "network error"}`;
        console.error(`[typesafe-ai] attempt ${attempt}/${MAX_ATTEMPTS} ${lastReason}`);
        await this.delayBeforeRetry(attempt);
        continue;
      }

      if (response.ok) {
        return response;
      }

      lastReason = `returned HTTP ${response.status}`;
      console.error(`[typesafe-ai] attempt ${attempt}/${MAX_ATTEMPTS} ${lastReason}`);

      if (!isRetryableStatus(response.status)) {
        break;
      }

      await this.delayBeforeRetry(attempt);
    }

    throw new ClassificationUnavailableError(`TypeSafe AI ${lastReason}.`);
  }

  private async delayBeforeRetry(attempt: number): Promise<void> {
    if (attempt >= MAX_ATTEMPTS) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, this.retryDelaysMs[attempt - 1] ?? 0));
  }
}
