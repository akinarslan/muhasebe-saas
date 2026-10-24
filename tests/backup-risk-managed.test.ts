// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  riskManagedProfile as p,
  riskManagedReadiness,
  openRiskManagedFixture,
  assertRiskFixtureTarget,
} from "../scripts/backup/risk-managed";
import { selectPolicy } from "../scripts/backup/policy";
import { manifestSchema } from "../scripts/backup/core";

const reviewed = (): Parameters<typeof riskManagedReadiness>[0] => ({
  target: { ...p.target },
  routineHashes: Object.fromEntries(
    Object.entries(p.routines).map(([k, v]) => [k, v.sha256]),
  ),
  viewHashes: { ...p.views },
  extensions: { ...p.extensions },
});
describe("separate disabled risk-managed profile", () => {
  it("does not approve remote work even with exact pins and explicit selection", () => {
    expect(p.enabled).toBe(false);
    expect(riskManagedReadiness(reviewed()).reasons).toContain(
      "RISK_MANAGED_DISABLED",
    );
    const r = riskManagedReadiness({ ...reviewed(), enabled: true });
    expect(r.policy).toBe("RISK_MANAGED_POLICY_BLOCKED");
    expect(r.remote).toBe("BACKUP_REMOTE_BLOCKED");
    expect(r.reasons).toContain("LIVE_ROLE_CLOSE_AUTHORITY_UNPROVEN");
    expect(r.applyEnabled).toBe(false);
  });
  it.each([
    "project",
    "branch",
    "host",
    "database",
    "version",
    "release",
    "tables",
    "forced",
  ] as const)("rejects %s drift", (key) => {
    const input = reviewed();
    Object.assign(input.target, {
      [key]: typeof input.target[key] === "number" ? 0 : "unexpected",
    });
    expect(riskManagedReadiness(input).reasons).toContain(
      "RISK_MANAGED_TARGET_OR_PHASE_DRIFT",
    );
  });
  it("rejects changed, missing and additional provider routines or views", () => {
    for (const key of Object.keys(p.routines)) {
      const input = reviewed();
      input.routineHashes[key] = "0".repeat(64);
      expect(riskManagedReadiness(input).reasons).toContain(
        "RISK_MANAGED_PROVIDER_DEFINITION_DRIFT",
      );
    }
    const extra = reviewed();
    extra.routineHashes["public.new_unknown()"] = "0".repeat(64);
    expect(riskManagedReadiness(extra).reasons).toContain(
      "RISK_MANAGED_PROVIDER_DEFINITION_DRIFT",
    );
    expect(
      riskManagedReadiness({ ...reviewed(), routineHashes: {} }).reasons,
    ).toContain("RISK_MANAGED_PROVIDER_DEFINITION_DRIFT");
    expect(
      riskManagedReadiness({ ...reviewed(), viewHashes: {} }).reasons,
    ).toContain("RISK_MANAGED_PROVIDER_VIEW_DRIFT");
  });
  it("requires local explicit opt-in and rejects remote before opening a socket", async () => {
    const remote = new URL(
      "postgresql://pusula_fixture_backup@example.invalid/pusula_backup_fixture?sslmode=disable",
    );
    expect(() => assertRiskFixtureTarget(remote)).toThrow(
      "RISK_MANAGED_FIXTURE_TARGET_REJECTED",
    );
    await expect(openRiskManagedFixture(remote, "pre016")).rejects.toThrow(
      "RISK_MANAGED_EXPLICIT_SELECTION_REQUIRED",
    );
    await expect(
      openRiskManagedFixture(remote, "pre016", true),
    ).rejects.toThrow("RISK_MANAGED_FIXTURE_TARGET_REJECTED");
  });
  it("rejects unknown extension versions without enrollment", () => {
    expect(
      riskManagedReadiness({
        ...reviewed(),
        extensions: { pg_stat_statements: "unknown" },
      }).reasons,
    ).toContain("RISK_MANAGED_EXTENSION_DRIFT");
  });
  it("cannot silently select existing policy or upload a risk-managed manifest", () => {
    expect(() => selectPolicy("risk-managed-v1", true, false)).toThrow(
      "SECURITY_POLICY_INVALID",
    );
    expect(
      manifestSchema.shape.securityPolicy.safeParse("risk-managed-v1").success,
    ).toBe(false);
  });
});
