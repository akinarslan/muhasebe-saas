# Ekran blueprint'leri

[ROADMAP](../../ROADMAP.md) ve [ARCHITECTURE](../../ARCHITECTURE.md) korunur. Amaç her ekranın eylem hiyerarşisini açık tutmaktır; kullanıcı/rol güvenliği tasarım gösterimiyle karıştırılmaz.

Giriş: atmosferik marka sahnesi, metalik pusula, ayrı sade form paneli ve açık demo eylemi. Dashboard: karşılama/kısayollar, dönem/faaliyet, sekiz KPI, dört grafik, işlemler/tahsilatlar. Pusula yalnız arka planda ve tercihle kapatılabilir.

Satış: müşteri ve ürün seçimi → kalem/ölçü/tüketim → sabit fiyat/kur özeti. Maliyet hesaplayıcı aynı domain motorunu kullanır; USD ve TL yüzeyleri ayrıdır. CRM: segment ikonları, tablo filtreleri, bakiye durumu; detayda iletişim/notlar; yeni müşteri 480 px drawer.

Master Admin (v0.3 blueprint): kullanıcı listesi → davet/durum → rol şablonu → kaynak/eylem matrisi → allow/deny override → faaliyet/legal entity kapsamı → etkili izin özeti → gerekçe/onay → audit. Eylemler: Gör/Ekle/Düzenle/Onayla/İptal-Ters kayıt/Dışa aktar/Maliyet gör/Fiyat değiştir/Tahsilat/Ödeme. Explicit deny ve default deny sunucu politikasında uygulanacak; bu sürümde işleyen izin butonları gösterilmez.

Etkileşim/motion: kısa sayfa geçişleri, anlamlı hover, Radix drawer. Mobilde kolonlar sırayla yığılır; tabloda yerel scroll, 390 px'de sayfa taşması yoktur. Erişilebilirlik: metin etiketleri, klavye gezinmesi, reduced-motion ve demo kapsamı açıklaması.

Kabul: gerçek tarayıcı screenshot, kayıt/taslak regresyonları, yanlış pozitif güvenlik iddiası olmaması. Tasarım sistemi: [DESIGN_SYSTEM](DESIGN_SYSTEM.md).
