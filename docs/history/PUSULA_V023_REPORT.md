# PUSULA v0.2.3 — Satış, müşteri ve maliyet stabilizasyonu

16.10.2026 · [GitHub](https://github.com/akinarslan/muhasebe-saas)

## Teslim

Dal: `fix/pusula-v023-customer-sales`. Başlangıç `230030a`; fetch sonrası güncel main `dd96013`. Çalışma ağacı temizdi; yeni dal güncel main üzerinden oluşturuldu. Doğrulanan uygulama commit'i **`09ac7ebfb224da784d11c4a17d5c77ced421d2c8`** hem düzeltme branch'ine hem GitHub main'e push edildi. Main `dd96013` üzerinden fast-forward güncellendi; son fetch sonrası ancestry kontrolü geçti. Bu rapor ayrı dokümantasyon commit'iyle aynı iki ref'e gönderilir. Force-push/reset/veri temizliği yapılmadı; ortam dosyaları, kullanıcı localStorage verileri, `.data` ve test çalışma çıktıları commit edilmedi. Yalnız ayrı test context'inin hayalî verilerini gösteren iki PNG eklendi. [v0.2.2 raporu](docs/history/PUSULA_V022_REPORT.md) arşivlendi.

## Düzeltmeler

- Dolu satışta müşteri veya segment değişimi ortak onaya gider. Vazgeç/Escape taslağı ve localStorage kaydını birebir korur. Onay yalnız aktif taslağın satır, ölçü, malzeme/gider/fiyat/kur snapshot, not, ödeme planı ve peşinatını temizler. Yeni müşteri ve vadesi seçilir; faaliyet, satış tarihi ve para birimi korunur. Geçmiş satışlar ve teklifler değişmez.
- Yeni müşteri bağımsız kaydedilir; dolu satışta seçim yine onay ister. İptalde müşteri kaydı kalır. Boş formda doğrudan seçilir. CRM kaydından sonra yeni detay açılır.
- CRM filtrelenmiş tablo verisi memoize edildi. Yeni müşteri tıklamasında başlangıç Chrome denemesinde görülen yanıtsızlık, kararsız tablo verisi/sayfalama sıfırlama döngüsü giderildikten sonra oluşmadı. Elde edilmemiş bir başlangıç exception metni veya tüm tarayıcı hatalarının tek nedeni iddia edilmez.
- Maliyet paneli USD birim alış, gerçek tüketim ve toplamı ayrı gösterir. USD fiyat motoru, fiyat geçmişi, TCMB servisi ve eski snapshot'lar korunur. Premium pusula/giriş/dashboard/sidebar/motion tasarımı korunur; onay Radix odak kilidi/Escape, kısa geçiş ve mobil düzen kullanır.

[Kök neden, değişen dosyalar ve kanıt](research/PUSULA_V023_BUG_AUDIT.md).

## Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| Başlangıç | Build/lint başarılı; Vitest 54/54 |
| Son build | Başarılı, strict TypeScript |
| Son lint | Başarılı, 0 hata/uyarı |
| Son Vitest | 63/63, 9 dosya; önceki 54 test kapsamı korunur |
| Son Playwright | **20/20**, desktop Chrome + mobil Chromium; 1.3 dakika |
| Görsel | Masaüstü/mobil onay PNG'leri incelendi; taşma yok, düğmeler okunur |

Testler bağımsız demo context'lerindedir; kullanıcı verisi temizlenmez. Kur fixture'ları canlı kur iddiası değildir. İlk Playwright koşusunda eşzamanlı tanılama aynı çıktı klasörüne yazınca trace ENOENT oluştu. Diğer ilk başarısız adımlar kapalı vergi bölümüne erişim, malzeme eklenmeden fiyat sabitleme, il locator'ı ve arşivden hesaplayıcıya dönme adımıydı. Konsol kontrolünün bulduğu favicon 404, SVG ve metadata tanımıyla giderildi; hata gizlenmedi. Bu koşular başarılı sayılmadı. Son sabit kodla tam koşu 20/20; CRM console error/pageerror/HTTP 5xx listesi boş. Ardından build/lint/Vitest tekrar başarılı tamamlandı.

Kanıt görselleri: [masaüstü](docs/design/screenshots/v023-desktop-customer-switch.png), [mobil](docs/design/screenshots/v023-mobile-customer-switch.png). Önceki 12 browser senaryosu korunur; 8 yeni çalıştırma CRM, müşteri değişimi, boş form ve USD katalog/kur/snapshot akışlarını kapsar. Eski otomatik müşteri aktarımı beklentisi yeni onay kararıyla güncellendi. Vitest 63/63, 8.92 s; build 8.64 s; lint 0 hata/uyarı.

## Modül durumu ve v0.3

Alacaklar, Borçlar ve Tedarikçiler **Yakında** ekranlarıdır; işlem kaydetmez. Dashboard demo kayıtları gösterir. CRM cari/tahsilat gösterimi demo satışlardan türetilir; bağımsız cari defter değildir. Malzeme düzenleyicisindeki tedarikçi adı tanımı satın alma/borç modülü değildir.

v0.4'te çoklu tedarikçi–varyant ilişkisi, SupplierOffer ve Purchase/PurchaseLine ile tarih/miktar/birim/USD fiyat/kur snapshot'ı; v0.6'da alıma bağlı borç, kısmi ödeme, yöntem/vade/geçmiş/kalan borç/cari ekstre planı [denetimde](research/PUSULA_V023_BUG_AUDIT.md) açıklanır. Bu modüller erkenden uygulanmadı.

v0.3 PostgreSQL, sunucu otoritesi, kimlik/Master Admin/izin enforcement, audit, bulut yedek ve restore henüz uygulanmamıştır. localStorage demo/taslak içindir; gerçek işletme verisi ana kaynağı değildir. Fiyat tarihçesi demo kimliği, `.data` tek sunucu ve gerçek iOS/Safari ölçülmemiş olması sınırları sürer.

## Manuel kabul

1. Satışlar'da müşteri seçin; ürün/ölçü/maliyet/peşinat/ödeme planı/not girin. Başka müşteri seçiminde Vazgeç ve Escape sonrası müşteri/taslak aynı kalmalı; yenilemede korunmalı.
2. Devam et ve temizle sonrası yeni müşteri/vade seçilmeli; aktif kalem/plan/not/peşinat temizlenmeli. Eski satış ve teklifler değişmemeli.
3. Dolu satıştan yeni müşteri kaydedip seçimden vazgeçin: yeni kayıt kalmalı, eski taslak korunmalı. Boş satışta doğrudan seçilmeli.
4. CRM > Yeni müşteri: eksik/mükerrer/geçersiz VKN deneyin. Geçerli kayıt detay/listede görünmeli ve yenilemede kalmalı.
5. Vinil140 USD fiyatını elle değiştirin; tarihçe ve hesaplayıcı aynı fiyatı göstermeli. TCMB yenileme USD'yi ve eski teklifi değiştirmemeli. Oracal135×200 +2cm paylarda137 reddedilmeli,152 tüketimi3.1008m² olmalı.
6. 390px mobil, klavye/Escape ve reduced-motion kontrolü yapın.

Komutlar: `npm ci`, `npm run dev`, `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`.
