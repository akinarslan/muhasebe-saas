# Sprint E2.2 — Neon backup hesabı salt okunur denetimi

18.10.2026 · `feat/pusula-v030-neon-cloud` · başlangıç `ec330a2`; fetch sonrası upstream 0/0, başlangıç çalışma ağacı temiz.

## Karar ve kanıt sınırı

**Dar yetkili, doğrudan BYPASSRLS taşıyan SQL-created backup hesabı teknik olarak uygulanabilir adaydır; mevcut katalog özellikleri ve PostgreSQL 18 komut belgeleri bu tasarımı destekler. Ancak Neon üzerinde hesabın oluşturulması, nitelik atanmasının provider tarafından kabulü ve yeni hesapla tam okuma fiilen test edilmedi. Hesap hazır/uygun kabul edilmedi.** Bu sprint yalnız denetimdir.

E2.1b'nin [14/14 gerçek yerel testi](../docs/validation/SPRINT_E21B_VERIFICATION.md), aynı 35 tablo/21 FORCE RLS modelinde dar BYPASSRLS hesabıyla dump/TOC/kripto kanıtıdır; Neon managed rol oluşturma kabulü değildir. Gerçek dump öncesi ayrıca libpq CA hazırlığı eksiktir.

## Yöntem ve kapsam

Mevcut onaylı DIRECT_DATABASE_URL yalnız bellekte yüklendi. Repo allowlist kontrolü direct development host/DB, port, protokol ve `sslmode=verify-full` eşleşmesini bağlantıdan önce zorunlu tuttu. Node sistem CA deposuyla bağlanıldı; `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` ve sonunda ROLLBACK kullanıldı. Yalnız pg_roles, pg_auth_members, pg_database, pg_namespace, pg_class, pg_policies, pg_trigger, pg_constraint, pg_proc, pg_default_acl, pg_extension, oturum ayarları ve kendi pg_stat_ssl metadata'sı okundu.

İşletme tablolarından satır veya count alınmadı. `_prisma_migrations` satırları da okunmadı; bu nedenle canlı migration uygulama/checksum geçmişi bu sprintte doğrulanmış değildir. Yerel Prisma şeması ve 13 migration SQL'i incelendi; canlı tablo/constraint/trigger kataloglarıyla yapı kapsamı karşılaştırıldı. Existing `inspectSource` çağrılmadı; bu fonksiyon uygulama tablolarında count ve migration satırları okur.

Yalnız `pusula_development` bağlantısı açıldı. Test rol/DB adları aynı branch'in sistem kataloglarında görüldü; `pusula_sprint_b_test` içine bağlantı veya sorgu yapılmadı. Production'a bağlanılmadı. Yerel denetim scriptleri ve ham katalog JSON'u `.data` altında Git dışında kaldı; bağlantı bilgileri/log payload'ı teslim edilmedi.

## 1. Mevcut rol ve nesne mimarisi

Sunucu **PostgreSQL 18.6 (653b019)**; transaction_read_only **on**. `pusula_backup` yok.

| Rol | LOGIN | SUPERUSER | CREATEDB / CREATEROLE | REPLICATION | BYPASSRLS |
| --- | --- | --- | --- | --- | --- |
| neondb_owner | Evet | Hayır | Evet / Evet | Evet | Evet |
| neon_superuser | Hayır | Hayır | Evet / Evet | Evet | Evet |
| pusula_runtime / pusula_auth | Evet | Hayır | Hayır / Hayır | Hayır | Hayır |
| pusula_test_runtime / pusula_test_auth | Evet | Hayır | Hayır / Hayır | Hayır | Hayır |

Owner, neon_superuser üyesidir (INHERIT ve SET açık); uygulama/test rollerine admin üyelikleri INHERIT/SET kapalıdır. Provider iç rollerinin görünmesi onların kullanılmasına izin verildiği anlamına gelmez; bunlara müdahale edilmedi. Mevcut owner geniş yönetim/yazma yetkileri nedeniyle backup hesabı olarak uygun değildir.

Yalnız public uygulama şeması ve **35 tablo** görüldü; hepsinin sahibi neondb_owner. public şema sahibi pg_database_owner. **21 tablo FORCE RLS**, **43 policy**, **43 FK**, **11 kullanıcı trigger**, **5 public fonksiyon**, **0 sequence**. Public fonksiyonların tamamı SECURITY INVOKER; SECURITY DEFINER yok. Yalnız plpgsql extension görüldü. Farklı managed owner altında uygulama tablosu görülmedi. cloud_admin adına neon_superuser için default ACL kayıtları var; bunlar yeni backup hesabına SELECT sağlamaz.

11 Better Auth tablosu (AuthUser, AuthSession, AuthAccount, AuthVerification, AuthRateLimit, AuthTwoFactor, AuthBootstrap, AuthSecurityEvent, AuthInvitation, AuthMailDelivery) RLS kullanmıyor; ayrı SQL rol/ACL ayrımı var. AuditEvent FORCE RLS, AuthSecurityEvent değil; her ikisi de backup kapsamına girmeli. Gerçek kullanıcı/parola/TOTP/token içerikleri okunmadı. Kayıpsız yedek hassas auth sırlarını da taşıyacağından backup anahtarı/erişimi özel korunmalıdır.

## 2–4. Hesap oluşturma, BYPASSRLS ve FORCE RLS

Neon SQL ile sınırlı rol oluşturmayı destekler; Console/API/CLI yolu ise otomatik neon_superuser üyeliği ekler. Bu nedenle önerilen yol **SQL ile yeni, ayrı LOGIN**, admin üyeliği olmadan doğrudan BYPASSRLS'dir. [Neon rol modeli](https://neon.com/docs/manage/roles).

[PG18 CREATE ROLE](https://www.postgresql.org/docs/18/sql-createrole.html) ve [ALTER ROLE](https://www.postgresql.org/docs/18/sql-alterrole.html), ilgili yetkiye sahip roller için BYPASSRLS atama yolunu tarif eder. Canlı owner CREATEROLE ve doğrudan BYPASSRLS taşıyor: gerekli katalog önkoşulları mevcut. Buna rağmen CREATE/ALTER denenmediği için provider hook/sürüm kısıtının bu hesabın yaratılmasına izin verdiği **çıkarım**, kesin operasyon kanıtı değildir. Genel role-attributes özeti daha kısıtlı superuser anlatımı içerir; çelişen özet yerine sürümün komut referansları esas alındı. Provider reddederse durulmalı, admin fallback kullanılmamalıdır.

Tablo sahibi normalde RLS'yi aşabilir fakat FORCE RLS sahibi de politikalara tabi kılar. Sahiplik ayrıca ALTER/DROP olanağı verdiğinden zaten kabul edilemez. Doğrudan BYPASSRLS ise SELECT yetkisi bulunan tablolarda FORCE RLS dahil politikaları aşar; kendiliğinden SELECT veya yazma yetkisi vermez. `pg_read_all_data` yalnız başına RLS'yi aşmaz. [RLS kuralları](https://www.postgresql.org/docs/18/ddl-rowsecurity.html), [predefined roller](https://www.postgresql.org/docs/18/predefined-roles.html).

Dolayısıyla yeni hesabın bütün satırları okuyabilmesi beklenir; fakat **bu denetim tam veri okuması kanıtı değildir**. Sonraki onaylı aşamada gerçek hesabın rol/üyelik/ACL kontrolleri, `row_security=off` altında yetki hatası olmadan snapshot sayımları ve ayrı dump onayından sonra TOC/sayım karşılaştırması gerekir. `--enable-row-security` ile filtreli dump kabul edilmez.

## 5–7. En az yetki modeli ve sınırlamaları

Önerilen pusula_backup: LOGIN, BYPASSRLS, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION; nesne sahipliği ve güçlü role SET/INHERIT/ADMIN yolu yok. Uygulama/auth/owner credential'larından ayrıdır.

| Nesne | Gereken | Verilmeyecek |
| --- | --- | --- |
| Development DB | CONNECT | CREATE; katı DDL yasağı için TEMP de olmamalı |
| public şema | USAGE | CREATE veya sahiplik |
| 35 tablo, auth/audit/migration dahil | SELECT | INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN ve grant option |
| Sequence | Şimdi yok; gelecekte dump için SELECT | nextval/setval sağlayan USAGE/UPDATE |
| Gelecekteki nesneler | Gerçek migration owner başına default SELECT grants | Otomatik owner/admin mirası |

`pg_read_all_data` yerine public nesnelerine açık SELECT, kaynak kapsamını daha dar tutar. Mevcut diğer uygulama rollerine veya PUBLIC haklarına bu sprintte müdahale edilmedi.

**TEMP açığı:** development DB ACL'sinde PUBLIC TEMP mevcut. PostgreSQL'de kişi bazlı DENY yoktur; yeni rol açık TEMP grant almasa da PUBLIC üzerinden geçici nesne yaratabilir. “Hiç CREATE/ALTER/DROP yok” kriteri buna göre şu an sağlanamaz. Katı kriter korunacaksa PUBLIC TEMP kaldırılıp gereken mevcut rollere seçici geri verilmesinin uygulama etkisi incelenmeli ve ayrıca onaylanmalıdır. Sadece default_transaction_read_only ayarı kötü niyetli credential sahibine güvenlik sınırı sağlamaz.

**Branch/production sınırı:** Neon rolleri branch kapsamındadır; branch kopyalama rol/credential kopyalayabilir. Bu rolün yalnız development'ta var olması mevcut production izolasyonuna ilişkin tam kanıt değildir. Production'a bağlanmadan karşı branch rol/secret durumunu doğrulamadık. Deployment/secret allowlist, role kopyalama prosedürü ve gerekirse yeni credential rotasyonu gerekir. Aynı branch içindeki postgres/neondb gibi DB'lerde PUBLIC CONNECT katalogda mevcut; tüm DB'lere erişimsizlik istenirse bunlar da ayrı inceleme/onay ister. Test DB'de PUBLIC CONNECT görünmedi; yeni rol grant almamalı.

BYPASSRLS rolü bütün tenant/auth verilerini okuyabilir; “salt okunur” veri sızıntısını önlemez. Fonksiyon EXECUTE/SECURITY DEFINER, tehlikeli üyelikler, column ACL, yeni şema/large object/extension gibi gelecekteki yollar da hesaba katılmalıdır. Mevcut 5 public fonksiyonda SECURITY DEFINER yok; bu gelecekteki fonksiyonlara garanti değildir.

Alternatifler uygulanmadı: provider tarafından desteklenen dar backup modeli için Neon desteğine danışma; ayrı onaylı read-only replica erişim modeli; ayrı güvenlik kararıyla denetimli admin operasyonu (en az yetki kriterini sağlamaz ve mevcut E2 reddeder). RLS'ye backup OR koşulu eklemek, FORCE RLS kaldırmak veya ownership vermek önerilmez.

## 8. Hesap oluşturma öncesi gereken onaylar

1. Yalnız development'ta ayrı SQL-created pusula_backup ve doğrudan BYPASSRLS ataması; provider reddinde durma.
2. CONNECT/USAGE/SELECT ve migration-owner default ACL kapsamı, parola saklama/rotasyon ve üyelik denetimi.
3. Katı DDL yasağı için PUBLIC TEMP etkisinin değerlendirilmesi ve gerekiyorsa ayrı ACL değişikliği onayı; mevcut kullanıcıların etkilenmeyeceğinin doğrulanması.
4. Branch/production izolasyonu ve credential kopyalama politikasının operatör tarafından doğrulanması.
5. Oluşturma sonrası yalnız metadata/yetki doğrulaması. Tam sayım/dump ve R2 yazması kendi ayrı onaylarını korur. Bu rapor hiçbir SQL değişikliği için verilmiş onay değildir.

## pg_dump/TLS uygulanabilirliği

18.6 istemciler ile canlı 18.6 major uyumludur. Direct/unpooled bağlantı guard'ı geçti; dump alınmadı. [Neon export rehberi](https://neon.com/docs/guides/export-neon-postgres-compatible) pooled bağlantıdan kaçınır; [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html) row_security kapalıyken yetkisiz tam dump'ı hata ile durdurur.

Node bağlantısında TLSv1.3, encrypted=true, authorized=true ve servername/allowlist hostname eşleşmesi gözlendi. pg_stat_ssl backend tarafında false döndü; bu tek başına istemci TLS yok demek değildir. Proxy arkasındaki backend gözlemi ile doğrulanmış istemci TLS ayrıdır; aradaki provider iç taşıma bu audit ile kanıtlanmadı. [Neon TLS](https://neon.com/docs/connect/connect-securely).

Gerçek psql ile yalnız `SELECT current_setting('transaction_read_only')` denemesi E2'nin mevcut `pgEnvironment` yoluyla yapıldı. **BLOCKED / TOOL_FAILED**, güvenli tanı **LIBPQ_ROOT_CERT_MISSING**; BACKUP_PG_SSLROOTCERT tanımlı değil. Ham stderr/URL/parola gösterilmedi. Node sistem CA başarısı libpq deposunun hazır olduğunu göstermez. Güvenilir CA PEM kurulup BACKUP_PG_SSLROOTCERT ile seçilmeli veya resmî libpq sistem trust desteği kontrollü doğrulanmalı; verify-full korunmalı. Bu sprint CA/env kurulumu yapılmadı. [Libpq TLS](https://www.postgresql.org/docs/18/libpq-ssl.html).

## 9. E2 motoru değişiklik ihtiyacı

Mevcut rol/owner/yazma/DDL/sequence guard'ları, direct allowlist ve fail-closed RLS yaklaşımı korunmalı. Yeni rol adı modele uygundur; geniş admin hesabını kabul etmek için guard gevşetilmemeli. CA hazırlanması ilk engeldir, kripto/dump formatı değişikliği gerektirmez.

Katı güvenlik kabulü öncesinde **ayrı kod işi** gerekir: public TEMP yetkisini reddetmek, dolaylı SET ROLE/ADMIN yükseltme yollarını ve fonksiyon/column ACL yollarını açık denetlemek, yeni şema/nesne kapsamını fail-closed tutmak. Güncel preflight TEMP'i denetlemez ve tek başına kapsamlı saldırgan rol analizi değildir. Bu sprint yalnız dokümantasyon teslimidir; motor değiştirilmedi. Canlı migration checksum ve gerçek yeni rolün SELECT eksiksizliği de sonraki yetkili kontrollerde kalır.

## 10. E2.3 ve sonraki kapılar

Gerçek 32-byte rastgele key, benzersiz KEY_ID, güvenli secret deposu ve iki kontrollü offline kurtarma kopyası için ayrı onay/hazırlık gerekir. Gerçek key üretilmedi. Local fixture anahtarı üretim anahtarı olarak kullanılamaz. E2.3 anahtar hazırlığı planlanabilir; bu, backup hesabı ve libpq CA kapılarının geçtiği anlamına gelmez. E3 otomasyon/retention/alarm ve E4 restore/auth-session/RLS/finansal bütünlük tatbikatı ayrıca gerekir.

## Yapılmayanlar ve teslim

CREATE/ALTER ROLE, GRANT/REVOKE, migration, RLS değişikliği, gerçek veri SELECT/count/dump, restore, R2 çağrısı, yeni branch/DB, Master/MFA veya production işlemi yapılmadı. Test DB'ye bağlanılmadı. Başarısız libpq denemeleri başarı sayılmadı. Doküman değişikliği için uygulama regresyon suite'leri yeniden çalıştırılmadı; E2.1b sonuçları tarihsel kanıt olarak korundu. Git teslimi yalnız bu denetim ve ilgili dokümantasyondur; main değiştirilmez.
