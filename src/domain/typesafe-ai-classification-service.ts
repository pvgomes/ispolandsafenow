import { isAlertLevel, toAlertLevel, type AlertLevel } from "./alert-level";
import type { ClassificationEvidence, ClassificationInput, ClassificationService, RegionClassification } from "./classification-service";
import { collectRecentNews, type CollectedNewsItem } from "./news-collection";
import type { RegionIdentity } from "./region";

const TYPESAFE_AI_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const TYPESAFE_AI_MODEL = "jev-latest";

/** Freshness window applied to every classification this service produces. */
const CLASSIFICATION_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * How long a successful result is reused for the same set of regions
 * before re-collecting news and calling TypeSafe AI again. This is an
 * in-isolate cache only (cleared on cold start) — not the persisted,
 * scheduled cache the real pipeline (`scheduler/README.md`) will provide
 * — but it keeps a burst of page loads/API hits from re-running the news
 * collection and paying for a fresh AI call on every single request.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;

const resultCache = new Map<string, { at: number; result: readonly RegionClassification[] }>();

function cacheKey(regions: readonly RegionIdentity[]): string {
  return regions
    .map((r) => r.code)
    .sort()
    .join(",");
}

interface ChoiceAnswer {
  readonly type: "choice";
  readonly choice: string;
  readonly confidence?: number;
}

interface SystemOneResponse {
  readonly answers?: Record<string, { type?: string; choice?: string; confidence?: number }>;
}

function buildStatePrompt(asOf: string, news: readonly CollectedNewsItem[]): string {
  const newsBlock =
    news.length > 0
      ? news
          .map((item) => `- [${item.publishedAt ?? "date unknown"}]${item.sourceName ? ` (${item.sourceName})` : ""} ${item.title} — ${item.url}`)
          .join("\n")
      : "(No recent news items could be retrieved for this run.)";

  return (
    `You are assessing the current regional security-alert exposure across Poland's 16 voivodeships, as of ${asOf}. ` +
    `Below are recent headlines collected from public news portals (mainly Polish, plus some international ` +
    `coverage), covering roughly the last 48 hours:\n\n${newsBlock}\n\n` +
    `Treat these headlines as your primary evidence. If a region has no relevant headline above and you have no ` +
    `other strong, current signal for it, answer UNKNOWN rather than guessing GREEN or YELLOW — only use your own ` +
    `general knowledge to interpret the headlines you were given, not to invent incidents they don't mention.`
  );
}

function buildQuestions(regions: readonly RegionIdentity[]) {
  const questions: Record<string, unknown> = {};
  for (const region of regions) {
    questions[region.code] = {
      type: "choice",
      instructions: `Based on the headlines above, what is the current security-alert level for the ${region.nameEn} voivodeship (Polish: ${region.namePl}), Poland?`,
      criteria: {
        GREEN: "No elevated regional signal found in the evidence.",
        YELLOW: "An elevated situation requiring attention.",
        RED: "A serious active warning or confirmed incident.",
        UNKNOWN: "No reliable, current signal for this region in the evidence provided.",
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

function toEvidence(news: readonly CollectedNewsItem[]): ClassificationEvidence[] {
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
 * The current, live implementation of `ClassificationService`: collects
 * recent news (`collectRecentNews`) and calls TypeSafe AI's System One
 * API (`jev-latest`) with that evidence, one "choice" question per
 * region.
 *
 * This is not the persisted, scheduled pipeline described in
 * `scheduler/README.md` — news is collected fresh per call (subject to
 * the short in-isolate cache above), and nothing is written to
 * `classification_evidence` or `job_runs`. If `apiKey` is missing, or the
 * API call fails or returns something unparseable, every region resolves
 * to UNKNOWN: missing or untrustworthy data must never resolve to GREEN.
 */
export class TypeSafeAiClassificationService implements ClassificationService {
  constructor(private readonly apiKey: string | undefined) {}

  /** Test-only: clears the shared in-isolate result cache. */
  static clearCache(): void {
    resultCache.clear();
  }

  async classifyRegions(input: ClassificationInput): Promise<RegionClassification[]> {
    if (!this.apiKey) {
      return input.regions.map((region) => this.unknownClassification(region, input.asOf, "TYPESAFE_AI_API_KEY is not configured."));
    }

    const key = cacheKey(input.regions);
    const cached = resultCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return [...cached.result];
    }

    const news = await collectRecentNews(new Date(input.asOf));
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
    const result = input.regions.map((region) => {
      const answer = body.answers?.[region.code];
      if (!isChoiceAnswer(answer)) {
        return this.unknownClassification(region, input.asOf, "TypeSafe AI returned no usable answer for this region.");
      }

      const recognized = isAlertLevel(answer.choice);
      const status: AlertLevel = toAlertLevel(answer.choice);
      const confidence = typeof answer.confidence === "number" ? answer.confidence : null;
      const confidenceSuffix = confidence !== null ? ` (confidence ${confidence.toFixed(2)})` : "";

      let rationale: string;
      if (!recognized) {
        rationale = `TypeSafe AI returned an unrecognized choice ("${answer.choice}").`;
      } else if (status === "UNKNOWN") {
        rationale = `TypeSafe AI found no reliable, current signal for this region in the collected headlines${confidenceSuffix}.`;
      } else {
        rationale = `TypeSafe AI (model ${TYPESAFE_AI_MODEL}) classification from collected headlines${confidenceSuffix}.`;
      }

      return {
        regionCode: region.code,
        status,
        confidence,
        rationale,
        classifiedAt: input.asOf,
        expiresAt,
        evidence,
      };
    });

    resultCache.set(key, { at: Date.now(), result });
    return result;
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
