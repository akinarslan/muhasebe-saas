# Sprint D doğrulama kaydı

17.10.2026. Çalışma dalı feat/pusula-v030-neon-cloud; gerçek development bağlantısı, otomatik veri testleri yalnız pusula_sprint_b_test. Production kullanılmadı. Gerçek Resend mesajı gönderilmedi.

| Komut | Sonuç |
| --- | --- |
| npx tsc --noEmit | Başarılı |
| npm run build | Başarılı; Next16.4.1/Prisma7.10.1 strict TypeScript |
| npm run lint | 0 hata/uyarı |
| npm test | 104/104, 17 dosya, 12.36s |
| npm run db:test | 11/11 restricted PostgreSQL/RLS/Decimal |
| npm run auth:test | 60/60 C1–C6.1 |
| npm run cloud:test | 11/11 D senaryosu; history import ve child sealing dahil |
| npm run test:e2e:auth | 2/2 desktop Chrome + mobil Chromium, 6.6 dakika |
| npm run test:e2e | 22/22, port3100/yalnız test DB,1.4 dakika |
| db:migrate:test / db:migrate | Üç ileri migration; test tekrar deploy idempotent |
| Client secret taraması | 24 production tarayıcı artifact'ında yapılandırılmış Resend anahtarı yok |

Cloud testleri gerçek fixture kaydı, key replay/conflict, Decimal USD fiyat/version, 137 reddi/152 tüketimi, snapshot fiyat/kur ayrımı, quote revision, ilişkisel sale/plan atomikliği, sahte toplam/plan reddi, default deny/SQL immutability, kaynak conflict, demo dışlama, onay tekrarı ve tarihsel tutar mutabakatını içerir. Eski satışın satır/planına sonraki transaction'dan INSERT denenir ve reddedilir.

Browser: MFA kurulum/step-up/izin/davet önceki kapsamı korunur. Cloud müşteri, USD malzeme, ürün, maliyet, teklif ve satış kaydı; simüle503'te müşteri alanlarının korunması; logout/login; sayfa yenileme ve **ayrı cookie deposuyla bağımsız login** aynı veriyi görür. Ayrı context'ler aynı Chromium ailesidir; gerçek Safari/Firefox cihaz testi iddia edilmez. Her projede pageerror0, beklenmeyen konsol hatası0; beş beklenen negatif HTTP konsol hatası vardır. Sunucuda önceki Next development redirect-stream/pg-deprecation/NO_COLOR uyarıları sürer; sıfır sunucu hata logu iddia edilmez.

[Desktop](../design/screenshots/sprint-d-cloud-desktop.png) ve [mobil](../design/screenshots/sprint-d-cloud-mobile.png) yalnız hayalî fixture'lar içerir; QR, TOTP secret veya recovery ekranı kaydedilmedi. Görseller incelendi. Sayfa yatay taşması yok; tablonun yerel scroll'u vardır.

Başarısız denemeler denetim belgesinde kayıtlıdır; son başarılı koşuların yerine sayılmadı. Development gerçek kullanıcı ve mevcut iş satırı hash'leri son additive guard migration'ı çevresinde ve testler sonrasında aynıydı. İlk DDL öncesindeki hash betiği ESM hatası verdiği için o kontrol için öncesi/sonrası kanıt yoktur. Bağlantı hedefleri allowlist ve TLS guard'lıdır.
