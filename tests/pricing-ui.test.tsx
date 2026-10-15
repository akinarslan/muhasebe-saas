import { useState } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogManager } from "../src/components/catalog-manager";
import { CostCalculator } from "../src/components/cost-calculator";
import { initialPricingCatalog, updateMaterialCost } from "../src/lib/pricing";
import type { PricingCatalog, RateSnapshot } from "../src/lib/pricing-types";
const rate: RateSnapshot = {
  value: 50,
  source: "tcmb",
  publishedAt: "2026-10-15",
  fetchedAt: "2026-10-15T12:00:00Z",
};
afterEach(cleanup);
function Harness({
  initial = initialPricingCatalog(),
}: {
  initial?: PricingCatalog;
}) {
  const [catalog, setCatalog] = useState(initial);
  return (
    <>
      <CatalogManager catalog={catalog} onChange={setCatalog} />
      <output data-testid="catalog">{JSON.stringify(catalog)}</output>
    </>
  );
}
describe("Malzeme ve gider arayüzü", () => {
  it("kullanıcı yeni malzeme, varyant ve özel gider türü ekleyebilir", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText("Malzeme adı"), "Mat laminasyon");
    await user.selectOptions(
      screen.getByLabelText("Maliyet birimi"),
      "metretül",
    );
    await user.type(
      screen.getByLabelText("Başlangıç USD alış maliyeti"),
      "2.5",
    );
    await user.click(screen.getByRole("button", { name: "Malzemeyi ekle" }));
    let data = JSON.parse(screen.getByTestId("catalog").textContent!);
    expect(data.materials.at(-1)).toMatchObject({
      name: "Mat laminasyon",
      unit: "metretül",
      roll: true,
    });
    expect(data.materials.at(-1).variants[0].usdCost).toBe(2.5);
    const family = screen
      .getByRole("heading", { name: "Mat laminasyon" })
      .closest("section")!;
    await user.click(within(family).getByText("Yeni varyant ekle"));
    await user.type(
      within(family).getByLabelText("Varyant adı"),
      "Premium 160",
    );
    await user.type(
      within(family).getByLabelText("Varyant genişliği (cm)"),
      "160",
    );
    await user.type(within(family).getByLabelText("Varyant USD maliyeti"), "3");
    await user.click(
      within(family).getByRole("button", { name: "Varyantı ekle" }),
    );
    data = JSON.parse(screen.getByTestId("catalog").textContent!);
    expect(data.materials.at(-1).variants).toHaveLength(2);
    await user.type(screen.getByLabelText("Gider adı"), "Vinç kiralama");
    await user.clear(screen.getByLabelText("Gider birimi"));
    await user.type(screen.getByLabelText("Gider birimi"), "saat");
    await user.type(screen.getByLabelText("Varsayılan USD tutarı"), "12");
    await user.click(screen.getByRole("button", { name: "Gider türünü ekle" }));
    data = JSON.parse(screen.getByTestId("catalog").textContent!);
    expect(data.expenses.at(-1)).toMatchObject({
      name: "Vinç kiralama",
      unit: "saat",
      usdAmount: 12,
    });
  });
  it("USD maliyetini elle değiştirir ve denetim geçmişi saklar", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={updateMaterialCost(
          initialPricingCatalog(),
          "mat-folyo",
          "folyo-152",
          5,
          { id: "u1", name: "İlk kullanıcı" },
        )}
      />,
    );
    const input = screen.getByLabelText(
      "Baskı folyosu Standart · 152 cm USD maliyeti",
    );
    await user.clear(input);
    await user.type(input, "6.25");
    await user.click(
      within(input.closest("form")!).getByRole("button", {
        name: "Maliyeti güncelle",
      }),
    );
    const data = JSON.parse(screen.getByTestId("catalog").textContent!);
    const v = data.materials[0].variants.find(
      (v: { id: string }) => v.id === "folyo-152",
    );
    expect(v.usdCost).toBe(6.25);
    expect(v.history.at(-1)).toMatchObject({
      previous: 5,
      next: 6.25,
      userName: "Deniz Yılmaz",
    });
  });
  it("uygunsuz ruloyu seçtirmez; çoklu malzeme, özel gider, marj ve manuel fiyat çalışır", async () => {
    const user = userEvent.setup();
    const apply = vi.fn();
    const catalog = updateMaterialCost(
      initialPricingCatalog(),
      "mat-folyo",
      "folyo-152",
      5,
      { id: "u", name: "Test" },
    );
    render(
      <CostCalculator
        catalog={catalog}
        onCatalogChange={() => {}}
        rate={rate}
        onApply={apply}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Malzeme ekle" }));
    expect(
      (screen.getByLabelText("Varyant / genişlik") as HTMLSelectElement).value,
    ).toBe("folyo-152");
    expect(
      (screen.getByRole("button", { name: "137 cm Dar" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getAllByText("3.1008 m²")[0]).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Malzeme ekle" }));
    expect(screen.getAllByLabelText("Malzeme seç")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Yeni gider ekle" }));
    await user.clear(screen.getByLabelText("Gider 1"));
    await user.type(screen.getByLabelText("Gider 1"), "Özel paketleme");
    await user.clear(screen.getByLabelText("USD / birim"));
    await user.type(screen.getByLabelText("USD / birim"), "10");
    await user.clear(screen.getByLabelText("Hedef kâr marjı (%)"));
    await user.type(screen.getByLabelText("Hedef kâr marjı (%)"), "50");
    await user.type(
      screen.getByLabelText("Manuel net satış fiyatı (TL)"),
      "3000",
    );
    await user.click(
      screen.getByRole("button", { name: "Fiyatı ve maliyeti sabitle" }),
    );
    expect(apply).toHaveBeenCalledOnce();
    expect(apply.mock.calls[0][0]).toMatchObject({
      chosenNetUsd: 60,
      targetPercent: 50,
    });
    expect(apply.mock.calls[0][0].totalCostUsd).toBeCloseTo(41.008, 8);
    expect(apply.mock.calls[0][0].materials).toHaveLength(2);
  });
  it("kur değişince önerilen TL fiyatını yeni kurdan sabitler", async () => {
    const user = userEvent.setup();
    const apply = vi.fn();
    const c = updateMaterialCost(
      initialPricingCatalog(),
      "mat-folyo",
      "folyo-152",
      5,
      { id: "u", name: "Test" },
    );
    const { rerender } = render(
      <CostCalculator
        catalog={c}
        onCatalogChange={() => {}}
        rate={rate}
        onApply={apply}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Malzeme ekle" }));
    rerender(
      <CostCalculator
        catalog={c}
        onCatalogChange={() => {}}
        rate={{ ...rate, value: 60 }}
        onApply={apply}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Fiyatı ve maliyeti sabitle" }),
    );
    expect(apply.mock.calls[0][0].rate.value).toBe(60);
    expect(apply.mock.calls[0][0].totalCostUsd).toBeCloseTo(15.504);
  });
});
