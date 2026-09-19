export interface RegionPath {
  readonly code: string;
  readonly slug: string;
  readonly name: string;
  readonly d: string;
}

/**
 * Equirectangular projection constants written onto the SVG root by
 * scripts/convert-map.mjs. Lets us place point features (cities) from
 * WGS84 lat/lon with exactly the same math used for the boundary paths.
 */
export interface MapProjection {
  readonly lonMin: number;
  readonly latMax: number;
  readonly cosLat: number;
  readonly scale: number;
}

export interface ParsedMap {
  readonly viewBox: string;
  readonly projection: MapProjection;
  readonly paths: readonly RegionPath[];
}

const PATH_PATTERN =
  /<path[^>]*\sdata-code="([^"]+)"[^>]*\sdata-slug="([^"]+)"[^>]*\sdata-name="([^"]+)"[^>]*\sd="([^"]+)"[^>]*\/>/g;
const VIEWBOX_PATTERN = /viewBox="([^"]+)"/;
const ROOT_PATTERN = /<svg\b[^>]*>/;

function readNumberAttr(root: string, name: string): number {
  const match = root.match(new RegExp(`\\s${name}="([^"]+)"`));
  const value = match ? Number(match[1]) : Number.NaN;
  if (!Number.isFinite(value)) {
    throw new Error(`Map SVG is missing a numeric ${name} attribute`);
  }
  return value;
}

/**
 * Extracts region path data from the committed map SVG (see
 * scripts/convert-map.mjs). Kept separate from the React component so the
 * geometry can be unit-tested (exactly 16 regions, matching slugs) without
 * rendering anything.
 */
export function parseMapSvg(svgSource: string): ParsedMap {
  const viewBoxMatch = svgSource.match(VIEWBOX_PATTERN);
  if (!viewBoxMatch) {
    throw new Error("Map SVG is missing a viewBox attribute");
  }

  const root = svgSource.match(ROOT_PATTERN)?.[0] ?? "";
  const projection: MapProjection = {
    lonMin: readNumberAttr(root, "data-lon-min"),
    latMax: readNumberAttr(root, "data-lat-max"),
    cosLat: readNumberAttr(root, "data-cos-lat"),
    scale: readNumberAttr(root, "data-scale"),
  };

  const paths: RegionPath[] = [];
  for (const match of svgSource.matchAll(PATH_PATTERN)) {
    const [, code, slug, name, d] = match;
    if (!code || !slug || !name || !d) continue;
    paths.push({ code, slug, name, d });
  }

  return { viewBox: viewBoxMatch[1] ?? "", projection, paths };
}

/** Projects a WGS84 coordinate into the map's SVG user space. */
export function projectPoint(projection: MapProjection, lat: number, lon: number): { x: number; y: number } {
  return {
    x: (lon - projection.lonMin) * projection.cosLat * projection.scale,
    y: (projection.latMax - lat) * projection.scale,
  };
}
