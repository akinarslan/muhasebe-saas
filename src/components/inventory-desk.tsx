"use client";
import { useEffect, useState, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import DecimalBase from "decimal.js";
const Decimal = DecimalBase.clone({ precision: 60 });
import { Button } from "./ui/button";
import { StepUpVerification } from "./step-up-verification";
type Line = {
  materialName: string;
  variantName: string;
  id: string;
  lineNo: number;
  orderedQty: string;
  purchaseUnit: string;
  orderedBaseQty: string;
  baseUnit: string;
  acceptedQty: string;
};
type Order = {
  id: string;
  businessNo: string;
  activityId: string | null;
  lines: Line[];
};
type Receipt = {
  id: string;
  orderId: string;
  locationId: string;
  receivedAt: string;
  sourceRef: string;
  status: string;
  version: number;
  lines: {
    orderLineId: string;
    lineNo: number;
    receivedQty: string;
    rejectedQty: string;
    rejectionReason: string;
  }[];
};
type Location = { id: string; code: string; name: string };
type Lot = {
  variantId: string;
  materialName: string;
  variantName: string;
  id: string;
  lotCode: string;
  form: string;
  baseUnit: string;
  initialBaseQty: string;
  widthCm: string | null;
  initialLengthM: string | null;
  balances: {
    locationId: string;
    quantityBase: string;
    areaM2: string | null;
  }[];
  acquisitionSnapshot?: {
    originalCurrency?: string;
    originalUnitPrice?: string;
    lineTotalUsd?: string | null;
  };
};
type Movement = {
  id: string;
  lotId: string;
  quantityDeltaBase: string;
  baseUnit: string;
  createdAt: string;
};
export function InventoryDesk({
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
  const drawerReturn = useRef<HTMLButtonElement | null>(null);
  const can = (s: string) => actions.includes(s);
  const scope = { legalEntityId: company, activityId: activity || null };
  const query = new URLSearchParams({
    company,
    ...(activity ? { activity } : {}),
  });
  const [receipts, setReceipts] = useState<Receipt[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [locations, setLocations] = useState<Location[]>([]),
    [lots, setLots] = useState<Lot[]>([]),
    [movements, setMovements] = useState<Movement[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [open, setOpen] = useState(false),
    [stepUp, setStepUp] = useState(false),
    [dirty, setDirty] = useState(false),
    [edit, setEdit] = useState<Receipt | null>(null),
    [orderId, setOrderId] = useState(""),
    [locationId, setLocationId] = useState(""),
    [date, setDate] = useState(() => new Date().toISOString().slice(0, 10)),
    [reference, setReference] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [quantities, setQuantities] = useState<
      Record<
        string,
        { received: string; rejected: string; reason: string; single: boolean }
      >
    >({}),
    [detail, setDetail] = useState<Lot | null>(null);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(
      "/api/cloud/workspace/" + path + (method === "GET" ? "?" + query : ""),
      {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    const value = await res.json();
    if (!res.ok) throw new Error(value.error ?? "API_UNAVAILABLE");
    return value;
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      can("receipts.view") ? request<Receipt[]>("goods-receipts") : [],
      can("receipts.create") || can("receipts.edit")
        ? request<Order[]>("receipt-orders")
        : [],
      can("stock.view") ? request<Location[]>("stock/locations") : [],
      can("stock.view") ? request<Lot[]>("stock/lots") : [],
      can("stock.movementsView") ? request<Movement[]>("stock/movements") : [],
    ])
      .then(([r, o, l, ls, m]) => {
        if (active) {
          setReceipts(r);
          setOrders(o);
          setLocations(l);
          setLots(ls);
          setMovements(m);
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "API_UNAVAILABLE");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    }; // Each scope mounts a distinct desk; refresh is the explicit reload signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company, activity, refresh]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const selected = orders.find((o) => o.id === orderId);
  function reload() {
    setLoading(true);
    setRefresh((n) => n + 1);
  }
  const change = () => setDirty(true);
  const close = () => {
    if (dirty && !window.confirm("Kaydedilmemiş değişiklikler silinsin mi?"))
      return;
    setOpen(false);
    setDirty(false);
  };
  async function act(r: Receipt, op: string) {
    if (busy) return;
    let reason: string | undefined;
    if (op !== "post") {
      reason =
        window.prompt(
          op === "reverse"
            ? "Ters kayıt gerekçesi (stok geri alınır; kabul geçmişi korunur)"
            : "İptal gerekçesi",
        ) ?? undefined;
      if (!reason || reason.trim().length < 3) return;
    }
    setBusy(true);
    setError("");
    try {
      await request(`goods-receipts/${r.id}/${op}`, "POST", {
        ...scope,
        version: r.version,
        ...(reason ? { reason } : {}),
      });
      setNotice(op === "post" ? "Mal kabul kesinleşti." : "İşlem kaydedildi.");
      reload();
    } catch (e) {
      const m = e instanceof Error ? e.message : "API_UNAVAILABLE";
      setError(m);
      if (m === "STEP_UP_REQUIRED" || m === "MFA_REQUIRED") setStepUp(true);
    } finally {
      setBusy(false);
    }
  }
  function start(r?: Receipt) {
    setError("");
    setNotice("");
    setEdit(r ?? null);
    setOrderId(r?.orderId ?? "");
    setLocationId(r?.locationId ?? "");
    setDate(r?.receivedAt ?? new Date().toISOString().slice(0, 10));
    setReference(r?.sourceRef ?? "");
    setQuantities(
      Object.fromEntries(
        (r?.lines ?? []).map((l) => [
          l.orderLineId,
          {
            received: l.receivedQty,
            rejected: l.rejectedQty,
            reason: l.rejectionReason,
            single: true,
          },
        ]),
      ),
    );
    setKey(crypto.randomUUID());
    setDirty(false);
    setOpen(true);
  }
  return (
    <section aria-label="Mal kabul ve stok">
      <div className="cloud-toolbar">
        <h2>Mal Kabul ve Stok</h2>
        <Button onClick={reload}>Yenile</Button>
        {can("receipts.create") && (
          <Button
            onClick={(event) => {
              drawerReturn.current = event.currentTarget;
              start();
            }}
          >
            Teslim al
          </Button>
        )}
      </div>
      <p>
        Sipariş stok değildir. Kesinleşen kabul tek lot ve değişmez stok
        hareketi oluşturur. Metre ve m² ayrı iki stok değildir.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loading && <p role="status">Yükleniyor…</p>}
      {can("stock.locationsManage") && (
        <form
          className="cloud-toolbar"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const form = e.currentTarget,
              data = new FormData(form);
            setBusy(true);
            try {
              await request("stock/locations", "POST", {
                ...scope,
                code: data.get("code"),
                name: data.get("name"),
              });
              form.reset();
              reload();
            } catch (e) {
              setError(e instanceof Error ? e.message : "API_UNAVAILABLE");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Depo kodu
            <input name="code" required maxLength={30} />
          </label>
          <label>
            Depo adı
            <input name="name" required minLength={2} maxLength={100} />
          </label>
          <Button type="submit" disabled={busy}>
            Depo oluştur
          </Button>
        </form>
      )}
      {can("receipts.view") ? (
        <>
          <h3>Mal kabuller</h3>
          {!loading && !receipts.length && <p>Henüz mal kabul yok.</p>}
          <div className="table-scroll">
            <table className="cloud-table">
              <thead>
                <tr>
                  <th>Belge</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id}>
                    <td>{r.sourceRef || r.id.slice(0, 8)}</td>
                    <td>{r.status}</td>
                    <td>{r.receivedAt}</td>
                    <td>
                      {r.status === "DRAFT" && can("receipts.edit") && (
                        <Button
                          disabled={busy}
                          onClick={(event) => {
                            drawerReturn.current = event.currentTarget;
                            start(r);
                          }}
                        >
                          Taslağı düzenle
                        </Button>
                      )}
                      {r.status === "DRAFT" && can("receipts.post") && (
                        <Button disabled={busy} onClick={() => act(r, "post")}>
                          Kesinleştir
                        </Button>
                      )}
                      {r.status === "DRAFT" && can("receipts.cancel") && (
                        <Button
                          disabled={busy}
                          onClick={() => act(r, "cancel")}
                        >
                          İptal et
                        </Button>
                      )}
                      {r.status === "POSTED" && can("receipts.reverse") && (
                        <Button
                          disabled={busy}
                          onClick={() => act(r, "reverse")}
                        >
                          Ters kayıt
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p>Mal kabul görüntüleme yetkiniz yok.</p>
      )}
      {can("stock.view") && (
        <>
          <h3>Lotlar</h3>
          {!loading && !lots.length && <p>Henüz stok lotu yok.</p>}
          <div className="table-scroll">
            <table className="cloud-table">
              <thead>
                <tr>
                  <th>Lot</th>
                  <th>Fiziksel biçim</th>
                  <th>Kullanılabilir miktar</th>
                  <th>Türetilen alan</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <span>
                        {l.materialName} / {l.variantName}
                      </span>
                      <button className="btn" onClick={() => setDetail(l)}>
                        {l.lotCode}
                      </button>
                    </td>
                    <td>{l.form}</td>
                    <td>
                      {l.balances
                        .map((b) => `${b.quantityBase} ${l.baseUnit}`)
                        .join(" / ")}
                    </td>
                    <td>
                      {l.balances
                        .map((b) => (b.areaM2 ? `${b.areaM2} m²` : "—"))
                        .join(" / ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {can("stock.movementsView") && (
        <>
          <h3>Stok hareketleri</h3>
          {!loading && !movements.length && <p>Henüz stok hareketi yok.</p>}
          <ul>
            {movements.map((m) => (
              <li key={m.id}>
                {new Date(m.createdAt).toLocaleString("tr")} ·{" "}
                {m.quantityDeltaBase} {m.baseUnit} · Lot {m.lotId.slice(0, 8)}
              </li>
            ))}
          </ul>
        </>
      )}
      <Dialog.Root
        open={open}
        onOpenChange={(v) => {
          if (!v) close();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="cloud-overlay" />
          <Dialog.Content
            className="cloud-drawer"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              drawerReturn.current?.focus();
            }}
          >
            <Dialog.Title>
              {edit
                ? "Mal kabul taslağını düzenle"
                : "Onaylı siparişten teslim al"}
            </Dialog.Title>
            <Dialog.Description>
              Her satır tek fiziksel rulo veya tek ölçülü levha/adet partisini
              temsil eder. Kesinleştirme ayrı işlemdir.
            </Dialog.Description>
            {error && <p role="alert">{error}</p>}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy || !selected) return;
                setBusy(true);
                setError("");
                try {
                  const lines = selected.lines
                    .filter((l) => quantities[l.id]?.received)
                    .map((l) => ({
                      orderLineId: l.id,
                      lineNo: l.lineNo,
                      receivedQty: quantities[l.id].received.replace(",", "."),
                      rejectedQty:
                        quantities[l.id].rejected.replace(",", ".") || "0",
                      rejectionReason: quantities[l.id].reason,
                      singlePackage: quantities[l.id].single,
                    }));
                  await request(
                    edit ? `goods-receipts/${edit.id}` : "goods-receipts",
                    edit ? "PATCH" : "POST",
                    {
                      ...scope,
                      activityId: selected.activityId,
                      ...(edit
                        ? { version: edit.version }
                        : { idempotencyKey: key, orderId, locationId }),
                      receivedAt: date,
                      sourceRef: reference,
                      lines,
                    },
                  );
                  setDirty(false);
                  setOpen(false);
                  reload();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "API_UNAVAILABLE");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Onaylı sipariş
                <select
                  aria-label="Onaylı sipariş"
                  required
                  disabled={!!edit}
                  value={orderId}
                  onChange={(e) => {
                    setOrderId(e.target.value);
                    setQuantities({});
                    change();
                  }}
                >
                  <option value="">Seçin</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.businessNo}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Depo
                <select
                  aria-label="Depo"
                  required
                  disabled={!!edit}
                  value={locationId}
                  onChange={(e) => {
                    setLocationId(e.target.value);
                    change();
                  }}
                >
                  <option value="">Seçin</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} — {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Teslim tarihi
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    change();
                  }}
                />
              </label>
              <label>
                İrsaliye / kaynak referansı
                <input
                  value={reference}
                  maxLength={150}
                  onChange={(e) => {
                    setReference(e.target.value);
                    change();
                  }}
                />
              </label>
              {selected?.lines.map((l) => {
                const q = quantities[l.id] ?? {
                  received: "",
                  rejected: "0",
                  reason: "",
                  single: false,
                };
                const set = (k: string, v: string | boolean) => {
                  setQuantities((old) => ({
                    ...old,
                    [l.id]: { ...q, [k]: v },
                  }));
                  change();
                };
                const remaining = new Decimal(l.orderedQty)
                  .minus(l.acceptedQty)
                  .toString();
                return (
                  <fieldset key={l.id}>
                    <legend>
                      Satır {l.lineNo} · {l.materialName} / {l.variantName} ·
                      Kalan {remaining} {l.purchaseUnit}{" "}
                      {new Decimal(remaining).eq(0)
                        ? "(Tam teslimat)"
                        : new Decimal(l.acceptedQty).gt(0)
                          ? "(Kısmi teslimat)"
                          : ""}
                    </legend>
                    <label>
                      Gelen miktar
                      <input
                        inputMode="decimal"
                        value={q.received}
                        onChange={(e) => set("received", e.target.value)}
                      />
                    </label>
                    <label>
                      Reddedilen miktar
                      <input
                        inputMode="decimal"
                        value={q.rejected}
                        onChange={(e) => set("rejected", e.target.value)}
                      />
                    </label>
                    <label>
                      Ret gerekçesi
                      <input
                        value={q.reason}
                        maxLength={300}
                        onChange={(e) => set("reason", e.target.value)}
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={q.single}
                        onChange={(e) => set("single", e.target.checked)}
                      />
                      Tek fiziksel rulo / tek ölçülü parti olduğunu doğruluyorum
                    </label>
                  </fieldset>
                );
              })}
              <Button type="submit" disabled={busy || !selected}>
                Taslağı kaydet
              </Button>
              <Button type="button" onClick={close}>
                Vazgeç
              </Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={stepUp} onOpenChange={setStepUp}>
        <Dialog.Portal>
          <Dialog.Overlay className="cloud-overlay" />
          <Dialog.Content className="confirm-dialog">
            <Dialog.Title>Güvenlik doğrulaması</Dialog.Title>
            <Dialog.Description>
              Doğrulamadan sonra Kesinleştir veya Ters kayıt düğmesine yeniden
              basın.
            </Dialog.Description>
            <StepUpVerification
              returnLabel="Mal kabule dön"
              onVerified={() => setStepUp(false)}
            />
            <Button onClick={() => setStepUp(false)}>Kapat</Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="cloud-overlay" />
          <Dialog.Content className="cloud-drawer">
            <Dialog.Title>Lot ayrıntısı</Dialog.Title>
            <Dialog.Description>{detail?.lotCode}</Dialog.Description>
            {detail && (
              <>
                <p>
                  Malzeme: {detail.materialName} / {detail.variantName};
                  Varyant: {detail.variantId}
                </p>
                <p>
                  Biçim: {detail.form}; En: {detail.widthCm ?? "—"} cm; İlk
                  uzunluk: {detail.initialLengthM ?? "—"} m
                </p>
                <p>
                  İlk stok: {detail.initialBaseQty} {detail.baseUnit}. Bu değer
                  kalan kesintisiz geometri iddiası değildir.
                </p>
                {detail.acquisitionSnapshot ? (
                  <p>
                    Edinim: {detail.acquisitionSnapshot.originalUnitPrice}{" "}
                    {detail.acquisitionSnapshot.originalCurrency}; USD toplam:{" "}
                    {detail.acquisitionSnapshot.lineTotalUsd ??
                      "Kur doğrulanmadı"}
                    . KDV ve ek edinim giderleri hariç.
                  </p>
                ) : (
                  <p>Edinim maliyeti gizli.</p>
                )}
                <Button onClick={() => setDetail(null)}>Kapat</Button>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
