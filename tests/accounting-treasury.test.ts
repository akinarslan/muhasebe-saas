// @vitest-environment node
import { expect, it } from "vitest";
import {
  turkishDate,
  turkishMoney,
  treasuryOperation,
} from "../src/lib/cloud/treasury-contracts";
it("parses Turkish financial text without binary arithmetic", () => {
  expect(turkishMoney("12.000,00")).toBe("12000.00");
  expect(turkishMoney("5000,5")).toBe("5000.50");
  expect(turkishMoney("0,01")).toBe("0.01");
  expect(turkishDate("29.10.2026")).toBe("2026-10-29");
});
it.each(["1.2", "12.00,00", "1,001", "-1", "1e3", "NaN", "1,2,3"])(
  "rejects ambiguous Turkish amount %s",
  (v) => expect(() => turkishMoney(v)).toThrow(),
);
it.each(["31.02.2026", "2026-10-29", "1.1.2026"])(
  "rejects invalid local date %s",
  (v) => expect(() => turkishDate(v)).toThrow(),
);
it("never accepts PAN/CVV fields or JSON numeric financial amounts", () => {
  const uuid = "11111111-1111-4111-8111-111111111111";
  const base = {
    legalEntityId: uuid,
    intentId: uuid,
    idempotencyKey: uuid,
    currency: "TRY",
    amount: "1.00",
    bookedOn: "2026-10-22",
    reason: "Synthetic",
  };
  expect(treasuryOperation.safeParse(base).success).toBe(true);
  expect(treasuryOperation.safeParse({ ...base, amount: 1 }).success).toBe(
    false,
  );
  expect(
    treasuryOperation.safeParse({
      ...base,
      cardNumber: "forbidden",
      cvv: "forbidden",
    }).success,
  ).toBe(false);
});
