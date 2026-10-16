import { describe, it, expect } from "vitest";
import { decide } from "../src/lib/auth/policy";
import type { Grant, Scope } from "../src/lib/auth/catalog";
const tenant: Scope = {
  kind: "TENANT",
  tenantId: "a",
  legalEntityId: null,
  activityId: null,
};
const grant = (
  effect: "ALLOW" | "DENY",
  source: "ROLE" | "OVERRIDE",
  scope = tenant,
): Grant => ({ permissionId: "customers.view", effect, source, scope });
describe("authorization decision", () => {
  it("defaults deny", () =>
    expect(decide("u", "customers.view", { tenantId: "a" }, [])).toBe(false));
  it("role allows", () =>
    expect(
      decide("u", "customers.view", { tenantId: "a" }, [
        grant("ALLOW", "ROLE"),
      ]),
    ).toBe(true));
  it("explicit deny beats master role and override allow", () =>
    expect(
      decide("u", "customers.view", { tenantId: "a" }, [
        grant("ALLOW", "ROLE"),
        grant("ALLOW", "OVERRIDE"),
        grant("DENY", "OVERRIDE"),
      ]),
    ).toBe(false));
  it("user allow works without role", () =>
    expect(
      decide("u", "customers.view", { tenantId: "a" }, [
        grant("ALLOW", "OVERRIDE"),
      ]),
    ).toBe(true));
  it("never crosses tenant", () =>
    expect(
      decide("u", "customers.view", { tenantId: "b" }, [
        grant("ALLOW", "ROLE"),
      ]),
    ).toBe(false));
  it("legal entity restriction", () =>
    expect(
      decide("u", "customers.view", { tenantId: "a", legalEntityId: "b" }, [
        grant("ALLOW", "ROLE", {
          ...tenant,
          kind: "LEGAL_ENTITY",
          legalEntityId: "c",
        }),
      ]),
    ).toBe(false));
  it("activity restriction", () =>
    expect(
      decide(
        "u",
        "customers.view",
        { tenantId: "a", legalEntityId: "c", activityId: "software" },
        [
          grant("ALLOW", "ROLE", {
            ...tenant,
            kind: "ACTIVITY",
            legalEntityId: "c",
            activityId: "advertising",
          }),
        ],
      ),
    ).toBe(false));
  it("own records only", () => {
    const g = grant("ALLOW", "ROLE", {
      ...tenant,
      kind: "OWN",
      legalEntityId: "c",
    });
    expect(
      decide(
        "u",
        "customers.view",
        { tenantId: "a", legalEntityId: "c", createdById: "v" },
        [g],
      ),
    ).toBe(false);
    expect(
      decide(
        "u",
        "customers.view",
        { tenantId: "a", legalEntityId: "c", createdById: "u" },
        [g],
      ),
    ).toBe(true);
  });
  it("deny outside matching scope has no effect", () =>
    expect(
      decide("u", "customers.view", { tenantId: "a", legalEntityId: "c" }, [
        grant("ALLOW", "ROLE"),
        grant("DENY", "OVERRIDE", {
          ...tenant,
          kind: "LEGAL_ENTITY",
          legalEntityId: "d",
        }),
      ]),
    ).toBe(true));
  it("future amount and approval scope fails closed without evidence", () =>
    expect(
      decide("u", "customers.view", { tenantId: "a" }, [
        grant("ALLOW", "ROLE", {
          ...tenant,
          amountLimit: "100",
          requiresApproval: true,
        }),
      ]),
    ).toBe(false));
});
