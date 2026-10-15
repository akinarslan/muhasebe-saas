"use client";
import { useState } from "react";
import { Plus, Layers, History, Save, Coins } from "lucide-react";
import type { CostUnit, PricingCatalog } from "@/lib/pricing-types";
import { updateMaterialCost } from "@/lib/pricing";
import { user } from "@/lib/mock";
import { money } from "@/lib/finance";
import { Button } from "./ui/button";
const units: CostUnit[] = ["m²", "metretül", "adet", "plaka"];
export function CatalogManager({
  catalog,
  onChange,
}: {
  catalog: PricingCatalog;
  onChange: (v: PricingCatalog) => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<CostUnit>("m²");
  const [roll, setRoll] = useState(true);
  const [width, setWidth] = useState(152);
  const [length, setLength] = useState(300);
  const [cost, setCost] = useState("");
  const [error, setError] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [expenseUnit, setExpenseUnit] = useState("iş");
  const [expenseAmount, setExpenseAmount] = useState("");
  function addMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (
      !name.trim() ||
      cost === "" ||
      !Number.isFinite(Number(cost)) ||
      Number(cost) < 0
    ) {
      setError("Malzeme adını ve geçerli USD maliyetini girin.");
      return;
    }
    if ((roll && unit === "plaka") || (!roll && unit === "metretül")) {
      setError("Metretül rulo olmalıdır; plaka rulo olamaz.");
      return;
    }
    const id = crypto.randomUUID();
    let next = {
      ...catalog,
      materials: [
        ...catalog.materials,
        {
          id,
          name: name.trim(),
          unit,
          roll,
          variants: [
            {
              id: `${id}-v1`,
              name: roll
                ? `${width} cm rulo`
                : unit === "plaka"
                  ? `${width} × ${length} cm`
                  : "Standart",
              widthCm: width,
              lengthCm: length,
              inStock: true,
              usdCost: null,
              history: [],
            },
          ],
        },
      ],
    };
    next = updateMaterialCost(next, id, `${id}-v1`, Number(cost), user);
    onChange(next);
    setName("");
    setCost("");
    setError("");
  }
  function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (
      !expenseName.trim() ||
      !expenseUnit.trim() ||
      expenseAmount === "" ||
      !Number.isFinite(Number(expenseAmount)) ||
      Number(expenseAmount) < 0
    ) {
      setError("Gider adı, birimi ve USD tutarı gereklidir.");
      return;
    }
    onChange({
      ...catalog,
      expenses: [
        ...catalog.expenses,
        {
          id: crypto.randomUUID(),
          name: expenseName.trim(),
          unit: expenseUnit.trim(),
          usdAmount: Number(expenseAmount),
        },
      ],
    });
    setExpenseName("");
    setExpenseAmount("");
    setError("");
  }
  return (
    <div className="catalog-manager">
      <div className="section-title">
        <span>
          <Layers size={18} />
        </span>
        <div>
          <h2>Malzeme kütüphanesi</h2>
          <p>
            USD alış maliyetleri sizin kontrolünüzde. Değişiklikler geçmiş
            işlemlere yansımaz.
          </p>
        </div>
      </div>
      <div className="info-box">
        Başlangıç rulo genişlikleri yalnızca ölçü şablonudur. Alış maliyetleri
        boş başlar; eski ZY Reklam listesi fiyat kaynağı değildir.
      </div>
      {catalog.materials.map((m) => (
        <section className="material-family" key={m.id}>
          <div className="label-row">
            <h3>{m.name}</h3>
            <span className="badge neutral">
              USD / {m.unit} · {m.roll ? "Rulo" : "Parça / plaka"}
            </span>
          </div>
          {m.variants.map((v) => (
            <div className="variant-card" key={v.id}>
              <div className="variant-heading">
                <b>{v.name}</b>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={v.inStock}
                    onChange={(e) =>
                      onChange({
                        ...catalog,
                        materials: catalog.materials.map((x) =>
                          x.id === m.id
                            ? {
                                ...x,
                                variants: x.variants.map((y) =>
                                  y.id === v.id
                                    ? { ...y, inStock: e.target.checked }
                                    : y,
                                ),
                              }
                            : x,
                        ),
                      })
                    }
                  />
                  Stokta
                </label>
              </div>
              <form
                className="cost-edit"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  try {
                    onChange(
                      updateMaterialCost(
                        catalog,
                        m.id,
                        v.id,
                        Number(form.get("cost")),
                        user,
                      ),
                    );
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <label>
                  USD alış / {m.unit}
                  <input
                    key={String(v.usdCost)}
                    aria-label={`${m.name} ${v.name} USD maliyeti`}
                    name="cost"
                    type="number"
                    min="0"
                    step="0.000001"
                    required
                    defaultValue={v.usdCost ?? ""}
                    placeholder="Elle girin"
                  />
                </label>
                <Button type="submit" variant="outline" size="sm">
                  <Save size={14} />
                  Maliyeti güncelle
                </Button>
              </form>
              <details className="revision-list">
                <summary>
                  <History size={14} /> Fiyat geçmişi ({v.history.length})
                </summary>
                {v.history.length ? (
                  v.history
                    .slice()
                    .reverse()
                    .map((h) => (
                      <p key={h.id}>
                        {new Date(h.at).toLocaleString("tr-TR")} ·{" "}
                        {h.previous === null
                          ? "İlk kayıt"
                          : money(h.previous, "USD")}{" "}
                        → <b>{money(h.next, "USD")}</b> · {h.userName}
                      </p>
                    ))
                ) : (
                  <p>Henüz fiyat girilmedi.</p>
                )}
              </details>
            </div>
          ))}
          <VariantForm
            onAdd={(v) => {
              const id = crypto.randomUUID();
              const next = {
                ...catalog,
                materials: catalog.materials.map((x) =>
                  x.id === m.id
                    ? {
                        ...x,
                        variants: [
                          ...x.variants,
                          {
                            id,
                            name: v.name,
                            widthCm: v.width,
                            lengthCm: v.length,
                            inStock: true,
                            usdCost: null,
                            history: [],
                          },
                        ],
                      }
                    : x,
                ),
              };
              onChange(updateMaterialCost(next, m.id, id, v.cost, user));
            }}
          />
        </section>
      ))}
      <form onSubmit={addMaterial} className="new-material-form">
        <h3>
          <Plus size={17} /> Yeni malzeme ekle
        </h3>
        <div className="field-grid">
          <label>
            Malzeme adı
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Mat laminasyon"
            />
          </label>
          <label>
            Maliyet birimi
            <select
              value={unit}
              onChange={(e) => {
                const u = e.target.value as CostUnit;
                setUnit(u);
                if (u === "plaka" || u === "adet") setRoll(false);
                if (u === "metretül") setRoll(true);
              }}
            >
              {units.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
          <label>
            Başlangıç USD alış maliyeti
            <input
              required
              type="number"
              min="0"
              step="0.000001"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={roll}
              onChange={(e) => setRoll(e.target.checked)}
            />
            Rulo malzeme
          </label>
          <label>
            Genişlik (cm)
            <input
              type="number"
              min="1"
              required
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </label>
          <label>
            Plaka boyu (cm)
            <input
              type="number"
              min="1"
              required
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
            />
          </label>
        </div>
        <Button type="submit">
          <Plus size={15} /> Malzemeyi ekle
        </Button>
      </form>
      <section className="expense-library">
        <div className="section-title">
          <span>
            <Coins size={18} />
          </span>
          <div>
            <h2>Üretim gideri türleri</h2>
            <p>İstediğiniz tür ve birimi ekleyin. Tutarlar USD cinsindedir.</p>
          </div>
        </div>
        {catalog.expenses.map((exp) => (
          <form
            key={exp.id}
            className="expense-library-row"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const amount = Number(form.get("amount"));
              const unit = String(form.get("unit") ?? "").trim();
              if (!unit || !Number.isFinite(amount) || amount < 0) return;
              onChange({
                ...catalog,
                expenses: catalog.expenses.map((x) =>
                  x.id === exp.id ? { ...x, unit, usdAmount: amount } : x,
                ),
              });
            }}
          >
            <b>{exp.name}</b>
            <label>
              Birim
              <input name="unit" required defaultValue={exp.unit} />
            </label>
            <label>
              USD / birim
              <input
                name="amount"
                type="number"
                step="0.000001"
                min="0"
                required
                defaultValue={exp.usdAmount}
              />
            </label>
            <Button type="submit" variant="outline" size="sm">
              Güncelle
            </Button>
          </form>
        ))}
        <form onSubmit={addExpense} className="new-expense-form">
          <h3>
            <Plus size={17} /> Yeni gider türü ekle
          </h3>
          <div className="field-grid">
            <label>
              Gider adı
              <input
                required
                value={expenseName}
                onChange={(e) => setExpenseName(e.target.value)}
              />
            </label>
            <label>
              Gider birimi
              <input
                required
                value={expenseUnit}
                onChange={(e) => setExpenseUnit(e.target.value)}
                placeholder="saat, m², km…"
              />
            </label>
            <label>
              Varsayılan USD tutarı
              <input
                required
                type="number"
                min="0"
                step="0.000001"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
              />
            </label>
          </div>
          <Button type="submit">
            <Plus size={15} />
            Gider türünü ekle
          </Button>
        </form>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
function VariantForm({
  onAdd,
}: {
  onAdd: (v: {
    name: string;
    width: number;
    length: number;
    cost: number;
  }) => void;
}) {
  return (
    <details className="add-variant">
      <summary>
        <Plus size={14} />
        Yeni varyant ekle
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const values = {
            name: String(f.get("name") ?? "").trim(),
            width: Number(f.get("width")),
            length: Number(f.get("length")),
            cost: Number(f.get("cost")),
          };
          if (
            !values.name ||
            ![values.width, values.length].every(
              (v) => Number.isFinite(v) && v > 0,
            ) ||
            !Number.isFinite(values.cost) ||
            values.cost < 0
          )
            return;
          onAdd(values);
          e.currentTarget.reset();
        }}
      >
        <div className="field-grid">
          <label>
            Varyant adı
            <input name="name" required />
          </label>
          <label>
            Varyant genişliği (cm)
            <input name="width" type="number" min="1" required />
          </label>
          <label>
            Varyant boyu (cm)
            <input
              name="length"
              type="number"
              min="1"
              defaultValue="300"
              required
            />
          </label>
          <label>
            Varyant USD maliyeti
            <input name="cost" type="number" min="0" step="0.000001" required />
          </label>
        </div>
        <Button type="submit" size="sm">
          Varyantı ekle
        </Button>
      </form>
    </details>
  );
}
