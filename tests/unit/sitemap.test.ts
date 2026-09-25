import { describe, expect, it } from "vitest";
import { REGIONS } from "../../src/data/regions";
import type { RegionWithStatus } from "../../src/domain/region";
import { buildSitemapEntries, renderSitemapXml } from "../../src/domain/sitemap";
import { buildSitemap } from "../../src/pages/sitemap.xml";
import { InMemoryD1Database, type InMemoryRegionRow } from "../fakes/in-memory-d1";
import { buildSeededRows } from "../fakes/seeded-rows";

const SITE = "https://ispolandsafenow.com/";

function seededRegionRows(): InMemoryRegionRow[] {
  return buildSeededRows().map((r) => ({
    code: r.code,
    slug: r.slug,
    name_pl: r.name_pl,
    name_en: r.name_en,
    current_status: "UNKNOWN",
    last_classified_at: null,
    status_reason: null,
    status_driver: null,
    updated_at: "2026-09-19T00:00:00.000Z",
  }));
}

describe("buildSitemapEntries", () => {
  it("lists home, news, every region and the static pages exactly once", () => {
    const regions: RegionWithStatus[] = buildSeededRows().map((r) => ({
      code: r.code,
      slug: r.slug,
      namePl: r.name_pl,
      nameEn: r.name_en,
      currentStatus: "UNKNOWN",
      lastClassifiedAt: null,
      statusReason: null,
      statusDriver: null,
    }));
    const entries = buildSitemapEntries({ site: SITE, regions, latestNews: null });
    const locs = entries.map((e) => e.loc);
    expect(locs).toHaveLength(5 + REGIONS.length);
    expect(locs).toContain("https://ispolandsafenow.com/live");
    expect(new Set(locs).size).toBe(locs.length);
    expect(locs[0]).toBe("https://ispolandsafenow.com/");
    expect(locs).toContain("https://ispolandsafenow.com/regions/mazowieckie");
    expect(entries.every((e) => e.lastmod === undefined)).toBe(true);
  });

  it("derives lastmod from real content timestamps only", () => {
    const regions: RegionWithStatus[] = [
      { code: "02", slug: "dolnoslaskie", namePl: "a", nameEn: "b", currentStatus: "CALM", lastClassifiedAt: "2026-09-19T10:00:00.000Z", statusReason: null, statusDriver: null },
      { code: "04", slug: "kujawsko-pomorskie", namePl: "a", nameEn: "b", currentStatus: "UNKNOWN", lastClassifiedAt: null, statusReason: null, statusDriver: null },
    ];
    const latestNews = { url: "https://n.pl/1", title: "t", titleEn: null, sourceName: null, publishedAt: "2026-09-19T11:30:00.000Z" };
    const byLoc = new Map(buildSitemapEntries({ site: SITE, regions, latestNews }).map((e) => [e.loc, e]));
    expect(byLoc.get("https://ispolandsafenow.com/")?.lastmod).toBe("2026-09-19T11:30:00.000Z");
    expect(byLoc.get("https://ispolandsafenow.com/news")?.lastmod).toBe("2026-09-19T11:30:00.000Z");
    expect(byLoc.get("https://ispolandsafenow.com/regions/dolnoslaskie")?.lastmod).toBe("2026-09-19T10:00:00.000Z");
    expect(byLoc.get("https://ispolandsafenow.com/regions/kujawsko-pomorskie")?.lastmod).toBeUndefined();
    expect(byLoc.get("https://ispolandsafenow.com/about")?.lastmod).toBeUndefined();
  });
});

describe("renderSitemapXml", () => {
  it("produces a valid urlset and escapes special characters", () => {
    const xml = renderSitemapXml([{ loc: "https://x.pl/?a=1&b=2", lastmod: "2026-09-19T10:00:00.000Z", changefreq: "daily", priority: 0.5 }]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true);
    expect(xml).toContain("<loc>https://x.pl/?a=1&amp;b=2</loc>");
    expect(xml).toContain("<lastmod>2026-09-19T10:00:00.000Z</lastmod>");
    expect(xml).toContain("<changefreq>daily</changefreq>");
    expect(xml).toContain("<priority>0.5</priority>");
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
  });
});

describe("GET /sitemap.xml logic", () => {
  it("renders all pages from the database", async () => {
    const db = new InMemoryD1Database(seededRegionRows(), [
      { id: 1, url: "https://n.pl/1", title: "t", title_en: null, source_name: null, published_at: "2026-09-19T11:30:00.000Z" },
    ]);
    const xml = await buildSitemap(db as never, SITE);
    expect(xml.match(/<url>/g)).toHaveLength(5 + REGIONS.length);
    expect(xml).toContain("<loc>https://ispolandsafenow.com/news</loc>\n    <lastmod>2026-09-19T11:30:00.000Z</lastmod>");
  });
});
