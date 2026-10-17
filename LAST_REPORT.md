# PUSULA v0.3 — Sprint C6 / Resend e-posta entegrasyonu

17.10.2026 · **Kod ve otomatik kontroller hazır. Canlı Resend denemesi HTTP 403 ile reddedildi: API anahtarı/alıcı eşleşmesi bekleniyor. Sprint C6 canlı kabulü ve production kurulumu tamamlandı denmez.**

## Sonuç

Resmî Resend Node SDK **6.34.1** sürümü sabitlendi. Better Auth **1.7.10**, TOTP, Master Admin step-up/özel izinleri, Neon PostgreSQL ve v0.2.3 demo ekranları korundu. Server-only taşıyıcı mevcut davet ve parola sıfırlama callback'lerine bağlandı. Şifreli development taşıyıcısı alternatif olarak korunur; otomatik testler gerçek mail ayarlarını devralmaz.

`RESEND_API_KEY` yerel `.env.local` içinde mevcut; değeri loga, tarayıcıya veya Git'e yazılmadı. İlk smoke alıcı eksikken API çağrısından önce durdu. Kullanıcı daha sonra test alıcısını bildirdi; adres yalnız Git dışındaki `.env.local` dosyasına kaydedildi. İkinci `npm run mail:test -- --send-live` denemesi gerçek Resend API'sinden **HTTP 403 / SENDER_OR_RECIPIENT_REJECTED** aldı: mevcut anahtarın hesabı farklı bir test alıcısına izin veriyor. Başka alıcıya gönderim yapılmadı. Kullanıcı bu alıcının hesabına ait anahtarı yerelde değiştireceğini belirtti; tamamlandı yanıtı bekleniyor. API kabulü veya inbox teslimi başarılıymış gibi raporlanmaz.

Bu ilk gerçek hata yanıtında SDK'nın development logger'ı ham sağlayıcı mesajını konsola yazdı; API anahtarı yazılmadı, fakat sağlayıcı mesajı alıcı bilgisi içeriyordu. Yalnız sabitlenmiş SDK instance'ının `logError` hook'u kapatıldı; global console değiştirilmedi. Gerçek SDK ile sahte HTTP 403 regresyon testi eklendi. API hedefi de SDK ortam override'ı yerine açıkça resmî `https://api.resend.com` olarak sabitlendi. Sonraki hatalar yalnız güvenli uygulama koduyla işlenir.

## Uygulanan davranış

- Test modunda gönderici zorunlu `Pusula <onboarding@resend.dev>`; yalnız `RESEND_TEST_RECIPIENT` ile tam eşleşen alıcıya izin verilir. Bu değişkeni doldurmak Resend tarafında alıcıyı doğrulamaz; hesabın izin verdiği adres kullanılmalıdır.
- Kendi domaini doğrulanınca `AUTH_MAIL_MODE=production`, `RESEND_FROM` ve HTTPS `AUTH_PUBLIC_URL`/`BETTER_AUTH_URL` üzerinden aynı taşıyıcı kullanılabilir. Test modu production'da kapalıdır. Yerel/özel ağ bağlantıları yalnız development testinde açık `AUTH_MAIL_ALLOW_LOCAL_LINKS=true` ile gönderilebilir; varsayılan kapalıdır.
- Gönderim yalnız Next.js sunucusunda, 15 saniyelik sağlayıcı timeout'u ve girişim başına idempotency anahtarıyla yapılır. API kabulü **teslim edildi** olarak gösterilmez. Kota/rate-limit davette 429, diğer gönderim hataları 502 verir; ham sağlayıcı hata mesajı veya adres loglanmaz. Ücretli yükseltme/otomatik toplu retry yoktur.
- `AuthMailDelivery` tablosu PENDING / ACCEPTED / LOCAL_TEST / FAILED, güvenli hata kodu ve tarih tutar. Token, URL, parola, alıcı adresi veya finansal içerik bu tabloya yazılmaz. Kullanıcı yönetimi yetkili üyelerin son durumunu ve bekleyen davet için **Daveti yeniden gönder** eylemini sunar. Sağlayıcı mesaj kimliği UI DTO'suna çıkmaz.
- Yeniden davet tenant+Master yetkisi ve son beş dakikalık parola/TOTP doğrulaması ister. 30 saniyelik sınır vardır. Identity satırı kilitlenerek eski davetler iptal edilir; gönderim başarısızsa yeni token da iptal edilir. Davet 24 saat, reset 15 dakika ve tek kullanımlıktır.
- Reset gönderimi başarısız olduğunda token silinir. Yeni reset isteği önceki tokenları geçersizleştirir. Bilinen/bilinmeyen hesap ve gönderim hatasında aynı genel `request_received` cevabı döner; UI bunun gönderim onayı olmadığını açıklar. Gerçek Resend taşıyıcısında aynı 20 saniyelik yanıt tabanı ve mevcut rate-limit kullanılır. Aşırı DB/ağ gecikmesinde mutlak sabit süre garantisi değildir.
- E-posta yalnız işlem adı, süreli bağlantı ve güvenlik/test açıklaması içerir. Müşteri, bakiye, finansal tutar veya rol matrisi paylaşılmaz.

## PostgreSQL ve verilerin korunması

Yalnız mevcut **development** dalı `br-rough-darkness-ba6ow9zo` kullanıldı. `202610170010_auth_mail` migration'ı `pusula_development` ve izole `pusula_sprint_b_test` üzerinde başarıyla uygulandı; toplam 10 migration vardır. Önceki migration'lar değiştirilmedi. Yeni tabloya yalnız auth rolüne SELECT/INSERT/UPDATE verildi; business rolüne auth erişimi açılmadı. Mevcut Neon tenant/RLS/Decimal zinciri korundu.

Production branch/DB'ye işlem yapılmadı. Neon Auth veya ücretli Neon/Resend hizmeti açılmadı. Kullanıcı localStorage verileri taşınmadı/silinmedi; `.env.local` ilgisiz anahtarları ve mevcut bağlantıları korundu. Gerçek Master hesabı bu görev kapsamında oluşturulmadı veya yeniden bootstrap edilmedi. Önceki rapor [C5 arşivinde](docs/history/PUSULA_V030_SPRINT_C5_REPORT.md).

## Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| Prisma client / migration / auth grants | Başarılı; iki development/test DB |
| Build | Başarılı; strict TypeScript |
| Lint | 0 hata / 0 uyarı |
| Vitest | **93/93**, 14 dosya; önceki 81 + 12 Resend/gizlilik testi |
| Gerçek PostgreSQL suite | **11/11** RLS, CRUD, Decimal ve kesinti |
| Auth/API C1–C5 | **41/41**, önceki kontroller korundu |
| Yeni C6 gerçek DB suite | **6/6**, sahte taşıyıcı; gerçek mail göndermez |
| Playwright demo | **22/22**, desktop + mobil Chromium; 1.2 dakika |
| Playwright auth | **2/2**, desktop + mobil; 1.7 dakika; davet, yerel gönderim durumu ve yeniden gönderme eylemi de doğrulandı |
| npm audit --omit=dev | **0** bulgu |
| Canlı Resend smoke | **HTTP 403**: mevcut anahtar bu test alıcısına izin vermiyor; başarı/kabul yok |

Resend birim testleri: izin verilmeyen alıcı, localhost opt-in, production engeli, origin/path/HTTPS, test göndericisi, idempotency, API kabulü, günlük/aylık kota, rate-limit, yetki hatası, ağ hatası ve geçersiz başarı yanıtı. C6 DB testleri: başarısız gönderim/kalıcı durum/token iptali, yeniden gönderim, cooldown, eski token reddi, tek kullanımlı kabul, güvenli kullanıcı DTO'su, reset hata/gizlilik/tekrar deneme ve tek kullanımlılık.

İlk C6 test koşusunda test assertion'ı `AccessError.code` beklediği için başarısız oldu; mevcut sözleşme `reason` olarak düzeltildi. Ardından hedef test ve tam auth koşusu geçti. Başarısız deneme başarı sayılmadı. Beklenen kota testleri güvenli `AUTH_MAIL_FAILED` olayları üretir. Tarayıcı koşusunda önceden görülen Next development redirect stream mesajları, pg query deprecation ve NO_COLOR uyarıları vardır; bunlar gizlenmedi. Browser pageerror kontrolü geçti. Mobil ekran görüntüsü incelendi; tablo kendi yatay scroll alanındadır. Gerçek iOS/Safari testi yapılmadı. Önceden bilinen dev-only audit bulguları bu sprintte force downgrade ile değiştirilmedi.

## Kalan kabul adımı

1. Bildirilen alıcı yerelde kayıtlıdır. Kullanıcı aynı alıcının Resend hesabına ait `RESEND_API_KEY` değerini `.env.local` içinde değiştirmeli; anahtarı sohbete göndermeden güncellendiğini bildirmelidir. Mevcut anahtarla otomatik tekrar veya başka adrese gönderim yapılmaz.
2. `npm run mail:test -- --send-live` ile tek bağlantısız test iletisi ve gerçek API kabulü doğrulanmalı. Davet/reset için geliştiricinin çalışan yerel uygulaması kullanılacaksa açık development local-link opt-in gerekir. Otomatik davet kabul/reset testleri gerçek DB ile geçti; canlı taşıyıcı üzerinden bu işlemler henüz test edilmedi.
3. Gerçek kullanıcılara açılmadan önce kendi gönderici domaini DNS doğrulaması, yayınlanan HTTPS uygulama adresi, operatör hesabı/MFA ve production kabulü tamamlanmalı. Teslim/bounce webhook'ları bu sprintte eklenmedi; ACCEPTED yalnız API kabulüdür. Gönderim sonrası DB kesintisinde sonuç belirsiz kalabilir; otomatik retry yerine Resend paneli incelenmelidir.

[Kurulum ve ortam değişkenleri](docs/security/RESEND_SETUP.md) · [Neon mimarisi](docs/architecture/NEON_CLOUD.md) · [Master Admin kurulumu](docs/security/MASTER_ADMIN_SETUP.md)

## Git

Başlangıç `c96090ab25baf581aaa208605c80799f8a69557e`; geliştirme dalı `feat/pusula-v030-neon-cloud`. Doğrulanmış C6 uygulama commit **`a3cd27a`** GitHub geliştirme dalına başarıyla push edildi. Bu son rapor kaydı ayrı dokümantasyon commit ile aynı dala gönderilir. 24 staged dosya yapılandırılmış sır değerlerine karşı tarandı ve PASS aldı; 22 production tarayıcı artifact içinde yerel Resend anahtarı bulunmadı. `main` birleştirilmez; force-push/hard reset/veri temizliği yapılmaz. Sırlar, `.env.local`, `.env.bootstrap.local`, `.data` ve test çıktıları commit edilmez. Canlı testin eksik olduğu teslimde açıkça korunur.
