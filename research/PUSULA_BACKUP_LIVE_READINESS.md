# PUSULA — Gerçek kaynak backup teknik hazırlığı

23 Ekim 2026 · ZY Reklam / 29 Ekim iç kullanım hedefi.
Dal `feat/pusula-v030-neon-cloud`; HEAD `edc03121737051d1eb180e621ccd91acfcc92743`.

**Sonuç: BACKUP_LOCAL_READY. Gerçek kaynak backup/offsite/restore ve canlı kullanım: BLOCKED.** Mevcut motorun sürüm, geçmiş, fonksiyon ve backup rolü kabulü yerelde düzeltildi; yeni PG18.6 fixture'larında export → mevcut şifreleme → ayrı boş yerel veritabanına restore zinciri geçti. Bu sonuç gerçek Neon verisini dışa aktarma veya canlı korumaları kaldırma yetkisi değildir.

`PROVIDER_REAUTH_PASS` esas alındı. Proje/development branch/endpoint yeniden sorgulanmadı; genel preflight veya yeni yol haritası oluşturulmadı. Bu görevde gerçek Neon API/SQL çağrısı, rol/ACL değişikliği, veri export'u, R2 upload, gerçek restore/snapshot ve Git commit/push yoktur.

## Somut teknik düzeltmeler

| Eski engel | Tamamlanan düzeltme | Kanıt |
| --- | --- | --- |
| 35/21 allowlist bütün sürümler için kullanılıyordu | Açık seçilen `pre016`, `post016`, `post017` kaynak sözleşmeleri; sırasıyla **40/26, 47/33, 56/42**. Eski varsayılan35/21 korunur; gözlenen tablo sayısına göre otomatik profil öğrenilmez. | Üç yeni kaynak profilinin export/restore'u ve ayrıca eski35/21 regresyonu PASS |
| Yereldeki17 migration, kaynak sürümünden bağımsız bekleniyordu | Profil başarılı geçmişi15/16/17 ile sınırlar. Varsayılan35/21 yolunun kendi13 migration'ı doğrulanır. Eksik/çift/başarısız/bilinmeyen geçmiş reddedilir. | Profil negatifleri ve gerçek fixture geçmişleri |
| Resolved008 normal başarı veya hata sanılıyordu | Mevcut `migration-checksum.ts` ortak kuralları kullanılır: yalnız bilinen rollback008 hash'i en çok bir kez, aynı008'in başarılı kaydı ayrıca zorunlu. Beş açık tarihsel checksum çifti korunur; genel newline normalizasyonu yoktur. | Her profilde bir bilinen rolled-back008;15/16/17 başarı +1 rollback; checksum artifact10 PASS |
| Aynı migration adındaki iki008 satırı hash sırasını belirsiz bırakıyordu | Profil schema kimliği ad/checksum/başarı/rollback ayrımını deterministik sıralayarak hesaplanır. Gerçek kayıtlar ve checksum'lar değiştirilmez. | Ters sırada aynı kimlik unit kontrolü; son56/42 şifreli manifest/restore PASS |
| Beş eski invoker function pini modern şemayı reddediyordu | Checksum ile korunan SQL kaynaklarından tam function sözleşmesi; source body, signature, return type, language, SECURITY DEFINER, search_path ve owner karşılaştırılır.017 rename'leri ve K4'ün yedi literal body değişikliği kaynak üzerinden yorumlanır; hedefin ilk post çıktısından öğrenilmez. | Pre01610 / post01616 / post01732 fonksiyonun gerçek PG18.6 kabulü; body/owner/search_path/EXECUTE/return-name negatifleri |
| SupplierUnit tipi eski güvenlik listesine uymuyordu | SupplierUnit yalnız açık modern profilde tanınır; bütün enum adları ve etiket sıraları pinned SQL ile tam karşılaştırılır. Legacy tipe izin listesi genişletilmedi. | Gerçek40/26,47/33,56/42 kaynak kabulü |
| Efektif erişim, doğrudan ACL ve grantor farklarını tek başına ayırmıyordu | Backup login için tam SELECT/table, USAGE/public schema, CONNECT/source DB doğrudan grantor sözleşmesi. Ek DML, grant-option, column/function/default grant reddedilir. Tam function ACL'de owner/grantor/PUBLIC/auth/runtime/executor envanteri bağımsız beklenir. | Gerçek yerel kötü üyelik, UPDATE, grant-option, schema CREATE, function EXECUTE enjeksiyonları reddedildi; grantor/PUBLIC/auth drift unit negatifleri |
| Executor üzerinden yetki kazanımı veya creator kalıntısı | Kaynak fazına göre stock/finance executor özellikleri; creator yokluğu, üyelik yokluğu ve schema CREATE=false ayrıca zorunlu. | Modern profillerin gerçek kaynak kabulü ve korunmuş canonical017 regresyonu |
| Restore katalog karşılaştırması owner/default/grantor kapsamını tam göstermiyordu | Function owner/definer/config ve default grant kayıtları eklendi; function ACL grantor'ı da karşılaştırılır. Tüm tabloların sayım/içerik hash'i, RLS/policy/index/constraint/trigger/catalog korunur. | Ayrı yeni boş hedeflerde tam tablo ve katalog eşitliği |
| CHECK metninin dump/reparse farkı yanlış drift üretiyordu | Mevcut K5 yaklaşımı yeniden kullanıldı: aynı PG18 parser ve aynı kolon tipleriyle yalnız CHECK round-trip. İfade silme veya metinle gevşetme yoktur. Diğer constraint'ler aynen karşılaştırılır. | İki zararsız deparse farkı parser ile açıklandı; katalog eşitliği geçti |
| Boş finans tabloları yetersiz veri kanıtıydı | İki tenant için dokuz finans tablosu dolu:10 hesap,6 journal,14 posting,4 intent,2 access,4 operation,2 allocation,4 fon hareketi,2 gider. |56 tablo içerik eşitliği; journal/fon/gider mutabakatı ve gerçek append-only retleri PASS |

Yeni backup motoru yapılmadı. Mevcut custom-format `pg_dump`, snapshot, AES-256-GCM/HMAC manifest, key rotation/decrypt ve `pg_restore` araçları kullanıldı. Yeni dosyalar kaynak sözleşmesi ve izole fixture yardımcılarıdır.

## Yerel kabulün sınırı ve korunmuş kapılar

Modern profiller **yalnız loopback fixture** için çağrılabilir; gerçek hedefte `BACKUP_RELEASE_REMOTE_NOT_APPROVED` bağlantı açılmadan reddeder. Mevcut `MANAGED_REMOTE_OBJECT_AUDIT_REQUIRED`, `MANAGED_REMOTE_UPLOAD_NOT_APPROVED`, `ACCOUNTING_CLOUD_REVIEW_REQUIRED` ve `STOCK_MANAGED_APPLY_DISABLED` korunur. Cloud apply false/null değerleri değiştirilmedi.

Gerçek CLI'nin varsayılan35/21 kaynak profili otomatik büyütülmedi. Kullanıcı bir profil bayrağı ekleyerek gerçek export kapısını aşamaz. Canlı profil seçiminin `cli.ts`/`inspectSource` yoluna taşınması ve source creator eşlemesinin `neondb_owner` olarak bağlanması, aşağıdaki gerçek rol/ACL kanıtı ve açık hedef bazlı yetki olmadan etkinleştirilmez. Yerel yeni profilde creator `fixture_admin` sabittir; kullanıcıdan veya ölçümden öğrenilmez.

Fixture restore hedefleri **aynı yeni yerel cluster içinde ayrı boş veritabanlarıdır**. Bu, bağımsız makine/offsite felaket kurtarma veya global rol geri yükleme kanıtı değildir. Roller önceden aynı fixture cluster'ında vardır; `pg_dump` cluster rollerini yeniden kurmaz. Sentetik anahtarlar gerçek kaynak anahtarı veya bağımsız custody sayılmaz. Yeni gerçek anahtar üretilmedi ve gerçek R2 işlemi yapılmadı.

## 23 Ekim kaynak ve provider ACL kanıtının kullanımı

Kaynak snapshot zamanı **2026-10-23T10:46:07.694Z**; bu görevde yeniden ölçülmedi. Gerçek kaynağın o andaki fazı **40 tablo/26 FORCE RLS,001–015 başarılı,016 pending**. Önceki494 grantor karşılaştırması494 eşleşme/0 eksik/0 beklenmeyen olarak korunur; `accepted=false`, provider review açık.

Yeni kaynak kontrollü function ACL beklentisi, bu kayıtlı snapshot'ın function alt kümesiyle **çevrimdışı** karşılaştırıldı: **21 beklenen /21 gözlenen, tam eşleşme**. Bu, yeni bir SQL ölçümü veya tüm provider ACL'lerinin onayı değildir. `cloud_admin → neon_superuser` default ACL'sindeki9 WITH GRANT OPTION ve diğer DB CONNECT/TEMP farkları önceki bulgu olarak kalır; otomatik baseline enrollment yapılmadı.

Snapshot'ta `pusula_backup` rolü yoktur. Owner'ın veya runtime'ın yetkileri bu login'in yetkisi kabul edilmez. BYPASSRLS ile tüm tenant/şirket verisini okuyabilen dar bir login'in provider tarafından desteklendiği, bu login'de hiçbir üyelik/ownership/DML/DDL veya function API yetkisi olmadığı henüz gerçek kaynakta kanıtlanmadı.

## Gerçek işlem için gereken somut onaylar

Ortak kaynak: **proje `icy-queen-44442204`, development branch `br-rough-darkness-ba6ow9zo`, endpoint `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech`, DB `pusula_development`**. Production, recovery ve `pusula_sprint_b_test` bu kapsamda değildir.

| Ayrı işlem/onay | Kesin hedef ve kapsam | Hâlâ eksik kabul / ilgili dosya |
| --- | --- | --- |
| **Provider backup rolü ve dar GRANT yetkisi** | Yalnız yukarıdaki development DB için `pusula_backup`; non-superuser, BYPASSRLS, NOCREATEROLE/NOCREATEDB/NOREPLICATION, üyelik/ownership yok. CONNECT, public USAGE ve seçili fazdaki bütün tablolara yalnız SELECT; grant-option/sequence write/function API EXECUTE yok. | Provider yöneticisi bu rol modelinin desteklendiğini doğrulamalı; BYPASSRLS bağımsız sağlanamıyorsa BLOCKED kalır. `neon_superuser` üyeliği, owner/runtime fallback veya RLS gevşetmesi yapılmaz. Gerçek rol/GRANT SQL'i bu görevde çalıştırılmadı. |
| **Katalog/cross-DB güvenlik kabulü** | Oluşturulacak backup login'in gerçek üyelik, grantor, PUBLIC TEMP/CONNECT ve diğer DB nesne yetkilerinin hedef bazlı incelenmesi | Aynı DB kataloğu diğer DB nesnelerini ispatlamaz. Mevcut `policy.ts` managed remote object kapısı açık kalır. Başka DB'lere deneme bağlantısı/SQL için de ayrıca açık kapsam gerekir; toplu PUBLIC REVOKE onayı varsayılmaz. |
| **Tam gerçek kaynak export onayı** | Migration016 öncesinde açıkça **pre01640/26 +15 başarı + resolved008**; tüm tenant/şirketler ve Auth/MFA/session dahil tam veri. Salt okunur snapshot, özel yerel scratch ve mevcut şifreleme motoru. | Rol/ACL ve anahtar kabulü sonrası `cli.ts`/`postgres.ts` gerçek profil aktivasyonu ayrıca incelenmeli; TLS verify-full ve sabit hedef korunmalı. Bu rapor export veya sonraki016/017 migration yetkisi değildir. |
| **Gerçek anahtar custody/recovery onayı** | Mevcut `BackupKey`/encrypted-vault araçları, belirli BACKUP_KEY_ID; dump/ciphertext'ten bağımsız sorumlu ve saklama yeri; passphrase gizli TTY/FD yoluyla | Gerçek kaynak için aktif anahtar, bağımsız kopya ve tekrar elde etme kabulü yok. Aynı makinedeki fixture key ring'i kanıt sayılmaz. `.env.local` veya credential dosyası değiştirilmedi. |
| **R2 offsite saklama ve upload onayı** | Mevcut **`pusula-backups-development`** bucket'ında onaylanacak dar backup-ID prefix'i; yalnız şifreli arşiv ve doğrulanmış HMAC manifest; plaintext veya anahtar yüklenmez | Bucket account/endpoint, public-domain kapalı olma, dar token scope, retention/silme politikası ve bağımsız sorumlu kabulü eksik. Mevcut ayarların varlığı upload yetkisi değildir; `MANAGED_REMOTE_UPLOAD_NOT_APPROVED` kaldırılmadı. |
| **Gerçek restore onayı** | Kullanıcının ayrıca isimlendireceği, kaynak/production/recovery/test DB'lerinden ayrılmış **yeni boş hedef**; doğrulanmış ciphertext+bağımsız anahtar ile restore ve veri/şema/ACL/rol kabulü | Henüz gerçek ayrı hedef seçilmedi. Bu nedenle onay isteği şu anda çalıştırılabilir bir restore komutu değildir. Global roller/DB erişimi ayrıca kontrollü yeniden kurulum ve kabul ister. Var olan recovery branch'i hedef varsayılmaz. |
| **Recovery rol farkı incelemesi** | Önceki recovery'nin `token_roles / ROLE_DELTA_UNRESOLVED` bulgusu | Bulguyu kapatacak yetkili köken/rol/ACL kabulü yok; bu görev değiştirmedi ve tam recovery sertifikası vermedi. |

016 sonrası47/33 ve017 sonrası56/42 için export kapsamı, bağımsız post kabulünden sonra ilgili profille ayrıca bağlanmalıdır. Pre01640/26 yedeği, henüz uygulanmamış finans şemasını kapsıyormuş gibi gösterilmez.

## Gerçek test kanıtı ve teslim kapsamı

Nihai yerel profil matrix'i PASS; eski35/21 restore PASS; canonical017 yoluyla K1–K5 regresyonları PASS. Vitest **497/497**, TypeScript, ESLint, üretim build ve checksum artifact **10 kontrol** PASS. Ayrıntı ve fixture kimlikleri [doğrulama raporunda](../docs/validation/PUSULA_BACKUP_LIVE_VERIFICATION.md). Başarısız ilk denemeler gizlenmedi; sonuçlar yalnız başarılı nihai fixture'lara dayanır.

Bu görevin kesin kapsamı **12 dosya**:

- `scripts/backup/postgres.ts`
- `scripts/backup/restore-fixture.ts`
- `scripts/backup/verify-local.ts`
- `scripts/backup/source-profile.ts`
- `scripts/backup/source-profile-pins.json`
- `scripts/backup/profile-fixture.ts`
- `scripts/backup/finance-data-fixture.ts`
- `scripts/backup/restore-checks.ts`
- `tests/backup-source.test.ts`
- `tests/backup-release-profile.test.ts`
- `research/PUSULA_BACKUP_LIVE_READINESS.md`
- `docs/validation/PUSULA_BACKUP_LIVE_VERIFICATION.md`

Başlangıçtaki kullanıcı değişiklikleri ve001–017 SQL toplam55 yol üzerinden hash ile korundu. Önceden kirli kaynaklardan yalnız bu görevin kapsamındaki `scripts/backup/postgres.ts` ilerletildi; diğerleri değişmedi. M017/M016 kodları, eski raporlar, LAST_REPORT geçmişi ve manifest aynen korunur.016 SHA-256 **`27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`**;017 SHA-256 **`9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`**. NEON_API_KEY değeri yazdırılmadı veya dosyaya kaydedilmedi. `.data`, dump/key/fixture/log/build çıktıları teslim kapsamı dışındadır. Git index/HEAD değiştirilmedi.

## 29 Ekim takvim etkisi

Yerel35/21 kapsam ve resolved008 engeli artık gerçek kaynak kabulüne geçmeden önce yeni bir backup motoru gerektirmiyor; sürüm sözleşmeleri ve üç fazın restore davranışı yerelde hazır. Kalan kritik bekleme **provider'ın dar tam-okuma rolünü desteklemesi, hedef bazlı gerçek export yetkisi ve bağımsız anahtar/offsite/restore kabulüdür**. Bunlar bugün sorumluları ve hedefleriyle yetkilendirilmezse altı günlük takvim güvenceye alınamaz. Gerçek offsite/restore kanıtı tamamlanmadan29 Ekim muhasebe kullanımına GO_LIVE_PASS verilmez.
