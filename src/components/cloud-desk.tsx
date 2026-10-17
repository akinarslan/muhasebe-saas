"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Compass,
  Users,
  Package,
  Receipt,
  FileText,
  Cloud,
  ShieldCheck,
  Plus,
  X,
  RefreshCw,
  Upload,
  Building2,
  Coins,
} from "lucide-react";
import { CustomerDrawer } from "./customer-drawer";
import { CostCalculator } from "./cost-calculator";
import { Button } from "./ui/button";
import { NumericInput } from "./ui/numeric-input";
import { SignOut } from "./auth-form";
import { StepUpVerification } from "./step-up-verification";
import { createId } from "@/lib/runtime";
import { money } from "@/lib/finance";
import type { Customer } from "@/lib/types";
import type {
  CostSnapshot,
  CostUnit,
  PricingCatalog,
  RateSnapshot,
} from "@/lib/pricing-types";

type Metadata = {
  companies: { id: string; name: string }[];
  activities: { id: string; name: string; legalEntityId: string }[];
};
type CloudCustomer = Customer & {
  active: boolean;
  version: number;
  activityId: string | null;
};
type Variant = {
  id: string;
  name: string;
  widthCm: string;
  lengthCm: string | null;
  inStock: boolean;
  active: boolean;
  usdCost?: string | null;
  priceVersion: number;
};
type Material = {
  id: string;
  name: string;
  unit: string;
  roll: boolean;
  category: string;
  brand: string;
  supplierReference: string;
  sku: string;
  description: string;
  vat: string;
  margins: { left: number; right: number; top: number; bottom: number };
  active: boolean;
  version: number;
  activityId: string | null;
  variants: Variant[];
};
type Product = {
  id: string;
  name: string;
  unit: string;
  kind: string;
  category: string;
  active: boolean;
  version: number;
  activityId: string | null;
};
type Expense = {
  id: string;
  name: string;
  unit: string;
  usdAmount?: string;
  active: boolean;
  version: number;
  activityId: string | null;
};
type Document = {
  id: string;
  customerId: string;
  title?: string;
  revision?: number;
  totalTry: string;
  netTry: string;
  vatTry: string;
  costUsd?: string;
  createdAt: string;
  snapshot?: unknown;
  lines?: unknown;
  plans?: { dueDate: string; method: string; amount: string }[];
};
type ImportPreview = {
  id: string;
  fileHash: string;
  status: string;
  preview: {
    counts: Record<string, number>;
    entries: { sourceId: string; kind: string; status: string }[];
  };
  reconciliation?: unknown;
};
type Loaded = {
  actions: string[];
  customers: CloudCustomer[];
  materials: Material[];
  products: Product[];
  expenses: Expense[];
  quotes: Document[];
  sales: Document[];
};
const empty: Loaded = {
  actions: [],
  customers: [],
  materials: [],
  products: [],
  expenses: [],
  quotes: [],
  sales: [],
};
class CloudError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(`/api/cloud/${path}`, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = await r.json();
  if (!r.ok) throw new CloudError(value.error ?? "SERVICE_UNAVAILABLE");
  return value;
}
const errorText = (e: unknown) =>
  e instanceof CloudError
    ? ({
        FORBIDDEN: "Bu işlem için yetkiniz yok.",
        STEP_UP_REQUIRED:
          "Devam etmek için parola ve TOTP doğrulaması gerekli.",
        VERSION_CONFLICT:
          "Kayıt başka bir oturumda değişti. Listeyi yenileyin; girdileriniz korunuyor.",
        CUSTOMER_DUPLICATE: "Bu isim veya vergi numarasıyla kayıt mevcut.",
        EXCHANGE_RATE_UNAVAILABLE:
          "TCMB erişilemiyor. Kayıt yapılmadı; taslak korunuyor.",
        COST_CALCULATION_INVALID:
          "Ölçü, uygun rulo, maliyet ve kâr oranını kontrol edin.",
        IMPORT_REQUIRES_REVIEW:
          "Hatalı veya tarihsel finansal kayıtlar var. Aktarım yapılmadı.",
      }[e.code] ?? `İşlem tamamlanmadı (${e.code}). Girdileriniz korunuyor.`)
    : "Bulut bağlantısı kurulamadı. İşlem tamamlanmadı; girdileriniz korunuyor.";
const modules = [
  { id: "customers", name: "Müşteriler", icon: Users },
  { id: "materials", name: "Malzemeler", icon: Package },
  { id: "products", name: "Ürünler", icon: Package },
  { id: "expenses", name: "Giderler", icon: Coins },
  { id: "quotes", name: "Teklifler", icon: FileText },
  { id: "sales", name: "Satışlar", icon: Receipt },
  { id: "imports", name: "Veri aktarımı", icon: Upload },
];
export function CloudDesk() {
  const rateGeneration = useRef(0);
  const [editorKey, setEditorKey] = useState(createId);
  const [metadata, setMetadata] = useState<Metadata>({
      companies: [],
      activities: [],
    }),
    [company, setCompany] = useState(""),
    [activity, setActivity] = useState(""),
    [tab, setTab] = useState("customers"),
    [data, setData] = useState<Loaded>(empty),
    [revision, setRevision] = useState(0),
    [loadedScope, setLoadedScope] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false),
    [editingCustomer, setEditingCustomer] = useState<CloudCustomer>(),
    [editor, setEditor] = useState<{
      kind: string;
      row?: Material | Product | Expense;
      material?: Material;
      variant?: Variant;
    } | null>(null),
    [history, setHistory] = useState<
      | {
          id: string;
          recordedAt: string;
          previousUsd: string | null;
          nextUsd: string;
          actorId: string;
        }[]
      | null
    >(null),
    [details, setDetails] = useState<Document | null>(null);
  const [job, setJob] = useState(false),
    [jobKey, setJobKey] = useState(createId),
    [customerId, setCustomerId] = useState(""),
    [productId, setProductId] = useState(""),
    [width, setWidth] = useState(135),
    [height, setHeight] = useState(200),
    [quantity, setQuantity] = useState(1),
    [snapshot, setSnapshot] = useState<CostSnapshot | null>(null),
    [jobLines, setJobLines] = useState<
      {
        productId: string;
        description: string;
        quantity: number;
        widthCm: number;
        heightCm: number;
        discount: number;
        vat: number;
        zeroCostConfirmed: boolean;
        costing: CostSnapshot["input"];
      }[]
    >([]),
    [rate, setRate] = useState<RateSnapshot | null>(null),
    [manualRates, setManualRates] = useState<
      {
        id: string;
        usdTry: string;
        publishedAt: string;
        createdAt: string;
        reason: string;
      }[]
    >([]),
    [selectedRate, setSelectedRate] = useState("tcmb"),
    [rateError, setRateError] = useState(""),
    [previousId, setPreviousId] = useState<string>(),
    [title, setTitle] = useState(""),
    [plans, setPlans] = useState<
      { dueDate: string; method: string; amount: string }[]
    >([]),
    [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<ImportPreview | null>(null),
    [manualPrice, setManualPrice] = useState(""),
    [manualMaterial, setManualMaterial] = useState(""),
    [manualVariant, setManualVariant] = useState(""),
    [zeroCostConfirmed, setZeroCostConfirmed] = useState(false),
    [importText, setImportText] = useState(""),
    [stepUp, setStepUp] = useState(false),
    [switchTarget, setSwitchTarget] = useState<{
      kind: "customer" | "scope";
      value: string;
    } | null>(null);
  const scope = { legalEntityId: company, activityId: activity || null },
    scopeKey = `${company}:${activity}`,
    ready = loadedScope === scopeKey,
    can = (action: string) => ready && data.actions.includes(action),
    query = `company=${company}${activity ? `&activity=${activity}` : ""}`;
  useEffect(() => {
    let active = true;
    api("context")
      .then((m: Metadata) => {
        if (active) {
          setMetadata(m);
          setCompany(m.companies[0]?.id ?? "");
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!company) return;
    let active = true;
    const q = `company=${company}${activity ? `&activity=${activity}` : ""}`;
    api(`workspace/capabilities?${q}`)
      .then(async (cap: { actions: string[] }) => {
        const fetchList = (kind: string, permission: string) =>
          cap.actions.includes(permission)
            ? api(`workspace/${kind}?${q}`)
            : Promise.resolve([]);
        const [customers, materials, products, expenses, quotes, sales] =
          await Promise.all([
            fetchList("customers", "customers.view"),
            fetchList("catalog", "materials.view"),
            fetchList("products", "products.view"),
            fetchList("expenses", "expenses.view"),
            fetchList("quotes", "quotes.view"),
            fetchList("sales", "sales.view"),
          ]);
        if (active) {
          setData({
            actions: cap.actions,
            customers,
            materials,
            products,
            expenses,
            quotes,
            sales,
          });
          setLoadedScope(`${company}:${activity}`);
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [company, activity, revision]);
  const reload = () => setRevision((v) => v + 1);
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
      if (e instanceof CloudError && e.code === "STEP_UP_REQUIRED")
        setStepUp(true);
    } finally {
      setBusy(false);
    }
  };
  async function refreshRate() {
    const generation = ++rateGeneration.current;
    if (can("exchange.view"))
      try {
        setManualRates(await api(`workspace/rates?${query}`));
      } catch {
        setManualRates([]);
      }
    if (selectedRate !== "tcmb") return;
    try {
      const r = await fetch("/api/exchange-rate", { cache: "no-store" }).then(
        (r) => r.json(),
      );
      if (!r.rate || r.stale || r.rate.source !== "tcmb") throw new Error();
      if (generation === rateGeneration.current) {
        setRate(r.rate);
        setRateError("");
      }
    } catch {
      if (generation === rateGeneration.current)
        setRateError("Güncel TCMB kuru alınamadı. Kayıt için yeniden deneyin.");
    }
  }
  const catalog: PricingCatalog = {
    version: 2,
    materials: data.materials.map((m) => ({
      id: m.id,
      name: m.name,
      unit: (
        {
          square_meter: "m²",
          linear_meter: "metretül",
          piece: "adet",
          sheet: "plaka",
        } as Record<string, CostUnit>
      )[m.unit],
      roll: m.roll,
      active: m.active,
      margins: m.margins,
      variants: m.variants.map((v) => ({
        id: v.id,
        name: v.name,
        widthCm: Number(v.widthCm),
        ...(v.lengthCm ? { lengthCm: Number(v.lengthCm) } : {}),
        inStock: v.inStock,
        archived: !v.active,
        usdCost:
          v.usdCost === undefined || v.usdCost === null
            ? null
            : Number(v.usdCost),
        history: [],
      })),
    })),
    expenses: data.expenses
      .filter((e) => e.active && e.usdAmount !== undefined)
      .map((e) => ({
        id: e.id,
        name: e.name,
        unit: e.unit,
        usdAmount: Number(e.usdAmount),
      })),
  };
  function resetJob() {
    rateGeneration.current++;
    setJob(false);
    setJobLines([]);
    setSnapshot(null);
    setCustomerId("");
    setProductId("");
    setJobKey(createId());
    setPreviousId(undefined);
    setTitle("");
    setPlans([]);
    setSelectedRate("tcmb");
    setRate(null);
    setManualRates([]);
  }
  function switchCustomer(value: string) {
    if (value === customerId) return;
    if (jobLines.length || snapshot) {
      setSwitchTarget({ kind: "customer", value });
      return;
    }
    setCustomerId(value);
  }
  async function saveCustomer(customer: Customer) {
    setError("");
    const { id, tenantId, legalEntityId, ...fields } = customer;
    void id;
    void tenantId;
    void legalEntityId;
    try {
      const r = await api(
        `workspace/customers${editingCustomer ? `/${editingCustomer.id}` : ""}`,
        editingCustomer ? "PATCH" : "POST",
        {
          ...fields,
          ...scope,
          ...(editingCustomer
            ? {
                version: editingCustomer.version,
                active: editingCustomer.active,
                activityId: editingCustomer.activityId,
              }
            : { idempotencyKey: customer.id }),
        },
      );
      setCustomerOpen(false);
      setEditingCustomer(undefined);
      if (job && !editingCustomer) switchCustomer(r.id);
      setNotice("Müşteri Neon'a kaydedildi.");
      reload();
    } catch (e) {
      setError(errorText(e));
      throw e;
    }
  }
  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form),
      text = (k: string) => {
        const value = String(f.get(k) ?? "");
        if (
          value === "NaN" &&
          form
            .querySelector<HTMLInputElement>(
              `input[type="hidden"][name="${k}"]`,
            )
            ?.closest("label")
            ?.querySelector<HTMLInputElement>('input[role="spinbutton"]')
            ?.value === ""
        )
          return "";
        return value;
      },
      number = (k: string) => Number(text(k).replace(",", ".")),
      active = f.get("active") === "on",
      e = editor;
    if (!e) return;
    await run(async () => {
      let path = e.kind,
        method = e.row ? "PATCH" : "POST",
        payload: object = {};
      const base = {
        ...scope,
        ...(e.row ? { activityId: e.row.activityId } : {}),
        ...(e.row
          ? { version: e.row.version }
          : { idempotencyKey: text("idempotencyKey") }),
      };
      if (e.kind === "activities") {
        payload = { ...scope, name: text("name") };
      }
      if (e.kind === "products")
        payload = {
          ...base,
          name: text("name"),
          category: text("category"),
          unit: text("unit"),
          kind: text("kind"),
          active,
        };
      if (e.kind === "expenses")
        payload = {
          ...base,
          name: text("name"),
          unit: text("unit"),
          usdAmount: text("usdAmount").replace(",", "."),
          active,
        };
      if (e.kind === "materials") {
        const row = e.row as Material | undefined;
        payload = {
          ...base,
          name: text("name"),
          unit: text("unit"),
          roll: f.get("roll") === "on",
          category: text("category"),
          brand: text("brand"),
          supplierReference: text("supplierReference"),
          sku: text("sku"),
          description: text("description"),
          vat: number("vat"),
          margins: {
            left: number("left"),
            right: number("right"),
            top: number("top"),
            bottom: number("bottom"),
          },
          active,
          ...(!row
            ? {
                variants: [
                  {
                    name: text("variant"),
                    widthCm: number("widthCm"),
                    ...(text("lengthCm")
                      ? { lengthCm: number("lengthCm") }
                      : {}),
                    inStock: f.get("inStock") === "on",
                    usdCost: text("usdAmount")
                      ? text("usdAmount").replace(",", ".")
                      : null,
                  },
                ],
              }
            : {}),
        };
      }
      if (e.kind === "variant") {
        path = `materials/${e.material!.id}/variants`;
        method = "POST";
        payload = {
          ...scope,
          name: text("name"),
          widthCm: number("widthCm"),
          ...(text("lengthCm") ? { lengthCm: number("lengthCm") } : {}),
          inStock: f.get("inStock") === "on",
          usdCost: text("usdAmount")
            ? text("usdAmount").replace(",", ".")
            : null,
        };
      }
      if (e.kind === "cost") {
        path = `variants/${e.variant!.id}/cost`;
        method = "PATCH";
        payload = {
          ...scope,
          usdCost: text("usdAmount").replace(",", "."),
          priceVersion: e.variant!.priceVersion,
        };
      }
      await api(
        `workspace/${path}${e.row ? `/${e.row.id}` : ""}`,
        method,
        payload,
      );
      setEditor(null);
      setEditorKey(createId());
      setNotice("Kayıt Neon'a kaydedildi.");
      reload();
      if (e.kind === "activities") setMetadata(await api("context"));
    });
  }
  function addJobLine() {
    if (!snapshot || !productId) return;
    setJobLines([
      ...jobLines,
      {
        productId,
        description: data.products.find((p) => p.id === productId)?.name ?? "",
        quantity,
        widthCm: width,
        heightCm: height,
        discount: 0,
        vat: snapshot.input.vat,
        zeroCostConfirmed: false,
        costing: snapshot.input,
      },
    ]);
    setSnapshot(null);
    setProductId("");
  }
  async function saveDocument() {
    await run(async () => {
      if (!customerId || !jobLines.length)
        throw new CloudError("CUSTOMER_AND_LINES_REQUIRED");
      const lines = jobLines.map((l) => ({
        ...l,
        costing: {
          ...l.costing,
          expenses: l.costing.expenses.map((e) => ({
            typeId: e.typeId,
            quantity: e.quantity,
          })),
        },
      }));
      const base = {
        ...scope,
        customerId,
        idempotencyKey: jobKey,
        rate:
          selectedRate === "tcmb"
            ? { kind: "tcmb" }
            : { kind: "manual", id: selectedRate },
        lines,
      };
      const today = new Date().toISOString().slice(0, 10);
      await api(
        `workspace/${tab}`,
        "POST",
        tab === "quotes"
          ? {
              ...base,
              title: title || "Yeni teklif",
              ...(previousId ? { previousId } : {}),
            }
          : {
              ...base,
              date: today,
              dueDate,
              currency: "TRY",
              notes: title,
              plans,
            },
      );
      resetJob();
      reload();
      setNotice("Sunucuda yeniden hesaplandı ve Neon'a kaydedildi.");
    });
  }
  async function localPreview() {
    await run(async () => {
      const raw = localStorage.getItem("pusula.demo.v1");
      if (!raw) throw new CloudError("LOCAL_DATA_NOT_FOUND");
      const local = JSON.parse(raw);
      const records: {
        kind: string;
        sourceId: string;
        demo: boolean;
        data: object;
      }[] = (local.customers ?? []).map((c: Customer) => {
        const { id, tenantId, legalEntityId, ...fields } = c;
        void tenantId;
        void legalEntityId;
        return {
          kind: "customer",
          sourceId: id,
          demo: /^c\d+$/.test(id),
          data: fields,
        };
      });
      const pricingRaw = localStorage.getItem("pusula.pricing.v2");
      const pricing: PricingCatalog | null = pricingRaw
        ? JSON.parse(pricingRaw)
        : null;
      for (const m of pricing?.materials ?? [])
        records.push({
          kind: "material",
          sourceId: m.id,
          demo: m.id === "mat-folyo" || m.id.startsWith("seed-"),
          data: {
            name: m.name,
            unit: (
              {
                "m²": "square_meter",
                metretül: "linear_meter",
                adet: "piece",
                plaka: "sheet",
              } as Record<string, string>
            )[m.unit],
            roll: m.roll,
            category: m.category ?? "",
            brand: m.brand ?? "",
            supplierReference: m.supplierId ?? "",
            sku: m.sku ?? "",
            description: m.description ?? "",
            vat: m.vat ?? 20,
            margins: m.margins ?? { left: 2, right: 2, top: 2, bottom: 2 },
            active: m.active !== false && !m.archived,
            variants: m.variants.map((v) => ({
              name: v.name,
              widthCm: v.widthCm,
              ...(v.lengthCm ? { lengthCm: v.lengthCm } : {}),
              inStock: v.inStock && !v.needsConfirmation,
              active: !v.archived,
              usdCost: v.usdCost === null ? null : String(v.usdCost),
              ...(v.history.length ? { history: v.history } : {}),
            })),
          },
        });
      for (const p of local.customProducts ?? [])
        records.push({
          kind: "product",
          sourceId: p.id,
          demo: /^p\d+$/.test(p.id),
          data: {
            name: p.name,
            unit: p.unit,
            kind: p.print ? "manufacture" : "service",
            category: p.activity,
            active: true,
          },
        });
      const financialRecords =
        (local.sales ?? []).filter(
          (s: { legacyDemo?: boolean; rateSnapshot?: RateSnapshot }) =>
            !s.legacyDemo && s.rateSnapshot?.source !== "legacy-demo",
        ).length +
        JSON.parse(localStorage.getItem("pusula.quotes.v2") ?? "[]").filter(
          (q: { snapshot?: CostSnapshot }) =>
            q.snapshot?.rate.source !== "legacy-demo",
        ).length;
      setPreview(
        await api("workspace/imports/preview", "POST", {
          ...scope,
          records,
          financialRecords,
        }),
      );
    });
  }
  function exportLocal() {
    const keys = [
      "pusula.demo.v1",
      "pusula.pricing.v2",
      "pusula.quotes.v2",
      "pusula.draft.v1",
      "pusula.backup.v020",
    ];
    const raw = Object.fromEntries(
      keys.map((k) => [k, localStorage.getItem(k)]),
    );
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { version: 1, exportedAt: new Date().toISOString(), raw },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "pusula-local-reference.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const filteredCustomers = data.customers.filter((c) =>
    `${c.name} ${c.email} ${c.taxId ?? ""}`
      .toLocaleLowerCase("tr")
      .includes(search.toLocaleLowerCase("tr")),
  );
  const editorRow = editor?.row;
  return (
    <div className="cloud-shell">
      <aside className="cloud-sidebar">
        <Link className="cloud-brand" href="/app">
          <Compass />
          <span>
            PUSULA<small>BULUT ÇALIŞMA ALANI</small>
          </span>
        </Link>
        <p className="cloud-nav-label">İŞLETME</p>
        {modules.map((m) => (
          <button
            key={m.id}
            className="cloud-nav-button"
            aria-current={tab === m.id ? "page" : undefined}
            onClick={() => {
              if (job) {
                setError("Açık taslağı kaydedin veya kapatın.");
                return;
              }
              setTab(m.id);
              setSearch("");
            }}
          >
            <m.icon size={20} />
            {m.name}
          </button>
        ))}
        <Link href="/admin/users">
          <ShieldCheck size={20} />
          Kullanıcı yönetimi
        </Link>
        <Link href="/account/security">Hesap güvenliği</Link>
        <Link href="/">Demo alanı</Link>
        <div className="cloud-sidebar-foot">
          <Cloud size={16} /> Neon PostgreSQL
          <SignOut />
        </div>
      </aside>
      <main className="cloud-main">
        <header className="cloud-top">
          <span>
            <Cloud size={16} /> Gerçek bulut kayıtları · Demo verilerinden ayrı
          </span>
          <Button variant="outline" size="sm" disabled={busy} onClick={reload}>
            <RefreshCw size={15} />
            Yenile
          </Button>
        </header>
        <div className="cloud-heading">
          <div>
            <span className="eyebrow">PUSULA / İŞLETME</span>
            <h1>{modules.find((m) => m.id === tab)?.name}</h1>
            <p>
              İşletme kayıtlarınızı güvenli ve yetkili çalışma alanında yönetin.
            </p>
          </div>
          <div className="cloud-scope">
            <label>
              Şirket
              <select
                aria-label="Şirket"
                value={company}
                onChange={(e) => {
                  if (job)
                    setSwitchTarget({ kind: "scope", value: e.target.value });
                  else {
                    setCompany(e.target.value);
                    setActivity("");
                    setData(empty);
                    setPreview(null);
                  }
                }}
              >
                {metadata.companies.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Faaliyet
              <select
                aria-label="Faaliyet"
                disabled={job}
                value={activity}
                onChange={(e) => {
                  setActivity(e.target.value);
                  setData(empty);
                  setPreview(null);
                }}
              >
                <option value="">Şirket geneli</option>
                {metadata.activities
                  .filter((a) => a.legalEntityId === company)
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            {can("activities.manage") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditor({ kind: "activities" })}
              >
                <Building2 size={15} />
                Faaliyet ekle
              </Button>
            )}
          </div>
        </div>
        {error && (
          <div className="cloud-alert error" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="Hatayı kapat">
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <p className="cloud-alert" role="status">
            {notice}
          </p>
        )}
        {!ready ? (
          <div className="cloud-empty">Bulut kayıtları yükleniyor…</div>
        ) : (
          <>
            <div className="cloud-kpis">
              <article>
                <span className="icon-tile teal">
                  <Users />
                </span>
                <div>
                  <small>Erişilebilir müşteriler</small>
                  <strong>{data.customers.length}</strong>
                </div>
              </article>
              <article>
                <span className="icon-tile blue">
                  <Package />
                </span>
                <div>
                  <small>Malzeme kataloğu</small>
                  <strong>{data.materials.length}</strong>
                </div>
              </article>
              <article>
                <span className="icon-tile violet">
                  <FileText />
                </span>
                <div>
                  <small>Teklif kayıtları</small>
                  <strong>{data.quotes.length}</strong>
                </div>
              </article>
              <article>
                <span className="icon-tile amber">
                  <Receipt />
                </span>
                <div>
                  <small>Satış kayıtları</small>
                  <strong>{data.sales.length}</strong>
                </div>
              </article>
            </div>
            <section className="cloud-panel">
              <div className="cloud-toolbar">
                <h2>{modules.find((m) => m.id === tab)?.name}</h2>
                {can(`${tab}.create`) && tab !== "imports" && (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      if (tab === "customers") {
                        setEditingCustomer(undefined);
                        setCustomerOpen(true);
                      } else if (tab === "quotes" || tab === "sales") {
                        setJob(true);
                        setJobKey(createId());
                        void refreshRate();
                      } else setEditor({ kind: tab });
                    }}
                  >
                    <Plus size={16} />
                    Yeni{" "}
                    {tab === "customers"
                      ? "müşteri"
                      : tab === "quotes"
                        ? "teklif"
                        : tab === "sales"
                          ? "satış"
                          : "kayıt"}
                  </Button>
                )}
              </div>
              {!can(`${tab}.view`) && (
                <div className="cloud-empty">
                  Bu modülü görüntüleme yetkiniz yok.
                </div>
              )}
              {tab === "customers" && can("customers.view") && (
                <>
                  <label className="cloud-search">
                    Müşteri ara
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Ad, e-posta veya VKN"
                    />
                  </label>
                  <div className="table-scroll">
                    <table className="cloud-table">
                      <thead>
                        <tr>
                          <th>Müşteri</th>
                          <th>Segment</th>
                          <th>İletişim</th>
                          <th>Durum</th>
                          <th>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <b>{c.name}</b>
                              <small className="block">
                                {c.city} {c.district}
                              </small>
                            </td>
                            <td>{c.segment}</td>
                            <td>
                              {c.email}
                              <br />
                              {c.phone}
                            </td>
                            <td>
                              <span
                                className={`badge ${c.active ? "positive" : "neutral"}`}
                              >
                                {c.active ? "Aktif" : "Arşiv"}
                              </span>
                            </td>
                            <td>
                              {can("customers.edit") && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingCustomer(c);
                                      setCustomerOpen(true);
                                    }}
                                  >
                                    Detay / Düzenle
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      void run(async () => {
                                        const {
                                          id,
                                          tenantId,
                                          legalEntityId,
                                          activityId,
                                          version,
                                          ...fields
                                        } = c;
                                        void tenantId;
                                        void legalEntityId;
                                        await api(
                                          `workspace/customers/${id}`,
                                          "PATCH",
                                          {
                                            ...fields,
                                            ...scope,
                                            activityId,
                                            version,
                                            active: !c.active,
                                          },
                                        );
                                        reload();
                                      })
                                    }
                                  >
                                    {c.active ? "Arşivle" : "Aktifleştir"}
                                  </Button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!filteredCustomers.length && (
                    <div className="cloud-empty">
                      Müşteri bulunamadı. Demo müşterileri otomatik taşınmaz.
                    </div>
                  )}
                </>
              )}
              {tab === "materials" &&
                can("materials.view") &&
                data.materials.map((m) => (
                  <article className="cloud-material" key={m.id}>
                    <div className="label-row">
                      <div>
                        <h3>
                          <Package size={18} />
                          {m.name}
                        </h3>
                        <p>
                          {m.category} · {m.unit} ·{" "}
                          {m.active ? "Aktif" : "Arşiv"}
                        </p>
                      </div>
                      {can("materials.edit") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditor({ kind: "materials", row: m })
                          }
                        >
                          Düzenle
                        </Button>
                      )}
                      {can("materials.variants") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditor({ kind: "variant", material: m })
                          }
                        >
                          Varyant ekle
                        </Button>
                      )}
                    </div>
                    <div className="table-scroll">
                      <table className="cloud-table">
                        <thead>
                          <tr>
                            <th>Varyant</th>
                            <th>Ölçü</th>
                            <th>Stok durumu</th>
                            {can("materials.costView") && <th>USD alış</th>}
                            <th>İşlem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.variants.map((v) => (
                            <tr key={v.id}>
                              <td>{v.name}</td>
                              <td>
                                {v.widthCm} cm
                                {v.lengthCm ? ` × ${v.lengthCm} cm` : ""}
                              </td>
                              <td>{v.inStock ? "Mevcut" : "Yok"}</td>
                              {can("materials.costView") && (
                                <td>
                                  {v.usdCost ?? "Girilmedi"} USD / {m.unit}
                                </td>
                              )}
                              <td>
                                {can("materials.costEdit") && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setEditor({
                                        kind: "cost",
                                        material: m,
                                        variant: v,
                                      })
                                    }
                                  >
                                    USD maliyet
                                  </Button>
                                )}
                                {can("materials.history") &&
                                  can("materials.costView") && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        void run(async () =>
                                          setHistory(
                                            await api(
                                              `workspace/variants/${v.id}/history?${query}`,
                                            ),
                                          ),
                                        )
                                      }
                                    >
                                      Tarihçe
                                    </Button>
                                  )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
              {(tab === "products" || tab === "expenses") &&
                can(`${tab}.view`) && (
                  <div className="table-scroll">
                    <table className="cloud-table">
                      <thead>
                        <tr>
                          <th>Ad</th>
                          <th>Birim</th>
                          <th>Durum</th>
                          {tab === "expenses" && can("materials.costView") && (
                            <th>USD tutar</th>
                          )}
                          <th>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tab === "products"
                          ? data.products
                          : data.expenses
                        ).map((r) => (
                          <tr key={r.id}>
                            <td>
                              <b>{r.name}</b>
                            </td>
                            <td>{r.unit}</td>
                            <td>{r.active ? "Aktif" : "Arşiv"}</td>
                            {tab === "expenses" &&
                              can("materials.costView") && (
                                <td>{"usdAmount" in r ? r.usdAmount : ""}</td>
                              )}
                            <td>
                              {can(`${tab}.edit`) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setEditor({ kind: tab, row: r })
                                  }
                                >
                                  Düzenle / Arşivle
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              {(tab === "quotes" || tab === "sales") && can(`${tab}.view`) && (
                <>
                  <p className="cloud-note">
                    Satışlar ve ödeme planları gerçek tahsilat, kasa veya stok
                    hareketi oluşturmaz. Tarihsel kayıtlar yeniden fiyatlanmaz.
                  </p>
                  <div className="table-scroll">
                    <table className="cloud-table">
                      <thead>
                        <tr>
                          <th>Müşteri</th>
                          <th>Belge</th>
                          <th>Tarih</th>
                          <th>Genel toplam</th>
                          <th>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tab === "quotes" ? data.quotes : data.sales).map(
                          (d) => (
                            <tr key={d.id}>
                              <td>
                                {data.customers.find(
                                  (c) => c.id === d.customerId,
                                )?.name ?? "Yetki kapsamı dışında"}
                              </td>
                              <td>
                                {d.title ?? "Satış"}
                                {d.revision ? ` · v${d.revision}` : ""}
                              </td>
                              <td>
                                {new Date(d.createdAt).toLocaleDateString("tr")}
                              </td>
                              <td>{money(Number(d.totalTry))}</td>
                              <td>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDetails(d)}
                                >
                                  Detay
                                </Button>
                                {tab === "quotes" && can("quotes.create") && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setPreviousId(d.id);
                                      setCustomerId(d.customerId);
                                      setTitle(d.title ?? "");
                                      setJobKey(createId());
                                      setJob(true);
                                      void refreshRate();
                                    }}
                                  >
                                    Revizyon oluştur
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {tab === "imports" && can("imports.view") && (
                <div className="cloud-import">
                  <h3>Önizle · Kontrol et · Onayla</h3>
                  <p>
                    Yerel kayıtlarınız silinmez. Demo kayıtları hariç tutulur.
                    Finansal geçmişin doğrulanamadığı dosyalarda aktarım
                    engellenir.
                  </p>
                  {can("imports.create") && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => void localPreview()}
                      >
                        Bu tarayıcıdaki kayıtları önizle
                      </Button>
                      <Button variant="outline" onClick={exportLocal}>
                        Yerel kaynak yedeğini indir
                      </Button>
                      <label>
                        Aktarım dosyası (JSON)
                        <input
                          type="file"
                          accept="application/json,.json"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 60000) {
                                setError(
                                  "Dosya bu önizleme için çok büyük (60 KB).",
                                );
                                return;
                              }
                              setImportText(await file.text());
                              setPreview(null);
                            }
                          }}
                        />
                      </label>
                      <Button
                        disabled={!importText || busy}
                        onClick={() =>
                          void run(async () => {
                            const input = JSON.parse(importText);
                            setPreview(
                              await api("workspace/imports/preview", "POST", {
                                ...input,
                                ...scope,
                              }),
                            );
                          })
                        }
                      >
                        Dosyayı önizle
                      </Button>
                    </>
                  )}
                  {preview && (
                    <>
                      <h3>Aktarım özeti</h3>
                      <div className="cloud-preview">
                        {Object.entries(preview.preview.counts).map(
                          ([k, v]) => (
                            <p key={k}>
                              {(
                                {
                                  ready: "Hazır",
                                  foundCustomers: "Bulunan müşteri",
                                  foundMaterials: "Bulunan malzeme",
                                  foundProducts: "Bulunan ürün",
                                  foundSales: "Bulunan satış",
                                  foundQuotes: "Bulunan teklif",
                                  excluded: "Demo hariç",
                                  alreadyImported: "Önceden aktarılmış",
                                  invalid: "Geçersiz",
                                  financialNeedsReview:
                                    "Finansal inceleme gerekiyor",
                                } as Record<string, string>
                              )[k] ?? k}
                              : <b>{v}</b>
                            </p>
                          ),
                        )}
                      </div>
                      <div className="table-scroll">
                        <table className="cloud-table">
                          <thead>
                            <tr>
                              <th>Kaynak kayıt</th>
                              <th>Tür</th>
                              <th>Durum</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.preview.entries.map((r, i) => (
                              <tr key={i}>
                                <td>{r.sourceId}</td>
                                <td>{r.kind}</td>
                                <td>{r.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {can("imports.confirm") && (
                        <Button
                          disabled={
                            busy ||
                            !!preview.preview.counts.invalid ||
                            !!preview.preview.counts.financialNeedsReview ||
                            preview.status === "CONFIRMED"
                          }
                          onClick={() =>
                            void run(async () => {
                              const result = await api(
                                "workspace/imports/confirm",
                                "POST",
                                {
                                  ...scope,
                                  batchId: preview.id,
                                  fileHash: preview.fileHash,
                                  approved: true,
                                },
                              );
                              setPreview({
                                ...preview,
                                status: "CONFIRMED",
                                reconciliation: result.reconciliation,
                              });
                              setNotice(
                                "Aktarım tek transaction içinde tamamlandı. Yerel kayıtlar korundu.",
                              );
                              reload();
                            })
                          }
                        >
                          Önizlemeyi onayla ve aktar
                        </Button>
                      )}
                      {preview.reconciliation && (
                        <pre>
                          {JSON.stringify(preview.reconciliation, null, 2)}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <CustomerDrawer
        cloud
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        customer={editingCustomer}
        customers={data.customers}
        onSave={saveCustomer}
      />
      <Dialog.Root
        open={!!editor}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setEditor(null);
            setEditorKey(createId());
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="drawer cloud-user-drawer">
            <header className="drawer-header">
              <Dialog.Title>
                {editor?.kind === "cost"
                  ? "USD alış maliyetini güncelle"
                  : editor?.row
                    ? "Kaydı düzenle"
                    : "Yeni kayıt"}
              </Dialog.Title>
              <Dialog.Description>
                Şirket kapsamındaki kalıcı Neon kaydı. Birimler ve maliyetler
                açıkça belirtilir.
              </Dialog.Description>
              <Dialog.Close asChild>
                <Button variant="ghost" aria-label="Kapat">
                  <X />
                </Button>
              </Dialog.Close>
            </header>
            <form onSubmit={submitEditor}>
              <input
                type="hidden"
                name="idempotencyKey"
                defaultValue={editorKey}
              />
              <div className="cloud-user-body">
                {editor?.kind !== "cost" && (
                  <label>
                    Ad
                    <input
                      required
                      name="name"
                      defaultValue={editorRow?.name ?? ""}
                    />
                  </label>
                )}
                {["products", "materials"].includes(editor?.kind ?? "") && (
                  <label>
                    Kategori
                    <input
                      name="category"
                      defaultValue={
                        editorRow && "category" in editorRow
                          ? editorRow.category
                          : ""
                      }
                    />
                  </label>
                )}
                {editor?.kind === "products" && (
                  <>
                    <label>
                      Birim
                      <input
                        name="unit"
                        required
                        defaultValue={editorRow?.unit ?? "adet"}
                      />
                    </label>
                    <label>
                      Ürün türü
                      <select
                        name="kind"
                        defaultValue={
                          editorRow && "kind" in editorRow
                            ? editorRow.kind
                            : "manufacture"
                        }
                      >
                        <option value="manufacture">Üretim</option>
                        <option value="service">Hizmet</option>
                        <option value="resale">Ticari ürün</option>
                      </select>
                    </label>
                  </>
                )}
                {editor?.kind === "expenses" && (
                  <label>
                    Birim
                    <input
                      name="unit"
                      required
                      defaultValue={editorRow?.unit ?? "adet"}
                    />
                  </label>
                )}
                {editor?.kind === "materials" && (
                  <>
                    <label>
                      Maliyet birimi
                      <select
                        name="unit"
                        defaultValue={editorRow?.unit ?? "square_meter"}
                      >
                        <option value="square_meter">m²</option>
                        <option value="linear_meter">metretül</option>
                        <option value="piece">adet</option>
                        <option value="sheet">plaka</option>
                      </select>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        name="roll"
                        defaultChecked={
                          editorRow && "roll" in editorRow
                            ? editorRow.roll
                            : true
                        }
                      />
                      Rulo malzeme
                    </label>
                    {["brand", "supplierReference", "sku", "description"].map(
                      (k) => (
                        <label key={k}>
                          {
                            (
                              {
                                brand: "Marka",
                                supplierReference: "Tedarikçi referansı",
                                sku: "Stok kodu",
                                description: "Açıklama",
                              } as Record<string, string>
                            )[k]
                          }
                          <input
                            name={k}
                            defaultValue={String(
                              (editorRow as Material | undefined)?.[
                                k as keyof Material
                              ] ?? "",
                            )}
                          />
                        </label>
                      ),
                    )}
                    <label>
                      KDV %
                      <NumericInput
                        name="vat"
                        required
                        min={0}
                        max={100}
                        defaultValue={
                          (editorRow as Material | undefined)?.vat ?? 20
                        }
                      />
                    </label>
                    <div className="cloud-field-grid">
                      {["left", "right", "top", "bottom"].map((k) => (
                        <label key={k}>
                          {
                            (
                              {
                                left: "Sol",
                                right: "Sağ",
                                top: "Üst",
                                bottom: "Alt",
                              } as Record<string, string>
                            )[k]
                          }{" "}
                          pay (cm)
                          <NumericInput
                            name={k}
                            required
                            min={0}
                            max={100}
                            defaultValue={
                              (editorRow as Material | undefined)?.margins[
                                k as "left"
                              ] ?? 2
                            }
                          />
                        </label>
                      ))}
                    </div>
                    {!editorRow && (
                      <label>
                        İlk varyant adı
                        <input
                          name="variant"
                          required
                          placeholder="Örn. 152 cm"
                        />
                      </label>
                    )}
                  </>
                )}
                {(editor?.kind === "variant" ||
                  (editor?.kind === "materials" && !editorRow)) && (
                  <>
                    <div className="cloud-field-grid">
                      <label>
                        Genişlik (cm)
                        <NumericInput name="widthCm" min={0} required />
                      </label>
                      <label>
                        Plaka uzunluğu (cm)
                        <NumericInput name="lengthCm" min={0} />
                      </label>
                    </div>
                    <label>
                      <input type="checkbox" name="inStock" defaultChecked />
                      Stokta / kullanıma uygun
                    </label>
                  </>
                )}
                {(["cost", "expenses", "variant"].includes(
                  editor?.kind ?? "",
                ) ||
                  (editor?.kind === "materials" && !editorRow)) && (
                  <label>
                    USD alış / birim tutarı
                    <NumericInput
                      name="usdAmount"
                      min={0}
                      required={
                        editor?.kind === "cost" || editor?.kind === "expenses"
                      }
                      defaultValue={
                        editor?.variant?.usdCost ??
                        (editorRow && "usdAmount" in editorRow
                          ? editorRow.usdAmount
                          : "")
                      }
                    />
                    <small>
                      Elle girilir. Eski satış fiyatları maliyet olarak
                      kullanılmaz.
                    </small>
                  </label>
                )}
                {["products", "materials", "expenses"].includes(
                  editor?.kind ?? "",
                ) && (
                  <label>
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={editorRow?.active ?? true}
                    />
                    Aktif
                  </label>
                )}
                {error && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
              </div>
              <footer className="drawer-footer">
                <Button type="submit" disabled={busy}>
                  {busy ? "Kaydediliyor…" : "Neon'a kaydet"}
                </Button>
              </footer>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={job}
        onOpenChange={(open) => {
          if (!open && !busy) {
            if (jobLines.length || snapshot)
              setSwitchTarget({ kind: "scope", value: company });
            else resetJob();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="cloud-job-dialog">
            <header className="drawer-header">
              <div>
                <Dialog.Title>
                  {tab === "quotes"
                    ? "Teklif çalışma alanı"
                    : "Satış çalışma alanı"}
                </Dialog.Title>
                <Dialog.Description>
                  Maliyet USD, satış TRY. Kayıt sırasında sunucu güncel
                  maliyetlerle yeniden hesaplar.
                </Dialog.Description>
              </div>
              <Button
                variant="ghost"
                aria-label="Taslağı kapat"
                onClick={() => {
                  if (jobLines.length || snapshot)
                    setSwitchTarget({ kind: "scope", value: company });
                  else resetJob();
                }}
              >
                <X />
              </Button>
            </header>
            <div className="cloud-user-body">
              <div className="cloud-field-grid">
                <label>
                  Müşteri
                  <select
                    value={customerId}
                    onChange={(e) => switchCustomer(e.target.value)}
                  >
                    <option value="">Müşteri seçin</option>
                    {data.customers
                      .filter((c) => c.active)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </label>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingCustomer(undefined);
                    setCustomerOpen(true);
                  }}
                  disabled={!can("customers.create")}
                >
                  <Plus size={15} />
                  Yeni müşteri
                </Button>
                <label>
                  Başlık / Açıklama
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
              </div>
              <div className="cloud-rate">
                <label>
                  Kullanılacak kur
                  <select
                    value={selectedRate}
                    onChange={(e) => {
                      setSelectedRate(e.target.value);
                      rateGeneration.current++;
                      setSnapshot(null);
                      if (e.target.value === "tcmb") {
                        setRate(null);
                        setRateError("TCMB kurunu yenileyin.");
                      } else {
                        const r = manualRates.find(
                          (r) => r.id === e.target.value,
                        )!;
                        setRate({
                          source: "manual",
                          value: Number(r.usdTry),
                          publishedAt: r.publishedAt.slice(0, 10),
                          fetchedAt: r.createdAt,
                          reason: r.reason,
                        });
                        setRateError("");
                      }
                    }}
                  >
                    <option value="tcmb">TCMB son yayımlanan gösterge</option>
                    {manualRates.map((r) => (
                      <option key={r.id} value={r.id}>
                        Yetkili manuel: {r.usdTry} TL · {r.reason}
                      </option>
                    ))}
                  </select>
                </label>
                <b>
                  {rate?.source === "manual"
                    ? "Yetkili manuel USD/TRY"
                    : "TCMB USD döviz satış"}
                </b>{" "}
                {rate
                  ? `${rate.value} TL · Yayın ${rate.publishedAt} · Çekilme ${new Date(rate.fetchedAt).toLocaleString("tr")}`
                  : "Kur bekleniyor"}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void refreshRate()}
                >
                  Kuru yenile
                </Button>
                <small>
                  Son yayımlanan gösterge kurudur. Gerçek zamanlı piyasa kuru
                  değildir.
                </small>
                {rateError && <p className="error">{rateError}</p>}
              </div>
              <div className="cloud-field-grid">
                <label>
                  Ürün
                  <select
                    value={productId}
                    onChange={(e) => {
                      setProductId(e.target.value);
                      setSnapshot(null);
                    }}
                  >
                    <option value="">Ürün seçin</option>
                    {data.products
                      .filter((p) => p.active)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  En (cm)
                  <NumericInput
                    min={0.01}
                    value={width}
                    onChange={(e) => {
                      setWidth(Number(e.target.value));
                      setSnapshot(null);
                    }}
                  />
                </label>
                <label>
                  Boy (cm)
                  <NumericInput
                    min={0.01}
                    value={height}
                    onChange={(e) => {
                      setHeight(Number(e.target.value));
                      setSnapshot(null);
                    }}
                  />
                </label>
                <label>
                  Adet
                  <NumericInput
                    min={0.01}
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(Number(e.target.value));
                      setSnapshot(null);
                    }}
                  />
                </label>
              </div>
              {productId && can("materials.costView") && (
                <CostCalculator
                  key={`${productId}:${width}:${height}:${quantity}:${rate?.fetchedAt}`}
                  catalogReadOnly
                  catalog={catalog}
                  onCatalogChange={() => {}}
                  rate={rate}
                  onApply={setSnapshot}
                  width={width}
                  height={height}
                  quantity={quantity}
                />
              )}
              {!can("materials.costView") && (
                <div className="cloud-preview">
                  <p>
                    Maliyetler gizlidir. Satış fiyatını elle girin; tüketim
                    maliyeti sunucuda hesaplanır.
                  </p>
                  <div className="cloud-field-grid">
                    <label>
                      Malzeme
                      <select
                        value={manualMaterial}
                        onChange={(e) => {
                          setManualMaterial(e.target.value);
                          setManualVariant("");
                        }}
                      >
                        <option value="">Malzeme seçin</option>
                        {data.materials
                          .filter((m) => m.active)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Varyant
                      <select
                        value={manualVariant}
                        onChange={(e) => setManualVariant(e.target.value)}
                      >
                        <option value="">Varyant seçin</option>
                        {data.materials
                          .find((m) => m.id === manualMaterial)
                          ?.variants.filter((v) => v.active && v.inStock)
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} · {v.widthCm} cm
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Manuel net satış (USD, kalem toplamı)
                      <NumericInput
                        min={0.01}
                        value={manualPrice}
                        onChange={(e) => setManualPrice(e.target.value)}
                      />
                    </label>
                  </div>
                  {data.products.find((p) => p.id === productId)?.kind ===
                    "service" && (
                    <label>
                      <input
                        type="checkbox"
                        checked={zeroCostConfirmed}
                        onChange={(e) => setZeroCostConfirmed(e.target.checked)}
                      />
                      Bu hizmette malzeme ve gider maliyeti bulunmadığını
                      onaylıyorum
                    </label>
                  )}
                  <Button
                    disabled={
                      !productId ||
                      !Number(manualPrice) ||
                      (!manualVariant && !zeroCostConfirmed)
                    }
                    onClick={() => {
                      const m = data.materials.find(
                          (m) => m.id === manualMaterial,
                        ),
                        materials =
                          m && manualVariant
                            ? [
                                {
                                  id: createId(),
                                  materialId: m.id,
                                  variantId: manualVariant,
                                  widthCm: width,
                                  heightCm: height,
                                  quantity,
                                  left: m.margins.left,
                                  right: m.margins.right,
                                  top: m.margins.top,
                                  bottom: m.margins.bottom,
                                  reusableM2: 0,
                                },
                              ]
                            : [];
                      setJobLines([
                        ...jobLines,
                        {
                          productId,
                          description:
                            data.products.find((p) => p.id === productId)
                              ?.name ?? "",
                          quantity,
                          widthCm: width,
                          heightCm: height,
                          discount: 0,
                          vat: 20,
                          zeroCostConfirmed,
                          costing: {
                            materials,
                            expenses: [],
                            method: "margin",
                            targetPercent: 0,
                            manualNetUsd: Number(manualPrice),
                            vat: 20,
                          },
                        },
                      ]);
                      setManualPrice("");
                      setManualMaterial("");
                      setManualVariant("");
                      setProductId("");
                      setZeroCostConfirmed(false);
                    }}
                  >
                    Manuel fiyatlı kalemi ekle
                  </Button>
                </div>
              )}
              {snapshot && (
                <div className="cloud-preview">
                  Malzeme ve gider maliyeti: <b>{snapshot.totalCostUsd} USD</b>{" "}
                  · Seçilen fiyat <b>{snapshot.chosenNetUsd} USD</b>
                  <Button onClick={addJobLine}>Kalemi ekle</Button>
                </div>
              )}
              <h3>Belge kalemleri ({jobLines.length})</h3>
              {jobLines.map((l, i) => (
                <div className="label-row" key={i}>
                  <b>{l.description}</b>
                  <span>
                    {l.widthCm} × {l.heightCm} cm · {l.quantity} adet
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setJobLines(jobLines.filter((_, n) => n !== i))
                    }
                  >
                    Kaldır
                  </Button>
                </div>
              ))}
              {tab === "sales" && (
                <div>
                  <p className="cloud-note">
                    Tahsilat kaydı oluşturulmaz. Ödeme planları ayrı veri
                    modelinde saklanır.
                  </p>
                  <label>
                    Satış vadesi
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </label>
                  {plans.map((p, i) => (
                    <div className="cloud-field-grid" key={i}>
                      <label>
                        Plan tarihi
                        <input
                          type="date"
                          value={p.dueDate}
                          onChange={(e) =>
                            setPlans(
                              plans.map((r, n) =>
                                n === i ? { ...r, dueDate: e.target.value } : r,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Yöntem
                        <select
                          value={p.method}
                          onChange={(e) =>
                            setPlans(
                              plans.map((r, n) =>
                                n === i ? { ...r, method: e.target.value } : r,
                              ),
                            )
                          }
                        >
                          {[
                            "Nakit",
                            "Havale/EFT",
                            "Kredi kartı",
                            "Mail order",
                            "Çek",
                            "Senet",
                          ].map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Plan tutarı (TL)
                        <NumericInput
                          min={0.01}
                          value={p.amount}
                          onChange={(e) =>
                            setPlans(
                              plans.map((r, n) =>
                                n === i ? { ...r, amount: e.target.value } : r,
                              ),
                            )
                          }
                        />
                      </label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setPlans(plans.filter((_, n) => n !== i))
                        }
                      >
                        Planı kaldır
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() =>
                      setPlans([
                        ...plans,
                        { dueDate, method: "Havale/EFT", amount: "" },
                      ])
                    }
                  >
                    Ödeme planı ekle
                  </Button>
                </div>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <Button
                disabled={busy || !jobLines.length || !customerId || !rate}
                onClick={() => void saveDocument()}
              >
                {busy ? "Sunucuda doğrulanıyor…" : "Belgeyi Neon'a kaydet"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={!!switchTarget}
        onOpenChange={(open) => {
          if (!open) setSwitchTarget(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="confirm-dialog">
            <Dialog.Title>Taslak bilgileri temizlensin mi?</Dialog.Title>
            <Dialog.Description>
              Seçim değişikliği mevcut ürün, ölçü ve maliyet girdilerini
              temizler. Vazgeçerseniz taslağınız korunur.
            </Dialog.Description>
            <Button variant="outline" onClick={() => setSwitchTarget(null)}>
              Vazgeç
            </Button>
            <Button
              onClick={() => {
                if (switchTarget?.kind === "customer") {
                  setCustomerId(switchTarget.value);
                  setJobLines([]);
                  setSnapshot(null);
                  setJobKey(createId());
                } else if (switchTarget) {
                  resetJob();
                  setCompany(switchTarget.value);
                  setActivity("");
                  setData(empty);
                  setPreview(null);
                }
                setSwitchTarget(null);
              }}
            >
              Temizle ve devam et
            </Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={history !== null || details !== null}
        onOpenChange={(open) => {
          if (!open) {
            setHistory(null);
            setDetails(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="drawer cloud-user-drawer">
            <header className="drawer-header">
              <Dialog.Title>
                {history ? "USD fiyat geçmişi" : "Belge detayı"}
              </Dialog.Title>
              <Dialog.Description>
                Kaydedildiği tarihteki değişmez bilgiler.
              </Dialog.Description>
              <Dialog.Close asChild>
                <Button variant="ghost" aria-label="Detayı kapat">
                  <X />
                </Button>
              </Dialog.Close>
            </header>
            <div className="cloud-user-body">
              {history !== null ? (
                <div className="table-scroll">
                  <table className="cloud-table">
                    <thead>
                      <tr>
                        <th>Tarih</th>
                        <th>Önceki USD</th>
                        <th>Yeni USD</th>
                        <th>Kullanıcı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id}>
                          <td>{new Date(h.recordedAt).toLocaleString("tr")}</td>
                          <td>{h.previousUsd ?? "İlk kayıt"}</td>
                          <td>{h.nextUsd}</td>
                          <td>{h.actorId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                details && (
                  <>
                    <h2>{details.title ?? "Satış"}</h2>
                    <p>KDV hariç: {money(Number(details.netTry))}</p>
                    <p>KDV: {money(Number(details.vatTry))}</p>
                    <p>Genel toplam: {money(Number(details.totalTry))}</p>
                    {details.costUsd !== undefined && (
                      <p>Toplam maliyet: {details.costUsd} USD</p>
                    )}
                    {details.plans?.map((p, i) => (
                      <p key={i}>
                        Plan: {p.dueDate.slice(0, 10)} · {p.method} · {p.amount}{" "}
                        TL
                      </p>
                    ))}
                  </>
                )
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={stepUp} onOpenChange={setStepUp}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="confirm-dialog">
            <Dialog.Title>Güvenlik doğrulaması</Dialog.Title>
            <Dialog.Description>
              Aktarımı onaylamak için yakın tarihli parola ve TOTP doğrulaması
              gerekir.
            </Dialog.Description>
            <StepUpVerification
              onVerified={() => {
                setStepUp(false);
                setNotice(
                  "Doğrulandı. Önizlemeyi kontrol edip aktarımı tekrar onaylayın.",
                );
              }}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
