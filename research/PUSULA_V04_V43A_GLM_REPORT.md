# PUSULA v0.4 — Sprint V4.3a / Satın Alma Siparişleri ilk çalışan modül

20.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `2ab48ad` (tüm değişiklikler commit'siz) · **V4.3a — LOCAL_ACCEPTANCE_PASS**

## Sonuç
Migration `202610200015_purchase_orders`, izole yerel PostgreSQL 18.6 fixture'ında gerçek Prisma yoluyla hatasız uygulandı ve tüm doğrulama katmanları tek koşuda yeşile döndü (kabul fixture'ı `v42-f8a7c083-db7f-480a-9a77-5baeebd82e9f`):

- Migration safety 18 kontrol + preflight/postflight durumları PASS: baseline schema pin, checksum drift reddi, kolon drift reddi, gerçek prisma üzerinde lock/statement/child timeout ve nontransactional partial-failure enjeksiyonları, unresolved-retry ve partial-retry blok testleri, `normal-real-prisma-015`, 10 tablo × 2 satır içerik koruması, `ALREADY_APPLIED` no-replay, fail-closed ACL (supplier + PO), MASTER 8 supplier + 6 purchases RolePermission gözlemi.
- `scripts/auth/verify-c2.ts` 9/9 PASS.
- `scripts/suppliers/verify.ts` 16/16 PASS (V4.2 regüresyon koruması).
- `scripts/purchases/verify.ts` 16/16 PASS (yeni Satın Alma doğrulaması).
- Şema sonrası: 40 tablo / 26 FORCE RLS / 15 migration. Fixture `status: PASS`, `serverStopped: true`.
- Unit/derleme: Vitest 344/344 (28 dosya; `purchase-pricing.test.ts` 15/15), `npx tsc --noEmit` temiz, ESLint 0 hata/0 uyarı.

## Teslim edilen işler
- `prisma/schema.prisma`: `PurchaseOrder` + `PurchaseOrderLine` modelleri (Decimal-only, composite FK'ler) + `db:generate`.
- `prisma/migrations/202610200015_purchase_orders/migration.sql`: 015 — PO/POLine tabloları, RLS (`pusula_can` tabanlı; politikalar yalnız geçerli satır yetkisi, işlem geçişi yetkileri `v43a_order_guard`/`v43a_line_guard` trigger'larına ayrılmış), CHECK'lerle (`PO-[0-9]{4}-[0-9]{4}` businessNo, pozitif adetler, sürüm numarası sabit 1), `pusula_runtime` minimal grant'leri (PO: SELECT/INSERT/UPDATE; POLine: SELECT/INSERT/DELETE), 6 purchases Permission + MASTER RolePermission seed. Checksum `e6327df97daa1c933b8d81c7f7dbbd1b8d62060994d75eb7f0c6ebbf06fe94cc` sabitlenmiş.
- `src/lib/cloud/purchase-contracts.ts` + `purchase-pricing.ts`: Decimal-only fiyat matematiği; USD kimlik dönüşümü, TRY yalnız açık TCMB snapshot'ı ile, EUR/GBP hiçbir otomatik USD dönüşümü yok (`CURRENCY_SOURCE_UNVERIFIED`), `pendingLines`/`totalUsd` üretimi.
- `src/server/cloud/business/purchases.ts`: tam PO servisi — tenant/company/activity kapsamlı, idempotency replay + conflict 409, businessNo tahsis kilidi, draft'un version step'li tam satır değişimi (uzağan version 409 döner), approve/cancel mühürleme, `purchases.costView` DENY'de satır fiyat alanlarının tamamen sansürlenmesi.
- `src/server/cloud/handler.ts` + `src/lib/auth/catalog.ts`: `purchase-orders` rotası ve purchases izin kataloğu (migration seed'iyle birebir).
- `src/components/purchase-desk.tsx`, `cloud-desk.tsx`, `globals.css`: liste + detay + draft drawer'lı premium UI; kirli-form korumaları.
- `tests/purchase-pricing.test.ts` ve `scripts/purchases/verify.ts` (16 gerçek-senaryo kontrolü).
- `scripts/db/migrate.ts`, `migration-safety.ts`, `verify-migration-fixture.ts`, `scripts/suppliers/verify-local.ts`, `migration-baseline.json`: 015 runner desteği; post-015 `appliedSchema` pinleri, `APPLIED_SCHEMA_DRIFT` koşulunun yazdığı gerçek `post-schema.json` çıktısından baseline'a sabitlendi; backup/restore pinleri dokunulmadı (allowlist 35/21, PO hâlâ yedekte yok; koşu `40` gerçek tabloyu gözlemledi).

## Koşul sırası ve gerçek iterasyonlar
Tüm koşular `cmd /c "npm run suppliers:test:local -- --approve-local-fixture [--migration-safety] --supplier-only"`;
tüm PASS/FAIL değerleri gerçek — hiçbir sonuç uydurulmadı; `.data/fixtures/v42-*` altında korunur.

1. 015 migration SQL'in olgunlaştırılması: unquoted camelCase kolon/policy tanımlamaları giderildi; RLS politikaları `OLD` referansı taşıyamaz (PostgreSQL kuralı), bu yüzden UPDATE politikası yalnız geçerli satır + `pusula_can('purchases.view')` kullanır; edit/approve/cancel geçiş yetkileri `v43a_order_guard` trigger'ına taşındı; PO create yolu `suppliers.view`'ı da zorunlu kıldı.
2. Sprint 3 eksploratif koşulda ek doğrulama düzeltmeleri:
   - `suppliers/verify.ts`: yedek fail-closed kontrolündeki beklenen tablo sayısı **38'den 40'a** güncellendi (`PurchaseOrder` yedekte yok teyiidi ile birlikte).
   - `purchases/verify.ts`: DECIMAL kolonu imzasına uygun `originalUnitPrice` girdisi çıktısı; doğrudan fixture yabancı-tenant INSERT'leri composite FK ihlali ürettiği için bağımsız yabancı graf (Material→Variant→Supplier→SupplierMaterial→PurchaseOrder→PurchaseOrderLine) kuruldu.
   - PO DTO `fxSnapshot`: fiyat kapsülünün tamamı yerine gerçek iç içe fx durumu döndürüyor (`status` ve `reason` alanları).
   - Partial schema kontrolleri: migration-015'e göre `purchaseTables === 0` invarianı ve `supplierTables === 3` (014'ün tabloları) kontrolü.
   - Fixture bootstrap: production ile aynı şekilde **Role satırları migration'ların cross-join yapmadan ÖNCE** eklenmektedir (Migration 005 `Role` tablosu tasarandı, sonraki seed Cross-join'ler 011/012/014/015'te); uygulama için `202610170011_cloud_business` ismiyle döngü içinde seed yerleştirildi.
   - `has_table_privilege` kolon alias lowercase: `poRights.orderwrite/linewrite` kullanımı.
3. İki fazlı pin bootstrap: ilk kabul koşusu beklenen şekilde `APPLIED_SCHEMA_DRIFT` ile düştü ve `post-schema.json` yazıldı; 8 `appliedSchema` hash'i baseline'a sabitlendi; ardından aynı komut tekrar koşuldu ve tam PASS üretti.
4. Final regresyon: `npx tsc --noEmit` temiz, `npm run lint` temiz, `npm test` 344/344.

## Korunan kısıtlar
- Migration yalnız izole yerel PostgreSQL fixture'da uygulandı; gerçek Neon development/test/production üzerinde çalışma ve R2 işlemi yok.
- Önceki 14 migration checksum'ı değişiklik olmadı; `scripts/backup/postgres.ts` sabit pinleri dokunulmadı.
- PL/pgsql'de `OLD`/`NEW` yalnız trigger fonksiyonlarında; RLS politikalarında yalnız geçerli satır + `pusula_can`; tenant/LegalEntity/Activity/DENY kontrolleri zayıflatılmadı.
- PO akışı stok/cari/ödemeye dokunmaz; `MaterialVariant.usdCost` otomatik güncellenmez; TCMB yalnız TRY için, EUR/GBP hiçbir zaman otomatik USD'ye çevrilmez (`CURRENCY_SOURCE_UNVERIFIED` snapshot); approve sonrası snapshot ve satırlar mühürlü.

## Teslim
commit/push yapılmadı; git teslimi Mimo'ya. Doğrulama ayrıntısı: `docs/validation/V04_V43A_VERIFICATION.md`.
