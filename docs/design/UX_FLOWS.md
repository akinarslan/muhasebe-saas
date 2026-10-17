# Temel kullanıcı akışları

Amaç: [ROADMAP](../../ROADMAP.md) stabilizasyon kapısından premium deneyime veri kaybetmeden geçmek. Domain sınırları [ARCHITECTURE](../../ARCHITECTURE.md) ile aynıdır.

1. Giriş tasarım prototipi → açık demo bildirimi → demo çalışma alanı. Sahte kimlik doğrulama yoktur.
2. Satış → müşteri/faaliyet → ürün → ölçü → müşteri drawer → kaydet → dolu taslakta müşteri değiştirme onayı. Vazgeç/Escape eski müşteri ve taslağı korur; yeni müşteri kaydı kalır. Devam et ve temizle yalnız aktif taslağı temizleyip yeni müşteriyi seçer. Boş taslakta doğrudan seçilir. Segment değişimi aynı onayı kullanır; tarihsel satışlar etkilenmez. CRM kaydı sonrası yeni müşteri detayı açılır.
3. Malzeme → kullanıcı USD maliyeti → varyant/ölçü onayı → uygun rulo karşılaştırması → tüketim + gider → marj/markup → TCMB TL → KDV → snapshot → satış/teklif.
4. Müşteriler → arama/segment/il/ilçe → detay → satış/cari/tahsilat/notlar. Eksik modüller Yakında olarak görünür.

Görsel: akış numaraları, durum rozetleri, sabit sonuç kartı ve kaynak/tarih açıklaması. Etkileşim: boş/geçersiz sayılar hesap üretmez; kayıt hatası formu temizlemez. Seed mevcut USD fiyatını değiştirmez; ölçüsü bilinmeyen malzeme onay bekler.

Animasyon: drawer 300 ms, sayfa 220 ms, başarı toast; kullanıcı işlemi bloklanmaz. Responsive: sol müşteri/orta kalemler/sağ özet masaüstünde, mobilde aynı sırayla tek kolon. Erişilebilirlik: etiketler, Escape, focus trap, görünür focus, reduced-motion.

Kabul: Playwright masaüstü/mobil akışları; 46 eski test + yeni regresyonlar; snapshot ve taslak kaybı yok. Master Admin izinleri yalnız blueprint; sunucu enforcement v0.3'tür.

## C6.1 — gerçek hesap ve davet akışı

Gerçek `/login` parola aşamasından sonra ayrı salt okunur hesap + odaklanan altı haneli TOTP/kurtarma aşamasına geçer; hesap değiştirme ayrı eylemdir. Hareketli pusula ve ayrı yerel demo girişi korunur.

`/account/security` mevcut oturuma ait sunucu step-up durumunu okur. Doğrulamadan sonra form yerine yeşil onay, beş dakikanın kalan süresi ve kullanıcı yönetimi bağlantısı görünür. Yenilemede sunucu durumu korunur; expiry'de form geri gelir. İstemci state'i yetkilendirme değildir.

Kullanıcı yönetimi → yeni davet → gerekirse aynı ekran üzerinde parola/TOTP modalı → korunmuş davet formu → kullanıcının açık yeniden oluşturma onayı → Neon kayıt/taşıyıcı sonucu → yalnız created sonucunda kapanan drawer ve yenilenen liste. Otomatik replay/mail yoktur. Mevcut üye ve pending davet 409 ile açıklanır; hata paneli açık tutar. Yeni işlem başlangıcında eski başarı bildirimi temizlenir. API hata requestId'si destek kaydı için görünür; token/bağlantı gösterilmez.

Davet lifecycle ve e-posta sonucu iki ayrı gösterimdir. UNKNOWN sonucu otomatik retry tetiklemez; kullanıcı önce sağlayıcıyı kontrol eder. Yeni üyeye başlangıçta rol/izin atanmaz; mevcut altı sekmeli rol/ALLOW/DENY yönetimi korunur. MFA yenileme uygulaması yerine güvenli operatör prosedürü belgelenmiştir.
