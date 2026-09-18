import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Client-hydrated components (React islands) ship to the browser as-is.
// This guards against ever wiring a secret (a TypeSafe AI key, or any other
// credential) into one of them.
const CLIENT_COMPONENTS_DIR = path.resolve(__dirname, "../../src/components");
const SUSPICIOUS_PATTERNS = [/TYPESAFE_?AI/i, /API[_-]?KEY/i, /SECRET/i, /import\.meta\.env/];

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

describe("client-hydrated components never reference secrets", () => {
  const files = listFiles(CLIENT_COMPONENTS_DIR).filter((f) => f.endsWith(".tsx"));

  it("finds at least one client component to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s contains no secret-like identifiers", (file) => {
    const source = readFileSync(file, "utf-8");
    for (const pattern of SUSPICIOUS_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });
});
