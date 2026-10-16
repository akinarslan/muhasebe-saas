# PUSULA v0.2.3 hata denetimi

16.10.2026 · Başlangıç `230030a`; uzak main `dd96013`; çalışma dalı `fix/pusula-v023-customer-sales`.

## Başlangıç ve kapsam

Çalışma ağacı temizdi. README, ROADMAP, ARCHITECTURE, LAST_REPORT ve tasarım/motion/UX belgeleri okundu. Fetch ile gelen tek değişiklik ROADMAP içindeki v0.2.3 kapısıydı; dal bu güncel main'den oluşturuldu. Başlangıç build/lint başarılı, Vitest 54/54. İlk Playwright koşusundaki 12 akışın 11'i başarılıydı; eşzamanlı başlatılmış tanılama koşusu aynı çıktı klasörünü kullandığı için bir testin trace kapanışında ENOENT oluştu. Bu doğrulama hatası uygulama başarısı sayılmadı; sonraki koşular sırayla çalıştırılır.

## Satışta müşteri değiştirme

Önceki kod müşteri seçimi sırasında yalnız customerId/vade değiştiriyordu. Ürün, ölçü, malzeme/gider snapshot'ı ve tahsilat planı önceki müşteriden yeni müşteriye taşınıyordu. Yeni müşteri kaydı da aynı aktarımı doğrudan yapıyordu; segment seçimi müşteri alanını onaysız boşaltabiliyordu.

`src/lib/customer-switch.ts` müşteri hedefini, onay gerektiren taslağı ve temiz yeni taslağı tanımlar. `workspace.tsx` bekleyen hedefi taslaktan ayrı tutar; iptal/Escape hiçbir draft yazımı yapmaz. Onayda activity/currency/satış tarihi korunur; yeni müşterinin vadesi hesaplanır, satırlar, bütün maliyet/fiyat/kur snapshot'ları, ödeme planı, peşinat ve notlar sıfırlanır. Yöntem varsayılana döner. Ayrı render anahtarı hesaplayıcının yerel geçici state'ini de temizler. Müşteri eklenmesi önce bağımsız olarak kaydedilir; seçim iptal edilirse yeni müşteri kaydı kalır. Tarihsel DemoData ve teklif arşivi bu fonksiyona verilmez.

Değişen dosyalar: `src/lib/customer-switch.ts`, `src/components/workspace.tsx`, `src/components/sale-form.tsx`, `src/app/globals.css`. Radix modal odak kilidi, ilk odak Vazgeç, Escape/overlay iptali ve kısa reduced-motion uyumlu geçiş sağlar.

## Müşteriler ve Cari drawer

Gerçek Chrome başlangıç denemesinde CRM > Yeni müşteri tıklaması tamamlanamadı; 45 saniyelik test zaman aşımı ve trace kaydı oluştu. Bu, önceki yalnız jsdom testlerinin kapsamadığı davranıştır. Kaynakta `rows.filter` her render'da yeni tablo verisi üretiyordu. TanStack'in veri değişiminde otomatik sayfa sıfırlaması yeniden render tetikleyerek kararsız güncelleme döngüsüne yol açabiliyordu. `customers.tsx` filtrelenmiş veriyi tüm filtre bağımlılıklarıyla memoize eder. Ardından aynı gerçek tarayıcı drawer açma/doğrulama/kaydetme adımlarını tamamladı.

Bu denemede başlangıç hatasına ait kesin bir JavaScript exception metni elde edilmedi; zaman aşımı gözlemi ile kaynak düzeyindeki döngü nedeni ayrı tutulur. Kullanıcının bütün tarayıcı ortamlarında görülebilecek her çökmesinin tek nedeni olduğu iddia edilmez. Son testler console error, pageerror ve HTTP 5xx yanıtlarını da izler. Önceki createId/copyValue ve eski müşteri şeması onarımları korunur. Paylaşılan CustomerDrawer tek formdur; satış kaydı sonrası kontrollü seçim, CRM kaydı sonrası detay açılması farklıdır. İsim/VKN mükerrerliği, alan doğrulaması, il değişince ilçe sıfırlaması ve eski null alanlar test edilir.

## USD maliyet doğrulaması

Hesap motoru değiştirilmedi. `cost-calculator.tsx` tüketim ve toplamın yanında ayrı, dört ondalıklı USD/birim alış maliyetini gösterir. Katalogdaki elle değiştirilmiş USD fiyatının ekrana ve snapshot'a geçmesi, fiyat tarihçesi, kur değişiminde USD'nin sabit kalması ve eski teklifin birebir korunması browser testidir. Oracal 139 cm gereken en için 137'yi reddeder; 152 cm × 2.04 m = 3.1008 m², baskı 2.7, brüt fark .4008. Vinil140 tüketimi2.856, 1.20 USD/m² ile3.4272 USD. Birim/gider/marj/eksik fiyat ve tarihsel satış snapshot testleri mevcut kapsamda korunur. TCMB son yayımlanan gösterge döviz satış kurudur; tarihli test fixture'ları canlı kur iddiası değildir. Eski ZY Reklam listesi aktif fiyat kaynağına eklenmedi.

## Modül durumları ve sonraki fazlar

| Alan | Gerçekte çalışan/kaydedilen | Henüz olmayan |
| --- | --- | --- |
| Müşteriler ve Cari | localStorage demo müşteri CRUD ekleme; satışlardan hesaplanan geçmiş/cari/tahsilat gösterimi | Bağımsız cari defter, düzeltme/ters kayıt, güvenilir sunucu kaydı |
| Satışlar | Demo satış, plan, satır maliyeti ve kur snapshot'ı | Operasyonel finans kaydı/fiş/onay |
| Alacaklar / Borçlar | Açıkça Yakında; dashboard'da demo satış/alım verileri | Bu ekranlardan tahsilat/ödeme kaydetme |
| Tedarikçiler | Yakında; malzeme düzenleyicisinde yalnız ad/ID tanımı ve tek supplierId bağlantısı | Tedarikçi cari kartı, alım, ödeme, borç |
| Malzeme / Teklif | USD katalog, tarihçe, varyant, gider ve maliyet arşivi localStorage demo | Stok miktar hareketi, gerçek alım maliyeti/tedarikçi borcu |

v0.4 kabul modeli: Supplier ve MaterialVariant arasında çoktan çoğa SupplierOffer (tedarikçi SKU, USD birim fiyat, birim, geçerlilik); Purchase/PurchaseLine her alımda supplierId, variantId, tarih, miktar, birim, USD birim fiyat ve kur snapshot'ı saklar. Aynı varyant farklı tedarikçilerden alınabilir; yeni alım eski price version'ı değiştirmez. Alım ve stok giriş bağlantısı yetkili, audit kayıtlı ve tekrar işlemde tekil olmalıdır. Şimdiki supplierId bu gelecekteki çoklu ilişkiye kısıt olarak taşınmamalıdır.

v0.6 kabul modeli: SupplierPayable -> Purchase; SupplierPayment + allocation ile yöntem/vade/kısmi ödeme, ödeme geçmişi/kalan borç/cari ekstre; ters kayıt ve mutabakat. Çek/senet teslimi kesin ödeme sayılmaz. v0.3 sunucu otoritesi, PostgreSQL, Master Admin/RBAC ve audit temeli önce tamamlanır. Bu sürümde bu tablolar/API'ler uygulanmadı.

## Test kanıtları

Son kabul: build başarılı (strict TypeScript), lint 0 hata/uyarı, Vitest 63/63 (9 dosya, 8.92 s), Playwright 20/20 (desktop Chrome ve mobil Chromium, 1.3 dakika). CRM console error/pageerror/HTTP 5xx listesi boş. Onay modalı iki viewport'ta PNG olarak kaydedilip incelendi; `docs/design/screenshots/v023-*` yalnız hayalî test verisi içerir.

Konsol kontrolü ek bir varlık hatasını ortaya çıkardı: `/favicon.ico` 404. Trace, konsol kaydının kaynağını bu URL olarak gösterdi; CRM akışı o koşuda tamamlanmıştı. `public/favicon.svg` ve `src/app/layout.tsx` metadata icon tanımı eklendi; hata testte filtrelenip gizlenmedi. Ara test geliştirme koşularında kapalı vergi bölümüne erişim, il alanı locator'ı, malzeme eklemeden sabitleme ve arşivden tekrar hesaplayıcıya geçmeme adımları başarısızdı; testler gerçek UI akışına göre düzeltildi. Koşular sırasında test dosyası değiştirilmesi eski worker kodu ile yeni kaynak satırlarını karıştırdığından son tam koşu dosyalar sabitken yapılır.

Son komut sonuçları ve manuel kabul adımları `LAST_REPORT.md` içinde teslim anında kaydedilir. `tests/customer-switch.test.ts` taslak sınırını; `tests/workspace.test.tsx` yeni müşteri/iptal/onay/satış kaydını; `tests/e2e/customer-crm.spec.ts` eski veri, CRM ve satış değişimini; `tests/e2e/material-cost.spec.ts` USD katalog–kur–snapshot zincirini doğrular. Önceki altı browser senaryosu iki viewport'ta korunmuştur; eski otomatik müşteri aktarımı beklentisi yeni onay kararıyla güncellenmiştir.
