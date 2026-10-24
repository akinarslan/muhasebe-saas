// Called only by the isolated backup fixture. No environment or provider access.
import type { Client } from "pg";
import { Client as PgClient } from "pg";
import { inspectSource } from "./postgres";
import { STRICT } from "./policy";
import { requireCheck, BackupError } from "./core";
import { sourceProfile, type SourceRelease } from "./source-profile";
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
  // Rehearse NOLOGIN provisioning separately from the existing synthetic login.
  // A non-superuser creator proves the direction of PG18's automatic ADMIN edge.
  // Everything, including both roles, is rolled back; no real credential exists.
  await admin.query("BEGIN");
  try {
    await admin.query(
      "CREATE ROLE fixture_backup_creator NOLOGIN NOSUPERUSER NOCREATEDB CREATEROLE NOINHERIT NOREPLICATION BYPASSRLS",
    );
    await admin.query("SET LOCAL ROLE fixture_backup_creator");
    await admin.query("SET LOCAL createrole_self_grant = ''");
    await admin.query(
      "CREATE ROLE pusula_backup NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION BYPASSRLS PASSWORD NULL",
    );
    await admin.query("RESET ROLE");
    const role = (
      await admin.query(
        "SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls,rolpassword IS NULL password_null FROM pg_authid WHERE rolname='pusula_backup'",
      )
    ).rows[0];
    requireCheck(
      role &&
        Object.entries(role).every(
          ([k, v]) => v === ["rolbypassrls", "password_null"].includes(k),
        ),
      "PROFILE_NOLOGIN_FLAGS_REJECTED",
    );
    const members = (
      await admin.query(
        "SELECT roleid::regrole::text parent,member::regrole::text member,admin_option,inherit_option,set_option FROM pg_auth_members WHERE roleid='pusula_backup'::regrole OR member='pusula_backup'::regrole",
      )
    ).rows;
    requireCheck(
      members.length === 1 &&
        members[0].parent === "pusula_backup" &&
        members[0].member === "fixture_backup_creator" &&
        members[0].admin_option &&
        !members[0].inherit_option &&
        !members[0].set_option,
      "PROFILE_CREATOR_ADMIN_DIRECTION_REJECTED",
    );
    const tables = sourceProfile(release).tables;
    await admin.query(
      "GRANT CONNECT ON DATABASE pusula_backup_fixture TO pusula_backup",
    );
    await admin.query("GRANT USAGE ON SCHEMA public TO pusula_backup");
    await admin.query(
      `GRANT SELECT ON TABLE ${tables.map((t) => `public."${t}"`).join(",")} TO pusula_backup`,
    );
    requireCheck(
      (
        await admin.query(
          "SELECT count(*)::int n FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND has_table_privilege('pusula_backup',c.oid,'SELECT') AND NOT has_table_privilege('pusula_backup',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN,SELECT WITH GRANT OPTION')",
        )
      ).rows[0].n === tables.length,
      "PROFILE_NOLOGIN_SELECT_SCOPE_REJECTED",
    );
    // The object grantor removes only this rehearsal's explicit grants. Do not
    // use DROP OWNED/CASCADE, which could hide accidental ownership or grants.
    await admin.query(
      `REVOKE SELECT ON TABLE ${tables.map((t) => `public."${t}"`).join(",")} FROM pusula_backup`,
    );
    await admin.query("REVOKE USAGE ON SCHEMA public FROM pusula_backup");
    await admin.query(
      "REVOKE CONNECT ON DATABASE pusula_backup_fixture FROM pusula_backup",
    );
    await admin.query("SET LOCAL ROLE fixture_backup_creator");
    await admin.query("DROP ROLE pusula_backup");
    await admin.query("RESET ROLE");
    requireCheck(
      (
        await admin.query(
          "SELECT count(*)::int n FROM pg_roles WHERE rolname='pusula_backup'",
        )
      ).rows[0].n === 0,
      "PROFILE_NOLOGIN_CLEANUP_REJECTED",
    );
  } finally {
    await admin.query("ROLLBACK");
  }
  pass(
    "profile-nologin-nonsuperuser-creator-admin-direction-select-only-and-cleanup",
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
      "INSERT INTO \"Tenant\" (id,name) VALUES (gen_random_uuid(),'denied')",
      'UPDATE "Tenant" SET name=name',
      'DELETE FROM "Tenant"',
      'TRUNCATE "Tenant"',
      "CREATE TABLE public.denied_backup_probe(id int)",
      "SET ROLE pusula_runtime",
      ...(release !== "pre016" ? ["SET ROLE pusula_stock_executor"] : []),
      ...(release === "post017" ? ["SET ROLE pusula_finance_executor"] : []),
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
