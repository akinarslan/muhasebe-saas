// Dedicated local acceptance only. Never loads .env or permits a provider host.
import { defineConfig } from "prisma/config";
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
const id = process.env.PUSULA_LOCAL_FIXTURE;
if (
  !id ||
  !/^[a-f0-9-]{36}$/.test(id) ||
  process.env.PUSULA_FINANCE_017_FIXTURE !== "1"
)
  throw Error("FINANCE_LOCAL_ONLY");
const root = resolve(".data/fixtures", `v42-${id}`);
if (realpathSync(root) !== root) throw Error("FINANCE_FIXTURE_PATH");
const marker = JSON.parse(readFileSync(resolve(root, "target.json"), "utf8"));
const url = new URL(process.env.PUSULA_FINANCE_LOCAL_URL ?? "");
if (
  url.hostname !== "127.0.0.1" ||
  Number(url.port) !== marker.port ||
  marker.id !== id ||
  url.pathname !== "/pusula_sprint_b_test" ||
  url.username !== "fixture_finance_owner" ||
  !!url.hash ||
  [...url.searchParams.keys()].some(
    (key) => !["sslmode", "options"].includes(key),
  ) ||
  url.searchParams.get("options") !==
    "-c pusula.finance_review=APPROVED_017_CANDIDATE" ||
  url.searchParams.get("sslmode") !== "disable"
)
  throw Error("FINANCE_LOCAL_TARGET");
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path:
      process.env.PUSULA_FINANCE_FAILURE_FIXTURE === "1"
        ? resolve(root, "finance-failure-migrations")
        : "prisma/migrations",
  },
  datasource: { url: url.toString() },
});
