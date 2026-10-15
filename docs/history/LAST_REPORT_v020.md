# Pusula v0.2 — Fiyatlandırma ve UI/UX Teslim Raporu

Tarih: 15.10.2026 · Dizin: `C:\Users\tb\Desktop\muhasebe-saas`

## Denetim ve düzeltilen varsayımlar

v0.1'de `newLine()` katalog satış fiyatını otomatik kopyalıyor, kâr güncel katalog maliyetinden hesaplanıyor ve USD dönüşümünde sabit 42 kullanılıyordu. Bu varsayımlar yeni fiyatlandırma kararlarına göre kaldırıldı.

Aktif ürünlerin varsayılan satış fiyatı/maliyeti sıfırdır. Başlangıç malzeme genişliklerinin USD maliyetleri boştur. Eski ZY Reklam listesi içe aktarılmadı ve aktif fiyatlandırmayı etkilemez. Hayalî v0.1 satışları eski fiyat/kur/maliyetlerini yalnızca açıkça tarihsel demo olarak işaretli snapshot'larda korur. Eski satış taslakları, müşteri bilgileri, ürünleri ve açıklamaları taşınır; eski fiyatlar yeniden doğrulanmadan kaydedilemez.

## Uygulanan fiyatlandırma

- USD/birim malzeme maliyeti; m², metretül, adet, plaka; yeni malzeme ve varyant; stok uygunluğu.
- Her fiyat değişikliğinde tarih, önceki/yeni değer, kullanıcı kimliği ve adı. Malzeme/gider kataloğu localStorage'da saklanır.
- Ruloda gerçek tüketim: tam rulo eni × paylı boy × adet. 135 × 200 cm + dört kenarda 2 cm → 139 × 204 cm gerekir; 137 cm reddedilir, 152 cm ile 3,1008 m² tüketilir.
- Diğer uygun/stokta rulolar kullanıcı tarafından seçilebilir. Varyant USD fiyatları birbirinden bağımsızdır. Metretül hesabı aynı iş için 2,04 metre kullanır.
- Brüt kullanılmayan alan, kullanıcı tarafından ayrılan yeniden kullanılabilir alan ve net fire ayrı gösterilir. Yeniden kullanılabilir alan kenar kesimlerini içermez; maliyetten düşülmez.
- Bir üründe birden fazla malzeme ve gider; serbest gider türü/birimi. Başlangıç türleri mürekkep, işçilik, elektrik, makine, kesim, laminasyon, montaj, nakliye ve diğer giderlerdir; listeyle sınırlı değildir.
- Toplam USD maliyeti = malzeme + gider. Marj yöntemi `maliyet / (1 − marj)`; maliyet üzerine kâr yöntemi `maliyet × (1 + oran)` olarak ayrıdır. KDV ayrıca hesaplanır.
- Manuel net TL fiyat girilebilir; gerçekleşecek kâr, marj ve maliyet üstü kâr yeniden hesaplanır. Satış satırında sonradan birim fiyat/iskonto değişse de gerçek kâr aynı sabitlenmiş maliyetten türetilir.
- Satır hesaplayıcısından satışa fiyat aktarılır; iskonto sıfırlanır, KDV aktarılır. Ölçü/adet değişirse maliyet yeniden doğrulanmalıdır. Para birimi değişimi müşteri/ürün/açıklamayı korur, fiyatları yeniden hesaplama için sıfırlar.
- Satış ve bağımsız maliyet teklifleri kur, tüketim, USD birim maliyeti, giderler, hedef/yöntem ve kullanıcı bilgilerini bağımsız snapshot olarak saklar. Yeni katalog veya kur güncellemesi geçmiş kayıtları değiştirmez.

## Kur hizmeti

`GET /api/exchange-rate` Node.js sunucusunda TCMB XML'den USD `ForexSelling / Unit` alır. Alış/efektif satış kullanılmaz. Yayın tarihi ve son çekilme zamanı gösterilir; gösterge kurunun gerçek zamanlı piyasa kuru olmadığı belirtilir.

Son başarılı TCMB kuru `.data/exchange-rates.json` dosyasına yazılır. Servis/parsing hatasında bu kur eski olabileceği uyarısıyla korunur. Önbellek yoksa kur uydurulmaz; 503 döner, fiyat/satış kaydı yapılamaz. Yazımlar tek süreçte sıralanır ve atomik rename kullanır.

Yetkili manuel `POST` için sunucuda `PUSULA_RATE_ADMIN_TOKEN` (en az 24 karakter) gerekir. Sabit zamanlı karşılaştırmayla anahtar doğrulanır; kur, yetkili adı, gerekçe ve zaman denetim kaydına yazılır. Anahtar saklanmaz. Manuel kayıt TCMB cache'ini değiştirmez. `.env.example` kurulum şablonu eklendi. Test sunucusunda gerçek yönetici anahtarı oluşturulmadı; varsayılan manuel endpoint kapalıdır. Yetkili/izinsiz/bozuk istek senaryoları otomatik testlerle doğrulandı.

Canlı HTTP kontrolünde yerel sunucu TCMB'den **15.10.2026 yayınlı 49,4204 USD/TRY döviz satış kuru** döndürdü; çekilme zamanı `2026-10-15T15:01:31.923Z` (18:01:31 İstanbul) ve `stale: false` idi. Bu bir doğrulama kaydıdır, gelecekteki güncel kur iddiası değildir. Kaynak yanıtı `tests/fixtures/tcmb-2026-10-15.xml` içinde korunur; uygulama fixture'ı aktif fiyat kaynağı olarak kullanmaz.

## UI/UX

- Koyu lacivert, turkuaz vurgulu sidebar; finans, operasyon ve yönetim grupları açılır/kapanır; daraltma ve mobil menü korunur.
- Altı renkte KPI: satış, kâr, alacak, borç, gecikmiş tahsilat, yaklaşan ödeme. Belirgin Lucide ikonları, gradient yüzeyler, büyük değerler, eşit uzunluktaki önceki dönem karşılaştırması, gerçek kayıtlardan mini trend ve detay panelleri.
- Satış ürün kartlarında reklam/yazılım ikonları; maliyet hesaplayıcıda bağlantılı Malzemeler / Giderler / Fiyatlandırma panelleri; USD maliyet ve TL öneri görsel olarak ayrıdır.
- Uygun/dar/stokta olmayan rulo seçenekleri renk, metin ve ikonlarla belirtilir. Tüketim, baskı ve kullanılmayan alan görselleştirilir.
- Müşteri segmentleri kurum, tasarım ve mağaza ikonlarıyla renklendirilir. Müşteri detayları ve yeni müşteri drawer tipografisi/yerleşimi güçlendirildi; tarihi satışların kur ve maliyet detayları görünür.
- Ortak renk, spacing, radius, shadow ve tipografi token'ları `src/app/v02.css` ve mevcut tema değişkenlerindedir. Geist, Tailwind, shadcn/ui Button ve Radix korunur. Masaüstü/tablet/mobil CSS kuralları, açık/koyu tema ve reduced-motion desteği vardır.

## Doğrulama

| Kontrol                                 | Sonuç                                                               |
| --------------------------------------- | ------------------------------------------------------------------- |
| `npm run build`                         | Başarılı; TypeScript strict, statik sayfalar ve dinamik kur route'u |
| `npm run lint`                          | Başarılı; 0 hata, 0 uyarı                                           |
| `npm test`                              | **7 dosya, 46 test başarılı**                                       |
| Üretim ana sayfa HTTP kontrolü          | HTTP 200                                                            |
| Üretim `/api/exchange-rate`             | HTTP 200; gerçek TCMB USD döviz satış ve yayın/çekilme tarihleri    |
| Masaüstü/mobil görsel tarayıcı kontrolü | Yapılamadı; oturumun tarayıcı/uygulama envanteri boş                |

UI testleri jsdom'da gerçek form etkileşimleriyle çalışır. Eşzamanlı build yükünde 5 saniyelik test eşiği aşıldığı için Vitest iki işçi ve 15 saniyelik test sınırıyla yapılandırıldı; son tam test çalışması başarılıdır. Bu ayar ürün davranışını değiştirmez.

Önceki 12 testin kapsamı korundu. Yeni kararla çelişen sabit örnek kur testi, işlem snapshot'ı zorunluluğunu doğrulayacak şekilde değiştirildi. Müşteri/taslak entegrasyon testi yeni zorunlu fiyat sabitleme adımını da çalıştırır. Testler atlanmadı.

### İstenen 15 senaryonun karşılığı

| Senaryo                              | Doğrulama                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 1. Yeni malzeme                      | UI: malzeme ve varyant ekleme                                                                      |
| 2. Elle USD değişimi                 | UI + fiyat geçmişinde eski/yeni değer/kullanıcı                                                    |
| 3. Malzeme maliyetiyle yeniden hesap | Motor testi                                                                                        |
| 4. 137 cm reddi                      | Motor + disabled UI seçeneği                                                                       |
| 5. 152 cm ve 3,1008 m²               | Motor + otomatik UI seçimi                                                                         |
| 6. m² / metretül ayrımı              | 3,1008 m² ve 2,04 metretül karşılaştırması                                                         |
| 7. Çoklu malzeme                     | Motor + UI                                                                                         |
| 8. Yeni gider                        | Yeni kütüphane türü ve özel satır UI testleri                                                      |
| 9. Gider maliyeti                    | Miktar × USD ve toplam maliyet testi                                                               |
| 10. Hedef marj                       | Marj/markup motor testi ve UI hedef girişi                                                         |
| 11. Manuel marj                      | Manuel fiyat, gerçek kâr ve KDV testi                                                              |
| 12. Kur güncellemesi                 | Yeni hesap ve UI kur değişimi; TCMB yeni yayın testi                                               |
| 13. Geçmişi koruma                   | Snapshot bağımsızlığı, katalog/kur değişimi, migration ve kalıcı satış testi                       |
| 14. Eski fiyatların etkisizliği      | Aktif sıfır fiyat/boş malzeme maliyeti ve örnek kur reddi                                          |
| 15. Mevcut işlevler                  | Müşteri doğrulama, mükerrer, il/ilçe, Escape, fazla ödeme, taslak yenileme ve satış kaydı testleri |

Ek testler: adet/plaka, stok reddi, kullanılabilir artık sınırı, bozuk TCMB XML, ilk kur hatası, son başarılı kur fallback, izinsiz manuel kur, yapılandırılmamış manuel servis ve yazılamayan denetim kaydı.

## Bilinen sınırlar

- Veriler prototiptir; tarayıcı verisi tam kullanıcı/tenant güvenliği sağlamaz. Manuel kur anahtarı yalnızca kendi endpoint'ini korur. Ticari yayına hazır backend/rol/veri yedeği olduğu iddia edilmez.
- Malzeme maliyet tarihçesi demo kullanıcı adıyla tutulur; kur yöneticisi adı sunucu ortamından gelir. Tarayıcı kullanıcı oturum sistemi yoktur.
- `.data/` tek sunucu/kalıcı disk varsayar. Çok instance'lı dağıtım, ortak veri deposu ve dağıtık kilit yoktur. localStorage'da sekmeler arası eşzamanlama ve sunucu yedeği yoktur.
- Henüz uygulanmamış hesaplayıcı girdileri panel kapanınca korunmaz. Satış taslağına uygulanmış maliyet snapshot'ları ve kayıtlı teklifler kalıcıdır.
- Stok miktarı düşümü/artık stoğu, gelişmiş yerleşim optimizasyonu, teklif gönderme/onay, gerçek ödeme ve resmî muhasebe yoktur. Bağımsız Alacaklar, Borçlar, Tedarikçiler, Üretim, Raporlar, Ayarlar Yakında durumundadır.
- Dashboard bakiyesi seçili dönemde oluşmuş kayıtların bugünkü kalanıdır; geçmiş tarih itibarıyla muhasebe kesiti değildir. Kısmi tahsilat planını sonradan gerçekleştirme/düzeltme akışı bu sürümde yoktur.
- Responsive CSS ve erişilebilir kontroller uygulanmıştır; gerçek masaüstü/tablet/mobil ekran görüntüsü, ekran okuyucu ve farklı tarayıcı kontrolleri bu oturumda doğrulanamamıştır. jsdom etkileşim testleri görsel kontrol yerine geçmez.

## Çalıştırma

```powershell
npm ci
npm run dev
```

Adres: http://127.0.0.1:3000. Üretim: `npm run build`, sonra `npm start`.

Önce **Stok ve Malzemeler** ekranından kendi USD alış maliyetlerinizi girin; sonra satış satırındaki hesaplayıcıyı veya **Teklif ve Maliyet** ekranını kullanın. Yetkili manuel kur kurulumu ve hesap kuralları `README.md` içindedir. Yerel HTTP kontrolü için açılan test sunucusu durduruldu.
