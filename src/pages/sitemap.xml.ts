import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { buildSitemapEntries, renderSitemapXml } from "../domain/sitemap";
import { NewsRepository } from "../repositories/news-repository";
import { RegionRepository } from "../repositories/region-repository";

export const prerender = false;

export async function buildSitemap(db: D1Database, site: string): Promise<string> {
  const [regions, latest] = await Promise.all([new RegionRepository(db).listAll(), new NewsRepository(db).listLatest(1)]);
  return renderSitemapXml(buildSitemapEntries({ site, regions, latestNews: latest[0] ?? null }));
}

export const GET: APIRoute = async ({ site }) => {
  const body = await buildSitemap(env.DB, site?.toString() ?? "https://ispolandsafenow.com");
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      // Content changes hourly at most (scheduler + news cron); crawlers
      // do not need anything fresher than this.
      "cache-control": "public, max-age=3600",
    },
  });
};
