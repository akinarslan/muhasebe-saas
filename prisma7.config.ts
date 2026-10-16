import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";
import { assertDevelopmentTarget } from "./src/server/db/target";

loadEnvConfig(process.cwd());
const test = process.env.PUSULA_DB_TARGET === "test";
const direct =
  process.env[test ? "TEST_DIRECT_DATABASE_URL" : "DIRECT_DATABASE_URL"];
if (direct) assertDevelopmentTarget(direct, test, true);
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: direct,
  },
});
