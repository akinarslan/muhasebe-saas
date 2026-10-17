# Pusula — Muhasebe SaaS ve Maliyet Atölyesi v0.2.2

Türkçe Next.js uygulaması. Yerel müşteri/satış/malzeme demosu korunur; v0.3 geliştirme ortamında Neon PostgreSQL, Better Auth + TOTP ve tenant kapsamlı kullanıcı/izin yönetimi vardır. Gerçek ödeme ve resmî muhasebe entegrasyonu yoktur.

v0.3 Sprint B/C: [Neon ve kurulum](docs/architecture/NEON_CLOUD.md), [kimlik ve yetkiler](docs/security/AUTHORIZATION.md), [Master kurulumu](docs/security/MASTER_ADMIN_SETUP.md), [son rapor](LAST_REPORT.md). İşletme ekranlarının buluta taşınması Sprint D kapsamındadır.

## Kurulum

`/login` gerçek giriş, `/app` doğrulanmış bulut başlangıcı, `/account/security` MFA, `/admin/users` kullanıcı/izin yönetimidir. `/` ayrı localStorage demosudur; pusula tercihi korunur.

Ham metin sayısal giriş, Decimal aritmetiği, LAN HTTP için ID fallback ve bir defalık `pusula.backup.v020` ham yerel yedeği eklendi. `1000`, `0.50`, `1,25` desteklenir; boş/geçersiz fiyatlar sıfır kabul edilmez. Binlik ayırıcı kullanmadan giriş yapın; gösterimde Türkçe para formatı kullanılır.

11 kullanıcı malzeme referansı mevcut USD fiyatlarını ezmeden eklenir. TRY/EUR fiyatları yalnız ilk kez **tarihsel** USD/TRY 49.4204 ve EUR/TRY 55.4110 üzerinden normalize edilir. USD maliyeti sonraki TCMB güncellemelerinde sabittir. Ölçüsü bilinmeyen malzeme onay bekler. Malzeme/tedarikçi ve yeni satılabilir ürün tanımları demodur; stok/alış hareketleri geliştirilmez.

E2E: `npm run test:e2e`. Kurulu Chrome kullanılır; testler ayrı browser context'inde mevcut kullanıcının localStorage'ını değiştirmeden çalışır. Port 3000'de aynı projeye ait sunucu varsa yeniden kullanılır. Ekran görüntüleri `docs/design/screenshots/`; tasarım belgeleri `docs/design/` altındadır.

Node.js 20.9+ (önerilen: 24 LTS) ve npm gerekir.

```powershell
npm install
npm run dev
```

Tarayıcıda http://127.0.0.1:3000 adresini açın.

```powershell
npm test
npm run lint
npm run build
npm start
```

Ortam npm'i çevrimdışı çalışmaya zorluyorsa `npm install --offline=false` kullanın. Windows kurumsal sertifika zinciri hatasında, güvenilir sistem sertifikalarını kullanmak için PowerShell oturumunda `$env:NODE_USE_SYSTEM_CA='1'` ayarlanabilir. TLS doğrulamasını kapatmayın.

## Demo akışları

- Genel Bakış: faaliyet ve tarih filtresiyle ortak kayıtlardan türetilen altı metrik, dört grafik, son satışlar ve bekleyen tahsilatlar.
- Satışlar: tek sayfa satış formu; ürün ekleme/çıkarma, miktar, ölçüler, iskonto, KDV, TRY/USD, peşin ödeme ve çok yöntemli vadeli tahsilat planı. Kaydetme dashboard ve cari bakiyeyi günceller.
- Müşteriler ve Cari: 32 hayalî müşteri; segment, il, ilçe ve bakiye filtreleri; TanStack sıralama, sekiz satırlı sayfalama, kolon görünürlüğü ve filtrelenmiş/sıralı CSV aktarımı.
- Yeni müşteri: 480 px Radix dialog paneli; form doğrulama, ad/VKN mükerrer kontrolü. Boş satışta yeni müşteri doğrudan seçilir; dolu taslakta seçim onay gerektirir. Vazgeç/Escape taslağı korur; onay yalnız aktif satış girdilerini temizler. Yeni müşteri kaydı ve tarihsel satışlar korunur. CRM kaydından sonra detay açılır. Odak yönetimi ve mobil tam ekran desteklenir.
- Malzeme Yönetimi: kullanıcı tarafından girilen USD/birim maliyetleri, yeni malzeme/varyant, stok uygunluğu ve tarih/eski değer/kullanıcı bilgisi içeren fiyat geçmişi.
- Teklif ve Maliyet: gerçek tüketim, çoklu malzeme/gider, marj veya maliyet üstü kâr, manuel net TL fiyat ve değişmeyen snapshot ile teklif arşivi. Satış satırının hesaplayıcısı aynı motoru kullanır.
- Kalan modüller açıkça Yakında olarak işaretlidir. Firma ve profil alanları demo bilgisi sunar; global arama müşteri detayına gider. Koyu/açık tema ve daraltılabilir/mobil menü çalışır.

## Veri ve hesaplama

`src/lib/types.ts` tenant, tüzel kişi, kullanıcı, müşteri, segment, ürün, satış, satır, ödeme planı, ödeme, alacak ve tedarikçi modellerini ayırır. Bunlar tenant izolasyonu veya güvenlik sağlamaz.

32 müşteri, 22 ürün/hizmet, 84 satış ve 24 tedarikçi borcu deterministik olarak oluşturulur. Tarihler ilk çalıştırma gününe göre üretilir. Sonraki açılışlarda saklanan veri kullanılır. Demo verileri `pusula.demo.v1`, satış taslağı `pusula.draft.v1`, tema `pusula.theme` localStorage anahtarlarındadır. Tarayıcının site verilerini temizlemek demoyu başlangıca döndürür. Sekmeler arası eşzamanlama ve sunucu yedeği yoktur.

Satış: miktar × net m² (baskı ürünlerinde) × birim fiyat × iskonto; ardından KDV. Rulo tüketimi tam rulo eni × paylı boy × adet üzerinden hesaplanır. 135 × 200 cm baskı, her kenarda 2 cm pay için gereken ölçü 139 × 204 cm'dir. 137 cm rulo reddedilir; 152 cm rulo **3,1008 m²** tüketir. m² maliyeti alanla, metretül maliyeti boyla çarpılır. Adet maliyeti miktarla; plaka maliyeti sabit yönde grid yerleşimiyle gereken tam plaka sayısıyla çarpılır. Döndürme/nesting optimizasyonu yoktur.

Ana alış maliyeti kullanıcı tarafından USD/birim olarak girilir; başlangıç rulo şablonlarının maliyetleri boştur. **Eski ZY Reklam listesi aktif fiyat kaynağı değildir.** Yeni ürün satırları fiyat/maliyet devralmaz. Eski hayalî v0.1 satışlarının örnek 42 kuru ve maliyetleri yalnızca `legacy-demo` fixture/migration snapshot'larında korunur; yeni fiyatlandırmada kabul edilmez. Eski taslak rakamları korunur ancak yeniden doğrulanmalıdır.

Toplam maliyet USD = malzemeler + üretim giderleri. Brüt marjda önerilen USD = maliyet / (1 − marj/100); maliyet üstü kârda maliyet × (1 + kâr/100). TL fiyat kaydedilen kurla çevrilir, KDV ayrı hesaplanır. Manuel net TL fiyat girildiğinde gerçek kâr/marj yeniden hesaplanır. Sıfır maliyetli hizmete manuel fiyat verilebilir; kullanıcı tüm giderlerini girmelidir. Ara tüketim/USD hassasiyeti korunur; TL tutarlar iki ondalığa yuvarlanır.

Brüt kullanılmayan alan ile kullanıcının ayırdığı yeniden kullanılabilir malzeme ayrıdır. Kullanılabilir alan yan şerit/plaka artığı sınırını aşamaz; kenar kesimleri dahil edilmez ve artık değeri maliyetten otomatik düşülmez. Stok miktarı düşümü/artık stoğu takibi yoktur.

Her satış/teklif malzeme, varyant, birim, tüketim, USD birim maliyeti, giderler ve kullanılan kuru bağımsız snapshot olarak saklar. Sonraki maliyet/kur değişiklikleri eski kârı değiştirmez. USD satışların cari/dashoard dönüşümü kendi işlem kuruyladır. Miktar/ölçü değişirse satır yeniden hesaplanmalıdır. Para birimini değiştirmek müşteri/ürün/açıklamaları korur, fiyat ve maliyet snapshot'larını yeniden doğrulama için sıfırlar.

## TCMB ve manuel kur

`GET /api/exchange-rate` sunucudan [TCMB XML](https://www.tcmb.gov.tr/kurlar/today.xml) alır; USD `ForexSelling / Unit` kullanır. Bu son yayımlanan gösterge kurudur, gerçek zamanlı piyasa kuru değildir. Yayın tarihi ve son başarılı çekilme zamanı gösterilir. Hata halinde `.data/exchange-rates.json` içindeki son başarılı TCMB kuru eski olabileceği uyarısıyla döner. Önbellek yoksa 503 döner; kur uydurulmaz ve fiyat sabitleme/satış kaydı kapalıdır. Hafta sonu/tatilde önceki yayın günü normal olabilir.

Eski shared-token manuel kur POST yolu kapalıdır. TCMB GET/demo hesapları korunur. Gerçek manuel kur yalnız `/api/cloud/exchange-rate` üzerinden session + `exchange.manual` + taze parola/TOTP doğrulamasıyla tenant kapsamına kaydedilir. `.env.local` dosyasını silmeyin veya örnek dosyayla üzerine yazmayın.

`.data/` yazılabilir olmalıdır. Yazımlar tek süreçte sıraya alınır ve geçici dosyadan atomik rename kullanır. Geçici sunucu diskinde veya çok sunuculu dağıtımda ortak kalıcılık garanti edilmez. Bu token kontrolü yalnızca manuel kur endpoint'ini korur; gerçek kullanıcı/rol/tenant güvenliği değildir.

Ek localStorage anahtarları: `pusula.pricing.v2` (katalog ve fiyat geçmişi), `pusula.quotes.v2` (teklif snapshot'ları). Henüz sabitlenmemiş hesaplayıcı girdileri panel kapanınca korunmaz; satışa uygulanmış snapshot ve kayıtlı teklif korunur. Teklif arşivi müşteriyle paylaşım/onay/fatura akışı değildir.

## v0.2 tasarım sistemi

Koyu lacivert, gruplanabilir ve daraltılabilir sidebar; altı renkli KPI kartı, gerçek veriyle mini trend/önceki dönem karşılaştırması ve detay panelleri; güçlü USD/TL sonuç kartları; rulo uygunluk/tüketim görseli ve müşteri segment ikonları eklendi. Tema, spacing, tipografi, radius ve shadow token'ları `src/app/v02.css` ile mevcut tema değişkenlerindedir. Masaüstü/tablet/mobil kuralları ve reduced-motion desteği korunur.

Dashboard filtresi satış tarihi ve borç kayıt tarihi üzerinden uygulanır. Alacak/borç kartları seçili dönemde oluşan kayıtların bugünkü kalan bakiyesini gösterir; geçmiş tarih itibarıyla muhasebe kesiti değildir. Yaklaşan ödeme önümüzdeki yedi gün içindeki borçları kapsar. Tahsilat planı gelecekteki sözlerdir; gerçekleşmiş ödeme sayılmaz. Kaydedilmiş planlar müşteri satış detayında görünür; ayrı taksit tahsilat işlemi bu sürümde yoktur.

## Kaynaklar

- Tasarım yaklaşımı: [Scrolltide UI](https://www.scrolltide.co/ui), özgün Pusula uygulaması.
- 81 il ve ilçeleri: [Türkiye API](https://turkiyeapi.dev/api/v1/provinces), [kaynak proje](https://github.com/ubeydeozdmr/turkiye-api). 15.10.2026 tarihinde indirilen veri `src/data/cities.json` içinde yalnızca il/ilçe adları olarak saklanır; çalışma anında API çağrısı yapılmaz. Kaynak yanıtı `cities-source.json` içinde korunur.
- Yerel Geist fontları: `@fontsource-variable/geist` 5.2.8, SIL Open Font License. Lisans: `public/fonts/OFL.txt`.
- shadcn/ui yaklaşımında yerel Button bileşeni (`components.json`, CVA, Slot); drawer Radix Dialog üzerine kuruludur. Diğer kontroller semantik HTML ile uygulanır.
- TCMB örnek yanıtı `tests/fixtures/tcmb-2026-10-15.xml` içinde kaynak doğrulaması için korunur; çalışma anında fiyat kaynağı olarak kullanılmaz.

Doğrulama sonuçları ve sınırlar için `LAST_REPORT.md` dosyasına bakın.

## Ürün ve mimari belgeler

[ROADMAP](ROADMAP.md) · [ARCHITECTURE](ARCHITECTURE.md) · [GitHub ilk README kaydı](docs/history/GITHUB_README_20261015.md)

## Sprint C kullanım ve kontroller

Mevcut development kurulumu için: `npm run db:migrate`, `npm run db:migrate:test`, `npm run auth:setup`, `npm run auth:roles`. Bu komutlar production hedefini reddeder. İlk gerçek yönetici için özel yerel bootstrap dosyasını doldurup `npm run auth:bootstrap`; ardından MFA kurulumu yapın. [Ayrıntılı adımlar](docs/security/MASTER_ADMIN_SETUP.md).

`npm run auth:test` gerçek izole Neon test DB'sindeki C1–C6.1 kapılarını sıralı çalıştırır. `npm run test:e2e:auth` ayrı 3100 portu/test DB'si ve şifreli hayalî fixture'larla browser akışını doğrular; auth trace/video kapalıdır. `npm run test:e2e` mevcut demo regresyonlarını 3000 portunda çalıştırır. Bu iki sunucunun build çıktıları ayrıdır.

Resend sunucu taşıyıcısı eklendi; doğrulanmış test alıcısı ve domain gereksinimleri [Resend kurulumunda](docs/security/RESEND_SETUP.md). Şifreli development taşıyıcısı korunur; API kabulü alıcıya teslim onayı değildir. Development hedef guard'ları değiştirilmeden production dağıtımı yapılmaz.
