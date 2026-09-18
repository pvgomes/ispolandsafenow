import type { APIRoute } from "astro";
import { REGIONS } from "../data/regions";

export const prerender = false;

const STATIC_PATHS = ["/", "/methodology", "/about"];

export const GET: APIRoute = ({ site }) => {
  const base = site?.toString().replace(/\/$/, "") ?? "";
  const now = new Date().toISOString();

  const urls = [
    ...STATIC_PATHS.map((path) => `${base}${path}`),
    ...REGIONS.map((region) => `${base}/regions/${region.slug}`),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>\n    <loc>${url}</loc>\n    <lastmod>${now}</lastmod>\n  </url>`).join("\n")}
</urlset>
`;

  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
};
