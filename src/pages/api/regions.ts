import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { APP_MODE } from "../../domain/app-mode";
import type { RegionWithStatus } from "../../domain/region";
import { RegionRepository } from "../../repositories/region-repository";

export const prerender = false;

export interface RegionsPayload {
  mode: typeof APP_MODE;
  generatedAt: string;
  regions: Array<{
    code: string;
    slug: string;
    namePl: string;
    nameEn: string;
    status: RegionWithStatus["currentStatus"];
    lastClassifiedAt: string | null;
    statusExpiresAt: string | null;
  }>;
}

export async function buildRegionsPayload(db: D1Database): Promise<RegionsPayload> {
  // Reads the persisted result of the hourly scheduled job — no
  // per-request TypeSafe AI call, so this scales at a flat cost.
  const regions = await new RegionRepository(db).listAll();
  return {
    mode: APP_MODE,
    generatedAt: new Date().toISOString(),
    regions: regions.map((region) => ({
      code: region.code,
      slug: region.slug,
      namePl: region.namePl,
      nameEn: region.nameEn,
      status: region.currentStatus,
      lastClassifiedAt: region.lastClassifiedAt,
      statusExpiresAt: region.statusExpiresAt,
    })),
  };
}

export const GET: APIRoute = async () => {
  const body = await buildRegionsPayload(env.DB);
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
