# PUSULA V4.3b.11 — FIX_REQUIRED

22.10.2026. Migration 016 için varsayılanı çevrimdışı audit olan, bağlantı veya apply gerçekleştiremeyen managed doğrulama altyapısı eklendi. **Sabit SHA'lı aday gerçek non-superuser PG18.6 fixture'da güvenlik postflight'ını geçmiyor. MANAGED_RUNNER_LOCAL_READY verilmedi.** Gerçek Neon SQL/API erişimi yapılmadı.

## Kritik bulgu: başarılı COMMIT güvenli ACL anlamına gelmiyor

İstenen migration SHA'sı değişmedi: `7368c775ec5d9b2b126b4731d5985ec83d1cad077f2cd5904ff596a04f22b272`. Yeni sözleşme, yerel managed aktörle uygulanmış bu dosyadan sonra dört executor-owned SECURITY DEFINER fonksiyonunda `PUBLIC EXECUTE` buldu:

- `v43b_command(text,jsonb)`
- `v43b_complete()`
- `v43b_order_received(uuid)`
- `v43b_receipt_outcome(uuid,text)`

Üç API fonksiyonunun beklenen doğrudan `pusula_runtime EXECUTE` grant'leri de oluşmamış. `v43b_complete` için runtime grant'i zaten beklenmiyor. Owner/rol temizliği ve 47/33/16 geçmesine rağmen ACL yanlış. Yeni doğrulayıcı `STOCK_MANAGED_POST_DRIFT_security` ile adayı reddediyor. Bu, varsayımsal provider davranışı değil; **izole yerel PostgreSQL 18.6 katalog ölçümüdür**. Neon'da aynı DDL denenmedi.

Kök neden: actor executor'a `INHERIT FALSE, SET TRUE` ile bağlı. `ALTER FUNCTION OWNER` için SET yolu yeterli olsa da sahiplik devrinden sonra actor otomatik olarak executor'ın grant/revoke yetkilerini kullanmıyor. Kaynakta sonraki ACL komutları için executor'a geçiş yok. [PG18 rol üyeliği](https://www.postgresql.org/docs/18/role-membership.html), SET ve INHERIT yollarını ayırır; [GRANT](https://www.postgresql.org/docs/18/sql-grant.html) ve [REVOKE](https://www.postgresql.org/docs/18/sql-revoke.html) yetkileri ayrı değerlendirilir. Katalog bulgusunun bu kurallarla açıklanması bir çıkarımdır; ACL farkının kendisi doğrudan ölçümdür.

Önceki managed fixture pin'i yalnız kendi hash'ine eşitliği, ownership ve üyelik temizliğini sınamıştı; dört fonksiyonda PUBLIC yasağını bağımsız invariant olarak zorlamıyordu. Runtime'ın efektif EXECUTE hakkı PUBLIC üzerinden de gelebilir. Dolayısıyla önceki PASS, doğru doğrudan runtime grant'ini ve PUBLIC kapatılmasını kanıtlamaz. Eski raporlar tarihsel kayıt olarak değiştirilmedi; bu rapor onların kabul sınırını düzeltir. Normal superuser fixture'da aynı ACL sorununun görünmemesi non-superuser kanıtının yerine geçmez.

Fonksiyonların iç authorization/RLS kontrolleri devam ediyor; bu ölçüm tek başına yetkisiz iş kaydı okunması/yazılması veya tenant sızıntısı kanıtı değildir. Ancak planlanan kapalı EXECUTE yüzeyi ihlal edilmiştir ve kabul edilemez. Sözleşme PUBLIC'i kabul edecek şekilde gevşetilmedi; yerel pinler tekrar öğrenilmedi.

## Sürüm kontrollü sözleşme ve kanıt kaynağı

`scripts/stock/managed-contract.json`, V4.3b.10'un `2026-10-22T10:49:51.491Z` READ ONLY kanıtından alınan, sır ve gerçek Auth/MFA/session satırı içermeyen katalog/izin tanımlarını taşır. Bu yeni Neon gözlemi değildir. Kaynak `.data/v43b10/development.json`; sözleşme bu dosyaya runtime bağımlılığı taşımaz.

Sabit hedef: proje `icy-queen-44442204`, development branch `br-rough-darkness-ba6ow9zo`, host `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech`, DB `pusula_development`, owner `neondb_owner`. Actor/session eşitliği, DB adı ve PG180006 sözleşmeye bağlıdır. Kaydedilmiş hedef metadata'sı güncel provider kimlik kanıtı sayılmaz; son GET401 tarihsel engeldir.

Sözleşme şunları içerir:

- İlk15 başarılı history checksum'u ve bir resolved008 satırının exact failed checksum/durumu; bilinmeyen, eksik, unresolved, çift başarılı ve farklı rollback reddi mevcut ortak güvenlik kodunu kullanır.
- Pre 40 tablo/26 FORCE RLS/15 başarı ve sekiz ölçülmüş schema hash'i; post için 47/33/16 ve mevcut incelenmiş SQL/schema beklentileri.
- PUSULA rol nitelikleri, tüm ölçülen PostgreSQL rollerinin LOGIN/SUPERUSER/BYPASSRLS/CREATEROLE/CREATEDB/REPLICATION/INHERIT/config değerleri; tüm üyelikler ve üyelik grantor/ADMIN/INHERIT/SET alanları.
- Mevcut table/function ownership, SECURITY DEFINER/search_path, schema/extension envanteri, database/table/column/function/schema/default ACL ve Permission/RolePermission metadata'sı.
- SQL'den birebir çıkarılmış dokuz izin etiketi/id/modül ve yalnız MASTER ek bağlantıları; mevcut izinler ve diğer rol atama tanımları değişmez.

Geçmiş kanıtta tüm ACL kategorileri için genişletilmiş grantor satırları bulunmadığından `pre.grantors=null` açıkça korunur. Bu alan boş ACL anlamına gelmez. Yeni SELECT-only collector table/function/schema/database/column/default ACL grantor'larını ayrı toplar; güncel ölçümü eski null'a otomatik enroll etmez. Tarihsel pre audit sonucu bu yüzden daima `AUDIT_ONLY / NEEDS_EVIDENCE`. Bu bilinçli eksiklik, tam cloud kabul sözleşmesi varmış gibi sunulmaz.

`postFingerprint=null`; gerçek Neon post hash'i yok. `managed-baseline.json` değişmedi: tarihsel pre, post=null, applyEnabled=false. Yerel fixture pre/post pinleri bulut pin'i yapılmadı. Gelecek genişletilmiş pre kanıtı ve bağımsız post kabulü sürüm kontrollü insan incelemesi gerektirir.

## Post invariant motoru

`managed-contract.ts` beklenen post durumunu **ölçülen post girdisinden öğrenmeden**, pre + sabit SQL grant/ownership/permission delta'sından hesaplar. Bütün mevcut satırlar korunur; yalnız tanımlı ekler kabul edilir. Exact karşılaştırma dizilerin sırasına bağımlı değildir; duplicate kayıtlar kaybolmaz.

Yeni yedi tablo migration actor'ına ait kalır. Executor yalnız dört definer fonksiyona sahip olur; NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS ve INHERIT=true beklenir. Creator yok; executor'a veya executor'dan hiçbir üyelik yok; schema CREATE yok. Schema USAGE grantor'ı yerel PG18.6 ölçümünde `pg_database_owner` olarak doğrulandı; actor adı varsayılmadı.

Yeni tablolarda runtime yalnız SELECT; executor SELECT/INSERT/UPDATE/DELETE alır. Eski tablolardaki executor grant'leri SQL allowlist'iyle sınırlı; Permission/RolePermission ve AuditEvent dahil beklenen genişleme açıktır. Fonksiyon ACL'lerinde PUBLIC yok; üç API runtime'a EXECUTE, helper executor'a EXECUTE, complete yalnız sahiplik/trigger yüzeyine ayrılır. `search_path=pg_catalog, public, pg_temp` ve function ownership ayrıca karşılaştırılır. Eski rol, schema, ACL/default/column grant, grantor, ownership veya permission farkı reddedilir.

`verifyManagedDelta` tam grantor kapsamı eksikse reddeder. Deltanın geçmesi yalnız `POST_INVARIANTS_ONLY, cloudAccepted=false` üretir. `requireManagedPostAcceptance()` her zaman `STOCK_MANAGED_POST_NOT_ENROLLED` verir; post pin yazma veya ilk-görüleni-kabul yolu yoktur. Beklenen post schema hash'leri yerel/source beklentisidir, ölçülmüş Neon post sonucu değildir.

## Runner sınırı ve hata durumları

Yeni `managed-runner.ts` yalnız `--audit-snapshot <dosya>` kabul eder; dosyayı offline değerlendirir. Varsayılan action audit'tir; snapshot verilmezse bağlantı açmak yerine açık input hatası döner. Saved snapshot sonucu live audit olarak etiketlenmez. CLI/env/network/Prisma apply entegrasyonu eklenmedi. Böylece yetkisiz bağlantı veya DDL çalıştıracak bir kod yolu yoktur.

`--apply` dosya/env/URL okunmadan mevcut `managedMain()` tarafından `STOCK_MANAGED_APPLY_DISABLED` ile koşulsuz reddedilir. `applyEnabled=false` değişmedi. `prepareManagedAudit` proje/branch, tüm SQL byte checksum'ları ve mevcut target/owner/TLS allowlist'ini kontrol edip yalnız plan üretir. CA validity, hostname/servername, rejectUnauthorized=true ve TLS1.2 minimum korunur. Bu plan bağlantı açmaz ve provider GET kanıtı üretmez.

`collectManagedSnapshot` yalnız SELECT çalıştırır; çağıranın ayrı bağlantısında REPEATABLE READ READ ONLY transaction zorlar. Transaction açma/commit/rollback, env yükleme veya bağlantı yönetimi yapmaz. Gerçek cloud connector bu sprintte yoktur; gelecekte startup read-only, dedicated physical session, canlı provider kimliği, TLS ve eksiksiz kabul sözleşmesi ayrıca uygulanmalıdır.

Hata durum sözlüğü test edildi: before-apply → NOT_STARTED; teyitli transaction rollback → ROLLED_BACK_CONFIRMED; teyitsiz rollback → ROLLBACK_UNCONFIRMED; COMMIT gönderilip sonuç bilinmiyorsa → COMMIT_OUTCOME_UNKNOWN; commit sonrası hata → POST_COMMIT_REVIEW_REQUIRED. Bunlar hazırlık sınıflandırmasıdır; bu sprintte cloud transaction yürütüldüğü anlamına gelmez. Hiçbir state retry/resolve/restore/cleanup başlatmaz. Postflight başarısızlığında SQL COMMIT geri alınmış sayılmaz.

## Gerçek testler ve test-only ACL düzeltmesi

Yeni non-superuser PG18.6 koşusu önce **değişmemiş adayın reddini** doğrular. Pozitif delta motorunu ve negatifleri sınamak için yalnız aynı disposable fixture içinde superuser admin ile dört PUBLIC grant'i kaldırılıp üç runtime grant'i açıkça eklenir. Bu, üretim düzeltmesi değil test kurulumu; runner bunu yapmaz. Bu test-only durum üzerinde beklenen delta gerçek katalogdan geçer. Ardından rol nitelikleri/üyelik/schema CREATE/creator kalıntısı/runtime DML/PUBLIC EXECUTE/ek schema/non-MASTER permission negatifleri ayrı gerçek DB değişiklikleriyle ölçülüp reddedilir. Grantor-only ve eksik grantor kapsamı negatifleri de sınanır.

Test sonunda test-only düzeltme kaldırılır ve orijinal adayın snapshot'ıyla eşitlik kontrol edilir. Eski fixture pinleri/regresyonlar bu özgün duruma karşı korunur. Fixture testinin PASS olması **adayın güvenli olduğu anlamına gelmez**: log ayrıca `managedCandidate: FIX_REQUIRED` yazar. Tam komutlar, yeni sonuçlar ve başarısız ilk koşular doğrulama belgesindedir.

## Recovery, provider ve backup

Recovery `br-late-river-baeipun8` değişmedi; bağlantı yok. `token_roles` farkı **ROLE_DELTA_UNRESOLVED** olarak kalır. Önceki kapsanan şema/PO/veri eşitliği tam rol eşitliği, güncel recovery varlığı veya gerçek restore/production backup kabulü değildir. Bağımsız R2 backup/restore hazır sayılmadı; 35/21 allowlist ile 40/26 ve 47/33 kabulü arasındaki engel korunur. Bu sprintte provider GET bile yapılmadı; önceki401 yenilenmiş bulgu gibi sunulmaz.

## Sonraki somut adım

Sabit adayın post-owner ACL sırasını ayrı incelemede düzeltmek gerekir: PUBLIC revoke/runtime grant işlemlerinin gerçekten sahip yetkisiyle gerçekleştiği, geçici rol/SET/schema CREATE kalıntısı bırakmadığı bir SQL/session sırası tasarlanmalı. Rol yetkisi genişletmek veya PUBLIC'i beklenen sonuç yapmak çözüm değildir. Böyle bir değişiklik 016 SHA/pin zincirini değiştirir; bu görevde verilen exact SHA korunarak sessizce yapılmadı. Yeni aday, non-superuser fixture'da **test-only correction olmadan** bu sözleşmeyi geçmelidir.

Bundan sonra güncel provider kimliği/kapasite, eksik grantor pre ölçümü, Neon provider rol yaşam döngüsü ve güvenilir post kabulü ayrı tamamlanmalıdır. Gerçek uygulama için ayrıca açık yetki gerekir. Bu görev bu yetkiyi vermez.

## Kesin dosya kapsamı

Bu sprintte dokuz dosya:

1. `scripts/stock/managed-contract.json` — yeni tarihsel pre ve deklaratif post sözleşmesi.
2. `scripts/stock/managed-contract.ts` — SELECT collector ve fail-closed evaluator.
3. `scripts/stock/managed-runner.ts` — yalnız offline audit CLI ve TLS/target hazırlık planı.
4. `scripts/stock/managed-contract-fixture.ts` — localIdentity kapılı gerçek negatif/defect testleri.
5. `scripts/stock/managed-fixture.ts` — yeni sözleşme kontrollerinin mevcut fixture'a bağlanması.
6. `tests/stock-managed-contract.test.ts` — unit negatifleri ve kapalı apply/hata durumları.
7. `research/PUSULA_V04_V43B11_MANAGED_RUNNER.md`
8. `docs/validation/V04_V43B11_VERIFICATION.md`
9. `LAST_REPORT.md` — önceki tüm baytlar korunarak başa özet.

Başlangıçta bulunan iki V4.3b.10 raporu ayrıca çalışma ağacında korunuyor; bu sprintte değiştirilmedi. Toplam çalışma ağacı kapsamı bunlarla 11 dosyadır. `.data`, credentials/generated artifact teslim dışı. Migration001–016, managed-preparation, mevcut pinler ve .env.local değişmedi. HEAD `d65ea89d915805dbf6b6e5afd111beb727cf7ef5`; commit/push/merge yok.
