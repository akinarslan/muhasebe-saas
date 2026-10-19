// @vitest-environment node
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  validateHistory,
  migrationTarget,
  migrationName,
  canonical,
} from "../scripts/db/migration-safety";
import { developmentTarget } from "../src/server/db/target";
const files = [
  { name: "baseline", checksum: "a" },
  { name: migrationName, checksum: "b" },
];
const applied = {
  migration_name: "baseline",
  checksum: "a",
  finished: true,
  rolled_back: false,
};
describe("migration history safety", () => {
  it("preserves resolved rollback while matching the successful application", () =>
    expect(
      validateHistory(
        [
          { ...applied, finished: false, rolled_back: true, checksum: "old" },
          applied,
        ],
        files,
      ),
    ).toBe("PENDING"));
  it("recognizes completed migration without replay", () =>
    expect(
      validateHistory(
        [applied, { ...applied, migration_name: migrationName, checksum: "b" }],
        files,
      ),
    ).toBe("ALREADY_APPLIED"));
  it("blocks unresolved partial failure", () =>
    expect(() =>
      validateHistory(
        [
          applied,
          { ...applied, migration_name: migrationName, finished: false },
        ],
        files,
      ),
    ).toThrow("MIGRATION_UNRESOLVED"));
  it("blocks checksum drift", () =>
    expect(() =>
      validateHistory([{ ...applied, checksum: "wrong" }], files),
    ).toThrow("MIGRATION_CHECKSUM_REJECTED"));
  it("blocks unknown migration", () =>
    expect(() =>
      validateHistory([{ ...applied, migration_name: "unknown" }], files),
    ).toThrow("MIGRATION_UNKNOWN"));
  it("blocks duplicate successful history", () =>
    expect(() => validateHistory([applied, applied], files)).toThrow(
      "MIGRATION_DUPLICATE",
    ));
  it("blocks multiple pending migrations", () =>
    expect(() => validateHistory([], files)).toThrow(
      "PENDING_MIGRATION_REJECTED",
    ));
  it("blocks unexpected new pending SQL", () =>
    expect(() =>
      validateHistory([applied], [...files, { name: "future", checksum: "c" }]),
    ).toThrow("PENDING_MIGRATION_REJECTED"));
  it("metadata order does not create false drift", () =>
    expect(canonical([{ b: 2, a: 1 }, 3])).toBe(
      canonical([3, { a: 1, b: 2 }]),
    ));
});
describe("migration target boundaries", () => {
  afterEach(() => vi.unstubAllEnvs());
  const url = () =>
    `postgresql://neondb_owner:imaginary@${developmentTarget.host}/${developmentTarget.database}?sslmode=verify-full`;
  it("accepts only approved direct development owner", () =>
    expect(migrationTarget(url(), false).hostname).toBe(
      developmentTarget.host,
    ));
  for (const [name, change] of [
    [
      "runtime role",
      (u: string) => u.replace("neondb_owner", "pusula_runtime"),
    ],
    [
      "test DB via development mode",
      (u: string) => u.replace("/pusula_development", "/pusula_sprint_b_test"),
    ],
    [
      "production DB",
      (u: string) => u.replace("/pusula_development", "/production"),
    ],
    [
      "wrong branch host",
      (u: string) => u.replace("ep-blue-breeze", "ep-another"),
    ],
    ["pooler", (u: string) => u.replace(".c-8.", "-pooler.c-8.")],
    ["TLS disabled", (u: string) => u.replace("verify-full", "disable")],
    ["fragment", (u: string) => u + "#ignored"],
    ["unreviewed URL options", (u: string) => u + "&options=anything"],
  ] as const)
    it(`rejects ${name}`, () =>
      expect(() => migrationTarget(change(url()), false)).toThrow());
  it("rejects NODE_ENV production before connection", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => migrationTarget(url(), false)).toThrow("PRODUCTION_FORBIDDEN");
  });
  it("rejects real Neon test DB even if --test requested", () => {
    vi.stubEnv("PUSULA_LOCAL_FIXTURE", "");
    expect(() =>
      migrationTarget(
        url().replace("/pusula_development", "/pusula_sprint_b_test"),
        true,
      ),
    ).toThrow("REMOTE_TEST_NOT_APPROVED");
  });
});
