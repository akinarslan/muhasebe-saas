// @vitest-environment node
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import {
  STRICT,
  MANAGED,
  selectPolicy,
  validateDatabaseAccess,
} from "../scripts/backup/policy";
import { validateSourceSecurity } from "../scripts/backup/source-security";
import { inspectSource, sourceTarget } from "../scripts/backup/postgres";
import { developmentTarget } from "../src/server/db/target";
import { newContext, sealFile, verifyFile } from "../scripts/backup/core";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
beforeEach(() => {
  vi.spyOn(Client.prototype, "connect").mockImplementation(() => {
    throw new Error("REAL_CONNECTION_FORBIDDEN_IN_POLICY_UNIT_TEST");
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const current = {
  datname: "source",
  is_current: true,
  can_connect: true,
  public_connect: true,
};
const other = {
  datname: "template1",
  is_current: false,
  can_connect: true,
  public_connect: true,
  direct_connect: false,
};
const safe = () =>
  Object.fromEntries(
    [
      "database_temp",
      "public_temp",
      "direct_temp",
      "role_membership",
      "object_owner",
      "extra_schema",
      "extra_relation",
      "large_objects",
      "extra_extension",
      "event_trigger",
      "extra_type",
      "column_write",
      "select_grant_option",
    ].map((k) => [k, false]),
  );
describe("explicit candidate policy — never a remote authorization", () => {
  it("defaults to strict", () =>
    expect(selectPolicy(undefined, false, false)).toBe(STRICT));
  it("requires a matching separate operator selection", () => {
    expect(() => selectPolicy(MANAGED, false, false)).toThrow(
      "MANAGED_POLICY_SELECTION_REQUIRED",
    );
    expect(() => selectPolicy(STRICT, true, false)).toThrow(
      "SECURITY_POLICY_SELECTION_MISMATCH",
    );
    expect(selectPolicy(MANAGED, true, false)).toBe(MANAGED);
  });
  it.each(["skipSecurityChecks", "managed", "", "production"])(
    "rejects unknown policy %s",
    (v) =>
      expect(() => selectPolicy(v, true, false)).toThrow(
        "SECURITY_POLICY_INVALID",
      ),
  );
  it.each([STRICT, MANAGED])("forbids production for %s", (p) =>
    expect(() => selectPolicy(p, p === MANAGED, true)).toThrow(
      "PRODUCTION_FORBIDDEN",
    ),
  );
  it("strict checks other CONNECT including template databases", () =>
    expect(() => validateDatabaseAccess([current, other], STRICT)).toThrow(
      "SOURCE_OTHER_DATABASE_CONNECT_REJECTED",
    ));
  it("candidate tolerates only PUBLIC CONNECT, not an explicit exception", () => {
    expect(() =>
      validateDatabaseAccess([current, other], MANAGED),
    ).not.toThrow();
    expect(() =>
      validateDatabaseAccess(
        [current, { ...other, public_connect: false }],
        MANAGED,
      ),
    ).toThrow();
    expect(() =>
      validateDatabaseAccess(
        [current, { ...other, direct_connect: true }],
        MANAGED,
      ),
    ).toThrow();
  });
  it("unknown or absent database metadata fails closed", () => {
    expect(() => validateDatabaseAccess([], STRICT)).toThrow();
    expect(() =>
      validateDatabaseAccess(
        [current, { ...other, can_connect: undefined } as never],
        MANAGED,
      ),
    ).toThrow();
  });
  it("candidate cannot silently accept direct TEMP", () => {
    const s = { ...safe(), database_temp: true, public_temp: true };
    expect(() => validateSourceSecurity(s)).toThrow(
      "SOURCE_TEMP_PRIVILEGE_REJECTED",
    );
    expect(() => validateSourceSecurity(s, MANAGED)).not.toThrow();
    expect(() =>
      validateSourceSecurity({ ...s, direct_temp: true }, MANAGED),
    ).toThrow();
    expect(() =>
      validateSourceSecurity({ ...s, public_temp: false }, MANAGED),
    ).toThrow();
  });
  it.each([
    "role_membership",
    "object_owner",
    "column_write",
    "extra_schema",
    "extra_relation",
    "extra_type",
    "large_objects",
    "extra_extension",
    "event_trigger",
    "select_grant_option",
  ])("candidate never exempts %s", (key) =>
    expect(() =>
      validateSourceSecurity(
        { ...safe(), database_temp: true, public_temp: true, [key]: true },
        MANAGED,
      ),
    ).toThrow(),
  );
  it("remote managed metadata/object unknown remains blocked before connecting", async () => {
    const u = sourceTarget(
      `postgresql://pusula_backup:imaginary@${developmentTarget.host}/pusula_development?sslmode=verify-full`,
    );
    await expect(inspectSource(u, MANAGED)).rejects.toThrow(
      "MANAGED_REMOTE_OBJECT_AUDIT_REQUIRED",
    );
  });
  it("unknown runtime/owner role is never admitted", async () => {
    await expect(
      inspectSource(
        new URL(
          `postgresql://neondb_owner:imaginary@${developmentTarget.host}/pusula_development?sslmode=verify-full`,
        ),
        MANAGED,
      ),
    ).rejects.toThrow("SOURCE_TARGET_REJECTED");
  });
  it("policy is authenticated in both manifest MAC and encryption AAD", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pusula-policy-"));
    const key = randomBytes(32);
    try {
      await writeFile(join(dir, "plain"), "imaginary local fixture");
      const ctx = newContext({
        sourceEnvironment: "fixture",
        databaseVersion: "18.6",
        schemaVersion: "a".repeat(64),
        coverageSha256: "b".repeat(64),
        keyId: "fixture",
        securityPolicy: MANAGED,
      });
      const m = await sealFile(
        join(dir, "plain"),
        join(dir, "cipher"),
        ctx,
        key,
      );
      expect(m.securityPolicy).toBe(MANAGED);
      await expect(
        verifyFile(
          join(dir, "cipher"),
          { ...m, securityPolicy: STRICT },
          key,
          "fixture",
        ),
      ).rejects.toThrow("MANIFEST_AUTH_FAILED");
      await expect(
        verifyFile(join(dir, "cipher"), m, key, "fixture"),
      ).resolves.toHaveProperty("plaintextSize", 23);
    } finally {
      key.fill(0);
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("can still authenticate and decrypt a legacy manifest with no policy field", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pusula-legacy-"));
    const key = randomBytes(32);
    try {
      const ctx = newContext({
        sourceEnvironment: "fixture",
        databaseVersion: "18.6",
        schemaVersion: "a".repeat(64),
        coverageSha256: "b".repeat(64),
        keyId: "fixture",
      });
      delete ctx.securityPolicy;
      await writeFile(join(dir, "plain"), "legacy fixture");
      const m = await sealFile(
        join(dir, "plain"),
        join(dir, "cipher"),
        ctx,
        key,
      );
      expect(m.securityPolicy).toBeUndefined();
      await expect(
        verifyFile(join(dir, "cipher"), m, key, "fixture"),
      ).resolves.toHaveProperty("plaintextSize", 14);
    } finally {
      key.fill(0);
      await rm(dir, { recursive: true, force: true });
    }
  });
});
