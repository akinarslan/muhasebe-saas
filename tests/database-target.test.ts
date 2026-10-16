import { describe, expect, it } from "vitest";
import {
  assertDevelopmentTarget,
  developmentTarget,
} from "../src/server/db/target";
const url = (database: string, host: string = developmentTarget.host) =>
  `postgresql://fixture:private-test-value@${host}/${database}?sslmode=verify-full`;
describe("Database migration target guard", () => {
  it("accepts only approved direct development/test targets", () => {
    expect(
      assertDevelopmentTarget(url(developmentTarget.database), false, true)
        .pathname,
    ).toBe("/pusula_development");
    expect(
      assertDevelopmentTarget(url(developmentTarget.testDatabase), true, true)
        .pathname,
    ).toBe("/pusula_sprint_b_test");
  });
  it("rejects production endpoint and unexpected databases", () => {
    expect(() =>
      assertDevelopmentTarget(url("production"), false, true),
    ).toThrow();
    expect(() =>
      assertDevelopmentTarget(
        url(developmentTarget.database, "production.neon.tech"),
        false,
        true,
      ),
    ).toThrow();
  });
  it("rejects pooled/direct and test/development mixups", () => {
    expect(() =>
      assertDevelopmentTarget(url(developmentTarget.database)),
    ).toThrow();
    expect(() =>
      assertDevelopmentTarget(url(developmentTarget.database), true, true),
    ).toThrow();
  });
  it("requires certificate-verified TLS and credentials", () => {
    expect(() =>
      assertDevelopmentTarget(
        url(developmentTarget.database).replace("verify-full", "disable"),
        false,
        true,
      ),
    ).toThrow();
    expect(() =>
      assertDevelopmentTarget(
        url(developmentTarget.database).replace(
          "fixture:private-test-value@",
          "",
        ),
        false,
        true,
      ),
    ).toThrow();
  });
  it("configuration errors do not disclose input secrets", () => {
    try {
      assertDevelopmentTarget("private-test-value");
    } catch (error) {
      expect(String(error)).not.toContain("private-test-value");
    }
    expect(() => assertDevelopmentTarget(undefined)).toThrow(
      "configuration is missing",
    );
  });
  it("rejects driver connection overrides and nonstandard ports", () => {
    expect(() =>
      assertDevelopmentTarget(
        `${url(developmentTarget.database)}&host=production.neon.tech`,
        false,
        true,
      ),
    ).toThrow();
    expect(() =>
      assertDevelopmentTarget(
        url(developmentTarget.database).replace("/pusula", ":1/pusula"),
        false,
        true,
      ),
    ).toThrow();
  });
});
