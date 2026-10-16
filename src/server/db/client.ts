import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertDevelopmentTarget } from "./target";

export function createDatabase(connectionString: string, test = false) {
  assertDevelopmentTarget(connectionString, test);
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: 3,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 10000,
    }),
    // Never enable query logging: bind values can contain financial/customer data.
    log: [],
  });
}
const globalDb = globalThis as unknown as { pusulaDb?: PrismaClient };
export function database() {
  return (globalDb.pusulaDb ??= createDatabase(process.env.DATABASE_URL ?? ""));
}

export async function databaseHealth(getDatabase = database): Promise<boolean> {
  try {
    await getDatabase().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
