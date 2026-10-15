"use client";
import { useState } from "react";
import { CompassScene } from "./compass-scene";
import { motion } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  TrendingUp,
  Clock3,
  CalendarDays,
  ChevronRight,
  ArrowRight,
  ReceiptText,
  ArrowDownRight,
  X,
} from "lucide-react";
import {
  dateLabel,
  dateRange,
  localISO,
  money,
  saleAmounts,
  tryValue,
} from "@/lib/finance";
import { products, segments } from "@/lib/mock";
import type { DemoData, Sale } from "@/lib/types";
import { Button } from "./ui/button";
const colors = ["#12aaa0", "#6387ef", "#b5a2ed"];
export function Dashboard({
  data,
  onSale,
  onCustomer,
  onCost = () => {},
  onNewCustomer = () => {},
}: {
  data: DemoData;
  onSale: () => void;
  onCustomer: (id: string) => void;
  onCost?: () => void;
  onNewCustomer?: () => void;
}) {
  const [compass, setCompass] = useState(() => {
    try {
      return localStorage.getItem("pusula.compass") !== "off";
    } catch {
      return true;
    }
  });
  const [metric, setMetric] = useState("");
  const [activity, setActivity] = useState("Tüm faaliyetler");
  const [period, setPeriod] = useState("Bu ay");
  const today = localISO();
  const [start, setStart] = useState(today.slice(0, 7) + "-01");
  const [end, setEnd] = useState(today);
  const [from, to] = dateRange(period, today, start, end);
  const valid = Boolean(from && to && from <= to);
  const sales = data.sales.filter(
    (s) =>
      (activity === "Tüm faaliyetler" || s.activity === activity) &&
      s.date >= from &&
      s.date <= to &&
      valid,
  );
  const payables = data.payables.filter(
    (s) =>
      (activity === "Tüm faaliyetler" || s.activity === activity) &&
      s.date >= from &&
      s.date <= to &&
      valid,
  );
  const sum = (key: "total" | "profit" | "balance" | "paid", items = sales) =>
    items.reduce(
      (n, s) =>
        n + tryValue(saleAmounts(s, products)[key], s.currency, s.rateSnapshot),
      0,
    );
  const total = sum("total");
  const balance = sum("balance");
  const paid = sum("paid");
  const debt = payables.reduce((n, p) => n + p.amount - p.paid, 0);
  const late = sales.filter((s) => s.dueDate < today);
  const upcoming = sales
    .filter((s) => saleAmounts(s, products).balance > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const soon = new Date(today + "T12:00:00");
  soon.setDate(soon.getDate() + 7);
  const days = valid
    ? Math.max(
        1,
        Math.round(
          (new Date(to).getTime() - new Date(from).getTime()) / 86400000,
        ) + 1,
      )
    : 1;
  const prevEnd = new Date(from + "T12:00:00");
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  const previousSales = data.sales.filter(
    (s) =>
      (activity === "Tüm faaliyetler" || s.activity === activity) &&
      s.date >= localISO(prevStart) &&
      s.date <= localISO(prevEnd) &&
      valid,
  );
  const previousPayables = data.payables.filter(
    (p) =>
      (activity === "Tüm faaliyetler" || p.activity === activity) &&
      p.date >= localISO(prevStart) &&
      p.date <= localISO(prevEnd) &&
      valid,
  );
  const soonPayments = (items: typeof payables) =>
    items
      .filter((p) => p.dueDate >= today && p.dueDate <= localISO(soon))
      .reduce((n, p) => n + p.amount - p.paid, 0);
  const stats = [
    {
      title: "Toplam satış",
      value: total,
      caption: `${sales.length} satış işlemi`,
      icon: TrendingUp,
      trend: "Dönem toplamı",
      primary: true,
      previous: sum("total", previousSales),
      tone: "teal",
      key: "total" as const,
    },
    {
      title: "Brüt kâr",
      value: sum("profit"),
      caption: "KDV hariç · kayıtlı maliyet",
      icon: Wallet,
      previous: sum("profit", previousSales),
      tone: "purple",
      key: "profit" as const,
      trend: total
        ? `%${Math.round((sum("profit") / total) * 100)} kâr payı`
        : "Henüz satış yok",
    },
    {
      title: "Toplam alacak",
      value: balance,
      caption: "Tahsil edilmeyi bekleyen",
      icon: ArrowDownLeft,
      previous: sum("balance", previousSales),
      tone: "blue",
      key: "balance" as const,
      trend: `${upcoming.length} açık işlem`,
    },
    {
      title: "Toplam borç",
      value: debt,
      caption: "Tedarikçi bakiyesi",
      icon: ArrowUpRight,
      previous: previousPayables.reduce((n, p) => n + p.amount - p.paid, 0),
      tone: "amber",
      key: "debt" as const,
      trend: `${payables.filter((p) => p.amount > p.paid).length} açık ödeme`,
    },
    {
      title: "Gecikmiş tahsilatlar",
      value: sum("balance", late),
      caption: "Vadesi geçen açık tutarlar",
      icon: Clock3,
      previous: sum(
        "balance",
        previousSales.filter((s) => s.dueDate < today),
      ),
      tone: "rose",
      key: "overdue" as const,
    },
    {
      title: "Yaklaşan ödemeler",
      value: soonPayments(payables),
      caption: "Önümüzdeki 7 gün",
      icon: CalendarDays,
      previous: soonPayments(previousPayables),
      tone: "cyan",
      key: "upcoming" as const,
    },
    {
      title: "Nakit durumu",
      value: sales.reduce(
        (n, s) =>
          n +
          tryValue(
            s.payments
              .filter((p) => p.method === "Nakit")
              .reduce((a, p) => a + p.amount, 0),
            s.currency,
            s.rateSnapshot,
          ),
        0,
      ),
      caption: "Demo nakit tahsilatı · kasa entegrasyonu yok",
      icon: Wallet,
      previous: previousSales.reduce(
        (n, s) =>
          n +
          tryValue(
            s.payments
              .filter((p) => p.method === "Nakit")
              .reduce((a, p) => a + p.amount, 0),
            s.currency,
            s.rateSnapshot,
          ),
        0,
      ),
      tone: "teal",
      key: "cash" as const,
    },
    {
      title: "Aktif işler",
      value: 0,
      caption: "İş emri modülü henüz aktif değil",
      icon: ReceiptText,
      previous: 0,
      tone: "purple",
      key: "jobs" as const,
    },
  ];
  const monthKeys =
    period === "Özel tarih aralığı" && valid
      ? [
          ...new Set([
            from.slice(0, 7),
            ...sales.map((s) => s.date.slice(0, 7)),
            to.slice(0, 7),
          ]),
        ].sort()
      : Array.from(
          { length: 12 },
          (_, m) => today.slice(0, 4) + "-" + String(m + 1).padStart(2, "0"),
        );
  const months = monthKeys.map((key) => {
    const items = sales.filter((s) => s.date.startsWith(key));
    return {
      name: new Date(key + "-01T12:00:00").toLocaleDateString("tr-TR", {
        month: "short",
        ...(period === "Özel tarih aralığı"
          ? { year: "2-digit" as const }
          : {}),
      }),
      Reklam: sum(
        "total",
        items.filter((s) => s.activity === "Reklam"),
      ),
      Yazılım: sum(
        "total",
        items.filter((s) => s.activity === "Yazılım"),
      ),
    };
  });
  const segmentData = segments.map((name) => ({
    name,
    value: sum(
      "total",
      sales.filter(
        (s) =>
          data.customers.find((c) => c.id === s.customerId)?.segment === name,
      ),
    ),
  }));
  function transaction(s: Sale) {
    const c = data.customers.find((c) => c.id === s.customerId);
    const a = saleAmounts(s, products);
    return (
      <tr key={s.id} onClick={() => onCustomer(s.customerId)}>
        <td>
          <button
            className="customer-cell"
            onClick={() => onCustomer(s.customerId)}
          >
            <span className="avatar">
              {c?.name.slice(0, 2).toLocaleUpperCase("tr")}
            </span>
            <span>
              <b>{c?.name}</b>
              <small>{s.id}</small>
            </span>
          </button>
        </td>
        <td>
          <span className="activity-dot" />
          {s.activity}
        </td>
        <td>{dateLabel(s.date)}</td>
        <td className="numeric">{money(a.total, s.currency)}</td>
        <td>
          <span
            className={`badge ${a.balance === 0 ? "success" : s.dueDate < today ? "danger" : "warning"}`}
          >
            {a.balance === 0
              ? "Tahsil edildi"
              : s.dueDate < today
                ? "Gecikmiş"
                : "Kısmi / Bekliyor"}
          </span>
        </td>
        <td>
          <ChevronRight size={16} />
        </td>
      </tr>
    );
  }
  return (
    <div className="dashboard-experience">
      {compass && <CompassScene background />}
      <div className="dashboard-masthead">
        <span>
          <span className="live-dot" /> PUSULA KONTROL MERKEZİ
        </span>
        <button
          className="text-button"
          aria-pressed={compass}
          onClick={() => {
            setCompass(!compass);
            try {
              localStorage.setItem("pusula.compass", compass ? "off" : "on");
            } catch {}
          }}
        >
          {compass ? "Pusula hareketini kapat" : "Pusula görünümünü aç"}
        </button>
      </div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">İŞLETMENİZİN FİNANSAL ROTASI</div>
          <h1>
            Genel bakış<span className="heading-dot">.</span>
          </h1>
          <p>Hoş geldin Deniz, işletmenin nabzını birlikte tutalım.</p>
        </div>
        <Button onClick={onSale}>
          <span>+</span> Yeni satış
        </Button>
      </div>
      <div className="quick-actions">
        <button onClick={onSale}>
          <ReceiptText size={18} />
          <span>
            <b>Yeni satış</b>
            <small>İlk adımdan tahsilata</small>
          </span>
          <ArrowUpRight size={16} />
        </button>
        <button onClick={onNewCustomer}>
          <ArrowDownLeft size={18} />
          <span>
            <b>Müşteri ekle</b>
            <small>İlişkilerinize yeni bir yön</small>
          </span>
          <ArrowUpRight size={16} />
        </button>
        <button onClick={onCost}>
          <Wallet size={18} />
          <span>
            <b>Maliyet hesapla</b>
            <small>Üretimden gerçek kâra</small>
          </span>
          <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="filter-bar">
        <div className="segmented">
          {["Tüm faaliyetler", "Reklam", "Yazılım"].map((a) => (
            <button
              key={a}
              className={a === activity ? "selected" : ""}
              onClick={() => setActivity(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="date-filter">
          <CalendarDays size={16} />
          <select
            aria-label="Tarih filtresi"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {["Bugün", "Bu hafta", "Bu ay", "Bu yıl", "Özel tarih aralığı"].map(
              (p) => (
                <option key={p}>{p}</option>
              ),
            )}
          </select>
          <span>
            {dateLabel(from)} – {dateLabel(to)}
          </span>
        </div>
      </div>
      {period === "Özel tarih aralığı" && (
        <div className="custom-dates">
          <label>
            Başlangıç
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Bitiş
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          {!valid && (
            <p className="error">Bitiş tarihi başlangıçtan önce olamaz.</p>
          )}
        </div>
      )}
      <div className="stats-grid">
        {stats.map(
          ({ title, value, caption, icon: Icon, previous, tone, key }) => (
            <motion.section key={title} className={`stat-card tone-${tone}`}>
              <div className="stat-top">
                <span>{title}</span>
                <span className="stat-icon">
                  <Icon size={23} />
                </span>
              </div>
              <strong>{key === "jobs" ? value : money(value)}</strong>
              <div className="stat-caption">{caption}</div>
              <div className="stat-bottom">
                <span>
                  <ArrowUpRight size={13} />
                  {previous === 0
                    ? value === 0
                      ? "Değişim yok"
                      : "Önceki dönemde kayıt yok"
                    : `${value >= previous ? "+" : ""}${(((value - previous) / Math.abs(previous)) * 100).toFixed(1)}% önceki döneme göre`}
                </span>
                <svg viewBox="0 0 100 28" aria-hidden="true">
                  <path
                    d={(() => {
                      const vals = Array.from({ length: 7 }, (_, i) => {
                        const a = new Date(from + "T12:00:00");
                        a.setDate(a.getDate() + Math.floor((days * i) / 7));
                        const b = new Date(from + "T12:00:00");
                        b.setDate(
                          b.getDate() + Math.floor((days * (i + 1)) / 7) - 1,
                        );
                        const items = sales.filter(
                          (s) => s.date >= localISO(a) && s.date <= localISO(b),
                        );
                        if (key === "debt" || key === "upcoming") {
                          const debts = payables.filter(
                            (p) =>
                              p.date >= localISO(a) && p.date <= localISO(b),
                          );
                          return key === "upcoming"
                            ? soonPayments(debts)
                            : debts.reduce((n, p) => n + p.amount - p.paid, 0);
                        }
                        if (key === "jobs") return 0;
                        if (key === "cash")
                          return items.reduce(
                            (n, s) =>
                              n +
                              tryValue(
                                s.payments
                                  .filter((p) => p.method === "Nakit")
                                  .reduce((a, p) => a + p.amount, 0),
                                s.currency,
                                s.rateSnapshot,
                              ),
                            0,
                          );
                        return sum(
                          key === "total" || key === "profit" ? key : "balance",
                          key === "overdue"
                            ? items.filter((s) => s.dueDate < today)
                            : items,
                        );
                      });
                      const max = Math.max(1, ...vals.map(Math.abs));
                      return vals
                        .map(
                          (v, i) =>
                            `${i ? "L" : "M"}${(i * 100) / 6} ${24 - (v / max) * 20}`,
                        )
                        .join(" ");
                    })()}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <button className="stat-detail" onClick={() => setMetric(title)}>
                {title} detayları <ArrowUpRight size={13} />
              </button>
            </motion.section>
          ),
        )}
      </div>
      <div className="alert-strip">
        <div>
          <span className="status-icon danger">
            <Clock3 size={17} />
          </span>
          <span>
            Gecikmiş tahsilatlar <strong>{money(sum("balance", late))}</strong>
          </span>
          <span className="muted">
            {late.filter((s) => saleAmounts(s, products).balance > 0).length}{" "}
            işlem
          </span>
        </div>
        <div>
          <span className="status-icon warning">
            <CalendarDays size={17} />
          </span>
          <span>
            Yaklaşan ödemeler{" "}
            <strong>
              {money(
                payables
                  .filter(
                    (p) => p.dueDate >= today && p.dueDate <= localISO(soon),
                  )
                  .reduce((n, p) => n + p.amount - p.paid, 0),
              )}
            </strong>
          </span>
          <span className="muted">Önümüzdeki 7 gün</span>
        </div>
      </div>
      <div className="chart-row">
        <section className="panel sales-chart">
          <div className="panel-heading">
            <div>
              <h2>Satış performansı</h2>
              <p>Faaliyetlere göre aylık gelir dağılımı</p>
            </div>
            <span className="subtle-label">
              {period === "Özel tarih aralığı"
                ? `${from.slice(0, 4)} – ${to.slice(0, 4)}`
                : today.slice(0, 4)}{" "}
              <ArrowDownRight size={14} />
            </span>
          </div>
          <div className="chart-legend">
            <span>
              <i style={{ background: colors[0] }} />
              Reklam
            </span>
            <span>
              <i style={{ background: colors[1] }} />
              Yazılım
            </span>
            <b>{money(total)}</b>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={months}
                margin={{ left: 0, right: 10, top: 15, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="teal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="4 5"
                  stroke="var(--line)"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#8c98a7" }}
                />
                <YAxis
                  tickFormatter={(v) => `${v / 1000}b`}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#8c98a7" }}
                  width={45}
                />
                <Tooltip
                  formatter={(v) => money(Number(v))}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Reklam"
                  stroke={colors[0]}
                  strokeWidth={2.5}
                  fill="url(#teal)"
                />
                <Area
                  type="monotone"
                  dataKey="Yazılım"
                  stroke={colors[1]}
                  strokeWidth={2.5}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel collection-panel">
          <div className="panel-heading">
            <div>
              <h2>Tahsilat durumu</h2>
              <p>Satışlarınızın ödeme özeti</p>
            </div>
            <span className="icon-tile small">
              <Wallet size={18} />
            </span>
          </div>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={185}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Tahsil edilen", value: paid },
                    { name: "Bekleyen", value: balance },
                    ...(total === 0 ? [{ name: "Veri yok", value: 1 }] : []),
                  ]}
                  dataKey="value"
                  innerRadius={65}
                  outerRadius={82}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={3}
                  stroke="none"
                >
                  <Cell fill={colors[0]} />
                  <Cell fill="var(--line)" />
                  <Cell fill="var(--line)" />
                </Pie>
                <Tooltip formatter={(v) => money(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <small>Tahsilat oranı</small>
              <strong>%{total ? Math.round((paid / total) * 100) : 0}</strong>
            </div>
          </div>
          <div className="collection-line">
            <span>
              <i style={{ background: colors[0] }} />
              Tahsil edilen
            </span>
            <b>{money(paid)}</b>
          </div>
          <div className="collection-line">
            <span>
              <i style={{ background: "var(--line)" }} />
              Bekleyen
            </span>
            <b>{money(balance)}</b>
          </div>
        </section>
      </div>
      <div className="secondary-charts">
        <section className="panel compact-chart">
          <div className="panel-heading">
            <div>
              <h2>Gelir kaynakları</h2>
              <p>Reklam ve yazılım faaliyetleri</p>
            </div>
            <span className="badge neutral">TRY</span>
          </div>
          <ResponsiveContainer width="100%" height={105}>
            <BarChart
              data={[
                {
                  name: "Reklam",
                  value: sum(
                    "total",
                    sales.filter((s) => s.activity === "Reklam"),
                  ),
                },
                {
                  name: "Yazılım",
                  value: sum(
                    "total",
                    sales.filter((s) => s.activity === "Yazılım"),
                  ),
                },
              ]}
              layout="vertical"
              margin={{ left: 0, right: 25 }}
            >
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                width={65}
                tick={{ fill: "var(--muted)", fontSize: 12 }}
              />
              <Tooltip formatter={(v) => money(Number(v))} />
              <Bar dataKey="value" barSize={16} radius={[0, 4, 4, 0]}>
                {colors.slice(0, 2).map((c) => (
                  <Cell key={c} fill={c} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
        <section className="panel segment-panel">
          <div className="panel-heading">
            <div>
              <h2>Müşteri segmentleri</h2>
              <p>Toplam satış içindeki payları</p>
            </div>
          </div>
          <div className="segment-track">
            {segmentData.map((s, i) => (
              <div
                key={s.name}
                style={{
                  width: `${total ? (s.value / total) * 100 : 33.33}%`,
                  background: colors[i],
                }}
                title={`${s.name}: ${money(s.value)}`}
              />
            ))}
          </div>
          <div className="segment-labels">
            {segmentData.map((s, i) => (
              <div key={s.name}>
                <span>
                  <i style={{ background: colors[i] }} />
                  {s.name}
                </span>
                <b>%{total ? Math.round((s.value / total) * 100) : 0}</b>
                <small>{money(s.value)}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="bottom-row">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>Son işlemler</h2>
              <p>Seçili dönemdeki son satış hareketleri</p>
            </div>
            <span className="subtle-label">{sales.length} işlem</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Müşteri / İşlem</th>
                  <th>Faaliyet</th>
                  <th>Tarih</th>
                  <th className="numeric">Tutar</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...sales]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 5)
                  .map(transaction)}
              </tbody>
            </table>
            {!sales.length && (
              <div className="empty">
                <ReceiptText />
                <p>Bu filtrelerle eşleşen işlem yok.</p>
              </div>
            )}
          </div>
        </section>
        <section className="panel upcoming-panel">
          <div className="panel-heading">
            <div>
              <h2>Bekleyen tahsilatlar</h2>
              <p>Vade tarihine göre sıralı</p>
            </div>
            <Clock3 size={18} />
          </div>
          {upcoming.slice(0, 4).map((s) => (
            <button
              className="upcoming-item"
              key={s.id}
              onClick={() => onCustomer(s.customerId)}
            >
              <span
                className={`due-dot ${s.dueDate < today ? "overdue" : ""}`}
              />
              <span>
                <b>{data.customers.find((c) => c.id === s.customerId)?.name}</b>
                <small className={s.dueDate < today ? "error" : ""}>
                  {dateLabel(s.dueDate)} {s.dueDate < today ? "· Gecikmiş" : ""}
                </small>
              </span>
              <strong>
                {money(saleAmounts(s, products).balance, s.currency)}
              </strong>
              <ArrowRight size={14} />
            </button>
          ))}
          {!upcoming.length && (
            <div className="empty">Bekleyen tahsilat yok.</div>
          )}
        </section>
      </div>
      <p className="data-note">
        USD tutarları her işlemin kayıtlı kuruyla çevrilir. Önceki dönem, aynı
        uzunluktaki önceki tarih aralığıdır. v0.1 demo kayıtları tarihsel örnek
        snapshot’larıyla korunur.
      </p>
      <Dialog.Root
        open={!!metric}
        onOpenChange={(v) => {
          if (!v) setMetric("");
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="drawer-overlay" />
          <Dialog.Content className="drawer detail-drawer">
            <header className="drawer-head">
              <div>
                <Dialog.Title>{metric}</Dialog.Title>
                <Dialog.Description>
                  Seçili faaliyet ve tarih aralığındaki kayıtlar ·{" "}
                  {dateLabel(from)} – {dateLabel(to)}
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="icon-button"
                aria-label="Finans detayını kapat"
              >
                <X size={20} />
              </Dialog.Close>
            </header>
            <div className="drawer-body">
              {metric === "Aktif işler" ? (
                <div className="empty">
                  Henüz iş emri kaydı yok. Üretim modülü sonraki sürümde
                  geliştirilecek.
                </div>
              ) : metric === "Toplam borç" || metric === "Yaklaşan ödemeler" ? (
                <div className="detail-transactions">
                  {payables
                    .filter(
                      (p) =>
                        metric !== "Yaklaşan ödemeler" ||
                        (p.dueDate >= today && p.dueDate <= localISO(soon)),
                    )
                    .map((p) => (
                      <div key={p.id}>
                        <span>
                          <b>Tedarikçi ödemesi · {p.id}</b>
                          <small>
                            Vade: {dateLabel(p.dueDate)} · {p.activity}
                          </small>
                        </span>
                        <strong>{money(p.amount - p.paid)}</strong>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Müşteri / İşlem</th>
                        <th>Faaliyet</th>
                        <th>Tarih</th>
                        <th>Tutar</th>
                        <th>Durum</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sales
                        .filter(
                          (s) =>
                            (metric !== "Gecikmiş tahsilatlar" ||
                              s.dueDate < today) &&
                            (metric !== "Nakit durumu" ||
                              s.payments.some((p) => p.method === "Nakit")),
                        )
                        .map(transaction)}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="data-note">
                {metric}:{" "}
                {money(stats.find((s) => s.title === metric)?.value ?? 0)} ·
                Kart tutarları kayıtlı kur ve maliyet snapshot’larından
                hesaplanır.
              </p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
