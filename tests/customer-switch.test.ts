import { describe, it, expect } from "vitest";
import { createDemo, emptyDraft, newLine, products } from "../src/lib/mock";
import { customerTarget, hasCustomerDraftData, switchDraftCustomer } from "../src/lib/customer-switch";

describe("Müşteriye bağlı taslak sınırı", () => {
  it("boş taslak doğrudan seçilebilir; aynı müşterinin varsayılan vadesi dolu sayılmaz", () => {
    const customer = createDemo().customers[0];
    const draft = switchDraftCustomer(emptyDraft(), customerTarget(customer, customer.segment));
    expect(hasCustomerDraftData(draft, customer.term)).toBe(false);
  });
  it.each(["lines", "plans", "paid", "notes", "method", "dueDate", "rateSnapshot"])("%s tek başına bile onay gerektirir", field => {
    const values = { lines: [newLine(products[0])], plans: [{ id: "p", amount: 20, method: "Nakit", dueDate: "2026-10-20" }], paid: 20, notes: "Müşterinin notu", method: "Senet", dueDate: "2028-01-01", rateSnapshot: { value: 50, source: "tcmb" } };
    expect(hasCustomerDraftData({ ...emptyDraft(), [field]: values[field as keyof typeof values] })).toBe(true);
  });
  it("onayda yalnız yeni taslağı üretir; tüm snapshot ve tahsilat verileri ayrılır", () => {
    const data = createDemo();
    const historical = JSON.stringify(data);
    const old = { ...emptyDraft(), customerId: data.customers[0].id, lines: [newLine(products[0])], notes: "Özel", paid: 25 };
    const before = JSON.stringify(old);
    const customer = data.customers[1];
    const next = switchDraftCustomer(old, customerTarget(customer, customer.segment));
    expect(next).toMatchObject({ customerId: customer.id, segment: customer.segment, lines: [], plans: [], notes: "", paid: 0 });
    expect(next.rateSnapshot).toBeUndefined();
    expect(JSON.stringify(old)).toBe(before);
    expect(JSON.stringify(data)).toBe(historical);
  });
});
