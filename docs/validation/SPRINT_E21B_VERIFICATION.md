# Sprint E2.1b — gerçek yerel PostgreSQL fixture doğrulaması

18.10.2026 · `feat/pusula-v030-neon-cloud` · başlangıç `98b1c6c`.

## Sonuç

**14/14 yerel entegrasyon kontrolü PASS.** PostgreSQL sunucu ve tüm istemci araçları **18.6**. Yalnız hayalî kayıtlarla gerçek `pg_dump -Fc`, `pg_restore --list` ve mevcut E2 AES-256-GCM motoru doğrulandı. Bu sonuç gerçek Neon yedeği, R2 yükleme veya E4 restore kabulü değildir.

## Ortam ve kaynak

Kullanıcı onayıyla yalnız önceden doğrulanan resmî EDB `postgresql-18.6-5-windows-x64-binaries.zip` kullanıldı. Kaynak: https://get.enterprisedb.com/postgresql/postgresql-18.6-5-windows-x64-binaries.zip . SHA-256: `e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2`. [EDB checksum kaydı](https://github.com/EnterpriseDB/edb-installers/issues/733) aynı özeti yayımlar. EXE dosyaları **Authenticode NotSigned**; imza doğrulanmış değildir. Yalnız bu sabit özetli resmî arşiv için verilen onay kullanıldı. TLS veya işletim sistemi güvenlik korumaları kapatılmadı; çalıştırma sırasında tehdit/engelleme bildirimi görülmedi. Bağımsız antivirüs tarama sertifikasyonu iddiası yoktur.

Sunucu `.data/tools/postgresql18-fixture-server`, istemciler `.data/tools/postgresql18-client` altındadır. Sistem PATH veya Windows servisi değiştirilmedi. Yeni cluster yalnız `127.0.0.1:55432`, SCRAM-SHA-256 ve bellekte üretilen güçlü geçici parolalarla çalıştı; trust yoktur. `.env` yüklenmedi. İlgili dosyalar Git dışında ve operatör/SYSTEM ACL ile sınırlıdır.

Son başarılı çalışma: `.data/fixtures/e21b-d760d04c-202f-4ac0-9048-57d901d40c19`. Veri dizini bunun `data` alt dizinidir. Sunucu PID **11944**; son kontrolde executable, veri dizini ve süreç oluşturulma zamanı eşleştirildi. Yalnız bu süreç `pg_ctl stop -m fast` ile durduruldu; PID dosyasının ve sürecin kalktığı doğrulandı. Ham yerel kanıt `verification.json` içinde, Git dışında tutulur. Sentetik arşivler ve cluster dosyaları silinmedi.

## Kanıt

| Kontrol | Sonuç |
| --- | --- |
| Gerçek sunucu/istemci sürümleri | postgres/initdb/pg_ctl/pg_dump/pg_restore/psql 18.6 |
| İzole şema | 13 mevcut migration, checksum kontrolü |
| Kaynak denetimi | 35 tablo, 21 FORCE RLS; salt okunur snapshot ve sınırlı yerel BYPASSRLS rolü |
| Gerçek custom dump ve TOC | PASS; 43 FK, 43 policy, 11 kullanıcı trigger adı kaynakla eşleşti |
| Arşiv veri kapsamı | 35 tablonun COPY satır sayısı kaynakla birebir eşleşti |
| İlişkili hayalî veri | İki tenant; ikişer müşteri, malzeme, satış, satış satırı ve ödeme planı; ilişkisel join kontrolü PASS |
| AES-256-GCM | Gerçek dump şifrelendi; plaintext SHA-256 ve boyut şifre çözümünde eşleşti |
| Manifest | HMAC/bütünlük PASS; değiştirilmiş manifest reddedildi |
| Negatif kripto | Yanlış anahtar ve bozuk ciphertext reddedildi |
| Gerçek araç hataları | Yanlış parola, BYPASSRLS olmayan rol ile dump ve geçersiz arşiv listesi sıfır olmayan çıkışla reddedildi |
| Güvenli kapanış | PASS; yalnız doğrulanan fixture süreci durdu |
| E2 izole birim testleri | 61/61 PASS |
| TypeScript / lint | PASS; 0 lint hata/uyarı |

Şifreli arşiv 144826 byte; SHA-256 `206ed851ae2c1ce6204d87a0f4b6dc9933bd91ecebb728ad0cb3c393ce234b75`. Test anahtarı yalnız RAM'de üretildi, sonunda sıfırlandı; gerçek backup anahtarı oluşturulmadı. Decrypt plaintext'i diske yazmadan sink'e doğrulandı. `pg_restore --data-only --file` çıktısı yalnız satır sayımı için okundu, hiçbir hedefe restore edilmedi.

## Düzeltmeler ve başarısız denemeler

Gerçek koşu E2 sequence yetki sorgusunda PostgreSQL'in koşulları değerlendirme sırasına bağlı `42809` hatasını ortaya çıkardı. `has_sequence_privilege` artık yalnız sequence için CASE içinde çağrılır; yetki denetimi gevşetilmedi. Yeni `backup:test:local` bu gerçek regresyonu da kapsar.

İlk denemede Windows pg_ctl pipe mirası beklemeye neden oldu; PID ve veri dizini ayrıca doğrulanıp yalnız o süreç elle güvenli durduruldu. İlk rapordaki otomatik kapanış FAIL kaydı değiştirilmedi. Runner daemon kontrolünde pipe kullanmayacak şekilde düzeltildi. Sonraki iki denemede fixture seed kolon hatası ve yukarıdaki gerçek sequence sorgu hatası düzeltildi; bu cluster'lar otomatik güvenli kapandı. Ardından 13/13 başarılı koşu, son kapsam genişletmesiyle **14/14 başarılı tam koşu** elde edildi. Başarısız denemeler başarı sayılmadı.

## E2.2 için kalanlar

Neon managed ortamında desteklendiği doğrulanmış, yazma/DDL/admin yetkisi taşımayan özel BYPASSRLS backup hesabı ve direct TLS URL gerekir. Yerelde superuser ile rol oluşturulması Neon yetki modelinin uygulanabilirliğini kanıtlamaz. Gerçek key/KEY_ID ve kontrollü offline kurtarma kopyaları hazırlanmalıdır. Gerçek Neon dump ve R2 yazma için ayrıca açık kullanıcı onayı gerekir. E3 scheduler/retention/alarm ve E4 ayrı hedefe restore/kurtarma tatbikatı hâlâ açıktır.

Neon development/production, mevcut `pusula_sprint_b_test`, Master/MFA ve uygulama iş kayıtlarına bağlanılmadı veya müdahale edilmedi. R2 çağrısı, upload veya delete yapılmadı. Mevcut uygulama DB/API/browser testleri bu aşamada yeniden çalıştırılmadı.
