# PUSULA — Finans migration017 dağıtım hazırlığı

23 Ekim 2026 · Dal `feat/pusula-v030-neon-cloud` · Başlangıç HEAD `edc03121737051d1eb180e621ccd91acfcc92743`.

**M017_LOCAL_PASS. Gerçek Neon dağıtımı ve GO_LIVE_PASS: BLOCKED.** Bu çalışma canonical017 kodu ve yeni izole PostgreSQL18.6 kabulüdür; bulut uygulama onayı değildir. Git stage/commit/push/merge yapılmadı.

Yerel017 i?in `FIX_REQUIRED` bulgusu kalmad?. `BLOCKED` karar? ger?ek provider/016/backup/i?letme kap?lar? i?in devam eder.

## Sonuç ve checksum

Canonical `prisma/migrations/202610230017_finance/migration.sql` ve inceleme kopyası `scripts/accounting/migration-candidate/017-finance.sql` byte-identical LF:

`9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`

Bu **yeni** SHA-256'dır. Eski K5 adayı `3548d3291a7c5c97919d5dee7ac20369c0c7a4de6888b4d21d17d4dcf4ad27aa` tarihsel kabul olarak `migration-candidate/history/017-finance-k5.sql` ve `manifest-k5.json` içinde korundu; güncel checksum diye sunulmaz. Manifest `previousCandidateSha256`, dört değişmemiş ham kaynak hash'i, `canonicalHistoryChanged=true`, `cloudApplyEnabled=false`, `providerEvidence=BLOCKED` kaydeder. İlk16 SQL'in başlangıç ham hash'leri değişmedi;016 hâlâ `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`.

## Rol/sahiplik ve fail-closed kabul

017 artık disposable `pusula_finance_role_creator` üzerinden executor yaratır. Migration aktörüne geçici `INHERIT FALSE / SET TRUE` üyelik açıkça verilir. Önce tüm fonksiyon gövdeleri, K2/K4 replace işlemleri, K3 rename/implementation/wrapper ve trigger kurulumları gerçek yaratıcı/sahip aktörde tamamlanır. Sonra geçici schema CREATE verilir,16 finans fonksiyonunun sahipliği executor'a devredilir; executor etkin rolken PUBLIC/runtime/auth ACL'leri kapatılıp yalnız8 açık runtime girişine EXECUTE verilir. RESET sonrası CREATE kaldırılır, creator kendi executor üyeliğini geri alır ve creator DROP edilir. Runtime'a executor üyeliği veya doğrudan finans DML verilmez.

Runtime girişleri: `k1_command`, `k2_post_sale`, `k3_command`, `k3_read`, `k3_due`, `k3_can_fund`, `k3_outcome`, `k4_expense`. Implementation ve trigger/helper fonksiyonlarına runtime EXECUTE yoktur.16 fonksiyonun owner'ı executor, SECURITY DEFINER kümesi7 fonksiyon; sabit search_path `pg_catalog, public`. İşlev gövdelerindeki veri tabloları public-qualified kalır. Executor NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOREPLICATION/NOBYPASSRLS; tablo sahibi değildir. Geçici rol/üyelik/schema CREATE kalıntısı yoktur.

Sadece schema CREATE kullanabilmek veya eski `pusula_can` fonksiyonunu çağırabilmek GRANT yetkisi değildir. Precondition artık schema CREATE ve `pusula_can` EXECUTE için grant authority ister; provider'da bu yetki ayrıca kanıtlanmalıdır. PG18.6, review GUC, başarılı history16/016 checksum, sınırlı runtime ve boş finans baseline kapıları korunur. Review GUC operatör onayı yerine geçmez.

SQL transaction postflight;9 FORCE RLS tablo/runtime DML reddi,16 fonksiyonun owner/SECURITY DEFINER/search_path, gerçek ACL grantor/grantee, PUBLIC/auth kapatma ve geçici yetki temizliğini denetler. Ayrı TypeScript kabulü bunlara ek olarak tablo/kolon/default ACL, tüm rol üyelikleri, diğer non-superuser rollerin efektif EXECUTE'u ve tam şema envanterini sınar.01006/01007 gibi etkisiz ACL uyarıları kabul edilmez; pozitif exact-SQL non-superuser dry-run'da warning sayısı0.

Beklenen katalog **hedef post sonucundan öğrenilmez**. Hash'i sabitlenmiş, korunmuş K1–K4/K5 SQL'i hedef017'den önce rollback-only transaction'da yürütülür. İşlev gövdesi satır sonları LF olarak normalize edilerek referans oluşturulur; transaction geri alınır. Tablolar, kolonlar, indeksler, constraint'ler, policy'ler, trigger'lar, fonksiyon gövdeleri/SECURITY DEFINER ve enumlar için8 kategori tam karşılaştırılır. Rol/owner/ACL/grantor sözleşmesi ayrıca açık kurallarla tanımlıdır; ilk hedef posttan otomatik enrollment yoktur.

## Tek Prisma geçmişi ve modeller

001–016 SQL değişmez. Canonical017 aynı `prisma/migrations` zincirinin ardılıdır. Eski016 runner yalnız16 dosyalık private phase kopyasını gerçek Prisma'ya verir; kopya isim/hash envanteri canonical001–016 ile eşleşmelidir. Yeni017 var diye tüm pending zincir uygulanmaz. Legacy `prisma-safe.config.ts` açık phase runner olmadan fail-closed kalır. Ayrı ikinci `_prisma_migrations` tablosu veya otomatik resolve yoktur.

`prisma-finance-local.config.ts` ortam dosyası yüklemez; UUID fixture/marker, loopback host, sabit fixture DB/actor, port ve URL parametre allowlist'i gerektirir. Provider hostuna bağlanamaz. Bu **yerel kabul** girişidir; managed017 apply runner veya Neon yetkisi değildir.

Dokuz Prisma modeli: FinanceAccount, FinanceJournal, FinancePosting, FinanceIntent, FinanceAccountAccess, FinanceOperation, FinanceAllocation, FinanceFundMovement, FinanceExpense. UUID, Decimal(18,2), date, timestamptz(6), JSON/scalar alanları ve gerçek composite FK ilişkileri eşleşir. Mevcut LegalEntity/Activity/Customer/Supplier/CloudSale/AuthUser taraflarına reverse ilişkiler eklendi. Bazı composite FK reverse alanları Prisma koleksiyonudur: SQL'deki tekil operationId/journalId/saleId/intentId unique'leri korunur; Prisma'nın composite one-to-one şartı için gereksiz yeni unique indeks üretilmez.

Prisma7.10.1 `partialIndexes` ile `finance_sale_business_source` temsil edilir. NULLS NOT DISTINCT semantiği, CHECK, deferred/immutable trigger, RLS/policy ve fonksiyonlar SQL otoritesinde kalır. Gerçek local DB → Prisma model diff'i **finans nesnelerine hiçbir DDL önermez**; DROP FUNCTION/POLICY/TRIGGER veya RLS kaldırma da yoktur. Diff salt okunur üretilir, uygulanmaz. Tüm şemanın diff'inde017 öncesi mevcut stok/FK/index modelleme farkları vardır; bu genel diff güvenli bir sonraki migration diye kabul edilmez. Canonical017 deployment bu diff'i kullanmaz; bağımsız katalog karşılaştırması önceki nesnelerin de korunduğunu doğrular.

`.gitattributes` canonical SQL ve017 inceleme kopyasını LF sabitler; dört ham SQL hash girdisini ve eski K5 artifact'ını byte-preserving tutar. Git artifact kontrolü artık017 dahil10 kontroldür. İlk16 tarihsel beş LF/CRLF checksum çifti ve resolved008 uyumluluğu aynen korunur.

## Yerel kanıt

[Komutlar, fixture kimliği ve başarısız geliştirme koşuları](../docs/validation/PUSULA_ACCOUNTING_017_VERIFICATION.md).

- Gerçek Prisma deploy:17 başarılı migration;56 tablo/42 FORCE RLS; normal tekrar deploy yeni kayıt oluşturmaz.
- NO SUPERUSER/NO BYPASSRLS/NO CREATEDB gerçek LOGIN aktörü, CREATEROLE=true, boş createrole_self_grant ile kabul.
- Review, SET/schema CREATE eksikliği ve geç SQL hatası negatifleri; gerçek Prisma geç hata/atomic rollback; failed metadata REVIEW_REQUIRED. Test harness'i yalnız kendi sentetik failed017 satırını açıkça temizler; runner resolve/skip yapmaz. Eski başarılı geçmiş ve önceden fixture'a yerleştirilmiş reviewed rolled-back008 satırı birebir korunur.
- Kayıp COMMIT yanıtı için gerçek commit yanıtı bilerek kullanılmaz; bağımsız admin bağlantısı dayanıklı tek satırı doğrular. Bu deterministik response-loss simülasyonudur, gerçek ağ/TLS kopması veya provider failover testi değildir. COMMIT-sent/committed hata durumu REVIEW_REQUIRED; otomatik retry/rollback iddiası yoktur.
- Tüm9 tabloda runtime INSERT/UPDATE/DELETE/TRUNCATE ve SET executor gerçek42501; PUBLIC/auth/diğer roller EXECUTE reddi, grantor/üyelik/default/kolon ACL, negatif RLS/function/membership/index/constraint bozulmaları.
-235 API/SQL regresyonu: K1–K5 toplam71; DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36. İki tenant/company/activity izolasyonu, MFA/explicit DENY, append-only, idempotency, gerçek iki bağlantılı tahsilat yarışı ve finans mutabakatı dahil.
- Vitest463, TypeScript, ESLint, production build ve Git artifact10 kontrolü PASS. Bu görevde tarayıcı veya backup/restore kabulü yeniden çalıştırılmadı.

## Kalan Neon kapıları ve 29 Ekim etkisi

**BLOCKED / gerçek Neon:** güncel provider kimlik/kapasite (tarihsel401 kapanmış sayılmaz), doğru migration aktörünün CREATE ROLE/SET/GRANT/REVOKE/DROP/schema/function grant authority ve grantor davranışı, bağımsız managed pre/post,016 gerçek post/history16 kabulü,017 provider sözleşmesi ve ayrı açık apply onayı. Uygulama sırası **016 → bağımsız016 kabulü → 017 → bağımsız017 kabulü** olarak kalır. Yerel katalog/rol kanıtı gerçek provider yetkisinin kanıtı değildir.

**BLOCKED / işletme:** gerçek kaynaktan bağımsız şifreli offsite backup, anahtar/global rol/DB ACL kurtarma ve restore mutabakatı; recovery `token_roles / ROLE_DELTA_UNRESOLVED`; gerçek personel/işletme/açılış/kasa-banka-POS kabulü. Bu görev restore veya R2 çalıştırmadı; yeni backup motoru yoktur.

`ACCOUNTING_CLOUD_REVIEW_REQUIRED`, `STOCK_MANAGED_APPLY_DISABLED`, managed `applyEnabled=false / postFingerprint=null` korunur. Gerçek Neon bağlantısı/SQL/rol işlemi, R2, restore, yeni bulut branch/snapshot, production/recovery değişikliği, `.env.local` düzenlemesi ve Git stage/commit/push/merge yoktur. Build mevcut env dosyasını yalnız okur.

29 Ekim hedefi için017'nin yerel teknik engeli kalktı; gerçek016/provider/backup ve işletme kapıları takvimin kritik yoludur. Bunlar kabul edilmeden tarih canlı pilot garantisi değildir; yalnız sentetik gösterim yapılabilir. Yeni sprint/özellik eklenmedi.

## Kesin değişiklik listesi

Toplam 23 dosya; üretilmiş client/build/fixture/log ve credentials kapsam dışı.

- `.gitattributes`
- `docs/validation/PUSULA_ACCOUNTING_017_VERIFICATION.md`
- `LAST_REPORT.md`
- `prisma/migrations/202610230017_finance/migration.sql`
- `prisma/schema.prisma`
- `prisma-finance-local.config.ts`
- `prisma-safe.config.ts`
- `research/PUSULA_ACCOUNTING_017_READINESS.md`
- `scripts/accounting/migration-candidate/017-finance.sql`
- `scripts/accounting/migration-candidate/history/017-finance-k5.sql`
- `scripts/accounting/migration-candidate/history/manifest-k5.json`
- `scripts/accounting/migration-candidate/manifest.json`
- `scripts/accounting/migration-contract.ts`
- `scripts/accounting/migration-fixture.ts`
- `scripts/accounting/prepare-migration.ts`
- `scripts/accounting/verify.ts`
- `scripts/accounting/verify-k2.ts`
- `scripts/accounting/verify-k3.ts`
- `scripts/accounting/verify-k4.ts`
- `scripts/db/verify-checksum-artifact.ts`
- `scripts/stock/migrate.ts`
- `scripts/stock/verify-local.ts`
- `tests/accounting-release.test.ts`
