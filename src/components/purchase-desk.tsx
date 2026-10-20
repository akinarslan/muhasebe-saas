"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { SearchField } from "./ui/search-field";
import { StepUpVerification } from "./step-up-verification";
import { createId } from "@/lib/runtime";

type SummaryRow = {
  id: string;
  activityId: string | null;
  supplierId: string;
  supplierName: string;
  businessNo: string;
  revision: number;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  version: number;
  lineCount: number;
};
type DetailLine = {
  id: string;
  lineNo: number;
  supplierMaterialId: string;
  offerVersionId: string | null;
  variantId: string;
  supplierId: string;
  supplierSku: string;
  variantName: string;
  materialName: string;
  orderedQty: string;
  purchaseUnit: string;
  orderedBaseQty: string;
  baseUnit: string;
  expectedDate: string | null;
  priceSource: string | null;
  offerRevision: number | null;
  originalCurrency?: string | null;
  originalUnitPrice?: string | null;
  normalizedUsdUnitPrice?: string | null;
  lineTotalUsd?: string | null;
  variantUsdCost?: string | null;
  fxSnapshot?: unknown;
};
type DetailRow = SummaryRow & {
  revisesOrderId: string | null;
  approvedById: string | null;
  totalUsd?: string | null;
  pendingLines?: number;
  lines: DetailLine[];
};
type SupplierLite = {
  id: string;
  activityId: string | null;
  name: string;
  tradeName: string;
  defaultCurrency: string;
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
};
type OfferLite = {
  id: string;
  revision: number;
  originalCurrency: string;
  originalUnitPrice?: string | null;
  purchaseUnit: string;
  minQty: string;
  maxQty: string | null;
  validFrom: string;
  validUntil: string | null;
  offeredOn: string;
};
type DraftLine = {
  preserveLineId?: string;
  supplierMaterialId: string;
  offerVersionId: string | null;
  orderedQty: string;
  purchaseUnit: string;
  expectedDate: string;
  manualCurrency: string;
  manualUnitPrice: string;
};
type DraftEditor = {
  id?: string;
  version?: number;
  key: string;
  supplierId: string;
  lines: DraftLine[];
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
const statusOptions = [
  { value: "", label: "Tümü" },
  { value: "DRAFT", label: "Taslak" },
  { value: "APPROVED", label: "Onaylandı" },
  { value: "CANCELLED", label: "İptal" },
  { value: "CLOSED", label: "Kapandı" },
];
const statusText = (status: string) =>
  (
    Object.fromEntries(
      statusOptions.slice(1).map((s) => [s.value, s.label]),
    ) as Record<string, string>
  )[status] ?? status;
const emptyLine: DraftLine = {
  supplierMaterialId: "",
  offerVersionId: null,
  orderedQty: "1",
  purchaseUnit: "square_meter",
  expectedDate: "",
  manualCurrency: "USD",
  manualUnitPrice: "",
};
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
        VERSION_CONFLICT:
          "Kayıt başka bir oturumda değişti. Listeyi yenileyin; girdileriniz korunuyor.",
        ORDER_ALREADY_APPROVED: "Bu sipariş zaten onaylandı.",
        ORDER_NOT_MODIFIABLE:
          "Bu sipariş yalnız taslak durumunda düzenlenebilir; iptal/onay geçişi bu durumda yok.",
        PURCHASE_ORDER_CONFLICT:
          "Aynı sipariş kaydı zaten mevcut veya numara çakışması var.",
        IDEMPOTENCY_CONFLICT:
          "İstek daha önce farklı içerikle işlendi. Sonucu kontrol edin.",
        SUPPLIER_UNAVAILABLE:
          "Tedarikçi veya eşleştirme pasif; sipariş oluşturulamaz.",
        OFFER_UNAVAILABLE:
          "Seçilen teklif artık geçerli değil; satırı kontrol edin.",
        QUANTITY_TIER_MISMATCH:
          "Miktar, teklif eşiğinin dışında; satırı kontrol edin.",
        UNIT_CONVERSION_REJECTED: "Bu birim temel birime dönüştürülemiyor.",
        REVISION_FLOW_PENDING: "Revizyon akışı henüz açık değildir.",
        RESULT_LIMIT_NARROW_FILTER: "Sonuç sınırı aşıldı. Filtreyi daraltın.",
        INVALID_INPUT: "Miktar, fiyat ve tarih alanlarını kontrol edin.",
      } as Record<string, string>
    )[code] ??
    "İşlem tamamlanmadı. Bulut bağlantısını kontrol edin; girdileriniz korunuyor."
  );
};
const scopeBody = (company: string, activityId: string | null) => ({
  legalEntityId: company,
  activityId,
});
export function PurchaseDesk({
  company,
  activity,
  actions,
  onDirtyChange,
}: {
  company: string;
  activity: string;
  actions: string[];
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [rows, setRows] = useState<SummaryRow[]>([]),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [selectedId, setSelectedId] = useState(""),
    [selected, setSelected] = useState<DetailRow | null>(null);
  const [editors, setEditors] = useState<DraftEditor | null>(null),
    [draftSupplier, setDraftSupplier] = useState<SupplierLite[]>([]),
    [links, setLinks] = useState<LinkRow[]>([]),
    [offerCache, setOfferCache] = useState<Record<string, OfferLite[]>>({}),
    [offersBlocked, setOffersBlocked] = useState(false);
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0);
  const [stepUp, setStepUp] = useState(false);
  const can = (id: string) => actions.includes(id);
  const query = new URLSearchParams({
    company,
    ...(activity ? { activity } : {}),
  }).toString();
  const scope = scopeBody(company, activity || null);
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
        const v = await request<SummaryRow[]>(
          `purchase-orders?${query}&q=${encodeURIComponent(q)}${status ? `&status=${status}` : ""}`,
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
      if (!selectedId) {
        setSelected(null);
        return;
      }
      try {
        const v = await request<DetailRow>(
          `purchase-orders/${selectedId}?${query}`,
        );
        if (live) setSelected(v);
      } catch {
        if (live) setSelected(null);
      }
    });
    return () => {
      live = false;
    };
  }, [selectedId, revision, query]);
  useEffect(() => {
    let live = true;
    const canCreate =
      actions.includes("purchases.create") ||
      actions.includes("purchases.edit");
    void Promise.resolve().then(async () => {
      if (!live || !canCreate) return;
      try {
        const v = await request<SupplierLite[]>(
          `suppliers?${query}&active=true`,
        );
        if (live) setDraftSupplier(v);
      } catch {
        /* Draft drawer selects from the loaded list. */
      }
    });
    return () => {
      live = false;
    };
  }, [query, revision, actions]);
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(async () => {
      if (!live) return;
      setLinks([]);
      setOfferCache({});
      if (!editors?.supplierId) return;
      try {
        const v = await request<LinkRow[]>(
          `suppliers/${editors.supplierId}/materials?${query}`,
        );
        if (live) setLinks(v.filter((l) => l.active));
      } catch (e) {
        if (live) setError(errorMessage(e));
      }
    });
    return () => {
      live = false;
    };
  }, [editors?.supplierId, query]);
  const loadOffers = useCallback(
    async (linkId: string) => {
      if (!linkId || offerCache[linkId]) return;
      try {
        const v = await request<OfferLite[]>(
          `supplier-offers?${query}&link=${linkId}`,
        );
        setOfferCache((c) => ({ ...c, [linkId]: v }));
        setOffersBlocked(false);
      } catch {
        setOffersBlocked(true);
      }
    },
    [offerCache, query],
  );
  const closeEditor = useCallback(() => {
    if (
      busy ||
      (dirty && !window.confirm("Kaydedilmemiş sipariş taslağı silinsin mi?"))
    )
      return;
    setEditors(null);
    setDirty(false);
    setError("");
  }, [busy, dirty]);
  useEffect(() => {
    void Promise.resolve().then(() => {
      for (const line of editors?.lines ?? [])
        if (line.offerVersionId) void loadOffers(line.supplierMaterialId);
    });
  }, [editors, loadOffers]);
  function openDraft(detail?: DetailRow) {
    if (detail) {
      setEditors({
        id: detail.id,
        version: detail.version,
        key: createId(),
        supplierId: detail.supplierId,
        lines: detail.lines.map((l) => ({
          ...(!l.offerVersionId && l.originalUnitPrice === undefined
            ? { preserveLineId: l.id }
            : {}),
          supplierMaterialId: l.supplierMaterialId,
          offerVersionId: l.offerVersionId,
          orderedQty: l.orderedQty,
          purchaseUnit: l.purchaseUnit,
          expectedDate: l.expectedDate ?? "",
          manualCurrency: l.originalCurrency ?? "USD",
          manualUnitPrice: l.originalUnitPrice ?? "",
        })),
      });
    } else {
      setEditors({
        key: createId(),
        supplierId: "",
        lines: [{ ...emptyLine }],
      });
    }
    setDirty(false);
    setError("");
    setNotice("");
    setOfferCache({});
    setOffersBlocked(false);
  }
  function setField(line: DraftLine, patch: Partial<DraftLine>) {
    setDirty(true);
    setEditors({
      ...editors!,
      lines: editors!.lines.map((l) => (l === line ? { ...l, ...patch } : l)),
    });
  }
  function setSupplier(value: string) {
    if (!editors) return;
    if (
      editors.lines.some((l) => l.supplierMaterialId) &&
      !window.confirm("Satırlar temizlenecek; devam edilsin mi?")
    )
      return;
    setDirty(true);
    setEditors({ ...editors, supplierId: value, lines: [{ ...emptyLine }] });
  }
  async function saveDraft(e: FormEvent) {
    e.preventDefault();
    if (!editors || busy) return;
    if (!editors.supplierId) {
      setError("Tedarikçi seçin.");
      return;
    }
    const lines = editors.lines.filter((l) => l.supplierMaterialId);
    if (!lines.length) {
      setError("En az bir satır gerekli.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = lines.map((l) =>
        l.preserveLineId
          ? {
              preserveLineId: l.preserveLineId,
              expectedDate: l.expectedDate || null,
            }
          : {
              supplierMaterialId: l.supplierMaterialId,
              offerVersionId: l.offerVersionId,
              orderedQty: l.orderedQty.replace(",", "."),
              purchaseUnit: l.purchaseUnit,
              expectedDate: l.expectedDate || null,
              manualCurrency: l.offerVersionId ? null : l.manualCurrency,
              manualUnitPrice: l.offerVersionId
                ? null
                : l.manualUnitPrice.replace(",", "."),
            },
      );
      if (editors.id) {
        await request<{ id: string; version: number }>(
          `purchase-orders/${editors.id}`,
          "PATCH",
          {
            ...scope,
            version: editors.version,
            lines: payload,
          },
        );
        setSelected(null);
        setNotice("Sipariş taslağı güncellendi.");
      } else {
        const result = await request<{ id: string }>(
          "purchase-orders",
          "POST",
          {
            ...scope,
            supplierId: editors.supplierId,
            idempotencyKey: editors.key,
            lines: payload,
            revisesOrderId: null,
          },
        );
        const detail = await request<DetailRow>(
          `purchase-orders/${result.id}?${query}`,
        );
        setSelectedId(result.id);
        setSelected(detail);
        setNotice("Sipariş taslağı oluşturuldu.");
      }
      setEditors(null);
      setDirty(false);
      setRevision((n) => n + 1);
    } catch (e2) {
      setError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }
  async function act(id: string, kind: "approve" | "cancel") {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request<{ id: string }>(`purchase-orders/${id}/${kind}`, "POST", {
        ...scope,
        version: selected.version,
      });
      const detail = await request<DetailRow>(`purchase-orders/${id}?${query}`);
      setSelected(detail);
      setRevision((n) => n + 1);
      setNotice(
        kind === "approve" ? "Sipariş onaylandı." : "Sipariş iptal edildi.",
      );
    } catch (e) {
      if (
        e instanceof Error &&
        ["STEP_UP_REQUIRED", "MFA_REQUIRED"].includes(e.message)
      )
        setStepUp(true);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function lineCurrencyOptions(line: DraftLine) {
    void line;
    return currencyOptions;
  }
  return (
    <section aria-label="Satın alma siparişleri" className="supplier-module">
      <div className="cloud-toolbar">
        <SearchField
          label="Sipariş ara"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label>
          Durum
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          onClick={() => setRevision((n) => n + 1)}
          aria-label="Siparişleri yenile"
        >
          <RefreshCw size={16} />
        </Button>
        {can("purchases.create") && (
          <Button onClick={() => openDraft()}>
            <Plus size={16} />
            Yeni sipariş
          </Button>
        )}
      </div>
      {error && !editors && (
        <p role="alert" className="cloud-alert error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="cloud-alert">
          {notice}
        </p>
      )}
      <p className="cloud-note">
        Sipariş oluşturmak veya onaylamak stok ve cari kayıt yapmaz; yalnız
        fiyatlandirma anlık görüntüsü kaydedilir. Taslak satırları üzerinde tam
        kontrol sağlanır.
      </p>
      {loading ? (
        <p role="status">Siparişler yükleniyor…</p>
      ) : (
        <div className="table-scroll">
          <table className="cloud-table">
            <thead>
              <tr>
                <th>Sipariş</th>
                <th>Tedarikçi</th>
                <th>Oluşturma</th>
                <th>Durum</th>
                <th>Satır</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.businessNo}
                    <small>Revizyon {r.revision}</small>
                  </td>
                  <td>{r.supplierName}</td>
                  <td>
                    {new Date(r.createdAt).toLocaleDateString("tr")}
                    {r.approvedAt && (
                      <small>
                        Onay: {new Date(r.approvedAt).toLocaleDateString("tr")}
                      </small>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${r.status === "APPROVED" ? "positive" : r.status === "CANCELLED" ? "neutral" : "blue"}`}
                    >
                      {statusText(r.status)}
                    </span>
                  </td>
                  <td>{r.lineCount}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedId(r.id);
                        setNotice("");
                      }}
                    >
                      Detay
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !error && <p>Bu filtrede sipariş bulunamadı.</p>}
        </div>
      )}
      {selected?.lines && (
        <section className="supplier-detail" aria-label="Sipariş detayı">
          <div className="cloud-toolbar">
            <h3>
              {selected.businessNo} · {selected.supplierName}
            </h3>
            {selected.status === "DRAFT" && can("purchases.edit") && (
              <Button variant="outline" onClick={() => openDraft(selected)}>
                Taslağı düzenle
              </Button>
            )}
            {selected.status === "DRAFT" && can("purchases.approve") && (
              <Button
                disabled={busy}
                onClick={() => act(selected.id, "approve")}
              >
                Onayla
              </Button>
            )}
            {(selected.status === "DRAFT" || selected.status === "APPROVED") &&
              can("purchases.cancel") && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => act(selected.id, "cancel")}
                >
                  İptal et
                </Button>
              )}
          </div>
          <p>
            Durum: {statusText(selected.status)} · Revizyon {selected.revision}{" "}
            · Oluşturma: {new Date(selected.createdAt).toLocaleString("tr")}
            {selected.approvedAt
              ? ` · Onay: ${new Date(selected.approvedAt).toLocaleString("tr")}`
              : ""}
          </p>
          {selected.totalUsd !== undefined && (
            <p>
              {selected.pendingLines
                ? `${selected.pendingLines} satır kur bekliyor; toplam hesaplanamaz.`
                : `Sipariş toplamı: ${selected.totalUsd} USD`}
            </p>
          )}
          <div className="table-scroll">
            <table className="cloud-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Malzeme / varyant</th>
                  <th>Kod</th>
                  <th>Miktar</th>
                  <th>Temel miktar</th>
                  <th>Fiyat</th>
                  <th>Teslim</th>
                </tr>
              </thead>
              <tbody>
                {selected.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.lineNo}</td>
                    <td>
                      {l.materialName} / {l.variantName}
                      <small>
                        {l.priceSource === "OFFER"
                          ? `Teklif v${l.offerRevision}`
                          : l.priceSource === "MANUAL"
                            ? "Manuel fiyat"
                            : ""}
                      </small>
                    </td>
                    <td>{l.supplierSku}</td>
                    <td>
                      {l.orderedQty}{" "}
                      {units[l.purchaseUnit as keyof typeof units] ??
                        l.purchaseUnit}
                    </td>
                    <td>
                      {l.orderedBaseQty}{" "}
                      {units[l.baseUnit as keyof typeof units] ?? l.baseUnit}
                    </td>
                    <td>
                      {l.originalUnitPrice === undefined
                        ? "Maliyet yetkisi yok"
                        : `${l.originalUnitPrice ?? ""} ${l.originalCurrency ?? ""}`.trim() ||
                          "Kur doğrulanamadı"}
                      {l.originalUnitPrice !== undefined && (
                        <small>
                          {l.normalizedUsdUnitPrice == null
                            ? "USD karşılığı yok"
                            : `${l.normalizedUsdUnitPrice} USD /temel`}
                          {l.lineTotalUsd != null
                            ? ` · ${l.lineTotalUsd} USD`
                            : ""}
                        </small>
                      )}
                    </td>
                    <td>{l.expectedDate ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected.lines.length === 0 && <p>Satır kaydı bulunamadı.</p>}
        </section>
      )}
      <Dialog.Root open={stepUp} onOpenChange={setStepUp}>
        <Dialog.Portal>
          <Dialog.Overlay className="cloud-overlay" />
          <Dialog.Content className="confirm-dialog">
            <Dialog.Title>Güvenlik doğrulaması</Dialog.Title>
            <Dialog.Description>
              Sipariş onayı için kimliğinizi doğrulayın, sonra onayı yeniden
              deneyin.
            </Dialog.Description>
            <StepUpVerification
              returnLabel="Siparişe dön"
              onVerified={() => setStepUp(false)}
            />
            <Button onClick={() => setStepUp(false)}>Kapat</Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={!!editors}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="cloud-overlay" />
          <Dialog.Content
            className="cloud-drawer"
            aria-describedby="purchase-form-description"
          >
            <Dialog.Title>
              {editors?.id
                ? "Sipariş taslağını düzenle"
                : "Yeni satın alma siparişi"}
            </Dialog.Title>
            <Dialog.Description id="purchase-form-description">
              Satırlar taslaktan çıkarıp yeniden eklenir; onaydan sonra tüm
              anlık görüntüler mühürlenir.
            </Dialog.Description>
            <button
              type="button"
              aria-label="Sipariş formunu kapat"
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
            <form onSubmit={saveDraft} className="supplier-form">
              <label>
                Tedarikçi
                <select
                  required
                  disabled={busy || !!editors?.id}
                  value={editors?.supplierId ?? ""}
                  onChange={(e) => setSupplier(e.target.value)}
                >
                  <option value="">Seçin</option>
                  {draftSupplier.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.tradeName ? ` · ${s.tradeName}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {(editors?.lines.length ?? 0) > 0 && (
                <div className="purchase-lines">
                  <h4>Sipariş satırları</h4>
                  {editors!.lines.map((line, index) => {
                    const link = links.find(
                      (l) => l.id === line.supplierMaterialId,
                    );
                    const offers = link ? (offerCache[link.id] ?? []) : [];
                    return (
                      <fieldset key={index} className="purchase-line">
                        <legend>Satır {index + 1}</legend>
                        <label>
                          Malzeme eşleştirmesi
                          <select
                            required
                            disabled={busy || !!line.preserveLineId}
                            value={line.supplierMaterialId}
                            onChange={(e) => {
                              const next = e.target.value;
                              const nextLink = links.find((l) => l.id === next);
                              setField(line, {
                                supplierMaterialId: next,
                                purchaseUnit:
                                  nextLink?.purchaseUnit ?? "square_meter",
                                offerVersionId: null,
                              });
                              void loadOffers(next);
                            }}
                          >
                            <option value="">Seçin</option>
                            {links.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.materialName} / {l.variantName} (
                                {l.supplierSku})
                              </option>
                            ))}
                          </select>
                        </label>
                        {link &&
                          can("supplierOffers.view") &&
                          !offersBlocked && (
                            <label>
                              Teklif sürümü
                              <select
                                disabled={busy}
                                value={line.offerVersionId ?? ""}
                                onChange={(e) =>
                                  setField(line, {
                                    offerVersionId: e.target.value || null,
                                  })
                                }
                              >
                                <option value="">Manuel fiyat</option>
                                {offers.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    v{o.revision} · {o.originalUnitPrice ?? "-"}{" "}
                                    {o.originalCurrency}/
                                    {units[
                                      o.purchaseUnit as keyof typeof units
                                    ] ?? o.purchaseUnit}{" "}
                                    · {o.minQty} ≤ miktar
                                    {o.maxQty ? ` < ${o.maxQty}` : ""}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        {link && !can("supplierOffers.view") && (
                          <span className="purchase-line-note">
                            Teklif görüntüleme yetkiniz yok; yalnız manuel fiyat
                            kullanılabilir.
                          </span>
                        )}
                        {link && offersBlocked && (
                          <span className="purchase-line-note">
                            Teklif bilgisi yüklenemedi; manuel fiyat girin.
                          </span>
                        )}
                        {link && can("purchases.costView") && (
                          <div className="purchase-manual">
                            <label>
                              Manuel para birimi
                              <select
                                disabled={busy || !!line.offerVersionId}
                                value={line.manualCurrency}
                                onChange={(e) =>
                                  setField(line, {
                                    manualCurrency: e.target.value,
                                  })
                                }
                              >
                                {lineCurrencyOptions(line).map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Manuel birim fiyat
                              <input
                                disabled={busy || !!line.offerVersionId}
                                inputMode="decimal"
                                value={
                                  line.offerVersionId
                                    ? ""
                                    : line.manualUnitPrice
                                }
                                onChange={(e) =>
                                  setField(line, {
                                    manualUnitPrice: e.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                        )}
                        <div className="purchase-manual">
                          <label>
                            Miktar
                            <input
                              required
                              disabled={busy || !!line.preserveLineId}
                              inputMode="decimal"
                              value={line.orderedQty}
                              onChange={(e) =>
                                setField(line, { orderedQty: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Alış birimi
                            <select
                              required
                              disabled={
                                busy ||
                                !!line.preserveLineId ||
                                !!line.offerVersionId
                              }
                              value={line.purchaseUnit}
                              onChange={(e) =>
                                setField(line, { purchaseUnit: e.target.value })
                              }
                            >
                              {unitOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Beklenen teslim (isteğe bağlı)
                            <input
                              type="date"
                              disabled={busy}
                              value={line.expectedDate}
                              onChange={(e) =>
                                setField(line, { expectedDate: e.target.value })
                              }
                            />
                          </label>
                        </div>
                        {editors!.lines.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                              setDirty(true);
                              setEditors({
                                ...editors!,
                                lines: editors!.lines.filter(
                                  (_, i) => i !== index,
                                ),
                              });
                            }}
                          >
                            <Trash2 size={14} />
                            Satırı kaldır
                          </Button>
                        )}
                      </fieldset>
                    );
                  })}
                  {editors!.supplierId && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || editors!.lines.length >= 50}
                      onClick={() => {
                        setDirty(true);
                        setEditors({
                          ...editors!,
                          lines: [...editors!.lines, { ...emptyLine }],
                        });
                      }}
                    >
                      <Plus size={14} />
                      Satır ekle
                    </Button>
                  )}
                </div>
              )}
              <div className="cloud-toolbar">
                <Button type="button" variant="outline" onClick={closeEditor}>
                  Vazgeç
                </Button>
                <Button disabled={busy}>
                  {busy
                    ? "Kaydediliyor…"
                    : editors?.id
                      ? "Taslağı kaydet"
                      : "Sipariş taslağı oluştur"}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
