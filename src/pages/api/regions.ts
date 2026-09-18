import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { APP_MODE } from "../../domain/app-mode";
import type { RegionWithStatus } from "../../domain/region";
import { RegionRepository } from "../../repositories/region-repository";
import { RegionStatusService } from "../../services/region-status-service";

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
  const identities = await new RegionRepository(db).listAll();
  const regions = await new RegionStatusService().getRegionsWithStatus(identities);
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
