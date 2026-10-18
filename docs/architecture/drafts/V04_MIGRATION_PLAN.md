# V4.1 — SQL migration ve katalog kontrol taslağı

19.10.2026 · **ÇALIŞTIRILMADI. Migration runner'a bağlı değildir.** Buradaki SQL parçaları tam migration değildir; `prisma/migrations` altında dosya oluşturulmadı. Yeni onay olmadan uygulanmaz. [Model ve kurallar](../V04_DATA_MODEL.md), [Prisma taslağı](V04_SCHEMA.prisma).

## Sıralama ve kesme noktaları

| Paket | Gelecekteki additive işlem | Bağımlılık/kabul |
| --- | --- | --- |
| A — baseline | 13 migration checksum, 34 model+metadata35 tablo, 21 FORCE RLS; kolon/trigger/policy/ACL/function manifest kaydı | Hedef host/branch/DB/rol allowlist ve operatör onayı. Gerçek müşteri verisini bu denetim için çekme. |
| B — katalog | StockUnit/StockForm ayrı enum; Variant'a iki nullable profil kolonu; Supplier/Material/Offer, Location, Process/Machine/Capability, Recipe/Line/Option/Rate | Mevcut CostUnit/schema/API formatı değişmez. Kg/litre pricing kapalı. Yeni FK/index/check/RLS aynı transaction'da; grant en son. |
| C — belgeler | PO/Line, Receipt/Line, Return/Line, Lot, Count/Line, Transfer | Bağımlı FK çevrimleri tablolar yaratıldıktan sonra eklenir; mevcut tablolar yeniden yaratılmaz. |
| D — ledger | Batch, Movement, Balance; kaynak FK'leri, posting/reversal fonksiyonları, deferred constraint/immutable trigger, count freeze | 24 tablonun tamamı45 toplam FORCE RLS hedefinde; gerçek concurrency negatif testleri zorunlu. |
| E — uygulama yetkileri | Yeni Permission kayıtları ve açık Master şablon bağlantıları; dar executor rolü ve runtime EXECUTE | Rol/grant/permission uygulaması ayrı onaylıdır. Normal şablonlar otomatik genişletilmez, kullanıcı override'ları ezilmez. |
| F — kontrollü açılış | Stok profili ve bağımsız açılış belgesi gereksinimi; gerçek envanter sayımı/onayı, varsa import | Mevcut inStock=true veya usdCost varlığı otomatik miktara dönüşmez. Açılış olayı için ayrı model/sourceKind değişikliği ve test onayı gerekir; V4.1 taslağında kaynaksız lot/stock yok. |

Paket adları sıra önerisidir, migration timestamp'leri henüz rezerve edilmedi. B/C tabloları önce servise kapalı; D/E tamamlanmadan stock modülü açılmaz. Yeni boş tablolarda indeksler normal transaction içinde; eski MaterialVariant üzerinde ek indeks büyükse `CONCURRENTLY` ayrı işlem ve invalid-index kontrolü ister. `lock_timeout=3s`, sınırlı `statement_timeout`; bekleme aşılırsa rollback, otomatik sınırsız tekrar yok. Yeni nullable kolonların backfill'i mevcut fiyat/birimleri tahminle değiştirmez.

Eski tablolara FK eklenirse önce `NOT VALID`, yalnız onaylı doğrulama penceresinde `VALIDATE CONSTRAINT`; unique index önce uygun veri/çakışma kontrolüyle. Unique/PK NOT VALID olamaz. Yeni boş tablolarda doğrudan valid FK/CHECK kullanılabilir. Her tabloya şirket/tarih indeksi; her composite FK için soldan scope+parent indeksi planlanır. Özellikle receipt(orderId,status), lines(orderLineId), return(receiptLineId), movement(lotId,locationId,createdAt,id), movement(batchId), count(locationId,status), capability(machineId,processId,variantId), rate(capabilityId,validFrom,revision) ve supplier offer(link,validFrom,revision) indeksleri gerekir. Prisma taslağı temel unique/scope/tarih indekslerini gösterir; FK filtre/partial indeksler bu SQL paketiyle tamamlanır.

## SQL-only constraint örnekleri

Aşağıdaki snippet'ler tasarım kanıtıdır; yalnız bunları çalıştırmak sistemi tamamlamaz. Kısa isimler PostgreSQL63byte sınırında kalır. Bütün FK'ler scope'u taşır. Parent/child same-variant ve miktar kuralları için ek unique ve FK örneği:

```sql
-- TASLAK, UYGULANMADI
ALTER TABLE "StockLot" ADD CONSTRAINT v41_lot_variant_key
  UNIQUE ("tenantId","legalEntityId",id,"variantId","baseUnit");
ALTER TABLE "StockMovement" ADD CONSTRAINT v41_movement_lot_variant_fk
  FOREIGN KEY ("tenantId","legalEntityId","lotId","variantId","baseUnit")
  REFERENCES "StockLot"("tenantId","legalEntityId",id,"variantId","baseUnit")
  ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE "StockBalance" ADD CONSTRAINT v41_balance_nonnegative
  CHECK ("quantityBase">=0);
ALTER TABLE "StockMovement" ADD CONSTRAINT v41_nonzero_delta
  CHECK ("quantityDeltaBase"<>0);
ALTER TABLE "StockTransfer" ADD CONSTRAINT v41_transfer_fields
  CHECK ("qtyBase">0 AND "fromLocationId"<>"toLocationId");
ALTER TABLE "StockPostingBatch" ADD CONSTRAINT v41_one_source
  CHECK (num_nonnulls("receiptId","returnId","transferId","countId","reversalOfBatchId")=1);
CREATE UNIQUE INDEX v41_receipt_one_post
  ON "StockPostingBatch"("tenantId","legalEntityId","receiptId")
  WHERE "receiptId" IS NOT NULL;
CREATE UNIQUE INDEX v41_count_freeze
  ON "InventoryCount"("tenantId","legalEntityId","locationId")
  WHERE status='COUNTING';
CREATE UNIQUE INDEX v41_full_batch_reverse
  ON "StockPostingBatch"("tenantId","legalEntityId","reversalOfBatchId")
  WHERE "reversalOfBatchId" IS NOT NULL;
```

Aynı source-unique returnId/transferId/countId için de gereklidir. Reversal tam batch içindir, ikinci tam reversal yok; kısmi tedarikçi iadesi ayrı Return belgesidir. Reverse-of-reversal zinciri yeni düzeltme/onay gerektirir, otomatik stok yaratmaz. Lot tek receipt line, variant ve baseUnit ile uyumlu olmalı. PO line→supplierMaterial/offer/header supplier; Return→receipt/header supplier; Option→recipe.product/capability.variant/process; countLine→header.location; source movement→batch belge tipi/line parent eşitliği FK genişletmesi veya sabit constraint trigger'larla tamamlanır. Nullable typed source alanları receipt/return/count/transfer türüne göre tam biri, reversal'da yalnız reversesMovementId olmalıdır. Arbitrary sourceType/sourceId metni FK yerine kullanılmaz.

Diğer CHECK'ler: finite numeric (NaN/Infinity reddi), qty>0/observed≥0, whole piece/sheet, allowed state/currency, revision>0, allowance0..1, snapshot format/version/decimal string ve tutar eşitlikleri, tarih aralığı, dimension pozitifliği ve şekle göre null/not-null. ROLL initialBaseQty=initialLengthM ve baseUnit=linear_meter; SHEET unit=sheet ve tam sayı, PIECE piece; BULK profile birimi. Profil/geometry/edinim alanları ilk hareketten sonra immutable. Scalar CHECK başka tablodaki toplamı kontrol etmez; bunlar cross-row trigger+lock gerektirir.

Batch deferred trigger commit'te şunları zorunlu kılar: header POSTED ve audit mevcut; kaynak tüm satırlar/lotlar için tam kapsam; receipt lot initial qty toplamı=receiptLine.baseQty ve aynı miktarda pozitif hareket; transfer tam iki hareket aynı lot/unit/cost ile toplam0; return negatif ve receipt/lot sınırı; count delta=observed-expected ve onay; reversal özgün hareket setinin birebir negatif kopyası. Hiçbir receipt/transfer POSTED header'ı batch olmadan veya batch eksik ledger ile commit edemez. Balance toplam ledger ile eşittir; posting function dışında balance DML kapalıdır. PostgreSQL deferred trigger tamamlığı için her ilgili header/child/batch INSERT/UPDATE yolu kapsanır; yalnız Movement trigger'ı yeterli değildir.

## RLS/policy taslağı ve executor

```sql
-- TASLAK; aynı model 24 tabloda, her action'a özgü politika ile uygulanır.
ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" FORCE ROW LEVEL SECURITY;
CREATE POLICY v41_supplier_scope ON "Supplier"
  USING ("tenantId"::text=current_setting('app.tenant_id',true)
    AND "legalEntityId"::text=current_setting('app.legal_entity_id',true))
  WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true)
    AND "legalEntityId"::text=current_setting('app.legal_entity_id',true));
CREATE POLICY v41_supplier_read ON "Supplier" AS RESTRICTIVE FOR SELECT
  USING (pusula_can('suppliers.view',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY v41_supplier_create ON "Supplier" AS RESTRICTIVE FOR INSERT
  WITH CHECK ("createdById"=current_setting('app.user_id',true)
    AND pusula_can('suppliers.create',"tenantId","legalEntityId","activityId","createdById"));
-- UPDATE policy ayrıca suppliers.edit USING+WITH CHECK ister.
-- DELETE/TRUNCATE grant yok; permissive scope tek başına action kontrolü değildir.
```

Transaction-local user/tenant/entity boşsa deny; mevcut internal kodun boş user bypass örüntüsü **yeni tablolara kopyalanmaz**. Child erişimi parent action/scope üzerinden, RLS recursion üretmeyen tek yönlü graph ile tasarlanır. Listelerin RLS'si maliyetli cross-module satırı sızdırmadan çalışmalı; receipt/stock miktarı görmek için offer fiyat tablosuna SELECT zorunluluğu yaratılmaz. Gerekli immutable cost okumasını posting executor yapar ve yalnız yetkili DTO döner.

Posting fonksiyonunun sahibi dar non-owner NOLOGIN NOBYPASSRLS rolü; runtime o role üye olmaz. Definer PUBLIC EXECUTE revoke, yalnız runtime EXECUTE; function arg'ı tenant/user kabul etmez, session context'ten alır. Sabit search_path, schema-qualified tablo/fonksiyonlar, dinamik SQL yok. Executor'ın row policy'si gerçek `app.user_id` ve kaynak iş eylemiyle sınırlıdır; kolaylaştırıcı `USING(true)` verilmez. INSERT actor/context, kaynak hareket ve türetilmiş fiyat server-side doğrulanır. Exec rolünün SECURITY DEFINER ile hareket yapması PostgreSQL FORCE RLS'yi geçersiz kılmaz; owner/BYPASSRLS fallback yok. SQL fonksiyonunun yetki sınırı E2 function hash/ACL incelemesine ayrıca girer.

## İşlem ve rollback

Receipt: idempotency kaydı/advisory key → location business lock/freeze kontrolü → PO+satırlar ID sırasında FOR UPDATE → kümülatif kabul kontrolü → lot/receipt/source kayıtları → Balance satırları → movements → POSTED batch+AuditEvent → deferred constraints → COMMIT. Aynı kurallar aynı DB transaction'ında; uygulama başarısı commit sonrasında.

Transfer: idempotency → iki location lock'ı UUID sırasıyla → lot lock → eksik Balance için INSERT ON CONFLICT DO NOTHING → source/target Balance lot+location sırasıyla FOR UPDATE → yeterli bakiye ve roll tek-lokasyon kuralı → iki movement+balance delta+batch+audit. Aynı sıralama return/count/reverse için de kullanılır; PO lock gerektiren bütün işlemler önce location, sonra PO, sonra lot/balance sırasına uyar. Receipt reversal, return ve close/revise de bu sırayı paylaşır. Deadlock40001/40P01 yalnız sınırlı retry+jitter, aynı key/hash ve transaction'ın tamamını yeniden deneme; insufficent stock retry ile kabul edilmez. Check-then-insert kilitsiz SUM yok. [Resmî kilit davranışı](https://www.postgresql.org/docs/18/explicit-locking.html).

ROLL için bütün posting yolları balance yaratmadan önce aynı StockLot satırını FOR UPDATE ile kilitler; deferred guard commit'te aynı roll lot için pozitif Balance konum sayısını≤1 doğrular. Böylece henüz bulunmayan hedef balance satırı phantom'u yalnız mevcut balance kilidiyle korunmuş sayılmaz. Partial transfer reddi ve source debit/target credit tek transaction'dadır.

Count başlatma location transaction lock'ı altında snapshot+COUNTING freeze, sonra commit. Posting aynı location lock ve active freeze sorgusundan geçer. Sayım onayı tekrar lock alır; bakiye snapshot'la eşleşmezse durur, observed-expected hareketi ve freeze kapatma aynı commit'tir. İptal yalnız yetkili/audit ile freeze'i kaldırır; açık transaction kullanıcı ekranı boyunca tutulmaz.

DDL paket transaction'ında hata: tamamı rollback, uygulama flag kapalı. Commit sonrası fakat iş verisi yok: verified empty new tables ve bağımlılıklar için operatör onaylı down plan düşünülebilir; burada DROP script'i yok. İş verisi oluştuysa down migration/DROP/enum kaldırma yapılmaz; feature kapat, yeni yazmayı durdur, tutarlılık raporu ve additive forward fix. Hareketler satır silerek geri alınmaz, uygun reversal kullanılır. Eski uygulama yeni profili anlamıyorsa aynı stoka eski UI'dan manuel müdahale etmesine izin verilmez. İlk gerçek migration öncesi onaylı kurtarma stratejisi gerekir; mevcut E2 gerçek Neon backup BLOCKED durumu başarı sayılmaz.

## Salt okunur kontrol sorguları — bu görevde çalıştırılmadı

Kataloglara yöneliktir; müşteri/Auth satırı döndürmez. Hedef whitelist ve ayrı denetim onayıyla gelecekte uygulanır. Beklenen tablo **adları** listesiyle diff gerekir; yalnız sayı eşitliği güvenlik kabulü değildir.

```sql
BEGIN READ ONLY;
SELECT current_database(), current_user;
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname;
SELECT conrelid::regclass::text,conname,contype,convalidated,
       pg_get_constraintdef(oid)
FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2;
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;
SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid)
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY 1,2;
SELECT indexrelid::regclass::text,indisvalid,indisready
FROM pg_index WHERE indrelid IN
  (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace);
SELECT p.oid::regprocedure::text,p.prosecdef,
       r.rolname AS function_owner,p.proacl,pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
WHERE p.pronamespace='public'::regnamespace ORDER BY 1;
ROLLBACK;
```

Sonraki gerçek fixture kabulünde ayrıca non-owner rollerle action/field tests, ledger↔balance mutabakatı, 35 eski tablonun kontrollü fixture içerik hash karşılaştırması ve restore edilirken bütün yeni invariant'ların yeniden işlemesi gerekir. Gerçek işletme satırlarının hash/sayımı da bu V4.1 görevinde yapılmadı.

## Sprint E etkileşimi

`scripts/backup/postgres.ts` ad listesi35/forced21 ve 13 migration checksum'ı; `source-security.ts` fonksiyon hash/enum/relation/ACL sınırları sabittir. 24 tablo, iki enum, yeni constraint/trigger ve dar definer eklendiğinde mevcut motor **fail-closed durmalıdır**. Wildcard/new-table auto-enrollment, definer kontrolünü kaldırma veya sırf sayıyı59/45'e yükseltme yok. Yeni ad/owner/RLS/ACL/function/TOC/schema incelemesi, ayrı fixture dump+gerçek restore ve manifest format/coverage kararı sonrası sürümlü allowlist güncellemesi ayrı iş paketidir. E2.3 eski arşivlerin anahtarla okunabilirliği korunur; eski35-table arşiv yeni şemanın yedeği sayılmaz. Neon PUBLIC TEMP/CONNECT/builtin sahiplik ve remote Managed BLOCKED sorunları aynen açık kalır.
