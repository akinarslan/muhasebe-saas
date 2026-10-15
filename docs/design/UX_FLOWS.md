# Temel kullanıcı akışları

Amaç: [ROADMAP](../../ROADMAP.md) stabilizasyon kapısından premium deneyime veri kaybetmeden geçmek. Domain sınırları [ARCHITECTURE](../../ARCHITECTURE.md) ile aynıdır.

1. Giriş tasarım prototipi → açık demo bildirimi → demo çalışma alanı. Sahte kimlik doğrulama yoktur.
2. Satış → müşteri/faaliyet → ürün → ölçü → müşteri drawer → kaydet → otomatik seç → taslak korunur → yenilemede geri gelir.
3. Malzeme → kullanıcı USD maliyeti → varyant/ölçü onayı → uygun rulo karşılaştırması → tüketim + gider → marj/markup → TCMB TL → KDV → snapshot → satış/teklif.
4. Müşteriler → arama/segment/il/ilçe → detay → satış/cari/tahsilat/notlar. Eksik modüller Yakında olarak görünür.

Görsel: akış numaraları, durum rozetleri, sabit sonuç kartı ve kaynak/tarih açıklaması. Etkileşim: boş/geçersiz sayılar hesap üretmez; kayıt hatası formu temizlemez. Seed mevcut USD fiyatını değiştirmez; ölçüsü bilinmeyen malzeme onay bekler.

Animasyon: drawer 300 ms, sayfa 220 ms, başarı toast; kullanıcı işlemi bloklanmaz. Responsive: sol müşteri/orta kalemler/sağ özet masaüstünde, mobilde aynı sırayla tek kolon. Erişilebilirlik: etiketler, Escape, focus trap, görünür focus, reduced-motion.

Kabul: Playwright masaüstü/mobil akışları; 46 eski test + yeni regresyonlar; snapshot ve taslak kaybı yok. Master Admin izinleri yalnız blueprint; sunucu enforcement v0.3'tür.
