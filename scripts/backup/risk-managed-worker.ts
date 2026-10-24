// Synthetic crash/timeout worker. Credential arrives only over private IPC.
import { Client } from "pg";
import { assertRiskFixtureTarget } from "./risk-managed";
process.once("message", async (m: { url: string; mode: string }) => {
  let db: Client | undefined;
  try {
    const u = new URL(m.url);
    assertRiskFixtureTarget(u);
    db = new Client({
      connectionString: u.toString(),
      connectionTimeoutMillis: 3000,
    });
    db.on("error", () => {});
    await db.connect();
    const pid = (await db.query("SELECT pg_backend_pid() pid")).rows[0].pid;
    process.send?.({ ready: true, pid });
    if (m.mode === "crash") process.exit(23);
    if (m.mode === "error") throw Error("SYNTHETIC_WORKER_ERROR");
    if (m.mode === "timeout") await db.query("SELECT pg_sleep(30)");
    await db.end();
    process.exit(0);
  } catch {
    await db?.end().catch(() => {});
    process.exit(24);
  }
});
