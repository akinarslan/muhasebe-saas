"use client";
import { useState } from "react";
import { Calculator, Layers, FileCheck2, ShieldCheck } from "lucide-react";
import { CostCalculator } from "./cost-calculator";
import { CatalogManager } from "./catalog-manager";
import type {
  CostSnapshot,
  PricingCatalog,
  RateSnapshot,
} from "@/lib/pricing-types";
import { money } from "@/lib/finance";
export interface QuoteArchive {
  id: string;
  name: string;
  snapshot: CostSnapshot;
}
export function PricingWorkspace({
  catalog,
  onCatalogChange,
  rate,
  quotes,
  onSaveQuote,
  initialTab = "calculator",
}: {
  catalog: PricingCatalog;
  onCatalogChange: (c: PricingCatalog) => void;
  rate: RateSnapshot | null;
  quotes: QuoteArchive[];
  onSaveQuote: (s: CostSnapshot) => void;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ÜRETİMDEN KÂRA · USD TABANLI MALİYET</div>
          <h1>
            Maliyet atölyesi<span className="heading-dot">.</span>
          </h1>
          <p>Gerçek tüketimi görün. Fiyatınızı veriye dayanarak belirleyin.</p>
        </div>
        <span className="badge success">
          <ShieldCheck size={13} /> Tarihsel maliyet korunur
        </span>
      </div>
      <div
        className="pricing-tabs"
        role="group"
        aria-label="Maliyet atölyesi bölümleri"
      >
        {[
          { id: "calculator", name: "Maliyet hesaplayıcı", icon: Calculator },
          { id: "materials", name: "Malzemeler ve giderler", icon: Layers },
          { id: "quotes", name: "Teklif arşivi", icon: FileCheck2 },
        ].map(({ id, name, icon: Icon }) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            <Icon size={17} />
            {name}
            {id === "quotes" && <span>{quotes.length}</span>}
          </button>
        ))}
      </div>
      {tab === "calculator" ? (
        <CostCalculator
          catalog={catalog}
          onCatalogChange={onCatalogChange}
          rate={rate}
          onApply={(s) => {
            onSaveQuote(s);
            setTab("quotes");
          }}
        />
      ) : tab === "materials" ? (
        <section className="panel form-panel">
          <CatalogManager catalog={catalog} onChange={onCatalogChange} />
        </section>
      ) : (
        <section className="quote-archive">
          {!quotes.length && (
            <div className="panel empty">
              <FileCheck2 size={32} />
              <b>Henüz maliyet teklifi yok</b>
              <p>
                Hesaplayıcıda fiyatı sabitlediğinizde bağımsız teklif kaydı
                oluşturulur.
              </p>
            </div>
          )}
          {quotes
            .slice()
            .reverse()
            .map((q) => (
              <article className="panel quote-card" key={q.id}>
                <div className="label-row">
                  <span className="icon-tile">
                    <FileCheck2 size={20} />
                  </span>
                  <h2>{q.name}</h2>
                  <span className="badge success">Snapshot</span>
                </div>
                <p className="help">
                  {new Date(q.snapshot.createdAt).toLocaleString("tr-TR")} ·{" "}
                  {q.snapshot.createdBy}
                </p>
                <div className="quote-summary">
                  <div>
                    <small>Toplam USD maliyeti</small>
                    <b>{money(q.snapshot.totalCostUsd, "USD")}</b>
                  </div>
                  <div>
                    <small>Kaydedilen USD/TRY</small>
                    <b>{q.snapshot.rate.value.toFixed(4)}</b>
                  </div>
                  <div>
                    <small>Net satış TL</small>
                    <b>
                      {money(q.snapshot.chosenNetUsd * q.snapshot.rate.value)}
                    </b>
                  </div>
                </div>
                <details>
                  <summary>Malzeme, gider ve kur detayları</summary>
                  <p>
                    {q.snapshot.rate.source === "tcmb"
                      ? "TCMB"
                      : "Yetkili manuel"}{" "}
                    · Yayın: {q.snapshot.rate.publishedAt} · Çekilme:{" "}
                    {new Date(q.snapshot.rate.fetchedAt).toLocaleString(
                      "tr-TR",
                    )}
                  </p>
                  {q.snapshot.materials.map((m) => (
                    <p key={m.use.id}>
                      {m.materialName} / {m.variantName}:{" "}
                      {m.consumedUnits.toFixed(4)} {m.unit} × {m.unitCostUsd}{" "}
                      USD = {money(m.costUsd, "USD")}
                    </p>
                  ))}
                  {q.snapshot.expenses.map((e) => (
                    <p key={e.id}>
                      {e.name}: {e.quantity} {e.unit} × {e.usdAmount} USD
                    </p>
                  ))}
                  <p>
                    KDV %{q.snapshot.input.vat} · Genel toplam{" "}
                    {money(
                      q.snapshot.chosenNetUsd *
                        q.snapshot.rate.value *
                        (1 + q.snapshot.input.vat / 100),
                    )}
                  </p>
                </details>
              </article>
            ))}
        </section>
      )}
    </>
  );
}
