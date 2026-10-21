# PUSULA V4.3b.6 — RECOVERY_CREATE_READY

21 October 2026, 18:31 Europe/Istanbul. This is a read-only precheck, not authorization to create a branch or apply migration 016. Readiness is based on the observations below and the user's Console capacity evidence; it is not a guarantee of zero future writers, exact remaining quota or zero cost.

## Identity and provider inventory

- Git branch: `feat/pusula-v030-neon-cloud`; HEAD `f56caed5eadb64e76304777f83477f1677c19d19`. Existing V4.3b.5 document changes were preserved. No Git mutation occurred.
- Project: `icy-queen-44442204` / `pusula-development`, AWS eu-central-1, `free_v3`, branch limit 10, history retention 21600 seconds.
- Source: `br-rough-darkness-ba6ow9zo` / `development`, ready, logical size 55,148,544 bytes (about 52.6 MiB). Endpoint `ep-blue-breeze-bavbjb7l`, hostname `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech`.
- Final provider GET at 2026-10-21T15:31:45.071Z: 4 ready branches, 4 enabled read/write endpoints, 1 snapshot. Operations pagination followed `pagination.cursor` to an empty page: 111 retained operations, no pending or failed operations. This covers the history returned by the provider, not an unlimited historical archive.
- Development endpoint was idle before the audit and active afterward; opening the read-only connection can wake compute. Connection was closed. Endpoint state is not proof of a writer. Endpoint settings were not changed.

Protected existing resources remained present:

| Resource | ID |
| --- | --- |
| production | `br-autumn-union-baaldt81` |
| preview / pusula-v42-restore-verification | `br-patient-block-bald8u59` |
| previous recovery / pusula-v43a-pre-migration-015 | `br-broad-river-bavv5pey` |
| pusula-v42-before-supplier-migration snapshot | `snap-frosty-sky-bav0qeo6` |

No mutations were sent to these resources. Snapshot existence and metadata were checked; restorability was not tested. The old pre-015 recovery is not a substitute for the new pre-016 reference.

## Writer checks and database verification

Windows read-only process command-line association, scheduled-task action association and service executable-path association searches for `muhasebe-saas` / `pusula` returned no project matches. No command lines or task arguments were persisted. Static searches of package.json, src and scripts found no scheduler/worker/cron/pg_cron/agenda/bullmq matches. These limited checks do not enumerate other computers, externally hosted schedulers, processes without identifiable project paths, or future reconnecting clients.

The user reports the development app is closed and nobody else uses it. This is user evidence, not proof that all background writers are absent.

Only the approved `pusula_development` database was connected. TLS CA chain and hostname validation passed, using explicit verified TLS configuration. Startup default read-only was on; the audit ran in REPEATABLE READ READ ONLY with lock timeout 3s, statement timeout 10s and transaction timeout 30s. It ended with ROLLBACK and a closed connection.

- PostgreSQL `18.6 (fd34222)`; 40 public tables; 26 with RLS and FORCE RLS.
- Eight schema category hashes match the applied-015 baseline.
- 15 successful migrations, all checksums match. One known resolved rollback of migration 008; zero unresolved entries.
- Migration 015 SHA-256: `181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a`.
- Migration 016 has no history entry: pending. `pusula_stock_executor` absent.
- Four existing privilege baseline hashes match. The legacy table ACL baseline excludes Supplier, SupplierMaterial, SupplierOfferVersion, PurchaseOrder and PurchaseOrderLine; this does not validate migration 016 managed-provider compatibility.
- `PO-2026-9893`: exactly one, APPROVED, one line, USD 30.40; ordered 2 linear metres / 3.04 square metres, conversion factor 1.52 and conversion equality verified.
- Other PostgreSQL sessions in this database: 0 at observation. Prepared transactions: 0; subscriptions: 0; database replication slots: 0. Only plpgsql extension is installed, so no pg_cron extension in this database. No SQL query text or application Auth/MFA/session rows were read.

## Safe comparison reference

Latest consistent reference: `2026-10-21T15:31:40.043Z`, MVCC snapshot `39937:39937:`, observed cluster WAL LSN `0/37E98E8`.

Local ignored evidence: `.data/recovery-v43b6/catalog-console-followup.json` and `.data/recovery-v43b6/provider.json`. The database reference contains eight schema hashes, migration history SHA-256 `decc11179da6577bc7de87bdba9fff38981d61cc2d7c6aa13501857ebb6c8302`, the order summary, and deterministic row counts / SHA-256 digests of seven business tables. Row counts: Supplier 1, SupplierMaterial 1, SupplierOfferVersion 0, PurchaseOrder 1, PurchaseOrderLine 1, Material 1, MaterialVariant 1. These business digests were identical in both observations.

Hashes were calculated on the server; raw business rows were not persisted. This is a scoped comparison reference, not a backup or full-data checksum of every table. Auth/MFA/session contents and the contents of other databases are excluded. The MVCC snapshot is descriptive and expired when the transaction ended. Observed cluster WAL LSN is not a provider-confirmed branch capture LSN.

## Proposed creation plan — not executed

- Proposed unique name: `pusula-v43b6-pre-migration-016-20261021`; not present in current inventory. Recheck uniqueness immediately before an authorized create.
- Explicit parent: `br-rough-darkness-ba6ow9zo` in project `icy-queen-44442204`; never rely on the default parent (production).
- Use current-data full branch cloning, not schema-only. Normal Neon branching covers the parent branch's databases, roles, schema and data. Catalog metadata shows non-template databases `neondb`, `postgres`, `pusula_development`, `pusula_sprint_b_test`. Their contents were not inspected. Auth/MFA/session data would be included by a full clone even though this audit did not read it. The plan is not a single-database export.
- Prefer no new compute endpoint at initial creation. A later explicitly authorized verification endpoint should be capped at 0.25 CU with deliberate auto-suspend settings; do not inherit indefinite running accidentally. Existing endpoints report suspend_timeout_seconds 0; do not assume they will automatically stop.
- RPO target: capture the latest committed source state immediately before any future migration. Keep the app/workers stopped, repeat writer and scoped-reference checks immediately before authorized creation, then record returned parent LSN/timestamp and compare the new branch against the source reference. Do not start migration unless comparison passes. Later source writes are outside the recovery capture; RPO zero is not proven by this precheck. If writers or business drift appear, stop and refresh the reference/capture plan.
- Preserve all existing branches, endpoints and snapshots. No source reset, restore, rename, deletion or finalization is planned.

Neon documents branch cloning as copy-on-write, with shared base pages and storage growth as data diverges or retained history ages. See [Neon branch management](https://github.com/neondatabase/website/blob/main/content/docs/manage/branches.md) and [Neon object hierarchy](https://neon.com/blog/neon-object-hierarchy).

## Capacity and residual risk

The user's current Console/screenshot evidence is Free plan 1 GB storage / 100 CU-hours / 10 branches, usage 0.14 GB / 2.16 CU-hours / 4 branches. API independently confirms free_v3 and 4 of 10 branch slots. One proposed branch would bring the count to 5. User evidence supports proceeding with the bounded plan; these usage figures are not fresh API measurements or verified remaining quotas. The earlier consumption API returned 403; no exact remaining storage or compute allowance is claimed here. Project synthetic-storage counters of zero are not used as quota proof.

Copy-on-write means source logical size is not the immediate incremental billed storage. Incremental retention, divergence, WAL and metadata usage are not measured. A 0.25 CU endpoint running ten minutes would nominally consume 0.0417 CU-hours; this is arithmetic, not an actual usage or price quote. No endpoint was created, and zero-cost operation is not guaranteed. Check current Console usage again before a later authorized creation if this evidence has become stale. No new snapshot is planned, so unknown snapshot creation quota is not relied upon.

Readiness is limited to the planned recovery branch precheck; external/future writers remain a residual risk. New creation still requires explicit authorization. No provider POST/PATCH/DELETE, SQL data/role/ACL changes, migration, restore/finalize, R2, Auth/MFA/session content access, .env.local modification, tests/build, or Git commit/push/merge occurred.
