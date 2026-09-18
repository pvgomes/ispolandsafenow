export interface RegionPath {
  readonly code: string;
  readonly slug: string;
  readonly name: string;
  readonly d: string;
}

export interface ParsedMap {
  readonly viewBox: string;
  readonly paths: readonly RegionPath[];
}

const PATH_PATTERN =
  /<path[^>]*\sdata-code="([^"]+)"[^>]*\sdata-slug="([^"]+)"[^>]*\sdata-name="([^"]+)"[^>]*\sd="([^"]+)"[^>]*\/>/g;
const VIEWBOX_PATTERN = /viewBox="([^"]+)"/;

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

  const paths: RegionPath[] = [];
  for (const match of svgSource.matchAll(PATH_PATTERN)) {
    const [, code, slug, name, d] = match;
    if (!code || !slug || !name || !d) continue;
    paths.push({ code, slug, name, d });
  }

  return { viewBox: viewBoxMatch[1] ?? "", paths };
}
