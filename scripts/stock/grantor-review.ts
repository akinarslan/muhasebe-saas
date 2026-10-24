// Independent pre-review: input is the older reviewed security contract, never
// the newly observed grantor array. This does not enroll or approve a baseline.
import type { Row, Rows } from "./managed-contract";

export function expectedPreGrantors(security: Rows): Row[] {
  for (const kind of [
    "tables",
    "functions",
    "database",
    "schema",
    "defaults",
    "columns",
  ])
    if (!Array.isArray(security[kind]))
      throw new Error("GRANTOR_CONTRACT_INCOMPLETE");
  // There is no reviewed column grantor policy. Fail closed if one is needed.
  if (security.columns.length)
    throw new Error("COLUMN_GRANTOR_REVIEW_REQUIRED");
  return ["tables", "functions", "database", "schema", "defaults"].flatMap(
    (kind) =>
      security[kind].map((r) => {
        const owner =
          kind === "database"
            ? "<owner>"
            : kind === "schema"
              ? "pg_database_owner"
              : r.owner;
        if (typeof owner !== "string") throw new Error("GRANTOR_OWNER_MISSING");
        const identity =
          kind === "tables"
            ? r.relname
            : kind === "database"
              ? "<database>"
              : kind === "schema"
                ? r.nspname
                : kind === "defaults"
                  ? `${r.ns}:${r.defaclobjtype}`
                  : r.identity;
        return {
          kind,
          identity,
          owner,
          grantee: r.grantee,
          grantor: owner,
          privilege_type: r.privilege_type,
          is_grantable: r.is_grantable,
        };
      }),
  );
}

const key = (r: Row) =>
  JSON.stringify([
    r.kind,
    r.identity,
    r.owner,
    r.grantee,
    r.grantor,
    r.privilege_type,
    r.is_grantable,
  ]);
export function reviewPreGrantors(security: Rows, observed: Row[] | null) {
  if (observed === null) throw new Error("GRANTOR_EVIDENCE_MISSING");
  const expected = expectedPreGrantors(security);
  const remaining = observed.map(key);
  const missing: Row[] = [];
  for (const row of expected) {
    const index = remaining.indexOf(key(row));
    if (index < 0) missing.push(row);
    else remaining.splice(index, 1);
  }
  return {
    status:
      missing.length || remaining.length
        ? "DRIFT"
        : "MATCH_REQUIRES_PROVIDER_REVIEW",
    expected: expected.length,
    matched: expected.length - missing.length,
    missing,
    unexpected: remaining.map((k) => JSON.parse(k)),
    // Equality with a historical contract is not provider security approval.
    accepted: false,
    applyEnabled: false,
  };
}
