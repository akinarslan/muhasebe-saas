"use client";
import { createId, copyValue } from "@/lib/runtime";

import Link from "next/link";
import { motion } from "motion/react";
import { WorkspaceSkeleton } from "./workspace-skeleton";
import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  Truck,
  Calculator,
  Boxes,
  Factory,
  ChartNoAxesCombined,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
  ArrowUpRight as External,
  ShieldCheck,
  Command,
  Menu,
  X,
  Compass,
  CheckCircle2,
} from "lucide-react";
import { createDemo, emptyDraft, entity, user, products } from "@/lib/mock";
import type { Customer, DemoData, Draft, Sale } from "@/lib/types";
import { Dashboard } from "./dashboard";
import { SaleForm } from "./sale-form";
import { Customers, CustomerDetail } from "./customers";
import { CustomerDrawer } from "./customer-drawer";
import { Button } from "./ui/button";
import { initialPricingCatalog } from "@/lib/pricing";
import { migrateDemo, migrateDraft, repairCustomers } from "@/lib/migrate";
import { seedCatalog } from "@/lib/catalog-seed";
import type {
  PricingCatalog,
  RateSnapshot,
  CostSnapshot,
} from "@/lib/pricing-types";
import { RatePanel } from "./rate-panel";
import { PricingWorkspace, type QuoteArchive } from "./pricing-workspace";
const navigation = [
  { name: "Genel Bakış", icon: LayoutDashboard },
  { name: "Satışlar", icon: ShoppingBag },
  { name: "Müşteriler ve Cari", icon: Users },
  { name: "Alacaklar", icon: ArrowDownLeft },
  { name: "Borçlar", icon: ArrowUpRight },
  { name: "Tedarikçiler", icon: Truck },
  { name: "Teklif ve Maliyet", icon: Calculator },
  { name: "Malzeme Yönetimi", icon: Boxes },
  { name: "Stok", icon: Boxes },
  { name: "Üretim ve İş Emirleri", icon: Factory },
  { name: "Raporlar", icon: ChartNoAxesCombined },
  { name: "Kullanıcılar ve Yetkiler", icon: ShieldCheck },
  { name: "Ayarlar", icon: Settings },
];
const DATA_KEY = "pusula.demo.v1";
const DRAFT_KEY = "pusula.draft.v1";
const subscribe = () => () => {};
function readInitial() {
  let data = createDemo();
  let draft = emptyDraft();
  let dark = false;
  let error = "";
  let catalog = initialPricingCatalog();
  let quotes: QuoteArchive[] = [];
  try {
    if (!localStorage.getItem("pusula.backup.v020")) {
      const original = Object.fromEntries(
        [
          "pusula.demo.v1",
          "pusula.draft.v1",
          "pusula.pricing.v2",
          "pusula.quotes.v2",
        ].map((k) => [k, localStorage.getItem(k)]),
      );
      if (Object.values(original).some(Boolean))
        localStorage.setItem(
          "pusula.backup.v020",
          JSON.stringify({ at: new Date().toISOString(), original }),
        );
    }
  } catch {
    error =
      "Yerel yedek oluşturulamadı; tarayıcı depolama alanını kontrol edin.";
  }
  try {
    const stored = localStorage.getItem(DATA_KEY);
    if (stored) {
      const v = JSON.parse(stored);
      if (
        v.version === 1 &&
        Array.isArray(v.customers) &&
        Array.isArray(v.sales) &&
        Array.isArray(v.payables)
      )
        data = v;
      else throw Error("format");
    }
    const storedDraft = localStorage.getItem(DRAFT_KEY);
    if (storedDraft) {
      const v = JSON.parse(storedDraft);
      if (
        Array.isArray(v.lines) &&
        Array.isArray(v.plans) &&
        typeof v.customerId === "string"
      )
        draft = { ...draft, ...v };
      else throw Error("format");
    }
    dark = localStorage.getItem("pusula.theme") === "dark";
    const savedCatalog = localStorage.getItem("pusula.pricing.v2");
    if (savedCatalog) {
      const v = JSON.parse(savedCatalog);
      if (
        v.version === 2 &&
        Array.isArray(v.materials) &&
        Array.isArray(v.expenses)
      )
        catalog = v;
    }
    const savedQuotes = localStorage.getItem("pusula.quotes.v2");
    if (savedQuotes) {
      const v = JSON.parse(savedQuotes);
      if (Array.isArray(v)) quotes = v;
    }
  } catch {
    error = "Saklanan demo verisi okunamadı. Örnek veriler yüklendi.";
  }
  return {
    data: migrateDemo(repairCustomers(data)),
    draft: migrateDraft(draft),
    dark,
    error,
    catalog: seedCatalog(catalog),
    quotes,
  };
}
export function Workspace() {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return ready ? <LoadedWorkspace /> : <WorkspaceSkeleton />;
}
function LoadedWorkspace() {
  const [initial] = useState(readInitial);
  const [data, setDataState] = useState<DemoData>(initial.data);
  const [draft, setDraftState] = useState<Draft>(initial.draft);
  const [page, setPage] = useState("Genel Bakış");
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(initial.dark);
  const [drawer, setDrawer] = useState(false);
  const [detail, setDetail] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [popup, setPopup] = useState("");
  const [storageError, setStorageError] = useState(initial.error);
  const [catalog, setCatalogState] = useState(initial.catalog);
  const [quotes, setQuotes] = useState(initial.quotes);
  const [rate, setRate] = useState<RateSnapshot | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    { "Finans ve satış": true, "Üretim ve operasyon": true, Yönetim: true },
  );
  function setCatalog(value: PricingCatalog) {
    setCatalogState(value);
    persist("pusula.pricing.v2", value);
  }
  function saveQuote(snapshot: CostSnapshot) {
    const next = [
      ...quotes,
      {
        id: createId(),
        name: `Maliyet teklifi #${quotes.length + 1}`,
        snapshot: copyValue(snapshot),
      },
    ];
    setQuotes(next);
    persist("pusula.quotes.v2", next);
    setToast("Teklifin maliyet ve kur snapshot’ı kaydedildi.");
  }
  function persist(key: string, value: unknown) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value, (_k, v) =>
          typeof v === "number" && !Number.isFinite(v) ? null : v,
        ),
      );
    } catch {
      setStorageError(
        "Tarayıcı kaydı yapılamadı. Değişiklikler yenilemede kaybolabilir.",
      );
    }
  }
  function setData(value: DemoData) {
    setDataState(value);
    persist(DATA_KEY, value);
  }
  function setDraft(value: Draft) {
    setDraftState(value);
    persist(DRAFT_KEY, value);
  }
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("pusula.theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
      if (e.key === "Escape") {
        setPopup("");
        setMobile(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const openDetail = useCallback((id: string) => setDetail(id), []);
  function navigate(name: string) {
    setPage(name);
    setMobile(false);
    setPopup("");
    setSearch("");
  }
  function saveCustomer(c: Customer) {
    if (!data || !draft) return;
    setData({ ...data, customers: [...data.customers, c] });
    if (page === "Satışlar")
      setDraft({ ...draft, customerId: c.id, segment: c.segment });
    setDrawer(false);
    setToast(
      `${c.name} eklendi${page === "Satışlar" ? " ve satış için seçildi" : ""}.`,
    );
  }
  function saveSale(s: Sale) {
    if (!data) return;
    setData({ ...data, sales: [s, ...data.sales] });
    setDraft(emptyDraft());
    setToast("Demo satış kaydedildi. Finansal özetler güncellendi.");
    navigate("Genel Bakış");
  }
  if (!data || !draft) return <WorkspaceSkeleton />;
  const matches = search
    ? data.customers
        .filter((c) =>
          c.name
            .toLocaleLowerCase("tr")
            .includes(search.toLocaleLowerCase("tr")),
        )
        .slice(0, 5)
    : [];
  return (
    <div className={`app-shell ${collapsed ? "is-collapsed" : ""}`}>
      <a className="skip-link" href="#main">
        İçeriğe geç
      </a>
      {mobile && (
        <button
          className="mobile-overlay"
          aria-label="Menüyü kapat"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("Genel Bakış")}
          aria-label="Pusula ana sayfa"
        >
          <span className="brand-mark">
            <Compass size={27} />
          </span>
          <span className="brand-name">
            pusula<span>İŞLETMENİZİN ROTASI</span>
          </span>
        </button>
        <button
          className="workspace-selector"
          onClick={() => setPopup((p) => (p === "company" ? "" : "company"))}
          aria-expanded={popup === "company"}
        >
          <span className="company-monogram">P</span>
          <span className="nav-text">
            <b>Pusula Reklam</b>
            <small>Çalışma alanı</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-group-label">ÇALIŞMA ALANI</div>
        <nav aria-label="Ana gezinme">
          {["Finans ve satış", "Üretim ve operasyon", "Yönetim"].map(
            (group, groupIndex) => (
              <div className="nav-group" key={group}>
                <button
                  className="nav-group-toggle"
                  aria-expanded={expandedGroups[group]}
                  onClick={() =>
                    setExpandedGroups({
                      ...expandedGroups,
                      [group]: !expandedGroups[group],
                    })
                  }
                >
                  <span>{group}</span>
                  <ChevronDown size={13} />
                </button>
                {(expandedGroups[group] || collapsed) &&
                  navigation
                    .slice(
                      groupIndex === 0 ? 0 : groupIndex === 1 ? 5 : 10,
                      groupIndex === 0 ? 5 : groupIndex === 1 ? 10 : 13,
                    )
                    .map(({ name, icon: Icon }) => (
                      <button
                        key={name}
                        aria-label={name}
                        className={`nav-item ${page === name ? "active" : ""}`}
                        onClick={() => navigate(name)}
                        title={collapsed ? name : undefined}
                        aria-current={page === name ? "page" : undefined}
                      >
                        <Icon size={19} />
                        <span className="nav-text">{name}</span>
                        {name === "Satışlar" && (
                          <span className="nav-count nav-text">
                            {data.sales.length}
                          </span>
                        )}
                        {page === name && <span className="active-dot" />}
                      </button>
                    ))}
              </div>
            ),
          )}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/login" className="sidebar-profile">
            <span className="avatar user-avatar">DY</span>
            <span>
              <b>Deniz Yılmaz</b>
              <small>Demo giriş tasarımı ↗</small>
            </span>
          </Link>
          <div className="demo-card">
            <span>
              <span className="live-dot" /> DEMO ÇALIŞMA ALANI
            </span>
            <p>Büyük işler, net hesaplar.</p>
            <small>Üretimden kâra · v0.2.2</small>
          </div>
          <button
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          >
            {collapsed ? (
              <PanelLeftOpen size={19} />
            ) : (
              <PanelLeftClose size={19} />
            )}
            <span className="nav-text">Menüyü daralt</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Menüyü aç"
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </button>
          <div className="top-company">
            <span className="status-dot" />
            <button
              onClick={() =>
                setPopup((p) => (p === "company" ? "" : "company"))
              }
              aria-expanded={popup === "company"}
            >
              {entity.name}
              <ChevronDown size={13} />
            </button>
            <span className="badge neutral">Demo</span>
          </div>
          <div className="top-search">
            <Search size={17} />
            <input
              id="global-search"
              placeholder="Müşteri ara…"
              aria-label="Global müşteri arama"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>
              <Command size={11} /> K
            </kbd>
            {search && (
              <div className="search-results">
                {matches.length ? (
                  matches.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setDetail(c.id);
                        setSearch("");
                      }}
                    >
                      {c.name}
                      <ChevronRight size={15} />
                    </button>
                  ))
                ) : (
                  <p>Sonuç bulunamadı.</p>
                )}
                <button
                  onClick={() => {
                    setListSearch(search);
                    navigate("Müşteriler ve Cari");
                  }}
                >
                  Müşteri listesinde ara <External size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button notification-button"
              aria-label="Bildirimleri göster"
              aria-expanded={popup === "notifications"}
              onClick={() =>
                setPopup((p) => (p === "notifications" ? "" : "notifications"))
              }
            >
              <Bell size={19} />
              <i />
            </button>
            <div className="top-divider" />
            <button
              className="profile-button"
              onClick={() =>
                setPopup((p) => (p === "profile" ? "" : "profile"))
              }
              aria-expanded={popup === "profile"}
            >
              <span className="avatar user-avatar">DY</span>
              <span>
                <b>Deniz Yılmaz</b>
                <small>Yönetici</small>
              </span>
              <ChevronDown size={13} />
            </button>
          </div>
          {popup && (
            <div className="top-popup">
              <button
                className="icon-button popup-close"
                aria-label="Bilgi kutusunu kapat"
                onClick={() => setPopup("")}
              >
                <X size={15} />
              </button>
              {popup === "company" ? (
                <>
                  <b>{entity.name}</b>
                  <p>Bu prototipte tek demo firma bulunur.</p>
                  <span className="badge success">Aktif çalışma alanı</span>
                </>
              ) : popup === "profile" ? (
                <>
                  <b>{user.name}</b>
                  <p>{user.role} · Demo kullanıcı</p>
                  <small>
                    Bu sürümde oturum açma ve hesap yönetimi bulunmaz.
                  </small>
                </>
              ) : (
                <>
                  <b>Bildirimler</b>
                  <p>Demo çalışma alanınız hazır.</p>
                  <small>
                    Satışlar ve müşteri bakiyeleri aynı kayıtlardan güncellenir.
                  </small>
                </>
              )}
            </div>
          )}
        </header>
        <main id="main" className="main-content">
          {storageError && (
            <div className="storage-alert" role="alert">
              {storageError}
              <button
                onClick={() => setStorageError("")}
                aria-label="Uyarıyı kapat"
              >
                <X size={15} />
              </button>
            </div>
          )}
          {["Satışlar", "Teklif ve Maliyet", "Malzeme Yönetimi"].includes(
            page,
          ) && <RatePanel rate={rate} onChange={setRate} />}
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            {page === "Genel Bakış" ? (
              <Dashboard
                data={data}
                onSale={() => navigate("Satışlar")}
                onCustomer={openDetail}
                onCost={() => navigate("Teklif ve Maliyet")}
                onNewCustomer={() => setDrawer(true)}
              />
            ) : page === "Satışlar" ? (
              <SaleForm
                draft={draft}
                setDraft={setDraft}
                customers={data.customers}
                onNewCustomer={() => setDrawer(true)}
                onSave={saveSale}
                catalog={catalog}
                onCatalogChange={setCatalog}
                rate={rate}
                productCatalog={[...products, ...(data.customProducts ?? [])]}
                onNewProduct={(p) => {
                  setData({
                    ...data,
                    customProducts: [...(data.customProducts ?? []), p],
                  });
                  setToast("Yeni ürün kataloğa eklendi; taslak korundu.");
                }}
              />
            ) : page === "Teklif ve Maliyet" || page === "Malzeme Yönetimi" ? (
              <PricingWorkspace
                key={page}
                catalog={catalog}
                onCatalogChange={setCatalog}
                rate={rate}
                quotes={quotes}
                onSaveQuote={saveQuote}
                initialTab={
                  page === "Malzeme Yönetimi" ? "materials" : "calculator"
                }
              />
            ) : page === "Müşteriler ve Cari" ? (
              <Customers
                key={listSearch}
                data={data}
                onNew={() => setDrawer(true)}
                onDetail={openDetail}
                initialSearch={listSearch}
              />
            ) : (
              <>
                <div className="page-heading">
                  <div className="eyebrow">ÇALIŞMA ALANI</div>
                  <h1>
                    {page}
                    <span className="heading-dot">.</span>
                  </h1>
                </div>
                <section className="coming-soon panel">
                  <span className="coming-icon">
                    {(() => {
                      const Icon = navigation.find(
                        (n) => n.name === page,
                      )!.icon;
                      return <Icon size={34} />;
                    })()}
                  </span>
                  <span className="badge neutral">YAKINDA</span>
                  <h2>Yeni bir rota hazırlanıyor.</h2>
                  <p>
                    {page} modülü sonraki sürümde çalışma alanınıza eklenecek.
                    <br />
                    Bu sürümde genel bakış, satış ve müşteri yönetimini
                    keşfedebilirsiniz.
                  </p>
                  <Button onClick={() => navigate("Genel Bakış")}>
                    Genel bakışa dön <ChevronRight size={16} />
                  </Button>
                </section>
              </>
            )}
          </motion.div>
          <footer className="app-footer">
            <span>
              <ShieldCheck size={13} /> Demo veriler · Gerçek para hareketi veya
              resmî muhasebe kaydı oluşturulmaz.
            </span>
            <span>
              Pusula © {new Date().getFullYear()} <i /> v0.2.2
            </span>
          </footer>
        </main>
      </div>
      <CustomerDrawer
        open={drawer}
        onOpenChange={setDrawer}
        customers={data.customers}
        onSave={saveCustomer}
      />
      {detail && (
        <CustomerDetail
          key={detail}
          id={detail}
          data={data}
          onClose={() => setDetail("")}
        />
      )}{" "}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} />
          {toast}
          <button aria-label="Bildirimi kapat" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
