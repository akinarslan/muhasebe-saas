// Local Git/filesystem verification only. No environment loading or DB client.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { stockFiles, validateStockHistory } from "../stock/migrate";
import { migrationFiles, validateHistory } from "./migration-safety";
import { reviewedRollback008 } from "./migration-checksum";
import { pathToFileURL } from "node:url";

export async function verifyChecksumArtifact() {
  const original = process.cwd();
  const files = await migrationFiles();
  await stockFiles();
  const root = resolve(".data/v43b9a", `git-artifact-${randomUUID()}`);
  await mkdir(root, { recursive: true });
  for (const f of files) {
    const relative = `prisma/migrations/${f.name}/migration.sql`;
    const bytes =
      f === files[15]
        ? await readFile(relative)
        : execFileSync("git", ["show", `HEAD:${relative}`], {
            windowsHide: true,
          });
    await mkdir(join(root, "prisma/migrations", f.name), { recursive: true });
    await writeFile(join(root, relative), bytes);
  }
  for (const relative of [
    "scripts/db/migration-baseline.json",
    "scripts/stock/migration-baseline.json",
  ]) {
    await mkdir(resolve(root, relative, ".."), { recursive: true });
    await writeFile(join(root, relative), await readFile(relative));
  }
  let checks = 0;
  const pass = (name: string) => {
    checks++;
    console.log(JSON.stringify({ checksumCheck: name, status: "PASS" }));
  };
  try {
    process.chdir(root);
    const manifest = await stockFiles();
    pass("working-tree-and-git-lf-artifact");
    const baseline = JSON.parse(
      await readFile("scripts/db/migration-baseline.json", "utf8"),
    );
    const history = manifest.files.slice(0, 15).map((f) => ({
      migration_name: f.name,
      checksum: baseline.migrations[f.name],
      finished: true,
      rolled_back: false,
    }));
    const rollback = {
      migration_name: "202610160008_company_metadata",
      checksum: reviewedRollback008,
      finished: false,
      rolled_back: true,
    };
    const rows = [...history, rollback];
    const saved = JSON.stringify(rows);
    assert.equal(validateStockHistory(rows, manifest.files).length, 15);
    assert.equal(
      validateHistory(rows, manifest.files.slice(0, 15)),
      "ALREADY_APPLIED",
    );
    assert.equal(JSON.stringify(rows), saved);
    pass("historical-success-checksums-and-real-resolved-008-preserved");
    assert.throws(
      () =>
        validateStockHistory(
          [...history, { ...rollback, rolled_back: false }],
          manifest.files,
        ),
      /STOCK_MIGRATION_UNRESOLVED/,
    );
    assert.throws(
      () => validateStockHistory([...history, history[0]], manifest.files),
      /STOCK_HISTORY_REJECTED/,
    );
    assert.throws(
      () => validateStockHistory(history.slice(1), manifest.files),
      /STOCK_HISTORY_REJECTED/,
    );
    assert.throws(
      () =>
        validateStockHistory(
          history.map((r, i) =>
            i === 0 ? { ...r, checksum: "0".repeat(64) } : r,
          ),
          manifest.files,
        ),
      /STOCK_HISTORY_CHECKSUM_REJECTED/,
    );
    pass("unresolved-duplicate-missing-unknown-history-rejected");
    const target = resolve(
      "prisma/migrations/202610160008_company_metadata/migration.sql",
    );
    const bytes = await readFile(target);
    for (const [name, bad] of [
      ["one-character", Buffer.concat([Buffer.from("!"), bytes.subarray(1)])],
      [
        "sql-command",
        Buffer.from(
          bytes.toString("utf8").replace(/\b(?:CREATE|ALTER)\b/, "DROP"),
        ),
      ],
      ["unknown-checksum", Buffer.concat([bytes, Buffer.from(" ")])],
    ] as const) {
      await writeFile(target, bad);
      try {
        await assert.rejects(
          () => stockFiles(),
          /STOCK_LEGACY_CHECKSUM_REJECTED/,
        );
      } finally {
        await writeFile(target, bytes);
      }
      pass(name);
    }
    // Only paths in our new UUID artifact are renamed, then restored.
    assert.ok(target.startsWith(root + "/") || target.startsWith(root + "\\"));
    await rename(target, target + ".missing");
    try {
      await assert.rejects(() => stockFiles());
    } finally {
      await rename(target + ".missing", target);
    }
    pass("missing-file");
    const directory = resolve(target, ".."),
      wrong = directory + "-wrong-name";
    await rename(directory, wrong);
    try {
      await assert.rejects(
        () => stockFiles(),
        /STOCK_LEGACY_CHECKSUM_REJECTED/,
      );
    } finally {
      await rename(wrong, directory);
    }
    pass("wrong-migration-name");
    await stockFiles();
    pass("artifact-restored-and-valid");
    await writeFile(
      join(root, "checksum-verification.json"),
      JSON.stringify(
        { checks, status: "PASS", cloudConnected: false },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ artifact: root, checks, status: "PASS" }));
    return root;
  } finally {
    process.chdir(original);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  assert.ok(process.argv.includes("--verify-local-artifact"));
  verifyChecksumArtifact().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
