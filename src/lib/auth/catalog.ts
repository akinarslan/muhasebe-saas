export const permissionModules = {
  suppliers: { view: "Tedarikçi görüntüle", create: "Tedarikçi oluştur", edit: "Tedarikçi düzenle/pasifleştir" },
  supplierMaterials: { manage: "Tedarikçi malzeme eşleştirmesi" },
  supplierOffers: { view: "Teklif görüntüle", create: "Teklif sürümü oluştur", history: "Teklif geçmişi", costView: "Tedarikçi fiyatını gör" },
  purchases: {
    view: "Satın alma siparişi görüntüle",
    create: "Satın alma siparişi oluştur",
    edit: "Satın alma taslağını düzenle",
    approve: "Satın alma siparişini onayla",
    cancel: "Satın alma siparişini iptal et",
    costView: "Satın alma maliyetini gör",
  },
  activities: { manage: "Faaliyet tanımla" },
  customers: {
    view: "Görüntüle",
    create: "Ekle",
    edit: "Düzenle",
    export: "Dışa aktar",
  },
  sales: {
    view: "Görüntüle",
    create: "Oluştur",
    edit: "Düzenle",
    discount: "İndirim yap",
    approve: "Onayla",
    cancel: "İptal et",
  },
  materials: {
    edit: "Malzeme bilgisini düzenle",
    view: "Görüntüle",
    costView: "USD alış maliyetini gör",
    costEdit: "USD alış maliyetini değiştir",
    create: "Ekle",
    variants: "Varyant yönet",
    history: "Fiyat geçmişi",
  },
  exchange: {
    view: "Görüntüle",
    manual: "Manuel kur gir",
    approve: "Manuel kuru onayla",
  },
  products: { view: "Görüntüle", create: "Ekle", edit: "Düzenle" },
  expenses: { view: "Görüntüle", create: "Ekle", edit: "Düzenle" },
  quotes: {
    view: "Görüntüle",
    create: "Oluştur / revize et",
    approve: "Onayla",
  },
  imports: {
    view: "Önizlemeyi görüntüle",
    create: "Önizleme oluştur",
    confirm: "İçe aktarmayı onayla",
  },
  finance: {
    accounts: "Cari görüntüle",
    collect: "Tahsilat oluştur",
    payables: "Borç görüntüle",
    pay: "Ödeme oluştur",
    cash: "Kasa görüntüle",
    bank: "Banka görüntüle",
    approve: "İşlem onayla",
  },
  stock: {
    view: "Görüntüle",
    receive: "Giriş",
    issue: "Çıkış",
    adjust: "Düzeltme",
  },
  production: {
    view: "Görüntüle",
    create: "İş emri oluştur",
    update: "Durum değiştir",
    approve: "Onayla",
  },
  reports: {
    view: "Görüntüle",
    export: "Dışa aktar",
    finance: "Finansal rapor",
  },
  users: {
    view: "Kullanıcı görüntüle",
    invite: "Davet et",
    deactivate: "Pasifleştir",
    roles: "Rol ata",
    permissions: "Özel izin yönet",
    audit: "Denetim kayıtları",
    sessions: "Oturum sonlandır",
  },
} as const;
export const moduleLabels: Record<string, string> = {
  suppliers: "Tedarikçiler",
  supplierMaterials: "Tedarikçi malzemeleri",
  supplierOffers: "Tedarikçi teklifleri",
  purchases: "Satın alma siparişleri",
  activities: "Faaliyetler",
  products: "Ürünler",
  expenses: "Gider türleri",
  quotes: "Teklifler",
  imports: "Veri aktarımı",
  customers: "Müşteriler",
  sales: "Satışlar",
  materials: "Malzemeler",
  exchange: "Döviz",
  finance: "Cari ve finans",
  stock: "Stok",
  production: "Üretim",
  reports: "Raporlar",
  users: "Kullanıcı yönetimi",
};
export const permissions = Object.entries(permissionModules).flatMap(
  ([module, actions]) =>
    Object.entries(actions).map(([action, label]) => ({
      id: `${module}.${action}`,
      label,
      module,
    })),
);
export const roleTemplates = [
  {
    id: "MASTER",
    name: "Master Admin",
    permissions: permissions.map((p) => p.id),
  },
  {
    id: "ACCOUNTANT",
    name: "Muhasebe",
    permissions: [
      "customers.view",
      "customers.create",
      "customers.edit",
      "sales.view",
      "materials.view",
      "materials.costView",
      "exchange.view",
      "finance.accounts",
      "finance.collect",
      "finance.payables",
      "finance.pay",
      "finance.cash",
      "finance.bank",
      "reports.view",
      "reports.finance",
    ],
  },
  {
    id: "SALES",
    name: "Satış",
    permissions: [
      "customers.view",
      "customers.create",
      "customers.edit",
      "sales.view",
      "sales.create",
      "sales.edit",
      "materials.view",
      "exchange.view",
    ],
  },
  {
    id: "PRODUCTION",
    name: "Üretim",
    permissions: ["materials.view", "production.view", "production.update"],
  },
  {
    id: "PURCHASING",
    name: "Depo / Satın Alma",
    permissions: [
      "materials.view",
      "materials.costView",
      "materials.create",
      "materials.variants",
      "stock.view",
      "stock.receive",
      "stock.issue",
    ],
  },
  {
    id: "REPORTER",
    name: "Rapor görüntüleyici",
    permissions: ["reports.view"],
  },
];
export type Scope = {
  kind: "OWN" | "ACTIVITY" | "LEGAL_ENTITY" | "TENANT";
  tenantId: string;
  legalEntityId: string | null;
  activityId: string | null;
  department?: string | null;
  amountLimit?: string | null;
  requiresApproval?: boolean;
};
export type Resource = {
  tenantId: string;
  legalEntityId?: string | null;
  activityId?: string | null;
  createdById?: string | null;
  department?: string;
  amount?: string;
  approved?: boolean;
};
export type Grant = {
  permissionId: string;
  effect: "ALLOW" | "DENY";
  source: "ROLE" | "OVERRIDE";
  scope: Scope;
};
