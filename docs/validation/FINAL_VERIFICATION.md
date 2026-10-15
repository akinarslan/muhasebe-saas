# v0.2.2 doğrulama — 15.10.2026

- Üretim build: başarılı, strict TypeScript; `/`, `/login`, dinamik `/api/exchange-rate`.
- ESLint: 0 hata, 0 uyarı.
- Vitest: 8 dosyada 54/54 başarılı. Önceki 46 test korunur; sayı girişi, ID fallback, null/eski müşteri şeması, idempotent seed, Vinil 3.4272 USD, eksik fiyat ve EUR eklenmiştir.
- Playwright: 12/12 başarılı, Chrome desktop 1280 × 720 ve Chromium iPhone 13 emülasyonu 390 × 664; gerçek iOS/Safari testi değildir.
- Gerçek tarayıcı akışları: müşteri drawer/kaydet/taslak/yenileme; randomUUID ve structuredClone olmayan ortam; temizleme/1000/Türkçe ondalık; malzeme fiyatının hesaplayıcıya aktarımı; snapshot; responsive taşma; reduced-motion; pusulanın yalnız giriş/dashboard'da olması ve kalıcı kapatma tercihi; yeni ürün/klavye Escape.
- Görüntüler: [masaüstü giriş](../design/screenshots/desktop-login.png), [mobil giriş](../design/screenshots/mobile-login.png), [masaüstü dashboard](../design/screenshots/desktop-dashboard.png), [mobil dashboard](../design/screenshots/mobile-dashboard.png). Geliştirme sunucusunda üretilmiş gerçek demo görüntüleridir.

İlk premium koşuda 11/12 geçti. Bir mobil test, hydration öncesinde `isVisible()` kontrol edip kapalı menüdeki ada ulaşamadığı için zaman aşımına uğradı. Kalıcı erişilebilir buton adları eklendi ve test menü açılma durumunu bekleyecek şekilde düzeltildi. Son değişmeden çalıştırılan tam koşu 12/12, 43.1 saniye başarılıdır. Başarısız koşu başarı sayılmadı.

Ekran okuyucu sertifikasyonu, gerçek telefon/iOS Safari ve sürekli performans/Lighthouse bütçesi bu teslimde ölçülmedi. SVG/CSS transform animasyonları, Motion reducedMotion ve sayfa taşması kontrol edildi. Görsel kalite otomatik testin tek başına sonucu değildir; masaüstü/mobil ekran görüntüleri ayrıca incelendi.
