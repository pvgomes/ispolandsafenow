import { useId, useMemo, useState } from "react";
import type { AlertLevel } from "../domain/alert-level";
import { ALERT_LEVEL_PRESENTATION } from "../domain/alert-level";
import type { RegionPath } from "../domain/parse-map-svg";

export interface MapRegion {
  readonly code: string;
  readonly slug: string;
  readonly namePl: string;
  readonly nameEn: string;
  readonly currentStatus: AlertLevel;
  readonly lastClassifiedAt: string | null;
  readonly statusExpiresAt: string | null;
}

export interface PolandMapProps {
  readonly viewBox: string;
  readonly paths: readonly RegionPath[];
  readonly regions: readonly MapRegion[];
}

const FILL_BY_STATUS: Record<AlertLevel, string> = {
  GREEN: "fill-status-green-500",
  YELLOW: "fill-status-yellow-500",
  RED: "fill-status-red-500",
  UNKNOWN: "fill-status-unknown-300",
};

function formatTimestamp(value: string | null): string {
  if (!value) return "Not available";
  try {
    return new Date(value).toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }) + " UTC";
  } catch {
    return "Not available";
  }
}

export default function PolandMap({ viewBox, paths, regions }: PolandMapProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const headingId = useId();

  const regionBySlug = useMemo(() => {
    const map = new Map<string, MapRegion>();
    for (const region of regions) map.set(region.slug, region);
    return map;
  }, [regions]);

  const selectedRegion = selectedSlug ? (regionBySlug.get(selectedSlug) ?? null) : null;

  function selectRegion(slug: string) {
    setSelectedSlug(slug);
  }

  function handleKeyDown(event: React.KeyboardEvent<SVGPathElement>, slug: string) {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      selectRegion(slug);
    }
  }

  return (
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
            return (
              <path
                key={path.slug}
                d={path.d}
                data-testid={`region-${path.slug}`}
                data-slug={path.slug}
                data-status={status}
                role="button"
                tabIndex={0}
                aria-label={`${path.name}: ${ALERT_LEVEL_PRESENTATION[status].label} — ${ALERT_LEVEL_PRESENTATION[status].description}`}
                aria-pressed={isSelected}
                className={`cursor-pointer stroke-slate-700 transition-colors dark:stroke-slate-400 ${FILL_BY_STATUS[status]} ${
                  isSelected ? "stroke-2" : "stroke-[0.75] hover:opacity-80"
                }`}
                onClick={() => selectRegion(path.slug)}
                onKeyDown={(event) => handleKeyDown(event, path.slug)}
              />
            );
          })}
        </svg>
      </div>

      <div
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
            <dl className="mt-3 space-y-1 text-sm text-slate-500 dark:text-slate-400">
              <div>
                <dt className="inline font-medium text-slate-700 dark:text-slate-300">Last classified: </dt>
                <dd className="inline">{formatTimestamp(selectedRegion.lastClassifiedAt)}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-slate-700 dark:text-slate-300">Status expires: </dt>
                <dd className="inline">{formatTimestamp(selectedRegion.statusExpiresAt)}</dd>
              </div>
            </dl>
            <a
              href={`/regions/${selectedRegion.slug}`}
              className="mt-3 inline-block text-sm font-medium text-slate-900 underline underline-offset-2 dark:text-slate-100"
            >
              View full region page
            </a>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a voivodeship on the map, or tab to it and press Enter, to see its details here.
          </p>
        )}
      </div>
    </div>
  );
}
