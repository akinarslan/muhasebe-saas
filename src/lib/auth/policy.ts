import Decimal from "decimal.js";
import type { Scope, Resource, Grant } from "./catalog";
export function matchesScope(scope: Scope, resource: Resource, userId: string) {
  if (scope.tenantId !== resource.tenantId) return false;
  if (scope.legalEntityId && scope.legalEntityId !== resource.legalEntityId)
    return false;
  if (scope.kind === "ACTIVITY" && scope.activityId !== resource.activityId)
    return false;
  if (scope.kind === "OWN" && resource.createdById !== userId) return false;
  if (scope.department && scope.department !== resource.department)
    return false;
  if (
    scope.amountLimit != null &&
    (!resource.amount ||
      !new Decimal(resource.amount).isFinite() ||
      new Decimal(resource.amount).gt(scope.amountLimit))
  )
    return false;
  if (scope.requiresApproval && !resource.approved) return false;
  return true;
}
export function decide(
  userId: string,
  action: string,
  resource: Resource,
  grants: Grant[],
): boolean {
  const matches = grants.filter(
    (g) => g.permissionId === action && matchesScope(g.scope, resource, userId),
  );
  if (matches.some((g) => g.effect === "DENY")) return false;
  if (matches.some((g) => g.source === "OVERRIDE" && g.effect === "ALLOW"))
    return true;
  return matches.some((g) => g.source === "ROLE" && g.effect === "ALLOW");
}
