import { describe, expect, it, vi } from "vitest";
vi.mock("../src/server/db/client", () => ({ databaseHealth: vi.fn() }));
import { databaseHealth } from "../src/server/db/client";
import { GET } from "../src/app/api/health/database/route";
describe("Database health HTTP contract", () => {
  it("returns only healthy status", async () => {
    vi.mocked(databaseHealth).mockResolvedValue(true);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("returns 503 without connection or error details on failure", async () => {
    vi.mocked(databaseHealth).mockResolvedValue(false);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
});
