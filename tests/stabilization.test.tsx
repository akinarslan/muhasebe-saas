import { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NumericInput } from "../src/components/ui/numeric-input";
import { parseNumeric, numericValue } from "../src/lib/numeric";
import { createId, copyValue } from "../src/lib/runtime";
import { repairCustomers } from "../src/lib/migrate";
import { createDemo } from "../src/lib/mock";
import { seedCatalog } from "../src/lib/catalog-seed";
import {
  initialPricingCatalog,
  consumeMaterial,
  updateMaterialCost,
} from "../src/lib/pricing";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("v0.2.1 regressions", () => {
  it("ham metni korur; sıfır öne eklenmez ve boş sıfır değildir", async () => {
    function Demo() {
      const [v, setV] = useState(0);
      return (
        <>
          <label>
            Fiyat
            <NumericInput
              value={v}
              onChange={(e) => setV(numericValue(e.target.value))}
            />
          </label>
          <output>{Number.isNaN(v) ? "invalid" : v}</output>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Demo />);
    const input = screen.getByLabelText("Fiyat");
    await user.type(input, "1000");
    expect((input as HTMLInputElement).value).toBe("1000");
    await user.clear(input);
    expect(screen.getByText("invalid")).toBeTruthy();
    await user.type(input, "1,25");
    expect((input as HTMLInputElement).value).toBe("1,25");
    expect(screen.getByText("1.25")).toBeTruthy();
  });
  it("ondalık ve negatif girişleri çözer; boş/geçersiz reddedilir", () => {
    expect(parseNumeric("0.50")).toBe(0.5);
    expect(parseNumeric("1,25")).toBe(1.25);
    expect(parseNumeric("-2.5")).toBe(-2.5);
    expect(parseNumeric("")).toBeNull();
    expect(parseNumeric("abc")).toBeNull();
  });
  it("randomUUID ve structuredClone yokken müşteri IDsi üretir", () => {
    vi.stubGlobal("crypto", {});
    vi.stubGlobal("structuredClone", undefined);
    expect(createId()).not.toBe(createId());
    expect(copyValue({ name: "Müşteri" })).toEqual({ name: "Müşteri" });
  });
  it("eski/null müşteri alanlarını ve ID çakışmalarını idempotent taşır", () => {
    const d = createDemo();
    d.customers[0].name = null as unknown as string;
    d.customers[1].id = d.customers[0].id;
    const fixed = repairCustomers(d);
    expect(fixed.customers[0].name).toContain("kontrol");
    expect(new Set(fixed.customers.map((c) => c.id)).size).toBe(
      d.customers.length,
    );
    expect(repairCustomers(fixed)).toEqual(fixed);
  });
  it("seed mevcut USD fiyatını ezmez ve tekrar eklemez", () => {
    const a = seedCatalog(initialPricingCatalog());
    const b = updateMaterialCost(a, "seed-vinil", "seed-vinil-140", 9, {
      id: "u",
      name: "Test",
    });
    expect(seedCatalog(b)).toEqual(b);
    expect(
      b.materials.find((m) => m.id === "seed-vinil")?.variants[0].usdCost,
    ).toBe(9);
  });
  it("vinil 140 cm maliyeti 3.4272 USD; referans dönüşümü USDde sabit", () => {
    const c = seedCatalog(initialPricingCatalog());
    const m = c.materials.find((m) => m.id === "seed-vinil")!;
    expect(
      consumeMaterial(
        {
          id: "x",
          materialId: m.id,
          variantId: m.variants[0].id,
          widthCm: 135,
          heightCm: 200,
          quantity: 1,
          left: 2,
          right: 2,
          top: 2,
          bottom: 2,
          reusableM2: 0,
        },
        m,
      ).costUsd,
    ).toBe(3.4272);
    expect(
      c.materials.find((m) => m.id === "seed-oracal-beyaz")?.variants[0]
        .usdCost,
    ).toBeCloseTo(80 / 49.4204, 9);
    expect(
      c.materials.find((m) => m.id === "seed-billboard")?.needsConfirmation,
    ).toBe(true);
  });
});
