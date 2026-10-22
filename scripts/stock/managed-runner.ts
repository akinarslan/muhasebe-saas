// Preparation CLI: offline audit only. No environment loader, network client,
// provider mutation, Prisma child, cleanup or retry exists in this module.
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { check } from "../db/migration-safety";
import { stockFiles } from "./migrate";
import { managedMain, planManagedTls } from "./managed-preparation";
import {
  auditManagedPre,
  loadManagedContract,
  validateContract,
  type ManagedContract,
  type ManagedSnapshot,
} from "./managed-contract";

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
