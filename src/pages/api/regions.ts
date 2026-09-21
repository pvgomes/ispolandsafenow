import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { APP_MODE } from "../../domain/app-mode";
import type { RegionWithStatus } from "../../domain/region";
import { RegionRepository } from "../../repositories/region-repository";
import { MAJOR_CITIES } from "../../data/cities";
import { capitalOfRegion, citiesForRegion } from "../../domain/city";

export const prerender = false;

export interface RegionsPayload {
  mode: typeof APP_MODE;
  generatedAt: string;
  regions: Array<{
    code: string;
    slug: string;
    namePl: string;
    nameEn: string;
    /** Seat of the voivodeship, e.g. "Warsaw" for Mazowieckie. */
    capital: string | null;
    /** Best-known cities, capital first — helps map a city name to its region. */
    majorCities: string[];
    status: RegionWithStatus["currentStatus"];
    lastClassifiedAt: string | null;
    /** Short "why this colour" sentence, or `null` before the first classification. */
    statusReason: string | null;
    statusDriver: string | null;
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
      capital: capitalOfRegion(MAJOR_CITIES, region.slug)?.name ?? null,
      majorCities: citiesForRegion(MAJOR_CITIES, region.slug).map((city) => city.name),
      status: region.currentStatus,
      lastClassifiedAt: region.lastClassifiedAt,
      statusReason: region.statusReason,
      statusDriver: region.statusDriver,
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
