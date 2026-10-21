# PUSULA V4.3b.9 — Managed ACL yerel düzeltmesi

## Sonuç ve kapsam

**MANAGED_ACL_LOCAL_PASS.** Migration 016'nın non-superuser rol sahipliği sorunu izole PostgreSQL 18.6 üzerinde çözüldü. Gerçek Neon apply kapalıdır. Bu sonuç Neon üzerinde yeni SQL'in başarıyla çalıştığı, production veya bağımsız backup/restore kabulü anlamına gelmez.

Dal `feat/pusula-v030-neon-cloud`; başlangıç HEAD `f56caed5eadb64e76304777f83477f1677c19d19`. Önceki V4.3b.5–8 rapor değişiklikleri korundu. Bu sprintte gerçek Neon/API, development/recovery/production/test bulut DB bağlantısı veya mutation yapılmadı. Yalnız yeni UUID'li, SCRAM ve loopback ile sınırlandırılmış yerel cluster'lar kullanıldı. Gerçek Auth/MFA, R2 ve `.env.local` değiştirilmedi; commit/push/merge yapılmadı.

## Rol sahipliği çözümü

Fixture gerçek ayrı bağlantıyla `fixture_managed_owner` olarak login olur: `current_user=session_user`, `SUPERUSER=false`, `CREATEROLE=true`, `BYPASSRLS=true`, `createrole_self_grant=''`, PostgreSQL `180006`. Actor mevcut public tabloların ve fonksiyonların sahibidir; database owner üzerinden schema CREATE hakkına sahiptir. Runtime ve auth rollerinde superuser/CREATEROLE/BYPASSRLS yoktur. Bu, Neon'a benzer yönetici aktörünü sınar; provider'ın tüm hook'larının veya birebir ACL envanterinin emülasyonu değildir. Simüle provider rolünün ayrıcalıkları genişletilmedi.

İlk denemeler iki farklı sorunu kanıtladı:

1. Executor'a SET yolu verilmediğinde `ALTER FUNCTION OWNER` **42501** ile durur; executor'a schema CREATE verilmediğinde de **42501** alınır. Her iki durumda şema fingerprint'i değişmez ve oluşturulan roller rollback olur.
2. Tek aktörün executor'ı yaratıp kendisine geçici SET vermesi yeterli değildir: SET grant'i kaldırıldığında bootstrap superuser grantor'lı, `ADMIN=true / INHERIT=false / SET=false` üyelik kalır. Actor bu otomatik grant'i kendisi kaldıramaz. Bu gerçek başarısızlık `STOCK_EXECUTOR_MEMBERSHIP_REJECTED` ile yakalandı. [PG18 rol nitelikleri](https://www.postgresql.org/docs/18/role-attributes.html) bu davranışı açıklar.

Nihai SQL tek BEGIN/COMMIT içinde şu yolu kullanır:

- NOLOGIN, NOSUPERUSER, NOBYPASSRLS ve yalnız CREATEROLE yetkili geçici `pusula_stock_role_creator` yaratılır. Actor'a bu role yalnız SET yolu verilir; INHERIT kapalıdır.
- Bu geçici rol executor'ı yaratır ve gerçek session aktörüne executor için yalnız SET verir. Runtime veya auth'a hiçbir executor üyeliği verilmez.
- Gerçek aktöre dönülür. Tablolar aktöre ait kalır; dört definer fonksiyon executor'a devredilir. Executor'ın schema CREATE hakkı yalnız sahiplik devirleri boyunca vardır ve kaldırılır.
- Geçici oluşturucu, kendi verdiği executor SET üyeliğini kaldırır. Aktöre dönülüp oluşturucu rol DROP edilir. Bu DROP, oluşturucunun executor üzerindeki bootstrap ADMIN üyeliğini de ortadan kaldırır. [PG18 DROP ROLE](https://www.postgresql.org/docs/18/sql-droprole.html) üyeliklerin otomatik kaldırılmasını belirtir.

Commit sonrası bağımsız sorgu ve runner postflight'ı: geçici oluşturucu yok, executor için hiçbir üst/alt üyelik yok, schema CREATE yok, actor SET/INHERIT yok. Actor'ın commit sonrası executor'a `SET ROLE` denemesi 42501 alır. Executor NOLOGIN/NOSUPERUSER/NOCREATEROLE/NOCREATEDB/NOREPLICATION/NOBYPASSRLS olarak kalır; hiçbir tabloya sahip değildir. Kalıcı yönetim üyeliği veya provider rol değişikliği bırakılmaz.

Geçici rol yalnız kendi transaction'ında görünür. Geç aşamaya eklenen division-by-zero **22012**, roller, üyelikler, şema ve permission değişikliklerinin tamamını geri alır. Runner preflight'ı hem executor hem oluşturucu rolünden birinin önceden bulunmasını kısmi durum olarak reddeder. Postflight da geçici rol/üyelik/schema CREATE kalıntısını ACL pininden bağımsız reddeder. Aynı session aktörünün kullanılması şarttır; gelecekteki cloud runner `current_user=session_user=neondb_owner` koşulunu yeniden doğrulamalıdır.

## Migration 008 geçmişi

Başarılı migration sayısı artık yalnız `finished && !rolled_back` kayıtlarından hesaplanır. Yalnız `202610160008_company_metadata` için, immutable manifest checksum'u eşleşen en fazla bir resolved rollback ve aynı migration için tam bir başarılı kayıt kabul edilir. Kayıtlar değiştirilmez veya yeniden sıralanıp yazılmaz.

Unresolved kayıt, bilinmeyen isim/checksum, çift başarılı kayıt, eksik başarılı migration, iki rollback, başarılı karşılığı olmayan rollback, başka migration'a ait rollback veya aynı kayıtta finished+rolled_back durumu reddedilir. Gerçek fixture'da resolved 008 kaydının tüm alanları apply öncesi/sonrası birebir karşılaştırıldı. Ek unresolved/bilinmeyen checksum/çift başarı/016 rollback enjeksiyonları runner tarafından reddedildi. Test harness'i yalnız kendi sentetik enjeksiyonlarını açıkça temizler; runner history DELETE/UPDATE/resolve yapmaz.

Bu kabul gerçek development'taki eski başarısız kaydın henüz okunmamış checksum'unu otomatik onaylamaz. Sonraki salt okunur cloud denetimi o satırın checksum ve durumunu ayrıca doğrulamalıdır; bilinmeyen checksum için istisna eklenmedi.

## SQL bütünlüğü ve ayrı pinler

| Artifact | Önce | Nihai |
| --- | --- | --- |
| 016 SHA-256 | `80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18` | `7368c775ec5d9b2b126b4731d5985ec83d1cad077f2cd5904ff596a04f22b272` |
| Function schema hash | `54df0b609a83daa0dc4037d9930ef1c66e61950b1fe81ba5767bdd120286b88c` | `985bc3b9cf0cb7fdd3930786d8fbad6c60d6e2732d057e19cf3536f981c9b227` |
| Normal fixture pre/post ACL | Mevcut ayrı pinler | **Değişmedi**, nihai SQL ile yeniden doğrulandı |
| Non-superuser fixture pre ACL | Yeni ayrı profil | `a5f8f3453c2796acbff4441c37c3a1d92f3154319699cd82d9f953bc5aea9aac` |
| Non-superuser fixture post ACL | Yeni ayrı profil | `d41e2388751ffe3a2d54f98cf9a1ef756d5869fff318f4bfd2f078d712fe65cd` |

İlk 15 migration, eski DB baseline ve backup allowlist'i değiştirilmedi. Postflight'ın diğer yedi şema kategori hash'i değişmedi. SQL'deki iş kuralları ve özgün Türkçe permission etiketleri korundu. Yeni fonksiyonların tümünde `search_path=pg_catalog,public,pg_temp` kullanılır; qualified public nesne referansları ve aynı transaction içindeki PUBLIC EXECUTE revoke'ları korunur.

`managed-fixture-baseline.json` yalnız yerel non-superuser profilidir. `runner-baseline.json` yalnız mevcut superuser fixture profilidir. İkisi Neon pin'i sayılmaz.

`managed-baseline.json` ayrı tarihsel Neon pre profilini tutar: V4.3b.8 READ ONLY kaynak hash'i `59252aa93cf52f7d087e066bcf7ab0b469cd1bd5cd57a372642ce2f7bb07c009`. Yeni SQL checksum'una bağlanmıştır; `post=null`, `applyEnabled=false`. Post pin boşken doğrulama açık hata verir; yerel pinle değiştirme veya otomatik enrollment yoktur.

`managed-preparation.ts` yalnız saf doğrulama ve bağlantı planı üretir: development owner/host/database allowlist'i, verify-full URL, CA geçerlilik süresi, hostname/servername, rejectUnauthorized=true ve minimum TLS 1.2. Testler doğru planı ve yanlış host/rol/sslmode reddini sınar. Modül env yüklemez, client bağlamaz, Prisma spawn etmez. CLI her zaman `STOCK_MANAGED_APPLY_DISABLED` ile durur. Remote apply bayrağı eklenmedi; eski cloud runner guard'ı ve stock runner loopback/UUID kimlik kapısı korunur.

Normal runner'da advisory `2142042`, READ ONLY REPEATABLE READ pre/postflight, tekrar preflight, SQL 3s/30s/60s ve child 90s sınırları korunur. Otomatik retry, restore, history düzeltme veya kaynak temizleme yoktur. Advisory lock uygulama writer'larını durdurmaz.

## Testler ve ilk başarısızlıklar

Nihai yerel kabul: non-superuser 016 SQL apply+COMMIT, 47 tablo/33 FORCE RLS/16 başarılı migration ve resolved 008 korunması; ayrı temiz cluster'da managed ACL pinlerinin yeniden doğrulanması. Normal runner ayrıca gerçek Prisma deploy, ALREADY_APPLIED, advisory çakışması, preflight lock timeout, gerçek apply lock timeout/rollback, ACL/RLS drift ve geç SQL failure kontrollerini sınar. Managed doğrudan SQL apply ile normal fixture gerçek Prisma deploy sonuçları birbirine karıştırılmadı; managed bağlantıda Prisma deploy çalıştırıldığı iddia edilmez.

Supplier/PurchaseOrder/Stock regresyonları aynı non-owner application test kullanıcılarıyla çalışır. Tenant/entity/activity/OWN/DENY, maliyet DTO sınırları, immutable ledger, transaction/idempotency ve reversal davranışları mevcut regresyon takımında korunur. Runtime'a ledger DML veya executor üyeliği verilmediği ayrıca katalogdan doğrulandı. Gerçek Neon TLS bağlantısı bu sprintte sınanmadı; yerel PG testleri loopback/SCRAM, SSL kapalı fixture'dır.

İlk başarısızlıklar saklandı: sandbox altında fixture süreç başlatma başarısızlığı; eski function pin ile `STOCK_SCHEMA_DRIFT_functions`; tek-aktör üyelik temizliğinde kalan bootstrap ADMIN; eski ACL pinle `STOCK_ACL_DRIFT`. Diff incelemesinde yerel dosya okuma kodlamasının Türkçe permission etiketlerini bozduğu görüldü; özgün Git UTF-8 satırı geri getirildi ve SQL/checksum/pin testleri nihai adayla yenilendi. Bu ara adayların başarıları nihai kabul yerine kullanılmadı. İlk build tamamlandı fakat PowerShell stderr yönlendirmesi exit1 verdi; native cmd çıkış koduyla build yeniden doğrulandı. `.data` tracing uyarısı mevcut, bu sprintte kapsam dışı bırakıldı.

Kesin nihai test sayıları, fixture kimlikleri ve native çıkış sonuçları [doğrulama tablosundadır](../docs/validation/V04_V43B9_VERIFICATION.md). Fixture sunucularının kapanışı ve korunacak dosyaların checksum kontrolü yerel kanıtta tutulur. Test logları `.data/v43b9/`; fixture artifact'ları `.data/fixtures/v42-*/` altındadır, teslim dışıdır.

## Sonraki bulut denetimi koşulları

1. Provider read erişimini düzeltip development ve korunan recovery/endpoint/snapshot kimliklerini güncel GET ile doğrula; bu sprintte eski 401'in giderildiği iddia edilmez.
2. Development'a yalnız TLS doğrulamalı READ ONLY denetimle bağlan: güncel 40/26/15, 015 checksum, yeni 016'nın pending oluşu, actor/session kimliği, grant/ownership ve geçici rol adının boşluğu yeniden ölçülsün.
3. Eski resolved 008 satırının checksum/durumunu ve tam başarılı migration dizisini doğrula. Bilinmeyen checksum, unresolved veya çift başarıda dur.
4. Yeni geçici CREATEROLE→SET→DROP yolunun Neon managed davranışını ayrıca incele. Standart PG18.6 yerel kanıtı managed sağlayıcıya özgü hook/role-grantor onayı değildir; provider rollerinde değişiklik çözümü kullanılmasın.
5. Neon'a özel pre profilini yeniden incele; yeni postflight için ölçülebilir izin/sahiplik invariant'ları ve ayrı kabul/enrollment süreci tasarla. Yerel post hash'i Neon'a kopyalanmasın; kapalı apply mekanizması bu işte açılmasın.
6. `token_roles` farkı **ROLE_DELTA_UNRESOLVED** kalır. Yeni recovery pre-016 veri/şema kanıtıdır; tam rol eşitliği veya gerçek restore/cutover testi sayılmaz. Bağımsız R2 operasyonel engeli ve 35/21 backup allowlist'i korunur; 47/33 için restore kabulü yoktur.
7. Güncel RPO, writer durdurma/bakım penceresi ve recovery kabulü ayrı değerlendirilsin. Gerçek Neon uygulaması için ayrıca açık kullanıcı onayı ve ayrı runner incelemesi gerekir.

## Teslim dosyaları

- `prisma/migrations/202610210016_goods_receipts/migration.sql`
- `scripts/stock/migrate.ts`, `scripts/stock/migration-baseline.json`, `scripts/stock/migration-fixture.ts`
- `scripts/stock/managed-preparation.ts`, `scripts/stock/managed-baseline.json`
- `scripts/stock/managed-fixture.ts`, `scripts/stock/managed-fixture-baseline.json`
- `tests/stock-migration-runner.test.ts`, `tests/stock-managed-preparation.test.ts`
- Bu rapor, `docs/validation/V04_V43B9_VERIFICATION.md`, `LAST_REPORT.md`

Normal runner ACL dosyası değişmeden yeniden doğrulandı. Önceki V4.3b.5–8 raporlar ayrıca korunur. `.data`, fixture credentials, generated/build artifact'ları teslim edilmez. GitHub teslimi ayrı görevdir.
