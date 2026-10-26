# PUSULA GitHub close-only runner

This main port delivers only the existing off-host closer runtime. Neon installation
`30341267-2360-476f-a7f9-48df8d1001ca` is already independently confirmed. Its general
catalog fingerprint is `714c30cc4836f05a277da77f133c2a222ab21742f210a3ef3ac6c8fac54cb570`.
Do not reinstall or alter the existing roles, schema, functions or backup grants.

## Delivery and independent approvals

Code delivery, closer credential activation, and manual workflow dispatch require
three separate approvals. File presence, a boolean in scope JSON, a queued job or
a dispatch acknowledgment does not authorize database activity or prove ARM.

The workflow must exist on default branch `main` before manual dispatch. The
approved commit must equal the actual main dispatch `GITHUB_SHA`; both workflow
copies must be byte-identical and match the approved SHA-256. Any subsequent
commit or workflow change invalidates those pins. Only first-attempt dispatch by
`akinarslan` in `akinarslan/muhasebe-saas` on GitHub-hosted Linux is accepted.

No real credential or executable dispatch scope is included. The only future
secret is `PUSULA_CLOSE_ONLY_DSN`, for user `pusula_closer`, the fixed direct Neon
endpoint, explicit port5432 and database `pusula_development`. Owner credentials,
Neon API keys and backup AES keys must never be stored in GitHub for this runner.
The DSN must use postgres/postgresql without query parameters or fragments.

The approval scope fields are operation, deadline, approvedCommit, workflowSha256,
catalogSha256, project, branch, host, database, actor, roleOid, userApprovedCloseOnly.
The actor is `pusula_closer`, roleOid is98304, and deadline must be30–600 seconds
in the future at runner validation. Exact human approval must be recorded outside
the JSON; a caller-supplied true value is not independent authorization.

`catalogSha256` is the existing runtime `closeCatalog()` measurement. It is NOT
the general installation fingerprint above. Obtain and independently bind the
runtime pin to the accepted installation and approved delivery before requesting
dispatch approval. Missing pin, deadline, approval or credential must stay BLOCKED.
This code delivery does not grant permission to measure or mutate Neon.

## ARM and final verification

1. Verify the real GitHub run id/URL, repository, actor, event, main commit,
   workflow hash and first attempt against the separate dispatch approval.
2. Runner validates PostgreSQL18.6, TLS, narrow actor/database, runtime catalog,
   and backup NOLOGIN/limit0; it takes the operation advisory lock and emits ARM
   metadata with PID and backend_start.
3. Before relying on ARM, the separate owner READ ONLY verifier must observe the
   same source backend PID, backend_start, actor, database and held advisory lock,
   and bind them to that real run. A runner log alone is insufficient.
4. At the deadline, the runner calls `disable_backup_login()` once and waits for
   its ACK. A distinct READ ONLY connection proves NOLOGIN/limit0. Only then may
   `terminate_backup_sessions()` run, followed by independent session0 proof.
5. An independent owner READ ONLY final verification must prove PASSWORD NULL,
   exact42 backup grants, source40 tables/26 FORCE RLS/history and cross-DB
   integrity, and bind the final receipt/run/catalog identities. This privileged
   verifier remains in the existing operator workspace, never in GitHub secrets.

No backup LOGIN or credential activation is provided by this runtime. Session
termination targets OID98304 across the branch; unexpected backup sessions in
other databases block activation and require separate scope resolution.
SIGINT/SIGTERM may attempt closure, but produce BLOCKED even if closure completes.
Lost ACK, cancellation, network failure, failed proof or missing receipt cannot
be reported as successful closure and must not trigger automatic retry.
`CLOSE_METADATA_PASS` is not acceptance of backup/export or the full operation.

## Narrow dependency boundary

The deployed runtime imports only `pg`, Node built-ins and the existing pure
`off-host-closer-package.ts`. That package retains the original fixed target,
provider attestation helper and inert SQL builder used by existing unit tests;
it has no connection or execution entry point. No SQL artifact is generated or
applied by delivery or tests. Historical owner collectors/reviewers, local PG
fixtures, `risk-managed-lease`, migration/stock modules and their documentation
are intentionally not deployed. Their independent checks remain operator duties;
none were removed from the original feature workspace.

Validation from a clean main worktree:

```text
npm ci --ignore-scripts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js .
node --import tsx node_modules/vitest/vitest.mjs run
git diff --check
```

Tests use synthetic DSNs and mock transports only. Negative CLI tests receive no
credentials and must stop before connecting. No live ARM or Neon query is a
part of code-delivery validation.
