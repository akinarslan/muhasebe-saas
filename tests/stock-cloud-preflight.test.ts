// @vitest-environment node
import { expect, it } from "vitest";
import {
  cloudPreflightMain,
  comparePreflight,
} from "../scripts/stock/cloud-preflight";
import { loadManagedContract } from "../scripts/stock/managed-contract";
import { prepareManagedExecutionReview } from "../scripts/stock/managed-runner";

it.each([
  { args: [] },
  { args: ["--apply"] },
  { args: ["--read-only-development", "--apply"] },
])(
  "rejects unapproved CLI input before credential/env/network access ($args)",
  async ({ args }) => {
    await expect(cloudPreflightMain(args)).rejects.toThrow(
      "STOCK_READONLY_APPROVAL_FLAG_REQUIRED",
    );
  },
);
it("new grantor evidence never enrolls itself into a historical null baseline", async () => {
  const c = await loadManagedContract();
  const s = structuredClone(c.pre);
  s.grantors = [];
  const result = comparePreflight(c.pre, s);
  expect(result.grantors).toBe("NEW_MEASUREMENT_REQUIRES_INDEPENDENT_REVIEW");
  expect(c.pre.grantors).toBeNull();
  expect(c.applyEnabled).toBe(false);
  expect(c.postFingerprint).toBeNull();
});
it("a source-derived cloud review proposal cannot enable apply or enroll a measured post", async () => {
  const c = await loadManagedContract();
  await expect(prepareManagedExecutionReview(c, c.pre)).rejects.toThrow(
    "STOCK_MANAGED_GRANTOR_EVIDENCE_REQUIRED",
  );
  const s = structuredClone(c.pre);
  s.grantors = [
    {
      kind: "schema",
      identity: "public",
      grantee: "PUBLIC",
      grantor: "pg_database_owner",
      privilege_type: "USAGE",
    },
  ];
  const p = await prepareManagedExecutionReview(c, s);
  expect(p).toMatchObject({
    status: "REVIEW_PROPOSAL_ONLY",
    applyEnabled: false,
    applied: false,
    cloudAccepted: false,
    postFingerprint: null,
    automaticRetry: false,
  });
  expect(p.phaseMigrations).toHaveLength(16);
  expect(p.phaseMigrations).not.toContain("202610230017_finance");
  expect(p.requiredBeforeApproval).toContain(
    "independent-expanded-grantor-pre-review",
  );
  expect(c.pre.grantors).toBeNull();
  expect(c.postFingerprint).toBeNull();
});
it("reports independent schema, membership and database ACL drift rather than hiding it in a new aggregate pin", async () => {
  const c = await loadManagedContract();
  const s = structuredClone(c.pre);
  s.schema.functions = "0".repeat(64);
  s.cluster.memberships.push({
    parent: "unexpected",
    member: "pusula_runtime",
    set_option: true,
  });
  s.security.database.push({ grantee: "PUBLIC", privilege_type: "CREATE" });
  const result = comparePreflight(c.pre, s);
  expect(result.schema.functions).toBe(false);
  expect(result.cluster.memberships).toBe(false);
  expect(result.security.database).toBe(false);
  expect(result.history).toBe(true);
});
