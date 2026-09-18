import { describe, expect, it } from "vitest";
import { checkHealth } from "../../src/pages/api/health";
import { FakeD1Database, FailingD1Database } from "../fakes/fake-d1";
import { buildSeededRows } from "../fakes/seeded-rows";

describe("GET /api/health logic", () => {
  it("reports ok with exactly 16 regions", async () => {
    const { body, httpStatus } = await checkHealth(new FakeD1Database(buildSeededRows()) as never, "production");
    expect(httpStatus).toBe(200);
    expect(body).toEqual({ status: "ok", database: "connected", regionCount: 16, mode: "production" });
  });

  it("reports degraded when the region count is wrong", async () => {
    const { body, httpStatus } = await checkHealth(
      new FakeD1Database(buildSeededRows().slice(0, 5)) as never,
      "development",
    );
    expect(httpStatus).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.regionCount).toBe(5);
  });

  it("reports error when the database/table is unreachable", async () => {
    const { body, httpStatus } = await checkHealth(new FailingD1Database() as never, "production");
    expect(httpStatus).toBe(503);
    expect(body.status).toBe("error");
    expect(body.database).toBe("unreachable");
  });
});
