import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Workspace } from "../src/components/workspace";
vi.mock("../src/components/dashboard", () => ({
  Dashboard: () => <h1>Genel bakış</h1>,
}));
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: async () => ({
        rate: {
          value: 49.5,
          source: "tcmb",
          publishedAt: "2026-10-15",
          fetchedAt: "2026-10-15T12:00:00Z",
        },
        stale: false,
      }),
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("Satış taslağı ve müşteri entegrasyonu", () => {
  it("yeni müşteri kaydında iptal taslağı korur, onay temizler; yeni satış kaydedilir", async () => {
    const user = userEvent.setup();
    const view = render(<Workspace />);
    await user.click(screen.getByRole("button", { name: /Satışlar/ }));
    await user.click(
      screen.getByRole("button", { name: "Dijital baskı folyo" }),
    );
    const description = screen.getByLabelText("Ürün açıklaması");
    await user.clear(description);
    await user.type(description, "Vitrin baskısı");
    await user.click(screen.getByRole("button", { name: "Yeni müşteri" }));
    await user.type(
      screen.getByLabelText(/Şirket \/ kurum adı/),
      "Deneme Vitrin",
    );
    await user.click(screen.getByRole("button", { name: "Müşteriyi kaydet" }));
    await screen.findByText("Müşteri değiştirilsin mi?");
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const stored = JSON.parse(localStorage.getItem("pusula.draft.v1")!);
    expect(stored.lines[0].description).toBe("Vitrin baskısı");
    expect(stored.customerId).toBe("");
    expect(
      JSON.parse(localStorage.getItem("pusula.demo.v1")!).customers.at(-1).name,
    ).toBe("Deneme Vitrin");
    view.unmount();
    render(<Workspace />);
    await user.click(screen.getByRole("button", { name: /Satışlar/ }));
    expect(
      (screen.getByLabelText("Ürün açıklaması") as HTMLInputElement).value,
    ).toBe("Vitrin baskısı");
    const newCustomer = JSON.parse(localStorage.getItem("pusula.demo.v1")!).customers.at(-1);
    await user.selectOptions(screen.getByLabelText("Müşteri seçin"), newCustomer.id);
    await user.click(screen.getByRole("button", { name: "Devam et ve temizle" }));
    expect(JSON.parse(localStorage.getItem("pusula.draft.v1")!).lines).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Dijital baskı folyo" }));
    await user.click(
      screen.getByRole("button", { name: "Maliyet ve fiyat hesapla" }),
    );
    await user.type(
      screen.getByLabelText("Manuel net satış fiyatı (TL)"),
      "600",
    );
    await user.click(
      screen.getByRole("button", { name: "Fiyatı ve maliyeti sabitle" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Demo satışı kaydet" }),
    );
    const saved = JSON.parse(localStorage.getItem("pusula.demo.v1")!);
    expect(saved.sales).toHaveLength(85);
    expect(saved.sales[0].customerId).toBe(newCustomer.id);
    expect(saved.sales[0].rateSnapshot.source).toBe("tcmb");
    expect(saved.sales[0].lines[0].costSnapshot.chosenNetUsd).toBeCloseTo(
      600 / 49.5,
    );
    expect(
      JSON.parse(localStorage.getItem("pusula.draft.v1")!).lines,
    ).toHaveLength(0);
  });
});
