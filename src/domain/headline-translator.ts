import { looksEnglish } from "./headline-language.ts";

const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const BATCH_SIZE = 20;

const SYSTEM_PROMPT =
  "You translate news headlines into natural, concise English. Keep proper names, agencies (RCB, NATO, PAP), " +
  "numbers and quotation marks. If a headline is already in English, return it unchanged. " +
  "Return exactly one translation per input headline, in the same order.";

export interface TranslatorConfig {
  readonly accountId: string;
  readonly apiToken: string;
}

export interface TranslatorDeps {
  readonly fetch?: typeof fetch;
  readonly log?: (message: string) => void;
}

interface WorkersAiResponse {
  readonly success?: boolean;
  readonly result?: { readonly response?: unknown };
  readonly errors?: ReadonlyArray<{ readonly code?: number; readonly message?: string }>;
}

function runUrl(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${WORKERS_AI_MODEL}`;
}

function parseTranslations(raw: unknown, expected: number): string[] | null {
  const payload = typeof raw === "string" ? safeJsonParse(raw) : raw;
  const list = (payload as { translations?: unknown } | null)?.translations;
  if (!Array.isArray(list) || list.length !== expected) return null;
  if (!list.every((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)) return null;
  return list.map((entry) => entry.trim());
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

type BatchResult = { readonly translations: string[] } | { readonly failure: "http" | "misaligned" };

async function translateBatch(titles: readonly string[], config: TranslatorConfig, deps: TranslatorDeps): Promise<BatchResult> {
  const fetchImpl = deps.fetch ?? fetch;
  const log = deps.log ?? (() => {});
  const response = await fetchImpl(runUrl(config.accountId), {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(titles) },
      ],
      temperature: 0,
      max_tokens: 120 * titles.length,
      response_format: {
        type: "json_schema",
        json_schema: {
          type: "object",
          properties: { translations: { type: "array", items: { type: "string" } } },
          required: ["translations"],
        },
      },
    }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `Workers AI returned HTTP ${response.status} — the Cloudflare API token needs the "Workers AI: Read" permission (Account scope).`,
    );
  }
  if (!response.ok) {
    log(`[translate] Workers AI returned HTTP ${response.status}; leaving ${titles.length} headline(s) untranslated for now.`);
    return { failure: "http" };
  }

  const body = (await response.json()) as WorkersAiResponse;
  const translations = parseTranslations(body.result?.response, titles.length);
  return translations === null ? { failure: "misaligned" } : { translations };
}

/**
 * The model occasionally merges or drops a line in a long batch. When the
 * output does not line up, halve the batch and try again — down to single
 * headlines, where misalignment is impossible.
 */
async function translateBatchResilient(
  titles: readonly string[],
  config: TranslatorConfig,
  deps: TranslatorDeps,
): Promise<Array<string | null>> {
  const outcome = await translateBatch(titles, config, deps);
  if ("translations" in outcome) return outcome.translations;
  if (outcome.failure === "http") return titles.map(() => null);
  if (titles.length === 1) {
    (deps.log ?? (() => {}))("[translate] unusable model output for a headline; will retry on the next run.");
    return [null];
  }
  const middle = Math.ceil(titles.length / 2);
  const [left, right] = await Promise.all([
    translateBatchResilient(titles.slice(0, middle), config, deps),
    translateBatchResilient(titles.slice(middle), config, deps),
  ]);
  return [...left, ...right];
}

/**
 * Translates headlines to English with Workers AI, in batches, returning
 * one entry per input: the English title, or `null` when that headline
 * could not be translated this time (caller leaves `title_en` NULL and a
 * later run retries). Headlines that already look English skip the model
 * and map to themselves — the cheap path for the international outlets.
 */
export async function translateHeadlines(
  titles: readonly string[],
  config: TranslatorConfig,
  deps: TranslatorDeps = {},
): Promise<Array<string | null>> {
  const result: Array<string | null> = titles.map((title) => (looksEnglish(title) ? title : null));
  const pending = titles.map((title, index) => ({ title, index })).filter(({ index }) => result[index] === null);

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);
    const translated = await translateBatchResilient(
      batch.map((entry) => entry.title),
      config,
      deps,
    );
    batch.forEach((entry, offset) => {
      result[entry.index] = translated[offset] ?? null;
    });
  }
  return result;
}
