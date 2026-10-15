"use client";
import { useState } from "react";
import type { Material, PricingCatalog } from "@/lib/pricing-types";
import { createId } from "@/lib/runtime";
import { Button } from "./ui/button";
import { NumericInput } from "./ui/numeric-input";
export function MaterialEditor({
  material: m,
  catalog,
  onChange,
}: {
  material: Material;
  catalog: PricingCatalog;
  onChange: (c: PricingCatalog) => void;
}) {
  const [supplier, setSupplier] = useState("");
  const patch = (p: Partial<Material>) =>
    onChange({
      ...catalog,
      materials: catalog.materials.map((x) =>
        x.id === m.id ? { ...x, ...p, updatedAt: new Date().toISOString() } : x,
      ),
    });
  return (
    <details className="material-editor">
      <summary>Malzeme bilgileri, ölçüler ve arşiv</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          patch({
            unit: String(f.get("unit")) as Material["unit"],
            ...(String(f.get("unit")) !== m.unit
              ? {
                  variants: m.variants.map((v) => ({ ...v, usdCost: null })),
                  needsConfirmation: true,
                }
              : {}),
            name: String(f.get("name")),
            sku: String(f.get("sku")),
            category: String(f.get("category")),
            brand: String(f.get("brand")),
            supplierId: String(f.get("supplier")),
            description: String(f.get("description")),
            vat: Number(f.get("vat")),
            margins: {
              left: Number(f.get("left")),
              right: Number(f.get("right")),
              top: Number(f.get("top")),
              bottom: Number(f.get("bottom")),
            },
          });
        }}
      >
        <div className="field-grid">
          <label>
            Maliyet birimi / düzenle
            <select name="unit" defaultValue={m.unit}>
              {["m²", "metretül", "adet", "plaka"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            <small className="help">
              Birim değişirse yeni USD maliyetlerini yeniden girin.
            </small>
          </label>
          {(["name", "sku", "category", "brand", "description"] as const).map(
            (k, i) => (
              <label key={k}>
                {
                  [
                    "Malzeme adı / düzenle",
                    "SKU",
                    "Kategori",
                    "Marka",
                    "Açıklama",
                  ][i]
                }
                <input
                  name={k}
                  required={k === "name"}
                  defaultValue={m[k] ?? ""}
                />
              </label>
            ),
          )}
          <label>
            Tedarikçi
            <select name="supplier" defaultValue={m.supplierId ?? ""}>
              <option value="">Seçilmedi</option>
              {catalog.suppliers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Malzeme KDV (%)
            <NumericInput
              name="vat"
              defaultValue={m.vat ?? 20}
              min={0}
              max={100}
              required
            />
          </label>
          {(["left", "right", "top", "bottom"] as const).map((k, i) => (
            <label key={k}>
              {["Sol", "Sağ", "Üst", "Alt"][i]} varsayılan pay (cm)
              <NumericInput
                name={k}
                min={0}
                defaultValue={m.margins?.[k] ?? 2}
                required
              />
            </label>
          ))}
        </div>
        <Button type="submit" variant="outline">
          Bilgileri güncelle
        </Button>
      </form>
      <div className="label-row">
        <Button
          variant="outline"
          onClick={() => patch({ active: m.active === false })}
        >
          {m.active === false ? "Aktifleştir" : "Pasifleştir"}
        </Button>
        <Button
          variant="outline"
          onClick={() => patch({ archived: !m.archived })}
        >
          {m.archived ? "Arşivden çıkar" : "Malzemeyi arşivle"}
        </Button>
      </div>
      {m.sourcePrice && (
        <p className="help">
          {m.sourcePrice.label}: {m.sourcePrice.amount} {m.sourcePrice.currency}
          /m² → USD. Referans USD/TRY {m.sourcePrice.usdTry}, EUR/TRY{" "}
          {m.sourcePrice.eurTry}. Sonraki kur güncellemeleri USD maliyetini
          değiştirmez.
        </p>
      )}
      {m.variants.map((v) => (
        <form
          key={v.id}
          className="expense-library-row"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const w = Number(f.get("width"));
            const l = Number(f.get("length"));
            if (!(w > 0 && l > 0)) return;
            patch({
              needsConfirmation: false,
              variants: m.variants.map((x) =>
                x.id === v.id
                  ? {
                      ...x,
                      widthCm: w,
                      lengthCm: l,
                      needsConfirmation: false,
                      inStock: true,
                    }
                  : x,
              ),
            });
          }}
        >
          <b>
            {v.name}
            {v.needsConfirmation ? " · Onay gerekli" : ""}
          </b>
          <label>
            En (cm)
            <NumericInput
              name="width"
              defaultValue={v.widthCm || ""}
              min={0.01}
              required
            />
          </label>
          <label>
            Boy (cm)
            <NumericInput
              name="length"
              defaultValue={v.lengthCm ?? ""}
              min={0.01}
              required
            />
          </label>
          <Button type="submit" variant="outline">
            Ölçüyü onayla
          </Button>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              patch({
                variants: m.variants.map((x) =>
                  x.id === v.id ? { ...x, archived: !x.archived } : x,
                ),
              })
            }
          >
            {v.archived ? "Genişliği geri al" : "Genişliği kaldır / arşivle"}
          </button>
        </form>
      ))}
      <div className="label-row">
        <label>
          Yeni tedarikçi
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
        </label>
        <Button
          variant="outline"
          onClick={() => {
            if (!supplier.trim()) return;
            onChange({
              ...catalog,
              suppliers: [
                ...(catalog.suppliers ?? []),
                { id: createId(), name: supplier.trim() },
              ],
            });
            setSupplier("");
          }}
        >
          Tedarikçi ekle
        </Button>
      </div>
    </details>
  );
}
