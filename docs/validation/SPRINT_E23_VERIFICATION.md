# Sprint E2.3 — anahtar yönetimi ve gerçek PostgreSQL restore

18.10.2026 · `feat/pusula-v030-neon-cloud` · başlangıç `6f7b211`.

## Sonuç

**Yerel sentetik kabul: 31/31 PASS, exit0. Gerçek pg_restore yeni boş DB'ye veri yükledi.** Bu sonuç sadece AES-GCM decrypt veya pg_restore --list değildir. Bütün35 tablo satır sayısı ve içerik hash'i, finans/Auth ilişkileri, RLS/ACL ve gerçek trigger/FK davranışı doğrulandı. Gerçek Neon/R2 production kabulü verilmedi.

Anahtar üretim/şifreli saklama/rotasyon kodu hazır. Gerçek kalıcı anahtar üretilmedi, .env.local yazılmadı, gerçek offline kopyalar oluşturulmadı. Test anahtarları yalnız RAM'de kriptografik rastgele üretildi ve sonunda sıfırlandı. Vault dosya testleri bile disk yerine bellek içi FS taklidi kullandı; gerçek key vault klasörü oluşturulmadı.

## Anahtar güvenliği

BackupKey 32-byte CSPRNG ve bağımsız UUID KEY_ID; canonical base64/ID doğrulaması, JSON/inspect redaksiyonu, dispose/use-after-dispose engeli. KeyRing yeni aktif ID'ye geçerken eski ID'leri korur; eksik veya aynı ID ile değiştirme reddedilir. Eski/yeni arşiv doğru key ile açıldı; çapraz yanlış key ve kayıp key reddedildi.

Yeni encrypted-vault-v1 adaptörü veri key'ini plaintext dosyaya yazmadan scrypt-N32768-r8-p1 + AES-256-GCM zarfına alır. Rastgele salt/IV, authenticated KEY_ID/biçim ve exclusive wx dosya yazımı; Git dışı sabit özel yol ve symlink/ACL sınırları vardır. Passphrase yalnız gizli TTY veya inherited FD3–99 içindir; secret argümanı/env değeri yoktur. Üretim komutu açık onay/recovery plan bayrakları olmadan key üretmeden durur; aktif KEY_ID/env'i otomatik değiştirmez. Bu sprint gerçek etkileşimli üretim/saklama çalıştırılmadı; doğrudan test anahtarları ve bellek içi adaptör kanıtı vardır.

verifyRecoveryCopies iki ayrı korumalı zarfı yalnız RAM'de açıp aynı ID/key'i taşıdığını kontrol eder; fiziksel ayrılık doğrulanmış sayılmaz. Gerçek C1 secret manager ve C2 offline kopyalarının operatör okuma tatbikatı hâlâ ayrıca onay bekler. [Tam anahtar ve kayıp/rotasyon runbook'u](../operations/BACKUP_KEY_MANAGEMENT.md).

Archive decrypt önce manifest/key/cipher hash/GCM doğrulamasını sink'e yapar. İkinci authenticated pass sadece ACL korumalı fixture dizininde exclusive yeni dosyaya yazar; hata olursa yalnız o çağrının oluşturduğu dosyayı siler. Fonksiyon başarı dönmeden pg_restore çağrılmaz. İkinci geçiş plaintext SHA/boyutu da ilk doğrulamayla karşılaştırılır. Anahtar/manifest/bozuk arşiv hatalarında restore aşamasına girilmedi.

## Gerçek test ortamı

Önceden doğrulanmış resmî EDB18.6 arşiv pin'i `e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2` kontrol edildi. postgres/initdb/pg_ctl/pg_dump/pg_restore/psql sürümleri **18.6**. Daha önce onaylanan EXE Authenticode NotSigned durumu değişmedi; imzalı gibi raporlanmadı. Yeni indirme/kurulum, Windows servisi veya sistem PATH değişikliği yok.

Yeni cluster yalnız 127.0.0.1:55432, SCRAM-SHA-256 ve rastgele geçici parolalarla çalıştı; trust/dış ağ yok. Klasör operatör/SYSTEM ACL ile sınırlı, .data Git ve web dağıtımı dışındadır. Runner .env yüklemez; gerçek Neon/R2 istemcisi çalıştırmaz.

Son başarılı fixture **e23-a6d64c06-e48f-4570-bd9f-1843a9c9f596**, veri dizini bunun `data` alt dizini; PID **26360**. Hedef **pusula_restore_fixture_24f7e31c9d9b4066a55b34a11052ffe0**, OID **17307**. Kayıt `.data/fixtures/<fixture-id>/verification.json` içinde Git dışında tutulur.

Restore öncesi source/environment/data directory proje içindeki e23 UUID alanıyla eşleştirildi; hedef adı yeni UUID ve katalogda yoktu. CREATE DATABASE ... TEMPLATE template0 yalnız bu yeni cluster'da çalıştı. Hedef bağlantısında cluster data directory ve DB OID yeniden doğrulandı; ilişkiler/fonksiyonlar/ek şema/type/large object sayıları0 idi. Var olan/uzak/boş olmayan hedefler izole negatif testlerle engellendi. Restore **--exit-on-error --single-transaction --dbname=<yeni hedef>** kullandı; --clean/drop veya mevcut veritabanı hedefi yok.

## Restore sonrasındaki gerçek doğrulama

| Kontrol | Sonuç |
| --- | --- |
| pg_dump -Fc / pg_restore --list | PASS / PASS |
| AES-GCM doğrulanmış private decrypt | PASS; orijinal dump plaintext SHA-256/boyut eşleşti |
| Yeni boş DB'ye gerçek pg_restore | PASS; exit0, single transaction |
| Kaynak/hedef içerik | **35/35 tablo**, sıralanmış PostgreSQL to_jsonb satır metinlerinin SHA-256 ve satır sayıları birebir |
| Hayalî kapsam | Tenant/company/customer/material/variant/history/quote/sale/sale-line/payment-plan ikişer kayıt |
| Auth ilişkileri | AuthUser/Account/Session/TwoFactor/SecurityEvent/Membership/AuditEvent ikişer kayıt; ilişkisel join PASS |
| Finans | 1.000000→1.250000 USD geçmişi, variant1.250000; satış5.000000 USD/300.00 TRY ve rateSnapshot50.000000 eşleşti |
| Katalog | 35 tablo, 350 constraint (43 FK dahil), 82 index, 11 trigger, 43 policy, 5 fonksiyon tanımı eşleşti |
| RLS/izin | 21 FORCE RLS; public schema ACL6, column ACL0, table ACL401, function ACL11 normalize edilmiş kayıt eşleşti |
| Etkin runtime RLS | Her iki tenant için ayrı oturum bağlamında Customer1, diğer tenant0 |
| Backup rolü | Bütün müşteriler2; UPDATE42501 ile reddedildi |
| Gerçek davranış | FK23503; fiyat geçmişi23514; Auth/audit/immutableP0001; geç sonradan payment-plan INSERT sealing23514 |
| Rotasyon | Eski ve yeni arşiv kendi ID/key'iyle okunur; çapraz key ve eksik key reddedildi |
| Negatif arşiv | Yanlış key, bozuk ciphertext ve eksik manifest restore başlamadan reddedildi |

Şifreli arşiv146436 byte; SHA-256 `fda868d07806a46c0412fffb3f94c0dbe28367806352768d658602b793a1f7d2`. Bu arşiv özetidir, key fingerprint'i değildir. Veri ve finans hash karşılaştırmaları sadece küçük sentetik fixture içindir; büyük üretim veri hacmi benchmark'ı değildir.

Source ve target aynı **yeni yerel cluster** içindeki ayrı DB'lerdir; global fixture_admin/runtime/backup rolleri kurulumda hazırlanmıştı. pg_dump'ın global rol/parolaları veya DB düzeyi CONNECT/TEMP ACL'lerini restore ettiği iddia edilmez. Tablo/kolon/şema/fonksiyon ACL'leri ve uygulama RLS geri geldi. Hedef lokal DB'nin varsayılan CONNECT/TEMP hakları üretim önerisi değildir; cluster kapanınca erişim bitti. Farklı cluster/Neon rol/grant bootstrap'ı E4'te ayrıca gerekir.

AuthSession kayıtları hayalî ve 2000 tarihli expired; MFA secret/backup code alanları geçersiz placeholder, gerçek login kullanılmadı. Bu doğrulama Auth satır/ilişki ve append-only bütünlüğüdür; Better Auth login/TOTP/Master/step-up sertifikasyonu değildir. Gerçek restore sonrası session invalidasyonu ve app secret kurtarma politikası E4 kapısıdır; burada hiçbir mevcut session/MFA değişmedi.

## Deneme kaydı ve kanıt sınırları

İlk koşu e23-01641dd9-1aaa-4238-8cb8-f546f4a0abd7 gerçek restore ve içerik/katalog karşılaştırmasından sonra runtime fixture SELECT hazırlığı eksikliğiyle42501/FAIL oldu. İkinci koşu e23-ac0dfbe3-93fc-4def-9c0d-5b248049d4be runtime RLS ve backup yazma reddini geçti, CloudSaleLine immutable trigger için yanlış beklenen SQLSTATE nedeniyle FAIL oldu. Runtime'a yalnız yeni fixture'da gerekli SELECT hazırlığı eklendi; immutable P0001 ile sealing INSERT23514 ayrıldı. Üçüncü koşu31/31 geçti; şema/kolon ACL/boş type/large object ve dosya güvenliği genişletmesinden sonra son koşu yeniden31/31 geçti. FAIL koşular başarı sayılmadı; hepsi kendi süreçlerini güvenle durdurdu.

Bir yeni guard testindeki eksik NODE_ENV tipi ilk tsc kontrolünde yakalanıp düzeltildi. Son TypeScript/lint kontrolleri geçtikten sonra teslim edilir. Bu, gerçek restore hatası veya uygulama schema değişikliği değildir.

Test sonunda key buffer'ları sıfırlandı; yalnız kendi PID/data directory/executable/oluşturulma zamanı eşleştirilip pg_ctl fast stop yapıldı. Postmaster PID dosyası ve süreç kalktı. Diğer PostgreSQL/uygulama süreçlerine dokunulmadı. Kaynak/restore DB dosyaları ve yalnız sentetik dump/decrypted arşivler özel Git dışı fixture'da kaldı; genel/recursive cleanup veya mevcut DB silme yapılmadı.

## Son kontroller ve açık kapılar

| Kontrol | Sonuç |
| --- | --- |
| Gerçek PostgreSQL dump/decrypt/restore | **31/31** |
| E2 güvenlik/anahtar/vault/restore guard testleri | **154** izole test; önceki118 +36 yeni kontrol |
| Tam Vitest | **258/258**, 23 dosya, 12.46 s; önceki222 +36 yeni kontrol |
| TypeScript / ESLint | PASS; lint0 hata/uyarı |
| Build | PASS, Next16.4.1; mevcut geniş .data pattern uyarısı sürer |
| Sır taraması | PASS; 17 teslim dosyası ve 23 production client JS dosyası |
| Build trace | 16 trace dosyasında .data girdisi0 |
| Bağımsız son süreç/port kontrolü | Fixture süreci0; 55432 listener0; gerçek key vault oluşturulmadı |

Build warning sıfır denmez; E2.2d .data server trace dışlaması korunur ve son artifact/secret taramasında tekrar doğrulandı. DB/API/Auth/browser mutation suite'leri bu aşamada çalıştırılmadı; mevcut Neon test DB'ye veya gerçek kullanıcıya bağlanılmadı. Gerçek Safari/Firefox veya production performans/bağımsız kurtarma lokasyonu sertifikasyonu yok.

Neon Free ve R2 değiştirilmedi. Neon rol/BYPASSRLS kurulumu, PUBLIC TEMP/CONNECT, diğer DB nesne hakları ve builtin large object sahiplik riski çözülmemiş **production önkoşullarıdır**. Strict/Managed güvenlik kontrolleri kaldırılmadı; Managed gerçek kaynak/upload hâlâ kapalı. Gerçek kalıcı key ve iki kurtarma kopyası ayrı onay bekler; gerçek development dump/R2/restore ve E3 scheduler/retention/alarm/E4 tatbikatı ayrı kapılardır.
