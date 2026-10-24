// Called only by the isolated backup fixture. No environment or provider access.
import type { Client } from "pg";
import { Client as PgClient } from "pg";
import { inspectSource } from "./postgres";
import { STRICT } from "./policy";
import { requireCheck, BackupError } from "./core";
import type { SourceRelease } from "./source-profile";
export async function profilePrivilegeFixture(
  admin: Client,
  u: URL,
  release: SourceRelease,
  pass: (s: string) => void,
) {
  requireCheck(
    u.hostname === "127.0.0.1" && u.pathname === "/pusula_backup_fixture",
    "PROFILE_FIXTURE_TARGET_REJECTED",
  );
  const identity = (
    await admin.query(
      "SELECT current_database() db,current_user actor,current_setting('data_directory') directory,current_setting('server_version_num') version",
    )
  ).rows[0];
  requireCheck(
    identity.db === "pusula_backup_fixture" &&
      identity.actor === "fixture_admin" &&
      identity.version === "180006" &&
      /[\\/]\.data[\\/]fixtures[\\/]e23-[a-f0-9-]{36}[\\/]data$/i.test(
        identity.directory,
      ),
    "PROFILE_FIXTURE_IDENTITY_REJECTED",
  );
  for (const probe of [
    {
      grant: "GRANT pusula_runtime TO pusula_fixture_backup",
      revoke: "REVOKE pusula_runtime FROM pusula_fixture_backup",
      name: "membership",
    },
    {
      grant: 'GRANT UPDATE ON "Tenant" TO pusula_fixture_backup',
      revoke: 'REVOKE UPDATE ON "Tenant" FROM pusula_fixture_backup',
      name: "dml",
    },
    {
      grant:
        'GRANT SELECT ON "Tenant" TO pusula_fixture_backup WITH GRANT OPTION',
      revoke:
        'REVOKE GRANT OPTION FOR SELECT ON "Tenant" FROM pusula_fixture_backup',
      name: "grant-option",
    },
    {
      grant: "GRANT CREATE ON SCHEMA public TO pusula_fixture_backup",
      revoke: "REVOKE CREATE ON SCHEMA public FROM pusula_fixture_backup",
      name: "schema-create",
    },
    {
      grant:
        "GRANT EXECUTE ON FUNCTION pusula_can(text,uuid,uuid,uuid,text) TO pusula_fixture_backup",
      revoke:
        "REVOKE EXECUTE ON FUNCTION pusula_can(text,uuid,uuid,uuid,text) FROM pusula_fixture_backup",
      name: "function-execute",
    },
  ]) {
    await admin.query(probe.grant);
    try {
      let rejected = false;
      try {
        const opened = await inspectSource(u, STRICT, release);
        await opened.db.query("ROLLBACK");
        await opened.db.end();
      } catch (e) {
        if (e instanceof BackupError) {
          requireCheck(
            e.code ===
              (probe.name === "membership"
                ? "SOURCE_ROLE_MEMBERSHIP_REJECTED"
                : "BACKUP_DIRECT_ACL_GRANTOR_REJECTED"),
            "PROFILE_WRONG_REJECTION_REASON",
          );
          rejected = true;
        } else throw e;
      }
      requireCheck(rejected, "PROFILE_UNSAFE_GRANT_ACCEPTED");
      pass(`profile-rejects-${probe.name}`);
    } finally {
      await admin.query(probe.revoke);
    }
  }
  const backup = new PgClient({ connectionString: u.toString() });
  await backup.connect();
  try {
    for (const sql of [
      'UPDATE "Tenant" SET name=name',
      'TRUNCATE "Tenant"',
      "CREATE TABLE public.denied_backup_probe(id int)",
      "SET ROLE pusula_runtime",
      ...(release === "post017" ? ["SELECT k4_expense('{}'::jsonb)"] : []),
    ]) {
      await backup.query("BEGIN READ WRITE");
      try {
        let code: string | undefined;
        try {
          await backup.query(sql);
        } catch (e) {
          code = (e as { code?: string }).code;
        }
        requireCheck(
          code === "42501",
          "PROFILE_BACKUP_WRITE_OR_EXECUTE_NOT_DENIED",
        );
      } finally {
        await backup.query("ROLLBACK");
      }
    }
  } finally {
    await backup.end();
  }
  pass("profile-real-write-truncate-ddl-role-execute-denials");
}
