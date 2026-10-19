import { localFixtureTarget } from "./local-fixture";
// Explicit Sprint B allowlist. Changing this is a reviewed deployment operation.
export const developmentTarget = {
  projectId: "icy-queen-44442204",
  branchId: "br-rough-darkness-ba6ow9zo",
  host: "ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech",
  database: "pusula_development",
  testDatabase: "pusula_sprint_b_test",
} as const;

export function assertDevelopmentTarget(
  value: string | undefined,
  test = false,
  direct = false,
): URL {
  if (!value) throw new Error("Database configuration is missing.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Database configuration is invalid.");
  }
  if (localFixtureTarget(url, test, direct)) return url;
  const host = direct
    ? developmentTarget.host
    : developmentTarget.host.replace(".c-8.", "-pooler.c-8.");
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== host ||
    url.pathname !==
      `/${test ? developmentTarget.testDatabase : developmentTarget.database}` ||
    !url.username ||
    !url.password ||
    (url.port !== "" && url.port !== "5432") ||
    [...url.searchParams.keys()].some(
      (key) => !["sslmode", "channel_binding"].includes(key),
    ) ||
    url.searchParams.get("sslmode") !== "verify-full"
  ) {
    throw new Error(
      "Database target rejected: expected the approved development endpoint with verified TLS.",
    );
  }
  return url;
}
