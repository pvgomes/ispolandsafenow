import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { DEFAULT_LOOKBACK_DAYS } from "../../domain/news-collection";
import { buildNewsFeedPage, NEWS_PAGE_MAX_SIZE, NEWS_PAGE_SIZE, parsePagingParam, type NewsFeedPage } from "../../domain/news-feed-page";
import { NewsRepository } from "../../repositories/news-repository";

export const prerender = false;

const MAX_OFFSET = 5000;

/**
 * One page of the `/news` feed (last 8 days, newest first), used by that
 * page's scroll-to-load-more script. Offset paging is fine here: rows are
 * appended at the top over time, so an offset can only ever repeat an
 * item the client already has — which it dedupes by URL — never skip one.
 */
export async function buildNewsPage(db: D1Database, url: URL, now = new Date()): Promise<NewsFeedPage> {
  const offset = parsePagingParam(url.searchParams.get("offset"), 0, MAX_OFFSET);
  const limit = parsePagingParam(url.searchParams.get("limit"), NEWS_PAGE_SIZE, NEWS_PAGE_MAX_SIZE) || NEWS_PAGE_SIZE;
  const since = new Date(now.getTime() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const fetched = await new NewsRepository(db).listPublishedSince(since, limit + 1, offset);
  return buildNewsFeedPage(fetched, offset, limit);
}

export const GET: APIRoute = async ({ url }) => {
  const page = await buildNewsPage(env.DB, url);
  return new Response(JSON.stringify(page), {
    status: 200,
    headers: {
      "content-type": "application/json",
      // The feed changes at most every couple of hours (fetch-news cron).
      "cache-control": "public, max-age=300",
    },
  });
};
