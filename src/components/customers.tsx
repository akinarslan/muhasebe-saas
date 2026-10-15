"use client";
import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Search,
  Plus,
  Download,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Users,
  ArrowUpRight,
  X,
  Building2,
  Store,
  Palette,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import type { Customer, DemoData } from "@/lib/types";
import { products, segments } from "@/lib/mock";
import {
  dateLabel,
  localISO,
  money,
  normalize,
  saleAmounts,
  tryValue,
} from "@/lib/finance";
import cities from "@/data/cities.json";
import { Button } from "./ui/button";
type Row = Customer & {
  total: number;
  balance: number;
  last: string;
  status: string;
};
function SegmentBadge({ segment }: { segment: string }) {
  const Icon =
    segment === "Resmî kurum"
      ? Building2
      : segment === "Reklamcı"
        ? Palette
        : Store;
  return (
    <span
      className={`segment-badge ${segment === "Resmî kurum" ? "segment-government" : segment === "Reklamcı" ? "segment-creative" : "segment-store"}`}
    >
      <Icon size={14} />
      {segment}
    </span>
  );
}
export function Customers({
  data,
  onNew,
  onDetail,
  initialSearch = "",
}: {
  data: DemoData;
  onNew: () => void;
  onDetail: (id: string) => void;
  initialSearch?: string;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [segment, setSegment] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [balance, setBalance] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [visibility, setVisibility] = useState<VisibilityState>({});
  const rows = useMemo<Row[]>(
    () =>
      data.customers.map((c) => {
        const sales = data.sales.filter((s) => s.customerId === c.id);
        let total = 0,
          balance = 0;
        sales.forEach((s) => {
          const a = saleAmounts(s, products);
          total += tryValue(a.total, s.currency, s.rateSnapshot);
          balance += tryValue(a.balance, s.currency, s.rateSnapshot);
        });
        return {
          ...c,
          total,
          balance,
          last:
            sales
              .map((s) => s.date)
              .sort()
              .at(-1) || "",
          status: balance > 0 ? "Açık bakiye" : "Bakiyesi yok",
        };
      }),
    [data],
  );
  const filtered = rows.filter(
    (r) =>
      normalize(r.name).includes(normalize(search)) &&
      (!segment || r.segment === segment) &&
      (!city || r.city === city) &&
      (!district || r.district === district) &&
      (!balance || (balance === "open" ? r.balance > 0 : r.balance === 0)),
  );
  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Şirket / kurum adı",
        cell: ({ row }) => (
          <button
            className="customer-cell"
            onClick={() => onDetail(row.original.id)}
          >
            <span className="avatar">
              {row.original.name.slice(0, 2).toLocaleUpperCase("tr")}
            </span>
            <span>
              <b>{row.original.name}</b>
              <small>{row.original.email}</small>
            </span>
          </button>
        ),
      },
      {
        accessorKey: "segment",
        header: "Segment",
        cell: ({ getValue }) => <SegmentBadge segment={getValue<string>()} />,
      },
      { accessorKey: "city", header: "İl" },
      { accessorKey: "district", header: "İlçe" },
      { accessorKey: "phone", header: "Telefon" },
      {
        accessorKey: "total",
        header: "Toplam satış",
        cell: ({ getValue }) => (
          <b className="nowrap">{money(getValue<number>())}</b>
        ),
      },
      {
        accessorKey: "balance",
        header: "Açık bakiye",
        cell: ({ getValue }) => (
          <span className={getValue<number>() > 0 ? "amber-text" : "muted"}>
            {money(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "last",
        header: "Son satış",
        cell: ({ getValue }) =>
          getValue<string>() ? dateLabel(getValue<string>()) : "—",
      },
      {
        accessorKey: "status",
        header: "Durum",
        cell: ({ row }) => (
          <span
            className={`badge ${row.original.balance > 0 ? "warning" : "success"}`}
          >
            {row.original.status}
          </span>
        ),
      },
      {
        id: "actions",
        header: "İşlemler",
        enableSorting: false,
        cell: ({ row }) => (
          <button
            className="icon-button"
            aria-label={`${row.original.name} detayları`}
            onClick={() => onDetail(row.original.id)}
          >
            <ArrowUpRight size={17} />
          </button>
        ),
      },
    ],
    [onDetail],
  );
  // TanStack Table exposes mutable functions; this component does not use React Compiler.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnVisibility: visibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });
  function csv() {
    const quote = (v: unknown) => {
      const s = String(v ?? "");
      return (
        '"' +
        (/^[=+@\-\t\r]/.test(s) ? "'" : "") +
        s.replaceAll('"', '""') +
        '"'
      );
    };
    const keys = [
      "name",
      "segment",
      "city",
      "district",
      "phone",
      "total",
      "balance",
      "last",
      "status",
    ] as const;
    const text =
      "\uFEFF" +
      [
        keys
          .map(
            (k) =>
              columns.find((c) => "accessorKey" in c && c.accessorKey === k)
                ?.header ?? k,
          )
          .map(quote)
          .join(";"),
        ...table
          .getSortedRowModel()
          .rows.map(({ original: r }) =>
            keys.map((k) => quote(r[k])).join(";"),
          ),
      ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "pusula-musteriler-demo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MÜŞTERİ İLİŞKİLERİ</div>
          <h1>
            Müşteriler ve cari<span className="heading-dot">.</span>
          </h1>
          <p>
            İlişkilerinizi güçlendirin, bakiyelerinizi tek yerden takip edin.
          </p>
        </div>
        <Button onClick={onNew}>
          <Plus size={17} /> Yeni müşteri
        </Button>
      </div>
      <div className="customer-summary">
        <div>
          <span className="icon-tile">
            <Users size={20} />
          </span>
          <span>
            Toplam müşteri<strong>{rows.length}</strong>
          </span>
        </div>
        <div>
          <span className="icon-tile">
            <Building2 size={20} />
          </span>
          <span>
            Toplam satış
            <strong>{money(rows.reduce((n, r) => n + r.total, 0))}</strong>
          </span>
        </div>
        <div>
          <span className="icon-tile">
            <ArrowUpRight size={20} />
          </span>
          <span>
            Açık bakiye
            <strong>{money(rows.reduce((n, r) => n + r.balance, 0))}</strong>
          </span>
        </div>
      </div>
      <section className="panel">
        <div className="customer-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Müşteri adına göre ara"
              placeholder="Müşteri adıyla ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={csv}>
            <Download size={15} /> CSV aktar
          </Button>
          <details className="column-picker">
            <summary>
              <SlidersHorizontal size={15} /> Kolonlar
            </summary>
            <div>
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={c.getIsVisible()}
                      onChange={c.getToggleVisibilityHandler()}
                    />
                    {typeof c.columnDef.header === "string"
                      ? c.columnDef.header
                      : c.id}
                  </label>
                ))}
            </div>
          </details>
        </div>
        <div className="customer-filters">
          <select
            aria-label="Segment filtresi"
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
          >
            <option value="">Tüm segmentler</option>
            {segments.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="İl filtresi"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setDistrict("");
            }}
          >
            <option value="">Tüm iller</option>
            {cities.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
          <select
            aria-label="İlçe filtresi"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            disabled={!city}
          >
            <option value="">Tüm ilçeler</option>
            {cities
              .find((c) => c.name === city)
              ?.districts.map((d) => (
                <option key={d}>{d}</option>
              ))}
          </select>
          <select
            aria-label="Bakiye filtresi"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          >
            <option value="">Tüm bakiyeler</option>
            <option value="open">Alacak var</option>
            <option value="zero">Bakiyesi yok</option>
          </select>
          <button
            className="text-button"
            onClick={() => {
              setSearch("");
              setSegment("");
              setCity("");
              setDistrict("");
              setBalance("");
            }}
          >
            Filtreleri temizle
          </button>
        </div>
        <div className="table-scroll">
          <table className="customer-table">
            <thead>
              {table.getHeaderGroups().map((g) => (
                <tr key={g.id}>
                  {g.headers.map((h) => (
                    <th key={h.id}>
                      {h.column.getCanSort() ? (
                        <button
                          onClick={h.column.getToggleSortingHandler()}
                          aria-label={`${h.column.columnDef.header} sıralama`}
                          aria-pressed={!!h.column.getIsSorted()}
                        >
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext(),
                          )}
                          <ArrowUpDown size={11} />
                          {h.column.getIsSorted() === "asc"
                            ? " ↑"
                            : h.column.getIsSorted() === "desc"
                              ? " ↓"
                              : ""}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((r) => (
                <tr key={r.id} onClick={() => onDetail(r.original.id)}>
                  {r.getVisibleCells().map((c) => (
                    <td
                      key={c.id}
                      onClick={(e) => {
                        if (c.column.id === "name" || c.column.id === "actions")
                          e.stopPropagation();
                      }}
                    >
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty">
              <Users />
              <b>Müşteri bulunamadı</b>
              <p>Aramayı veya filtrelerinizi değiştirmeyi deneyin.</p>
            </div>
          )}
        </div>
        <div className="pagination">
          <span>
            {filtered.length} müşteriden{" "}
            {filtered.length
              ? table.getState().pagination.pageIndex * 8 + 1
              : 0}
            –
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * 8,
              filtered.length,
            )}{" "}
            gösteriliyor
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Önceki sayfa"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {table.getState().pagination.pageIndex + 1} /{" "}
              {Math.max(1, table.getPageCount())}
            </span>
            <button
              className="icon-button"
              aria-label="Sonraki sayfa"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
      <p className="data-note">
        Toplamlar aynı satış ve tahsilat kayıtlarından hesaplanır. USD tutarları
        kendi işlem tarihinde kaydedilen kurla TRY olarak gösterilir.
      </p>
    </>
  );
}
export function CustomerDetail({
  id,
  data,
  onClose,
}: {
  id: string;
  data: DemoData;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("Genel bilgiler");
  const c = data.customers.find((c) => c.id === id);
  const sales = data.sales.filter((s) => s.customerId === id);
  if (!c) return null;
  const total = sales.reduce(
    (n, s) =>
      n + tryValue(saleAmounts(s, products).total, s.currency, s.rateSnapshot),
    0,
  );
  const balance = sales.reduce(
    (n, s) =>
      n +
      tryValue(saleAmounts(s, products).balance, s.currency, s.rateSnapshot),
    0,
  );
  return (
    <Dialog.Root
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content className="drawer detail-drawer">
          <header className="drawer-head">
            <span className="avatar large">{c.name.slice(0, 2)}</span>
            <div>
              <Dialog.Title>{c.name}</Dialog.Title>
              <Dialog.Description>
                {c.segment} · {c.city}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="icon-button"
              aria-label="Müşteri detayını kapat"
            >
              <X size={20} />
            </Dialog.Close>
          </header>
          <div className="drawer-body">
            <div className="detail-stats">
              <div>
                <small>Toplam satış</small>
                <b>{money(total)}</b>
              </div>
              <div>
                <small>Açık bakiye</small>
                <b>{money(balance)}</b>
              </div>
            </div>
            <div
              className="detail-tabs"
              role="group"
              aria-label="Müşteri detay bölümleri"
            >
              {[
                "Genel bilgiler",
                "Satış geçmişi",
                "Cari hareketler",
                "Tahsilatlar",
                "Teklifler",
              ].map((t) => (
                <button
                  key={t}
                  aria-pressed={tab === t}
                  onClick={() => setTab(t)}
                  className={tab === t ? "active" : ""}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === "Genel bilgiler" ? (
              <dl className="customer-info">
                {[
                  ["Şirket / kurum", c.name],
                  ["Segment", c.segment],
                  ["İl / İlçe", `${c.city || "—"} / ${c.district || "—"}`],
                  ["Telefon", c.phone],
                  ["E-posta", c.email],
                  ["Yetkili", c.contact],
                  ["Vergi dairesi", c.taxOffice],
                  ["VKN / TCKN", c.taxId],
                  ["Adres", c.address],
                  ["Varsayılan vade", `${c.term ?? 30} gün`],
                  ["Notlar", c.notes],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v || "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : tab === "Teklifler" ? (
              <div className="empty">
                <p>Bu demo müşteriye ait teklif bulunmuyor.</p>
                <small>Teklif yönetimi sonraki sürümde.</small>
              </div>
            ) : (
              <div className="detail-transactions">
                {tab === "Tahsilatlar"
                  ? sales.flatMap((s) =>
                      s.payments.map((p) => (
                        <div key={p.id}>
                          <span>
                            <b>{p.method}</b>
                            <small>
                              {dateLabel(p.date)} · {s.id}
                            </small>
                          </span>
                          <strong className="teal">
                            {money(p.amount, s.currency)}
                          </strong>
                        </div>
                      )),
                    )
                  : sales.map((s) => {
                      const a = saleAmounts(s, products);
                      return (
                        <div key={s.id}>
                          <span>
                            <b>{s.id}</b>
                            <small>
                              {dateLabel(s.date)} · {s.activity}
                            </small>
                            {tab === "Cari hareketler" && (
                              <small>
                                Alacak: {money(a.total, s.currency)} · Tahsilat:{" "}
                                {money(a.paid, s.currency)}
                              </small>
                            )}
                            <small
                              className={
                                s.dueDate < localISO() && a.balance > 0
                                  ? "error"
                                  : ""
                              }
                            >
                              Vade: {dateLabel(s.dueDate)}
                            </small>
                            {s.plans.map((p) => (
                              <small key={p.id}>
                                Plan: {p.method} · {money(p.amount, s.currency)}{" "}
                                · {dateLabel(p.dueDate)}
                              </small>
                            ))}
                            <small>
                              Kur: {s.rateSnapshot?.value.toFixed(4) ?? "—"} ·{" "}
                              {s.rateSnapshot?.source === "legacy-demo"
                                ? "Tarihsel demo"
                                : s.rateSnapshot?.source === "manual"
                                  ? "Yetkili manuel"
                                  : "TCMB"}{" "}
                              · {s.rateSnapshot?.publishedAt}
                            </small>
                            {s.lines.map(
                              (l) =>
                                l.costSnapshot && (
                                  <details
                                    className="snapshot-detail"
                                    key={l.id}
                                  >
                                    <summary>
                                      {l.description} · Maliyet snapshot’ı
                                    </summary>
                                    <small>
                                      USD maliyet:{" "}
                                      {money(
                                        l.costSnapshot.totalCostUsd,
                                        "USD",
                                      )}{" "}
                                      · Maliyet kuru{" "}
                                      {l.costSnapshot.rate.value.toFixed(4)} ·{" "}
                                      {l.costSnapshot.createdBy}
                                    </small>
                                    {l.costSnapshot.materials.map((m) => (
                                      <small key={m.use.id}>
                                        {m.materialName} / {m.variantName} ·{" "}
                                        {m.consumedUnits.toFixed(4)} {m.unit} ×{" "}
                                        {m.unitCostUsd} USD
                                      </small>
                                    ))}
                                    {l.costSnapshot.expenses.map((e) => (
                                      <small key={e.id}>
                                        {e.name} · {e.quantity} {e.unit} ×{" "}
                                        {e.usdAmount} USD
                                      </small>
                                    ))}
                                  </details>
                                ),
                            )}
                          </span>
                          <strong>
                            {money(
                              tab === "Cari hareketler" ? a.balance : a.total,
                              s.currency,
                            )}
                          </strong>
                        </div>
                      );
                    })}
                {!sales.length && <div className="empty">Henüz işlem yok.</div>}
                {tab === "Tahsilatlar" &&
                  sales.length > 0 &&
                  !sales.some((s) => s.payments.length) && (
                    <div className="empty">Henüz tahsilat yok.</div>
                  )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
