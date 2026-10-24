// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  sourceProfile,
  profileMigrations,
  validateProfileHistory,
  profileHistoryIdentity,
  sourceFunctions,
  validateProfileFunctions,
  validateBackupAcl,
  expectedFunctionAcl,
  validateFunctionAcl,
} from "../scripts/backup/source-profile";
import { reviewedRollback008 } from "../scripts/db/migration-checksum";
import { inspectSource } from "../scripts/backup/postgres";
import { MANAGED } from "../scripts/backup/policy";
import { developmentTarget } from "../src/server/db/target";

describe("explicit backup source release profiles", () => {
  it("rejects global function grantor, PUBLIC/auth and grant-option drift", async () => {
    const functions = sourceFunctions(
      await profileMigrations("post017"),
      "fixture_admin",
    );
    const acl = expectedFunctionAcl(functions, "post017");
    expect(() => validateFunctionAcl(acl, functions, "post017")).not.toThrow();
    for (const delta of [
      { grantor: "unexpected" },
      { grantee: "PUBLIC" },
      { grantee: "pusula_auth" },
      { is_grantable: true },
    ]) {
      const changed = structuredClone(acl);
      const index = changed.findIndex(
        (r) =>
          r.identity === "k4_expense(jsonb)" && r.grantee === "pusula_runtime",
      );
      Object.assign(changed[index], delta);
      expect(() => validateFunctionAcl(changed, functions, "post017")).toThrow(
        "BACKUP_FUNCTION_ACL_GRANTOR_REJECTED",
      );
    }
  });
  it.each([
    { release: "pre016", tables: 40, forced: 26, count: 15 },
    { release: "post016", tables: 47, forced: 33, count: 16 },
    { release: "post017", tables: 56, forced: 42, count: 17 },
  ] as const)(
    "pins $release before observing a database",
    async ({ release, tables, forced, count }) => {
      const p = sourceProfile(release),
        files = await profileMigrations(release);
      expect(p.tables).toHaveLength(tables);
      expect(p.forced).toHaveLength(forced);
      expect(files).toHaveLength(count);
      const rows = files.map((f) => ({
        migration_name: f.name,
        checksum: f.checksum,
        finished_at: true,
        rolled_back_at: null as unknown,
      }));
      const old = {
        migration_name: "202610160008_company_metadata",
        checksum: reviewedRollback008,
        finished_at: null,
        rolled_back_at: true,
      };
      expect(() => validateProfileHistory([...rows, old], files)).not.toThrow();
      expect(profileHistoryIdentity([...rows, old])).toEqual(
        profileHistoryIdentity([old, ...rows.toReversed()]),
      );
      expect(() => validateProfileHistory([...rows, old, old], files)).toThrow(
        "BACKUP_ROLLBACK_HISTORY_REJECTED",
      );
      expect(() =>
        validateProfileHistory(
          [...rows, { ...old, checksum: "0".repeat(64) }],
          files,
        ),
      ).toThrow("BACKUP_ROLLBACK_HISTORY_REJECTED");
      expect(() => validateProfileHistory(rows.slice(1), files)).toThrow(
        "MIGRATIONS_INCOMPLETE",
      );
      expect(() =>
        validateProfileHistory(
          [...rows, { ...old, rolled_back_at: null }],
          files,
        ),
      ).toThrow("MIGRATIONS_INCOMPLETE");
      const wrong = structuredClone(rows);
      wrong[0].checksum = "0".repeat(64);
      expect(() => validateProfileHistory(wrong, files)).toThrow(
        "MIGRATION_CHECKSUM_MISMATCH",
      );
    },
  );
  it("keeps release activation on remote blocked before connecting", async () => {
    await expect(
      inspectSource(
        new URL(
          `postgresql://pusula_backup:synthetic@${developmentTarget.host}/pusula_development?sslmode=verify-full`,
        ),
        MANAGED,
        "post017",
      ),
    ).rejects.toThrow("BACKUP_RELEASE_REMOTE_NOT_APPROVED");
  });
  it("derives renamed finance bodies from pinned source, rejects body/owner/search_path/execute drift", async () => {
    const expected = sourceFunctions(
      await profileMigrations("post017"),
      "fixture_admin",
    );
    expect(
      expected.find((f) => f.identity === "k1_command_impl(text,jsonb)"),
    ).toBeDefined();
    expect(
      expected.find((f) => f.identity === "k2_post_sale_impl(uuid,text)"),
    ).toBeDefined();
    const rows = expected.map((f) => ({
      ...f,
      grantable: false,
      executable: [
        "reject_price_history_change()",
        "reject_auth_security_event_change()",
        "reject_audit_event_change()",
        "pusula_sale_child_same_transaction()",
      ].includes(f.identity),
    }));
    expect(() => validateProfileFunctions(rows, expected)).not.toThrow();
    const changedResult = structuredClone(rows);
    const tableResult = changedResult.find(
      (r) => r.identity === "v43b_net_received(uuid)",
    )!;
    tableResult.result = tableResult.result.replace(
      '"orderLineId"',
      '"order LineId"',
    );
    expect(() => validateProfileFunctions(changedResult, expected)).toThrow(
      "SOURCE_FUNCTION_DEFINITION_REJECTED",
    );
    for (const change of [
      { body: "tampered" },
      { owner: "pusula_backup" },
      { config: ["search_path=public"] },
      { grantable: true },
      { executable: true },
    ]) {
      const changed = structuredClone(rows);
      const index = changed.findIndex(
        (f) => f.identity === "k4_expense(jsonb)",
      );
      Object.assign(changed[index], change);
      expect(() => validateProfileFunctions(changed, expected)).toThrow();
    }
  });
  it("rejects missing table SELECT, grant options, unexpected grantor and extra DML", () => {
    const good = [
      {
        kind: "table",
        identity: "Tenant",
        grantor: "fixture_admin",
        privilege_type: "SELECT",
        is_grantable: false,
      },
      {
        kind: "schema",
        identity: "public",
        grantor: "pg_database_owner",
        privilege_type: "USAGE",
        is_grantable: false,
      },
      {
        kind: "database",
        identity: "fixture",
        grantor: "fixture_admin",
        privilege_type: "CONNECT",
        is_grantable: false,
      },
    ];
    expect(() =>
      validateBackupAcl(good, ["Tenant"], "fixture_admin", "fixture"),
    ).not.toThrow();
    for (const delta of [
      { grantor: "unexpected" },
      { is_grantable: true },
      { privilege_type: "INSERT" },
    ]) {
      const changed = structuredClone(good);
      Object.assign(changed[0], delta);
      expect(() =>
        validateBackupAcl(changed, ["Tenant"], "fixture_admin", "fixture"),
      ).toThrow("BACKUP_DIRECT_ACL_GRANTOR_REJECTED");
    }
    expect(() =>
      validateBackupAcl(good.slice(1), ["Tenant"], "fixture_admin", "fixture"),
    ).toThrow("BACKUP_DIRECT_ACL_GRANTOR_REJECTED");
  });
});
