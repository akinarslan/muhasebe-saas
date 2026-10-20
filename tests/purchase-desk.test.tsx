import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PurchaseDesk } from "../src/components/purchase-desk";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fixture(currency: string, cost = true, offer = false) {
  const writes: { body: unknown }[] = [];
  const row = {
    id: "o1",
    supplierId: "s1",
    supplierName: "Synthetic",
    businessNo: "PO-2026-0001",
    status: "DRAFT",
    createdAt: "2026-10-20T00:00:00Z",
    version: 1,
    lineCount: 1,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, opts?: RequestInit) => {
      if (opts?.method === "POST") return Response.json({ id: "o1" });
      if (opts?.method === "PATCH") {
        writes.push({ body: JSON.parse(String(opts.body)) });
        return Response.json({ id: row.id, version: 2 });
      }
      let data: unknown = [];
      if (url.includes("/purchase-orders/o1"))
        data = {
          ...row,
          lines: [
            {
              id: "l1",
              supplierMaterialId: "link1",
              variantId: "v1",
              supplierId: "s1",
              variantName: "Variant",
              materialName: "Material",
              orderedQty: "2",
              purchaseUnit: "linear_meter",
              orderedBaseQty: "3.04",
              baseUnit: "square_meter",
              offerVersionId: offer ? "offer1" : null,
              originalCurrency: currency,
              ...(cost ? { originalUnitPrice: "50" } : {}),
              priceSource: offer ? "OFFER" : "MANUAL",
            },
          ],
        };
      else if (url.includes("/purchase-orders?")) data = [row];
      else if (url.includes("/materials?"))
        data = [
          {
            id: "link1",
            variantId: "v1",
            materialName: "Material",
            variantName: "Variant",
            purchaseUnit: "linear_meter",
            active: true,
          },
        ];
      else if (url.includes("/suppliers?"))
        data = [{ id: "s1", name: "Synthetic", active: true }];
      else if (url.includes("supplier-offers?"))
        data = [
          {
            id: "offer1",
            revision: 1,
            originalCurrency: currency,
            originalUnitPrice: "50",
            purchaseUnit: "linear_meter",
            minQty: "1",
          },
        ];
      return Response.json(data);
    }),
  );
  return { writes };
}
async function open(cost = true, offer = false) {
  const user = userEvent.setup();
  render(
    <PurchaseDesk
      company="company"
      activity=""
      actions={[
        "purchases.view",
        "purchases.edit",
        "supplierOffers.view",
        ...(cost ? ["purchases.costView"] : []),
      ]}
      onDirtyChange={() => {}}
    />,
  );
  await user.click(await screen.findByRole("button", { name: "Detay" }));
  await user.click(
    await screen.findByRole("button", { name: "Taslağı düzenle" }),
  );
  await screen.findByRole("option", { name: "Synthetic" });
  if (offer) await screen.findByRole("option", { name: /v1/ });
  return user;
}

it.each(["TRY", "USD", "EUR", "GBP"])(
  "F08: edit-only user reopens saved %s currency and price",
  async (currency) => {
    fixture(currency);
    await open();
    expect(
      ((await screen.findByLabelText("Manuel birim fiyat")) as HTMLInputElement)
        .value,
    ).toBe("50");
    expect(
      (screen.getByLabelText("Manuel para birimi") as HTMLSelectElement).value,
    ).toBe(currency);
  },
);

it("F08: hidden manual price stays absent and PATCH uses only a preservation reference", async () => {
  const { writes } = fixture("TRY", false);
  const user = await open(false);
  expect(screen.queryByLabelText("Manuel birim fiyat")).toBeNull();
  expect((screen.getByLabelText("Miktar") as HTMLInputElement).disabled).toBe(
    true,
  );
  await user.click(screen.getByRole("button", { name: "Taslağı kaydet" }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toEqual({
    legalEntityId: "company",
    activityId: null,
    version: 1,
    lines: [{ preserveLineId: "l1", expectedDate: null }],
  });
});

it("offer-backed edit loads its existing offer without changing the material selection", async () => {
  fixture("USD", true, true);
  await open(true, true);
  expect(
    (screen.getByLabelText("Teklif sürümü") as HTMLSelectElement).value,
  ).toBe("offer1");
  expect(
    (screen.getByLabelText("Alış birimi") as HTMLSelectElement).disabled,
  ).toBe(true);
});

it("dirty drawer Escape prompts once and rejecting keeps its inputs", async () => {
  fixture("USD");
  const confirm = vi.fn(() => false);
  vi.stubGlobal("confirm", confirm);
  const user = await open();
  const amount = screen.getByLabelText("Miktar");
  await user.clear(amount);
  await user.type(amount, "12");
  await user.keyboard("{Escape}");
  expect(confirm).toHaveBeenCalledTimes(1);
  expect((screen.getByLabelText("Miktar") as HTMLInputElement).value).toBe(
    "12",
  );
});

it("newly saved order remains selected after the list refresh", async () => {
  fixture("USD");
  const user = userEvent.setup();
  render(
    <PurchaseDesk
      company="company"
      activity=""
      actions={["purchases.view", "purchases.create", "purchases.costView"]}
      onDirtyChange={() => {}}
    />,
  );
  await user.click(await screen.findByRole("button", { name: "Yeni sipariş" }));
  await user.selectOptions(screen.getByLabelText("Tedarikçi"), "s1");
  await user.selectOptions(
    await screen.findByLabelText("Malzeme eşleştirmesi"),
    "link1",
  );
  await user.type(await screen.findByLabelText("Manuel birim fiyat"), "50");
  await user.click(
    screen.getByRole("button", { name: "Sipariş taslağı oluştur" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() =>
    expect(screen.getByRole("region", { name: "Sipariş detayı" })).toBeTruthy(),
  );
});
