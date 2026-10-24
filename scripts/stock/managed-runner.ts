// Preparation CLI: offline audit only. No environment loader, network client,
// provider mutation, Prisma child, cleanup or retry exists in this module.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { check, hash } from "../db/migration-safety";
import { stockFiles } from "./migrate";
import { managedMain, planManagedTls } from "./managed-preparation";
import {
  auditManagedPre,
  expectedManagedPost,
  loadManagedContract,
  validateContract,
  type ManagedContract,
  type ManagedSnapshot,
} from "./managed-contract";

// A reviewable cloud plan, not enrollment or an executable approval. Expected
// post is derived from the READ ONLY pre + V4.3b.12 delta, never a target post.
export async function prepareManagedExecutionReview(
  contract: ManagedContract,
  snapshot: ManagedSnapshot,
) {
  const files = (await stockFiles()).files;
  const audit = auditManagedPre(contract, snapshot, files);
  check(
    snapshot.grantors !== null && snapshot.grantors.length > 0,
    "STOCK_MANAGED_GRANTOR_EVIDENCE_REQUIRED",
  );
  const expected = expectedManagedPost(
    snapshot,
    contract.permissions,
    contract.postSchema,
  );
  return {
    status: "REVIEW_PROPOSAL_ONLY" as const,
    applied: false,
    applyEnabled: false,
    cloudAccepted: false,
    target: contract.target,
    checksum: contract.checksum,
    phaseMigrations: files.map((f) => f.name),
    preFingerprint: hash(snapshot),
    grantorPreFingerprint: hash(snapshot.grantors),
    proposedExpectedPostFingerprint: hash(expected),
    postFingerprint: null,
    expectedPostBasis: "read-only-pre-plus-reviewed-016-source-delta",
    audit,
    requiredBeforeApproval: [
      "current-provider-identity-and-capacity",
      "independent-expanded-grantor-pre-review",
      "provider-create-set-grant-revoke-drop-proof",
      "independent-source-encrypted-offsite-backup-key-and-restore-acceptance",
      "maintenance-writer-exclusion-and-rollback-owner",
      "reviewed-cloud-adapter-and-atomic-history-contract",
      "explicit-target-checksum-bound-user-016-apply-approval",
    ],
    failureStates: [
      "NOT_STARTED",
      "ROLLED_BACK_CONFIRMED",
      "ROLLBACK_UNCONFIRMED",
      "COMMIT_OUTCOME_UNKNOWN",
      "POST_COMMIT_REVIEW_REQUIRED",
    ],
    automaticRetry: false,
  };
}

export async function prepareManagedAudit(
  contract: ManagedContract,
  input: { url: string; ca: string; projectId: string; branchId: string },
) {
  validateContract(contract);
  check(
    input.projectId === contract.target.projectId &&
      input.branchId === contract.target.branchId,
    "STOCK_MANAGED_TARGET_REJECTED",
  );
  const files = await stockFiles(); // Checks all raw SQL bytes BEFORE any future connection.
  const tls = planManagedTls(input.url, input.ca);
  return {
    mode: "audit" as const,
    applied: false,
    applyEnabled: false as const,
    tls,
    files: files.files,
  };
}

export async function managedRunnerMain(args = process.argv.slice(2)) {
  // Absolute denial before file/env/URL parsing; no flag can enable apply.
  if (args.includes("--apply")) managedMain();
  check(
    args.length === 2 && args[0] === "--audit-snapshot",
    "STOCK_MANAGED_AUDIT_SNAPSHOT_REQUIRED",
  );
  const contract = await loadManagedContract();
  validateContract(contract);
  const manifest = await stockFiles();
  const snapshot: ManagedSnapshot = JSON.parse(await readFile(args[1], "utf8"));
  return auditManagedPre(contract, snapshot, manifest.files);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  managedRunnerMain()
    .then((r) => console.log(JSON.stringify(r)))
    .catch((e) => {
      // No paths, URL/password, SQL text or arbitrary error messages in output.
      const code =
        e instanceof Error && /^STOCK_[A-Z0-9_]+$/.test(e.message)
          ? e.message
          : "STOCK_MANAGED_AUDIT_FAILED";
      console.error(
        JSON.stringify({ status: "BLOCKED", applied: false, code }),
      );
      process.exitCode = 1;
    });
}
