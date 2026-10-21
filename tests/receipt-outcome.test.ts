import { describe, it, expect, vi } from "vitest";
import {
  reconcileReceiptAction,
  ReceiptRequestError,
  unknownReceiptOutcome,
} from "@/lib/cloud/receipt-outcome";
describe("receipt uncertain response reconciliation", () => {
  it("reads committed outcome after network response loss without another write", async () => {
    const read = vi.fn().mockResolvedValue({ state: "SUCCEEDED" });
    expect(
      await reconcileReceiptAction(new TypeError("fetch failed"), read),
    ).toBe("SUCCEEDED");
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("reports rollback using an authorized read after server timeout", async () => {
    expect(
      await reconcileReceiptAction(
        new ReceiptRequestError(503, "STOCK_OUTCOME_UNKNOWN"),
        async () => ({ state: "NOT_COMMITTED" }),
      ),
    ).toBe("NOT_COMMITTED");
  });
  it("preserves definite server authorization and validation errors", async () => {
    const read = vi.fn();
    expect(
      await reconcileReceiptAction(
        new ReceiptRequestError(403, "FORBIDDEN"),
        read,
      ),
    ).toBe("SERVER_ERROR");
    expect(read).not.toHaveBeenCalled();
  });
  it("does not claim failure or success when status cannot be read", async () => {
    expect(
      await reconcileReceiptAction(new TypeError("network"), async () => {
        throw new ReceiptRequestError(403, "FORBIDDEN");
      }),
    ).toBe("UNKNOWN");
    expect(unknownReceiptOutcome).toBe(
      "İşlem sonucu doğrulanamadı; kayıt durumunu kontrol edin.",
    );
  });
  it("reads status for server errors, and rejects malformed outcomes", async () => {
    expect(
      await reconcileReceiptAction(
        new ReceiptRequestError(503, "SERVICE_UNAVAILABLE"),
        async () => ({ state: "bad" }) as never,
      ),
    ).toBe("UNKNOWN");
  });
});
