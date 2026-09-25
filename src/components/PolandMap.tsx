import { useId, useMemo, useRef, useState } from "react";
import type { AlertLevel } from "../domain/alert-level";
import { ALERT_LEVEL_PRESENTATION } from "../domain/alert-level";
import type { MajorCity } from "../domain/city";
import { citiesForRegion, cityMatchesQuery, formatCityList, normalizeForSearch } from "../domain/city";
import type { RegionPath } from "../domain/parse-map-svg";

export interface MapRegion {
  readonly code: string;
  readonly slug: string;
  readonly namePl: string;
  readonly nameEn: string;
  readonly currentStatus: AlertLevel;
  readonly lastClassifiedAt: string | null;
  /** Short "why this colour" sentence from the latest classification. */
  readonly statusReason: string | null;
}

/** A city already projected into the map's SVG user space. */
export interface MapCity extends MajorCity {
  readonly x: number;
  readonly y: number;
}

export interface PolandMapProps {
  readonly viewBox: string;
  readonly paths: readonly RegionPath[];
  readonly regions: readonly MapRegion[];
  readonly cities?: readonly MapCity[];
}

const FILL_BY_STATUS: Record<AlertLevel, string> = {
  CALM: "fill-status-calm-500",
  LOW: "fill-status-low-500",
  ELEVATED: "fill-status-elevated-500",
  CRITICAL: "fill-status-critical-500",
  UNKNOWN: "fill-status-unknown-300",
};

const MAX_SEARCH_RESULTS = 8;

/** Long capital names get a conventional abbreviation on the map only. */
const MAP_LABEL_OVERRIDES: Record<string, string> = {
  "Gorzów Wielkopolski": "Gorzów Wlkp.",
};

interface SearchResult {
  readonly key: string;
  readonly primary: string;
  readonly secondary: string;
  readonly slug: string;
}

export default function PolandMap({ viewBox, paths, regions, cities = [] }: PolandMapProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const headingId = useId();
  const searchId = useId();
  const resultsId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const regionBySlug = useMemo(() => {
    const map = new Map<string, MapRegion>();
    for (const region of regions) map.set(region.slug, region);
    return map;
  }, [regions]);

  const selectedRegion = selectedSlug ? (regionBySlug.get(selectedSlug) ?? null) : null;
  const selectedCities = selectedSlug ? citiesForRegion(cities, selectedSlug) : [];

  const searchResults = useMemo<SearchResult[]>(() => {
    const normalized = normalizeForSearch(query);
    if (normalized.length === 0) return [];
    const results: SearchResult[] = [];
    for (const city of cities) {
      if (!cityMatchesQuery(city, query)) continue;
      const region = regionBySlug.get(city.regionSlug);
      results.push({
        key: `city:${city.regionSlug}:${city.name}`,
        primary: city.name,
        secondary: region ? `${region.namePl}${city.isCapital ? " · regional capital" : ""}` : city.regionSlug,
        slug: city.regionSlug,
      });
    }
    for (const region of regions) {
      const haystack = [region.namePl, region.nameEn].map(normalizeForSearch);
      if (haystack.some((name) => name.includes(normalized))) {
        results.push({
          key: `region:${region.slug}`,
          primary: region.namePl,
          secondary: `${region.nameEn} · voivodeship`,
          slug: region.slug,
        });
      }
    }
    return results.slice(0, MAX_SEARCH_RESULTS);
  }, [cities, query, regionBySlug, regions]);

  function selectRegion(slug: string) {
    setSelectedSlug(slug);
  }

  function selectFromSearch(slug: string) {
    selectRegion(slug);
    setQuery("");
    panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }

  function handleKeyDown(event: React.KeyboardEvent<SVGPathElement>, slug: string) {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      selectRegion(slug);
    }
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && searchResults[0]) {
      event.preventDefault();
      selectFromSearch(searchResults[0].slug);
    } else if (event.key === "Escape") {
      setQuery("");
    }
  }

  const visibleCities = cities.filter((city) => city.mapVisibility !== "never");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="w-full lg:w-2/3">
          <svg
            viewBox={viewBox}
            role="group"
            aria-labelledby={headingId}
            className="h-auto w-full max-w-full"
            data-testid="poland-map"
          >
            <title id={headingId}>Interactive map of Poland's 16 voivodeships</title>
            {paths.map((path) => {
              const region = regionBySlug.get(path.slug);
              const status = region?.currentStatus ?? "UNKNOWN";
              const isSelected = selectedSlug === path.slug;
              const regionCities = citiesForRegion(cities, path.slug);
              const cityHint = regionCities.length > 0 ? ` Main cities: ${formatCityList(regionCities)}.` : "";
              return (
                <path
                  key={path.slug}
                  d={path.d}
                  data-testid={`region-${path.slug}`}
                  data-slug={path.slug}
                  data-status={status}
                  role="button"
                  tabIndex={0}
                  aria-label={`${path.name}: ${ALERT_LEVEL_PRESENTATION[status].label} — ${ALERT_LEVEL_PRESENTATION[status].description}${cityHint}`}
                  aria-pressed={isSelected}
                  className={`cursor-pointer stroke-slate-700 transition-colors dark:stroke-slate-400 ${FILL_BY_STATUS[status]} ${
                    isSelected ? "stroke-2" : "stroke-[0.75] hover:opacity-80"
                  }`}
                  onClick={() => selectRegion(path.slug)}
                  onKeyDown={(event) => handleKeyDown(event, path.slug)}
                />
              );
            })}

            {/* City markers sit above the regions but never intercept clicks. */}
            <g className="pointer-events-none select-none" aria-hidden="true" data-testid="city-markers">
              {visibleCities.map((city) => {
                const anchor = city.labelAnchor ?? "start";
                const offset = anchor === "end" ? -7 : anchor === "middle" ? 0 : 7;
                const isNationalCapital = city.name === "Warsaw";
                const label = MAP_LABEL_OVERRIDES[city.name] ?? city.name;
                const groupClass =
                  city.mapVisibility === "wide" ? "hidden md:block" : "";
                const textClass =
                  city.mapVisibility === "always"
                    ? "text-[19px] font-semibold md:text-[12px]"
                    : "text-[11px] font-medium";
                return (
                  <g key={`${city.regionSlug}:${city.name}`} className={groupClass} data-testid={`city-${normalizeForSearch(city.name).replace(/\s+/g, "-")}`}>
                    {isNationalCapital ? (
                      <>
                        <circle cx={city.x} cy={city.y} r={6.5} className="fill-white stroke-slate-900 stroke-[1.5] dark:fill-slate-900 dark:stroke-white" />
                        <circle cx={city.x} cy={city.y} r={3} className="fill-slate-900 dark:fill-white" />
                      </>
                    ) : (
                      <circle
                        cx={city.x}
                        cy={city.y}
                        r={city.isCapital ? 3.5 : 2.5}
                        className="fill-slate-900 stroke-white stroke-[1.25] dark:fill-white dark:stroke-slate-900"
                      />
                    )}
                    <text
                      x={city.x + offset}
                      y={city.y + (city.labelDy ?? 4)}
                      textAnchor={anchor}
                      className={`${textClass} fill-slate-900 drop-shadow-[0_0_2px_rgba(255,255,255,0.95)] dark:fill-white dark:drop-shadow-[0_0_2px_rgba(15,23,42,0.95)]`}
                      style={{ fontFamily: "inherit" }}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div
          ref={panelRef}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 lg:w-1/3 dark:border-slate-700 dark:bg-slate-800"
          data-testid="region-details-panel"
          aria-live="polite"
        >
          {selectedRegion ? (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedRegion.namePl}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{selectedRegion.nameEn}</p>
              <span
                className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium ${
                  ALERT_LEVEL_PRESENTATION[selectedRegion.currentStatus].badgeClass
                }`}
                data-testid="region-status-badge"
              >
                {ALERT_LEVEL_PRESENTATION[selectedRegion.currentStatus].label}
              </span>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {ALERT_LEVEL_PRESENTATION[selectedRegion.currentStatus].description}
              </p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200" data-testid="region-status-reason">
                {selectedRegion.statusReason ?? "No assessment has been recorded for this region yet."}
              </p>
              <dl className="mt-3 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                {selectedCities.length > 0 && (
                  <div data-testid="region-cities">
                    <dt className="inline font-medium text-slate-700 dark:text-slate-300">Main cities: </dt>
                    <dd className="inline">{formatCityList(selectedCities)}</dd>
                  </div>
                )}
              </dl>
              <a
                href={`/regions/${selectedRegion.slug}`}
                className="mt-3 inline-block text-sm font-medium text-slate-900 underline underline-offset-2 dark:text-slate-100"
              >
                See the news behind this status
              </a>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select a voivodeship on the map, search for a city above, or tab to a region and press Enter to see its
              details here.
            </p>
          )}
        </div>
      </div>

      <div className="relative" data-testid="city-search">
        <label htmlFor={searchId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Find your city
        </label>
        <input
          id={searchId}
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="e.g. Kraków, Warsaw, Zakopane, Gdańsk…"
          aria-controls={resultsId}
          aria-expanded={searchResults.length > 0}
          aria-describedby={`${searchId}-hint`}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <p id={`${searchId}-hint`} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Type a city name to highlight its voivodeship — spelling without Polish letters (Krakow, Lodz) works too.
        </p>
        {query.trim().length > 0 && (
          <ul
            id={resultsId}
            className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
            data-testid="city-search-results"
          >
            {searchResults.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                No city or voivodeship matches &ldquo;{query}&rdquo;.
              </li>
            ) : (
              searchResults.map((result) => (
                <li key={result.key}>
                  <button
                    type="button"
                    onClick={() => selectFromSearch(result.slug)}
                    className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100">{result.primary}</span>
                    <span className="truncate text-xs text-slate-500 dark:text-slate-400">{result.secondary}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
