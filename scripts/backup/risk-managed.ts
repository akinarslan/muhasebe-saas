// Separate, disabled review profile. Not registered with the existing CLI,
// policy selector, manifest format or upload engine.
import { requireCheck, canonical } from "./core";
import { inspectSource } from "./postgres";
import { STRICT } from "./policy";
import type { SourceRelease } from "./source-profile";

export const riskManagedDecisionStates = [
  "RISK_MANAGED_POLICY_PASS",
  "RISK_MANAGED_POLICY_BLOCKED",
  "CREDENTIAL_LIFECYCLE_PASS",
  "CREDENTIAL_LIFECYCLE_BLOCKED",
  "BACKUP_REMOTE_READY_FOR_APPROVAL",
  "BACKUP_REMOTE_BLOCKED",
] as const;
export type RiskManagedPolicyDecision =
  "RISK_MANAGED_POLICY_PASS" | "RISK_MANAGED_POLICY_BLOCKED";
export type BackupRemoteDecision =
  "BACKUP_REMOTE_READY_FOR_APPROVAL" | "BACKUP_REMOTE_BLOCKED";

export const riskManagedProfile = {
  name: "risk-managed-v1",
  enabled: false,
  extensions: { pg_stat_statements: "1.12" },
  views: {
    "public.pg_stat_statements":
      "a7d302f946532331aba5555ba48b125d4aa4fb08b36a2deabf851424b09a8804",
    "public.pg_stat_statements_info":
      "c8c7ea423e30064b1d95b0c3be96f3ab6349825885ae7518cdef0089ae48836d",
  },
  target: {
    project: "icy-queen-44442204",
    branch: "br-rough-darkness-ba6ow9zo",
    host: "ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech",
    database: "pusula_development",
    version: 180006,
    release: "pre016",
    tables: 40,
    forced: 26,
  },
  // Definition pins are review evidence, not proof of C library behavior.
  routines: {
    "public.pg_stat_statements(boolean)": {
      sha256:
        "2244205b20fed9bfb599420ec6968be92a95dbe795bf7879e7d7f4817da23869",
      effect: "extension-metadata-c-implementation-unverified",
    },
    "public.pg_stat_statements_info()": {
      sha256:
        "043eb974c4d96e4a5f1487346983acf7721c1bf8847b2271a42f3cfaa864ff33",
      effect: "extension-metadata-c-implementation-unverified",
    },
    "public.health_check_write_succeeds()": {
      sha256:
        "740eacee62e44cb5a19012a8738761e86479fc99d5ce19100cbf4ce10ba5d70d",
      effect: "invoker-upsert-provider-health-table",
    },
    "public.get_compute_primary_memory_bytes()": {
      sha256:
        "dc47998e1bbb6500f92acf9c774e84936d0d55683131c601ef5ab0d4bbca1275",
      effect: "invoker-conditional-provider-table-read-errors-return-null",
    },
  },
} as const;

export function riskManagedReadiness(input: {
  enabled?: boolean;
  target: {
    project: string;
    branch: string;
    host: string;
    database: string;
    version: number;
    release: string;
    tables: number;
    forced: number;
  };
  routineHashes: Record<string, string>;
  viewHashes?: Record<string, string>;
  extensions?: Record<string, string>;
}) {
  const reasons: string[] = [];
  if (!input.enabled) reasons.push("RISK_MANAGED_DISABLED");
  if (canonical(input.target) !== canonical(riskManagedProfile.target))
    reasons.push("RISK_MANAGED_TARGET_OR_PHASE_DRIFT");
  const expected = Object.entries(riskManagedProfile.routines);
  if (
    Object.keys(input.routineHashes).length !== expected.length ||
    expected.some(([k, v]) => input.routineHashes[k] !== v.sha256)
  )
    reasons.push("RISK_MANAGED_PROVIDER_DEFINITION_DRIFT");
  if (
    Object.keys(input.viewHashes ?? {}).length !== 2 ||
    Object.entries(riskManagedProfile.views).some(
      ([k, v]) => input.viewHashes?.[k] !== v,
    )
  )
    reasons.push("RISK_MANAGED_PROVIDER_VIEW_DRIFT");
  if (
    canonical(input.extensions ?? {}) !==
    canonical(riskManagedProfile.extensions)
  )
    reasons.push("RISK_MANAGED_EXTENSION_DRIFT");
  // No caller-supplied boolean can approve an unimplemented remote adapter.
  reasons.push(
    "C_EXTENSION_BEHAVIOR_REVIEW_REQUIRED",
    "LIVE_ROLE_CLOSE_AUTHORITY_UNPROVEN",
    "REMOTE_ADAPTER_NOT_APPROVED",
    "INDEPENDENT_KEY_OFFSITE_RESTORE_REQUIRED",
  );
  return {
    policy: "RISK_MANAGED_POLICY_BLOCKED" as const,
    remote: "BACKUP_REMOTE_BLOCKED" as const,
    reasons,
    applyEnabled: false,
  };
}

export function assertRiskFixtureTarget(u: URL) {
  requireCheck(
    u.hostname === "127.0.0.1" &&
      u.pathname === "/pusula_backup_fixture" &&
      decodeURIComponent(u.username) === "pusula_fixture_backup" &&
      u.searchParams.get("sslmode") === "disable",
    "RISK_MANAGED_FIXTURE_TARGET_REJECTED",
  );
}

// Only reuses the stronger existing local source/ACL/history checker. This
// adapter makes no PUBLIC exception and cannot open any remote connection.
export async function openRiskManagedFixture(
  u: URL,
  release: SourceRelease,
  explicitlySelected = false,
) {
  requireCheck(explicitlySelected, "RISK_MANAGED_EXPLICIT_SELECTION_REQUIRED");
  assertRiskFixtureTarget(u);
  return inspectSource(u, STRICT, release);
}
