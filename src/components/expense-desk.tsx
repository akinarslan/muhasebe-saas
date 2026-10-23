"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { expenseCategories } from "@/lib/cloud/expense-contracts";
import { turkishDate, turkishMoney } from "@/lib/cloud/treasury-contracts";
type Expense = {
  id: string;
  category: keyof typeof expenseCategories;
  description: string;
  documentRef: string;
  bookedOn: string;
  net: string;
  vat: string;
  gross: string;
  status: string;
  outstanding: string;
  journalId: string;
  accountId: string;
  payment: string;
};
const money = (v: string) => {
  const [whole, cents = "00"] = v.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${cents.padEnd(2, "0")} TL`;
};
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(
    new Date(),
  );
const labels: Record<string, string> = {
  netSales: "Net satış",
  salesVat: "Satış KDV",
  grossSales: "Brüt satış",
  collections: "Tahsilatlar",
  payments: "Ödemeler",
  cash: "Kasa bakiyesi",
  bank: "Banka bakiyesi",
  pos: "POS bekleyen",
  receivables: "Toplam müşteri alacakları",
  payables: "Toplam tedarikçi borçları",
  overdue: "Vadesi geçen alacaklar",
  expensesNet: "Dönem gideri (net)",
  expensesVat: "Gider KDV",
  expensesGross: "Dönem gideri (brüt)",
  monthlyExpensesNet: "Aylık gider (net)",
  cashMovement: "Nakit hareketi (kasa + banka)",
  estimatedJobProfit: "Tahmini iş kârı",
};
export function ExpenseDesk({
  call,
  record,
  run,
  busy,
  pending,
  revision,
  actions,
  suppliers,
  funds,
  statement,
  refresh,
}: {
  call: (path: string, method?: string, body?: object) => Promise<unknown>;
  record: (kind: string, path: string, body: object) => Promise<void>;
  run: (fn: () => Promise<void>) => Promise<void>;
  busy: boolean;
  pending: boolean;
  revision: number;
  actions: string[];
  suppliers: { id: string; name: string }[];
  funds: { id: string; kind: string; label: string }[];
  statement: (id: string) => void;
  refresh: () => void;
}) {
  const [from, setFrom] = useState(today),
    [through, setThrough] = useState(today),
    [rows, setRows] = useState<Expense[]>([]),
    [summary, setSummary] = useState<Record<string, string> | null>(null),
    [error, setError] = useState(""),
    [payment, setPayment] = useState("CASH");
  const canReport = [
    "reports.finance",
    "finance.accounts",
    "finance.approve",
    "finance.payables",
    "finance.cash",
    "finance.bank",
    "sales.view",
    "materials.costView",
  ].every((p) => actions.includes(p));
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const params = `from=${from}&through=${through}`;
        const [expenses, report] = await Promise.all([
          call(`finance/expenses?${params}`),
          canReport ? call(`finance/summary?${params}`) : Promise.resolve(null),
        ]);
        if (live) {
          setRows(expenses as Expense[]);
          setSummary(report as Record<string, string> | null);
          setError("");
        }
      } catch {
        if (live) {
          setRows([]);
          setSummary(null);
          setError(
            "Gider veya rapor alınamadı. Tarih aralığını ve finans yetkilerinizi kontrol edin.",
          );
        }
      }
    };
    void load();
    return () => {
      live = false;
    };
    // Refresh after committed operations or a date change, not on callback identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, through, revision, canReport]);
  return (
    <section aria-label="İşletme giderleri ve finans özeti">
      <h3>Günlük finans özeti</h3>
      <div className="flex flex-wrap gap-3">
        <label>
          Başlangıç tarihi
          <input
            aria-label="Rapor başlangıç"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Bitiş tarihi
          <input
            aria-label="Rapor bitiş"
            type="date"
            value={through}
            onChange={(e) => setThrough(e.target.value)}
          />
        </label>
        <Button
          onClick={() => {
            setFrom(today());
            setThrough(today());
          }}
        >
          Bugün
        </Button>
        <Button
          onClick={() => {
            setFrom(today().slice(0, 7) + "-01");
            setThrough(today());
          }}
        >
          Bu ay
        </Button>
      </div>
      <p>
        Hareketler seçilen döneme; bakiyeler, vadeler ve borçlar bitiş tarihine
        aittir. Aylık gider bitiş tarihinin ayıdır. Açılışlar satış veya nakit
        hareketi sayılmaz.
      </p>
      {error && <p role="alert">{error}</p>}
      {canReport && summary && (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(labels).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                <strong>{money(summary[key])}</strong>
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p>
        Tahmini iş kârı, satış anındaki kur ve üretim maliyeti tahmininden
        hesaplanır; işletme giderleri ve POS komisyonları düşülmemiştir.
        Muhasebe dönem kârı değildir.
      </p>
      <h3>İşletme giderleri</h3>
      <p>
        Yalnız tüketilmiş işletme hizmeti ve sarflar içindir. Stok alımı, makine
        yatırımı ve üretim maliyet tarifeleri bu ekrandan giderleştirilmez. KDV
        ayrıca girilir; indirilebilirliği belgeye göre doğrulayın. Personel
        kaydı bordro ve stopaj hesabı yapmaz.
      </p>
      {actions.includes("finance.approve") && (
        <form
          aria-label="Gider kayıt formu"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              await record("EXPENSE", "expenses", {
                category: String(f.get("category")),
                description: String(f.get("description")),
                documentRef: String(f.get("documentRef")),
                bookedOn: turkishDate(String(f.get("date"))),
                dueOn:
                  payment === "CREDIT"
                    ? turkishDate(String(f.get("due")))
                    : null,
                net: turkishMoney(String(f.get("net"))),
                vat: turkishMoney(String(f.get("vat"))),
                supplierId: String(f.get("supplier")) || null,
                payment,
                fundAccountId:
                  payment === "CREDIT" ? null : String(f.get("fund")),
              });
            });
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              Kategori
              <select name="category">
                {Object.entries(expenseCategories).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Açıklama
              <input
                required
                name="description"
                minLength={3}
                maxLength={500}
              />
            </label>
            <label>
              Belge referansı
              <input
                required
                name="documentRef"
                minLength={3}
                maxLength={200}
              />
            </label>
            <label>
              Gider tarihi
              <input
                required
                name="date"
                placeholder="gg.aa.yyyy"
                defaultValue={new Intl.DateTimeFormat("tr-TR").format(
                  new Date(),
                )}
              />
            </label>
            <label>
              Net gider (TL)
              <input
                required
                name="net"
                inputMode="decimal"
                placeholder="2.500,00"
              />
            </label>
            <label>
              KDV tutarı (TL)
              <input
                required
                name="vat"
                inputMode="decimal"
                defaultValue="0,00"
              />
            </label>
            <label>
              Ödeme şekli
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
              >
                <option value="CASH">Peşin kasa</option>
                <option value="BANK">Peşin banka</option>
                <option value="CREDIT">Vadeli tedarikçi borcu</option>
              </select>
            </label>
            <label>
              Tedarikçi
              <select name="supplier" required={payment === "CREDIT"}>
                <option value="">Tedarikçisiz</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            {payment === "CREDIT" ? (
              <label>
                Vade
                <input required name="due" placeholder="gg.aa.yyyy" />
              </label>
            ) : (
              <label>
                Ödeme hesabı
                <select required name="fund">
                  {funds
                    .filter((f) => f.kind === payment)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
          <Button disabled={busy || pending}>Gideri kaydet</Button>
        </form>
      )}
      <div className="table-scroll">
        <table className="cloud-table">
          <thead>
            <tr>
              <th>Tarih / belge</th>
              <th>Kategori / açıklama</th>
              <th>Net</th>
              <th>KDV</th>
              <th>Brüt</th>
              <th>Ödeme / kalan</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id}>
                <td>
                  {x.bookedOn}
                  <br />
                  {x.documentRef}
                </td>
                <td>
                  {expenseCategories[x.category]}
                  <br />
                  {x.description}
                </td>
                <td>{money(x.net)}</td>
                <td>{money(x.vat)}</td>
                <td>{money(x.gross)}</td>
                <td>
                  {x.status === "REVERSED"
                    ? "Ters kayıt"
                    : x.status === "PAID"
                      ? "Ödendi"
                      : "Ödenecek"}
                  <br />
                  {money(x.outstanding)}
                </td>
                <td>
                  {x.payment === "CREDIT" && (
                    <Button onClick={() => statement(x.accountId)}>
                      Tedarikçi ekstresi
                    </Button>
                  )}
                  {actions.includes("finance.approve") &&
                    x.status !== "REVERSED" && (
                      <Button
                        disabled={busy || pending}
                        onClick={() =>
                          void run(async () => {
                            const reason = window.prompt(
                              "Ters kayıt gerekçesi (en az 3 karakter)",
                            );
                            if (!reason || reason.trim().length < 3)
                              throw Error("Gerekçe gerekli.");
                            await call("finance/reversals", "POST", {
                              journalId: x.journalId,
                              idempotencyKey: crypto.randomUUID(),
                              bookedOn: today(),
                              reason,
                            });
                            // Parent refresh also updates payables and funds.
                            refresh();
                          })
                        }
                      >
                        Gider ters kaydı
                      </Button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>Seçilen dönemde gider bulunamadı.</p>}
      <p>
        Vadeli giderin kalanını aşağıdaki tedarikçi borçlarından ödeyin. Ödeme
        yeni gider oluşturmaz. Düzeltme için önce bağlı ödemeleri tersleyin.
      </p>
    </section>
  );
}
