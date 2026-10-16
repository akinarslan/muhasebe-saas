"use client";
import { numericValue } from "@/lib/numeric";
import { NumericInput } from "./ui/numeric-input";
import { createId, copyValue } from "@/lib/runtime";

import { useState } from "react";
import {
  Layers,
  Plus,
  Trash2,
  Coins,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Scissors,
} from "lucide-react";
import { calculatePricing, pricingSnapshot } from "@/lib/pricing";
import type {
  CostSnapshot,
  MaterialUse,
  PricingCatalog,
  PricingInput,
  RateSnapshot,
} from "@/lib/pricing-types";
import { money } from "@/lib/finance";
import { user } from "@/lib/mock";
import { CatalogManager } from "./catalog-manager";
import { Button } from "./ui/button";
export function CostCalculator({
  catalog,
  onCatalogChange,
  rate,
  onApply,
  initialInput,
  width = 135,
  height = 200,
  quantity = 1,
  vat = 20,
}: {
  catalog: PricingCatalog;
  onCatalogChange: (c: PricingCatalog) => void;
  rate: RateSnapshot | null;
  onApply: (s: CostSnapshot) => void;
  initialInput?: PricingInput;
  width?: number;
  height?: number;
  quantity?: number;
  vat?: number;
}) {
  const [input, setInput] = useState<PricingInput>(() =>
    initialInput
      ? copyValue(initialInput)
      : {
          materials: [],
          expenses: [],
          method: "margin",
          targetPercent: 30,
          manualNetUsd: null,
          vat,
        },
  );
  const [manage, setManage] = useState(false);
  const [error, setError] = useState("");
  const update = (patch: Partial<PricingInput>) =>
    setInput({ ...input, ...patch });
  const changeMaterial = (id: string, p: Partial<MaterialUse>) =>
    update({
      materials: input.materials.map((m) => (m.id === id ? { ...m, ...p } : m)),
    });
  let result: ReturnType<typeof calculatePricing> | null = null;
  let calculationError = "";
  try {
    result = calculatePricing(input, catalog, rate?.value ?? 1);
  } catch (e) {
    calculationError = (e as Error).message;
  }
  function addMaterial() {
    const m =
      catalog.materials.find(
        (m) =>
          !m.archived &&
          m.active !== false &&
          m.variants.some(
            (v) =>
              v.usdCost !== null &&
              v.inStock &&
              !v.archived &&
              !v.needsConfirmation,
          ),
      ) ?? catalog.materials[0];
    if (!m) {
      setManage(true);
      return;
    }
    const suitable = m.variants
      .filter(
        (v) =>
          v.inStock &&
          !v.archived &&
          !v.needsConfirmation &&
          (!m.roll ||
            v.widthCm >=
              width + (m.margins?.left ?? 2) + (m.margins?.right ?? 2)),
      )
      .sort((a, b) => a.widthCm - b.widthCm)[0];
    update({
      materials: [
        ...input.materials,
        {
          id: createId(),
          materialId: m.id,
          variantId: suitable?.id ?? "",
          widthCm: width,
          heightCm: height,
          quantity,
          left: m.margins?.left ?? 2,
          right: m.margins?.right ?? 2,
          top: m.margins?.top ?? 2,
          bottom: m.margins?.bottom ?? 2,
          reusableM2: 0,
        },
      ],
    });
  }
  return (
    <div className="calculator">
      {manage && (
        <section className="panel form-panel calculator-catalog">
          <div className="label-row">
            <h2>Malzeme ve gider yönetimi</h2>
            <button className="text-button" onClick={() => setManage(false)}>
              Yönetimi kapat
            </button>
          </div>
          <CatalogManager catalog={catalog} onChange={onCatalogChange} />
        </section>
      )}
      <div className="calculator-flow">
        <span>
          <Layers size={15} /> Malzemeler
        </span>
        <ArrowRight size={13} />
        <span>
          <Coins size={15} /> Giderler
        </span>
        <ArrowRight size={13} />
        <span>
          <TrendingUp size={15} /> Fiyatlandırma
        </span>
      </div>
      <div className="calculator-layout">
        <div>
          <section className="panel form-panel">
            <div className="section-title">
              <span>
                <Layers size={18} />
              </span>
              <div>
                <h2>Malzemeler</h2>
                <p>
                  Gerçek tüketimi hesaplayın; uygun ruloyu stok ve fiyatına göre
                  seçin.
                </p>
              </div>
            </div>
            <div className="label-row">
              <Button variant="outline" size="sm" onClick={addMaterial}>
                <Plus size={14} /> Malzeme ekle
              </Button>
              <button
                className="text-button"
                onClick={() => setManage(!manage)}
              >
                <Plus size={14} />
                Yeni malzeme / maliyet yönetimi
              </button>
            </div>
            {!input.materials.length && (
              <div className="empty">
                <Layers size={28} />
                <b>Bir ürüne birden fazla malzeme ekleyebilirsiniz.</b>
                <small>Hizmetlerde yalnızca gider kullanabilirsiniz.</small>
              </div>
            )}
            {input.materials.map((u, i) => {
              const m = catalog.materials.find((m) => m.id === u.materialId);
              const consumption = result?.materials.find(
                (r) => r.use.id === u.id,
              );
              const needed = u.widthCm + u.left + u.right;
              return (
                <div className="material-use" key={u.id}>
                  <div className="label-row">
                    <b>Malzeme {i + 1}</b>
                    <button
                      className="icon-button"
                      aria-label={`${i + 1}. malzemeyi kaldır`}
                      onClick={() =>
                        update({
                          materials: input.materials.filter(
                            (x) => x.id !== u.id,
                          ),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="field-grid">
                    <label>
                      Malzeme seç
                      <select
                        value={u.materialId}
                        onChange={(e) => {
                          const mat = catalog.materials.find(
                            (m) => m.id === e.target.value,
                          )!;
                          const v = mat.variants
                            .filter(
                              (v) =>
                                v.inStock &&
                                !v.archived &&
                                !v.needsConfirmation &&
                                (!mat.roll || v.widthCm >= needed),
                            )
                            .sort((a, b) => a.widthCm - b.widthCm)[0];
                          changeMaterial(u.id, {
                            materialId: mat.id,
                            variantId: v?.id ?? "",
                            reusableM2: 0,
                          });
                        }}
                      >
                        {catalog.materials.map((m) => (
                          <option
                            key={m.id}
                            value={m.id}
                            disabled={m.archived || m.active === false}
                          >
                            {m.name} · USD/{m.unit}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Varyant / genişlik
                      <select
                        value={u.variantId}
                        onChange={(e) =>
                          changeMaterial(u.id, {
                            variantId: e.target.value,
                            reusableM2: 0,
                          })
                        }
                      >
                        <option value="">Uygun varyant seçin</option>
                        {m?.variants.map((v) => (
                          <option
                            key={v.id}
                            value={v.id}
                            disabled={
                              !v.inStock ||
                              v.archived ||
                              v.needsConfirmation ||
                              (m.roll && v.widthCm < needed)
                            }
                          >
                            {v.name} ·{" "}
                            {!v.inStock
                              ? "Stok yok"
                              : m.roll && v.widthCm < needed
                                ? "Uygun değil"
                                : v.usdCost === null
                                  ? "USD maliyeti gerekli"
                                  : `${v.usdCost} USD/${m.unit}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {m?.roll && (
                    <div
                      className="roll-options"
                      role="group"
                      aria-label={`${i + 1}. malzeme rulo alternatifleri`}
                    >
                      {m.variants.map((v) => {
                        const valid =
                          v.inStock &&
                          !v.archived &&
                          !v.needsConfirmation &&
                          v.widthCm >= needed;
                        return (
                          <button
                            key={v.id}
                            className={`roll-option ${valid ? "suitable" : "unsuitable"} ${u.variantId === v.id ? "chosen" : ""}`}
                            disabled={!valid}
                            onClick={() =>
                              changeMaterial(u.id, {
                                variantId: v.id,
                                reusableM2: 0,
                              })
                            }
                          >
                            <span>{v.widthCm} cm</span>
                            <small>
                              {!v.inStock
                                ? "Stok yok"
                                : valid
                                  ? "Uygun"
                                  : "Dar"}
                            </small>
                            {valid && v.usdCost !== null && (
                              <small>
                                {money(
                                  (m.unit === "metretül"
                                    ? (u.heightCm + u.top + u.bottom) / 100
                                    : (v.widthCm *
                                        (u.heightCm + u.top + u.bottom)) /
                                      10000) *
                                    u.quantity *
                                    v.usdCost,
                                  "USD",
                                )}{" "}
                                toplam
                              </small>
                            )}
                            {valid ? (
                              <CheckCircle2 size={13} />
                            ) : (
                              <AlertTriangle size={13} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="material-dimensions">
                    {(
                      [
                        "widthCm",
                        "heightCm",
                        "quantity",
                        "left",
                        "right",
                        "top",
                        "bottom",
                      ] as const
                    ).map((key, index) => (
                      <label key={key}>
                        {
                          [
                            "Baskı eni (cm)",
                            "Baskı boyu (cm)",
                            "Adet",
                            "Sol pay (cm)",
                            "Sağ pay (cm)",
                            "Üst pay (cm)",
                            "Alt pay (cm)",
                          ][index]
                        }
                        <NumericInput
                          min={key === "quantity" ? 1 : 0}
                          step={key === "quantity" ? 1 : 0.1}
                          value={u[key]}
                          onChange={(e) =>
                            changeMaterial(u.id, {
                              [key]: numericValue(e.target.value),
                              reusableM2: 0,
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <p className="help">
                    Gereken ölçü:{" "}
                    <b>
                      {needed} × {u.heightCm + u.top + u.bottom} cm
                    </b>
                    . Paylar her kenar için ayrı uygulanır.
                  </p>
                  {consumption && (
                    <>
                      <div className="consumption-visual">
                        <div className="roll-canvas">
                          <div
                            className="print-area"
                            style={{
                              width: `${Math.min(100, (u.widthCm / Math.max(consumption.rollWidthCm, needed)) * 100)}%`,
                            }}
                          >
                            Baskı
                          </div>
                          <div className="unused-area">
                            <Scissors size={15} />
                          </div>
                        </div>
                        <div className="consumption-stats">
                          <div>
                            <small>USD birim alış maliyeti</small>
                            <b>{consumption.unitCostUsd.toFixed(4)} USD / {m?.unit}</b>
                          </div>
                          <div>
                            <small>Gerçek tüketim</small>
                            <b>
                              {consumption.consumedUnits.toFixed(4)} {m?.unit}
                            </b>
                          </div>
                          <div>
                            <small>Tüketilen alan</small>
                            <b>{consumption.consumedM2.toFixed(4)} m²</b>
                          </div>
                          <div>
                            <small>Brüt kullanılmayan</small>
                            <b>{consumption.grossUnusedM2.toFixed(4)} m²</b>
                            <small>
                              %
                              {(
                                (consumption.grossUnusedM2 /
                                  consumption.consumedM2) *
                                100
                              ).toFixed(2)}{" "}
                              alan farkı
                            </small>
                          </div>
                          <div>
                            <small>Kenar payı alanı</small>
                            <b>
                              {(
                                (((u.widthCm + u.left + u.right) *
                                  (u.heightCm + u.top + u.bottom) -
                                  u.widthCm * u.heightCm) /
                                  10000) *
                                u.quantity
                              ).toFixed(4)}{" "}
                              m²
                            </b>
                          </div>
                          <div>
                            <small>Yeniden kullanılabilir</small>
                            <b>{consumption.reusableM2.toFixed(4)} m²</b>
                          </div>
                          <div>
                            <small>Net fire / kenar kesimi</small>
                            <b>{consumption.wasteM2.toFixed(4)} m²</b>
                          </div>
                          <div>
                            <small>Malzeme maliyeti</small>
                            <b>{money(consumption.costUsd, "USD")}</b>
                          </div>
                        </div>
                      </div>
                      <p className="help">
                        Brüt kullanılmayan alan otomatik olarak yeniden
                        kullanılabilir kabul edilmez. Kullanılabilir kısmı elle
                        ayırın; tüketim maliyetinden düşülmez.
                      </p>
                    </>
                  )}
                  <label>
                    Yeniden kullanılabilir kalan alan (m²)
                    <NumericInput
                      min="0"
                      step="0.0001"
                      value={u.reusableM2}
                      onChange={(e) =>
                        changeMaterial(u.id, {
                          reusableM2: numericValue(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
              );
            })}
          </section>
          <section className="panel form-panel expense-panel">
            <div className="section-title">
              <span>
                <Coins size={18} />
              </span>
              <div>
                <h2>Giderler</h2>
                <p>Her kalem: miktar × USD birim tutarı.</p>
              </div>
            </div>
            <div className="expense-chips">
              {catalog.expenses.map((t) => (
                <button
                  key={t.id}
                  onClick={() =>
                    update({
                      expenses: [
                        ...input.expenses,
                        {
                          id: createId(),
                          typeId: t.id,
                          name: t.name,
                          unit: t.unit,
                          usdAmount: t.usdAmount,
                          quantity: 1,
                        },
                      ],
                    })
                  }
                >
                  <Plus size={12} />
                  {t.name}
                </button>
              ))}
            </div>
            {input.expenses.map((e, i) => (
              <div key={e.id} className="expense-use">
                <label>
                  Gider {i + 1}
                  <input
                    value={e.name}
                    onChange={(ev) =>
                      update({
                        expenses: input.expenses.map((x) =>
                          x.id === e.id ? { ...x, name: ev.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Birim
                  <input
                    value={e.unit}
                    onChange={(ev) =>
                      update({
                        expenses: input.expenses.map((x) =>
                          x.id === e.id ? { ...x, unit: ev.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Miktar
                  <NumericInput
                    min="0"
                    step="0.01"
                    value={e.quantity}
                    onChange={(ev) =>
                      update({
                        expenses: input.expenses.map((x) =>
                          x.id === e.id
                            ? { ...x, quantity: numericValue(ev.target.value) }
                            : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  USD / birim
                  <NumericInput
                    min="0"
                    step="0.000001"
                    value={e.usdAmount}
                    onChange={(ev) =>
                      update({
                        expenses: input.expenses.map((x) =>
                          x.id === e.id
                            ? { ...x, usdAmount: numericValue(ev.target.value) }
                            : x,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  className="icon-button"
                  aria-label={`${i + 1}. gideri kaldır`}
                  onClick={() =>
                    update({
                      expenses: input.expenses.filter((x) => x.id !== e.id),
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              className="text-button"
              onClick={() =>
                update({
                  expenses: [
                    ...input.expenses,
                    {
                      id: createId(),
                      typeId: "custom",
                      name: "Yeni gider",
                      unit: "iş",
                      quantity: 1,
                      usdAmount: 0,
                    },
                  ],
                })
              }
            >
              <Plus size={14} />
              Yeni gider ekle
            </button>
          </section>
        </div>
        <aside className="panel pricing-result">
          <div className="section-title">
            <span>
              <TrendingUp size={19} />
            </span>
            <div>
              <h2>Fiyatlandırma</h2>
              <p>Maliyet → kâr → satış fiyatı</p>
            </div>
          </div>
          <div className="summary-row">
            <span>Malzeme USD</span>
            <b>{result ? money(result.materialCostUsd, "USD") : "—"}</b>
          </div>
          <div className="summary-row">
            <span>Üretim gideri USD</span>
            <b>{result ? money(result.expenseCostUsd, "USD") : "—"}</b>
          </div>
          <div className="usd-cost">
            <small>TOPLAM USD MALİYETİ</small>
            <strong>{result ? money(result.totalCostUsd, "USD") : "—"}</strong>
          </div>
          <div className="summary-row">
            <span>
              {rate?.source === "manual" ? "Manuel kur" : "TCMB USD/TRY"}
            </span>
            <b>{rate?.value.toFixed(4) ?? "Kur gerekli"}</b>
          </div>
          <div className="summary-row">
            <span>Toplam TL maliyeti</span>
            <b>{rate && result ? money(result.costTry) : "—"}</b>
          </div>
          <label>
            Fiyatlandırma yöntemi
            <select
              value={input.method}
              onChange={(e) =>
                update({ method: e.target.value as PricingInput["method"] })
              }
            >
              <option value="margin">Brüt kâr marjı</option>
              <option value="markup">Maliyet üzerine kâr ekleme</option>
            </select>
          </label>
          <label className="mt">
            Hedef kâr {input.method === "margin" ? "marjı" : "ekleme"} (%)
            <NumericInput
              min="0"
              max={input.method === "margin" ? 99.99 : 10000}
              step="0.1"
              value={input.targetPercent}
              onChange={(e) =>
                update({ targetPercent: numericValue(e.target.value) })
              }
            />
          </label>
          <div className="recommended-price">
            <span>ÖNERİLEN SATIŞ · KDV HARİÇ</span>
            <strong>
              {rate && result
                ? money(result.suggestedNetUsd * rate.value)
                : "Kur gerekli"}
            </strong>
            <small>{result ? money(result.suggestedNetUsd, "USD") : "—"}</small>
          </div>
          <label>
            Manuel net satış fiyatı (TL)
            <NumericInput
              min="0"
              step="0.01"
              disabled={!rate}
              placeholder="Boş bırakılırsa önerilen fiyat"
              value={
                input.manualNetUsd === null
                  ? ""
                  : Number((input.manualNetUsd * (rate?.value ?? 1)).toFixed(2))
              }
              onChange={(e) =>
                update({
                  manualNetUsd:
                    e.target.value === ""
                      ? null
                      : numericValue(e.target.value) / (rate?.value ?? 1),
                })
              }
            />
          </label>
          <div className="actual-margin">
            <span>
              Gerçek kâr: {result ? money(result.profitUsd, "USD") : "—"}
            </span>
            <b className={(result?.actualMargin ?? 0) < 0 ? "error" : ""}>
              Marj %{result ? result.actualMargin.toFixed(2) : "—"}
            </b>
            <small>
              Maliyet üstü kâr %{result ? result.actualMarkup.toFixed(2) : "—"}
            </small>
          </div>
          <label>
            KDV (%)
            <select
              value={input.vat}
              onChange={(e) => update({ vat: numericValue(e.target.value) })}
            >
              {[0, 1, 10, 20].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <div className="summary-row">
            <span>KDV</span>
            <b>{rate && result ? money(result.vatTry) : "—"}</b>
          </div>
          <div className="summary-total">
            <span>KDV dahil genel toplam</span>
            <strong>{rate && result ? money(result.totalTry) : "—"}</strong>
          </div>
          {(calculationError || error) && (
            <p className="error" role="alert">
              {calculationError || error}
            </p>
          )}
          <Button
            disabled={
              !rate || !!calculationError || !result || result.chosenNetUsd <= 0
            }
            onClick={() => {
              try {
                if (!rate) throw new Error("Kur gerekli.");
                onApply(pricingSnapshot(input, catalog, rate, user.name));
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <CheckCircle2 size={16} /> Fiyatı ve maliyeti sabitle
          </Button>
          <p className="help">
            Kur, malzemeler ve giderler birlikte kopyalanır. Sonraki maliyet
            değişiklikleri bu kaydı değiştirmez.
          </p>
        </aside>
      </div>
    </div>
  );
}
