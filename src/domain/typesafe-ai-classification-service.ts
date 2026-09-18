import { toAlertLevel, type AlertLevel } from "./alert-level";
import type { ClassificationInput, ClassificationService, RegionClassification } from "./classification-service";
import type { RegionIdentity } from "./region";

const TYPESAFE_AI_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const TYPESAFE_AI_MODEL = "jev-latest";

/** Freshness window applied to every classification this service produces. */
const CLASSIFICATION_TTL_MS = 6 * 60 * 60 * 1000;

interface ChoiceAnswer {
  readonly type: "choice";
  readonly choice: string;
  readonly confidence?: number;
}

interface SystemOneResponse {
  readonly answers?: Record<string, { type?: string; choice?: string; confidence?: number }>;
}

function buildStatePrompt(asOf: string): string {
  return (
    `You are assessing the current regional security-alert exposure across Poland's 16 voivodeships, ` +
    `as of ${asOf}. Base your answer on your knowledge of publicly reported developments connected to the ` +
    `Russia-Ukraine war, Belarus border activity, Kaliningrad, airspace violations, drone or missile incidents, ` +
    `RCB (Rządowe Centrum Bezpieczeństwa) warnings, and border, airport, or transport disruptions. ` +
    `If you have no reliable, current signal for a region, prefer GREEN only when you are confident there is ` +
    `genuinely no elevated concern — otherwise say so plainly in your reasoning.`
  );
}

function buildQuestions(regions: readonly RegionIdentity[]) {
  const questions: Record<string, unknown> = {};
  for (const region of regions) {
    questions[region.code] = {
      type: "choice",
      instructions: `What is the current security-alert level for the ${region.nameEn} voivodeship (Polish: ${region.namePl}), Poland?`,
      criteria: {
        GREEN: "No elevated regional signal found.",
        YELLOW: "An elevated situation requiring attention.",
        RED: "A serious active warning or confirmed incident.",
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

/**
 * The current, live implementation of `ClassificationService`: calls
 * TypeSafe AI's System One API (`jev-latest`) directly with the model's
 * own knowledge, one "choice" question per region.
 *
 * There is no dedicated news-collection pipeline yet (see
 * `scheduler/README.md`), so classifications are not backed by a stored
 * evidence trail — `evidence` is always empty. If `apiKey` is missing, or
 * the API call fails or returns something unparseable, every region
 * resolves to UNKNOWN: missing or untrustworthy data must never resolve
 * to GREEN.
 */
export class TypeSafeAiClassificationService implements ClassificationService {
  constructor(private readonly apiKey: string | undefined) {}

  async classifyRegions(input: ClassificationInput): Promise<RegionClassification[]> {
    if (!this.apiKey) {
      return input.regions.map((region) => this.unknownClassification(region, input.asOf, "TYPESAFE_AI_API_KEY is not configured."));
    }

    let response: Response;
    try {
      response = await fetch(TYPESAFE_AI_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          state: buildStatePrompt(input.asOf),
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

      const status: AlertLevel = toAlertLevel(answer.choice);
      const confidence = typeof answer.confidence === "number" ? answer.confidence : null;
      return {
        regionCode: region.code,
        status,
        confidence,
        rationale:
          status === "UNKNOWN"
            ? `TypeSafe AI returned an unrecognized choice ("${answer.choice}").`
            : `TypeSafe AI (model ${TYPESAFE_AI_MODEL}) classification${confidence !== null ? ` (confidence ${confidence.toFixed(2)})` : ""}.`,
        classifiedAt: input.asOf,
        expiresAt,
        evidence: [],
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
