// @vitest-environment node
import { expect, it } from "vitest";
import { X509Certificate } from "node:crypto";
import { rootCertificates } from "node:tls";
import {
  auditManagedPre,
  expectedManagedPost,
  loadManagedContract,
  managedFailureState,
  requireManagedPostAcceptance,
  validateContract,
  verifyManagedDelta,
} from "../scripts/stock/managed-contract";
import {
  managedRunnerMain,
  prepareManagedAudit,
} from "../scripts/stock/managed-runner";
import { stockFiles } from "../scripts/stock/migrate";

it("audits historical evidence while explicitly refusing cloud acceptance/enrollment", async () => {
  const c = await loadManagedContract(),
    files = (await stockFiles()).files;
  expect(auditManagedPre(c, c.pre, files)).toMatchObject({
    status: "AUDIT_ONLY",
    acceptance: "NEEDS_EVIDENCE",
    applied: false,
    postFingerprint: null,
  });
  expect(c.pre.grantors).toBeNull();
  expect(() => requireManagedPostAcceptance()).toThrow(
    "STOCK_MANAGED_POST_NOT_ENROLLED",
  );
  expect(() =>
    validateContract({ ...c, applyEnabled: true } as unknown as typeof c),
  ).toThrow();
});

it.each([
  "identity",
  "database",
  "checksum",
  "history",
  "roles",
  "memberships",
  "ACL",
  "coverage",
  "schema",
])("rejects historical pre %s drift", async (kind) => {
  const c = await loadManagedContract(),
    s = structuredClone(c.pre),
    files = (await stockFiles()).files;
  if (kind === "identity") s.identity.sessionActor = "pusula_runtime";
  if (kind === "database") s.identity.database = "pusula_sprint_b_test";
  if (kind === "checksum") files[15].checksum = "0".repeat(64);
  if (kind === "history") s.history.push({ ...s.history[0] });
  if (kind === "roles") s.cluster.roles[0].rolsuper = false;
  if (kind === "memberships") s.cluster.memberships[0].grantor = "unreviewed";
  if (kind === "ACL") s.security.tables[0].is_grantable = true;
  if (kind === "coverage") delete s.security.columns;
  if (kind === "schema") s.schema.functions = "0".repeat(64);
  expect(() => auditManagedPre(c, s, files)).toThrow();
});

it("refuses unknown/resolved/duplicate history and missing grantor coverage", async () => {
  const c = await loadManagedContract(),
    files = (await stockFiles()).files;
  const pre = structuredClone(c.pre),
    post = expectedManagedPost(pre, c.permissions, c.postSchema);
  expect(() =>
    verifyManagedDelta(pre, post, c.permissions, c.postSchema, files),
  ).toThrow("STOCK_MANAGED_GRANTOR_EVIDENCE_REQUIRED");
  for (const change of ["unknown", "rollback", "duplicate"]) {
    const bad = structuredClone(pre);
    if (change === "unknown") bad.history[0].checksum = "0".repeat(64);
    if (change === "rollback")
      bad.history.find((r) => r.rolled_back)!.checksum = "0".repeat(64);
    if (change === "duplicate") bad.history.push({ ...bad.history[0] });
    expect(() => auditManagedPre(c, bad, files)).toThrow();
  }
});

it.each([
  "creator",
  "SET membership",
  "schema CREATE",
  "grantor",
  "PUBLIC execute",
  "non-MASTER permission",
  "owner",
  "extra object",
])("rejects post %s even with a plausible schema fingerprint", async (kind) => {
  const c = await loadManagedContract(),
    pre = structuredClone(c.pre),
    files = (await stockFiles()).files;
  // Synthetic expanded grantor pre only for unit negatives. Actual catalog
  // positive/delta evidence comes from the non-superuser PG18.6 fixture.
  pre.grantors = [];
  const post = expectedManagedPost(pre, c.permissions, c.postSchema);
  if (kind === "creator")
    post.cluster.roles.push({
      ...post.cluster.roles[0],
      rolname: "pusula_stock_role_creator",
    });
  if (kind === "SET membership")
    post.cluster.memberships.push({
      parent: "pusula_stock_executor",
      member: "pusula_runtime",
      set_option: true,
    });
  if (kind === "schema CREATE")
    post.security.schema.push({
      nspname: "public",
      grantee: "pusula_stock_executor",
      privilege_type: "CREATE",
      is_grantable: false,
    });
  if (kind === "grantor") post.grantors![0].grantor = "unreviewed";
  if (kind === "PUBLIC execute")
    post.security.functions.push({
      identity: "v43b_command(text,jsonb)",
      owner: "pusula_stock_executor",
      grantee: "PUBLIC",
      privilege_type: "EXECUTE",
      is_grantable: false,
    });
  if (kind === "non-MASTER permission")
    post.security.rolePermissions.push({
      roleId: "ACCOUNTANT",
      permissionId: "receipts.post",
    });
  if (kind === "owner") post.cluster.tableOwners[0].owner = "pusula_runtime";
  if (kind === "extra object")
    post.cluster.schemas.push({ nspname: "unexpected" });
  expect(() =>
    verifyManagedDelta(pre, post, c.permissions, c.postSchema, files),
  ).toThrow("STOCK_MANAGED_POST_DRIFT");
});

it("denies apply and unknown flags before reading any snapshot or environment", async () => {
  await expect(managedRunnerMain(["--apply", "missing"])).rejects.toThrow(
    "STOCK_MANAGED_APPLY_DISABLED",
  );
  await expect(managedRunnerMain([])).rejects.toThrow(
    "STOCK_MANAGED_AUDIT_SNAPSHOT_REQUIRED",
  );
  await expect(managedRunnerMain(["--restore", "missing"])).rejects.toThrow(
    "STOCK_MANAGED_AUDIT_SNAPSHOT_REQUIRED",
  );
});

it("prepares only a strict owner/development/TLS audit plan", async () => {
  const c = await loadManagedContract();
  const ca = rootCertificates.find((p) => {
    const c = new X509Certificate(p);
    return (
      Date.now() >= Date.parse(c.validFrom) &&
      Date.now() <= Date.parse(c.validTo)
    );
  })!;
  const input = {
    url: `postgresql://neondb_owner:synthetic@${c.target.host}/pusula_development?sslmode=verify-full`,
    ca,
    projectId: c.target.projectId,
    branchId: c.target.branchId,
  };
  expect((await prepareManagedAudit(c, input)).tls.ssl.rejectUnauthorized).toBe(
    true,
  );
  for (const overrides of [
    { branchId: "wrong" },
    { projectId: "wrong" },
    { url: input.url.replace("neondb_owner", "pusula_runtime") },
    { url: input.url.replace("verify-full", "require") },
    { url: input.url.replace(c.target.host, "example.invalid") },
    { ca: "invalid" },
  ])
    await expect(
      prepareManagedAudit(c, { ...input, ...overrides }),
    ).rejects.toThrow();
  await expect(
    prepareManagedAudit({ ...c, checksum: "0".repeat(64) }, input),
  ).rejects.toThrow("STOCK_MANAGED_CONTRACT_REJECTED");
});

it("keeps confirmed rollback, uncertain COMMIT and post-commit failures distinct", () => {
  expect(managedFailureState("before-apply")).toBe("NOT_STARTED");
  expect(managedFailureState("transaction", true)).toBe(
    "ROLLED_BACK_CONFIRMED",
  );
  expect(managedFailureState("transaction")).toBe("ROLLBACK_UNCONFIRMED");
  expect(managedFailureState("commit-sent", true)).toBe(
    "COMMIT_OUTCOME_UNKNOWN",
  );
  expect(managedFailureState("committed", true)).toBe(
    "POST_COMMIT_REVIEW_REQUIRED",
  );
});
