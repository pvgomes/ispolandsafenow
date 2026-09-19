import { isAlertLevel, toAlertLevel, type AlertLevel } from "./alert-level";
import type { ClassificationEvidence, ClassificationInput, ClassificationService, RegionClassification } from "./classification-service";
import type { NewsItem } from "./news-item";
import type { RegionIdentity } from "./region";

const TYPESAFE_AI_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const TYPESAFE_AI_MODEL = "jev-latest";

/** Freshness window applied to every classification this service produces. */
const CLASSIFICATION_TTL_MS = 2 * 60 * 60 * 1000;

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
    `Treat these headlines as your primary evidence. Default to GREEN (no elevated regional signal found) for any ` +
    `region with no relevant headline above and no other strong, current signal — do not invent incidents the ` +
    `headlines don't mention. Only choose YELLOW or RED when the evidence actually supports an elevated situation ` +
    `or a confirmed incident for that specific region.`
  );
}

function buildQuestions(regions: readonly RegionIdentity[]) {
  const questions: Record<string, unknown> = {};
  for (const region of regions) {
    questions[region.code] = {
      type: "choice",
      instructions: `Based on the headlines above, what is the current security-alert level for the ${region.nameEn} voivodeship (Polish: ${region.namePl}), Poland?`,
      criteria: {
        GREEN: "No elevated regional signal found in the evidence — the default when nothing relevant was reported.",
        YELLOW: "An elevated situation requiring attention, supported by the evidence.",
        RED: "A serious active warning or confirmed incident, supported by the evidence.",
      },
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
 * The model is only ever offered GREEN/YELLOW/RED — that is its
 * *assessment* of the evidence, and GREEN is the correct, safe answer
 * when there is genuinely nothing to report. UNKNOWN is reserved
 * entirely for this code's own pipeline-failure paths (missing API key,
 * request failure, non-2xx response, unparseable JSON, a missing or
 * unrecognized answer for a region) — never for "the model looked and
 * found nothing," which is GREEN. Missing/untrustworthy *data* must
 * still never resolve to GREEN; that invariant now lives at the
 * pipeline-failure boundary instead of in the model's own choices.
 */
export class TypeSafeAiClassificationService implements ClassificationService {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly evidenceSource: EvidenceSource,
  ) {}

  async classifyRegions(input: ClassificationInput): Promise<RegionClassification[]> {
    if (!this.apiKey) {
      return input.regions.map((region) => this.unknownClassification(region, input.asOf, "TYPESAFE_AI_API_KEY is not configured."));
    }

    const news = await this.evidenceSource();
    const evidence = toEvidence(news);

    let response: Response;
    try {
      response = await fetch(TYPESAFE_AI_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          state: buildStatePrompt(input.asOf, news),
          model: TYPESAFE_AI_MODEL,
          questions: buildQuestions(input.regions),
        }),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "network error";
      console.error("[typesafe-ai] request failed:", reason);
      return input.regions.map((region) => this.unknownClassification(region, input.asOf, `TypeSafe AI request failed: ${reason}`));
    }

    if (!response.ok) {
      console.error("[typesafe-ai] non-ok response:", response.status);
      return input.regions.map((region) =>
        this.unknownClassification(region, input.asOf, `TypeSafe AI returned HTTP ${response.status}.`),
      );
    }

    let body: SystemOneResponse;
    try {
      body = (await response.json()) as SystemOneResponse;
    } catch {
      return input.regions.map((region) => this.unknownClassification(region, input.asOf, "TypeSafe AI response was not valid JSON."));
    }

    const expiresAt = new Date(new Date(input.asOf).getTime() + CLASSIFICATION_TTL_MS).toISOString();
    return input.regions.map((region) => {
      const answer = body.answers?.[region.code];
      if (!isChoiceAnswer(answer)) {
        return this.unknownClassification(region, input.asOf, "TypeSafe AI returned no usable answer for this region.");
      }

      if (!isAlertLevel(answer.choice) || answer.choice === "UNKNOWN") {
        return this.unknownClassification(
          region,
          input.asOf,
          `TypeSafe AI returned an unrecognized choice ("${answer.choice}").`,
        );
      }

      const status: AlertLevel = toAlertLevel(answer.choice);
      const confidence = typeof answer.confidence === "number" ? answer.confidence : null;
      const confidenceSuffix = confidence !== null ? ` (confidence ${confidence.toFixed(2)})` : "";

      return {
        regionCode: region.code,
        status,
        confidence,
        rationale: `TypeSafe AI (model ${TYPESAFE_AI_MODEL}) classification from collected headlines${confidenceSuffix}.`,
        classifiedAt: input.asOf,
        expiresAt,
        evidence,
      };
    });
  }

  private unknownClassification(region: RegionIdentity, asOf: string, rationale: string): RegionClassification {
    return {
      regionCode: region.code,
      status: "UNKNOWN",
      confidence: null,
      rationale,
      classifiedAt: asOf,
      expiresAt: null,
      evidence: [],
    };
  }
}
