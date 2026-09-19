import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { APP_MODE } from "../../domain/app-mode";
import type { AlertLevel } from "../../domain/alert-level";
import { summarizeNational } from "../../domain/national-summary";
import { RegionRepository } from "../../repositories/region-repository";

export const prerender = false;

export interface StatusPayload {
  mode: typeof APP_MODE;
  generatedAt: string;
  nationalStatus: AlertLevel;
  regionCounts: Record<AlertLevel, number>;
  totalRegions: number;
}

export async function buildStatusPayload(db: D1Database): Promise<StatusPayload> {
  // Reads the persisted result of the hourly scheduled job — no
  // per-request TypeSafe AI call, so this scales at a flat cost.
  const regions = await new RegionRepository(db).listAll();
  const summary = summarizeNational(regions);
  return {
    mode: APP_MODE,
    generatedAt: new Date().toISOString(),
    nationalStatus: summary.headlineLevel,
    regionCounts: summary.counts,
    totalRegions: summary.totalRegions,
  };
}

export const GET: APIRoute = async () => {
  const body = await buildStatusPayload(env.DB);
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
