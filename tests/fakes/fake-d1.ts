/**
 * Minimal in-memory stand-in for D1Database, covering only the query
 * shapes `RegionRepository` actually issues. This lets domain/service/API
 * logic be unit tested without a real Workers runtime.
 */
export interface FakeRegionRow {
  code: string;
  slug: string;
  name_pl: string;
  name_en: string;
  current_status: string;
  last_classified_at: string | null;
  status_expires_at: string | null;
}

class FailingStatement {
  constructor(private readonly error: Error) {}
  bind(): this {
    return this;
  }
  all<T>(): Promise<{ results: T[] }> {
    return Promise.reject(this.error);
  }
  first<T>(): Promise<T | null> {
    return Promise.reject(this.error);
  }
}

class FakeStatement {
  private boundArgs: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly rows: FakeRegionRow[],
  ) {}

  bind(...args: unknown[]): this {
    this.boundArgs = args;
    return this;
  }

  async all<T>(): Promise<{ results: T[] }> {
    if (this.sql.includes("COUNT(*)")) {
      return { results: [{ count: this.rows.length } as T] };
    }
    const sorted = [...this.rows].sort((a, b) => a.code.localeCompare(b.code));
    return { results: sorted as unknown as T[] };
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes("COUNT(*)")) {
      return { count: this.rows.length } as T;
    }
    if (this.sql.includes("WHERE slug = ?1")) {
      const slug = this.boundArgs[0];
      const row = this.rows.find((r) => r.slug === slug);
      return (row as unknown as T) ?? null;
    }
    return (this.rows[0] as unknown as T) ?? null;
  }
}

export class FakeD1Database {
  constructor(private readonly rows: FakeRegionRow[]) {}

  prepare(sql: string) {
    return new FakeStatement(sql, this.rows);
  }
}

/** A FakeD1Database whose queries always reject, simulating an unreachable database or a missing table. */
export class FailingD1Database {
  constructor(private readonly error: Error = new Error("no such table: regions")) {}

  prepare() {
    return new FailingStatement(this.error);
  }
}
