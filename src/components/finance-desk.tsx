"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { Button } from "./ui/button";
import { StepUpVerification } from "./step-up-verification";
import { turkishMoney, turkishDate } from "@/lib/cloud/treasury-contracts";
import { ExpenseDesk } from "./expense-desk";
type Fund = {
  id: string;
  kind: string;
  label: string;
  balance: string;
  movements: {
    id: string;
    journalId: string;
    bookedOn: string;
    kind: string;
    amount: string;
    reference: string;
  }[];
};
type Document = {
  journalId: string;
  saleId: string | null;
  accountId: string;
  partyId: string;
  gross: string;
  outstanding: string;
  dueOn: string;
};
type Account = {
  id: string;
  kind: string;
  customerId: string | null;
  supplierId: string | null;
};
type Statement = {
  balance: string;
  entries: {
    id: string;
    bookedOn: string;
    dueOn: string | null;
    debit: string;
    credit: string;
    balance: string;
    reason: string;
  }[];
};
const display = (v: string) => {
  const [a, b = "00"] = v.split(".");
  return `${a.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${b.padEnd(2, "0")} TL`;
};
const dateText = () => new Intl.DateTimeFormat("tr-TR").format(new Date());
function FinanceDocuments({
  rows,
  kind,
  busy,
  allowed,
  onStatement,
  onSelect,
  names,
}: {
  rows: Document[];
  kind: string;
  busy: boolean;
  allowed: boolean;
  onStatement: (id: string) => void;
  onSelect: (d: Document, kind: string) => void;
  names: Record<string, string>;
}) {
  return (
    <div className="table-scroll">
      <table className="cloud-table">
        <thead>
          <tr>
            <th>Belge</th>
            <th>Brüt</th>
            <th>Kalan</th>
            <th>Vade</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.journalId}>
              <td>
                {names[d.partyId] || d.partyId}
                <br />
                {d.saleId || d.journalId}
              </td>
              <td>{display(d.gross)}</td>
              <td>{display(d.outstanding)}</td>
              <td>{d.dueOn}</td>
              <td>
                <Button
                  disabled={busy}
                  onClick={() => onStatement(d.accountId)}
                >
                  Cari ekstre
                </Button>
                {allowed && (
                  <Button
                    disabled={busy || Number(d.outstanding) <= 0}
                    onClick={() => {
                      onSelect(d, kind);
                    }}
                  >
                    {kind === "COLLECT" ? "Tahsilat al" : "Ödeme yap"}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p>Kayıt bulunamadı.</p>}
    </div>
  );
}
export function FinanceDesk({
  company,
  activity,
  actions,
  customers,
}: {
  company: string;
  activity: string;
  actions: string[];
  customers: { id: string; name: string }[];
}) {
  const scope = { legalEntityId: company, activityId: activity || null },
    query = `company=${company}${activity ? `&activity=${activity}` : ""}`;
  const key = `pusula.finance.pending:${company}:${activity}`;
  const [funds, setFunds] = useState<Fund[]>([]),
    [ar, setAr] = useState<Document[]>([]),
    [ap, setAp] = useState<Document[]>([]),
    [accounts, setAccounts] = useState<Account[]>([]),
    [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const names = Object.fromEntries(
    [...customers, ...suppliers].map((p) => [p.id, p.name]),
  );
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [pending, setPending] = useState(""),
    [selected, setSelected] = useState<Document | null>(null),
    [mode, setMode] = useState("COLLECT"),
    [method, setMethod] = useState("CASH"),
    [history, setHistory] = useState<Statement | null>(null),
    [fundId, setFundId] = useState("");
  const inFlight = useRef(false),
    can = (action: string) => actions.includes(action);
  const call = async (path: string, method = "GET", body?: object) => {
    const r = await fetch(
      `/api/cloud/workspace/${path}${path.includes("?") ? "&" : "?"}${query}`,
      {
        method,
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify({ ...scope, ...body }) } : {}),
      },
    );
    const data = await r.json();
    if (!r.ok) throw Error(data.error || "FINANCE_REJECTED");
    return data;
  };
  const message = (e: unknown) =>
    e instanceof Error
      ? {
          STEP_UP_REQUIRED: "İşlem için parola ve TOTP doğrulaması yapın.",
          FORBIDDEN: "Bu işlem veya hesap için yetkiniz yok.",
          ACCOUNTING_CLOUD_REVIEW_REQUIRED:
            "Finans bu ortamda henüz kullanıma açılmadı.",
          FINANCE_COMMAND_REJECTED:
            "İşlem reddedildi. Kaynak kalanını, hesap bakiyesini, referansı ve yetkinizi kontrol edin.",
        }[e.message] || e.message
      : "İşlem tamamlanamadı.";
  useEffect(() => {
    let live = true;
    const stored = sessionStorage.getItem(key);
    Promise.resolve().then(() => {
      if (live && stored) setPending(stored);
    });
    Promise.all([
      call("finance/funds"),
      call("finance/documents"),
      can("finance.payables") ? call("finance/documents?party=SUPPLIER") : [],
      call("finance/accounts"),
      can("suppliers.view") ? call("suppliers") : [],
    ])
      .then(([f, r, p, a, s]) => {
        if (live) {
          setError("");
          setFunds(f);
          setAr(r);
          setAp(p);
          setAccounts(a);
          setSuppliers(s);
        }
      })
      .catch((e) => {
        if (live) {
          setError(message(e));
          setFunds([]);
          setAr([]);
          setAp([]);
          setAccounts([]);
        }
      });
    return () => {
      live = false;
    };
    // Remount on scope changes; refresh only on explicit successful operations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, company, activity]);
  const run = async (fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const record = async (kind: string, path: string, body: object) => {
    if (pending || sessionStorage.getItem(key))
      throw Error(
        "Önce bekleyen işlemin sonucunu sorgulayın veya güvenle kapatın.",
      );
    const intent = await call("finance/intents", "POST", {
      kind,
      clientKey: crypto.randomUUID(),
    });
    sessionStorage.setItem(key, intent.id);
    setPending(intent.id);
    await call(`finance/${path}`, "POST", {
      intentId: intent.id,
      idempotencyKey: crypto.randomUUID(),
      currency: "TRY",
      ...(kind === "EXPENSE"
        ? {}
        : {
            fee: "0",
            bookedOn: dateText().split(".").reverse().join("-"),
            reason: "Kullanıcı tarafından onaylanan finans işlemi",
          }),
      ...body,
    });
    sessionStorage.removeItem(key);
    setPending("");
    setSelected(null);
    setNotice("İşlem kaydedildi.");
    setRevision((v) => v + 1);
  };
  const collectOrPay = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(async () => {
      if (!selected) throw Error("Kaynak belge seçin.");
      await record(mode, mode === "COLLECT" ? "collect" : "pay", {
        sourceJournalId: selected.journalId,
        accountId: selected.accountId,
        fundAccountId: String(f.get("fund")),
        method,
        amount: turkishMoney(String(f.get("amount"))),
        bookedOn: turkishDate(String(f.get("date"))),
        externalRef: String(f.get("ref") || ""),
        terminalApproved: f.get("approved") === "on",
      });
    });
  };
  const showStatement = (id: string) =>
    void run(async () => setHistory(await call(`finance/${id}/statement`)));
  return (
    <section aria-label="Finans çalışma alanı">
      <h2>Cari, kasa, banka ve POS</h2>
      <Button disabled={busy} onClick={() => setRevision((v) => v + 1)}>
        Finans verilerini yenile
      </Button>
      <p>
        TRY kayıtları. Belge kalanı ile genel cari bakiye ayrı gösterilir. POS
        bekleyen tutar banka bakiyesi değildir.
      </p>
      <p>
        Hareket listesi son 200 kaydı gösterir; hesap bakiyesi tüm kayıtlardan
        hesaplanır.
      </p>
      <StepUpVerification onVerified={() => setError("")} />
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {can("finance.payables") && (
        <ExpenseDesk
          call={call}
          record={record}
          run={run}
          busy={busy}
          pending={!!pending}
          revision={revision}
          actions={actions}
          suppliers={suppliers}
          funds={funds}
          statement={showStatement}
          refresh={() => setRevision((v) => v + 1)}
        />
      )}
      {pending && (
        <div role="status">
          <p>
            Bekleyen işlem referansı: {pending}. Sonuç kesinleşmeden yeni kayıt
            gönderilmez.
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await call(`finance/outcome/${pending}`);
                setNotice(
                  r.state === "SUCCEEDED"
                    ? `İşlem kaydedilmiş: ${r.id}`
                    : r.state === "CANCELLED"
                      ? "İşlem kapatıldı."
                      : "Kayıt henüz kesinleşmedi. Sorgulayın veya güvenle kapatın.",
                );
                if (r.state === "SUCCEEDED" || r.state === "CANCELLED") {
                  sessionStorage.removeItem(key);
                  setPending("");
                  setRevision((v) => v + 1);
                }
              })
            }
          >
            Sonucu sorgula
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await call("finance/cancel-intent", "POST", {
                  intentId: pending,
                });
                sessionStorage.removeItem(key);
                setPending("");
                setNotice(
                  "Kesinleşmemiş işlem güvenle kapatıldı; yeni taslak açabilirsiniz.",
                );
              })
            }
          >
            Kesinleşmemiş işlemi kapat
          </Button>
        </div>
      )}
      <h3>Müşteri alacakları</h3>
      {
        <FinanceDocuments
          rows={ar}
          names={names}
          kind="COLLECT"
          busy={busy}
          allowed={can("finance.collect")}
          onStatement={showStatement}
          onSelect={(d, k) => {
            setSelected(d);
            setMode(k);
            setMethod("CASH");
          }}
        />
      }
      <h3>Tedarikçi borçları</h3>
      {can("finance.payables") ? (
        <FinanceDocuments
          rows={ap}
          names={names}
          kind="PAY"
          busy={busy}
          allowed={can("finance.pay")}
          onStatement={showStatement}
          onSelect={(d, k) => {
            setSelected(d);
            setMode(k);
            setMethod("CASH");
          }}
        />
      ) : (
        <p>Tedarikçi borcu görüntüleme yetkisi gerekli.</p>
      )}
      {selected && (
        <form onSubmit={collectOrPay} aria-label="Tahsilat ödeme formu">
          <h3>
            {mode === "COLLECT" ? "Satıştan tahsilat" : "Tedarikçi ödemesi"}
          </h3>
          <p>Belge kalanı: {display(selected.outstanding)}</p>
          <label>
            Tutar (TL)
            <input
              required
              name="amount"
              inputMode="decimal"
              placeholder="5.000,00"
            />
          </label>
          <label>
            İşlem tarihi
            <input
              required
              name="date"
              defaultValue={dateText()}
              placeholder="gg.aa.yyyy"
            />
          </label>
          <label>
            Yöntem
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">Nakit</option>
              <option value="BANK">Havale / EFT</option>
              {mode === "COLLECT" && (
                <option value="CARD">Kredi kartı / POS</option>
              )}
            </select>
          </label>
          <label>
            Para hesabı
            <select name="fund" required>
              {funds
                .filter((f) => f.kind === (method === "CARD" ? "POS" : method))
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} — {display(f.balance)}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Terminal / banka referansı
            <input name="ref" maxLength={200} required={method !== "CASH"} />
          </label>
          {method === "CARD" && (
            <label>
              <input type="checkbox" name="approved" required />
              Terminal işlemi onaylandı. Kart numarası veya CVV girmeyin.
            </label>
          )}
          <Button disabled={busy || !!pending} type="submit">
            {mode === "COLLECT" ? "Tahsilatı kaydet" : "Ödemeyi kaydet"}
          </Button>
          <Button type="button" onClick={() => setSelected(null)}>
            Formu kapat
          </Button>
        </form>
      )}
      <h3>Cari ekstre</h3>
      <label>
        Cari hesap
        <select
          defaultValue=""
          onChange={(e) => e.target.value && showStatement(e.target.value)}
        >
          <option value="">Seçin</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.kind === "CUSTOMER" ? "Müşteri" : "Tedarikçi"} —{" "}
              {a.customerId || a.supplierId}
            </option>
          ))}
        </select>
      </label>
      {history && (
        <div>
          <p>
            Genel cari bakiye: <strong>{display(history.balance)}</strong>
          </p>
          <div className="table-scroll">
            <table className="cloud-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Açıklama</th>
                  <th>Borç</th>
                  <th>Alacak</th>
                  <th>Bakiye</th>
                </tr>
              </thead>
              <tbody>
                {history.entries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.bookedOn}</td>
                    <td>{e.reason}</td>
                    <td>{display(e.debit)}</td>
                    <td>{display(e.credit)}</td>
                    <td>{display(e.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <h3>Kasa / banka / POS bakiyeleri</h3>
      <div className="table-scroll">
        <table className="cloud-table">
          <thead>
            <tr>
              <th>Hesap</th>
              <th>Tür</th>
              <th>Bakiye</th>
              <th>Hareketler</th>
            </tr>
          </thead>
          <tbody>
            {funds.map((f) => (
              <tr key={f.id}>
                <td>{f.label}</td>
                <td>{f.kind}</td>
                <td>{display(f.balance)}</td>
                <td>
                  <Button onClick={() => setFundId(f.id)}>
                    Hareket geçmişi
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {fundId && (
        <div className="table-scroll">
          <table className="cloud-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>İşlem</th>
                <th>Referans</th>
                <th>Tutar</th>
                <th>Düzeltme</th>
              </tr>
            </thead>
            <tbody>
              {funds
                .find((f) => f.id === fundId)
                ?.movements.map((m) => (
                  <tr key={m.id}>
                    <td>{m.bookedOn}</td>
                    <td>{m.kind}</td>
                    <td>{m.reference}</td>
                    <td>{display(m.amount)}</td>
                    <td>
                      {can("finance.approve") && m.kind !== "REVERSE" && (
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const reason = window.prompt(
                                "Ters kayıt gerekçesi (en az 3 karakter)",
                              );
                              if (!reason || reason.trim().length < 3)
                                throw Error("Gerekçe gerekli.");
                              await call("finance/reversals", "POST", {
                                journalId: m.journalId,
                                idempotencyKey: crypto.randomUUID(),
                                bookedOn: new Date().toISOString().slice(0, 10),
                                reason,
                              });
                              setRevision((v) => v + 1);
                            })
                          }
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
      )}
      {can("finance.approve") && (
        <>
          <h3>Para hesabı ve açılış</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await call("finance/funds", "POST", {
                  kind: String(f.get("kind")),
                  label: String(f.get("label")),
                });
                setRevision((v) => v + 1);
              });
            }}
          >
            <label>
              Hesap türü
              <select name="kind">
                <option value="CASH">Kasa</option>
                <option value="BANK">Banka</option>
                <option value="POS">POS bekleyen</option>
              </select>
            </label>
            <label>
              Hesap adı
              <input name="label" required minLength={2} />
            </label>
            <Button disabled={busy}>Para hesabı oluştur</Button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(() =>
                record("OPEN", "fund-opening", {
                  fundAccountId: String(f.get("fund")),
                  amount: turkishMoney(String(f.get("amount"))),
                  bookedOn: turkishDate(String(f.get("date"))),
                }),
              );
            }}
          >
            <label>
              Açılış hesabı
              <select name="fund">
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Açılış tutarı
              <input required name="amount" inputMode="decimal" />
            </label>
            <label>
              Açılış tarihi
              <input required name="date" defaultValue={dateText()} />
            </label>
            <Button disabled={busy || !!pending}>Açılışı kaydet</Button>
          </form>
          <h3>Onaylı tedarikçi borç belgesi</h3>
          <p>Bu kayıt onaylı borç belgesidir. PO onayı borç oluşturmaz.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                const account = await call("finance/accounts", "POST", {
                  kind: "SUPPLIER",
                  partyId: String(f.get("supplier")),
                });
                await record("DEBT", "debt", {
                  accountId: account.id,
                  amount: turkishMoney(String(f.get("amount"))),
                  bookedOn: turkishDate(String(f.get("date"))),
                  dueOn: turkishDate(String(f.get("due"))),
                  externalRef: String(f.get("ref")),
                  reason: "Onaylı tedarikçi borç belgesi",
                });
              });
            }}
          >
            <label>
              Tedarikçi
              <select name="supplier" required>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Belge brüt tutarı
              <input required name="amount" inputMode="decimal" />
            </label>
            <label>
              Belge tarihi
              <input required name="date" defaultValue={dateText()} />
            </label>
            <label>
              Belge vadesi
              <input required name="due" defaultValue={dateText()} />
            </label>
            <label>
              Belge referansı
              <input name="ref" required minLength={3} maxLength={200} />
            </label>
            <Button disabled={busy || !!pending}>
              Onaylayarak borç kaydet
            </Button>
          </form>
          <h3>POS banka settlement</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(() =>
                record("SETTLE", "settle", {
                  sourceJournalId: String(f.get("source")),
                  fundAccountId: String(f.get("bank")),
                  amount: turkishMoney(String(f.get("amount"))),
                  fee: turkishMoney(String(f.get("fee"))),
                  externalRef: String(f.get("ref")),
                  bookedOn: turkishDate(String(f.get("date"))),
                }),
              );
            }}
          >
            <label>
              POS tahsilat journal referansı
              <select name="source" required>
                {funds
                  .filter((f) => f.kind === "POS")
                  .flatMap((f) =>
                    f.movements
                      .filter((m) => m.kind === "COLLECT")
                      .map((m) => (
                        <option key={m.id} value={m.journalId}>
                          {m.reference} — {display(m.amount)}
                        </option>
                      )),
                  )}
              </select>
            </label>
            <label>
              Settlement banka hesabı
              <select name="bank">
                {funds
                  .filter((f) => f.kind === "BANK")
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Settlement brüt
              <input required name="amount" inputMode="decimal" />
            </label>
            <label>
              Komisyon
              <input
                required
                name="fee"
                inputMode="decimal"
                defaultValue="0,00"
              />
            </label>
            <label>
              Settlement tarihi
              <input required name="date" defaultValue={dateText()} />
            </label>
            <label>
              Banka settlement referansı
              <input name="ref" required minLength={3} maxLength={200} />
            </label>
            <Button disabled={busy || !!pending}>Settlement kaydet</Button>
          </form>
        </>
      )}
    </section>
  );
}
