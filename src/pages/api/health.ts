import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { RegionRepository } from "../../repositories/region-repository";

export const prerender = false;

const EXPECTED_REGION_COUNT = 16;

export interface HealthPayload {
  status: "ok" | "degraded" | "error";
  database: "connected" | "unreachable";
  regionCount: number;
  mode: "development" | "production";
  error?: string;
}

/** Pure health-check logic, kept separate from the route handler so it can be unit tested with a fake D1Database. */
export async function checkHealth(db: D1Database, mode: "development" | "production"): Promise<{ body: HealthPayload; httpStatus: number }> {
  try {
    const regionCount = await new RegionRepository(db).count();
    const regionsOk = regionCount === EXPECTED_REGION_COUNT;
    const body: HealthPayload = {
      status: regionsOk ? "ok" : "degraded",
      database: "connected",
      regionCount,
      mode,
    };
    return { body, httpStatus: body.status === "ok" ? 200 : 503 };
  } catch (error) {
    const body: HealthPayload = {
      status: "error",
      database: "unreachable",
      regionCount: 0,
      mode,
      error: error instanceof Error ? error.message : "unknown error",
    };
    return { body, httpStatus: 503 };
  }
}

export const GET: APIRoute = async () => {
  const mode = import.meta.env.DEV ? "development" : "production";
  const { body, httpStatus } = await checkHealth(env.DB, mode);
  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: { "content-type": "application/json" },
  });
};
