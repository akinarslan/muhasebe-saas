# PUSULA — Neon NOLOGIN backup rolü onay paketi

24 Ekim 2026 · **ROLE_DDL_READY_FOR_APPROVAL — yalnız aşağıdaki dormant NOLOGIN delta için.** Henüz rol oluşturulmadı ve uygulama yetkisi verilmedi. Bu sonuç BACKUP_REMOTE_READY_FOR_APPROVAL, gerçek backup veya GO_LIVE_PASS değildir. Uygulama anındaki fresh preflight/DDL-ACL dışlama/validator koşullarından biri geçmezse paket durur; hazır belge mevcut snapshot'ın süresiz geçerliliği değildir.

## İncelenecek tek işlem

Project `icy-queen-44442204`; branch `br-rough-darkness-ba6ow9zo`; direct endpoint `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech:5432`; DB `pusula_development`; actor/session actor `neondb_owner`; PG180006; pre01640/26 ve15 başarı+resolved008. Transaction, tam SQL, bağımsız sorgular, hata sınıfları ve exact cleanup [runbook'ta](../docs/operations/PUSULA_BACKUP_ROLE_APPLY_RUNBOOK.md).

**Önerilen gelecekteki onay kapsamı:** Yalnız bu sabit hedefte `pusula_backup` NOLOGIN/PASSWORD NULL/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOREPLICATION/BYPASSRLS/CONNECTION LIMIT0; üç readonly/search_path ayarı; explicit40 tablo SELECT +public USAGE +source CONNECT; beklenen creator ADMIN kenarı; exact postflight başarılıysa tek COMMIT. SQL B body SHA-256: `8b082cfd7386c36825fcdaa4e2e3e00089d9f67168b237fe16eaafd0d9d42fe6`. A/C/global snapshot/cleanup blokları ve hedef de birlikte incelenir; yalnız B hash'i onay kanıtı değildir.

LOGIN, parola/credential üretimi, rol backend sonlandırması, gerçek dump/export, R2, restore, PUBLIC/default ACL değişikliği, migration016/017 veya API açılışı bu onaya dahil değildir. Onay verilse dahi var olan rolü değiştirme/IF NOT EXISTS/replay yolu yoktur.

## Önce → beklenen sonra: bütün izinli değişiklikler

| Kayıt | Önce | Beklenen sonra |
| --- | --- | --- |
| pusula_backup | Yok | Tek yeni global SQL rolü; LOGIN=false/password=NULL; bütün yönetim bayrakları false, BYPASSRLS=true; connlimit0 |
| Rol envanteri |24 |25; mevcut24 rolün metadata/ayarları aynı |
| Backup'ın üst role üyeliği | Yok |0; runtime/auth/executor/neon_superuser/monitor/read-all üyeliği verilmez |
| Creator ADMIN | Yok | Tek ters kenar parent=pusula_backup/member=neondb_owner/grantor=cloud_admin; ADMIN=true/INHERIT=false/SET=false |
| Global üyelik |16 |17; eski16 tuple aynen korunur; yeni kenar backup'ı admin'e üye yapmaz |
| Doğrudan tablo grant'i |0 | Yalnız B listesindeki40 public tablo SELECT, grantor=neondb_owner, grant-option=false |
| Schema / DB grant'i |0 | public USAGE/grantor pg_database_owner ve pusula_development CONNECT/grantor neondb_owner; grant-option=false |
| Source grantor multiset |494 |536=494+42; önceki494 tuple birebir aynı |
| Role settings | Yok | Bir setdatabase0 kaydı: default_transaction_read_only=on; row_security=off; search_path=pg_catalog, public, pg_temp |
| Direct function/column/default/sequence/view/başka DB nesne grant'i |0 |0 |
| Ownership / aktif session |0 |0; herhangi bir beklenmeyen ownership veya session durumunda dur |
| Şema/history |40/26,15 başarı+resolved008 |Aynı; satır, tablo, function, trigger, RLS veya migration değişikliği yok |
| PUBLIC ve mevcut kullanıcı hakları |Mevcut |Aynı; PUBLIC REVOKE/default değişikliği yok |

Creator grantor `cloud_admin`, PostgreSQL18 bootstrap grantor modeli ve mevcut katalog kimliğiyle belirlenmiş **beklentidir**; gerçek yeni rol grantor'ı henüz ölçülmedi. Farklı provider sonucu görülürse beklenen değer otomatik değiştirilmez; transaction rollback ve yeniden inceleme gerekir. Yerel test aynı mekanizmayı bootstrap=fixture_admin ile doğrular; bu provider hook kabulü değildir.

## Güncel bağımsız preflight — eski snapshot tekrar kullanılmadı

| Kanıt |24 Ekim güncel sonuç |
| --- | --- |
| Provider GET |14:41:09.564–10.208Z; project/branch/branch-endpoints3/3 HTTP200; sabit ad/ID/project/host/endpoint eşleşmesi |
| Source snapshot |14:41:11.841Z; TLS doğrulamalı READ ONLY/REPEATABLE READ, actor=session actor=neondb_owner, PG18.6 |
| Kaynak |40 tablo/26 FORCE RLS;001–015+resolved008; bütün schema/security/cluster/history alanları eski sözleşmeyle eşit |
| Current pre fingerprint |`7794ab78306b3e97b19400abb390fc5c5a9f8f560fd97cd61c1cf9e87c3f87eb` |
|494 grantor |Expected494/matched494/missing0/unexpected0; ham hash `378e182781ee9cb740824ce50fc4b58de1175d629e1160478388272cda8d938a`; accepted=false/enrolled=false |
| Ek authority snapshot |14:42:13.355Z; CREATEROLE=true/BYPASSRLS=true/SUPERUSER=false;40/40 SELECT grant authority; schema USAGE ve source CONNECT grant authority=true |
| Password NULL doğrulama yetkisi |pg_authid SELECT ve rolpassword column SELECT=true; değer/parola okunmadı; gelecekte yalnız `IS NULL` boolean kontrolü yapılacak |
| Rol yokluğu |pusula_backup yok; var olan rolü güncelleme gerekmiyor |
| Backend yönetim kapasitesi |pg_signal_backend üyeliği=true; bu katalog kanıtıdır, henüz olmayan backup rolünün backend'ini gerçekten kapatma testi değildir |
| Eşzamanlılık ölçümü |Kaynakta başka client session/ilgili bekleyen veya tutulan kilit görülmedi;14:42:13Z anlık ölçüm. Bakım penceresi/fence veya gelecekteki DDL yokluğu garantisi değildir |
| Cross-DB |neondb/postgres/template1 yeni katalog transaction'ları14:42:15.126/18.335/21.150Z; rol/üyelik/PUBLIC envanteri aynı |
| Definition pinleri |14:42:24.416Z; iki view/dört routine hash'i ve pg_stat_statements1.12, önceki risk-managed pinleriyle eşit; provider routine çağrılmadı |

Preflight script'inin kendi eski OAuth'u expired olduğu için provider alanı NEEDS_EVIDENCE kalır; aynı görevde mevcut User ortam API key'i yalnız bellekte explicit GET için kullanıldı ve current mapping ayrıca doğrulandı. OAuth yenilenmedi, raporu PASS'a çevirmek için credential dosyası değiştirilmedi. Key veya Authorization header kaydedilmedi.

494 eşleşmesi provider risklerinin accepted=true olduğu anlamına gelmez. NOLOGIN delta onayı eski hakları değiştirmemeyi ve validator beklentisini kapsar; gerçek backup hesabının kullanımına ilişkin eski PUBLIC/DDL/ACL güvenlik kabulünün yerine geçmez.

## Cross-DB değişmeyen artık riskler ve exact pinler

postgres PUBLIC SELECT: `public.pg_stat_statements`, `public.pg_stat_statements_info`. PUBLIC EXECUTE: `public.pg_stat_statements(boolean)`, `public.pg_stat_statements_info()`, `public.health_check_write_succeeds()`, `public.get_compute_primary_memory_bytes()`. Owner/grantor cloud_admin; rutinler INVOKER. Kaynak/diğer DB PUBLIC CONNECT/TEMP, sistem/large-object çağrıları korunur; bunların backup rolü için kaldırıldığı iddia edilmez.

| Nesne | Definition SHA-256 |
| --- | --- |
| public.pg_stat_statements view |`a7d302f946532331aba5555ba48b125d4aa4fb08b36a2deabf851424b09a8804` |
| public.pg_stat_statements_info view |`c8c7ea423e30064b1d95b0c3be96f3ab6349825885ae7518cdef0089ae48836d` |
| public.pg_stat_statements(boolean), C/1.12 |`2244205b20fed9bfb599420ec6968be92a95dbe795bf7879e7d7f4817da23869` |
| public.pg_stat_statements_info(), C/1.12 |`043eb974c4d96e4a5f1487346983acf7721c1bf8847b2271a42f3cfaa864ff33` |
| public.health_check_write_succeeds(), PL/pgSQL |`740eacee62e44cb5a19012a8738761e86479fc99d5ce19100cbf4ce10ba5d70d` |
| public.get_compute_primary_memory_bytes(), PL/pgSQL |`dc47998e1bbb6500f92acf9c774e84936d0d55683131c601ef5ab0d4bbca1275` |

Health gövdesi provider health tablosuna upsert yapar; memory gövdesi koşullu provider tablo okuması/hatalarda NULL yapar. Exact gövde bilinmesi yeni rolün actual izinlerini kanıtlamaz; C SQL tanımı binary bütün etkilerini ispatlamaz. Bunlar gerçek export öncesi ayrı kapılardır. Dormant NOLOGIN/password NULL/connlimit0 ve backup'a hiçbir üst rol/SET yolu verilmemesi nedeniyle bu paket hesabı kullanıma açmaz.

## Yerel kanıt ve neden bu paket yalnız DDL onayına hazır

Runbook mutation bloğu repo dosyasından çıkarılarak, yalnız DB adı yeni fixture DB'sine eşlenmiş şekilde gerçek PG18.6 **non-superuser** CREATEROLE+BYPASSRLS aktöründe çalıştırıldı. Bu aktöre fixture provisioning'i kaynak grant option verir; schema grantor/owner ilişkisi Neon'la aynı değildir ve provider kanıtı sayılmaz. Flags, NULL parola,40 SELECT listesi, üç setting, ownership0 ve creator ADMIN yönü/bootstrap grantor kontrol edilir. Yanlış hedef, busy advisory lock, normal rollback, geç22012, duplicate42710 ve eksik authority42501/01007 negatifleri; full eski rol/ACL snapshot rollback eşitliği test edildi. Exact source unchanged-state/postflight SELECT'leri ve A gate SQL'si de yerelde çalıştırılır. Cleanup planı ayrıca test edilir. [Nihai sonuçlar](../docs/validation/PUSULA_BACKUP_ROLE_PREAPPLY_VERIFICATION.md).

NOLOGIN kurulumu için gerekli güncel actor/grant authority ve sınırlandırılmış atomic delta hazırdır. Bilinmeyen gerçek CREATE provider davranışı COMMIT öncesi exact post oracle'ı ile fail-closed tutulur. Gerçek onay, uygulayıcı/doğrulayıcı, maintenance dışlaması ve yeniden alınmış fingerprint olmadan hiçbir execution başlamaz. Bu koşullar hazır belgeyi otomatik deploy veya sıfır-risk garantisi yapmaz.

## Yaşam döngüsü ve sonraki ayrı kapılar

- Gerçek owner'ın pg_signal_backend üyeliği var; NOSUPERUSER backup backend'lerini kapatma için standart PG kapasitesi destekleniyor. Gerçek rol/oturum olmadığından live kill/old-credential rejection/session0 testi yapılmadı. Bu NOLOGIN paketinin commit kararı backend kill testi değildir.
- VALID UNTIL yalnız parola giriş süresidir; mevcut session'ı bitirmez. Local lifecycle worker crash/timeout için parent gözetmen ve ayrı verifier ile geçti; supervisor process/host crash veya yönetici bağlantı kaybında gerçek dış gözetmen kabulü yok. Gelecekte LOGIN/credential/supervisor kurulumu ayrı onay ve test ister.
- TEMP/kendi kalıcı large-object, kaynak tüketimi, bütün tenant/Auth/MFA okuması ve cross-DB metadata riskleri bu kurulumla çözülmez. RISK_MANAGED_POLICY_BLOCKED/BACKUP_REMOTE_BLOCKED, bağımsız key/offsite/restore ve ROLE_DELTA_UNRESOLVED açık kalır.
- Rol kurulduğunda M016'nın eski pre fingerprint'i doğal olarak değişir. Eski canonical SQL/checksum veya tarihsel pre otomatik güncellenmez; yeni backup delta'sının migration pre sözleşmesine alınması ayrı gözden geçirme ister. applyEnabled=false/postFingerprint=null ve diğer guard'lar aynen kalır.

Uygulanabilir sonraki işlem, **yalnız bu NOLOGIN42-grant/creator delta'sı için** hedef/SQL/fingerprint/maintenance/rollback kapsamlı ayrı açık onayın değerlendirilmesidir. Onay sonrası da önce fresh preflight, sonra kısa transaction + ayrı validator; başarılı COMMIT sonrası bağımsız READ ONLY postflight. LOGIN veya veri export'u sonraki ayrı görevdir.

Migration016 SHA `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`;017 SHA `9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`. SQL001–017, risk-managed kodu, bütün kullanıcı dosyaları ve `.env.local` korunur. Gerçek rol/ACL/PUBLIC değişikliği, LOGIN/credential, dump/R2/restore/migration/production/recovery/test müdahalesi ve Git commit/push/merge yoktur.
