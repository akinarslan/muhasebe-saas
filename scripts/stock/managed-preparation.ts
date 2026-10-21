// Preparation only: no environment loading, network client, Prisma spawn or apply.
import { X509Certificate } from "node:crypto";
import { migrationTarget, check } from "../db/migration-safety";
import { pathToFileURL } from "node:url";

export type ManagedPins = {
  profile: "neon-development-reviewed";
  checksum: string;
  pre: string;
  post: string | null;
  applyEnabled: false;
};

export function validateManagedPins(value: ManagedPins, checksum: string) {
  check(
    value.profile === "neon-development-reviewed" &&
      value.applyEnabled === false &&
      value.checksum === checksum &&
      /^[a-f0-9]{64}$/.test(value.pre) &&
      (value.post === null || /^[a-f0-9]{64}$/.test(value.post)),
    "STOCK_MANAGED_PROFILE_REJECTED",
  );
}

// A future reviewed connector can consume this plan. This module cannot connect.
export function planManagedTls(value: string, ca: string) {
  const u = migrationTarget(value, false);
  const certificate = new X509Certificate(ca);
  check(
    Date.now() >= Date.parse(certificate.validFrom) &&
      Date.now() <= Date.parse(certificate.validTo),
    "STOCK_MANAGED_CA_EXPIRED",
  );
  return {
    host: u.hostname,
    database: u.pathname.slice(1),
    ssl: {
      ca,
      rejectUnauthorized: true as const,
      servername: u.hostname,
      minVersion: "TLSv1.2" as const,
    },
  };
}

export function checkManagedFingerprint(
  pins: ManagedPins,
  phase: "pre" | "post",
  actual: string,
) {
  const expected = pins[phase];
  check(expected !== null, "STOCK_MANAGED_POST_NOT_ENROLLED");
  check(actual === expected, "STOCK_MANAGED_ACL_DRIFT");
}

export function managedMain(): never {
  throw new Error("STOCK_MANAGED_APPLY_DISABLED");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  managedMain();
}
