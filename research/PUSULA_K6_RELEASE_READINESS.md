# PUSULA K6 — Muhasebe MVP teslim ön denetimi ve Neon geçiş kapısı

23 Ekim 2026 · Hedef: ZY Reklam, 29 Ekim 2026 · Dal: `feat/pusula-v030-neon-cloud`
İncelenen HEAD: `fc6d41bb4380baa1839064f9f7bfd4bfe317d6b9`.

Bu rapor yalnız teslim hazırlığıdır. Kod, migration, ortam ayarı ve gerçek veritabanı değiştirilmedi. Yalnız bu rapor oluşturuldu. Git stage/commit/push, Neon bağlantısı/SQL, migration apply, R2 upload, restore, recovery veya production işlemi yapılmadı. Buradaki işlem listeleri uygulama onayı değildir.

## Kararlar

| Karar | Sonuç |
| --- | --- |
| GIT_DELIVERY_READY | **READY — yalnız aşağıdaki kesin kaynak/belge listesi için.** Canlı dağıtım hazırlığı anlamına gelmez; commit/push yapılmadı. |
| MIGRATION_016_READINESS | **BLOCKED** — güncel managed preflight, provider rol/ACL yaşam döngüsü, onaylı uygulama yolu ve bağımsız gerçek post kabulü yok. |
| MIGRATION_017_READINESS | **BLOCKED** — hash'i doğrulanmış yerel aday var; canonical kayıt, non-superuser rol/sahiplik yaşam döngüsü, Prisma model/diff ve managed pre/post kabulü eksik. |
| BACKUP_RESTORE_READINESS | **LOCAL_EVIDENCE_ONLY / BLOCKED_REMOTE** — 56 tablo yerel sentetik restore kanıtı gerçek Neon/offsite/global rol kurtarma kabulü değildir. |
| GO_LIVE_BLOCKERS | **BLOCKED** — aşağıdaki P0 kapıları kapanmadan gerçek veri pilotu açılamaz. |

## Git teslim kapsamı ve korunmuş geçmiş

Başlangıçta 11 tracked dosya değişmiş, 49 dosya untracked; staged dosya ve silinen dosya yok. K6 ile toplam teslim listesi 61 dosya: 11 değişmiş + 50 yeni (K6 dahil). Untracked dizin özetleri yerine aşağıda tek tek dosyalar verildi. Bu liste yeni bir migration apply paketi değildir.

- K1: mevcut Customer/Supplier'a bağlı cari hesap, journal/posting, açılış/ters kayıt, tenant/company/activity RLS ve yerel fixture kapısı.
- K2: mevcut satış transaction'ına tek cari alacak posting'i, kaynak tekilliği, legacy-unposted ayrımı; TRY finans kesiti.
- K3: tahsilat/ödeme, onaylı tedarikçi borç belgesi, kasa/banka/POS, allocation, settlement ve kalıcı intent/replay UI.
- K4: gider belgesi, net/KDV/brüt, peşin/vadeli gider ve günlük finans raporu; fiziksel stok tüketimi üretilmez.
- K5: bütünleşik işletme/API/tarayıcı kabul kaynakları, 017 çevrimdışı adayı, mevcut backup motoruna yerel 56 tablo kapsamı. FinanceDesk başarılı yenilemede eski hatayı temizler.
- Kullanıcı planları: `ROADMAP.md`, `docs/planning/PUSULA_7_DAY_ACCOUNTING_MVP.md`, `docs/validation/PUSULA_ACCOUNTING_MVP_ACCEPTANCE.md`. Bunlar K1–K5 kod değişikliği diye yeniden sahiplenilmez; birlikte korunup teslim edilir.

`LAST_REPORT.md` yalnız 80 satır başa eklenmiş; eski içerik silinmemiş. `ROADMAP.md` yalnız 14 satır eklenmiş. Geçmiş `research`, `reports`, `docs/history`, checksum helper ve canonical Prisma dosyalarında tracked diff yok. HEAD ve önceki commit'ler değiştirilmedi. `.data/k5/start-hashes.json` salt okunur karşılaştırmasında üç kullanıcı planı, K1–K4 rapor/doğrulama dosyaları ve dört local SQL hash'i eşleşti. Bu K5 başlangıç kanıtıdır; bulunmayan daha eski bir başlangıç snapshot'ı yerine geçmez.

### Değişmiş tracked dosyalar (11)

- `LAST_REPORT.md`
- `ROADMAP.md`
- `scripts/backup/postgres.ts`
- `scripts/backup/restore-fixture.ts`
- `scripts/purchases/verify.ts`
- `scripts/stock/verify-local.ts`
- `scripts/suppliers/verify.ts`
- `src/components/cloud-desk.tsx`
- `src/lib/cloud/contracts.ts`
- `src/server/cloud/business/documents.ts`
- `src/server/cloud/handler.ts`

### Yeni dosyalar (50, K6 dahil)

- `docs/operations/PUSULA_INTERNAL_MVP_GO_LIVE.md`
- `docs/planning/PUSULA_7_DAY_ACCOUNTING_MVP.md`
- `docs/validation/PUSULA_ACCOUNTING_K1_VERIFICATION.md`
- `docs/validation/PUSULA_ACCOUNTING_K2_VERIFICATION.md`
- `docs/validation/PUSULA_ACCOUNTING_K3_VERIFICATION.md`
- `docs/validation/PUSULA_ACCOUNTING_K4_VERIFICATION.md`
- `docs/validation/PUSULA_ACCOUNTING_K5_VERIFICATION.md`
- `docs/validation/PUSULA_ACCOUNTING_MVP_ACCEPTANCE.md`
- `research/PUSULA_ACCOUNTING_K1_REPORT.md`
- `research/PUSULA_ACCOUNTING_K2_REPORT.md`
- `research/PUSULA_ACCOUNTING_K3_REPORT.md`
- `research/PUSULA_ACCOUNTING_K4_REPORT.md`
- `research/PUSULA_ACCOUNTING_K5_REPORT.md`
- `research/PUSULA_K6_RELEASE_READINESS.md`
- `scripts/accounting/k2-local-schema.sql`
- `scripts/accounting/k3-local-schema.sql`
- `scripts/accounting/k4-local-schema.sql`
- `scripts/accounting/k5-staff.ts`
- `scripts/accounting/local-schema.sql`
- `scripts/accounting/migration-candidate/017-finance.sql`
- `scripts/accounting/migration-candidate/manifest.json`
- `scripts/accounting/prepare-migration.ts`
- `scripts/accounting/verify.ts`
- `scripts/accounting/verify-k2.ts`
- `scripts/accounting/verify-k3.ts`
- `scripts/accounting/verify-k4.ts`
- `scripts/accounting/verify-k5.ts`
- `scripts/backup/accounting-coverage.ts`
- `scripts/backup/accounting-fixture.ts`
- `src/components/expense-desk.tsx`
- `src/components/finance-desk.tsx`
- `src/lib/cloud/accounting-contracts.ts`
- `src/lib/cloud/expense-contracts.ts`
- `src/lib/cloud/sale-source.ts`
- `src/lib/cloud/tracked-sale.ts`
- `src/lib/cloud/treasury-contracts.ts`
- `src/server/cloud/business/accounting/accounts.ts`
- `src/server/cloud/business/accounting/expenses.ts`
- `src/server/cloud/business/accounting/ledger.ts`
- `src/server/cloud/business/accounting/sales.ts`
- `src/server/cloud/business/accounting/treasury.ts`
- `tests/accounting-expenses.test.ts`
- `tests/accounting-ledger.test.ts`
- `tests/accounting-release.test.ts`
- `tests/accounting-sale-source.test.ts`
- `tests/accounting-tracked-sale.test.ts`
- `tests/accounting-treasury.test.ts`
- `tests/auth-e2e/k3.spec.ts`
- `tests/auth-e2e/k4.spec.ts`
- `tests/auth-e2e/k5.spec.ts`

### Kesin kapsam dışı

`.env*` (mevcut `.env.example` da bu değişiklik paketine dahil değil), `.env.local`, `.data/**`, `.neon`, `node_modules/**`, `.next/**`, `.next-auth-e2e/**`, `src/generated/prisma/**`, `next-env.d.ts`, `*.tsbuildinfo`, coverage, test-results, playwright-report, ham loglar, dump/şifreli backup, recovery key, fixture auth/DB credentials ve ekran kaydı teslim edilmez. `.gitignore` bunları dışlıyor; takip edilen env dosyası yalnız önceden var olan `.env.example`. `git add .` gibi geniş kapsam yerine yalnız yukarıdaki dosya listesi esas alınmalı.

Test/helper kaynak kodu ile çalışırken üretilen credential dosyaları farklıdır: kaynaklarda parola/TOTP için rastgele sentetik üretim ve env referansları var; gerçek fixture değerleri veya anahtar dosyaları teslim listesinde yok. Liste ve değişiklikler üzerinde credential/private-key/connection-string araması yapıldı; saptanan sabit bağlantı negatif testteki `example.invalid` sentetik hedef. Bu dar tarama tüm Git geçmişine secret taraması yapıldığı iddiası değildir.

017 SQL ve manifest genel build çıktısı sayılıp atılmaz: kullanıcı tarafından doğrulanması istenen, hash ile sabitlenmiş **inceleme artifact'larıdır**; yukarıdaki listede açıkça yer alır ve otomatik deploy'a kayıtlı değildir. Diğer üretilmiş dosyalar kapsam dışıdır.

## İlk 16 migration checksum doğrulaması

Her dosyanın ham SHA-256 değeri yeniden hesaplandı. 16/16 dosyanın `git hash-object` sonucu HEAD blob'u ile aynı; ilk 15 değer managed contract'ın başarılı tarihsel kayıtlarıyla, 016 ise `checksum` piniyle eşleşiyor. Tarihsel beş LF/CRLF çifti ve başarısız/rolled-back 008 checksum'u `scripts/db/migration-checksum.ts` içinde korunuyor; başarısız 008 başarılı SQL yerine kabul edilmiyor. Hiçbir dosya/history checksum'u yeniden yazılmadı. Bu kontrol uzaktaki bugünkü `_prisma_migrations` tablosunu okumadı.

| Migration | Ham SHA-256 |
| --- | --- |
| `202610160001_foundation` | `8aee85371a154958570ba41ae9a4da7eefc6b54790c74e36af88a4a6a356af23` |
| `202610160002_scope_security` | `94d2742fdd32026bf430185366795498ad20351ff937566f0c50f08713ee7d86` |
| `202610160003_auth_identity` | `5280b80d14245e06f42df12d8dad0f5989f3b3e009c32172c617808ac8db7649` |
| `202610160004_auth_mfa` | `96a7e660105b3ff8f897e0894d6eb8ceea3ee7152a4747c04cd1cbf449020644` |
| `202610160005_authorization` | `27bfae7c1ba1622774e57d4fe226893f46089b5c68bef3e8779fe2c7c7ed899a` |
| `202610160006_invitation` | `800cafc67b3b22d52428bbb7081fd709cd52b86c04e50c36b0621b89e5585506` |
| `202610160007_resource_policy` | `b0154ad979dd5a3ba077dbfa65379fee95eb420283b59166c2c52ca0a986bd86` |
| `202610160008_company_metadata` | `db552670276d5e5d5b7ed37a78cc618bac9a79d8dc3e5d72cabe239dd4e7d36a` |
| `202610160009_last_login` | `f068d522fb5f8c7472294fd804c24952b3ab7704cd2c3d689587a2767cd51752` |
| `202610170010_auth_mail` | `662eb41d02e3b3d6707facb83a7d5c8209e7c7679cce236579278f1f791496a7` |
| `202610170011_cloud_business` | `d50442a98f4bc6dfce20f9daecced81755bb950bfc702bda60f148d2170c378c` |
| `202610170012_cloud_catalog_controls` | `ee460b6466adbae8755b64840af36de3eb4d52756947ce6e6153fb2a791e2e2e` |
| `202610170013_sale_line_sealing` | `91ab80f3b4b879007808377e6a43a477495426685d0f8c364384a2e370711085` |
| `202610190014_supplier_catalog` | `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da` |
| `202610200015_purchase_orders` | `181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a` |
| `202610210016_goods_receipts` | `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567` |

## 017 manifest ve statik güvenlik denetimi

`scripts/accounting/migration-candidate/manifest.json` kaynaklarının dördü de gerçek ham dosya hash'leriyle eşleşti:

| Kaynak | SHA-256 |
| --- | --- |
| local-schema.sql | c4cc80ce5bfadbdec880e74f670af7b5250fc086021ff3569d893d526171b63b |
| k2-local-schema.sql | 46b5baa9a2578dcc846106aef65298649ea746b9861c846f615934db45a483ce |
| k3-local-schema.sql | 3af3cc48b2aadb419a671703db425f62fc5328875f4f945a25aadda60d308bcd |
| k4-local-schema.sql | 1aff40b98951a6edb7946792547e04d6dfaa1013e051539d9ed671b4f99b651a |

Aday SHA-256: `3548d3291a7c5c97919d5dee7ac20369c0c7a4de6888b4d21d17d4dcf4ad27aa` — **PASS**. `financeMigrationCandidate()` yalnız bellekte çağrıldı; checked aday SQL ve manifest ile birebir eşleşti. Üreticinin yazan CLI yolu çalıştırılmadı. Manifest: history değişmemiş, cloud apply false, provider evidence BLOCKED, son kapsam 56 tablo/42 FORCE RLS.

### Korunan güvenlik yapısı

Aday tek transaction, timeout, açık review GUC, tam PG18.6, başarılı history16 + 016 checksum ve FinanceAccount yokluğu önkoşullarını içeriyor. GUC kullanıcı onayı değildir. Dokuz finans tablosunda FORCE RLS, scope/izin kontrolleri, append-only kayıtlar, deferred denge/integrity, runtime SELECT/command EXECUTE ve runtime direkt DML reddi var. Executor NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOREPLICATION/NOBYPASSRLS. Definer fonksiyonlarda sabit `pg_catalog,public` search_path ve PUBLIC EXECUTE revoke var. MFA uygulama katmanındadır; SQL'in tek başına MFA kabulü olduğu söylenemez.

### Dağıtımı engelleyen somut açıklar

1. **Non-superuser sahiplik/rol yaşam döngüsü eksik.** Aday satır16 executor yaratıyor; satır119–123 ve sonraki bloklarda OWNER devri + SET ROLE yapıyor. Ancak actor'a açık SET üyeliği, yeni owner'a sahiplik devri için gereken geçici schema CREATE ve bunların sonunda temizlenmesi yok. Provider'ın otomatik üyelik vermesi varsayılamaz. K2 `CREATE OR REPLACE k1_command`, K3 rename/revoke ve wrapper yaratma aşamaları da executor sahipliğinden sonra doğru aktif owner altında yürümeli. Bazı REVOKE'lar RESET ROLE sonrası eski aktörde kalıyor. Yetki/sahiplik hatası veya etkisiz ACL uyarısı olasılığı gerçek non-superuser kabulüyle kapatılmalı. V4.3b.12'nin 016 için çözdüğü problem 017'ye kendiliğinden çözüm olmaz.
2. **Postcondition tam güvenlik fingerprint'i değil.** Son blok dokuz FORCE RLS, runtime DML ve runtime→executor üyeliğini kontrol ediyor; tüm function owner/ACL/grantor, helper/impl PUBLIC execute, actor geçici üyeliği, schema CREATE, auth EXECUTE, kolon/default ACL ve tam rol deltası için bağımsız exact kabul yok. `public` schema CREATE erişimi ve temp-shadow negatifleri de doğrulanmalı. Başlangıç runtime rol kontrolü tüm rol bayraklarını/üyelik zincirlerini kapsamaz.
3. **Canonical kayıt yok.** `prisma/migrations/202610230017_finance/migration.sql` mevcut değil; aday history sayısını 16 tutan fixture üzerinden uygulanmış. Runner'ın Prisma017 satırını gerçekten oluşturduğu ve ALREADY_APPLIED davranışı kanıtlanmamış. History16 kontrolünün Prisma'nın 017 in-progress kaydıyla birlikte doğru çalışması, başarısız/rolled-back satırları ve commit yanıtı kaybı ayrıca sınanmalı.
4. **Prisma model uyumluluğu açık.** `prisma/schema.prisma` içinde dokuz Finance modeli yok; runtime typed raw SQL kullanıyor. FinanceAccount/Journal/Posting/Intent/AccountAccess/Operation/Allocation/FundMovement/Expense için gerçek kolon tipleri, Decimal/date/UUID, ilişkiler ve composite scope eşleşmeli. Partial/NULLS NOT DISTINCT index, CHECK, RLS, trigger ve function gibi SQL'e ait nesnelerin sahipliği ayrıca belgelenmeli; migrate diff'in finans nesnelerini silmediği kabul edilmeli. Bu görev schema değiştirmedi.

Gerekli dar kaynak değişikliği: `scripts/accounting/prepare-migration.ts` içine incelenmiş rol/ownership yaşam döngüsü ve güçlü pre/post sözleşmesi; yeni hash'li aday/manifest; non-superuser yerel kabul; tek canonical 017 dizini; `prisma/schema.prisma`; mevcut `scripts/db/{migration-safety,migrate}.ts` ve stock runner/baseline sözleşmeleriyle uyumlu ardıl runner/kabul testleri. 016'nın 16-dosya doğrulaması kaldırılıp tüm pending zinciri kontrolsüz çalıştırılmamalı; 016 ve 017 ayrı onaylı aşama olarak kalmalı. Eski 001–016 byte'ları, baseline ve rollback008 kayıtları korunmalı. Değişiklik gerekiyorsa mevcut adayın byte-identical terfisi iddiası bırakılıp yeni manifest ve regresyon kanıtı üretilmeli. Şimdi bu değişikliklerin hiçbiri yapılmadı.

## MIGRATION_016_READINESS — managed kritik yol

Kaynaklar: `scripts/stock/{managed-contract.json,managed-contract.ts,managed-runner.ts,managed-preparation.ts,migrate.ts}`, `research/PUSULA_V04_V43B12_ACL_FIX.md`.

1. **Güncel managed preflight — BLOCKED.** Tarihsel hedef `managed-contract.json` içinde; güncel provider GET kimlik/branch/host/DB/owner/kapasite kanıtı yok, son HTTP401 çözülmüş sayılmaz. Direct bağlantı, TLS verify-full/CA, actor=sessionActor ve PG180006 doğrulanmalı. Gerçek pre40 tablo/26 FORCE RLS, başarılı history15 + izinli rolled-back008, tüm checksum/schema/permission/ACL/grantor/cluster fingerprint'leri kabul edilmeli. Database CONNECT/TEMP, kolon/default ACL ve grantor geçmişindeki boşluklar yeniden ölçülmeli. Yetki: hedef sahibi tarafından salt okunur provider/DB inceleme erişimi; bu görevde kullanılmadı.
2. **Provider rol/ACL — BLOCKED.** CREATE/GRANT/SET/REVOKE/DROP, owner transferi ve schema CREATE'nin geçici verilmesi/temizlenmesi gerçek provider'da kanıtlanmalı. `INHERIT FALSE, SET TRUE` grant'ı aktörün henüz role geçmeden ACL sahibi olduğu anlamına gelmez. 01006/01007 uyarısı sessiz kabul edilemez. Yetki: ayrı açık rol/probe DDL yetkisi; operatör hedef ve cleanup planını onaylamalı.
3. **Gerçek apply yolu — BLOCKED.** Managed runner yalnız offline snapshot audit yapıyor; `--apply` kesin `STOCK_MANAGED_APPLY_DISABLED`, sözleşme `applyEnabled=false`, `postFingerprint=null`. `requireManagedPostAcceptance()` da `STOCK_MANAGED_POST_NOT_ENROLLED` fırlatıyor. Salt JSON bayrağı açmak çözüm değil. İncelenmiş hedefe bağlı uygulama/başarısızlık durum sözleşmesi ve ayrı 016 apply onayı gerekir. K6 bu korumaları kaldırmaz.
4. **Bağımsız post kabul — BLOCKED.** 47 tablo/33 FORCE RLS, başarılı canonical history16, eski history/izinler korunmuş olmalı. Altı stok fonksiyonunun owner/ACL/grantor deltası, PUBLIC0/runtime3 EXECUTE, auth EXECUTE reddi; executor üyelik/schema CREATE/creator kalıntısı yokluğu; runtime yedi stok tablosuna DML/TRUNCATE reddi ve RLS/işlev regresyonları ölçülmeli. Beklenen delta gözlenen posttan türetilmemeli; `verifyManagedDelta` sonucu yalnız POST_INVARIANTS_ONLY/cloudAccepted=false. Bağımsız inceleme ile gerçek post fingerprint enrollment ve son kabul ayrıca gereklidir. Commit yanıtı kaybı otomatik rollback veya tekrar apply sayılmaz; durum ölçülmeden devam edilemez. Yetki: operatörün 016 apply onayı + bağımsız post kabul sorumlusu.

## BACKUP_RESTORE_READINESS — mevcut motorla en kısa yol

Kanıt: `docs/validation/PUSULA_ACCOUNTING_K5_VERIFICATION.md`; araçlar `scripts/backup/{postgres,core,keys,key-vault,decrypt,restore-fixture,accounting-fixture,accounting-coverage,source-security,policy,storage,cli}.ts`.

K5 kaydı: fixture `v42-fe3c040b-4649-48c3-88a4-8b22fb1fa385`, 56 tablo içeriği/hash, 42 FORCE RLS, katalog/kolon/default ACL/owner/function/trigger/FK/index karşılaştırması ve sıfır journal/fon/gider farkı. CHECK parser round-trip ve gerçek CHECK(true) negatif kontrolü mevcut. Bu sonuç önceki K5 kanıtıdır; K6 restore veya tam test suite'i yeniden çalıştırmadı.

Sınır: kaynak sentetik loopback, restore aynı fixture cluster'ında yeni template0 DB, global roller önceden mevcut, ayrı klasör aynı bilgisayarda; anahtar sentetik. Gerçek Neon kaynağı, bağımsız offsite, production key custody, database/global rol ACL kurtarma ve gerçek işletme oturumu kabulü yok. Browser mobil profili fiziksel Safari ve gerçek Neon kesintisi kanıtı değil.

Gerekli kapsam ve yetkiler:

| Eksik | Gerekli dosya/işlem | Beklenen ayrı yetki/onay |
| --- | --- | --- |
| Gerçek kaynak ve tutarlı kesit | Güncel hedef/history/şema fingerprint'i, mevcut kaynak için repeatable-read export; 016 öncesi gerçek kapsamı doğrula (tarihsel40/26 otomatik güncel kabul edilmez). | Kaynak sahibi: belirli DB/branch ve bakım penceresi için gerçek veri okuma/export onayı. |
| Dar provider backup rolü | `postgres.ts`, `source-security.ts`, `policy.ts`: SELECT + kontrollü BYPASSRLS'nin provider'da sağlanabilirliği; no DML/DDL/ownership/membership/definer EXECUTE; read-only, DB CONNECT/TEMP ve diğer DB/builtin nesne erişimi. | Provider yöneticisi: gerçek rol/GRANT/REVOKE değişikliği ve cross-DB audit/risk kabulü. |
| 017 sonrası tam şema | `accounting-coverage.ts` 56 isim içeriyor; production CLI varsayılanı hâlâ35/21. `postgres.ts` TOC/şema ve `source-security.ts` function allowlist/pinlerini son onaylı56/42 + stock/finance fonksiyonları için yeniden incele; fixture bypass'ını cloud'a taşımadan gerçek profil kabulü. | Kod incelemesi ve kaynak güvenlik kabulü; mevcut managed audit kapısını atlama yetkisi yok. |
| Şifreleme/anahtar kurtarma | Mevcut AES-256-GCM + HMAC, key-vault ve private decrypt kullan; bağımsız anahtar custody/rotation ve kayıp anahtar kurtarma denemesi. Anahtarı artifact veya rapora ekleme. | Anahtar sorumlusu: gerçek key oluşturma/kullanma, ayrı saklama ve kurtarma yetkisi. |
| Güvenilir offsite | Mevcut `storage.ts` R2 araçları; bucket/tenant/least privilege, bağımsız erişim, saklama/retention politikası, digest/HMAC/GCM ve indirilmiş kopya doğrulaması. `MANAGED_REMOTE_UPLOAD_NOT_APPROVED` korunur. | Depolama/veri sahibi: belirli bucket/prefix, gerçek veri aktarımı, saklama süresi ve R2 upload için ayrı açık onay. |
| Gerçek restore | Yeni boş, izole provider hedefi; aynı cluster rollerine dayanmayan rol/ownership/global+DB ACL kurtarma planı; 56 tablo hash/katalog/FORCE RLS/trigger/function ve finans mutabakatı; dış işler kapalı, Auth/MFA oturum invalidasyonu, süre/RPO/RTO ölçümü. | Hedef sahibi: hedef yaratma ve gerçek restore DDL/DML onayı; güvenlik sorumlusu rol/oturum kurtarmasını kabul eder. Kaynak apply onayı bunu kapsamaz. |

Yeni backup motoru gerekmiyor. `MANAGED_REMOTE_OBJECT_AUDIT_REQUIRED` mevcut gerçek-kaynak güvenlik engelidir; allowlist'e yalnız tablo adı eklemek yeterli değildir. Göç öncesi mevcut kaynak geri dönüş kabulü ile 017 sonrası 56/42 tam şema export/restore kabulü ayrı kanıtlardır. Gelecekteki tablolar göç öncesi yedekte varmış gibi gösterilemez.

Recovery `br-late-river-baeipun8`: **token_roles / ROLE_DELTA_UNRESOLVED — BLOCKED**. Bulguyu kapatan yeni provider/rol kanıtı yok. Recovery branch tam recovery sertifikası veya güvenilir otomatik rollback hedefi sayılmaz. Çözüm: mevcut recovery raporları üzerinden rol farkı/ACL nedenini incele; değişiklik gerekirse ayrıca o branch'e özgü onay al. K6 recovery değiştirmedi.

## GO_LIVE_BLOCKERS ve en kısa güvenli sıra

| Öncelik / kapı | Tam eksik / kapanış işlemi | Dosya veya kanıt yeri | Beklenen yetki |
| --- | --- | --- | --- |
| P0 / Kaynak kimliği | HTTP401 sonrası güncel provider kimliği, kapasite ve hedef doğrulaması; tam pre/grantor audit | managed-contract ve yeni tarihli redakte provider/preflight kaydı | Provider/DB sahibi salt okunur erişimi |
| P0 / Geri dönüş temeli | Mevcut gerçek kaynak yedeği, rol/DB ACL kurtarma, bağımsız offsite ve yeni hedefte restore kabulü | Mevcut backup araçları ve ayrı gerçek-kaynak kabul raporu | Kaynak, rol, key, offsite/upload, restore için yukarıdaki ayrı onaylar |
| P0 / 016 | Provider rol yaşam döngüsü + incelenmiş uygulama yolu + gerçek apply + bağımsız post/history16 | stock managed sözleşmeleri ve 016 post kabul raporu | Açık 016 apply ve bağımsız inceleme yetkisi |
| P0 / 017 terfi | Non-superuser ACL/owner düzeltmesi, Prisma modeller/diff, tek canonical017, ardıl runner/metadata/rollback-negatifleri | Yukarıda sayılan accounting/Prisma/runner dosyaları | Önce kod incelemesi; sonra ayrı 017 apply onayı |
| P0 / 017 provider kabul | Gerçek pre47/33 → post56/42, history17, tam rol/function/ACL/RLS ve runtime negatifleri | Ayrı017 pre/post ve artifact hash kabul raporu | Provider rol işlemi +017 apply + bağımsız post kabulü |
| P0 / Son şema yedeği | 017 sonrası gerçek56/42 export/offsite/key recovery/restore ve finans mutabakatı | Mevcut backup motorunun kabul edilmiş son profil raporu | Gerçek kaynak/key/offsite/restore sahipleri |
| P0 / Runtime ve işletme | Canlı MFA/explicit DENY/erişim matrisi, açılış kesimi/müşteri-tedarikçi mutabakatı, kasa/banka/POS, personel masaüstü/mobil kabulü ve cutover/rollback sorumlusu | `accounts.ts` guard'ına ilişkin sonraki incelenmiş runtime değişikliği; MVP acceptance/go-live belgesi | Ayrı runtime açılışı ve ZY Reklam yetkilisinin gerçek veri pilot/go-live onayı |

En kısa sıra: **Git inceleme paketi → güncel hedef/preflight + mevcut kaynak geri dönüş kabulü → onaylı016 → bağımsız016 post/history16 → incelenmiş canonical017 → ayrıca onaylı017 → bağımsız017 post/history17 → son56/42 gerçek backup/restore → runtime açılış incelemesi ve işletme kabulü → ayrı go-live kararı.** 017 kaynak hazırlığı canlı kanıt beklenirken yapılabilir; gerçek uygulama sırası daima016→017. Hazır olmayan kapı yerine checksum rewrite/resolve, fixture marker veya kontrolsüz `db:migrate` kullanılamaz.

`ACCOUNTING_CLOUD_REVIEW_REQUIRED` ve `STOCK_MANAGED_APPLY_DISABLED` bu teslimde aynen korunur. Satış POST yolu da muhasebe kapısına bağlı olduğundan bu Git paketi mevcut cloud'a sıradan uygulama deploy'u olarak çıkarılırsa normal yeni satış503 alır; Git tesliminin READY olması runtime deploy onayı değildir. Bütün kapılar kapanmadan 29 Ekim çıktısı yalnız sentetik gösterim olabilir; gerçek verili pilot BLOCKED kalır. Yeni sprint/özellik gereksinimi eklenmedi.

## K6 doğrulama sınırı

Çalıştırılan kontroller: Git status/diff/log/index, raw migration SHA-256 ve HEAD blob karşılaştırması, dört kaynak+aday manifest hash'i, bellekte aday yeniden üretimi, seçili K5 başlangıç hash'leri, teslim kapsamı/credential taraması ve `git diff --check`. Sonuncusu PASS; tracked metinlerde Git LF→CRLF uyarısı var, dosyalar normalize edilmedi. Bu yüzden ileride canonical017 terfisinde artifact byte kimliği tekrar doğrulanmalı. K5'teki test/build/restore sonuçları tarihsel belge olarak aktarıldı; K6 yeni test/build/DB sonucu iddia etmez. Rapor dışında dosya değişikliği yapılmadı.