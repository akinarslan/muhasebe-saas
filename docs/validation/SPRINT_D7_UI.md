# Sprint D7 — UI doğrulama

17.10.2026 · Başlangıç `150861b` · `feat/pusula-v030-neon-cloud`.

## Denetim ve gerçek neden

Başlangıç Vitest 104/104 geçti. Değişiklik öncesi Playwright müşteri aramasını desktop/mobil normal, focus ve dolu durumda yakaladı (2/2, 45.8 s). Bu checkout'ta bildirilen çift border yeniden üretilemedi: input border 0, outline/shadow none; dış kapsayıcı border 1 px idi. Dolayısıyla çift border için kanıtlanmış tek neden iddia edilmiyor.

Somut sorunlar: müşteri aramasında ikon yerine input yanında görünür metin, mobilde bölünen etiket, masaüstünde 958 px kapsayıcı içinde 200 px input ve focus göstergesinin tamamen kaldırılması. `.cloud-search` kuralları farklı bloklarda tekrar ediyordu. Demo `.search-field` iç input'unda global focus shadow'u dış focus ile birlikte kalabiliyordu; bu kapsam da dar CSS seçicisiyle düzeltildi.

Yeni ortak `SearchField` dış çerçeve/focus'un tek sahibidir. İç input border/outline/shadow çizmez. Solda dekoratif Lucide ikon, erişilebilir ad, daralabilen input ve mobil tam satır vardır. Müşteri/kullanıcı filtre fonksiyonları değişmedi. Mevcut olmayan ürün/malzeme/tedarikçi araması eklenmedi.

## Davet ve doğrulama

C6.1 login TOTP ve sunucu step-up zaten gereken davranışı sağladığından değiştirilmedi. Mevcut browser senaryosu boş/odaklı TOTP, salt okunur hesap, kurtarma/hesap değiştirme, onay sonrası gizlenen parola/kod, kalan süre ve kullanıcı yönetimine dönüşü denetler.

Yeniden davet isteği eski başarı bildirimini temizlemiyordu. Yeni istek başlangıcında eski notice/error temizlenir; başarısız yeniden gönderme başarı bırakmaz. Bekleyen davette kayıtlı üyenin paneline **Mevcut daveti yönet** bağlantısı eklendi; otomatik yeniden gönderme yapılmaz. Başarılı davet drawer kapatma/liste yenileme, hata durumunda form koruma ve taşıyıcı kabulü/teslim ayrımı mevcut akıştır.

## Görsel kanıt

[Önce](../design/screenshots/d7/before/) ve [sonra](../design/screenshots/d7/after/) klasörleri desktop/mobile normal/focus/filled PNG ve computed-style JSON içerir. Önce görüntüleri kapsayıcı sınırından; sonra görüntüleri dış focus halkası görülebilsin diye 6 px payla alınır. Yalnız hayalî test müşteri adı görünür; QR, kurtarma kodu veya sır yoktur. Görsel inceleme sonucu ve son komut sonuçları teslim raporuna yazılır.

## Kapsam ve tekrar çalıştırma

Frontend/CSS ve browser regresyonları dışında şema, API yetkileri veya finansal motor değişmedi. `/app` müşteri/katalog/ölçü/fiyat/teklif/satış drawer ve mobil tabloları mevcut tam browser akışında kontrol edilir; demo ayrı 22 testle korunur. Production, gerçek Master/MFA, kullanıcı verisi, env ve localStorage temizlenmez. Testler yalnız izole test DB ve hayalî hesapları kullanır; e-posta yerel taşıyıcı veya simüle 502'dir, gerçek Resend gönderimi yoktur.

Komutlar: `npm run build`, `npm run lint`, `npm test`, `npm run db:test`, `npm run cloud:test`, `npm run auth:test`, `npm run test:e2e`, `npm run test:e2e:auth`. D7 browser testi önce tam auth senaryosunun hazırladığı/enroll ettiği fixture'ı kullanır; temiz ortamda tek başına değil tam `test:e2e:auth` komutuyla çalıştırılır. Gerçek Safari/Firefox/ekran okuyucu sertifikasyonu değildir.

## Son kontroller

- Build: başarılı (Next 16.4.1, strict TypeScript); lint: 0 hata/uyarı; Vitest: 104/104, 17 dosya, 13.23 s.
- Gerçek PostgreSQL/RLS: 11/11; Cloud/DB: 11/11; Auth/API C1–C6.1: 60/60.
- Client secret taraması: 24 production artifact'ında yapılandırılmış Resend anahtarı yok.
- İlk browser denemesi test düzenleme hatasıyla başarısız oldu: resend kontrolü panel kapandıktan sonra çalışıyordu; ayrıca test locator'ında encoding hatası vardı. İkisi düzeltilip tam koşu yeniden başlatıldı. Ardıl D7 testi müşteri fixture'ı oluşmadığı için o koşuda geçmedi. Başarısız/yarıda kesilen koşu başarı sayılmaz. İlk `npm` PowerShell execution-policy engeli, `npm.cmd` ile kuralları değiştirmeden aşıldı.
- Önceden bilinen Next development redirect-stream, pg deprecation ve NO_COLOR uyarıları sürer; sıfır sunucu log hatası iddiası yoktur. Beklenen negatif HTTP sonuçları test kapsamındadır.

- Son tam auth/cloud Playwright: **4/4**, desktop Chrome + mobil Chromium, **6.8 dakika**. Her tam auth akışında 6 beklenen negatif HTTP konsol kaydı, 0 beklenmeyen konsol hatası; mevcut pageerror kontrolü geçti. TOTP/step-up, davet kapanma/liste yenileme, başarısızlıkta alan koruma, resend eski başarı temizliği, pending davet yönetimi, müşteri/katalog/maliyet/teklif/satış ve ayrı oturumdan kalıcılık doğrulandı.
- D7 arama testleri: normal/focus/filled computed style, filtre eşleşme/boş sonuç/temizleme, mobil sayfa taşmaması. Desktop ve mobil altı son PNG bizzat incelendi: ikon/metin hizalı, placeholder örtüşmüyor, iç çerçeve yok ve dış focus görünür. Son desktop 360 px / input 306 px; focus shadow 3 px turkuaz. Mobilde alan mevcut panel genişliğine daralır. Başlangıç görüntüleri de incelendi. Müşteri/kullanıcı ekranı ve davet hata drawer'ı mevcut tam akışta kontrol edildi.

- Son demo Playwright: **22/22**, desktop/mobil, **1.7 dakika**. Toplam son browser kontrolleri **26/26** (22 demo + 4 auth/cloud/D7).

Git: `549d4bd` D7 teslimi mevcut feature dalına başarıyla push edildi; ardından fark 0/0 ve çalışma ağacı temizdi. 27 staged dosyada yerel sır taraması PASS. Push kaydı ayrı dokümantasyon commit'iyle eklenir; main korunur.
