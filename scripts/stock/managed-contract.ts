// Offline contract evaluation and SELECT-only collection. No env, connector or apply.
import type { Client } from "pg";
import { readFile } from "node:fs/promises";
import { catalog, check, hash } from "../db/migration-safety";
import {
  stockChecksum,
  stockMigration,
  stockSecurity,
  validateStockHistory,
  type StockHistoryRow,
} from "./migrate";

export type Row = Record<string, unknown>;
export type Rows = Record<string, Row[]>;
export type ManagedSnapshot = {
  identity: {
    actor: string;
    sessionActor: string;
    database: string;
    version: number;
  };
  counts: { tables: number; forced: number };
  schema: Record<string, string>;
  history: StockHistoryRow[];
  security: Rows;
  cluster: Rows;
  // Expanded ACL entries include grantors; historical evidence did not collect
  // every such category. Never silently treat absent evidence as an empty ACL.
  grantors: Row[] | null;
};
export type ManagedContract = {
  version: 1;
  target: {
    projectId: string;
    branchId: string;
    host: string;
    database: string;
    owner: string;
  };
  checksum: string;
  applyEnabled: false;
  postFingerprint: null;
  evidence: {
    observedAt: string;
    providerMapping: "historical";
    missing: string[];
  };
  pre: ManagedSnapshot;
  postSchema: Record<string, string>;
  permissions: Row[];
};
export const executor = "pusula_stock_executor";
export const creator = "pusula_stock_role_creator";
export const stockTables = [
  "StockLocation",
  "GoodsReceipt",
  "GoodsReceiptLine",
  "StockLot",
  "StockPostingBatch",
  "StockMovement",
  "StockBalance",
];
const definer = [
  "v43b_command(text,jsonb)",
  "v43b_complete()",
  "v43b_order_received(uuid)",
  "v43b_receipt_outcome(uuid,text)",
];
const helpers = ["v43b_immutable()", "v43b_net_received(uuid)"];
const allTableRights = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
  "MAINTAIN",
];
const equal = (a: unknown, b: unknown, code: string) =>
  check(hash(a) === hash(b), code);
const role = {
  rolname: executor,
  rolcanlogin: false,
  rolsuper: false,
  rolbypassrls: false,
  rolcreatedb: false,
  rolcreaterole: false,
  rolreplication: false,
  rolinherit: true,
  rolconfig: null,
};

export async function loadManagedContract(): Promise<ManagedContract> {
  return JSON.parse(
    await readFile("scripts/stock/managed-contract.json", "utf8"),
  );
}

function completeRows(s: ManagedSnapshot) {
  equal(
    Object.keys(s.security),
    [
      "roles",
      "members",
      "database",
      "tables",
      "columns",
      "functions",
      "schema",
      "defaults",
      "permissions",
      "rolePermissions",
    ],
    "STOCK_MANAGED_SECURITY_COVERAGE",
  );
  equal(
    Object.keys(s.cluster),
    [
      "roles",
      "memberships",
      "tableOwners",
      "functions",
      "schemas",
      "extensions",
      "unsafe",
    ],
    "STOCK_MANAGED_CLUSTER_COVERAGE",
  );
  check(
    Object.values(s.security).every(Array.isArray) &&
      Object.values(s.cluster).every(Array.isArray),
    "STOCK_MANAGED_INVALID_ROWS",
  );
}

export function validateContract(c: ManagedContract) {
  check(
    c?.version === 1 &&
      c.applyEnabled === false &&
      c.postFingerprint === null &&
      c.checksum === stockChecksum,
    "STOCK_MANAGED_CONTRACT_REJECTED",
  );
  equal(
    c.target,
    {
      projectId: "icy-queen-44442204",
      branchId: "br-rough-darkness-ba6ow9zo",
      host: "ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech",
      database: "pusula_development",
      owner: "neondb_owner",
    },
    "STOCK_MANAGED_TARGET_REJECTED",
  );
  completeRows(c.pre);
  check(
    c.pre.identity.actor === "neondb_owner" &&
      c.pre.identity.sessionActor === "neondb_owner" &&
      c.pre.identity.version === 180006 &&
      c.pre.identity.database === c.target.database,
    "STOCK_MANAGED_IDENTITY_REJECTED",
  );
  check(
    Object.keys(c.pre.schema).length === 8 &&
      Object.keys(c.postSchema).length === 8 &&
      [...Object.values(c.pre.schema), ...Object.values(c.postSchema)].every(
        (v) => /^[a-f0-9]{64}$/.test(v),
      ),
    "STOCK_MANAGED_SCHEMA_PINS_REQUIRED",
  );
  check(
    c.permissions.length === 9 &&
      new Set(c.permissions.map((p) => p.id)).size === 9,
    "STOCK_MANAGED_PERMISSION_CONTRACT",
  );
}

// The target labels in a saved snapshot are not proof of current provider identity.
// This only checks the historical measurement; no connection can be opened here.
export function auditManagedPre(
  c: ManagedContract,
  s: ManagedSnapshot,
  files: { name: string; checksum: string }[],
) {
  validateContract(c);
  completeRows(s);
  check(
    files.length === 16 &&
      files[15].name === stockMigration &&
      files[15].checksum === stockChecksum,
    "STOCK_MANAGED_FILES_REJECTED",
  );
  check(
    validateStockHistory(s.history, files).length === 15,
    "STOCK_MANAGED_PRE_HISTORY",
  );
  // Exact old history (including failed 008 bytes), not a newly learned baseline.
  equal(s.history, c.pre.history, "STOCK_MANAGED_HISTORY_DRIFT");
  equal(s.identity, c.pre.identity, "STOCK_MANAGED_IDENTITY_REJECTED");
  equal(s.counts, { tables: 40, forced: 26 }, "STOCK_MANAGED_COUNTS_REJECTED");
  equal(s.schema, c.pre.schema, "STOCK_MANAGED_SCHEMA_DRIFT");
  equal(s.security, c.pre.security, "STOCK_MANAGED_ACL_DRIFT");
  equal(s.cluster, c.pre.cluster, "STOCK_MANAGED_CLUSTER_DRIFT");
  // A newly collected grantor set cannot enroll itself against historical null.
  if (c.pre.grantors !== null)
    equal(s.grantors, c.pre.grantors, "STOCK_MANAGED_GRANTOR_DRIFT");
  return {
    status: "AUDIT_ONLY" as const,
    applied: false,
    acceptance: "NEEDS_EVIDENCE" as const,
    missing: [...c.evidence.missing],
    postFingerprint: null,
  };
}

function addGrant(
  rows: Row[],
  key: string,
  name: string,
  owner: string,
  grantee: string,
  rights: string[],
) {
  for (const privilege_type of rights)
    rows.push({
      [key]: name,
      owner,
      grantee,
      privilege_type,
      is_grantable: false,
    });
}

// Expected delta is derived from reviewed SQL, never from the observed post state.
export function expectedManagedPost(
  pre: ManagedSnapshot,
  permissions: Row[],
  postSchema: Record<string, string>,
): ManagedSnapshot {
  completeRows(pre);
  const s = structuredClone(pre);
  s.counts = { tables: 47, forced: 33 };
  s.schema = { ...postSchema };
  s.history.push({
    migration_name: stockMigration,
    checksum: stockChecksum,
    finished: true,
    rolled_back: false,
  });
  s.security.roles.push({ ...role });
  s.cluster.roles.push({ ...role });
  for (const table of stockTables) {
    addGrant(
      s.security.tables,
      "relname",
      table,
      "<owner>",
      "<owner>",
      allTableRights,
    );
    addGrant(s.security.tables, "relname", table, "<owner>", "pusula_runtime", [
      "SELECT",
    ]);
    addGrant(s.security.tables, "relname", table, "<owner>", executor, [
      "SELECT",
      "INSERT",
      "UPDATE",
      "DELETE",
    ]);
    s.cluster.tableOwners.push({ relname: table, owner: "<owner>" });
  }
  for (const table of [
    "Tenant",
    "LegalEntity",
    "Activity",
    "Material",
    "MaterialVariant",
    "Supplier",
    "SupplierMaterial",
    "SupplierOfferVersion",
    "Permission",
    "Role",
    "RolePermission",
    "Membership",
    "RoleAssignment",
    "PermissionScope",
    "UserPermissionOverride",
  ])
    addGrant(s.security.tables, "relname", table, "<owner>", executor, [
      "SELECT",
    ]);
  for (const table of ["PurchaseOrder", "PurchaseOrderLine"])
    addGrant(s.security.tables, "relname", table, "<owner>", executor, [
      "SELECT",
      "UPDATE",
    ]);
  addGrant(s.security.tables, "relname", "AuditEvent", "<owner>", executor, [
    "SELECT",
    "INSERT",
  ]);
  addGrant(
    s.security.functions,
    "identity",
    "pusula_can(text,uuid,uuid,uuid,text)",
    "<owner>",
    executor,
    ["EXECUTE"],
  );
  for (const identity of [...definer, ...helpers]) {
    const owner = definer.includes(identity) ? executor : "<owner>";
    addGrant(s.security.functions, "identity", identity, owner, owner, [
      "EXECUTE",
    ]);
    if (identity === "v43b_net_received(uuid)")
      addGrant(s.security.functions, "identity", identity, owner, executor, [
        "EXECUTE",
      ]);
    if (definer.includes(identity) && identity !== "v43b_complete()")
      addGrant(
        s.security.functions,
        "identity",
        identity,
        owner,
        "pusula_runtime",
        ["EXECUTE"],
      );
    s.cluster.functions.push({
      identity,
      owner,
      prosecdef: definer.includes(identity),
      proconfig: ["search_path=pg_catalog, public, pg_temp"],
    });
  }
  s.security.schema.push({
    nspname: "public",
    grantee: executor,
    privilege_type: "USAGE",
    is_grantable: false,
  });
  s.security.permissions.push(...structuredClone(permissions));
  s.security.rolePermissions.push(
    ...permissions.map((p) => ({ roleId: "MASTER", permissionId: p.id })),
  );
  // Grantor-preserving expanded ACL delta (all unchanged entries retained).
  if (s.grantors !== null) {
    for (const category of ["tables", "functions"] as const) {
      const key = category === "tables" ? "relname" : "identity";
      const previous = new Set(pre.security[category].map((r) => hash(r)));
      for (const r of s.security[category])
        if (!previous.has(hash(r)))
          s.grantors.push({
            kind: category,
            identity: r[key],
            owner: r.owner,
            grantee: r.grantee,
            grantor: r.owner,
            privilege_type: r.privilege_type,
            is_grantable: r.is_grantable,
          });
    }
    s.grantors.push({
      kind: "schema",
      identity: "public",
      owner: "pg_database_owner",
      grantee: executor,
      grantor: "pg_database_owner",
      privilege_type: "USAGE",
      is_grantable: false,
    });
  }
  return s;
}

// Common local/cloud invariant engine. Passing invariants is NOT post enrollment.
// Local tests pass their own pre snapshot; only auditManagedPre accepts cloud pre.
export function verifyManagedDelta(
  pre: ManagedSnapshot,
  post: ManagedSnapshot,
  permissions: Row[],
  postSchema: Record<string, string>,
  files: { name: string; checksum: string }[],
) {
  completeRows(pre);
  completeRows(post);
  check(
    pre.counts.tables === 40 &&
      pre.counts.forced === 26 &&
      Object.keys(postSchema).length === 8,
    "STOCK_MANAGED_PRE_REQUIRED",
  );
  check(
    files.length === 16 &&
      files[15].name === stockMigration &&
      files[15].checksum === stockChecksum,
    "STOCK_MANAGED_FILES_REJECTED",
  );
  check(
    !pre.cluster.roles.some(
      (r) => r.rolname === executor || r.rolname === creator,
    ),
    "STOCK_MANAGED_PARTIAL_ROLE_REJECTED",
  );
  check(
    pre.identity.actor === pre.identity.sessionActor &&
      pre.identity.version === 180006,
    "STOCK_MANAGED_IDENTITY_REJECTED",
  );
  check(
    validateStockHistory(pre.history, files).length === 15 &&
      validateStockHistory(post.history, files).length === 16,
    "STOCK_MANAGED_HISTORY_REJECTED",
  );
  check(
    pre.grantors !== null && post.grantors !== null,
    "STOCK_MANAGED_GRANTOR_EVIDENCE_REQUIRED",
  );
  const expected = expectedManagedPost(pre, permissions, postSchema);
  for (const key of Object.keys(expected) as (keyof ManagedSnapshot)[])
    equal(post[key], expected[key], "STOCK_MANAGED_POST_DRIFT_" + key);
  return {
    status: "POST_INVARIANTS_ONLY" as const,
    applied: false,
    cloudAccepted: false,
  };
}

export function requireManagedPostAcceptance(): never {
  throw new Error("STOCK_MANAGED_POST_NOT_ENROLLED");
}

// No inference that a lost COMMIT response means rollback succeeded.
export function managedFailureState(
  phase: "before-apply" | "transaction" | "commit-sent" | "committed",
  rollbackConfirmed = false,
) {
  if (phase === "before-apply") return "NOT_STARTED";
  if (phase === "committed") return "POST_COMMIT_REVIEW_REQUIRED";
  if (phase === "commit-sent") return "COMMIT_OUTCOME_UNKNOWN";
  return rollbackConfirmed ? "ROLLED_BACK_CONFIRMED" : "ROLLBACK_UNCONFIRMED";
}

// Caller owns a dedicated connection and READ ONLY transaction; this function
// never begins/commits a transaction or runs SQL other than SELECT.
export async function collectManagedSnapshot(
  db: Client,
): Promise<ManagedSnapshot> {
  return collectSnapshot(db, true);
}

// SELECT-only pre-COMMIT inspection inside the rehearsal's own write transaction.
// This does not change the public read-only collector's requirements.
export async function collectManagedPostSnapshot(
  db: Client,
): Promise<ManagedSnapshot> {
  return collectSnapshot(db, false);
}

async function collectSnapshot(
  db: Client,
  readonly: boolean,
): Promise<ManagedSnapshot> {
  const meta = (
    await db.query(
      "SELECT current_user actor,session_user session_actor,current_database() db,current_setting('server_version_num')::int version,current_setting('transaction_read_only') readonly,current_setting('transaction_isolation') isolation",
    )
  ).rows[0];
  check(
    meta.readonly === (readonly ? "on" : "off") &&
      meta.isolation === "repeatable read",
    "STOCK_MANAGED_READONLY_REQUIRED",
  );
  const c = await catalog(db);
  const security = (await stockSecurity(db)) as Rows;
  const rows = async (sql: string) => (await db.query(sql)).rows as Row[];
  const cluster = {
    roles: await rows(
      "SELECT rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication,rolinherit,rolconfig FROM pg_roles ORDER BY 1",
    ),
    memberships: await rows(
      "SELECT pg_get_userbyid(roleid) parent,pg_get_userbyid(member) member,pg_get_userbyid(grantor) grantor,admin_option,inherit_option,set_option FROM pg_auth_members ORDER BY 1,2,3",
    ),
    tableOwners: await rows(
      "SELECT relname,pg_get_userbyid(relowner) owner FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY 1",
    ),
    functions: await rows(
      "SELECT oid::regprocedure::text identity,pg_get_userbyid(proowner) owner,prosecdef,proconfig FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY 1",
    ),
    schemas: await rows(
      "SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' ORDER BY 1",
    ),
    extensions: await rows("SELECT extname FROM pg_extension ORDER BY 1"),
    unsafe: await rows(
      "SELECT EXISTS(SELECT 1 FROM pg_event_trigger) OR EXISTS(SELECT 1 FROM pg_largeobject_metadata) OR EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind NOT IN ('r','i','I','t')) OR EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype='d') OR EXISTS(SELECT 1 FROM pg_operator WHERE oprnamespace='public'::regnamespace) unsafe",
    ),
  };
  const grantors = await rows(`WITH objects AS (
    SELECT 'tables' kind,c.relname identity,c.relowner owner,c.relacl acl,'r'::"char" aclkind FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
    UNION ALL SELECT 'functions',p.oid::regprocedure::text,p.proowner,p.proacl,'f'::"char" FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
    UNION ALL SELECT 'schema',nspname,nspowner,nspacl,'n'::"char" FROM pg_namespace WHERE nspname='public'
    UNION ALL SELECT 'database',datname,datdba,datacl,'d'::"char" FROM pg_database WHERE datname=current_database()
  ) SELECT kind,CASE WHEN kind='database' THEN '<database>' ELSE identity END identity,pg_get_userbyid(owner) owner,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END grantee,pg_get_userbyid(a.grantor) grantor,a.privilege_type,a.is_grantable FROM objects CROSS JOIN LATERAL aclexplode(coalesce(acl,acldefault(aclkind,owner))) a
  UNION ALL SELECT 'columns',c.relname||'.'||x.attname,pg_get_userbyid(c.relowner),CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable FROM pg_attribute x JOIN pg_class c ON c.oid=x.attrelid CROSS JOIN LATERAL aclexplode(x.attacl) a WHERE c.relnamespace='public'::regnamespace
  UNION ALL SELECT 'defaults',d.defaclnamespace::regnamespace::text||':'||d.defaclobjtype::text,pg_get_userbyid(d.defaclrole),CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a`);
  // Exact role-name fields only; never normalize definitions or arbitrary text.
  for (const collection of [...Object.values(cluster), grantors])
    for (const r of collection)
      for (const k of [
        "rolname",
        "owner",
        "parent",
        "member",
        "grantor",
        "grantee",
      ])
        if (r[k] === meta.actor) r[k] = "<owner>";
  for (const r of security.members)
    if (r.member === meta.actor) r.member = "<owner>";
  return {
    identity: {
      actor: meta.actor,
      sessionActor: meta.session_actor,
      database: meta.db,
      version: meta.version,
    },
    counts: {
      tables: c.tables.length,
      forced: c.tables.filter((t) => t.relrowsecurity && t.relforcerowsecurity)
        .length,
    },
    schema: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, hash(v)])),
    history: (await rows(
      "SELECT migration_name,checksum,finished_at IS NOT NULL finished,rolled_back_at IS NOT NULL rolled_back FROM public._prisma_migrations ORDER BY migration_name",
    )) as unknown as StockHistoryRow[],
    security,
    cluster,
    grantors,
  };
}
