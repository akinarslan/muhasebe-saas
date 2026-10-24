# PUSULA — Gerçek Neon backup rolü kararı

23 Ekim 2026 · Dal `feat/pusula-v030-neon-cloud` · HEAD `edc03121737051d1eb180e621ccd91acfcc92743`.

**Sonuç: ROLE_NEEDS_EVIDENCE.** `pusula_backup` için bağımsız BYPASSRLS + yalnız SELECT veren SQL rolü teknik olarak mümkün görünüyor: gerçek PostgreSQL18.6 yöneticisinin gerekli nitelikleri doğrulandı. **Mevcut PUBLIC TEMP ve diğer DB CONNECT haklarıyla, bugün tam güvenlik kabulü verilmez; strict gerçek export BLOCKED.** Neon'un bu rolü desteklemediğine ilişkin kanıt yoktur; sorun “superuser eksik” değildir. Rol oluşturulmadı, LOGIN açılmadı, izin veya veri değiştirilmedi.

## Net yanıtlar

| Soru | Karar |
| --- | --- |
| Güvenli rol teknik olarak kurulabilir mi? | **BYPASSRLS + dar nesne hakları için evet, SQL yolu uygundur.** Ancak yalnız development erişimi ve TEMP=false hedefi, mevcut PUBLIC hakları çözülmeden sağlanamaz. Kurulumun provider hook/post kabulü DDL yapılmadığı için henüz kanıtlanmadı. |
| Destekleyen mevcut kanıt? | Güncel PG18.6 katalog: actor `neondb_owner`, SUPERUSER=false, CREATEROLE=true, BYPASSRLS=true;40 tablo owner'ı aynı actor, hepsinde SELECT grant authority; public USAGE ve DB CONNECT grant authority var. |
| Hangi provider yetkisi eksik? | SQL ile rol ve kaynak SELECT hakları için eksik temel nitelik görülmedi. **`cloud_admin` sahipliğindeki `postgres` ve `template1` DB'lerinde CONNECT/TEMP grant authority yok.** Strict cross-DB izolasyon için PUBLIC hakları kaldırılacaksa provider/nesne sahibi müdahalesi gerekir. API GET başarısı API mutation yetkisi anlamına gelmez; bu yol için API rol oluşturma yetkisi istenmiyor. |
| Hangi açık onay gerekir? | Önce aşağıdaki **NOLOGIN rol +40 tablo SELECT + salt okunur rol post denetimi** için sabit development hedefiyle sınırlı DDL/DCL onayı. PUBLIC/cross-DB değişiklikleri ve LOGIN/credential aktivasyonu ayrıca onaylanmalıdır. Dump/export/R2/restore bu onaya dahil değildir. |
| 29 Ekim etkisi? | Yeni backup motoru veya yeni PostgreSQL admin hesabı gerekmiyor. Bekleme, PUBLIC/cross-DB güvenlik seçimi ve provider sahipliğindeki DB haklarıdır. Bunlar kapanmadan gerçek yedek güvencesi ve canlı kullanım kabulü verilemez. |

Dayanaklar: [backup readiness](PUSULA_BACKUP_LIVE_READINESS.md), [son yerel doğrulama](../docs/validation/PUSULA_BACKUP_LIVE_VERIFICATION.md), [provider reauth](PUSULA_M016_PROVIDER_REAUTH.md), [P0 grantor incelemesi](PUSULA_M016_P0_BLOCKER_RESOLUTION.md).

## Güncel, gerçekten çalıştırılan salt okunur kanıt

Provider GET'leri **12:56:27–12:56:28Z /15:56:27–15:56:28 Türkiye**: proje, branch ve branch endpoint listesi **3/3 HTTP200**. Eşleme aynı:

- Proje `icy-queen-44442204`, ad `pusula-development`.
- Branch `br-rough-darkness-ba6ow9zo`, ad `development`.
- Endpoint `ep-blue-breeze-bavbjb7l`, host `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech`, `read_write`, disabled=false.

Yalnız `pusula_development` bağlantısında **iki TLS doğrulamalı REPEATABLE READ READ ONLY transaction** kullanıldı. Startup default_transaction_read_only=on, CA validity/hostname/servername/rejectUnauthorized ve TLS≥1.2 kontrolü; stream encrypted+authorized. Her iki transaction ROLLBACK ile kapandı ve bağlantı sonlandırıldı. SQL rol/ACL/veritabanı sistem katalogları dışında business/Auth/MFA/session satırı okunmadı. Başka DB'ye bağlanılmadı; advisory lock alınmadı.

| Ölçüm | Güncel sonuç |
| --- | --- |
| Katalog transaction zamanı | **2026-10-23T12:57:39.524Z** |
| DB grant authority ek ölçümü | **2026-10-23T12:59:36.757Z** |
| Actor/session actor/DB | `neondb_owner` / aynı / `pusula_development` |
| Sürüm | **18.6 (fd34222)** /180006 |
| Transaction özellikleri | default_readonly=on; readonly=on; repeatable read |
| Actor rolü | LOGIN=true; SUPERUSER=false; CREATEDB=true; CREATEROLE=true; REPLICATION=true; BYPASSRLS=true |
| createrole_self_grant / password_encryption | boş / `scram-sha-256` |
| Rol/üyelik envanteri |24 rol /16 üyelik; `pusula_backup` **yok** |
| Kaynak envanteri | **40 tablo /26 FORCE RLS**; sabit pre016 tablo listesiyle tam eşleşme |
| Nesne grant authority |40/40 tablo için SELECT WITH GRANT OPTION=true; schema USAGE, source CONNECT/TEMP grant authority=true |
| Public tablo/column ACL | Public tablo grant'i yok; column ACL satırı yok |
| Public function EXECUTE |4 eski fonksiyon; hepsi SECURITY INVOKER ve return type trigger |
| Default ACL | Önceki `cloud_admin → neon_superuser`9 grant-option kaydı mevcut; kabul edilmiş veya kaldırılmış sayılmadı |

Bu görev migration history'yi yeniden okumadı. Önceki15 başarılı migration, resolved008 ve016 pending kanıtı **10:46:07.694Z** tarihli snapshot'a aittir. Önceki494 satırlık tam grantor incelemesi korunur; burada toplanan seçilmiş rol/ACL katalogları yeni bir tam494-satır baseline veya otomatik enrollment değildir.

## BYPASSRLS kararının dayanağı

PostgreSQL18 `CREATE ROLE` kuralında CREATEROLE ile rol oluşturulur; BYPASSRLS seçeneğini kendi BYPASSRLS niteliği bulunan non-superuser da verebilir. Bu nedenle mevcut actor için “yalnız superuser verebilir” gerekçesi geçerli değildir. BYPASSRLS rol niteliği nesne SELECT izninin yerine geçmez; SELECT ayrıca dar tutulur. [PostgreSQL18 CREATE ROLE](https://www.postgresql.org/docs/18/sql-createrole.html).

Sonradan ALTER ROLE için CREATEROLE yanında hedef rol üzerinde ADMIN OPTION ve ilgili niteliğin yöneticide bulunması gerekir. Yeni rolün yaratıcısına PostgreSQL'in verdiği yönetim yetkisi bu açıdan önemlidir. [PostgreSQL18 ALTER ROLE](https://www.postgresql.org/docs/18/sql-alterrole.html).

Neon'un belgelenmiş dar rol yolu **SQL CREATE ROLE**'dür. Console/API/CLI rol oluşturma yolları `neon_superuser` üyeliği verir; backup hesabı bu yoldan açılmamalıdır. Mevcut admin üyeliği, backup hesabına devredilmez. Neon'un SQL rol desteği ve güncel katalog birlikte olumlu uygulanabilirlik kanıtıdır; provider üzerindeki CREATE/ALTER komutunun gerçekten başarılı olduğu henüz iddia edilmez. [Neon rol yönetimi](https://neon.com/docs/manage/roles).

## Hesabın erişim sınırları: asıl açık konu

| Alan | Değerlendirme |
| --- | --- |
| LOGIN | İlk aşama NOLOGIN ve PASSWORD NULL olmalı. LOGIN, gizli credential ve yeni hesabın gerçek oturum kabulü sonraki açık onaya bağlıdır. |
| Kalıcı iş verisi | Kaynak40 tabloya yalnız SELECT; INSERT/UPDATE/DELETE/TRUNCATE/MAINTAIN/REFERENCES/TRIGGER, ownership ve rol üyeliği verilmez. BYPASSRLS tek başına bu DML haklarını sağlamaz. |
| Public schema | PUBLIC yalnız USAGE alıyor; CREATE almıyor. Backup'a explicit USAGE verilebilir; CREATE ve DB CREATE verilmez. Schema grantor'ı `pg_database_owner`, tablo/DB grantor'ı `neondb_owner` beklenir. |
| Fonksiyonlar | Backup'a doğrudan EXECUTE verilmez; `pusula_can`, supplier/PO API'leri ve ileride stock/finance API'leri çağrı hakkı almamalı.4 eski PUBLIC invoker-trigger mevcut kaynak sözleşmesindeki ayrı istisnadır; “tüm EXECUTE sıfır” diye sunulmaz. |
| TEMP | Kaynak DB'de PUBLIC TEMPORARY var; yeni backup rolü de yararlanır. Rol üstünden REVOKE bu PUBLIC hakkını engellemez. Strict motorun TEMP=false koşulu mevcut haliyle sağlanamaz. |
| Başka DB'ler | PUBLIC nedeniyle `neondb`, `postgres`, `template1` için CONNECT yolu açık olur. `neondb` ve `postgres` için PUBLIC TEMP de var. Bu DB'lerin yerel nesne/function yetkileri development kataloglarından kanıtlanamaz. |
| Test/template sınırı | `pusula_sprint_b_test` PUBLIC CONNECT vermiyor; yalnız TEMP olması yeni role bağlantı sağlamaz. template0 datallowconn=false. Bu hedeflerde bağlantı veya değişiklik yapılmadı. |
| Rol üyelikleri | `pusula_backup` hiçbir runtime/auth/executor/neon_superuser rolünün üyesi olmamalı. NOINHERIT tek başına SET ROLE ve PUBLIC erişimini engellemez. |

PUBLIC bütün rollere hak verir; role özel bir “DENY PUBLIC” ACL'si yoktur. Sırf `REVOKE ... FROM pusula_backup` yazarak PUBLIC hakkı kaldırılamaz. [PostgreSQL18 privilege kuralları](https://www.postgresql.org/docs/18/ddl-priv.html). `default_transaction_read_only=on` yalnız oturum varsayılanıdır; istemci değiştirebilir, gerçek DML/CREATE yetki reddinin yerine geçmez. [PostgreSQL18 client defaults](https://www.postgresql.org/docs/18/runtime-config-client.html).

### Hangi yönetici hangi PUBLIC hakkına müdahale edebilir?

| DB | Owner | neondb_owner CONNECT/TEMP grant authority | Sonuç |
| --- | --- | --- | --- |
| pusula_development | neondb_owner | true /true | PUBLIC TEMP değişikliği teknik olarak mümkün; bütün kullanıcıları etkilediği için ayrı etki incelemesi/onay gerekir |
| neondb | neondb_owner | true /true | PUBLIC CONNECT/TEMP değişikliği teknik olarak mümkün; bu görevde yetkili işlem değildir |
| postgres | cloud_admin | **false /false** | Katı izolasyon için provider/nesne sahibi müdahalesi gerekir |
| template1 | cloud_admin | **false /false** | PUBLIC CONNECT için provider/nesne sahibi müdahalesi gerekir |

Bu, mevcut katalogla kanıtlanmış yetki sınırıdır. Mevcut yöneticiye veya backup hesabına `cloud_admin`/geniş yönetici üyeliği eklemek çözüm olarak önerilmez.

## Çalıştırılmamış kurulum komutları — inceleme adayı

**Aşağıdaki SQL'in hiçbir satırı çalıştırılmadı.** Bağlantı yalnız sabit development host/DB, actor `neondb_owner` olmalı; pre01640/26, role-not-exists ve hash kontrolleri uygulama hemen öncesinde tekrar kabul edilmeli. Bu blok yalnız NOLOGIN nesnesini hazırlar; login, export veya PUBLIC düzeltmesi yapmaz.

```sql
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
SET LOCAL createrole_self_grant = '';

CREATE ROLE pusula_backup
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION BYPASSRLS
  CONNECTION LIMIT 2 PASSWORD NULL;

ALTER ROLE pusula_backup SET default_transaction_read_only = on;
ALTER ROLE pusula_backup SET row_security = off;
ALTER ROLE pusula_backup SET search_path = pg_catalog, public, pg_temp;

GRANT CONNECT ON DATABASE pusula_development TO pusula_backup;
GRANT USAGE ON SCHEMA public TO pusula_backup;
GRANT SELECT ON TABLE
  public."Activity", public."AuditEvent", public."AuthAccount",
  public."AuthBootstrap", public."AuthInvitation", public."AuthMailDelivery",
  public."AuthRateLimit", public."AuthSecurityEvent", public."AuthSession",
  public."AuthTwoFactor", public."AuthUser", public."AuthVerification",
  public."CloudExpenseType", public."CloudImportBatch", public."CloudImportRecord",
  public."CloudPaymentPlan", public."CloudProduct", public."CloudQuote",
  public."CloudSale", public."CloudSaleLine", public."Customer",
  public."LegalEntity", public."Material", public."MaterialPriceHistory",
  public."MaterialVariant", public."Membership", public."Permission",
  public."PermissionScope", public."PurchaseOrder", public."PurchaseOrderLine",
  public."Role", public."RoleAssignment", public."RolePermission",
  public."Supplier", public."SupplierMaterial", public."SupplierOfferVersion",
  public."Tenant", public."TenantExchangeRate", public."UserPermissionOverride",
  public."_prisma_migrations"
TO pusula_backup;

-- COMMIT öncesi bağımsız beklenen rol/ACL delta'sı ve warning denetimi gerekir.
-- ROLLBACK bilerek seçilmiştir; bu blok dry-run çalıştırma yetkisi de vermez.
ROLLBACK;
```

Gerçek onaylı kurulumda ROLLBACK satırını gelişigüzel COMMIT yapmak yeterli değildir: önce bağımsız in-transaction ve sonrasında READ ONLY post kabulü gerekir; hata/warning/COMMIT_OUTCOME_UNKNOWN halinde otomatik tekrar uygulanmaz. Gereksiz REVOKE veya blanket default privilege komutu eklenmez. Gelecekteki47/33 ve56/42 tablolarına otomatik hak açılmadı; ilgili faz ayrıca incelenir.

**Creator ADMIN ayrımı:** PG18 non-superuser CREATEROLE yaratıcısına yeni rol üzerinde otomatik ADMIN verir. Boş createrole_self_grant bu yönetim hakkını kaldırmaz; otomatik INHERIT/SET'i açmaz. Beklenen yön `parent=pusula_backup, member=neondb_owner, admin=true, inherit=false, set=false` olmalıdır; grantor gerçek provider bootstrap kaydıyla ayrıca doğrulanır. Bu, **backup'ın admin rolüne üye olması değildir**. Mevcut backup motoru `member=pusula_backup` kenarlarını reddeder; ters yöndeki creator yönetimini ayrıca açık kabul etmek gerekir. Sıfır ters-yön üyelik de şart koşulursa bu basit blok için henüz temizleme/gelecek yönetim kabulü yoktur; onaylı sayılmaz. [PostgreSQL18 createrole_self_grant](https://www.postgresql.org/docs/18/runtime-config-client.html#GUC-CREATEROLE-SELF-GRANT).

Katı PUBLIC izolasyon seçeneği için **ayrı etki/onay ve uygun sahip aktörü** gerektiren komutlar:

```sql
-- SADECE İNCELEME. Mevcut kullanıcıların gerekli explicit hakları
-- incelenmeden/korunmadan ve ayrı yetki verilmeden çalıştırılmaz.
REVOKE TEMPORARY ON DATABASE pusula_development FROM PUBLIC;
REVOKE CONNECT ON DATABASE neondb FROM PUBLIC;
-- Aşağıdaki iki komut mevcut actor'ın grant authority'siyle uygulanamaz:
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
```

Bu blok diğer DB kullanıcılarını da etkiler; rol oluşturma onayına gizlice dahil edilmez. Test/production/recovery DB ACL değişikliği önerilmedi. Kaynak oturumundaki katalog metadata'sı, başka DB'nin nesne güvenliğini denetlemenin yerine geçmez.

LOGIN/credential sonraki aşamadır: güvenlik sınırı kabul edildikten sonra mevcut admin oturumunda güvenli parola girişi (`psql` gizli `\password pusula_backup`) ve ayrıca onaylı `ALTER ROLE pusula_backup LOGIN` gerekir. Gerçek parola/API anahtarı SQL dosyasına, rapora veya argv'ye yazılmaz. Sonrasında backup login'in gerçek TLS/READ ONLY oturumu ve metadata kabulü gerekir; bu görevde parola üretilmedi.

## En kısa uygulanabilir seçenekler

| Seçenek | Uygulanabilirlik / karar |
| --- | --- |
| **Dar SQL rolü + strict PUBLIC/cross-DB izolasyon** | Tercih edilen katı model. Rolün temel yetkileri mevcut; kaynak PUBLIC TEMP ve diğer DB CONNECT kapsamı ayrıca çözülmeli. cloud_admin sahipliğindeki DB'ler için provider işlemi gerekir. Şu an kurulum/LOGIN onayı verilmiş değil. |
| **Dar SQL rolü + mevcut managed-candidate protokolü** | Mevcut aday politika yalnız PUBLIC kaynaklı TEMP/CONNECT'i sınırlı koşullarla ele alabilir. `neondb`, `postgres`, `template1` için gerçek nesne/function erişim incelemesi ve açık politika kabulü eksik; temp/başka DB'ye erişimi sıfır kabul eden strict talebin aynısı değildir. Remote object kapısını kaldırmadan bugün kullanılamaz. |
| Console/API rolü veya owner credential'ıyla dump | Dar rol hedefini karşılamaz; kabul edilmedi. read-only varsayılanıyla geniş yönetici hakları güvenli hale gelmez. |
| NOBYPASSRLS + yalnız SELECT / pg_read_all_data | FORCE RLS kapsamındaki tam kaynağı garanti etmez; pg_read_all_data ayrıca geniş üyelik getirir ve RLS'yi bypass etmez. Yeni policy/tenant export motoru geliştirmek bu görevin çözümü değildir. [PG18 predefined roles](https://www.postgresql.org/docs/18/predefined-roles.html) |

Karar dar **SQL rolü** yönündedir. Eksik olan yeni genel araştırma değil; PUBLIC/cross-DB için hangi güvenlik sınırının onaylandığı ve bu sınırı sağlayacak provider/owner işlemidir. Provider katı izolasyon müdahalesini desteklemez ve managed istisna kabul edilmezse nihai karar **ROLE_BLOCKED** olur; geniş üyelik verilmez.

## Pre016 gerçek export kapıları

- `scripts/backup/postgres.ts`: modern profil gerçek host'ta `BACKUP_RELEASE_REMOTE_NOT_APPROVED` ile bağlantıdan önce durur; varsayılan legacy35/21 gerçek40/26 kaynağa uygulanmaz. Canlı profil bağlantısının `pre016`, sabit hedef ve source creator=`neondb_owner` ile incelenmesi gerekir.
- `scripts/backup/policy.ts`: strict başka DB CONNECT'i reddeder. Managed yolun gerçek cross-DB kabulü `MANAGED_REMOTE_OBJECT_AUDIT_REQUIRED` ile kapalıdır; bugünkü katalog kontrolü o kabul değildir.
- `scripts/backup/source-security.ts`: strict TEMP=false, backup'ın üyelik/ownership taşımaması ve DML/DDL/grant-option yokluğu gerekir. Rol henüz bulunmadığından kendi effective ACL/post kabulü yapılmadı.
- Rol/SELECT grant'leri M016'nın sabit pre rol/ACL fingerprint'ini değiştirecektir. Önceden hesaplanan **tam backup-role delta'sı bağımsız incelenmeden** yeni ölçüm baseline'a yazılamaz; migration SQL checksum'ları değiştirilmez.
- Gerçek kaynak için bağımsız anahtar/custody, onaylı tam veri export'u, R2 offsite ve ayrı gerçek restore hedefi kabulü hâlâ eksik. `MANAGED_REMOTE_UPLOAD_NOT_APPROVED`, accounting/stock cloud guard'ları ve `ROLE_DELTA_UNRESOLVED` korunur.

## Sonraki açık onayın kesin kapsamı

İlk istenebilecek somut onay: **yalnız `icy-queen-44442204` / `br-rough-darkness-ba6ow9zo` / `pusula_development` için `neondb_owner` oturumundan bu NOLOGIN rol ve40 SELECT/USAGE/CONNECT delta'sının, bağımsız pre/post ve warning kabulüyle uygulanması**. Creator ADMIN yönünün kabulü ayrıca açık olmalı. Bu onay PUBLIC/cross-DB REVOKE, LOGIN/parola aktivasyonu, export/dump, R2, restore veya016/017 apply içermez. Bu görev bu onayı istemek veya verilmiş saymak için değil, incelemeyi somutlaştırmak için tamamlandı.

29 Ekim'e kalan altı günde rolün temeli için yeni motor/özellik gerekmiyor. Bugünkü **ROLE_NEEDS_EVIDENCE**, PUBLIC/cross-DB kararını ve gerçek rol sonrası kabulü bekler; gerçek offsite/restore kanıtı olmadan kullanım hazır gösterilmez.

## Kaynak koruması ve kanıt yerleri

Bu görevin tek teslim dosyası bu rapordur. Yerel özel kanıtlar `.data/neon-backup-role/{provider,catalog,database-authority,preservation}.json`; geçici SELECT-only denetleyiciler aynı Git dışı dizindedir. Bunlarda parola, API anahtarı, Auth/MFA/session/business satırı bulunmaz. Güncel rol/katalog ölçümleri yapıldı; önceki497 test, backup restore ve build bu görevde tekrar çalıştırılmadı.

M017/M016/backup kaynakları, eski raporlar, LAST_REPORT, kullanıcı değişiklikleri, `.env.local` ve001–017 migration'lar hash ile korundu.016 SHA-256 `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`;017 SHA-256 `9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`. Kod, guard, Git index/HEAD veya credential değiştirilmedi. Gerçek CREATE/ALTER ROLE, GRANT/REVOKE, migration apply, dump, R2 upload, restore, snapshot veya Git commit/push yapılmadı.
