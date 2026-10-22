# PUSULA V4.3b.10 — Neon migration 016 son preflight

**CLOUD_PREFLIGHT_PARTIAL — gerçek development SQL ön denetimi geçti; cloud apply kabulü yoktur.**

22.10.2026, SQL snapshot 13:49:51 Türkiye saati (`2026-10-22T10:49:51.491Z`). Bu görev yalnız provider GET, development READ ONLY SQL, kaynak incelemesi ve raporlamadır. Migration 016 uygulanmadı. Güncel provider kimliği/kapasite ve Neon'a özgü rol yaşam döngüsü eksik kanıtları nedeniyle tüm ön koşullar yeterince doğrulanmış sayılamaz.

## A–D kararları

| Karar | Sınıf | Sonuç |
| --- | --- | --- |
| A. Gerçek development migration ön koşulları yeterli mi? | PASS_WITH_LIMITATIONS | şema/history/mevcut katalog yetkileri ve PO doğrulandı. Güncel provider eşlemesi, kapasite, bakım/RPO ve gerçek postflight kabulü eksik; apply için yeterli değil. |
| B. Managed sahiplik çözümü gerçek Neon'da uygulanabilir kabul edilebilir mi? | NEEDS_EVIDENCE | Güncel kataloglar standart PG18 çözümünün ön koşullarını destekler; provider CREATE/GRANT/SET/REVOKE/DROP başarısı katalogdan ispatlanamaz. Koşulsuz uygulanabilirlik kabulü yok. |
| C. Recovery hangi sınırlarla kullanılabilir? | PASS_WITH_LIMITATIONS | Tarihsel pre-016 kapsanan veri/şema referansı; tam rol eşitliği, güncel varlık veya fiilî restore/cutover kabulü değil. ROLE_DELTA_UNRESOLVED korunur. |
| D. Cloud runner geliştirmesine geçilebilir mi? | PASS_WITH_LIMITATIONS | Kapalı ve fail-closed runner tasarımı/geliştirmesi için yeterli bilgi var; canlı apply yolunu açmak için yeterli değil. Bu görevde runner kodu değiştirilmedi. |

## Başlangıç, kaynaklar ve Git

`feat/pusula-v030-neon-cloud`; HEAD ve yerel upstream `d65ea89d915805dbf6b6e5afd111beb727cf7ef5`, ahead/behind 0/0. Başlangıç çalışma ağacı temizdi. `git ls-remote` bu koşuda proxy bağlantı hatası verdi; gerçek uzak ref güncel olarak doğrulanmadı. Upstream eşitliği yerel tracking ref gözlemidir.

AGENTS.md, LAST_REPORT, V4.3b.8 compatibility, V4.3b.9 managed ACL, V4.3b.9a checksum/verification/delivery belgeleri ve istenen migration/managed/runner/checksum/safety kaynakları incelendi. Next.js'in kurulu `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md` rehberindeki `@next/env` yükleme yöntemi okundu. Eski raporlardaki önceki 016 hash'i, eksik SET yolu ve pg_temp bulguları tarihsel adaylara aittir; güncel SQL hakkında tekrar edilmedi.

## Gerçek provider kontrolleri

İlk Node GET TLS/fetch seviyesinde yanıt alamadı. Sistem CA ile yeniden, doğrulamayı kapatmadan yapılan `GET /projects/icy-queen-44442204`, 22.10.2026 13:49:12 Türkiye saatinde **HTTP 401** döndürdü. Sonrasında token/oturum yenileme, alternatif credential, login veya başka provider isteği yapılmadı.

Bu yüzden güncel proje/organizasyon (`org-wild-forest-12594477`), development branch/endpoint bağlantısı, recovery ve endpoint varlığı, production/preview/eski recovery/snapshot korunmuş varlığı, pending/failed operasyonlar ve Free plan **NEEDS_EVIDENCE**. Bu görev bunları değiştirmedi; değişiklik yapılmaması güncel varlık kanıtı değildir. Consumption endpoint'ine 401 sonrasında gidilmedi; bu koşuda consumption 403 alınmış gibi gösterilmez.

Tarihsel V4.3b.7: 5 branch/5 endpoint/1 snapshot, 118 operasyon, pending/failed 0; Free plan. önceki consumption GET 403. Kullanıcının önceki Console kanıtı: Free, storage 31,69 MB, compute 0,02 CU-saat, 4 branch, 6 saat retention; bu daha eski anlık görüntüdür, güncel kalan kapasite/API ölçümü değildir. Güncel kapasite doğrulanamadı. Consumption erişim eksikliği tek başına SQL denetimini başarısız kılmaz.

Korunan tarihsel kimlikler: development `br-rough-darkness-ba6ow9zo`; recovery `br-late-river-baeipun8` / endpoint `ep-aged-flower-bauhc0to`; production `br-autumn-union-baaldt81`; preview `br-patient-block-bald8u59`; eski recovery `br-broad-river-bavv5pey`; snapshot `snap-frosty-sky-bav0qeo6`.

## Gerçek development SQL ve kimlik sınırı

Yalnız önceki başarılı provider kanıtında onaylanmış sabit development host'u `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech:5432`, `pusula_development`, owner allowlist'i kullanıldı. Güncel provider eşlemesi 401 nedeniyle yeniden doğrulanamadı. SQL bağlantısı bu eksikliği gidermez; host/DB/rol/TLS kimliği ile tarihsel branch eşlemesi ayrı kanıtlardır.

Açık CA geçerliliği, hostname/servername, `rejectUnauthorized=true`, minimum TLS1.2 ve bağlantıda encrypted/authorized kontrolleri geçti. Startup `default_transaction_read_only=on`; `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`; lock 3s, statement 10s, transaction 30s. Yalnız SELECT/katalog/izinli business özetleri; sonunda ROLLBACK ve bağlantı kapanışı. Yeni fonksiyon, role geçişi, DDL/DML/GRANT denemesi veya advisory lock alınmadı. Production/test/recovery SQL bağlantısı yok.

| Kontrol | Sınıf | Gerçek sonuç |
| --- | --- | --- |
| PostgreSQL / transaction | PASS | 18.6 (fd34222); default/transaction RO on; repeatable read |
| Tablolar / FORCE RLS | PASS | 40 / 26 |
| Sekiz schema fingerprint | PASS | Baseline ve V4.3b.8 ile aynı |
| Başarılı migration / unresolved / çift başarılı | PASS | 15 / 0 / 0 |
| Migration 015 | PASS | `181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a` |
| Migration 016 | PASS | History'de hiç kayıt yok; pending |
| İlk 15 tarihsel checksum | PASS | Başarılı kayıtlar baseline ile birebir; gerçek stockFiles + validateStockHistory kabulü geçti |
| Resolved 008 | PASS | Bir başarılı ve bir finished=false/rolled_back=true kayıt; aşağıdaki sabit checksum'lar |
| Executor / geçici creator | PASS | İkisi de yok |
| Yeni nesne/permission çakışmaları | PASS | Gelecekteki 7 tablo/v43b fonksiyon/dokuz permission çakışması yok |
| Mevcut rol/ACL drift | PASS_WITH_LIMITATIONS | ölçülen kategoriler tarihsel kanıtla aynı; provider'ön gelecekteki davranışı kapsam dışı |
| Ek şema/extension/event trigger/large object | PASS | public+information_schema; plpgsql; event trigger/large object yok |
| PO-2026-9893 | PASS | APPROVED; 1 satır; 2 linear_meter; 3,04 square_meter; factor 1,52; 30,40 USD; Supplier/Material/Variant scope ilişkileri eşit |

008 başarılı SHA `db552670276d5e5d5b7ed37a78cc618bac9a79d8dc3e5d72cabe239dd4e7d36a`; resolved SHA `35ca1ae820b9e040ef189f3ff346381c591a268b74e4c37f639e94d2dded1fd9`. Başarılı sayım rollback'i içermez. Beş eski migration için dar sabit hash çiftleri korunur; genel newline normalizasyonu, history UPDATE/resolve veya checksum gevşetmesi yok. 016 dosya SHA `7368c775ec5d9b2b126b4731d5985ec83d1cad077f2cd5904ff596a04f22b272`.

Auth/MFA/session satır içerikleri okunmadı. Authorization definition metadata (Permission, RolePermission ve MASTER tanımı), sistem rol katalogları ve business özetleri okundu; gerçek kullanıcı atamaları okunmadı. Diğer izinli business tablolarında yalnız count/digest özeti alındı. Anlık başka oturum, prepared transaction, subscription ve replication slot görülmedi; bu bakım penceresi veya gelecekte writer olmayacağı garantisi değildir.

## Fingerprint kanıtları

Yeni ölçülen managed pre `59252aa93cf52f7d087e066bcf7ab0b469cd1bd5cd57a372642ce2f7bb07c009`, tarihsel managed pre ile eşit. Bu yeni bir ölçümdür; baseline dosyasının source tarihi veya pinleri güncellenmedi. stockSecurity uygulama rolleri/üyelikleri, database/table/column/function/schema/default ACL ve permission tanımlarını kapsar; tüm provider rollerini tek başına kapsamaz. Bu nedenle tüm pg_roles nitelikleri, grantor dahil üyelikler, capabilities, owner/grantability ve schema ACL ayrıca tarihsel katalogla karşılaştırıldı: tümü aynı. Development'ta token_roles yok.

| şema kategorisi | SHA-256 |
| --- | --- |
| tables | `391078b902f632ad5773d78b22ebaf6c1b7068eeffa8d4d0ec18e711409d2013` |
| columns | `b0f8744bab3b63cad62fdce18ba17c22c1310541f6e9b1dac9c2669dac16c0d7` |
| constraints | `ca339c8a0c4478eb7550d28c659272ac90e39132f012b6a4b847ff80d80ab6e9` |
| indexes | `529ae5ba3685dd826945fe072cf6211fc95f7c1e9509395940696f62217ef3dd` |
| policies | `fba9067f92fd40d23bca4509512b1e3cd0989444c089f076ceb2e06644f478e5` |
| triggers | `99cd95a8c16c6f30cf7bb68e12944c0f8c91d690a622ade1bac3f1d538ed217e` |
| functions | `f00c459557c661f543824f5c638c199c9f57f5e818a8c80d8c7cbdc0607f23ac` |
| types | `d891fe9cc3ffd8303e957a2c4ca3173f607ffa7223e3374caa023d34cb30ba9c` |

| ölçülen izin kategorisi | SHA-256 |
| --- | --- |
| roles | `ea06d98051bc3100dec1fe9ce9276a310d0fa6b29e2874665a79e41f0ac2ce01` |
| memberships | `e0934fd34d4f0cdbfbba1539c8979f4c1a8beb973a62a646b2a7083123a34145` |
| defaults | `4ad31d3208c20173c2381b7a22feeaf8a20f9ecc82534a01a3cd863dcafc738b` |
| acl | `f23a34bfa7501669cb0d2ef09c75843a6b03f1ecab5a316af605b7660054eff6` |

Genişletilmiş mevcut PUSULA tablo ACL hash'i `9b5003386446276246d0eb2376dd77ec1302f000b17dbfc1b214a27d49e485f8`; eski kapsamın dışladığı Supplier/Purchase tablolarını da içerir. Ham katalog/SELECT kanıtı `.data/v43b10/development.json` içindedir; teslim dışıdır.

## Managed rol sahipliği — mevcut kanıt ve kalan belirsizlik

`current_user=session_user=neondb_owner`; SUPERUSER=false, CREATEROLE/CREATEDB/REPLICATION/BYPASSRLS/INHERIT/LOGIN=true; `createrole_self_grant=''`. `neon_superuser` üyeliğinde INHERIT/SET=true; gerçek superuser varsayılmadı. Public sahibi pg_database_owner, actor public CREATE sahibi; 40 tablonun ve mevcut public fonksiyonların sahibi actor. İlgili tüm mevcut tablo grant-option ölçümleri ve pusula_can EXECUTE WITH GRANT OPTION true. Runtime/auth public CREATE veya ayrıcalıklı üyelik taşımıyor. **Mevcut katalog ön koşulları PASS.**

Güncel 016'da önceki eksik SET yolu giderilmiş: geçici NOLOGIN/NOSUPERUSER/NOCREATEDB/CREATEROLE/NOREPLICATION/NOBYPASSRLS creator yaratılır, actor'a INHERIT FALSE/SET TRUE verilir; creator executor'— yaratıp SESSION_USER'a aynı geçici SET yolunu verir. RESET ROLE sonrası gerçek actor yeni nesneleri yaratır. Dört SECURITY DEFINER fonksiyonu executor'a devredilirken executor'a public CREATE geçici verilir ve kaldırılır. Sonunda creator kendi executor grant'ini REVOKE eder, actor creator'— DROP eder. Standart PG18'de DROP üyelikleri temizler; bu zincir kaynak ve önceki non-superuser fixture kanıtıyla tutarlıdır.

[PG18 ALTER FUNCTION](https://www.postgresql.org/docs/18/sql-alterfunction.html) yeni sahibe SET ROLE yapılabilmesini ve yeni sahibin schema CREATE yetkisini ister. [Rol nitelikleri](https://www.postgresql.org/docs/18/role-attributes.html) CREATEROLE ve ADMIN sınırlarını; [DROP ROLE](https://www.postgresql.org/docs/18/sql-droprole.html) bağımlılık ve üyelik temizliğini açıklar. [Neon rol belgesi](https://neon.com/docs/manage/roles), SQL-created roller ile Console/API-created managed rollerin farklı yetki yollarını açıklar. Bu kurallardan çıkarım: kaynak standart PG18 şartlarını kuruyor. Neon'un creator'a otomatik ek üyelik/ACL/ownership bağımlılığı üretmeyeceği veya grantor/revoke/drop zincirinin aynen işleyeceği bu belgelerden kesinleşmez.

**NEEDS_EVIDENCE:** Neon hook'larının geçici CREATEROLE rolü yaratma, yeni executor'a SET grant'i, sahiplik sonrası REVOKE/GRANT/trigger işlemleri ve creator DROP üzerindeki etkisi. DDL/SET ROLE/rol yaratma denemesi yapılmadı. önceki yerel PG18.6 managed 14/14 ve normal runner 20/20 tarihsel testleri yeni Neon kanıtı sayılmadı. Artık eski “kaynakta SET yolu yok” engeli ileri sürülmüyor; yerel çözümün provider üzerinde ispatı eksik.

Final executor invariant'—: NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS; hiçbir parent/member/admin/set/inherit üyeliği yok; public CREATE yok; tablo sahipliği yok; yalnız incelenmiş dört definer fonksiyon sahipliği ve izin manifest'i. Creator ve ona ait bağımlılık kalmamalı. Provider rollerine grant veya runtime/auth'a executor üyeliği çözüm olarak kabul edilmez.

Kaynakta altı yeni fonksiyonun search_path'i `pg_catalog,public,pg_temp`; PUBLIC EXECUTE aynı transaction'da kaldırılır. Runtime yalnız command/order_received/outcome EXECUTE alır; net helper executor'a, complete trigger yüzeyine ayrılmıştır. Yedi tabloda FORCE RLS ve runtime SELECT; executor kontrollü DML; mevcut PurchaseOrder/Line SELECT+UPDATE ve AuditEvent SELECT+INSERT planlı genişlemelerdir. Runtime'a doğrudan stok DML verilmez. Executor tablo sahibi/BYPASSRLS olmadığı için RLS uygulanır. Bu güvenlik tasarımı **PASS_WITH_LIMITATIONS**: kaynak + önceki fixture; gerçek Neon postflight yok. Maliyet alanları API redaksiyonu ile korunur; runtime SELECT sütun seviyesinde maliyet gizliliği sağlamaz.

## Managed pre/post için gelecek tasarım

`managed-baseline.json` değişmedi: pre tarihsel, post=null, applyEnabled=false. managedMain her zaman STOCK_MANAGED_APPLY_DISABLED verir; stock runner loopback/UUID ve eski cloud guard korunur.

1. Sürüm kontrollü, insan incelemeli manifest; proje/branch/host/database/actor, PG sürümü, 016 exact hash, ilk15 hash kimlikleri ve yalnız bilinen resolved008 kabulü ile bağlansın. Yeni ölçüm otomatik enrollment veya baseline yazımı yapmasın; mevcut tarihsel pre yerine ölçümün kaynağı/tarihi ayrıca incelensin.
2. stockSecurity pre hash'ine ek tüm roller, grantor dahil üyelikler, database/schema/default/column/function ACL ve ownership manifest'i kullanılsın. Eksik kategori/null/bozuk veya bilinmeyen checksum ve provider rol drift'inde bağlantı/apply kapısı fail-closed olsun. Yerel fixture pinleri Neon pin'i olarak kullanılmasın.
3. Postflight için önceden incelenmiş deterministik delta: 47 tablo/33 FORCE RLS/16 başarılı migration; sekiz beklenen schema hash'i (function kategorisi güncel adayda 985bc3b9cf0cb7fdd3930786d8fbad6c60d6e2732d057e19cf3536f981c9b227); ilk15 ve rollback008 değişmeden; dokuz permission ve yalnız MASTER bağlantıları. şema beklentisi kaynak/fixture kanıtıdır, ölçülmüş Neon post pin'i değildir.
4. Eski nesne/roller/ACL değişmezliği ile yalnız allowlist delta karşılaştırılsın: actor tablo sahipliği, executor'ön dört definer sahipliği, exact grant manifest'i, runtime yalnız stok SELECT ve → API EXECUTE, auth ve provider rollerinde genişleme yok; PUBLIC EXECUTE/CREATE, grant-option, column/default ACL sürprizi reddedilsin. Creator/üyelik/schema CREATE kalıntısı bağımsız invariant ile reddedilsin. Permission dışındaki iş verisinin korunması izinli özetlerle kontrol edilsin.
5. Gerçek post hash'i bilinmeden otomatik “ilk görülen değeri kabul et” yapılmasın. önceden güvenilir post kabul sözleşmesi ve bağımsız inceleme tamamlanamazsa apply kapalı kalsın. Birleşik hash tek başına kapsam dışı provider davranışını gizlememeli.
6. Gelecek runner için ayrı dry-run/deny testleri; TLS/target/session eşitliği, aynı fiziksel session (pooler/SET ROLE başlangıcı reddi), advisory protokol, bakım penceresi, hemen-önce preflight ve timeout tasarlansın. Postflight başarısızlığı otomatik retry/restore/history düzeltmesi başlatmasın; stopped-review-required olsun. SQL COMMIT sonrası postflight rollback sayılmaz; Prisma history ayrı failure kaydı bırakabilir. Bu sprintte canlı bağlantı/apply yolu açılmadı.

## Recovery ve backup kabul sınırı

Recovery `pusula-v43b6-pre-migration-016-20261021`, branch `br-late-river-baeipun8`, endpoint `ep-aged-flower-bauhc0to`, capture LSN `0/38201C8` ve capture `2026-10-21T15:51:53Z` tarihsel kanıtlardır. Yeniden SQL bağlantısı veya restore yapılmadı; güncel varlığı GET401 nedeniyle teyitsiz.

V4.3b.7'de kaynak/recovery 40/26/15, 015, PO, sekiz şema fingerprint'i ve incelenen yedi business count/digest eşitti. Kaynak24/recovery25 rol: tek ek token_roles. Ortak rollerin üyelik ve ölçülen efektif izinleri eşitti; tam rol fingerprint'i eşit değildi. token_roles NOLOGIN ve super/CREATEROLE/CREATEDB/BYPASSRLS=false; o ölçümde üyelik/ownership bağımlılığı ve DB CONNECT/public CREATE yoktu. PUBLIC'den gelen bazı TEMP/USAGE/EXECUTE hakları rolü tamamen etkisiz diye adlandırmaya izin vermez. Sağlayıcı kökeni belirsiz: **ROLE_DELTA_UNRESOLVED**.

Yeni development katalogları önceki kaynakla eşit; bu recovery'yi bugün yeniden ölçmüş olmak değildir. Kopya incelenen pre-016 şema/PO/veri için kurtarma referansı sunar; tüm DB RPO=0, tam authorization eşdeğerliği veya production restore yedeği değildir. Rol farkı tek başına ölçülmüş veri bozulması/izin sızıntısı demek de değildir. Tam restore/cutover, kimlik/rol/secret/endpoint yeniden bağlama ve gerçek uygulama kabul tatbikatı eksik.

Bağımsız off-provider backup/restore **BLOCKED**: mevcut 35 tablo/21 FORCE RLS allowlist'i 40/26 ve gelecekte 47/33'— karşılamaz; R2 remote source/upload kapıları operasyonel kabul edilmemiştir. Allowlist sayılarını tek başına büyütmek yeterli değil; rol/ACL/RLS/function/veri, şifreleme/anahtar ve gerçek restore kabulü gerekir. Bu görevde R2/dump/upload/restore veya backup kodu değişikliği yok.

## Açık kapılar ve uygulanabilir sonraki adımlar

| Başlık | Sınıf | Kalan iş |
| --- | --- | --- |
| Yerel SQL/checksum/history güvenlik sözleşmesi | PASS | Güncel gerçek history kabul edildi; dosyalar korunuyor |
| Güncel development SQL, PO ve ölçülen drift | PASS_WITH_LIMITATIONS | Snapshot anı ve tarihsel provider eşlemesi sınırı |
| Güncel provider kimlik/envanter/plan/operasyon | NEEDS_EVIDENCE | Yetkili erişim düzeldikten sonra yalnız GET; bu görev token yenilemedi |
| Güncel kapasite | NEEDS_EVIDENCE | Eski Console/API403 kanıtı güncel kota değil |
| Managed CREATE/SET/ownership/cleanup | NEEDS_EVIDENCE | Provider tarafından desteklenen davranışın kesin kanıtı veya ayrıca yetkilendirilmiş izole prova |
| Managed post sözleşmesi/live apply | BLOCKED | post=null/applyEnabled=false; bu sprintte korunuyor |
| Recovery kapsanan şema/veri | PASS_WITH_LIMITATIONS | Tarihsel kanıt; güncel GET ve restore provası eksik |
| token_roles kökeni/tam rol eşitliği | NEEDS_EVIDENCE | ROLE_DELTA_UNRESOLVED |
| Bağımsız backup/restore | BLOCKED | 35/21 kapsamı ve operasyonel kabul eksik |
| Bakım/writer/RPO | NEEDS_EVIDENCE | Anlık writer yokluğu kalıcı dışlama değil |

Sıra: yetkili provider GET erişimi yeniden işler olduğunda kimlik/korunan kaynak/operasyon/kapasiteyi doğrula; mevcut SQL audit'i apply hemen öncesinde tekrar et; Neon rol yaşam döngüsünü sağlayıcı kanıtıyla veya ayrı izinli izole deneyle kesinleştir; insan incelemeli managed pre/post invariant manifest'i ve kapalı runner geliştir; recovery rol farkı ile bağımsız restore engellerini ayrı kabul et; bakım/RPO planını tamamla. Sonrasında bile gerçek migration ayrı açık uygulama yetkisi gerektirir. Bu rapor uygulama onayı değildir.

## Bu görevde GitHub'a teslim edilecek kesin dosyalar

1. `research/PUSULA_V04_V43B10_NEON_PREFLIGHT.md`
2. `docs/validation/V04_V43B10_VERIFICATION.md`
3. `LAST_REPORT.md`

Yalnız bu → belge değişti. önceki raporlar ve LAST_REPORT geçmişi korundu. `.data/v43b10` yardımcıları/sanitized kanıtları, credentials, env ve generated artifact teslim dışı. Migration001–016, kaynak kod, pinler ve .env.local değişmedi. Commit/push/merge yok. SQL DDL/DML/GRANT, provider mutation, üretim/test/recovery SQL, restore/finalize/cutover veya R2 işlemi yok.
