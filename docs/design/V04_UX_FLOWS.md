# PUSULA v0.4 — V4.1 ekran akışları

19.10.2026 · **Akış tasarımı, ekran geliştirilmedi.** Mevcut premium lacivert/turkuaz dil, ortak SearchField, görünür dış focus, Lucide ikonları ve mobil tek sütun drawer yaklaşımı korunur. Gerçek çalışma `/app`, demo `/` ayrı kalır. [Servis/izin sözleşmesi](../architecture/V04_DOMAIN_SERVICES.md).

## Ortak davranış

Her liste yükleniyor/boş/filtre sonucu boş/yetkisiz/503 durumlarını ayırır; 503 boş stok gibi sunulmaz. Arama ve filtreler şirket/faaliyet kapsamını genişletmez. Para izni olmayan kullanıcıda maliyet kolonları, nested detay, tooltip, grafik, export ve ekran HTML/veri payload'ında değer bulunmaz. “Gizli” etiketi0 değildir. USD/TRY geçmişi kaynak ve kur yayın tarihiyle gösterilir; sonradan güncel kurla değişmiş gibi görünmez.

Klavye: sıralı tab, ikonlu butonda erişilebilir ad, drawer/modal focus trap ve kapanınca tetikleyiciye dönüş, form hatasının alanla ilişkisi, durum bildiriminde aria-live. Mobil tablolar detay kartı veya yatay scroll ile taşmadan kullanılır; action alanı görünür. Focus yalnız renk farkıyla anlatılmaz. Bunlar V4.6 browser kabul maddeleridir, bu teslimde görsel/ekran okuyucu testi yapılmadı.

Mutasyonda bekleme ve tekrar tıklama kontrolü aynı requestKey'i korur. Timeout sonrası “sonuç kontrol ediliyor” ve aynı anahtarla durum sorgusu; “başarısız” diye yeni key üretip stok tekrar işlenmez. Başarı yalnız commit/POSTED cevabından sonra gösterilir. Hata drawer içeriğini korur; navigasyon/şirket değiştirme/kapatma kirli formda açık onay ister. Kayıtlar localStorage'a gerçek veri otoritesi olarak yazılmaz. Miktar alanı yazarken string, server'a normalize decimal string; otomatik0 prepend yok.

## Tedarikçiler

Liste (şirket/faaliyet, ad/kod, aktiflik) → yeni kart drawer → kayıt → kart detayında **Malzemeler / Teklif geçmişi**. Varyant seç → supplier SKU, birim, MOQ, termin → bağla. Aynı varyant başka supplier'a da bağlanabilir. Teklif ekle → para birimi/orijinal fiyat/miktar eşiği/geçerlilik/dönüşüm → kaynak FX'li karşılaştırma önizlemesi → yeni sürüm kaydet. Ekranda “Malzemenin manuel USD ana maliyetini değiştirmez” açıklaması bulunur. Karşılaştırma izni yoksa teklif fiyatı açılmaz; kart bilgisi ayrı okunur. Kullanılmış kart silme yerine pasifleştirilir.

## Satın alma siparişleri

Liste → taslak: supplier + teslim şirket/faaliyet + malzeme/varyant + sipariş birimi/miktar + açık teklif sürümü veya yetkili manuel fiyat → Decimal/FX kontrolü → taslak kaydet → onay özeti → step-up → **Siparişi onayla**. Özet “Bu işlem stok girişi veya borç/ödeme oluşturmaz” der. Onay sonrası satır inline fiyat değişmez; yeni revizyon akışı kalan miktarı açıkça taşır ve eski revizyonda yeni kabulü kapatır.

Detayda sipariş/kümülatif fiziksel kabul/iade ayrı kolonlardır; iade otomatik teslim hakkı açmaz. Kısmi/tam kabul göstergesi server toplamından gelir. İptal/kapatma teslim edilmiş hareketleri silmez; kalan sipariş hakkını kapatır. Borç/Tahsilat ekranına gerçek finans hareketi varmış gibi bağlantı kurulmaz.

## Mal kabul

Onaylı sipariş → **Mal kabul oluştur** → tek depo/raf seç → kalan miktarlar → gerçekten gelen miktar, fiziksel paket/rulo/levha ölçüleri, parti/lot ayrımı → önizleme (purchaseQty→baseQty, maliyet izinliyse snapshot) → açık **Teslim al ve stok işle**. Siparişin tamamı varsayılan olarak teslim edilmiş sayılmaz. 152cm×50m için ana miktar50m, türetilen76m² açıklaması; iki bağımsız giriş alanı yoktur. Eksik en/dönüşüm/tarih reddi formu korur.

POSTED cevabında receipt/batch ID ve hareket bağlantısı; tekrar gönderim “Önceki işlem bulundu” ile aynı sonucu gösterir. Farklı payload409 kullanıcıya iki kez işlem yapıldığı iddiası üretmez. Sayım freeze varsa ilgili lokasyon ve çözüm yolu gösterilir. İade: kabul detayından lot/miktar seç → kalan iade hakkı+eldeki stok kontrolü → gerekçe/onay → fiziksel çıkış. Para iadesi/tedarikçi borcundan düşme v0.6.

## Depolar ve stok

Depo/raf listesi → stok lotları → varyant/tedarikçi/kabul/parti filtreleri → lot detayı: başlangıç geometri, mevcut **tek temel bakiye**, türetilen alan, lokasyon ve hareketler. Eski manuel inStock bayrağı miktar diye gösterilmez; profile/stock geçmişi olmayan materyalde “Envanter takibi açılmadı”. Lot değerleme izni yoksa miktar görünür, edinim USD/TRY gizlidir.

Transfer → lot/kaynak/hedef/miktar → iki yönlü hareket özeti → onay → tek batch. Rulo bölme v0.5: rulonun kalanının tamamından az transfer açık hata verir. Başarısız transfer iki depoda kısmi değişiklik gibi gösterilmez. Şirketler arası transfer bu modelde desteklenmez; şirketler arası satış/alış belgesi olmadan depo transferi seçilemez.

## Hareket geçmişi

Tarih (postedAt varsayılan, iş tarihi ayrı), tür, varyant, lot, konum, kaynak belge ve aktör filtreleri. Append-only satırda düzenle/sil yoktur. Kaynak receipt/return/count/transfer ve ters batch bağlantıları görünür; transfer iki satırın birlikte tek olay olduğunu gösterir. Toplamlarda birimler ayrı tutulur; transfer şirket toplam stoğunda0'dır. Yetkili **Ters kayıt oluştur** → bağımlılık/yeterli stok kontrolü → gerekçe+step-up → yeni hareketler. Geçmiş satır kaybolmaz.

## Sayım ve düzeltme

Konum seç → **Sayıma başla** onayı (“Bu konumun stok işlemleri sayım bitene kadar durur”) → server cutoff/expected snapshot → gözlenen miktarlar → farklar → bağımsız countApprove yetkisi+step-up → düzeltme özeti ve ledger posting → freeze kaldır. Aynı lokasyonda ikinci açık sayım409; diğer konumlar kullanılabilir. Sayımdan vazgeçme yalnız countCancel ile audit'li freeze kaldırır; gözlem stok değiştirmez. Bilinmeyen lot bulunduğunda otomatik sıfır maliyetli giriş yapılmaz; onaylı açılış/düzeltme sürecinin eksik olduğu belirtilir.

## Makine kataloğu

Makineler / Prosesler sekmeleri → marka/model/type/teknik ölçüler → capability ekle (proses+tam medya varyantı+mode+en/kalınlık/teknoloji ve doğrulama) → yetkili doğrulama → ürün/reçete seçeneği eşleştir. RollUV, UV DTF, FlatbedUV veya lazer ahşap/pleksi uygunluğu isim eşleşmesinden türetilmez. Seed/şablon bir makinenin işletmede bulunduğunu iddia etmez.

USD tarifeler ayrı izinli sekme → basis unit + ayrık gider bileşenleri/setup + başlangıç tarihi → toplam kontrolü → yeni sürüm. Mevcut tarihsel tarife edit edilmez. Makineyi görmek maliyet tarifesini görme yetkisi vermez.

## Ürün reçeteleri

Mevcut CloudProduct detayından reçete → yeni taslak sürüm → malzeme varyantları, whitelist miktar kuralı, birim, allowance, optional satır/proses → uyumluluk ve eksik fiyat kontrolleri → USD/TRY önizleme (izinli kullanıcı) → publish/onay. Publish sonrası eski reçete/satır edit edilmez; yeni revizyon oluşturulur. Ekranda “Planlanan maliyet; stoktan tüketim yapmaz” açıklaması. Gerçek üretim/sarf/fire v0.5, cari/ödeme v0.6; bu sprintte bu aksiyonlar varmış gibi buton sunulmaz.
