# E2 operatör CLI'si

18.10.2026 E2.2d: [politika/risk değerlendirmesi](../../research/PUSULA_V030_SPRINT_E22D_RISK_ASSESSMENT.md). Varsayılan strict-v1; Strict artık template dahil diğer connectable DB'lerde CONNECT'i reddeder. Managed aday yalnız yerel fixture'da denenebilir; gerçek Neon kaynak ve Managed upload kapıları kapalıdır. PUBLIC TEMP/CONNECT değişmedi; bunların dışında builtin large object oluşturma/sahiplik yeteneği de fixture'da kanıtlandı. Aşağıdaki eski kabul kapıları tarihsel bağlamıyla okunmalıdır.

## Güvenlik politikası seçimi

BACKUP_SECURITY_POLICY tanımsızsa strict-v1 kullanılır. managed-neon-candidate-v1 değeri **ayrıca** `--select-managed-neon-candidate` ister; bilinmeyen değer veya uyuşmayan seçim reddedilir. Bu iki seçim gerçek Neon için risk kabulü/onay değildir: remote source MANAGED_REMOTE_OBJECT_AUDIT_REQUIRED ile, Managed upload MANAGED_REMOTE_UPLOAD_NOT_APPROVED ile engellidir. Bu sprint gerçek env'e Managed policy yazılmadı. Production host/DB/rol istisnası yoktur; NODE_ENV=production reddedilir. Genel skipSecurityChecks seçeneği yoktur.

Gerçek yerel risk koşusu: `npm run backup:test:local -- --approve-local-fixture --managed-neon-fixture`. Strict regresyonu: `npm run backup:test:local -- --approve-local-fixture`. Bu komutlar yalnız açık yerel fixture onayıyla kullanılmalı; yeni loopback/SCRAM cluster ve yalnız hayalî veriler oluşturur. Managed test kaynakta PUBLIC TEMP/CONNECT'i korur; Strict testi yalnız kendi yeni cluster'ında bunları kapatır. Neon/test DB/production veya R2'ye bağlanmaz.

Yeni manifest securityPolicy alanını HMAC/AAD ile korur. Eski v1 alanı olmayan manifest yeni okuyucuda doğrulanır ve legacy-unrecorded raporlanır; yeniden Strict diye etiketlenmez. Operatör seçimi selectedSecurityPolicy, arşiv politikası securityPolicy olarak ayrı raporlanır. Yeni arşivler için bu alanı tanıyan verify/restore aracı kullanılmalıdır.

DB raporu CONNECT/PUBLIC/direkt grant ve nesne denetimini ayırır. Başka gerçek DB'lere bağlanmadan bütün tablo/kolon/fonksiyon yetkileri kanıtlanamaz; UNKNOWN durumuna onay verilmiş sayılmaz. Yerel fixture denetimi bütün gelecekteki PUBLIC/builtin yan etkilerinin sandbox ispatı değildir. TEMP ve lo_create nedeniyle credential sahibinin hiç nesne oluşturamayacağı söylenemez; mevcut ownership'i reddetmek gelecekteki yaratmayı sunucuda engellemez.

Web build output trace'leri `.data/**/*` dosyalarını dışlar; fixture/dump/anahtar/araçları deployment'a dahil etmeyin. Yerel runtime kur cache'i Git dışı deployment alanında yönetilir; operatör dosyaları web paketi olarak taşınmaz.

18.10.2026. Kod geliştirildi; E2.1b gerçek yerel fixture pg_dump/list/kripto testi 14/14 geçti. Gerçek development dump/upload yapılmadı. Restore/E3 otomasyon bu modülde bulunmaz. Normal uygulama API'si veya browser bu kodu import etmez.

[E2.2a güncel güvenlik hazırlığı](../validation/SPRINT_E22A_VERIFICATION.md): gerçek backup rolü henüz yok; dar SQL-created BYPASSRLS modelinin provider kabulü ayrıca doğrulanmalı. Resmî ISRG Root X1 yerel CA hazırlığı sonrası gerçek psql verify-full READ ONLY PASS. Preflight artık PUBLIC kaynaklı dahil efektif TEMP, bütün backup rol üyelikleri, sahiplik, column yazma ve incelenmemiş nesne/fonksiyonları reddeder. PUBLIC TEMP hâlâ mevcut; kaldırılması/diğer rollerin haklarının korunması ayrı onaylı iştir.

## Güvenli başlangıç

Node24 ve `npm ci` gerekir. Windows PostgreSQL18 istemcilerini [resmî Windows indirme sayfasından](https://www.postgresql.org/download/windows/) edinin; EDB installer'da Command Line Tools veya resmî sayfanın yönlendirdiği binary paket seçilebilir. Mevcut `data` klasörüne initdb/server kurulumu yapmayın. Bu görevde araç/servis kurulmadı. `BACKUP_PG_BIN` pg_dump, pg_restore ve psql dosyalarını içeren klasör olabilir; aksi halde PATH ve standart PG18 bin yolu kontrol edilir. Üç araç da18.x olmalı, kaynak18.x olmalı; daha eski istemci reddedilir. Yeni major desteği ayrıca incelenir.

Gerçek env değerleri Git dışı `.env.local`/operatör secret manager içindir. CLI `@next/env` ile yükler; mevcut dosyayı yazmaz. Node'un sistem CA deposu kullanılır, TLS doğrulaması kapatılmaz. `BACKUP_SOURCE_DATABASE_URL` sabit development endpoint/DB, `pusula_backup` rolü ve `sslmode=verify-full` ile direct bağlantıdır. Runtime/auth/owner ve pooled bağlantı kabul edilmez. `NODE_ENV=production` bütün komutları engeller.

Node sistem CA ayarı libpq için otomatik CA kurulumu değildir. pg_dump/psql için gerekiyorsa güvenilir CA PEM yolunu `BACKUP_PG_SSLROOTCERT` ile verin; `PGSSLMODE=verify-full` korunur. [Libpq TLS rehberi](https://www.postgresql.org/docs/18/libpq-ssl.html). Trust dosyası hazırlanmadan TLS'yi kapatmak çözüm değildir.

Bu makinede BACKUP_PG_SSLROOTCERT Git dışı `.data/certificates/isrg-root-x1.pem` dosyasının yerel mutlak yoludur. [Neon'un resmî CA kaynağı](https://neon.com/docs/connect/connect-securely) esas alınmıştır; sertifika geçerliliği ve parmak izi doğrulandı. Secret/CA dosyasını depoya eklemeyin. Yeni makine/runner'da güvenilir CA ayrı hazırlanmalıdır; bu env ayarı diğer makinelere taşınmaz.

```powershell
npm.cmd run backup:preflight
# Yalnız hesap sahibi panel incelemesini tamamladıktan sonra:
npm.cmd run backup:preflight -- --confirm-r2-security-reviewed
npm.cmd run backup:list
npm.cmd run backup:list -- --remote
npm.cmd run backup:verify -- <backup-uuid>
npm.cmd run backup:verify -- <backup-uuid> --remote
```

Preflight salt okunurdur, dump üretmez; kurulum eksikse exit1 + sabit hata kodu verir. Panel beyanı bayrağı API doğrulamasından farklı etiketlenir.18.10.2026 hesap sahibi public erişim kapalı/domain yok/token yalnız bucket incelemesini tamamladı; gerçek dump/upload onayı vermedi. Local list imzalı manifestleri doğrular, dosyayı doğruladığını iddia etmez. Remote list yalnız doğrulanmamış manifest aday anahtarlarını listeler; `verify --remote` indirerek hash/GCM doğrular. Eski anahtar sürümleri için doğru KEY_ID/key operatör ortamında seçilir; otomatik key lookup yok.

## Ayrı gerçek işlem onayı — bu teslimde ÇALIŞTIRILMADI

```powershell
npm.cmd run backup:create -- --approve-development-dump --confirm-r2-security-reviewed
npm.cmd run backup:upload -- <backup-uuid> --approve-r2-write --confirm-r2-security-reviewed
```

Bu bayraklar ayrı operatör onayının komut üzerindeki kanıtıdır; onay alınmadan kullanılmamalıdır. `create` upload yapmaz. `upload` yeni dump almaz; imzalı/şifreli arşivi doğruladıktan sonra yazar. `--confirm-r2-security-reviewed` Dashboard public kapalı/token yalnız bu bucket/Standard sınıf incelemesinin operatör beyanıdır, otomatik tespit değildir. İsteğe bağlı `CLOUDFLARE_API_TOKEN` salt okunur yönetim yetkisiyle managed/custom domain kontrollerine izin verir; S3 token kapsamını kanıtlamaz. Mevcut S3 tokenını genişletmek gerekmez.

Kaynak denetimi NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION ve doğrudan BYPASSRLS ister; neon_superuser üyeliğini, tablo yazma/ownership, schema/database CREATE ve sequence UPDATE/USAGE yetkisini reddeder. Tüm35 tablo ve belirlenmiş21 FORCE RLS tablo adı tek tek karşılaştırılır. Aktif migration adları/checksum'ları repodaki SQL dosyalarıyla eşleşmelidir. Ek şema/tablo veya migration değişiminde allowlist gözden geçirilmeden devam etmez.

E2.2a dedicated login için **hiç rol üyeliği olmamasını**, sahiplik ve TEMP yetkisinin bulunmamasını ister. Beş public fonksiyonun kimlik/tanım hash'i sabittir; SECURITY DEFINER/ek/eksik/değişmiş fonksiyon reddedilir. Yeni relation/type/extension/large object/event trigger kapsamı inceleme gerektirir. Fonksiyon migration değişikliklerinde hash'leri otomatik güncellemeyin; gövde/ACL ve etkiyi inceleyin. Yerel fixture runner yalnız kendi yeni DB'sinde TEMP'i kapatacak şekilde güncellendi; bu sprint tekrar dump çalıştırılmadı.

Kaynak bağlantı REPEATABLE READ READ ONLY ve `row_security=off` kullanır. Aynı transaction bütün tablolarda count yapar, migration/kapsam hash üretir ve snapshot export eder; `pg_dump -Fc --snapshot=...` bitene kadar bağlantı açık tutulur. Default row_security davranışı değiştirilmez, `--enable-row-security` kullanılmaz. `pg_restore --list` tam TABLE DATA listesini, policy/index/FK/trigger türlerini ve D6 child sealing trigger'larını doğrular. Bu kontroller restore edilmiş satır hash/ilişki testi yerine geçmez; E4 zorunludur.

## Yerel hayalî PostgreSQL fixture yolu

Önceden kurulmuş yalnız loopback `127.0.0.1`, `pusula_backup_fixture` DB, `pusula_fixture_backup` hesabı gerekir. Gerçek development/test DB adresi bu modda reddedilir. Ayrı fixture ortamı aynı migration/35 tablo/21 RLS yapısını ve yalnız hayalî tenant/Auth/finans kayıtlarını içermelidir. Rol aynı salt okunur BYPASSRLS denetiminden geçer. Yerel SSL kapalı bağlantıya yalnız bu kesin loopback hedefinde izin verilir. Bu DB/rol burada oluşturulmadı.

```powershell
# BACKUP_FIXTURE_DATABASE_URL operatörün ayrı yerel fixture bağlantısıdır.
# Test anahtarı yalnız geçici süreçte olmalı, gerçek key/env ezilmemeli.
npm.cmd run backup:create -- --fixture --approve-fixture-dump
```

Fixture manifesti `sourceEnvironment=fixture` taşır ve upload modülü bunu reddeder. `backup:test` Node/bellek içi S3 ve taklit PG bağlantısıyla çalışır; başarılı gerçek pg_dump veya restore testi diye sunulmaz.

## Gerçek yerel fixture testi

Windows üzerinde önceden doğrulanmış PostgreSQL 18.6 istemcileri `.data/tools/postgresql18-client`, taşınabilir sunucu ise `.data/tools/postgresql18-fixture-server/bin` altında hazır olmalıdır. Yeni yerel cluster oluşturma/başlatma için açık operatör onayıyla `npm run backup:test:local -- --approve-local-fixture` çalıştırılır. Komut `.env` yüklemez; Neon veya R2 kullanmaz. Yeni UUID dizini, loopback portu, SCRAM, geçici RAM anahtarı ve süreç kimliğiyle sınırlı kapanış kullanır. Test bittiğinde sentetik dosyalar ACL korumalı Git dışı dizinde kalır; kalıcı test anahtarı saklanmaz.

Bu test gerçek custom dump, TOC/nesne kapsamı, tüm tablo satır sayıları, E2 şifreleme ve negatif araç/kripto senaryolarını doğrular. Veritabanına restore etmez; Neon rol uygulanabilirliği, gerçek backup veya E4 kurtarma kabulü değildir. [Son sonuçlar](../validation/SPRINT_E21B_VERIFICATION.md).

## Format, anahtar ve yerel güvenlik

Node/OpenSSL AES-256-GCM kullanılır; kripto algoritması yeniden yazılmadı. V1 arşiv dosyası ciphertext'tir; IV/salt/tag ve metadata ayrı manifesttedir. Her yedekte32-byte rastgele salt ve12-byte rastgele IV; HKDF-SHA256 ile ayrı encryption ve manifest-MAC anahtarları. Metadata GCM AAD'ye, tüm manifest HMAC-SHA256'ya bağlıdır. Manifest strict şema, sabit format ve UUID/object-key ilişkisiyle doğrulanır. JSON anahtarları ASCII artan sırada kanonikleştirilir. SHA-256 ciphertext özeti + GCM tag + manifest MAC birlikte doğrulanır; sadece ETag'e güvenilmez.

`BACKUP_ENCRYPTION_KEY` canonical base64 biçiminde kriptografik rastgele32 byte; `BACKUP_KEY_ID` benzersiz sürüm etiketi (harf/rakam/_/-,64 karaktere kadar). Key ID anahtarın kendisi değildir. Anahtar bu çalışmada üretilmedi/yazılmadı. Onaydan sonra güvenli operatör ortamında `crypto.randomBytes(32)` veya güvenilir secret manager kullanarak üretin; stdout/sohbet/pano/log/Git/R2'ye düşürmeden secret manager veya erişimi kısıtlı dosyaya aktarın. Her sürümün en az iki kontrollü offline kurtarma kopyası ayrı lokasyonda saklanmalı. Rotasyonda yeni key+ID yeni yedeklere; eski key'ler ilgili arşiv ömrü boyunca tutulur. Key kaybında kurtarma mümkün değildir. Offline key kurtarma tatbikatı E4 kabulünün parçasıdır.

V1 tek GCM mesajı ve tek S3 PUT için **4 GiB** hard limitlidir (GCM/S3 üst sınırlarının altında). Multipart/chunk formatı uygulanmadı; limit aşımı başarı değildir. Şifreleme/hash/decrypt doğrulaması64 KiB stream chunk'larıyla yapılır; plaintext bütün olarak RAM'e alınmaz. Verify plaintext'i dosyaya yazmadan sink'e boşaltır. Create sırasında ham dump yalnız özel scratch içinde bulunur.

Çalışma alanı `.data/backups` Git dışıdır. Unix0700/0600, Windows mevcut açık ACL'leri resetleyip kalıtımı kaldıran yalnız operatör+SYSTEM ACL uygulanır. Tek `operation.lock` paralel create/upload/verify'i dışlar; crash sonrası stale lock otomatik silinmez. Operatör aktif iş olmadığını doğrulamalıdır. `finally` yalnız doğrulanmış tmp-* alt dizinini temizler. Süreç/OS çökmesinde otomatik cleanup garanti değildir; ACL korunan artıklar operatörce incelenmelidir. SSD'de güvenli fiziksel silme iddiası yoktur.

SDK single PUT `If-None-Match:*` ile üzerine yazmayı önler.412 gelirse mevcut nesne indirilip doğrulanır, uyumsuzsa işlem başarısızdır. Remote boyut/ID/hash metadata, tam indirme/SHA/GCM ve imzalı manifest readback tamamlanmadan `remote-verified` çıkmaz. Yarıda kalan archive yanında manifest yoksa tamamlanmış yedek sayılmaz. Silme API'si yok; başarısızlığın artık nesneleri otomatik temizlenmez. Aynı ID ile manuel retry kopya üretmez. Yeni create yeni UUID üretir; farklı komut çalıştırmalarının anlamsal dedup'u ve günlük idempotency E3 konusudur.

Log yalnız job ID/durum/zaman/boyut/UUID/versiyon/object-key/sabit hata kodu taşır. Child stderr/SQL/URL/credential veya ham müşteri verisi forward edilmez. PostgreSQL alt sürecine R2, auth ve encryption sırları aktarılmaz. Loglar operasyonel stdout'tur; kalıcı izleme/alarm/scheduler E3'te kurulacaktır.
