import { Client } from "pg";
import type { APIRequestContext } from "@playwright/test";
import { assertDevelopmentTarget } from "../../src/server/db/target";

// UI scenarios share one synthetic server/IP. Reset only the new UUID local cluster
// between scenarios; production limits and standalone API rate-limit tests stay intact.
export async function resetLocalFixtureRateLimits() {
  if (!process.env.PUSULA_LOCAL_FIXTURE) return;
  assertDevelopmentTarget(process.env.TEST_DIRECT_DATABASE_URL, true, true);
  const db = new Client({
    connectionString: process.env.TEST_DIRECT_DATABASE_URL,
  });
  await db.connect();
  try {
    await db.query('DELETE FROM "AuthRateLimit"');
  } finally {
    await db.end();
  }
}
export async function warmLocalFixtureAuth(request: APIRequestContext) {
  if (!process.env.PUSULA_LOCAL_FIXTURE) return;
  assertDevelopmentTarget(process.env.TEST_AUTH_DATABASE_URL, true);
  const response = await request.get("/api/auth/get-session", {
    timeout: 60000,
  });
  if (response.status() !== 200)
    throw new Error("Local auth route warm-up failed");
}
