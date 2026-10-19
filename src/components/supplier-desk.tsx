"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { SearchField } from "./ui/search-field";
import { createId } from "@/lib/runtime";
import { supplierBusinessDate } from "@/lib/cloud/supplier-date";

type Supplier = {
  id: string;
  activityId: string | null;
  version: number;
  name: string;
  tradeName: string;
  phone: string;
  email: string;
  taxOffice: string;
  taxId: string;
  city: string;
  district: string;
  address: string;
  contact: string;
  defaultCurrency: string;
  leadTimeDays: number;
  notes: string;
  active: boolean;
};
type LinkRow = {
  id: string;
  variantId: string;
  materialName: string;
  variantName: string;
  baseUnit: string;
  supplierSku: string;
  purchaseUnit: string;
  minOrderQty: string;
  leadTimeDays: number;
  active: boolean;
  version: number;
};
type Offer = {
  id: string;
  active: boolean;
  supplierName: string;
  materialName: string;
  variantName: string;
  revision: number;
  originalCurrency: string;
  purchaseUnit: string;
  originalUnitPrice?: string;
  normalizedUsdUnitPrice?: string | null;
  validFrom: string;
  validUntil: string | null;
  offeredOn: string;
  leadTimeDays: number;
  minQty?: string;
  maxQty?: string | null;
  supplierReference?: string;
  notes?: string;
  recordedById: string;
  fxSnapshot?: {
    source?: string;
    publishedAt?: string;
    usdTry?: string;
    reason?: string;
  };
  comparable?: boolean;
  comparisonReason?: string | null;
};
type Material = {
  name: string;
  unit: string;
  variants: { id: string; name: string; active: boolean }[];
};
type Field = {
  key: string;
  label: string;
  options?: { value: string; label: string }[];
  type?: string;
  required?: boolean;
};
type Editor = {
  kind: "supplier" | "link" | "offer";
  id?: string;
  key: string;
  values: Record<string, string>;
};
const units = {
  square_meter: "m²",
  linear_meter: "metre",
  piece: "adet",
  sheet: "levha",
  kilogram: "kg",
  litre: "litre",
};
const unitOptions = Object.entries(units).map(([value, label]) => ({
  value,
  label,
}));
const currencyOptions = ["USD", "TRY", "EUR", "GBP"].map((value) => ({
  value,
  label: value,
}));
const activeOptions = [
  { value: "true", label: "Aktif" },
  { value: "false", label: "Pasif" },
];
const supplierFields: Field[] = [
  { key: "name", label: "Firma adı", required: true },
  { key: "tradeName", label: "Ticari unvan" },
  { key: "phone", label: "Telefon" },
  { key: "email", label: "E-posta", type: "email" },
  { key: "taxOffice", label: "Vergi dairesi" },
  { key: "taxId", label: "Vergi numarası" },
  { key: "city", label: "İl" },
  { key: "district", label: "İlçe" },
  { key: "address", label: "Adres" },
  { key: "contact", label: "Yetkili kişi" },
  {
    key: "defaultCurrency",
    label: "Varsayılan para birimi",
    options: currencyOptions,
  },
  {
    key: "leadTimeDays",
    label: "Termin (gün)",
    type: "number",
    required: true,
  },
  { key: "notes", label: "Açıklamalar" },
  { key: "active", label: "Durum", options: activeOptions },
];
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch(`/api/cloud/workspace/${path}`, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = await r.json();
  if (!r.ok) throw new Error(value.error ?? "SERVICE_UNAVAILABLE");
  return value;
}
const errorMessage = (e: unknown) => {
  const code = e instanceof Error ? e.message : "SERVICE_UNAVAILABLE";
  return (
    (
      {
        FORBIDDEN: "Bu işlem için yetkiniz yok.",
        COST_VIEW_REQUIRED: "Fiyat karşılaştırması için maliyet izni gerekli.",
        VERSION_CONFLICT: "Kayıt değişti. Yenileyin; girdileriniz korunuyor.",
        IDEMPOTENCY_CONFLICT:
          "İstek daha önce farklı içerikle işlendi. Sonucu kontrol edin.",
        SUPPLIER_CONFLICT: "Bu eşleştirme veya istek zaten mevcut.",
        SUPPLIER_VARIANT_ALREADY_LINKED: "Bu varyant tedarikçiye zaten bağlı.",
        UNIT_CONVERSION_REJECTED: "Bu ölçülerle alış birimi dönüştürülemez.",
        INVALID_INPUT: "Alanları ve tarih aralığını kontrol edin.",
        OFFER_RANGE_REJECTED: "Teklif tarihi veya miktar aralığı geçersiz.",
        SUPPLIER_UNAVAILABLE:
          "Tedarikçi veya eşleştirme pasif; yeni fiyat eklenemez.",
        RESULT_LIMIT_NARROW_FILTER: "Sonuç sınırı aşıldı. Filtreyi daraltın.",
      } as Record<string, string>
    )[code] ??
    "İşlem tamamlanmadı. Bulut bağlantısını kontrol edin; girdileriniz korunuyor."
  );
};
const dateNow = supplierBusinessDate;
export function SupplierDesk({
  company,
  activity,
  actions,
  materials,
  onDirtyChange,
}: {
  company: string;
  activity: string;
  actions: string[];
  materials: Material[];
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [rows, setRows] = useState<Supplier[]>([]),
    [q, setQ] = useState(""),
    [status, setStatus] = useState("true"),
    [selected, setSelected] = useState<Supplier | null>(null);
  const [links, setLinks] = useState<LinkRow[]>([]),
    [linkId, setLinkId] = useState(""),
    [offers, setOffers] = useState<Offer[]>([]),
    [history, setHistory] = useState(false);
  const [comparison, setComparison] = useState<Offer[] | null>(null),
    [recommendation, setRecommendation] = useState<string | null>(null),
    [variantId, setVariantId] = useState(""),
    [quantity, setQuantity] = useState("1"),
    [asOf, setAsOf] = useState(dateNow);
  const [editor, setEditor] = useState<Editor | null>(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0);
  const can = (id: string) => actions.includes(id);
  const scope = {
    legalEntityId: company,
    activityId: selected ? selected.activityId : activity || null,
  };
  const query = new URLSearchParams({
    company,
    ...(activity ? { activity } : {}),
  }).toString();
  const variants = materials.flatMap((m) =>
    m.variants
      .filter((v) => v.active)
      .map((v) => ({
        value: v.id,
        label: `${m.name} / ${v.name} (${units[m.unit as keyof typeof units] ?? m.unit})`,
      })),
  );
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(async () => {
      if (!live) return;
      setLoading(true);
      setError("");
      try {
        const v = await request<Supplier[]>(
          `suppliers?${query}&q=${encodeURIComponent(q)}&active=${status}`,
        );
        if (live) setRows(v);
      } catch (e) {
        if (live) {
          setRows([]);
          setError(errorMessage(e));
        }
      } finally {
        if (live) setLoading(false);
      }
    });
    return () => {
      live = false;
    };
  }, [query, q, status, revision]);
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(async () => {
      if (!live) return;
      setLinks([]);
      setLinkId("");
      setOffers([]);
      if (!selected) return;
      try {
        const v = await request<LinkRow[]>(
          `suppliers/${selected.id}/materials?${query}`,
        );
        if (live) {
          setLinks(v);
          setLinkId(v[0]?.id ?? "");
        }
      } catch (e) {
        if (live) setError(errorMessage(e));
      }
    });
    return () => {
      live = false;
    };
  }, [selected, query, revision]);
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(async () => {
      if (!live) return;
      setOffers([]);
      if (!linkId || !actions.includes("supplierOffers.view")) return;
      try {
        const v = await request<Offer[]>(
          `supplier-offers?${query}&link=${linkId}${history ? "&history=1" : ""}`,
        );
        if (live) setOffers(v);
      } catch (e) {
        if (live) setError(errorMessage(e));
      }
    });
    return () => {
      live = false;
    };
  }, [linkId, history, query, revision, actions]);
  const closeEditor = useCallback(() => {
    if (
      busy ||
      (dirty && !window.confirm("Kaydedilmemiş tedarikçi taslağı silinsin mi?"))
    )
      return;
    setEditor(null);
    setDirty(false);
    setError("");
  }, [busy, dirty]);
  function open(kind: Editor["kind"], row?: Supplier | LinkRow) {
    const values: Record<string, string> = {};
    if (kind === "supplier") {
      for (const f of supplierFields)
        values[f.key] =
          row && f.key in row ? String(row[f.key as keyof typeof row]) : "";
      if (!row)
        Object.assign(values, {
          defaultCurrency: "USD",
          leadTimeDays: "0",
          active: "true",
        });
    } else if (kind === "link")
      Object.assign(
        values,
        row ?? {
          variantId: variants[0]?.value ?? "",
          supplierSku: "",
          purchaseUnit: "square_meter",
          minOrderQty: "1",
          leadTimeDays: String(selected?.leadTimeDays ?? 0),
          active: "true",
        },
      );
    else
      Object.assign(values, {
        supplierMaterialId: linkId,
        originalCurrency: selected?.defaultCurrency ?? "USD",
        originalUnitPrice: "",
        purchaseUnit:
          links.find((l) => l.id === linkId)?.purchaseUnit ?? "square_meter",
        minQty: "1",
        maxQty: "",
        offeredOn: dateNow(),
        validFrom: dateNow(),
        validUntil: "",
        supplierReference: "",
        notes: "",
      });
    for (const k of Object.keys(values)) values[k] = String(values[k]);
    setError("");
    setNotice("");
    setDirty(false);
    setEditor({ kind, id: row?.id, key: createId(), values });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editor || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const v = editor.values;
      let path = "",
        body: Record<string, unknown>;
      if (editor.kind === "supplier") {
        path = `suppliers${editor.id ? `/${editor.id}` : ""}`;
        body = Object.fromEntries(supplierFields.map((f) => [f.key, v[f.key]]));
        Object.assign(body, {
          leadTimeDays: Number(v.leadTimeDays),
          active: v.active === "true",
          legalEntityId: company,
          activityId: editor.id
            ? (selected?.activityId ?? null)
            : activity || null,
          ...(editor.id
            ? { version: Number(v.version ?? selected?.version) }
            : { idempotencyKey: editor.key }),
        });
      } else if (editor.kind === "link") {
        path = editor.id
          ? `supplier-materials/${editor.id}`
          : `suppliers/${selected!.id}/materials`;
        body = {
          ...scope,
          supplierSku: v.supplierSku,
          purchaseUnit: v.purchaseUnit,
          minOrderQty: v.minOrderQty,
          leadTimeDays: Number(v.leadTimeDays),
          active: v.active === "true",
          ...(editor.id
            ? { version: Number(v.version) }
            : { variantId: v.variantId, idempotencyKey: editor.key }),
        };
      } else {
        path = "supplier-offers";
        body = {
          ...scope,
          ...v,
          maxQty: v.maxQty || null,
          validUntil: v.validUntil || null,
          idempotencyKey: editor.key,
        };
      }
      const result = await request<{ id: string }>(
        path,
        editor.id ? "PATCH" : "POST",
        body,
      );
      if (editor.kind === "supplier")
        setSelected(await request<Supplier>(`suppliers/${result.id}?${query}`));
      setEditor(null);
      setDirty(false);
      setRevision((n) => n + 1);
      setComparison(null);
      setNotice("Kayıt buluta kaydedildi.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const fields: Field[] =
    editor?.kind === "supplier"
      ? supplierFields
      : editor?.kind === "link"
        ? [
            ...(!editor.id
              ? [
                  {
                    key: "variantId",
                    label: "Malzeme varyantı",
                    options: variants,
                  },
                ]
              : []),
            { key: "supplierSku", label: "Tedarikçi ürün kodu" },
            { key: "purchaseUnit", label: "Alış birimi", options: unitOptions },
            {
              key: "minOrderQty",
              label: "Minimum sipariş miktarı",
              required: true,
            },
            {
              key: "leadTimeDays",
              label: "Tahmini teslimat (gün)",
              type: "number",
              required: true,
            },
            {
              key: "active",
              label: "Eşleştirme durumu",
              options: activeOptions,
            },
          ]
        : [
            {
              key: "supplierMaterialId",
              label: "Eşleştirme",
              options: links
                .filter((l) => l.active)
                .map((l) => ({
                  value: l.id,
                  label: `${l.materialName} / ${l.variantName}`,
                })),
            },
            {
              key: "originalCurrency",
              label: "Teklif para birimi",
              options: currencyOptions,
            },
            {
              key: "originalUnitPrice",
              label: "Orijinal birim fiyat",
              required: true,
            },
            {
              key: "purchaseUnit",
              label: "Teklif birimi",
              options: unitOptions,
            },
            { key: "minQty", label: "Miktar eşiği (dahil)", required: true },
            { key: "maxQty", label: "Üst miktar (hariç, isteğe bağlı)" },
            {
              key: "offeredOn",
              label: "Teklif tarihi",
              type: "date",
              required: true,
            },
            {
              key: "validFrom",
              label: "Geçerlilik başlangıcı",
              type: "date",
              required: true,
            },
            {
              key: "validUntil",
              label: "Geçerlilik bitişi (hariç)",
              type: "date",
            },
            { key: "supplierReference", label: "Tedarikçi referansı" },
            { key: "notes", label: "Teklif açıklaması" },
          ];
  function offerTable(values: Offer[], comparing = false) {
    const validityDate = comparing ? asOf : dateNow();
    return (
      <div className="table-scroll">
        <table className="cloud-table">
          <thead>
            <tr>
              <th>Tedarikçi / sürüm</th>
              <th>Orijinal fiyat / birim</th>
              <th>USD / temel birim</th>
              <th>Geçerlilik / termin</th>
              <th>Kaynak / durum</th>
            </tr>
          </thead>
          <tbody>
            {values.map((r) => (
              <tr key={r.id}>
                <td>
                  {!r.active &&
                    r.validUntil &&
                    r.validUntil <= validityDate && (
                      <strong>Süresi dolmuş · </strong>
                    )}
                  {r.supplierName} · v{r.revision}
                  <small>
                    {r.materialName} / {r.variantName}
                  </small>
                  {recommendation === r.id && comparing && (
                    <strong>Karşılaştırılabilir en düşük fiyat</strong>
                  )}
                </td>
                <td>
                  {r.originalUnitPrice === undefined
                    ? "Fiyat yetkisi yok"
                    : `${r.originalUnitPrice} ${r.originalCurrency}`}{" "}
                  / {units[r.purchaseUnit as keyof typeof units]}
                  {r.minQty && (
                    <small>
                      {r.minQty} ≤ miktar {r.maxQty ? `< ${r.maxQty}` : ""}
                    </small>
                  )}
                </td>
                <td>
                  {r.originalUnitPrice === undefined
                    ? "Gizli"
                    : (r.normalizedUsdUnitPrice ?? "Hesaplanamaz")}
                </td>
                <td>
                  {r.validFrom} – {r.validUntil ?? "açık"}
                  <small>
                    {r.leadTimeDays} gün · Teklif: {r.offeredOn}
                  </small>
                </td>
                <td>
                  {r.comparisonReason
                    ? ((
                        {
                          INACTIVE: "Pasif",
                          NOT_YET_VALID: "Henüz geçerli değil",
                          EXPIRED: "Süresi dolmuş",
                          SUPERSEDED: "Yeni sürümü var",
                          UNIT_UNAVAILABLE: "Birim karşılaştırılamıyor",
                          FX_UNAVAILABLE: "Doğrulanmış tarihli kur yok",
                          QUANTITY_TIER_MISMATCH: "Miktar eşiği karşılanmıyor",
                          OFFER_DATE_AFTER_COMPARISON:
                            "Teklif tarihi seçilen tarihten sonra",
                        } as Record<string, string>
                      )[r.comparisonReason] ?? "Karşılaştırılamıyor")
                    : !r.active
                      ? "Pasif"
                      : r.validFrom > validityDate
                        ? "Henüz geçerli değil"
                        : r.validUntil && r.validUntil <= validityDate
                          ? "Süresi dolmuş"
                          : "Geçerli"}
                  <small>
                    {r.fxSnapshot?.source === "tcmb"
                      ? "TCMB USD döviz satış"
                      : r.fxSnapshot?.source === "identity"
                        ? "USD (dönüşümsüz)"
                        : r.fxSnapshot?.reason
                          ? "Kur kaynağı/tarihi doğrulanamadı"
                          : ""}{" "}
                    {r.fxSnapshot?.publishedAt ?? ""}
                  </small>
                  {r.supplierReference && (
                    <small>Ref: {r.supplierReference}</small>
                  )}
                  <small>Kaydeden: {r.recordedById}</small>
                  {r.notes && <small>{r.notes}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!values.length && <p>Teklif kaydı yok.</p>}
      </div>
    );
  }
  return (
    <section aria-label="Tedarikçi yönetimi" className="supplier-module">
      <div className="cloud-toolbar">
        <SearchField
          label="Tedarikçi ara"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label>
          Aktiflik
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tümü</option>
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </select>
        </label>
        <Button
          variant="outline"
          onClick={() => setRevision((n) => n + 1)}
          aria-label="Tedarikçileri yenile"
        >
          <RefreshCw size={16} />
        </Button>
        {can("suppliers.create") && (
          <Button onClick={() => open("supplier")}>
            <Plus size={16} />
            Yeni tedarikçi
          </Button>
        )}
      </div>
      {error && !editor && (
        <p role="alert" className="cloud-alert error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="cloud-alert">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Tedarikçiler yükleniyor…</p>
      ) : (
        <div className="table-scroll">
          <table className="cloud-table">
            <thead>
              <tr>
                <th>Firma</th>
                <th>İletişim</th>
                <th>Şehir</th>
                <th>Termin</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.name}
                    <small>{r.tradeName}</small>
                  </td>
                  <td>
                    {r.phone}
                    <small>{r.email}</small>
                  </td>
                  <td>
                    {r.city} / {r.district}
                  </td>
                  <td>{r.leadTimeDays} gün</td>
                  <td>{r.active ? "Aktif" : "Pasif"}</td>
                  <td>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelected(r);
                        setComparison(null);
                      }}
                    >
                      Detay: {r.name}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !error && <p>Bu filtrede tedarikçi bulunamadı.</p>}
        </div>
      )}
      {selected && (
        <section className="supplier-detail" aria-label="Tedarikçi detayı">
          <div className="cloud-toolbar">
            <h3>{selected.name}</h3>
            {can("suppliers.edit") && (
              <Button
                variant="outline"
                onClick={() => open("supplier", selected)}
              >
                Tedarikçiyi düzenle
              </Button>
            )}
          </div>
          <p>
            {selected.tradeName} · {selected.contact} · {selected.address} ·{" "}
            {selected.defaultCurrency}
          </p>
          <p>
            Vergi: {selected.taxOffice} / {selected.taxId} · {selected.notes}
          </p>
          <h4>Malzeme eşleştirmeleri</h4>
          {can("supplierMaterials.manage") && selected.active && (
            <Button onClick={() => open("link")}>Malzeme bağla</Button>
          )}
          <ul>
            {links.map((l) => (
              <li key={l.id}>
                {l.materialName} / {l.variantName} · {l.supplierSku} ·{" "}
                {l.minOrderQty} {units[l.purchaseUnit as keyof typeof units]} ·{" "}
                {l.active ? "Aktif" : "Pasif"}{" "}
                {can("supplierMaterials.manage") && (
                  <Button variant="outline" onClick={() => open("link", l)}>
                    Eşleştirmeyi düzenle: {l.variantName}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <h4>Fiyat teklifleri</h4>
          <label>
            Teklif malzemesi
            <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
              <option value="">Seçin</option>
              {links.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.materialName} / {l.variantName}
                </option>
              ))}
            </select>
          </label>
          {can("supplierOffers.history") && (
            <label className="supplier-history-toggle">
              <input
                type="checkbox"
                checked={history}
                onChange={(e) => setHistory(e.target.checked)}
              />
              Tüm fiyat geçmişini göster
            </label>
          )}
          {can("supplierOffers.create") &&
            can("supplierOffers.costView") &&
            selected.active &&
            linkId && (
              <Button onClick={() => open("offer")}>Yeni teklif sürümü</Button>
            )}
          <p>
            Tedarikçi teklifi, malzemenin manuel USD ana maliyetini değiştirmez.
          </p>
          {offerTable(offers)}
        </section>
      )}
      {can("supplierOffers.costView") && (
        <section
          aria-label="Tedarikçi fiyat karşılaştırması"
          className="supplier-comparison-panel"
        >
          <h3>Malzeme bazlı karşılaştırma</h3>
          <form
            className="supplier-compare"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              setComparison(null);
              try {
                const r = await request<{
                  rows: Offer[];
                  recommendationId: string | null;
                }>(
                  `supplier-comparison?${query}&variant=${variantId}&quantity=${encodeURIComponent(quantity)}&asOf=${asOf}`,
                );
                setComparison(r.rows);
                setRecommendation(r.recommendationId);
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Karşılaştırma varyantı
              <select
                required
                disabled={busy}
                value={variantId}
                onChange={(e) => {
                  setVariantId(e.target.value);
                  setComparison(null);
                  setRecommendation(null);
                }}
              >
                <option value="">Seçin</option>
                {variants.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Temel birim miktarı
              <input
                required
                disabled={busy}
                value={quantity}
                inputMode="decimal"
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setComparison(null);
                  setRecommendation(null);
                }}
              />
            </label>
            <label>
              Karşılaştırma tarihi
              <input
                required
                disabled={busy}
                type="date"
                value={asOf}
                onChange={(e) => {
                  setAsOf(e.target.value);
                  setComparison(null);
                  setRecommendation(null);
                }}
              />
            </label>
            <Button disabled={busy || !variantId}>Fiyatları karşılaştır</Button>
          </form>
          <p>
            Yalnız geçerli, miktar eşiğini karşılayan ve aynı temel birime
            dönüştürülebilen fiyatlar sıralanır. USD karşılığı teklif kaydının
            tarihli kurudur; eski teklifler bugünkü kura çevrilmez. EUR/GBP
            doğrulanmış kaynak yoksa hesaplanamaz.
          </p>
          {comparison && offerTable(comparison, true)}
        </section>
      )}
      <Dialog.Root
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="cloud-overlay" />
          <Dialog.Content
            className="cloud-drawer"
            aria-describedby="supplier-form-description"
          >
            <Dialog.Title>
              {editor?.kind === "supplier"
                ? editor.id
                  ? "Tedarikçi düzenle"
                  : "Yeni tedarikçi"
                : editor?.kind === "link"
                  ? "Tedarikçi malzemesi"
                  : "Yeni teklif sürümü"}
            </Dialog.Title>
            <Dialog.Description id="supplier-form-description">
              {editor?.kind === "offer"
                ? "Yeni sürüm kaydedilir; önceki fiyat ve manuel malzeme maliyeti korunur."
                : "Bilgiler yalnız seçili şirket kapsamında buluta kaydedilir."}
            </Dialog.Description>
            <button
              type="button"
              aria-label="Tedarikçi formunu kapat"
              className="cloud-close"
              onClick={closeEditor}
            >
              <X />
            </button>
            {error && (
              <p role="alert" className="cloud-alert error">
                {error}
              </p>
            )}
            <form onSubmit={save} className="supplier-form">
              {editor &&
                fields.map((f) => (
                  <label key={f.key}>
                    {f.label}
                    {f.options ? (
                      <select
                        required
                        disabled={busy}
                        value={editor.values[f.key] ?? ""}
                        onChange={(e) => {
                          setDirty(true);
                          setEditor({
                            ...editor,
                            values: {
                              ...editor.values,
                              [f.key]: e.target.value,
                            },
                          });
                        }}
                      >
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        required={f.required}
                        disabled={busy}
                        type={f.type ?? "text"}
                        inputMode={
                          /Qty|Price/.test(f.key) ? "decimal" : undefined
                        }
                        min={f.type === "number" ? 0 : undefined}
                        value={editor.values[f.key] ?? ""}
                        onChange={(e) => {
                          setDirty(true);
                          setEditor({
                            ...editor,
                            values: {
                              ...editor.values,
                              [f.key]: e.target.value,
                            },
                          });
                        }}
                      />
                    )}
                  </label>
                ))}
              <div className="cloud-toolbar">
                <Button type="button" variant="outline" onClick={closeEditor}>
                  Vazgeç
                </Button>
                <Button disabled={busy}>
                  {busy
                    ? "Kaydediliyor…"
                    : editor?.kind === "supplier"
                      ? "Tedarikçiyi kaydet"
                      : editor?.kind === "link"
                        ? "Eşleştirmeyi kaydet"
                        : "Teklif sürümünü kaydet"}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
