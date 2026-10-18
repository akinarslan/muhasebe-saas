# Sprint E2.2b — Neon backup hesabı etki analizi ve uygulama planı

18.10.2026 · `feat/pusula-v030-neon-cloud` · başlangıç `604bedc`; başlangıç çalışma ağacı temiz, fetch sonrası upstream 0/0.

## Karar

**Bu dosya uygulanmamış plandır. Yalnız development katalogları yeniden okundu. Yetki değişikliği ve hesap oluşturma için yeni açık operatör onayı gerekir.**

PUBLIC TEMP'i seçici explicit grant ile değiştirmek mevcut gerekli uygulama rollerinin efektif haklarını koruyabilir. Ancak iki karar verilmeden uygulama **BLOCKED** kalır:

1. Provider/builtin rollerinin development TEMP kaybının kabul edilebilirliği veya provider tarafından desteklenen koruma yöntemi.
2. Aynı branch'teki **neondb ve postgres PUBLIC CONNECT** hakları. Yalnız development ACL'sini değiştirmekle yeni LOGIN'e yalnız development CONNECT sınırı getirilemez. Backup rolünden CONNECT revoke etmek PUBLIC mirasını kesmez. Diğer DB'lerde değişiklik mevcut görev kapsamı dışıdır; provider destekli gerçek bağlantı izolasyonu veya ayrıca onaylanmış çapraz DB ACL planı olmadan hesap kurulumu yapılmamalıdır. Uygulama URL allowlist'i credential'ın doğrudan kullanılmasını önleyen sunucu yetkisi değildir.

Bu nedenle aşağıdaki SQL gerekli kapsam kararlarından sonra gözden geçirilecek taslaktır; bugün tek parça otomatik çalıştırılabilir kurulum değildir. Geniş owner/admin hesabıyla yedekleme alternatifi kullanılmaz.

## Salt okunur kanıt ve yöntem

Onaylı direct development allowlist'i bağlantıdan önce kontrol edildi; sslmode=verify-full, Node sistem CA, statement timeout ve `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` kullanıldı, sonunda ROLLBACK yapıldı. Veritabanı pusula_development; PostgreSQL **18.6 (653b019)**; transaction_read_only **on**.

pg_roles/pg_auth_members, pg_database/aclexplode, pg_namespace, pg_class, pg_proc ve pg_default_acl incelendi. Her rolün has_database_privilege/has_schema_privilege/has_table_privilege/has_function_privilege sonuçları ve her tablo için ayrı SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN matrisi Git dışı `.data/e22b-catalog.json` dosyasına kaydedildi. ACL null değerlerinde acldefault kullanıldı; null “hiç yetki yok” sayılmadı. Hiçbir gerçek iş/Auth/MFA tablosunda satır/count okunmadı. Başka DB'lerin yalnız pg_database metadata'sı incelendi; test DB, neondb, postgres veya production'a bağlantı açılmadı.

Katalogda **24 rol**, **16 üyelik**, **35 public tablo**, **0 sequence**, **5 public fonksiyon** var; pusula_backup yok. 35 tablo sahibi neondb_owner; public şema sahibi pg_database_owner. PUBLIC tablo ACL'si yok. PUBLIC public şemasında USAGE alıyor; CREATE almıyor. Dört trigger fonksiyonu varsayılan PUBLIC EXECUTE taşıyor, pusula_can yalnız belirtilen runtime rolleri/owner tarafından çalıştırılabiliyor. Beş fonksiyon SECURITY INVOKER; E2.2a hash denetimi korunur.

Ham yerel metadata kanıtının SHA-256 değeri `e26be58f99ee0e01964c95d99403133825839091ffb7fff1464cbdf66d3dcefb`; dosya Git dışındadır. Bu özet DB içeriğinin/yedeğinin özeti değildir. Planın SELECT listesi 35 mevcut tabloyla, envanter tablosu 24 katalog rolüyle yerel statik kontrolde eşleşti; SQL yürütülmedi.

### Güncel efektif rol matrisi

E/H = evet/hayır. “Yazma nesnesi” sütunu DML yanında REFERENCES/TRIGGER/MAINTAIN birleşimidir; her nesnede bütün yazma hakları var anlamına gelmez. SELECT ACL sonucu RLS altında bütün satırları görme kanıtı değildir. Son sütun yalnız public fonksiyon EXECUTE sayısıdır. Diğer DB'lerdeki nesne hakları bu bağlantıdan incelenmedi.

| Rol | LOGIN | CONNECT | TEMP | DB CREATE | public USAGE/CREATE | SELECT tablo | Yazma nesnesi | EXECUTE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cloud_admin | E | E | E | E | E/E | 35 | 35 | 5 |
| neon_service | E | H | E | H | E/H | 0 | 0 | 4 |
| neon_superuser | H | E | E | E | E/H | 35 | 35 | 4 |
| neondb_owner | E | E | E | E | E/E | 35 | 35 | 5 |
| pg_checkpoint | H | H | E | H | E/H | 0 | 0 | 4 |
| pg_create_subscription | H | H | E | H | E/H | 0 | 0 | 4 |
| pg_database_owner | H | H | E | H | E/E | 0 | 0 | 4 |
| pg_execute_server_program | H | H | E | H | E/H | 0 | 0 | 4 |
| pg_maintain | H | H | E | H | E/H | 0 | 35 | 4 |
| pg_monitor | H | H | E | H | E/H | 0 | 0 | 4 |
| pg_read_all_data | H | H | E | H | E/H | 35 | 0 | 4 |
| pg_read_all_settings | H | H | E | H | E/H | 0 | 0 | 4 |
| pg_read_all_stats | H | H | E | H | E/H | 0 | 0 | 4 |
| pg_read_server_files | H | H | E | H | E/H | 0 | 0 | 4 |
| pg_signal_autovacuum_worker | H | H | E | H | E/H | 0 | 0 | 4 |
| pg_signal_backend | H | H | E | H | E/H | 0 | 0 | 4 |
| pg_stat_scan_tables | H | H | E | H | E/H | 0 | 0 | 4 |
| pg_use_reserved_connections | H | H | E | H | E/H | 0 | 0 | 4 |
| pg_write_all_data | H | H | E | H | E/H | 0 | 35 | 4 |
| pg_write_server_files | H | H | E | H | E/H | 0 | 0 | 4 |
| pusula_auth | E | E | E | H | E/H | 10 | 9 | 4 |
| pusula_runtime | E | E | E | H | E/H | 24 | 19 | 5 |
| pusula_test_auth | E | H | E | H | E/H | 0 | 0 | 4 |
| pusula_test_runtime | E | H | E | H | E/H | 9 | 10 | 5 |

### Üyelikler ve özel sahiplik

neondb_owner → neon_superuser: ADMIN H, INHERIT E, SET E. Owner → neon_service ve dört Pusula rolü: ADMIN E, INHERIT H, SET H. Pusula login rollerinin kendileri başka role üye değil.

neon_superuser → pg_create_subscription/pg_monitor/pg_read_all_data/pg_signal_backend/pg_write_all_data: ADMIN/INHERIT/SET E. pg_maintain ve pg_signal_autovacuum_worker üyeliklerinde ADMIN/INHERIT E, SET H. pg_monitor → pg_read_all_settings/pg_read_all_stats: ADMIN H, INHERIT/SET E; pg_stat_scan_tables: ADMIN/INHERIT/SET E. Bunlar değiştirilmez. Builtin grup rollerinin LOGIN H olması haklarının mevcut üyeler veya gelecekteki grant'ler için önemsiz olduğu anlamına gelmez.

neondb_owner DB/table sahibi ve explicit DB TEMP sahibidir; PUBLIC TEMP kaldırılınca bu hak devam eder. neon_superuser da explicit CTc DB ACL'si taşır; TEMP devam eder. cloud_admin gerçek provider superuser olduğundan ACL'den bağımsız erişebilir; kullanıcıya verilmiş superuser değildir. pg_database_owner, mevcut DB sahibinin örtük üyeliği ile public şema sahipliğini temsil eder; ayrı bir servis hesabı değildir. Sahipliğe bağlı ALTER/DROP ve yeniden grant yapabilme gücü, sıradan ACL SELECT ile eşdeğer değildir. Owner'ı salt okunur backup kimliği saymak bu yüzden yanlıştır. [PG18 GRANT/sahiplik kuralları](https://www.postgresql.org/docs/18/sql-grant.html).

### PUBLIC ve aynı branch'teki DB'ler

| DB (yalnız katalog) | PUBLIC | Mevcut açık CONNECT | Önerilen development işleminin etkisi |
| --- | --- | --- | --- |
| pusula_development | TEMP; CONNECT yok | owner, neon_superuser, runtime, auth | Yalnız burada TEMP ACL değişir |
| pusula_sprint_b_test | TEMP; CONNECT yok | owner, neon_superuser, test_runtime, test_auth | Değişmez; bağlanılmadı |
| neondb | CONNECT + TEMP | owner/neon_superuser da açık haklı | Yeni backup LOGIN PUBLIC üzerinden erişebilir: engel |
| postgres | Varsayılan CONNECT + TEMP | cloud_admin owner; ACL null | Yeni backup LOGIN PUBLIC üzerinden erişebilir: engel |

Roller branch/cluster kapsamındadır; CREATE ROLE yalnız bir DB'ye ait kimlik yaratmaz. Aynı branch'te rol oluşturmak test DB kataloğunda da rolün görünmesine yol açar; CONNECT verilmemesi görünürlükten farklıdır. Başka branch/production credential kopyaları bu denetimle doğrulanmadı. [Neon rol kapsamı](https://neon.com/docs/manage/roles).

## TEMP etki analizi ve seçenekler

Şu an **24 rolün tamamı development TEMP E**. Pusula rollerinin TEMP kaynağı PUBLIC'tir. Runtime/auth CONNECT E; test rolleri development CONNECT H olmasına rağmen TEMP E. Yeni backup LOGIN bugün kurulursa PUBLIC üzerinden TEMP E olur.

| Seçenek | Etki | Karar |
| --- | --- | --- |
| PUBLIC TEMP bırak + backup rolünden revoke | Backup TEMP E kalır | Uygun değil |
| READ ONLY varsayılanı veya uygulama filtresi | Credential sahibi değiştirebilir | Yetki yasağı yerine geçmez |
| Dört Pusula rolüne explicit TEMP, sonra PUBLIC revoke | Pusula rollerinin efektif TEMP ve mevcut CONNECT/nesne hakları korunur | Önerilen minimal uygulama planı; provider incelemesine bağlı |
| Bütün 24 mevcut role explicit TEMP, sonra PUBLIC revoke | Mevcut tüm rol bazlı TEMP sonuçları korunabilir | Builtin/provider rollerine gereksiz kalıcı grant ve gelecekteki üyeler için miras oluşturur; otomatik önerilmez |
| Provider onaylı gerekli internal rolleri eklemek | Bilinen provider ihtiyaçları korunabilir | Provider izin/kısıt/etki teyidi olmadan çalıştırılmaz |

Kod taraması src/scripts/prisma içinde CREATE TEMP/TEMPORARY TABLE veya SELECT INTO TEMP kullanımı bulmadı; yalnız pusula_can search_path'inde pg_temp var. scripts/db/migrate.ts mevcut owner/direct bağlantısıyla **Prisma 7.10.1 migrate deploy** çağırır; [Prisma v7 belgesi](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/shadow-database) deploy'un shadow DB kullanmadığını belirtir. migrate dev farklıdır ve shadow DB gerekebilir; bu görevde çalıştırılmadı. Shadow DB bir TEMP TABLE değildir. Owner'ın TEMP/DDL hakları korunduğundan mevcut migration yolu için beklenen kayıp yoktur; bakım aracının gelecekte rol değiştirmesi veya dış SQL kullanımının hiç TEMP gerektirmediği kanıtlanmadı.

Runtime/auth havuzlarında etkili ACL aynı kalırsa bu değişiklik için zorunlu restart beklenmez; yeni/var olan oturum etkileri sonradan doğrulanmalı. Mevcut geçici nesneler revoke ile temizlenmez, oturumlar sonlandırılmaz. Dört rolün açık TEMP'ini korumak gelecekte bakım/driver TEMP ihtiyacını da korur. Test rollerine development CONNECT açılmaz. Provider rolü neon_service CONNECT H olsa da privileged workflow içinde TEMP ihtiyacı olmadığı varsayılamaz.

### Beklenen önce/sonra (henüz uygulanmadı)

| Grup/rol | Development CONNECT önce → sonra | TEMP önce → sonra | Diğer haklar |
| --- | --- | --- | --- |
| pusula_runtime, pusula_auth | E → E | E (PUBLIC) → E (explicit) | Aynı schema/table/function matrisi |
| pusula_test_runtime, pusula_test_auth | H → H | E (PUBLIC) → E (explicit) | Aynı; test DB değişmez |
| neondb_owner, neon_superuser | E → E | E → E (mevcut explicit) | Yönetim/sahiplik korunur |
| cloud_admin | E → E | E → E (superuser) | Provider yetkileri korunur |
| neon_service | H → H | E → H (yalnız minimal plan) | Provider kararı gerektiren fark; teyitsiz commit yok |
| pg_* NOLOGIN roller | H → H | E → H (yalnız minimal plan) | Diğer efektif haklar aynı; transitif/provider ihtiyaç incelemesi gerekir |
| Yeni pusula_backup | Yok → E | Yok → H | SELECT35, USAGE; yazma/CREATE/üyelik/sahiplik yok |
| Gelecekteki sıradan SQL rolü | Varsayılan development CONNECT H | TEMP H | Açık grant gerekir |

“Tüm 24 rolün birebir aynı TEMP'i” şartı seçilirse minimal plan uygun değildir; geniş grant planı ayrı provider/onay incelemesi gerektirir. Bu fark göz ardı edilmez.

## Uygulama önkoşulları ve durdurma koşulları

- Yeni açık operatör onayı: TEMP kapsamı, korunacak roller, yeni hesap ve SELECT grant listesi ayrı isimlendirilmelidir.
- Development direct host/DB/verify-full ve güvenli CA doğrulanmalı; onaylı target allowlist değişmemeli.
- 24 rol/16 üyelik, DB ACL grantor/grant option, 35 tablo/21 FORCE RLS, schema/column/function ACL ve default ACL baseline yeniden alınmalı; drift varsa durulmalı. Mevcut pusula_backup görülürse reset/yeniden kullanma yok, dur.
- Provider/builtin TEMP etkisi çözülmemişse dur. Yeni rol diğer DB'lere PUBLIC CONNECT alıyorsa dur. İstisna isteyen yeni gereksinim ayrı kapsam kararıdır; hedef kriter sessizce gevşetilmez.
- Onaylı migration/ACL bakım penceresi; eşzamanlı rol/ACL/schema değişikliği yok. Transaction tek başına dış yönetim API'sini kilitlemez.
- Admin bağlantısında gereken grant option/CREATEROLE/doğrudan BYPASSRLS önkoşulu yoksa veya provider CREATE/GRANT'ı reddeder/uyarı verirse dur; owner fallback dump yok.
- Secret deposu ve kapalı log/history, SCRAM, branch/production credential izolasyonu hazır değilse dur. Başka DB/production'a erişerek deneme yapılmaz.

## SQL taslağı — ÇALIŞTIRILMADI

### A. Katalog baseline ve uygulanabilirlik kapısı

Aşağıdaki salt okunur SQL gelecekte operatör tarafından direct development oturumunda yeniden çalıştırılabilir. Tam nesne matrisi de önceki yöntemle kaydedilir. PUBLIC diğer DB CONNECT kapısı mevcut durumda **bilinçli olarak hata verir**; yalnız development kapsamında hedefin karşılanamadığını gösterir.

```sql
-- psql: \set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $guard$
BEGIN
  IF current_database() <> 'pusula_development' THEN
    RAISE EXCEPTION 'TARGET_REJECTED';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='pusula_backup') THEN
    RAISE EXCEPTION 'BACKUP_ROLE_ALREADY_EXISTS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user
                 AND rolcreaterole AND rolbypassrls) THEN
    RAISE EXCEPTION 'ROLE_CREATOR_PREREQUISITES_MISSING';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_database d
    CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a
    WHERE NOT d.datistemplate AND d.datallowconn
      AND d.datname <> 'pusula_development'
      AND a.grantee=0 AND a.privilege_type='CONNECT'
  ) THEN
    RAISE EXCEPTION 'OTHER_DATABASE_PUBLIC_CONNECT_BLOCKS_ISOLATION';
  END IF;
END
$guard$;
-- Bu noktaya kadar başarılı olsa bile provider/etki onayı ayrıca gerekir.
ROLLBACK;
```

DB adı kontrolü host/branch kontrolünün yerine geçmez; bağlantı öncesi mevcut allowlist zorunludur. Bu DO bloğu **bu sprintte çalıştırılmadı**; yalnız kataloga SELECT ile gözlem yapıldı.

### B. TEMP ve rol/grant transaction'ı

**Şimdilik çalıştırılamaz:** A kapısı geçmeden ve provider TEMP kararı verilmeden başlanmaz. Gelecekte aşağıdaki taslağın başına A'daki guard aynı transaction içinde taşınmalı; ayrı oturumda bir kez kontrol etmek yeterli değildir. Transaction operatöründe ON_ERROR_STOP açık olmalı, bütün hatalar ROLLBACK ile sonlanmalıdır. E2.2b burada COMMIT yetkisi vermez.

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- A guard + onaylanmış katalog baseline karşılaştırması burada, değişiklikten önce.
-- Yalnız mevcut dört uygulama rolünün efektif TEMP'ini korur.
GRANT TEMPORARY ON DATABASE pusula_development
  TO pusula_runtime, pusula_auth, pusula_test_runtime, pusula_test_auth;
REVOKE TEMPORARY ON DATABASE pusula_development FROM PUBLIC RESTRICT;

-- Provider'ın doğrudan BYPASSRLS kabulü ilk kez burada sınanacaktır.
-- Parola placeholder'ı SQL'e yazılmaz; NULL, parola doğrulamasını kapalı tutar.
CREATE ROLE pusula_backup WITH LOGIN PASSWORD NULL
  BYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
GRANT CONNECT ON DATABASE pusula_development TO pusula_backup;
GRANT USAGE ON SCHEMA public TO pusula_backup;
GRANT SELECT ON TABLE
  public."Tenant", public."LegalEntity", public."Activity", public."Customer",
  public."Material", public."MaterialVariant", public."MaterialPriceHistory",
  public."AuthUser", public."AuthSession", public."AuthAccount",
  public."AuthVerification", public."AuthRateLimit", public."AuthTwoFactor",
  public."AuthBootstrap", public."AuthSecurityEvent", public."Membership",
  public."Role", public."Permission", public."RolePermission",
  public."PermissionScope", public."RoleAssignment", public."UserPermissionOverride",
  public."AuditEvent", public."AuthInvitation", public."TenantExchangeRate",
  public."AuthMailDelivery", public."CloudProduct", public."CloudExpenseType",
  public."CloudQuote", public."CloudSale", public."CloudSaleLine",
  public."CloudPaymentPlan", public."CloudImportBatch", public."CloudImportRecord",
  public."_prisma_migrations"
TO pusula_backup;
-- Sequence yok: şimdi sequence grant verilmez.
-- TEMP/CREATE/DML/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN/grant option verilmez.
-- Hiçbir role üyelik verilmez; hiçbir nesnenin sahipliği devredilmez.
SET LOCAL password_encryption = 'scram-sha-256';
-- Güvenli psql istemcisinde ayrı secret deposundan gizli giriş:
-- \password pusula_backup
-- Parola belirlenmeden LOGIN hazır kabul edilmez; plaintext SQL/history'ye yazılmaz.
-- Aşağıdaki katalog kontrolleri ve önce/sonra matris eşleşmesi burada yapılır.
-- COMMIT yalnız bütün kapılar PASS ve ayrı operatör uygulama onayıyla.
ROLLBACK; -- Taslağın güvenli varsayılanı; yürütme talimatı değildir.
```

Parola kriptografik rastgele, ayrı ve yüksek entropili olmalı; `.env.local`/secret manager içinde BACKUP_SOURCE_DATABASE_URL yalnız pusula_backup/direct/verify-full olarak saklanmalı. Terminal çıktısı, Git, uygulama env'i, test credential'ı veya R2 metadata'sına konmamalı. SCRAM verifier da sırdır; server/client statement logging denetlenmeli. Rol için default read-only ayarı isteğe bağlı ikinci savunmadır; ACL yasağının yerine geçmez. NOINHERIT tek başına SET/ADMIN yollarını kapatmaz; üyelik sıfır şarttır.

### Yeni nesneler

Öneri: başlangıçta **ALTER DEFAULT PRIVILEGES yok**. Her migration'ın incelenmiş yeni tablosuna açık SELECT, ilgili E2 kapsam/hash incelemesiyle aynı onaylı deploy adımında verilir; yeni nesne unutulursa yedek fail-closed durur. İleride default SELECT seçilirse yalnız gerçek migration owner başına, development public şemasında, ayrı onayla aşağıdaki alternatif değerlendirilir:

```sql
-- ALTERNATİF; bu planda etkinleştirilmez:
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT ON TABLES TO pusula_backup;
-- İleride gerçekten sequence eklenirse ayrıca incelenir:
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO pusula_backup;
```

Default grant mevcut nesnelere uygulanmaz ve başka owner'ın yaratacağı nesneleri kapsamaz. Yeni tablo backup credential'ına engine dışından da okunabilir hale gelir; bu yüzden otomatik SELECT en dar seçenek değildir. Yeni sequence şu an E2.2a relation guard'ında ayrıca inceleme gerektirir. Mevcut cloud_admin default ACL'leri değiştirilmeyecek. [Default ACL kuralları](https://www.postgresql.org/docs/18/sql-alterdefaultprivileges.html).

## Hesap sonrası doğrulama — ayrı kabul kapıları

1. **Transaction içi metadata:** rol LOGIN/BYPASSRLS E, SUPERUSER/CREATEDB/CREATEROLE/REPLICATION H; bütün pg_auth_members member kayıtları sıfır; pg_shdepend ownership sıfır. Sıfır üyelik, admin'in yeni role otomatik yönetim üyeliğinden farklıdır: pusula_backup'ın başka role üye olmaması aranır. Provider beklenmedik ters/yükseltme yolu eklerse dur.
2. **Etkin haklar:** current role yerine rol OID'siyle has_database_privilege kontrolü: development CONNECT E, TEMP/CREATE H; diğer connectable DB CONNECT H. public USAGE E/CREATE H. 35 tablonun SELECT'i E; bütün tablo/column yazma ve grant option H; fonksiyon/extension/large object/şema drift'i yok. FORCE RLS21 ve doğrudan rol BYPASSRLS E. Mevcut 24 rol matrisi seçilmiş politika ile karşılaştırılır; dört uygulama ve admin/provider için onaysız fark varsa ROLLBACK.
3. **Commit sonrası yeni hesap bağlantısı:** yalnız development direct/verify-full/CA ile psql READ ONLY katalog sorgusu; gerçek parola çalışır, current_user doğru. Bu adım rol doğrulama onayı ister, gerçek iş satırı sorgusu içermez. Tam backup:preflight komutu bu metadata kapısıyla karıştırılmaz: mevcut inspectSource tabloları sayar.
4. **Ayrı veri kapsamı onayı:** ancak ayrıca izin verilince aynı salt okunur snapshot'ta tam sayım ve migration checksum; FORCE RLS filtrelenmeden okunabildiği fiilen doğrulanır. BYPASSRLS katalog bayrağı tek başına yeni hesabın eksiksiz veri okuduğu kanıtı değildir.
5. **Ayrı dump onayı:** gerçek pg_dump -Fc + TOC/sayım/şifreleme/verify. **Ayrı R2 yazma onayı:** upload/readback. Restore/E3/E4 ayrıca kalır.

Post-commit uygulama smoke/regresyonu mutation yapacaksa bunun için de açık test kapsamı gerekir; bugünkü görev test DB veya auth akışı çalıştırma izni değildir. ACL matrisi eşitliği runtime performansı/dış araç davranışı sertifikasyonu sayılmaz.

## Rollback ve acil durdurma

**COMMIT öncesi:** hata/timeout/provider uyarısı/baseline farkı/secret kurulum hatasında ROLLBACK. Aynı transaction'daki TEMP grant/revoke, yeni rol ve nesne grant'leri geri alınır; uygulama tabloları zaten değiştirilmez. Tamamlanmış COMMIT varmış gibi raporlanmaz.

**COMMIT sonrası, ayrı geri alma onayıyla:** önce yeni job/credential kullanımını durdur; backup rolünü NOLOGIN yap (mevcut oturumları kapatmaz); yalnız bu yeni rolün oturumları varsa kimlikleri teyit edilerek ayrıca onaylı kapatma planı uygula. PUBLIC TEMP geri getirileceği için backup rolü kaldırılmadan veya erişimi güvenli kapatılmadan rollback kabul edilmez. Pusula/Neon diğer oturumları öldürülmez.

```sql
-- YALNIZ gelecekteki geri alma onayıyla; yeni rolün bu plandan başka kullanımı yoksa.
BEGIN;
ALTER ROLE pusula_backup NOLOGIN;
-- Aktif backup oturumu yok, sahiplik yok, yeni/grant drift yok kontrolü zorunlu.
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM pusula_backup RESTRICT;
REVOKE USAGE ON SCHEMA public FROM pusula_backup RESTRICT;
REVOKE CONNECT ON DATABASE pusula_development FROM pusula_backup RESTRICT;
-- Default ACL alternatifi etkinleştiyse yalnız eklenen aynı SELECT default'larını
-- aynı owner/kapsam için ayrıca REVOKE et; önce baseline ile karşılaştır.
DROP ROLE pusula_backup;
GRANT TEMPORARY ON DATABASE pusula_development TO PUBLIC;
-- Önceki baseline'da bu dört role explicit TEMP yoktu; yalnız bu işlemin grant'leri:
REVOKE TEMPORARY ON DATABASE pusula_development
  FROM pusula_runtime, pusula_auth, pusula_test_runtime, pusula_test_auth RESTRICT;
-- Orijinal ACL grantor/grant option ve bütün etkin matris karşılaştırması.
-- COMMIT ayrı onay ve bütün kontroller PASS ise.
ROLLBACK;
```

Yukarıdaki kapsamda sequence grant yoktur. Sonradan grant/default ACL/ownership/başka DB bağımlılığı eklenmişse bu geri alma taslağı uygulanmaz; yeni plan gerekir. DROP ROLE bağımlılık nedeniyle reddedilirse dur; **DROP OWNED/REASSIGN OWNED/CASCADE yok**. Orijinal grantee/grantor/ACL seçenekleri korunmalı; yeni operatör farklı grantor yaratmışsa sırf efektif hak eşit diye birebir rollback iddia edilmez. Diğer DB PUBLIC CONNECT için ileride ayrı plan onaylanırsa onun rollback'i de ayrı hazırlanır. Secret env kaydı eski duruma güvenle döndürülür, parola/verifier Git'e yazılmaz.

## Sonuç ve istenen operatör kararları

Bugünkü teslim yalnız dokümantasyon ve başarılı READ ONLY katalog denetimidir. CREATE/ALTER ROLE, GRANT/REVOKE, TEMP/RLS/migration değişikliği, dump, R2, yeni hizmet, test DB veya production bağlantısı yapılmadı. Çalışan uygulama kodu ve E2 motoru değiştirilmedi; eski test sonuçları yeni çalıştırılmış gibi sunulmadı.

Uygulama için yeni açık onaydan önce: **(a)** dört uygulama rolünün TEMP'ini koruyan politika + provider/builtin etkisi kararı, **(b)** diğer DB PUBLIC CONNECT engelini çözecek yetkili kapsam/provider izolasyonu, **(c)** gerçek SQL-created rol ve dar SELECT grant listesi + secret yönetimi, **(d)** metadata/TLS sonrası kabulü karara bağlanmalıdır. Diğer DB/production kapsamı genişletilmeden “yalnız development CONNECT” hedefi şu anda sağlanamaz. Gerçek sayım/dump/R2 için sonraki ayrı onaylar korunur.
