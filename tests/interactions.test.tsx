import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CustomerDrawer } from "../src/components/customer-drawer";
import { SaleForm } from "../src/components/sale-form";
import { createDemo, emptyDraft, newLine, products } from "../src/lib/mock";
afterEach(cleanup);
describe("Temel etkileşimler", () => {
  it("müşteri ekler ve doğru il/ilçe ilişkisini korur", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    render(
      <CustomerDrawer
        open
        onOpenChange={() => {}}
        customers={[]}
        onSave={save}
      />,
    );
    await user.type(
      screen.getByLabelText(/Şirket \/ kurum adı/),
      "Test Atölyesi",
    );
    await user.selectOptions(screen.getByLabelText("İl"), "İstanbul");
    await user.selectOptions(screen.getByLabelText("İlçe"), "Kadıköy");
    await user.selectOptions(screen.getByLabelText("İl"), "Ankara");
    expect((screen.getByLabelText("İlçe") as HTMLSelectElement).value).toBe("");
    await user.click(screen.getByRole("button", { name: "Müşteriyi kaydet" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].city).toBe("Ankara");
  });
  it("mükerrer müşteriyi engeller", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const d = createDemo();
    render(
      <CustomerDrawer
        open
        onOpenChange={() => {}}
        customers={d.customers}
        onSave={save}
      />,
    );
    await user.type(
      screen.getByLabelText(/Şirket \/ kurum adı/),
      d.customers[0].name,
    );
    await user.click(screen.getByRole("button", { name: "Müşteriyi kaydet" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });
  it("Escape ile paneli kapatır", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <CustomerDrawer
        open
        onOpenChange={close}
        customers={[]}
        onSave={() => {}}
      />,
    );
    await user.keyboard("{Escape}");
    expect(close).toHaveBeenCalledWith(false);
  });
  it("ödeme toplamı satıştan büyükse kaydetmez", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const d = createDemo();
    render(
      <SaleForm
        draft={{
          ...emptyDraft(),
          customerId: d.customers[2].id,
          lines: [newLine(products[0])],
          paid: 99999,
        }}
        setDraft={() => {}}
        customers={d.customers}
        onNewCustomer={() => {}}
        onSave={save}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Demo satışı kaydet" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain("aşamaz");
    expect(save).not.toHaveBeenCalled();
  });
});
