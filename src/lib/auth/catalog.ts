export const permissionModules = {
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
