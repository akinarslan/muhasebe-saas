// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { load } from "js-yaml";
import ts from "typescript";
import { closerTarget } from "../scripts/backup/off-host-closer-package";
import { validateCloserDsn, validateCloserExecution, validateCloserScope } from "../scripts/backup/off-host-closer-job";

type Step = { name?: string; uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, string> };
type Workflow = { on: Record<string, unknown>; permissions: Record<string, string>; concurrency: { "cancel-in-progress": boolean }; jobs: { closer: { if: string; "runs-on": string; "timeout-minutes": number; steps: Step[] } } };
const workflow = readFileSync(".github/workflows/pusula-close-only.yml", "utf8");
const parsed = load(workflow) as Workflow;
const workflowHash = createHash("sha256").update(workflow).digest("hex");
const commit = "a".repeat(40);
const approved = () => ({ operation: "30341267-2360-476f-a7f9-48df8d1001ca", approvedCommit: commit, workflowSha256: workflowHash, catalogSha256: "b".repeat(64), deadline: new Date(Date.now() + 60000).toISOString(), project: closerTarget.project, branch: closerTarget.branch, host: closerTarget.host, database: closerTarget.database, actor: "pusula_closer", roleOid: 98304, userApprovedCloseOnly: true });
const execution = { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_RUN_ATTEMPT: "1", GITHUB_REPOSITORY: "akinarslan/muhasebe-saas", GITHUB_ACTOR: "akinarslan", GITHUB_REF: "refs/heads/main", RUNNER_ENVIRONMENT: "github-hosted", RUNNER_OS: "Linux" };
const safeEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, NODE_ENV: "test" as const };
const dsn = `postgresql://pusula_closer:synthetic-test-only@${closerTarget.host}:5432/pusula_development`;

describe("isolated main closer delivery boundary", () => {
  it("keeps the real workflow and reference byte-identical", () => {
    expect(readFileSync("docs/operations/off-host-closer/closer-workflow.yml.example", "utf8")).toBe(workflow);
  });
  it("permits only first-attempt main manual dispatch on hosted Linux", () => {
    expect(Object.keys(parsed.on)).toEqual(["workflow_dispatch"]);
    expect(parsed.permissions).toEqual({ contents: "read" });
    expect(parsed.jobs.closer["runs-on"]).toBe("ubuntu-24.04");
    expect(parsed.concurrency["cancel-in-progress"]).toBe(false);
    for (const guard of ["github.event_name == 'workflow_dispatch'", "github.ref == 'refs/heads/main'", "github.run_attempt == 1", "github.repository == 'akinarslan/muhasebe-saas'", "github.actor == 'akinarslan'"]) expect(parsed.jobs.closer.if).toContain(guard);
    expect(() => validateCloserExecution(execution, "--approved-close-only")).not.toThrow();
  });
  it.each([{ GITHUB_EVENT_NAME: "push" }, { GITHUB_EVENT_NAME: "pull_request" }, { GITHUB_EVENT_NAME: "schedule" }, { GITHUB_REPOSITORY: "fork/muhasebe-saas" }, { GITHUB_ACTOR: "someone-else" }, { GITHUB_REF: "refs/heads/feature" }, { GITHUB_RUN_ATTEMPT: "2" }, { RUNNER_ENVIRONMENT: "self-hosted" }, { RUNNER_OS: "Windows" }])("rejects execution context %j", delta => {
    expect(() => validateCloserExecution({ ...execution, ...delta }, "--approved-close-only")).toThrow("CLOSER_EXECUTION_BLOCKED");
  });
  it("pins actions and gates secret access after approval validation", () => {
    const steps = parsed.jobs.closer.steps;
    for (const step of steps.filter(s => s.uses)) expect(step.uses).toMatch(/^[\w/-]+@[a-f0-9]{40}$/);
    expect(steps[0].with?.["persist-credentials"]).toBe(false);
    const bootstrap = steps.findIndex(s => s.name === "Bootstrap immutable pins without repository code");
    const validate = steps.findIndex(s => s.name === "Check approval pins before secret access");
    const secret = steps.findIndex(s => s.env?.PUSULA_CLOSE_ONLY_DSN);
    expect(bootstrap).toBeGreaterThan(-1); expect(validate).toBeGreaterThan(bootstrap); expect(secret).toBeGreaterThan(validate);
    expect([...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(m => m[1])).toEqual(["PUSULA_CLOSE_ONLY_DSN"]);
    expect(steps.find(s => s.run?.includes("npm ci"))?.run).toContain("--ignore-scripts");
  });
  it("executes the actual bootstrap against commit, workflow and operation drift", () => {
    const command = parsed.jobs.closer.steps.find(s => s.name === "Bootstrap immutable pins without repository code")!.run!;
    const source = command.match(/node --input-type=module -e '([\s\S]+)'/)![1];
    for (const [scope, expected] of [[approved(), 0], [{ ...approved(), operation: "" }, 1], [{ ...approved(), approvedCommit: "c".repeat(40) }, 1], [{ ...approved(), workflowSha256: "d".repeat(64) }, 1], [{ ...approved(), userApprovedCloseOnly: "true" }, 1]] as const) {
      const child = spawnSync(process.execPath, ["--input-type=module", "-e", source], { cwd: process.cwd(), env: { ...safeEnv, GITHUB_SHA: commit, PUSULA_CLOSE_SCOPE: JSON.stringify(scope) }, encoding: "utf8", timeout: 10000, windowsHide: true });
      expect(child.status).toBe(expected);
    }
  });
  it.each([null, {}, { ...approved(), operation: "-".repeat(36) }, { ...approved(), userApprovedCloseOnly: "true" }, { ...approved(), catalogSha256: null }, { ...approved(), catalogSha256: "" }, { ...approved(), deadline: null }, { ...approved(), actor: "neondb_owner" }])("fails closed on malformed or missing approval %j", scope => {
    expect(() => validateCloserScope(scope, commit, workflow)).toThrow("CLOSER_SCOPE_BLOCKED");
  });
  it("validates only the narrow DSN without making a connection", () => {
    expect(validateCloserDsn(dsn).username).toBe("pusula_closer");
  });
  it.each([undefined, "", "not-a-url", dsn.replace("pusula_closer", "neondb_owner"), dsn.replace("postgresql:", "https:"), dsn.replace(closerTarget.host, "localhost"), dsn.replace(":5432", ":5433"), dsn.replace("/pusula_development", "/postgres"), dsn.replace(":synthetic-test-only", ""), dsn + "?sslmode=disable", dsn + "#fragment"]) ("rejects absent, owner or out-of-scope credential %j", input => {
    expect(() => validateCloserDsn(input)).toThrow("CLOSER_DSN_SCOPE");
  });
  it("rejects the CLI without authorization, runtime pin or secret before any network work", () => {
    for (const scope of [null, { ...approved(), catalogSha256: null }, approved()]) {
      const child = spawnSync(process.execPath, ["--import", "tsx", "scripts/backup/off-host-closer-job.ts", "--approved-close-only"], { env: { ...safeEnv, ...execution, GITHUB_SHA: commit, PUSULA_CLOSE_SCOPE: JSON.stringify(scope) }, encoding: "utf8", timeout: 10000, windowsHide: true });
      expect(child.status).toBe(1); expect(child.stderr).toContain("GITHUB_CLOSER_BLOCKED"); expect(child.stdout).not.toContain('"type":"ARM"');
    }
  });
  it("closes runtime imports without migration, stock, fixture or owner collectors", () => {
    const visited = new Set<string>();
    const walk = (file: string) => {
      if (visited.has(file)) return; visited.add(file);
      expect(existsSync(file)).toBe(true);
      const source = readFileSync(file, "utf8");
      for (const imported of ts.preProcessFile(source).importedFiles) {
        if (!imported.fileName.startsWith(".")) continue;
        const dependency = resolve(dirname(file), imported.fileName + ".ts");
        expect(dependency).not.toMatch(/(?:migration|stock|fixture|role-review)/);
        walk(dependency);
      }
    };
    walk(resolve("scripts/backup/off-host-closer-job.ts"));
    expect(visited.size).toBe(2);
  });
  it("keeps package and lockfile direct dependencies identical and exact", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
    expect(lock.packages[""].dependencies).toEqual(pkg.dependencies);
    expect(lock.packages[""].devDependencies).toEqual(pkg.devDependencies);
    for (const name of ["pg", "tsx", "@types/pg", "js-yaml", "@types/js-yaml"]) {
      const version = pkg.dependencies[name] ?? pkg.devDependencies[name];
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(lock.packages["node_modules/" + name].version).toBe(version);
      expect(lock.packages["node_modules/" + name].integrity).toMatch(/^sha512-/);
    }
  });
});
