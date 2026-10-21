// @vitest-environment node
import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  managedMain,
  planManagedTls,
  validateManagedPins,
  checkManagedFingerprint,
  type ManagedPins,
} from "../scripts/stock/managed-preparation";
import { stockChecksum } from "../scripts/stock/migrate";
import { rootCertificates } from "node:tls";
import { X509Certificate } from "node:crypto";
it("keeps managed apply disabled and historical pre pins separate from fixtures", async () => {
  const pins: ManagedPins = JSON.parse(
    await readFile("scripts/stock/managed-baseline.json", "utf8"),
  );
  validateManagedPins(pins, stockChecksum);
  const fixture = JSON.parse(
    await readFile("scripts/stock/runner-baseline.json", "utf8"),
  );
  expect(pins.pre).not.toBe(fixture.pre);
  expect(() => checkManagedFingerprint(pins, "pre", fixture.pre)).toThrow(
    "STOCK_MANAGED_ACL_DRIFT",
  );
  expect(() => checkManagedFingerprint(pins, "post", "a".repeat(64))).toThrow(
    "STOCK_MANAGED_POST_NOT_ENROLLED",
  );
  expect(() =>
    validateManagedPins({ ...pins, checksum: "f".repeat(64) }, stockChecksum),
  ).toThrow("STOCK_MANAGED_PROFILE_REJECTED");
  expect(() => managedMain()).toThrow("STOCK_MANAGED_APPLY_DISABLED");
});
it("rejects off-allowlist TLS plans before parsing a CA or connecting", () => {
  expect(() =>
    planManagedTls(
      "postgresql://neondb_owner:fake@example.invalid/pusula_development?sslmode=verify-full",
      "invalid",
    ),
  ).toThrow();
});
it("plans strict TLS only for the pinned development owner and hostname", () => {
  const ca = rootCertificates.find((pem) => {
    const c = new X509Certificate(pem);
    return (
      Date.now() >= Date.parse(c.validFrom) &&
      Date.now() <= Date.parse(c.validTo)
    );
  })!;
  const host = "ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech";
  const url = `postgresql://neondb_owner:synthetic@${host}/pusula_development?sslmode=verify-full`;
  const plan = planManagedTls(url, ca);
  expect(plan.ssl.rejectUnauthorized).toBe(true);
  expect(plan.ssl.servername).toBe(host);
  expect(plan.ssl.minVersion).toBe("TLSv1.2");
  expect(() =>
    planManagedTls(url.replace("verify-full", "require"), ca),
  ).toThrow();
  expect(() =>
    planManagedTls(url.replace("neondb_owner", "pusula_runtime"), ca),
  ).toThrow();
});
