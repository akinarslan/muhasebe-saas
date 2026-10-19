import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import { runTool } from "../backup/postgres";
import { runPrisma } from "./migrate";
import { check, MigrationSafetyError } from "./migration-safety";

// Synthetic local certificates only. Never imports env or contacts Neon.
export async function verifyMigrationTls(
  db: Client,
  env: NodeJS.ProcessEnv,
  dir: string,
) {
  const openssl = "C:/Program Files/Git/usr/bin/openssl.exe";
  const version = (await runTool(openssl, ["version"], env)).trim();
  for (const [name, san] of [
    ["trusted", "IP:127.0.0.1"],
    ["untrusted", "IP:127.0.0.1"],
    ["wrong-host", "DNS:wrong.example.invalid"],
  ]) {
    await runTool(
      openssl,
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        join(dir, name + ".key"),
        "-out",
        join(dir, name + ".pem"),
        "-days",
        "1",
        "-subj",
        "/CN=synthetic-fixture",
        "-addext",
        `subjectAltName=${san}`,
      ],
      env,
      30000,
    );
  }
  const conf = join(dir, "data", "postgresql.auto.conf");
  const initial = await readFile(conf, "utf8");
  const configureCertificate = async (name: string) => {
    const path = (file: string) =>
      join(dir, file).replaceAll("\\", "/").replaceAll("'", "''");
    await writeFile(
      conf,
      initial +
        `\nssl=on\nssl_cert_file='${path(name + ".pem")}'\nssl_key_file='${path(name + ".key")}'\n`,
    );
    await db.query("SELECT pg_reload_conf()");
    await new Promise((resolve) => setTimeout(resolve, 1200));
  };
  const reject = async (ca: string) => {
    let result = "NO_REJECTION";
    try {
      await runPrisma(db, {
        ...env,
        PUSULA_FIXTURE_TLS_CA: join(dir, ca + ".pem"),
      });
    } catch (e) {
      result = e instanceof MigrationSafetyError ? e.code : "UNKNOWN";
    }
    check(result === "PRISMA_CHILD_FAILED", "TLS_NEGATIVE_NOT_REJECTED");
  };
  await configureCertificate("trusted");
  await runPrisma(db, {
    ...env,
    PUSULA_FIXTURE_TLS_CA: join(dir, "trusted.pem"),
  });
  await reject("untrusted");
  await configureCertificate("wrong-host");
  await reject("wrong-host");
  await configureCertificate("trusted");
  return {
    openssl: version,
    trustedCa: "PASS",
    untrustedCaRejected: "PASS",
    hostnameMismatchRejected: "PASS",
    realNeon: false,
  };
}
