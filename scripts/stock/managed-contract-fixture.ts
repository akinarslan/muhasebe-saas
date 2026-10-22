// Called ONLY after localIdentity verifies the UUID/loopback fixture cluster.
// Mutations below are explicit negative-test injections, never runner cleanup.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Client } from "pg";
import { hash } from "../db/migration-safety";
import {
  collectManagedSnapshot,
  loadManagedContract,
  expectedManagedPost,
  verifyManagedDelta,
  requireManagedPostAcceptance,
  type ManagedSnapshot,
} from "./managed-contract";
import { stockFiles, localIdentity } from "./migrate";

// Independent minimal reproduction, not a modified migration or ACL repair.
// Both the failure and the working owner path are rolled back completely.
export async function proveManagedOwnerAclBoundary(
  admin: Client,
  actor: Client,
  env: NodeJS.ProcessEnv,
  dir: string,
) {
  await localIdentity(admin, env);
  const before = hash(await fixtureSnapshot(actor));
  const notices: string[] = [];
  const onNotice = (n: { code?: string }) => {
    if (n.code) notices.push(n.code);
  };
  actor.on("notice", onNotice);
  let evidence: unknown;
  try {
    await actor.query("BEGIN");
    await actor.query(
      "CREATE ROLE fixture_acl_probe_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS",
    );
    await actor.query(
      "GRANT fixture_acl_probe_owner TO CURRENT_USER WITH INHERIT FALSE, SET TRUE",
    );
    await actor.query(
      "GRANT CREATE ON SCHEMA public TO fixture_acl_probe_owner",
    );
    await actor.query(
      "CREATE FUNCTION public.fixture_acl_probe() RETURNS integer LANGUAGE sql AS 'SELECT 1'",
    );
    await actor.query(
      "ALTER FUNCTION public.fixture_acl_probe() OWNER TO fixture_acl_probe_owner",
    );
    const capabilities = (
      await actor.query(
        "SELECT pg_has_role(current_user,'fixture_acl_probe_owner','SET') can_set,pg_has_role(current_user,'fixture_acl_probe_owner','USAGE') inherits",
      )
    ).rows[0];
    assert.deepEqual(capabilities, { can_set: true, inherits: false });
    const grants = async () =>
      (
        await actor.query(
          "SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee,pg_get_userbyid(a.grantor) grantor,a.privilege_type FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid='public.fixture_acl_probe()'::regprocedure ORDER BY 1,2",
        )
      ).rows;
    await actor.query(
      "REVOKE ALL ON FUNCTION public.fixture_acl_probe() FROM PUBLIC",
    );
    await actor.query(
      "GRANT EXECUTE ON FUNCTION public.fixture_acl_probe() TO pusula_runtime",
    );
    const withoutSet = await grants();
    assert.ok(withoutSet.some((r) => r.grantee === "PUBLIC"));
    assert.ok(!withoutSet.some((r) => r.grantee === "pusula_runtime"));
    await actor.query("SET LOCAL ROLE fixture_acl_probe_owner");
    await actor.query(
      "REVOKE ALL ON FUNCTION public.fixture_acl_probe() FROM PUBLIC",
    );
    await actor.query(
      "GRANT EXECUTE ON FUNCTION public.fixture_acl_probe() TO pusula_runtime",
    );
    await actor.query("RESET ROLE");
    const withSet = await grants();
    assert.ok(!withSet.some((r) => r.grantee === "PUBLIC"));
    assert.ok(
      withSet.some(
        (r) =>
          r.grantee === "pusula_runtime" &&
          r.grantor === "fixture_acl_probe_owner",
      ),
    );
    evidence = { capabilities, withoutSet, withSet, noticeCodes: notices };
  } finally {
    await actor.query("ROLLBACK");
    actor.removeListener("notice", onNotice);
  }
  assert.equal(hash(await fixtureSnapshot(actor)), before);
  await writeFile(
    join(dir, "acl-owner-boundary.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    JSON.stringify({
      aclFixCheck:
        "independent-set-vs-inherit-owner-grant-revoke-atomic-rollback",
      status: "PASS",
    }),
  );
}

export async function verifyManagedFunctionAcl(
  admin: Client,
  actor: Client,
  env: NodeJS.ProcessEnv,
  dir: string,
) {
  await localIdentity(admin, env);
  const s = await fixtureSnapshot(actor);
  const acl = s.security.functions.filter((r) =>
    String(r.identity).startsWith("v43b_"),
  );
  assert.equal(acl.filter((r) => r.grantee === "PUBLIC").length, 0);
  assert.deepEqual(
    acl
      .filter((r) => r.grantee === "pusula_runtime")
      .map((r) => r.identity)
      .sort(),
    [
      "v43b_command(text,jsonb)",
      "v43b_order_received(uuid)",
      "v43b_receipt_outcome(uuid,text)",
    ],
  );
  assert.ok(!acl.some((r) => String(r.grantee).includes("auth")));
  const effective = (
    await actor.query(
      "SELECT p.oid::regprocedure::text identity,has_function_privilege('pusula_runtime',p.oid,'EXECUTE') runtime_execute,has_function_privilege('pusula_auth',p.oid,'EXECUTE') auth_execute FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname LIKE 'v43b_%' ORDER BY 1",
    )
  ).rows;
  assert.equal(effective.length, 6);
  for (const r of effective) {
    assert.equal(r.auth_execute, false);
    assert.equal(
      r.runtime_execute,
      [
        "v43b_command(text,jsonb)",
        "v43b_order_received(uuid)",
        "v43b_receipt_outcome(uuid,text)",
      ].includes(r.identity),
    );
  }
  for (const table of [
    "StockLocation",
    "GoodsReceipt",
    "GoodsReceiptLine",
    "StockLot",
    "StockPostingBatch",
    "StockMovement",
    "StockBalance",
  ]) {
    await admin.query("BEGIN");
    try {
      await admin.query("SET LOCAL ROLE pusula_runtime");
      await assert.rejects(
        () => admin.query(`INSERT INTO public."${table}" DEFAULT VALUES`),
        (e: unknown) => (e as { code?: string }).code === "42501",
      );
    } finally {
      await admin.query("ROLLBACK");
    }
  }
  await writeFile(
    join(dir, "function-acl-postflight.json"),
    JSON.stringify(
      {
        acl,
        effective,
        publicExecute: 0,
        runtimeDirectExecute: 3,
        unauthorizedHelperExecute: 0,
        runtimeDirectStockInsertDenied: 7,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      aclFixCheck:
        "public-zero-runtime-direct-three-auth-helper-denied-stock-dml-denied",
      status: "PASS",
    }),
  );
}

export async function fixtureSnapshot(actor: Client) {
  await actor.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    return await collectManagedSnapshot(actor);
  } catch (error) {
    // Local catalog diagnostic only; never includes SQL, URL or row contents.
    const e = error as { code?: string; message?: string };
    console.log(
      JSON.stringify({ managedSnapshotError: e.code, detail: e.message }),
    );
    throw error;
  } finally {
    await actor.query("ROLLBACK");
  }
}

export async function verifyManagedContractFixture(
  admin: Client,
  actor: Client,
  pre: ManagedSnapshot,
  env: NodeJS.ProcessEnv,
  dir: string,
) {
  await localIdentity(admin, env);
  const contract = await loadManagedContract();
  const files = (await stockFiles()).files;
  const originalPost = await fixtureSnapshot(actor);
  await writeFile(
    join(dir, "managed-contract-snapshots.json"),
    JSON.stringify(
      {
        pre,
        post: originalPost,
        expected: expectedManagedPost(
          pre,
          contract.permissions,
          contract.postSchema,
        ),
      },
      null,
      2,
    ),
  );
  const verify = (s: ManagedSnapshot) =>
    verifyManagedDelta(
      pre,
      s,
      contract.permissions,
      contract.postSchema,
      files,
    );
  const pass = (name: string) =>
    console.log(JSON.stringify({ managedContractCheck: name, status: "PASS" }));
  const post = originalPost;
  verify(post);
  pass("fixed-sql-postflight-without-test-only-acl-correction");
  assert.throws(
    () => requireManagedPostAcceptance(),
    /STOCK_MANAGED_POST_NOT_ENROLLED/,
  );
  pass("passing-local-invariants-does-not-enroll-neon-post");
  // Each state is measured again from actual committed local PG catalogs.
  for (const [name, inject, restore] of [
    [
      "executor-createrole",
      "ALTER ROLE pusula_stock_executor CREATEROLE",
      "ALTER ROLE pusula_stock_executor NOCREATEROLE",
    ],
    [
      "executor-membership",
      "GRANT pusula_stock_executor TO pusula_runtime WITH INHERIT FALSE, SET TRUE",
      "REVOKE pusula_stock_executor FROM pusula_runtime",
    ],
    [
      "temporary-schema-create",
      "GRANT CREATE ON SCHEMA public TO pusula_stock_executor",
      "REVOKE CREATE ON SCHEMA public FROM pusula_stock_executor",
    ],
    [
      "temporary-creator-remnant",
      "CREATE ROLE pusula_stock_role_creator NOLOGIN",
      "DROP ROLE pusula_stock_role_creator",
    ],
    [
      "runtime-ledger-dml",
      'GRANT INSERT ON public."StockMovement" TO pusula_runtime',
      'REVOKE INSERT ON public."StockMovement" FROM pusula_runtime',
    ],
    [
      "public-function-execute",
      "GRANT EXECUTE ON FUNCTION v43b_command(text,jsonb) TO PUBLIC",
      "REVOKE EXECUTE ON FUNCTION v43b_command(text,jsonb) FROM PUBLIC",
    ],
    [
      "extra-schema",
      "CREATE SCHEMA fixture_unexpected",
      "DROP SCHEMA fixture_unexpected",
    ],
    [
      "non-master-permission",
      'INSERT INTO public."RolePermission"("roleId","permissionId") VALUES(\'ACCOUNTANT\',\'receipts.post\')',
      'DELETE FROM public."RolePermission" WHERE "roleId"=\'ACCOUNTANT\' AND "permissionId"=\'receipts.post\'',
    ],
  ]) {
    await admin.query(inject);
    try {
      const bad = await fixtureSnapshot(actor);
      assert.throws(() => verify(bad), /STOCK_MANAGED_POST_DRIFT/);
    } finally {
      await admin.query(restore);
    }
    verify(await fixtureSnapshot(actor));
    pass(name + "-rejected-and-fixture-restored");
  }
  // The function owner is still the same; a different ACL grantor must fail too.
  const badGrantor = structuredClone(post);
  badGrantor.grantors![0].grantor = "unreviewed_grantor";
  assert.throws(() => verify(badGrantor), /STOCK_MANAGED_POST_DRIFT_grantors/);
  pass("grantor-only-drift-rejected");
  const missing = structuredClone(post);
  missing.grantors = null;
  assert.throws(
    () => verify(missing),
    /STOCK_MANAGED_GRANTOR_EVIDENCE_REQUIRED/,
  );
  pass("missing-grantor-coverage-rejected");
  verify(await fixtureSnapshot(actor));
  pass("negative-injections-removed-fixed-sql-still-passes");
}
