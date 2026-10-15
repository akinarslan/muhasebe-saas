"use client";
import { numericValue } from "@/lib/numeric";
import { NumericInput } from "./ui/numeric-input";
import { createId, copyValue } from "@/lib/runtime";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Search,
  Save,
  Package,
  Info,
  Check,
  ChevronRight,
  Calculator,
  X,
  Printer,
  Code2,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { CostCalculator } from "./cost-calculator";
import { initialPricingCatalog } from "@/lib/pricing";
import type { PricingCatalog, RateSnapshot } from "@/lib/pricing-types";
import {
  products,
  segments,
  methods,
  newLine,
  entity,
  tenant,
} from "@/lib/mock";
import {
  lineAmounts,
  money,
  round,
  saleAmounts,
  normalize,
} from "@/lib/finance";
import { draftSchema } from "@/lib/validation";
import type { Customer, Draft, Sale, SaleLine, Product } from "@/lib/types";
import { Button } from "./ui/button";
export function SaleForm({
  draft,
  setDraft,
  customers,
  onNewCustomer,
  onSave,
  catalog = initialPricingCatalog(),
  onCatalogChange = () => {},
  rate = null,
  productCatalog = products,
  onNewProduct = () => {},
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  customers: Customer[];
  onNewCustomer: () => void;
  onSave: (s: Sale) => void;
  catalog?: PricingCatalog;
  onCatalogChange?: (c: PricingCatalog) => void;
  rate?: RateSnapshot | null;
  productCatalog?: Product[];
  onNewProduct?: (p: Product) => void;
}) {
  const [calculating, setCalculating] = useState("");
  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [error, setError] = useState("");
  const update = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const totals = saleAmounts(
    { lines: draft.lines, currency: draft.currency, payments: [] },
    productCatalog,
  );
  const balance = round(Math.max(0, totals.total - draft.paid));
  const planned = round(draft.plans.reduce((s, p) => s + p.amount, 0));
  function changeLine(id: string, patch: Partial<SaleLine>) {
    update({
      lines: draft.lines.map((l) =>
        l.id === id
          ? {
              ...l,
              ...patch,
              ...("quantity" in patch || "width" in patch || "height" in patch
                ? { costSnapshot: undefined }
                : {}),
              ...("price" in patch
                ? { priceOrigin: patch.priceOrigin ?? ("manual" as const) }
                : {}),
            }
          : l,
      ),
    });
  }
  function save() {
    const parsed = draftSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (
      !customers.some(
        (c) => c.id === draft.customerId && c.segment === draft.segment,
      )
    ) {
      setError("Seçili segmente ait bir müşteri seçin.");
      return;
    }
    if (
      draft.lines.some(
        (l) =>
          productCatalog.find((p) => p.id === l.productId)?.activity !==
          draft.activity,
      )
    ) {
      setError("Ürünlerin faaliyeti satış faaliyetiyle eşleşmeli.");
      return;
    }
    if (draft.paid > totals.total) {
      setError("Peşin ödeme satış toplamını aşamaz.");
      return;
    }
    if (draft.plans.length && Math.abs(planned - balance) > 0.01) {
      setError("Ödeme planı toplamı kalan alacağa eşit olmalıdır.");
      return;
    }
    if (!rate || rate.source === "legacy-demo") {
      setError("Satış kaydı için TCMB veya yetkili manuel kur gereklidir.");
      return;
    }
    if (
      draft.lines.some(
        (l) => l.price <= 0 || !l.costSnapshot || l.priceOrigin === "legacy",
      )
    ) {
      setError(
        "Her satır için maliyet hesaplayıcıda fiyatı sabitleyin. Eski taslak fiyatlarını doğrulayın.",
      );
      return;
    }
    const id = `SAT-${Date.now()}`;
    onSave({
      id,
      tenantId: tenant.id,
      legalEntityId: entity.id,
      customerId: draft.customerId,
      activity: draft.activity,
      currency: draft.currency,
      date: draft.date,
      dueDate: draft.dueDate,
      plans: draft.plans,
      payments: draft.paid
        ? [
            {
              id: createId(),
              saleId: id,
              method: draft.method,
              amount: draft.paid,
              date: draft.date,
            },
          ]
        : [],
      notes: draft.notes,
      rateSnapshot: copyValue(rate),
      lines: copyValue(draft.lines),
    });
    setError("");
  }
  return (
    <>
      <div className="breadcrumbs">
        Satışlar <ChevronRight size={13} /> Yeni satış
      </div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SATIŞ YÖNETİMİ</div>
          <h1>
            Yeni satış<span className="heading-dot">.</span>
          </h1>
          <p>
            Müşterinizi seçin, ürünlerinizi ekleyin ve satışınızı oluşturun.
          </p>
        </div>
        <span className="saved-indicator">
          <Check size={15} /> Taslak otomatik saklanır
        </span>
      </div>
      <div className="sale-layout">
        <div className="sale-main">
          <section className="panel form-panel">
            <div className="section-title">
              <span>01</span>
              <div>
                <h2>Satış bilgileri</h2>
                <p>Faaliyet ve müşteri bilgilerini belirleyin.</p>
              </div>
            </div>
            <div className="field-grid">
              <label>
                Faaliyet
                <select
                  value={draft.activity}
                  onChange={(e) => {
                    if (draft.lines.length) {
                      setError(
                        "Faaliyeti değiştirmek için önce mevcut ürün satırlarını kaldırın.",
                      );
                      return;
                    }
                    update({ activity: e.target.value as Draft["activity"] });
                    setError("");
                  }}
                >
                  <option>Reklam</option>
                  <option>Yazılım</option>
                </select>
              </label>
              <label>
                Müşteri segmenti
                <select
                  value={draft.segment}
                  onChange={(e) =>
                    update({
                      segment: e.target.value as Draft["segment"],
                      customerId: "",
                    })
                  }
                >
                  {segments.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="label-row">
              <span>
                Müşteri <span className="error">*</span>
              </span>
              <button className="text-button" onClick={onNewCustomer}>
                <Plus size={14} /> Yeni müşteri
              </button>
            </div>
            <div className="search-field">
              <Search size={17} />
              <input
                aria-label="Müşteri ara"
                placeholder="Müşteri adıyla ara…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Müşteri seçin"
              value={draft.customerId}
              onChange={(e) => {
                const c = customers.find((c) => c.id === e.target.value);
                const due = new Date(draft.date + "T12:00:00");
                due.setDate(due.getDate() + (c?.term ?? 30));
                update({
                  customerId: e.target.value,
                  dueDate: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`,
                });
              }}
            >
              <option value="">Müşteri seçin</option>
              {customers
                .filter(
                  (c) =>
                    c.segment === draft.segment &&
                    (normalize(c.name).includes(normalize(customerSearch)) ||
                      c.id === draft.customerId),
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.city}
                  </option>
                ))}
            </select>
            <div className="field-grid mt">
              <label>
                Satış tarihi
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => update({ date: e.target.value })}
                />
              </label>
              <label>
                Para birimi
                <select
                  value={draft.currency}
                  onChange={(e) =>
                    update({
                      currency: e.target.value as Draft["currency"],
                      lines: draft.lines.map((l) => ({
                        ...l,
                        price: 0,
                        costSnapshot: undefined,
                        priceOrigin: "manual",
                      })),
                    })
                  }
                >
                  <option value="TRY">TRY · Türk lirası</option>
                  <option value="USD">USD · ABD doları</option>
                </select>
              </label>
            </div>
            {draft.currency === "USD" && (
              <p className="help">
                Para birimi değişince fiyatlar yeniden hesaplanmalıdır. Eski
                taslak ve müşteri bilgileri korunur.
              </p>
            )}
          </section>
          <section className="panel form-panel">
            <div className="section-title">
              <span>02</span>
              <div>
                <h2>Ürün ve hizmetler</h2>
                <p>Satış kalemlerinizi ve fiyatlarını düzenleyin.</p>
              </div>
            </div>
            <div className="search-field">
              <Search size={17} />
              <input
                aria-label="Ürün veya hizmet ara"
                placeholder="Katalogda ürün veya hizmet ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="product-catalog">
              {productCatalog
                .filter(
                  (p) =>
                    p.activity === draft.activity &&
                    normalize(p.name).includes(normalize(search)),
                )
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      update({ lines: [...draft.lines, newLine(p)] })
                    }
                  >
                    {p.activity === "Reklam" ? (
                      <Printer size={18} />
                    ) : (
                      <Code2 size={18} />
                    )}
                    {p.name}
                    <Plus size={14} />
                  </button>
                ))}
            </div>
            <details className="new-product">
              <summary>+ Yeni satılabilir ürün / hizmet</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const name = String(f.get("productName") ?? "").trim();
                  if (!name) return;
                  onNewProduct({
                    id: createId(),
                    name,
                    activity: draft.activity,
                    unit: String(f.get("unit") ?? "adet"),
                    print: f.get("print") === "on",
                    price: 0,
                    cost: 0,
                  });
                  e.currentTarget.reset();
                }}
              >
                <div className="field-grid">
                  <label>
                    Yeni ürün adı
                    <input name="productName" required />
                  </label>
                  <label>
                    Satış birimi
                    <input name="unit" defaultValue="adet" required />
                  </label>
                  <label className="inline-check">
                    <input name="print" type="checkbox" />
                    m² ile satılan baskı ürünü
                  </label>
                </div>
                <Button type="submit" variant="outline">
                  Ürünü kataloğa ekle
                </Button>
              </form>
            </details>
            {!draft.lines.length && (
              <div className="empty">
                <Package size={30} />
                <b>İlk satış kaleminizi ekleyin</b>
                <p>Yukarıdaki katalogdan bir ürün veya hizmet seçin.</p>
              </div>
            )}
            {draft.lines.map((l, index) => {
              const p = productCatalog.find((p) => p.id === l.productId);
              const a = lineAmounts(l, p);
              return (
                <div className="sale-line" key={l.id}>
                  <div className="sale-line-heading">
                    <span className="line-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <b>{p?.name}</b>
                    <strong>{money(a.total, draft.currency)}</strong>
                    <button
                      className="icon-button"
                      aria-label={`${p?.name} satırını kaldır`}
                      onClick={() =>
                        update({
                          lines: draft.lines.filter((x) => x.id !== l.id),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <label>
                    Ürün açıklaması
                    <input
                      value={l.description}
                      onChange={(e) =>
                        changeLine(l.id, { description: e.target.value })
                      }
                    />
                  </label>
                  <div className="line-fields">
                    <label>
                      Miktar
                      <NumericInput
                        min="0.01"
                        step="0.01"
                        value={l.quantity}
                        onChange={(e) =>
                          changeLine(l.id, {
                            quantity: numericValue(e.target.value),
                          })
                        }
                      />
                    </label>
                    {p?.print && (
                      <>
                        <label>
                          En (cm)
                          <NumericInput
                            min="1"
                            value={l.width}
                            onChange={(e) =>
                              changeLine(l.id, {
                                width: numericValue(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Boy (cm)
                          <NumericInput
                            min="1"
                            value={l.height}
                            onChange={(e) =>
                              changeLine(l.id, {
                                height: numericValue(e.target.value),
                              })
                            }
                          />
                        </label>
                      </>
                    )}
                    <label>
                      Birim fiyat ({p?.unit})
                      <NumericInput
                        min="0"
                        step="0.01"
                        value={l.price}
                        onChange={(e) =>
                          changeLine(l.id, {
                            price: numericValue(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      İskonto (%)
                      <NumericInput
                        min="0"
                        max="100"
                        value={l.discount}
                        onChange={(e) =>
                          changeLine(l.id, {
                            discount: numericValue(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      KDV (%)
                      <select
                        value={l.vat}
                        onChange={(e) =>
                          changeLine(l.id, {
                            vat: numericValue(e.target.value),
                          })
                        }
                      >
                        {[0, 1, 10, 20].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="line-pricing-status">
                    <Button
                      variant="outline"
                      onClick={() => setCalculating(l.id)}
                    >
                      <Calculator size={16} /> Maliyet ve fiyat hesapla
                    </Button>
                    <span
                      className={`badge ${l.costSnapshot ? "success" : "warning"}`}
                    >
                      {l.costSnapshot
                        ? "Maliyet snapshot’ı hazır"
                        : "Maliyet / fiyat gerekli"}
                    </span>
                  </div>
                  {l.priceOrigin === "legacy" && (
                    <p className="rate-warning">
                      Bu eski taslak fiyatı aktif fiyat kaynağı değildir.
                      Hesaplayıcıda yeniden doğrulayın.
                    </p>
                  )}
                  {l.costSnapshot && (
                    <div className="cost-preview">
                      <Info size={15} />
                      <span>
                        USD maliyet:{" "}
                        <b>{money(l.costSnapshot.totalCostUsd, "USD")}</b> ·
                        Sabitlenen kur:{" "}
                        <b>{l.costSnapshot.rate.value.toFixed(4)}</b> · TL
                        maliyet: <b>{money(a.cost)}</b>
                        <small>
                          Gerçek net kâr:{" "}
                          {money(
                            a.net -
                              (draft.currency === "USD"
                                ? l.costSnapshot.totalCostUsd
                                : a.cost),
                            draft.currency,
                          )}{" "}
                          · Marj %
                          {a.net
                            ? (
                                ((a.net -
                                  (draft.currency === "USD"
                                    ? l.costSnapshot.totalCostUsd
                                    : a.cost)) /
                                  a.net) *
                                100
                              ).toFixed(2)
                            : "0.00"}{" "}
                          ·{" "}
                          {l.costSnapshot.rate.source === "manual"
                            ? "Manuel"
                            : "TCMB"}{" "}
                          {l.costSnapshot.rate.publishedAt}
                        </small>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            <label className="mt">
              Satış notu
              <textarea
                placeholder="Bu satışa özel bir not ekleyin…"
                value={draft.notes}
                onChange={(e) => update({ notes: e.target.value })}
              />
            </label>
          </section>
          <section className="panel form-panel">
            <div className="section-title">
              <span>03</span>
              <div>
                <h2>Tahsilat ve ödeme planı</h2>
                <p>Peşin ödemeyi ve kalan alacağın vadelerini belirleyin.</p>
              </div>
            </div>
            <div className="field-grid">
              <label>
                Tahsilat yöntemi
                <select
                  value={draft.method}
                  onChange={(e) =>
                    update({ method: e.target.value as Draft["method"] })
                  }
                >
                  {methods.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                Peşin ödenen miktar
                <NumericInput
                  min="0"
                  step="0.01"
                  value={draft.paid}
                  onChange={(e) =>
                    update({ paid: numericValue(e.target.value) })
                  }
                />
              </label>
            </div>
            <label className="mt">
              Vade tarihi
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => update({ dueDate: e.target.value })}
              />
            </label>
            <div className="label-row mt">
              <b>Parçalı tahsilat planı</b>
              <button
                className="text-button"
                onClick={() =>
                  update({
                    plans: [
                      ...draft.plans,
                      {
                        id: createId(),
                        method: "Havale/EFT",
                        amount: Math.max(0, round(balance - planned)),
                        dueDate: draft.dueDate,
                      },
                    ],
                  })
                }
              >
                <Plus size={14} /> Ödeme ekle
              </button>
            </div>
            {draft.plans.map((p, i) => (
              <div className="payment-row" key={p.id}>
                <label>
                  Yöntem {i + 1}
                  <select
                    value={p.method}
                    onChange={(e) =>
                      update({
                        plans: draft.plans.map((x) =>
                          x.id === p.id
                            ? {
                                ...x,
                                method: e.target.value as Draft["method"],
                              }
                            : x,
                        ),
                      })
                    }
                  >
                    {methods.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Tutar
                  <NumericInput
                    min="0.01"
                    step="0.01"
                    value={p.amount}
                    onChange={(e) =>
                      update({
                        plans: draft.plans.map((x) =>
                          x.id === p.id
                            ? { ...x, amount: numericValue(e.target.value) }
                            : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Vade
                  <input
                    type="date"
                    value={p.dueDate}
                    onChange={(e) =>
                      update({
                        plans: draft.plans.map((x) =>
                          x.id === p.id ? { ...x, dueDate: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  className="icon-button"
                  aria-label={`${i + 1}. ödemeyi kaldır`}
                  onClick={() =>
                    update({ plans: draft.plans.filter((x) => x.id !== p.id) })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {draft.plans.length > 0 && (
              <p className="help">
                Plan toplamı: {money(planned, draft.currency)} · Planlanmamış:{" "}
                {money(balance - planned, draft.currency)}
              </p>
            )}
          </section>
        </div>
        <aside className="sale-summary panel">
          <div className="panel-heading">
            <h2>Satış özeti</h2>
            <span className="badge neutral">Taslak</span>
          </div>
          <p className="muted">{draft.lines.length} ürün / hizmet kalemi</p>
          <div className="summary-row">
            <span>Ara toplam</span>
            <b>{money(totals.net, draft.currency)}</b>
          </div>
          <div className="summary-row">
            <span>KDV toplamı</span>
            <b>{money(totals.tax, draft.currency)}</b>
          </div>
          <div className="summary-total">
            <span>Genel toplam</span>
            <strong>{money(totals.total, draft.currency)}</strong>
          </div>
          <div className="summary-row">
            <span>Peşin ödeme</span>
            <b className="teal">{money(draft.paid, draft.currency)}</b>
          </div>
          <div className="balance-box">
            <span>Kalan alacak</span>
            <b>{money(balance, draft.currency)}</b>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button onClick={save}>
            <Save size={16} /> Demo satışı kaydet
          </Button>
          <p className="help">
            <Info size={13} /> Bu işlem resmî fatura oluşturmaz. Veriler
            yalnızca tarayıcınızda saklanır.
          </p>
        </aside>
      </div>
      <Dialog.Root
        open={!!calculating}
        onOpenChange={(v) => {
          if (!v) setCalculating("");
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="drawer-overlay" />
          <Dialog.Content className="drawer calculator-drawer">
            <header className="drawer-head">
              <span className="icon-tile">
                <Calculator size={23} />
              </span>
              <div>
                <Dialog.Title>Maliyet ve satış fiyatı</Dialog.Title>
                <Dialog.Description>
                  Malzeme, üretim gideri ve kâr hedefini birlikte hesaplayın.
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="icon-button"
                aria-label="Hesaplayıcıyı kapat"
              >
                <X size={20} />
              </Dialog.Close>
            </header>
            <div className="drawer-body">
              {(() => {
                const line = draft.lines.find((l) => l.id === calculating);
                if (!line) return null;
                return (
                  <CostCalculator
                    key={line.id}
                    catalog={catalog}
                    onCatalogChange={onCatalogChange}
                    rate={rate}
                    initialInput={line.costSnapshot?.input}
                    width={line.width}
                    height={line.height}
                    quantity={line.quantity}
                    vat={line.vat}
                    onApply={(snapshot) => {
                      const area = productCatalog.find(
                        (p) => p.id === line.productId,
                      )?.print
                        ? (line.width * line.height) / 10000
                        : 1;
                      const net =
                        snapshot.chosenNetUsd *
                        (draft.currency === "TRY" ? snapshot.rate.value : 1);
                      const divisor = area * line.quantity;
                      changeLine(line.id, {
                        price: net / divisor,
                        discount: 0,
                        vat: snapshot.input.vat,
                        costSnapshot: snapshot,
                        priceOrigin: "calculator",
                      });
                      setCalculating("");
                    }}
                  />
                );
              })()}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
