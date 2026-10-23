import { afterEach, expect, it, vi } from "vitest";
import {
  salePendingKey,
  submitTrackedSale,
  saleOutcome,
} from "../src/lib/cloud/tracked-sale";
const scope = { legalEntityId: "company", activityId: null };
afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
it("automatically assigns a server reference and stores no payload or balance", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ id: "intent-1" }))
    .mockResolvedValueOnce(Response.json({ id: "sale-1" }));
  vi.stubGlobal("fetch", fetch);
  await submitTrackedSale(
    scope,
    { idempotencyKey: "request-1", amount: "12000" },
    () => {},
  );
  expect(JSON.parse(fetch.mock.calls[1][1].body).sourceRef).toBe(
    "intent:intent-1",
  );
  expect(sessionStorage.getItem(salePendingKey(scope))).toBeNull();
});
it("retains an opaque reference after unknown POST result and never blindly posts again", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ id: "intent-2" }))
    .mockRejectedValueOnce(Error("connection lost"));
  vi.stubGlobal("fetch", fetch);
  await expect(
    submitTrackedSale(scope, { idempotencyKey: "request-2" }, () => {}),
  ).rejects.toThrow();
  expect(sessionStorage.getItem(salePendingKey(scope))).toBe("intent-2");
  await expect(
    submitTrackedSale(scope, { idempotencyKey: "different" }, () => {}),
  ).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(2);
  fetch.mockResolvedValueOnce(
    Response.json({ state: "SUCCEEDED", id: "sale-2" }),
  );
  expect((await saleOutcome(scope, "intent-2")).id).toBe("sale-2");
  expect(fetch.mock.calls[2][1].method).toBe("GET");
});
