# PUSULA v0.2.2 — Birleşik teslim raporu

15.10.2026 · `C:\Users\tb\Desktop\muhasebe-saas` · [GitHub](https://github.com/akinarslan/muhasebe-saas)

## Sonuç ve Git senkronizasyonu

Yerel klasörde Git deposu bulunmuyordu. Mevcut uygulama silinmeden ilk snapshot alındı; yalnız belgeleri içeren GitHub geçmişi indirildi ve README, ROADMAP, ARCHITECTURE okundu. Bağımsız geçmişler merge edildi; README çakışmasında yerel kullanım belgeleri korundu, uzak ilk README `docs/history/GITHUB_README_20261015.md` içinde saklandı. Mimari ve uzun vadeli faz sınırları korunup yeni tasarım belgeleriyle ilişkilendirildi.

Geliştirme `work/pusula-v022` branch'inde yapıldı. `backup/local-v020` yerel başlangıç yedeğidir. Doğrulanan çalışma branch'i GitHub'a push edildi; `main`, `6cb8387` üzerinden `4fe623b` teslimine fast-forward güncellendi. Bu rapor ek bir dokümantasyon commit'iyle aynı iki remote ref'e gönderilir. Force-push, hard reset veya kullanıcı verisi temizliği yapılmadı. `.env.local`, `node_modules`, `.next`, `.data`, Playwright çalışma çıktıları ve kullanıcı verileri commit edilmedi. Paylaşılan PNG'ler ayrı test context'indeki hayalî demo verileridir.

| Sprint               | Commit    | İçerik                                                              |
| -------------------- | --------- | ------------------------------------------------------------------- |
| Başlangıç snapshot   | `f45fb76` | Değişiklik öncesi yerel v0.2 kodu                                   |
| 1 — Güvenli birleşme | `7d9e474` | GitHub belge geçmişi + yerel uygulama                               |
| 2 — v0.2.1           | `204c8dd` | Müşteri/ID/şema, numeric input, USD seed, Decimal, ilk E2E          |
| 3 — Tasarım temeli   | `a84c290` | Motion, özgün pusula, giriş prototipi, beş tasarım belgesi          |
| 4 — Premium UX       | `2def65a` | Dashboard, satış/malzeme, responsive, yeni ürün, veri koruma        |
| 5 — Doğrulama        | `4fe623b` | Son test kaydı, ekran görüntüleri, mimari/yol haritası bağlantıları |

## Kritik hata araştırması

**Müşteri:** Değişiklik öncesindeki 46 jsdom testi geçiyordu; bu tek başına kullanıcının tarayıcısındaki açılış çökmesini yeniden üretmiyordu. Kodda doğrudan `crypto.randomUUID()` ve `structuredClone()` bağımlılıkları ile yalnız üst seviye array kontrolü yapan eski müşteri şeması okuması bulundu. Güvensiz LAN HTTP bağlamında randomUUID bulunmayabilir; eski kayıtta null ad, `.trim()`/`.slice()` yollarını bozabilir. Bunlar düzeltilmiş somut uyumluluk sorunlarıdır; başlangıçtaki yalnız açılış anı çökmesinin tek ve kesin sebebiymiş gibi sunulmaz.

Tarayıcı uyumlu ID/kopyalama yardımcıları, null/eski müşteri alanları ve yinelenen ID'ler için idempotent dönüşüm, null-güvenli isim karşılaştırması ve kayıt hata mesajı eklendi. Playwright, randomUUID ve structuredClone kaldırılmış gerçek browser context'inde drawer açma/kaydetme, otomatik müşteri seçimi, ölçü/taslak koruma ve yenilemeyi hata oluşmadan doğruladı. Yeni kaydın ID'si çakışmayan biçimde üretilir.

**Sayılar:** Eski kontrollü alanlar boş metni `Number('')` ile 0 yapıyor, kullanıcı yazarken state tekrar sıfır gösteriyordu. Ortak NumericInput ham düzenleme metnini korur; `1000`, `0.50`, `1,25`, temizleme ve negatif parsing testlidir. Boş/geçersiz değer hesaplamada NaN/validation olarak kalır; sahte 0 fiyat/kâr gösterilmez. Min/max uyarıları, Zod/domain doğrulaması ve normalize edilmiş form verisi birlikte kullanılır. Türkçe para formatı girişten ayrı gösterilir; binlik ayırıcıyla giriş önerilmez.

**Veri:** Bir defalık `pusula.backup.v020`, eski demo/taslak/katalog/teklif JSON metinlerini tarayıcı içinde saklar. Mevcut anahtarlar silinmez. Boş numeric alanlar JSON'da null olsa da draft dönüşümünde geçersiz olarak geri yüklenir; sessizce 0 yapılmaz. Kullanıcı USD fiyatı ve eski snapshot'lar seed/kur güncellemesiyle değişmez.

## Malzeme, kur ve maliyet

- Kullanıcının verdiği 11 başlangıç referansı idempotent eklendi. USD ana maliyet korunur. TRY/EUR yalnız tarihsel USD/TRY **49.4204**, EUR/TRY **55.4110** referansıyla bir kez normalize edilir; canlı kur etiketi taşımaz.
- Vinil 140 cm ve Oracal 105/126/137/152/160/200 cm verilen örneklere dayanır. Ölçüsü belirsiz diğer malzemeler stokta/üretime hazır kabul edilmez; kullanıcı ölçü onayı gerekir. Mevcut kullanıcı fiyatları ezilmez.
- Yeni malzeme/varyant, SKU, kategori, marka, tedarikçi tanımı, maliyet birimi, KDV, tarih, açıklama ve varsayılan paylar düzenlenebilir. Pasifleştirme/arşiv, genişliği kaldırma/arşivden alma ve fiyat tarihçesi bulunur. Birim değiştirilirse maliyet yeniden girilmelidir.
- Satılabilir ürün/hizmet ekleme malzemeden ayrıdır ve satış taslağını korur. Bir satış kalemi birden fazla malzeme/gider kullanabilir.
- Rulo yalnız ilgili malzemenin uygun/stokta varyantlarından seçilir; en dar uygun ilk seçimdir. Diğer uygun rulolar için toplam USD maliyeti karşılaştırması gösterilir; en darın en ucuz olduğu varsayılmaz.
- 135 × 200 cm + dört kenarda 2 cm → 139 × 204 cm. 137 cm Oracal reddedilir; 152 cm tüketim **3.1008 m²**, baskı **2.70 m²**, brüt fark **0.4008 m²**, yaklaşık **%12.93**. Vinil 140 cm → **2.856 m² × 1.20 = 3.4272 USD**.
- Baskı, kenar payı, tüketim, brüt fark, kullanılabilir artık ve maliyetlendirilen fire ayrıdır. Artık maliyetten otomatik düşülmez. Metretül uzunlukla, m² alanla, plaka tam levha tüketimiyle hesaplanır. Otomatik döndürme/nesting yapılmaz.
- Malzeme/gider toplamları, kur dönüşümü, marj/markup ve parasal yuvarlama Decimal tabanlıdır. Gider adı/birimi serbesttir. KDV ayrıdır; manuel fiyat gerçek kâr/marjı yeniden hesaplar. Eksik malzeme fiyatı kesin öneri ve kaydı engeller.
- TCMB sunucu route'u USD/EUR döviz satış, yayın tarihi, çekilme zamanı ve kaynağı döndürür; beş dakikalık cache, son başarılı kur fallback'i, eskilik uyarısı ve anahtar kontrollü manuel kur denetim kaydı vardır. TCMB gerçek zamanlı piyasa kuru değildir.
- Son canlı yerel API kontrolü HTTP 200: USD **49.4204**, EUR **55.411**, yayın **15.10.2026**, çekilme `2026-10-15T16:33:02.624Z`, `stale: false`. Bu kontrol anının kaydıdır; gelecekteki güncel kur iddiası değildir.
- Eski ZY Reklam satış listesi aktif fiyat kaynağı olarak kullanılmaz. Tarihsel v0.1 demo fiyat/kuru yalnız kendi legacy snapshot'larında korunur. Geçmiş satış ve teklifler güncel katalogdan yeniden maliyetlenmez.

## Premium deneyim

`/login`: özgün katmanlı SVG pusula, metalik halka/ibre, yavaş ayrı katman hareketleri, sınırlı fare perspektifi, atmosferik lacivert alan ve açık demo giriş bildirimi. Gerçek şifre alınmaz, sahte güvenli oturum oluşturulmaz.

Dashboard: kapatılabilir düşük opaklıklı pusula, sekiz renkli KPI, gerçek veri trendleri/dönem karşılaştırması, hızlı eylemler, grafikler ve detay panelleri. **Nakit durumu** yalnız demo nakit tahsilatını gösterir; gerçek kasa bakiyesi değildir. **Aktif işler** modül henüz çalışmadığı için açıkça 0/inaktif gösterilir; gerçek iş emri varmış gibi sunulmaz.

Sidebar: 13 menü, koyu lacivert/turkuaz kimlik, gruplar, daraltma, mobil çekmece ve profil/giriş tasarımı bağlantısı. Satış geniş masaüstünde müşteri/kalemler/fiyat özeti alanlarına ayrılır; maliyet çalışma alanı ilişkili drawer'da malzeme/gider/fiyat panellerini sunar. Mobilde tek kolon ve yerel tablo scroll'u vardır. Müşteri segment ikonları, yeni müşteri drawer'ı ve mevcut arama/CSV/filtreler korunur.

Motion tokenları, MotionConfig reducedMotion, kısa sayfa/drawer/hover/toast geçişleri ve skeleton eklendi. Kritik işlem animasyon bitişini beklemez. Pusula satış, müşteri, malzeme ve maliyette bulunmaz. Master Admin yalnız belgeli blueprint'tir; gerçek enforcement v0.3'te yapılır.

Beş tasarım belgesi `docs/design/` altında amaç, görsel/etkileşim/motion/responsive/erişilebilirlik ve kabul kriterlerini içerir; ROADMAP/ARCHITECTURE ile bağlantılıdır.

## Doğrulama

| Kontrol        | Sonuç                                                            |
| -------------- | ---------------------------------------------------------------- |
| Başlangıç      | Build/lint başarılı, 46/46 test                                  |
| Son build      | Başarılı, strict TypeScript                                      |
| Son lint       | 0 hata, 0 uyarı                                                  |
| Son Vitest     | **54/54**, 8 dosya; önceki 46 korunur                            |
| Son Playwright | **12/12**, desktop Chrome ve Chromium mobil emülasyon; 43.1 s    |
| Gerçek API     | HTTP 200, USD/EUR ve yayın/çekilme bilgileri                     |
| Görsel kontrol | Masaüstü/mobil giriş ve dashboard PNG'leri üretildi ve incelendi |

İlk premium browser koşusunda 11/12 geçti. Mobil testin menü hydration zamanlaması ve kapalı menüde erişilebilir ad eksikliği düzeltildi. Son tam koşu değişmeyen uygulama koduyla 12/12 geçti; başarısız koşu başarı sayılmadı. Başka uygulamaya ait süreçler durdurulmadı; zaten açık olan bu projenin yerel geliştirme sunucusu yeniden kullanıldı.

Kanıtlar: [doğrulama ayrıntıları](docs/validation/FINAL_VERIFICATION.md), [başlangıç](docs/validation/BASELINE.md), [ekran görüntüleri](docs/design/screenshots/).

## Bilinen sınırlar

- Gerçek kimlik/rol/Master Admin enforcement, bulut PostgreSQL, tenant güvenliği ve yedek/restore v0.3+ kapsamındadır. localStorage gerçek işletme verisi için güvenilir ana kaynak sayılmaz.
- Stok miktarı/depo/alış hareketleri, iş emirleri, ileri nesting, operasyonel kasa/banka ve gerçek tahsilat v0.4–v0.6 kapsamındadır. Yeni tedarikçi tanımı bu modüllerin tamamı değildir.
- Manuel kur endpoint'i yalnız sunucu anahtarıyla korunur; tam kullanıcı yetki sisteminin yerine geçmez. Varsayılan olarak anahtar yoksa kapalıdır.
- `.data/` tek sunucu/kalıcı disk varsayar; dağıtık cache/DB değildir. Fiyat geçmişi demo kullanıcı kimliğiyle tutulur. Kullanıcı verilerini GitHub'a yedekleme yapılmaz.
- Henüz sabitlenmemiş maliyet drawer girdileri kapanınca korunmaz; satışa uygulanmış snapshot, satış taslağı ve kaydedilmiş teklifler kalıcıdır.
- Gerçek iOS/Safari cihazı, ekran okuyucu sertifikasyonu ve Lighthouse performans bütçesi ölçülmedi. Mobil Chromium emülasyonu, yatay taşma, klavye/Escape ve reduced-motion test edildi. Geliştirme PNG'lerinde Next.js geliştirme göstergesi görülebilir.
- Açılış anındaki kullanıcı çökmesinin tam tarayıcı logu bulunmadığı için tek sebep iddiası yapılmaz; bulunan uyumluluk ve veri şeması riskleri düzeltildi ve gerçek browser kayıt/yenileme akışı doğrulandı.

## Yerel kabul adımları

1. `npm ci`, `npm run dev`; http://127.0.0.1:3000/login üzerinden demo giriş tasarımını açın.
2. Dashboard faaliyet/tarih filtresini değiştirin; pusulayı kapatıp yenileyin; tercihin korunduğunu kontrol edin.
3. Satışa folyo/ölçü/açıklama ekleyin; yeni müşteriyi drawer'dan kaydedin; seçimin ve taslağın yenilemede korunduğunu kontrol edin.
4. Fiyat alanını silin; `1000`, `0.50`, `1,25` deneyin. Boş/geçersiz alanda fiyat kaydı yapılmadığını görün.
5. Malzeme Yönetimi'nde kendi USD fiyatınızı değiştirin; kaynak tarihçesini görün; ölçü onayı gereken malzemeyi tamamlayın. Kur yenilemesinin USD fiyatını değiştirmediğini kontrol edin.
6. Maliyet'te Vinil 140 cm ve Oracal 152 cm örneklerini çalıştırın; alternatif rulo, gider, marj/markup, manuel fiyat ve KDV'yi inceleyin. Teklifi sabitleyip katalog fiyatını değiştirin; eski snapshot sabit kalmalı.
7. 390 px mobil görünüm, menü, Escape ve sistem reduced-motion tercihini deneyin.

Komutlar: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`. Manuel kur kurulumu `.env.example` ve README'dedir. v0.3 ve sonrası bu görevde erkenden uygulanmadı.
