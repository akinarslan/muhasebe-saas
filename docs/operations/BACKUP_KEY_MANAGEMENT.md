# Backup anahtar yönetimi — E2.3

18.10.2026. Üretim/saklama/rotasyon araçları hazır; **gerçek kalıcı anahtar ve kurtarma kopyaları henüz oluşturulmadı**. `.env.local` değiştirilmedi. Neon Free/R2 ve mevcut Strict/Managed güvenlik kapıları korunur. [Gerçek yerel restore kanıtı](../validation/SPRINT_E23_VERIFICATION.md).

## Anahtar ve kayıt biçimi

Veri anahtarı `crypto.randomBytes(32)` ile 256 bit; KEY_ID `key-<randomUUID>` biçiminde benzersizdir. KEY_ID sır değildir; anahtardan türetilmez. Eski canonical base64 32-byte BACKUP_ENCRYPTION_KEY akışı desteklenir; format/uzunluk ve KEY_ID doğrulaması korunur. [Node24 crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html).

Yeni önerilen saklama modu **encrypted-vault-v1**: raw veri anahtarı diske yazılmadan passphrase ile şifreli `pusula-key-vault-v1` zarfına alınır. scrypt N32768/r8/p1, 32-byte salt, 12-byte IV, AES-256-GCM kullanılır; biçim/KEY_ID/KDF/salt/IV AAD ile korunur. KDF parametreleri dosyadan serbestçe seçilemez; JSON şeması sabittir. Zarf ciphertext'i 32 byte anahtardır; key ID yanlış bağlanırsa doğrulama reddeder. Veri arşivi AES-GCM v1 formatı değiştirilmedi.

Passphrase 20–1024 byte sınırında olmalıdır; uzunluk kontrolü entropi garantisi değildir. Tercih, parola yöneticisinin ürettiği en az 32 rastgele ASCII karakterdir; tahmin edilebilir cümle kullanmayın. Passphrase arşiv anahtarının kendisi değildir. Hem zarf hem passphrase kurtarılabilir olmalıdır. Bu yerel çözüm KMS/HSM veya FIPS sertifikasyonu değildir; ücretli servis açılmaz.

## Gerçek üretim — yalnız ayrı onaydan sonra

**Aşağıdaki komut bu sprintte onaylı biçimde çalıştırılmadı; gerçek anahtar üretme talimatı/onayı değildir.** Operatör önce saklama konumları ve iki kurtarma kopyası planını onaylatır:

```powershell
npm.cmd run backup:key:generate -- --approve-key-generation --confirm-recovery-plan
```

TTY'de passphrase iki kez gizli girilir; echo/clipboard/komut argümanı veya secret değeri taşıyan env kullanılmaz. Noninteractive kullanımda yetkili launcher, passphrase byte'larını inherited pipe FD3–99 üzerinden EOF ile gönderir; BACKUP_KEY_PASSPHRASE_FD yalnız descriptor numarasıdır. Stdio0–2/boş/çok kısa/çok uzun girdi reddedilir. Bu launcher/secret manager kurulumu ayrıca doğrulanmalıdır; Windows etkileşimli TTY/gerçek secret manager kabulü bu sprintte yapılmadı.

Komut onay bayrakları olmadan anahtar üretmeden KEY_GENERATION_APPROVAL_REQUIRED ile durur. Başarıda yalnız durum/KEY_ID ve `activeKeyChanged=false`, `recoveryCopiesVerified=false` raporlanır. İkinci bayrak, kopyaların fiziksel olarak var/okunabilir olduğunu iddia etmez. `.env.local`, aktif KEY_ID veya önceki anahtarlar otomatik değiştirilmez.

Şifreli zarf yalnız Git dışı `.data/backup-keys/<KEY_ID>.json` altında saklanır. Yol/symlink kontrolü; klasörde operatör+SYSTEM Windows ACL (Unix0700), exclusive wx/0600 yazımı vardır. Aynı ID üzerine yazılmaz. Anahtar veya passphrase dosya adına, manifest/R2 metadata'sına, normal UI/API'ye ya da stdout/stderr'e yazılmaz. `.data` web dağıtım trace'lerinden de dışlıdır. .gitignore ve dağıtım dışlaması korunmalı; `git add -f` kullanılmamalıdır.

BackupKey/KeyRing normal JSON ve inspect çıktısında redacted gösterir. Sırlar callback içinde yalnız kripto işlemleri için Buffer olarak açılır; dispose sonunda Buffer sıfırlanır. CLI sakladığı anahtar/passphrase buffer'larını sonunda sıfırlar. Node/JS/OS bellek kopyaları, legacy env string'leri, pagefile ve yetkili operatörün kasıtlı debug çıktısı üzerinde mutlak DLP/zeroization garantisi yoktur; debugger/core dump/terminal transcript kapalı, operatör host'u korunmuş olmalıdır.

## İki ayrı güvenli kurtarma kopyası

Yerel operasyon zarfı **kurtarma kopyası sayılmaz**. Gerçek anahtar onayından sonra en az:

1. **C1:** Kurumsal şifreli parola yöneticisi/secret manager içinde KEY_ID ve şifreli zarf attachment'ı, gerekli unlock bilgisi ve yetkili operatör prosedürü. Erişim yalnız isimlendirilmiş operatörlerde; kişisel paylaşım, uygulama runtime secret deposu ve GitHub secret'ı kurtarma deposu değildir.
2. **C2:** Ayrı fiziksel konumda korunan, tercihen donanımsal şifreli offline ortamda aynı anahtarın şifreli zarfı. Unlock/recovery materyali ayrı kontrollü kasada veya korunan ikinci mekanizmada tutulmalı; parola yöneticisi/aynı makine kaybında da erişilebilir olmalı. USB dosyasıyla aynı açık metin `.txt` parolası uygun değildir.

R2'de yalnız şifreli veri arşivi ve authenticated manifest bulunur; key zarfı veya passphrase bulunmaz. GitHub, web/API, e-posta, sohbet, normal loglar ve açık bulut klasörü anahtar/kurtarma materyali almaz. Birbirinin salt iki dosya kopyası, aynı diskte veya aynı hesaptaki iki klasör, ayrı kurtarma konumu kanıtı değildir.

Envanter yalnız KEY_ID, oluşturma tarihi, yetkili erişim grubu, C1/C2 konum etiketi ve son okuma tatbikatı tarihini içerir; key/passphrase/fingerprint yazılmaz. Erişim değişimleri, offboarding ve kayıp cihaz için rotasyon kararı kaydedilir. Bu sprintte gerçek envanter/iki kopya oluşturulmadı.

## Okunabilirlik ve kurtarma kontrolü

Yetkili operatör kontrollü özel oturumda C1 ve C2 zarfını ve unlock bilgisini ayrı ayrı açar. `verifyRecoveryCopies` API'si her zarfı doğrular, KEY_ID ve anahtar byte'larını timingSafeEqual ile yalnız RAM'de karşılaştırır, iki geçici BackupKey'i kapatır. Çıktı yalnız KEY_ID/readableCopies=2/physicalSeparationVerified=false içerir. Zarf kopyalarının farklı şifreyle sarılması desteklenir. Fiziksel ayrılık ve operatör erişim yetkisi yazılımla varsayılmaz; gerçek operatör kontrolü gerekir. Bu sprint testi tamamen RAM'deki hayalî zarflarla yapıldı.

Sonra kontrollü canary/izole fixture arşivini kayıtlı KEY_ID ile doğrulama/şifre çözme tatbikatı yapılır; anahtar gösterilmez. Gerçek backup'ın private scratch dışında çözülmesine veya gerçek DB'ye restore'a bu kontrol izin vermez. Gerçek kurtarma kopyalarının okuma tatbikatı ayrıca onaylanmalı; test kopyası üretim kopyası diye sunulmamalıdır.

## CLI ile anahtar seçimi ve rotasyon

Gelecekte onaydan sonra operatör ortamında BACKUP_KEY_STORAGE=encrypted-vault-v1 ve BACKUP_KEY_ID kayıtlı ID'ye seçilir. BACKUP_KEY_PASSPHRASE_FD veya gizli TTY girişiyle yerel zarf açılır. Eski env modu yeni storage seçilmedikçe korunur; iki mod arasında sessiz fallback yoktur. Vault dosyası bulunmaz/bozuksa komut güvenli kodla durur; env'deki başka anahtara düşmez.

Rotasyon sırası:

1. Ayrı onayla yeni random anahtar ve yeni KEY_ID üret; eskisini silme veya aynı ID'yi yeniden kullanma.
2. Yeni C1/C2 kopyalarını hazırla ve okunabilirliğini kontrollü doğrula. Yerel encrypted dosya tek başına yeterli değildir.
3. Operatör aktif BACKUP_KEY_ID'yi yeni ID'ye seçer; yalnız yeni arşivler yeni anahtarla üretilir. Komut kendiliğinden aktif env değiştirmez.
4. Eski arşivin manifest KEY_ID'sini kullanarak eski ID/zarf ile verify/decrypt çalıştır; eski arşivi yeni anahtarla açmaya çalışma. CLI seçiminde operatör eski ID'yi açıkça seçer; ID uyuşmazlığı KEY_ID_MISMATCH, yanlış key MANIFEST_AUTH_FAILED/DECRYPT_AUTH_FAILED ile durur.
5. Bütün eski arşivler saklandığı sürece eski key ve C1/C2 kopyaları kalır. Otomatik key silme/retirement komutu yoktur.

KeyRing API'si yeni aktif anahtara geçerken önceki ID'leri korur. Aynı ID ekleme KEY_ID_ALREADY_EXISTS, eksik ID BACKUP_KEY_NOT_FOUND, açılması başarısız zarf KEY_UNWRAP_FAILED, imha edilmiş bellek KEY_DISPOSED ile reddedilir. Testler yeni/eskisiyle doğru arşivi açmayı ve çapraz yanlış key reddini kapsar.

Şüpheli key sızıntısında yeni ID yalnız geleceği korur; eski arşiv/veri sızıntısı geri alınamaz. Eski arşivleri yeni key'e taşıma ayrı kontrollü decrypt/re-encrypt ve doğrulama işi/onayı gerektirir; manifest KEY_ID alanı düzenlenmez. Vault passphrase değişimi de ayrı yeniden-sarma/kopya/okuma tatbikatıdır; dosya üzerine sessiz yazılmaz.

## Kayıp anahtar prosedürü

Manifestten KEY_ID belirlenir, operasyon durdurulur; doğru C1, sonra C2 kaydıyla özel ortamda zarf/unlock kurtarılır. Kaydın ID/şema/tag doğrulaması geçmeden anahtar kullanılmaz. Onaylı encrypted zarf aynı güvenli local vault yoluna, var olan dosyanın üzerine yazmadan alınır; verify/canary ve izinli fixture restore ile test edilir. Yeni anahtar üretip eski KEY_ID'yi vermek kurtarma değildir.

Key'in bütün kopyaları veya zarfın bütün unlock materyali kayıpsa AES-GCM yedeği manifest/hash/R2/Neon parolasıyla kurtarılamaz. Hata güvenli raporlanır; sahte başarı/fallback/plaintext export yapılmaz. O sırada mevcut Neon provider restore imkanları ayrıca değerlendirilir; bağımsız şifreli arşivin anahtarının yerini tutmaz.

## Üretim önkoşulları

Gerçek anahtar onayı, iki gerçek kurtarma kopyası ve okunabilirlik tatbikatı açık. Neon backup rolü/BYPASSRLS, PUBLIC TEMP/CONNECT, builtin large object sahiplik riski ve diğer DB nesne izinleri çözülmedi. Managed remote/source/upload kapıları ve Strict kontrolleri değişmedi. E3 otomasyon/retention/alarm; E4 farklı hedef/rol kurulumu/Auth session invalidasyonu/operatör kurtarma tatbikatı ayrıca gerekir. Yerel gerçek restore başarısı Neon Free/R2 production kabulü değildir.
