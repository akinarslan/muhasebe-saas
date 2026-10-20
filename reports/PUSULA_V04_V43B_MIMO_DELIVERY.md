# PUSULA v0.4 — V4.3b GitHub teslim raporu (Mimo)

Tarih: 20.10.2026 · Proje: `C:\Users\tb\Desktop\muhasebe-saas` ·
Dal: `feat/pusula-v030-neon-cloud` · Başlangıç HEAD: `295c29879b4c0fc7c24de6f5cecd5b5ddaf40697` ·
Uzak: `origin` → `https://github.com/akinarslan/muhasebe-saas.git`

## 1. Kapsam

**V4.3b — Mal Kabul, Lot ve Stok Defteri** modülünün GitHub teslimi. Teslim listesi
`research/PUSULA_V04_V43B_CODEX_REPORT.md` §"Mimo'ya kesin teslim dosyaları" bölümündeki **kesin 25 dosyalık
listeden** okunarak uygulanmıştır; dosya adları tahmin edilmemiş, rapordan birebir alınmıştır.
`LAST_REPORT.md` güncellemesi de listede yer alır. Ek olarak bu teslim raporu commit'e eklenmiştir.

Çalışma ağacındaki değişiklikler (12 modified + 13 untracked = 25 dosya) listeyle **birebir örtüşüyor**;
eksik veya fazladan dosya yok. `git status` dışında hiçbir değişiklik (stash, ignored dosya, artifact) commit
kapsamına alınmadı.

## 2. Teslim edilen kesin dosya listesi (25 + bu rapor)

| # | Dosya | Durum |
|---|---|---|
| 1 | `LAST_REPORT.md` | modified (+16) |
| 2 | `package.json` | modified (+2/−2) |
| 3 | `prisma/schema.prisma` | modified (+120/−0) |
| 4 | `prisma/migrations/202610210016_goods_receipts/migration.sql` | yeni (+410) |
| 5 | `scripts/auth/prepare-browser.ts` | modified |
| 6 | `scripts/db/migrate.ts` | modified (+1) |
| 7 | `scripts/purchases/verify.ts` | modified (+1/−1) |
| 8 | `scripts/suppliers/verify.ts` | modified (+1/−1) |
| 9 | `scripts/stock/migration-baseline.json` | yeni |
| 10 | `scripts/stock/migration-fixture.ts` | yeni |
| 11 | `scripts/stock/verify-local.ts` | yeni |
| 12 | `scripts/stock/verify.ts` | yeni |
| 13 | `src/components/cloud-desk.tsx` | modified |
| 14 | `src/components/inventory-desk.tsx` | yeni |
| 15 | `src/lib/auth/catalog.ts` | modified |
| 16 | `src/lib/cloud/receipt-contracts.ts` | yeni |
| 17 | `src/server/cloud/handler.ts` | modified |
| 18 | `src/server/cloud/business/inventory.ts` | yeni |
| 19 | `tests/auth-e2e/local-isolation.ts` | modified |
| 20 | `tests/auth-e2e/v43a.spec.ts` | modified |
| 21 | `tests/auth-e2e/v43b.spec.ts` | yeni |
| 22 | `tests/receipt-contracts.test.ts` | yeni |
| 23 | `docs/architecture/V43B_INVENTORY_CONTRACT.md` | yeni |
| 24 | `research/PUSULA_V04_V43B_CODEX_REPORT.md` | yeni |
| 25 | `docs/validation/V04_V43B_VERIFICATION.md` | yeni |
| — | `reports/PUSULA_V04_V43B_MIMO_DELIVERY.md` | bu rapor (26. dosya) |

Toplam: **26 dosya, 4.526 insertions / 23 deletions** (bu rapor dâhil). `Compare-Object` ile liste
karşılaştırması yapıldı; fark yok.

## 3. Kod bütünlüğü doğrulamaları (Mimo, commit öncesi)

1. **İlk 15 migration değişmedi:** `git diff --name-only HEAD -- prisma/migrations/` boş; 0001–0015 klasörleri
   dokunulmamış. Ek olarak `scripts/db/migration-baseline.json` içindeki **15/15 SHA-256** yerel dosyalarla
   yeniden hesaplanıp karşılaştırıldı: **15 eşleşme, 0 uyumsuzluk**.
2. **Migration 016 checksum:**
   `prisma/migrations/202610210016_goods_receipts/migration.sql` SHA-256 =
   `4dc07f6a16c5d423b3dbafd06c377775212d728f701c5b3390a5dbb7cbbe5a89` —
   rapor, `scripts/stock/migration-baseline.json` ve görev beklentisiyle **eşleşiyor**.
3. **Baseline / post-schema pinleri:** `scripts/db/migration-baseline.json` (015 öncesi pin) **değişmedi**;
   yeni `scripts/stock/migration-baseline.json` 016 checksum'ı + 8 post-schema fingerprint (tables/columns/
   constraints/indexes/policies/triggers/functions/types) taşır ve doğrulama belgesindeki tabloyla birebir aynıdır.
   `types` fingerprint'i (`d891fe9c…`) 015 pin'iyle aynıdır — yeni enum eklenmediğiyle tutarlı.
4. **Supplier ve PurchaseOrder korundu:** `prisma/schema.prisma` diff'i **120 ekleme / 0 silme** — mevcut
   modellere dokunulmadı, yalnız yeni stok modelleri eklendi. `scripts/suppliers/verify.ts` ve
   `scripts/purchases/verify.ts` değişiklikleri yalnız 40→47 tablo beklentisinin `PUSULA_STOCK_FIXTURE` flag'ine
   bağlanmasıdır. Migration 016 yeni tabloları FK ile `PurchaseOrder`/`PurchaseOrderLine`/`MaterialVariant`'a
   **RESTRICT/RESTRICT** ile bağlar; DROP/UPDATE/DELETE veya mevcut tablo ALTER'ı **yoktur**.
5. **`MaterialVariant.usdCost` otomatik güncellenmiyor:** yeni `inventory.ts`, `receipt-contracts.ts` ve
   migration SQL içinde `usdCost` yazımı yok; kod taramasında `usdCost` yazımları yalnız önceden var olan
   catalog/resources/repository/pricing dosyalarındadır.
6. **Kesinleşmeden stok hareketi oluşmuyor:** migration 016'da `GoodsReceipt.status IN ('DRAFT','POSTED','CANCELLED')`
   CHECK'i, `StockPostingBatch`/`StockMovement` için `receiptId` üzerinde tekil `RECEIPT` batch index'i,
   `StockMovement.quantityDeltaBase <> 0` CHECK'i ve `StockBalance.quantityBase >= 0` CHECK'i var; lot/batch/
   movement yazımı SQL fonksiyonu içinde POSTED transaction'ıyla yapılır. Codex'in 27/27 senaryosunda
   "DRAFT stok 0" ve "post replay yeni lot/movement/balance üretmez" kontrolü yer alır.
7. **Gerçek Neon migration'ını otomatik uygulayan işlem yok:** `scripts/db/migrate.ts`'e tek satır eklenmiş —
   `--test` olmayan yolda 016 dosyası görürse bağlantı kurmadan
   `STOCK_MIGRATION_REQUIRES_SEPARATE_CLOUD_REVIEW` ile durur. Yeni `scripts/stock/*` yolları
   `PUSULA_LOCAL_FIXTURE` + `TEST_DIRECT_DATABASE_URL` (127.0.0.1 loopback fixture) gerektirir;
   `scripts/stock/verify.ts` `if (!process.env.PUSULA_LOCAL_FIXTURE) throw Error("LOCAL_ONLY")` ile başlar.
8. **Migration güvenlik kontrolleri gevşetilmedi:** `scripts/db/migration-safety.ts`,
   `scripts/db/migration-baseline.json` ve `scripts/db/verify-migration-fixture.ts` **değişmedi**.
   Runner'a eklenen tek satır bir *ek* kapıdır, mevcut checksum/TLS/allowlist/privilege pinlerini kaldırmaz.
   Migration 016'da `pusula_stock_executor` rolü `NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
   NOBYPASSRLS` olarak tanımlanır, `pusula_runtime` yalnız `SELECT` alır ve tüm yeni tablolarda
   `ENABLE + FORCE ROW LEVEL SECURITY` vardır.

Kritik uyumsuzluk **bulunmadı**; teslim devam etti.

## 4. Testler — Mimo'nun gerçekten çalıştırdıkları

Commit öncesi, teslim öncesi (20.10.2026):

| Komut | Sonuç |
|---|---|
| `npm test` (Vitest) | **368/368 PASS**, 30 dosya, 17.74 sn, exit 0 |
| `npx tsc --noEmit` | **PASS**, exit 0, çıktı yok |
| `npm run lint` (eslint .) | **PASS**, exit 0, hata/uyarı yok |
| `npm run build` (production) | **PASS**, exit 0; mevcut `.data`/`rate-store` tracing uyarısı korunuyor |

Bu dört komut Mimo tarafından bu teslimde **gerçekten çalıştırıldı** ve yukarıdaki sonuçlar Mimo'nun kendi
sonuçlarıdır.

### Codex testlerinden ayrım

Aşağıdaki sonuçlar **Codex'e aittir** (`docs/validation/V04_V43B_VERIFICATION.md`, fixture
`v42-d399dace…` / son candidate `v42-71074783…`) ve **Mimo tarafından yeniden çalıştırılmamıştır**;
Mimo bunları kendi sonucu olarak sunmaz:

- Gerçek PG18.6/Prisma **Stock SQL/API 27/27**, DB/RLS 11/11, Auth 62/62, Cloud 11/11,
  Supplier 16/16, Purchase 28/28
- Gerçek desktop/mobile Chrome **browser 4/4** (Playwright; Mimo bu teslimde browser testi çalıştırmadı)
- Cloud runner smoke: DB bağlantısı kurmadan beklenen `BLOCKED` sonucu

Bu teslimde hiçbir başarısız eski koşu yeni koşuyu geçmedi; Codex'in ilk başarısız denemeleri raporda saklı
tutuldu. Testlerde hata gizlenmedi.

## 5. Güvenlik taraması

**Stage öncesi ve sonrası** 25 dosyanın tamamı tarandı:

- `postgres(ql)?://…:…@`, `password=`, `api_key`, `sk_live`/`sk-`, `AKIA`, JWT (`eyJ…`),
  `-----BEGIN … PRIVATE KEY`, `otpauth://`, `Bearer …`, base32 TOTP secret kalıpları: **gerçek sır eşleşmesi yok**.
  Eşleşen iki bağlantı dizesi **127.0.0.1 loopback** fixture URL'leridir ve parolalar çalışma anında üretilen
  `${adminPassword}` / `${password}` değişkenleridir (`scripts/stock/verify-local.ts`). `scripts/suppliers/verify.ts`
  içindeki `"Synthetic-" + randomUUID()` sentetik üretilen değerdir; sabit sır değildir.
- `.env*` (`.gitignore:6`), `.data/` (`.gitignore:7`), `node_modules/`, `.next/`, build çıktıları, log,
  screenshot/trace ve fixture veri dizinleri **stage edilmedi**; `git diff --cached --name-only` üzerinde
  bu kalıp taraması **temiz**.
- `git diff --cached --check` → **exit 0, temiz** (yalnız LF→CRLF bilgilendirme uyarısı; içerik farkı değil).
- Stage dosya listesi tam 26 dosya (25 teslim + bu rapor); fazladan dosya yok.

## 6. GitHub teslimi

Tek **normal commit**, yalnız `origin/feat/pusula-v030-neon-cloud` dalına push edilir.
Önerilen mesaj kullanıldı: `feat(v0.4): add V4.3b goods receipts and inventory ledger`.

**Yasaklar:** `main` merge, force-push, hard reset, başka dal'a push, kullanıcı değişikliklerinin silinmesi,
migration uygulama, gerçek Neon veri değişikliği, snapshot/branch silme, R2 backup/restore **yapılmadı**.
Nihai commit SHA, push sonucu, ahead/behind ve çalışma ağacı durumu **push sonrası teslim mesajında**
bildirilir (bu rapor commit öncesi yazıldığı için kendi SHA'sını içeremez; `git log -1` ile doğrulanır).

## 7. Korunan eski migration ve veri kapsamı

- İlk 15 migration SQL dosyası ve `scripts/db/migration-baseline.json` aynen korundu (15/15 checksum eşit).
- V4.3a Satın Alma modülü, V4.2 tedarikçi kataloğu ve önceki denetim/fix/audit belgeleri değiştirilmedi.
- `PO-2026-9893`, gerçek Auth/MFA kayıtları, production/test Neon veritabanları, snapshot
  `snap-frosty-sky-bav0qeo6`, recovery branch `br-broad-river-bavv5pey` ve eski preview **dokunulmadı** —
  bu teslim yalnız commit/push'tur.
- Teslim edilen kodda gerçek DB'ye yazan tek bir komut yoktur; tüm stok doğrulaması UUID/loopback
  PostgreSQL 18.6 fixture'larında koşmuştur.

## 8. Gerçek Neon'da migration 016 uygulanmadı

Bu teslim bir **GitHub doküman/kod teslimidir**; migration 016 gerçek Neon development/production üzerinde
**uygulanmamıştır** ve bu commit bunun yetkisini **vermez**. Bulut runner'ı 016 dosyasını görünce
`STOCK_MIGRATION_REQUIRES_SEPARATE_CLOUD_REVIEW` ile bağlantı kurmadan durur. Gerçek apply için ayrıca:
cloud preflight/recovery/RPO değerlendirmesi, managed rol/default ACL/function incelemesi ve **açık kullanıcı
onayı** gerekir.

## 9. Açık güvenlik ve yedekleme kapıları

- **Neon 016 apply** kapısı: managed `pusula_stock_executor` rolü/default ACL/function uyumluluğu ve
  cloud preflight incelemesi yapılmadı.
- **Bağımsız R2 şifreli backup/restore** hâlâ **BLOCKED/AÇIK**: Sprint E pinleri 35 tablo/21 FORCE RLS,
  E2 definer engeli ve backup rolü/PUBLIC TEMP-CONNECT sorunları kapanmadı; yeni 47/33 kapsam ve yeni
  function'lar allowlist'e otomatik alınmadı.
- MFA SQL gate'i yalnız HTTP/server katmanındadır; paylaşılan runtime credential'ı güven sınırıdır.
- Transfer, sayım, dondurma, sarf/remnant, çoklu paket ve yasal stok değerleme bu teslimde çalışmıyor;
  V4.3c (tedarikçi iadesi, ek edinim giderleri/KDV, sayfalama/filtre) ve V4.5 (kalıcı inventory profile)
  ayrı kapsamdır.
- Listeler 200 ile sınırlıdır; pagination ve depo hiyerarşisi/pasifleme açık.
- Bu modül **production-ready değildir**; kabul yalnız yerel fixture üzerindendir.
