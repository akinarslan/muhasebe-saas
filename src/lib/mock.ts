import { createId } from "./runtime";
import type {
  Customer,
  DemoData,
  Draft,
  Product,
  Sale,
  SaleLine,
} from "./types";
import { localISO, saleAmounts } from "./finance";
export const tenant = { id: "tenant-demo", name: "Pusula Çalışma Alanı" };
export const entity = {
  id: "entity-demo",
  tenantId: tenant.id,
  name: "Pusula Reklam & Yazılım",
};
export const user = {
  id: "user-demo",
  tenantId: tenant.id,
  name: "Deniz Yılmaz",
  role: "Yönetici",
};
const catalog: [string, number, number, string, boolean][] = [
  ["Dijital baskı folyo", 240, 95, "m²", true],
  ["Branda baskı", 180, 65, "m²", true],
  ["Lightbox", 2800, 1400, "adet", false],
  ["Billboard kâğıdı", 120, 42, "m²", true],
  ["UV baskı", 420, 180, "m²", true],
  ["İç cephe boya", 650, 350, "kova", false],
  ["Araç kaplama", 850, 370, "m²", true],
  ["Mesh baskı", 210, 85, "m²", true],
  ["Dekota levha", 380, 180, "m²", true],
  ["Vinil kesim", 320, 130, "m²", true],
  ["Kutu harf tabela", 4800, 2200, "adet", false],
  ["Kartvizit baskı", 950, 400, "paket", false],
  ["Kurumsal web sitesi", 35000, 12000, "proje", false],
  ["Özel yazılım geliştirme", 85000, 32000, "proje", false],
  ["Yazılım bakım paketi", 4500, 1500, "ay", false],
  ["Hosting hizmeti", 1800, 550, "yıl", false],
  ["E-ticaret sitesi", 48000, 19000, "proje", false],
  ["Mobil uygulama", 120000, 50000, "proje", false],
  ["Alan adı hizmeti", 800, 450, "yıl", false],
  ["Arayüz tasarımı", 18000, 6500, "proje", false],
  ["API entegrasyonu", 24000, 9000, "proje", false],
  ["Teknik danışmanlık", 2500, 900, "saat", false],
];
// These values belong only to the fictional v0.1 transaction fixture, never to active pricing.
const legacyProducts: Product[] = catalog.map((p, i) => ({
  id: `p${i + 1}`,
  name: p[0],
  price: p[1],
  cost: p[2],
  unit: p[3],
  print: p[4],
  activity: i < 12 ? "Reklam" : "Yazılım",
}));
export const products: Product[] = legacyProducts.map((p) => ({
  ...p,
  price: 0,
  cost: 0,
}));
export const segments = ["Resmî kurum", "Reklamcı", "Mağaza-İşyeri"] as const;
export const methods = [
  "Nakit",
  "Havale/EFT",
  "Kredi kartı",
  "Mail order",
  "Çek",
  "Senet",
] as const;
export function newLine(product = products[0]): SaleLine {
  return {
    id: createId(),
    productId: product.id,
    print: product.print,
    description: product.name,
    quantity: 1,
    width: 100,
    height: 100,
    price: 0,
    priceOrigin: "manual",
    discount: 0,
    vat: 20,
  };
}
export function emptyDraft(): Draft {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return {
    activity: "Reklam",
    segment: "Mağaza-İşyeri",
    customerId: "",
    currency: "TRY",
    date: localISO(),
    dueDate: localISO(d),
    lines: [],
    plans: [],
    paid: 0,
    method: "Havale/EFT",
    notes: "",
  };
}
export function createDemo(): DemoData {
  const names = [
    "Kuzey Kent Belediyesi",
    "Armoni Reklam Atölyesi",
    "Mavi Bahçe Kafe",
    "Yeni Ufuk Üniversitesi",
    "İz Tasarım Ajansı",
    "Ada Yaşam Market",
    "Güneş İlçe Müdürlüğü",
    "Rota İletişim",
    "Çınar Mobilya",
    "Kent Kültür Merkezi",
    "Prizma Medya",
    "Limon Butik",
    "Vadi Eğitim Vakfı",
    "Çizgi Reklam",
    "Atlas Yapı",
    "Duru Spor Müdürlüğü",
    "Piksel Ajans",
    "Defne Çiçekçilik",
    "Ufuk Araştırma Enstitüsü",
    "Odak Baskı",
    "İnci Eczanesi",
    "Mavişehir Kütüphanesi",
    "Form Kreatif",
    "Zeytin Restoran",
    "Yıldız Meslek Okulu",
    "Vera Tanıtım",
    "Nova Teknoloji",
    "Pınar Sanat Merkezi",
    "İlmek Reklam",
    "Sahil Otel",
    "Eksen Dijital",
    "Koru Mimarlık",
  ];
  const locations = [
    ["İstanbul", "Kadıköy"],
    ["Ankara", "Çankaya"],
    ["İzmir", "Konak"],
    ["Bursa", "Nilüfer"],
    ["Antalya", "Muratpaşa"],
    ["Eskişehir", "Tepebaşı"],
    ["Konya", "Selçuklu"],
    ["Kocaeli", "İzmit"],
  ];
  const customers: Customer[] = names.map((name, i) => ({
    id: `c${i + 1}`,
    tenantId: tenant.id,
    legalEntityId: entity.id,
    name,
    segment: segments[i % 3],
    city: locations[i % 8][0],
    district: locations[i % 8][1],
    phone: `0532 555 ${String(1000 + i).slice(0, 2)} ${String(1000 + i).slice(2)}`,
    email: `iletisim${i + 1}@example.com`,
    term: 30,
  }));
  const now = new Date();
  const sales: Sale[] = Array.from({ length: 84 }, (_, i) => {
    const software = i % 3 === 0;
    const p = legacyProducts[software ? 12 + (i % 10) : i % 12];
    const date = new Date(now);
    date.setDate(date.getDate() - (i < 24 ? i % 15 : 15 + (i - 24) * 4));
    const due = new Date(date);
    due.setDate(due.getDate() + [7, 15, 30, 45][i % 4]);
    const line: SaleLine = {
      id: `l${i}`,
      productId: p.id,
      description: p.name,
      quantity: software ? 1 : 2 + (i % 8),
      width: 100 + (i % 4) * 50,
      height: 100 + (i % 3) * 50,
      price: p.price,
      discount: i % 5 === 0 ? 5 : 0,
      vat: 20,
      priceOrigin: "legacy",
      legacyCostTry:
        Math.round(
          (p.print
            ? ((100 + (i % 4) * 50 + 4) * (100 + (i % 3) * 50 + 4)) / 10000
            : 1) *
            (software ? 1 : 2 + (i % 8)) *
            p.cost *
            100,
        ) / 100,
    };
    const sale: Sale = {
      id: `SAT-${String(2026001 + i)}`,
      tenantId: tenant.id,
      legalEntityId: entity.id,
      customerId: customers[i % 32].id,
      activity: p.activity,
      date: localISO(date),
      dueDate: localISO(due),
      currency: i % 17 === 0 ? "USD" : "TRY",
      lines: [
        {
          ...line,
          price: i % 17 === 0 ? Math.round(line.price / 42) : line.price,
        },
      ],
      plans: [],
      payments: [],
      notes: "Örnek demo işlemi",
      legacyDemo: true,
      rateSnapshot: {
        value: 42,
        source: "legacy-demo",
        publishedAt: localISO(date),
        fetchedAt: date.toISOString(),
        reason: "Yalnızca v0.1 tarihsel demo verisi",
      },
    };
    const total = saleAmounts(sale, products).total;
    const paid = Math.round(total * [1, 0.5, 0, 0.3][i % 4] * 100) / 100;
    if (paid)
      sale.payments = [
        {
          id: `pay${i}`,
          saleId: sale.id,
          method: methods[i % 6],
          amount: paid,
          date: sale.date,
        },
      ];
    return sale;
  });
  return {
    version: 1,
    customers,
    sales,
    payables: Array.from({ length: 24 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - i * 6);
      const due = new Date(date);
      due.setDate(due.getDate() + 30);
      return {
        id: `b${i}`,
        supplierId: `sup${i % 3}`,
        activity: i % 3 === 0 ? "Yazılım" : "Reklam",
        date: localISO(date),
        dueDate: localISO(due),
        amount: 2400 + i * 750,
        paid: i % 3 === 0 ? 2400 + i * 750 : 0,
      };
    }),
  };
}
