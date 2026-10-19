import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolve, join } from "node:path";
const state = vi.hoisted(() => ({
  marker: {} as Record<string, unknown>,
  symlink: false,
}));
vi.mock("node:fs", () => ({
  readFileSync: () => JSON.stringify(state.marker),
  realpathSync: (p: string) => p,
  lstatSync: () => ({ isSymbolicLink: () => state.symlink }),
}));
import {
  assertDevelopmentTarget,
  developmentTarget,
} from "../src/server/db/target";

describe("local fixture target cannot become a remote or production bypass", () => {
  const id = "a20e1157-b733-47ea-b7bf-d9369e2ce1bb";
  const good =
    "postgresql://pusula_test_runtime:temporary@127.0.0.1:55432/pusula_sprint_b_test?sslmode=disable";
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PUSULA_LOCAL_FIXTURE", id);
    state.symlink = false;
    state.marker = {
      id,
      host: "127.0.0.1",
      port: 55432,
      database: "pusula_sprint_b_test",
      dataDirectory: join(resolve(".data/fixtures", `v42-${id}`), "data"),
    };
  });
  afterEach(() => vi.unstubAllEnvs());
  it("allows only a marked, loopback, synthetic target with restricted role", () =>
    expect(assertDevelopmentTarget(good, true).hostname).toBe("127.0.0.1"));
  it("requires explicit direct mode for local migration admin", () => {
    const admin = good.replace("pusula_test_runtime", "fixture_admin");
    expect(() => assertDevelopmentTarget(admin, true)).toThrow();
    expect(assertDevelopmentTarget(admin, true, true).username).toBe(
      "fixture_admin",
    );
  });
  it("rejects production even with a valid fixture marker", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => assertDevelopmentTarget(good, true)).toThrow();
  });
  it("rejects non-test mode and missing opt-in", () => {
    expect(() => assertDevelopmentTarget(good, false)).toThrow();
    vi.stubEnv("PUSULA_LOCAL_FIXTURE", "");
    expect(() => assertDevelopmentTarget(good, true)).toThrow();
  });
  it.each([
    ["127.0.0.1", "localhost"],
    ["127.0.0.1", "remote.invalid"],
    ["55432", "5432"],
    ["pusula_sprint_b_test", "pusula_development"],
    ["pusula_test_runtime", "pusula_runtime"],
    ["sslmode=disable", "sslmode=require"],
    ["sslmode=disable", "sslmode=disable&options=-csearch_path=evil"],
  ])("rejects altered %s target", (from, to) =>
    expect(() =>
      assertDevelopmentTarget(good.replace(from, to), true),
    ).toThrow(),
  );
  it("rejects URL fragment, marker tampering and symlinks", () => {
    expect(() => assertDevelopmentTarget(good + "#ignored", true)).toThrow();
    state.marker.port = 55433;
    expect(() => assertDevelopmentTarget(good, true)).toThrow();
    state.marker.port = 55432;
    state.symlink = true;
    expect(() => assertDevelopmentTarget(good, true)).toThrow();
  });
  it("fixture mode fails closed on an otherwise approved Neon test endpoint", () => {
    const remote = `postgresql://pusula_test_runtime:temporary@${developmentTarget.host.replace(".c-8.", "-pooler.c-8.")}/pusula_sprint_b_test?sslmode=verify-full`;
    expect(() => assertDevelopmentTarget(remote, true)).toThrow();
    vi.stubEnv("PUSULA_LOCAL_FIXTURE", "");
    expect(assertDevelopmentTarget(remote, true).hostname).toContain(
      "neon.tech",
    );
  });
});
