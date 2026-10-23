// @vitest-environment node
import { expect, it } from "vitest";
import { saleSource } from "../src/lib/cloud/sale-source";

it("keeps business identity independent of request key and object key order", () => {
  const a = { idempotencyKey: "a", customer: "c", lines: [{ amount: "10" }] };
  const b = { lines: [{ amount: "10" }], customer: "c", idempotencyKey: "b" };
  expect(saleSource(a)).toBe(saleSource(b));
  expect(saleSource({ ...a, customer: "different" })).not.toBe(saleSource(a));
});
it("uses an explicit source reference to distinguish genuine repeated sales", () => {
  expect(saleSource({ idempotencyKey: "a", sourceRef: "ZY-1" })).toBe(
    "ref:ZY-1",
  );
  expect(saleSource({ idempotencyKey: "b", sourceRef: "ZY-1" })).toBe(
    "ref:ZY-1",
  );
  expect(saleSource({ idempotencyKey: "b", sourceRef: "ZY-2" })).not.toBe(
    "ref:ZY-1",
  );
});
