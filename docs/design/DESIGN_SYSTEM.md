# Pusula design system — v0.2.2

Amaç: [ARCHITECTURE](../../ARCHITECTURE.md) içindeki modüler monoliti okunabilir, ortak bileşenlerle sunmak. [ROADMAP](../../ROADMAP.md) v0.3 kimlik/veri güvenliği sınırları korunur; görsel giriş gerçek auth değildir.

Görsel kurallar: Geist; lacivert #14243A, turkuaz #0D9488, mavi #3B82F6, mor #8B5CF6; yeşil/turuncu/kırmızı durum renkleri. Durum tek başına renkle aktarılmaz. Yüzeyler 8/12/16 px radius, 4 px spacing tabanı; tutarlı hafif shadow. `v02.css` temel, `premium.css` motion/focus tokenlarını taşır. Sidebar, NumericInput, Radix drawer ve Button ortak kaynaklardır; aynı iş için paralel bileşen yoktur.

Etkileşim: ham metin sayısal giriş, doğrulamada Decimal, boş değer sıfır değildir. Filtreler gerçek veri üretir. Focus görünür, ikon butonlarında ad zorunludur. İşlem durumu metinle gösterilir.

Responsive: 540 px mobil, 1000 px tablet, geniş masaüstünde bölünmüş çalışma alanı; tablolar kendi scroll yüzeyinde kalır. Form akış sırası klavyede korunur.

Animasyon: [MOTION_SYSTEM](MOTION_SYSTEM.md). Erişilebilirlik: Radix focus trap/Escape, semantik etiketler, reduced-motion, minimum 32–40 px etkileşim alanı.

Kabul: build/lint/unit/E2E; müşteri/taslak korunur; 390 px genişlikte sayfa yatay taşmaz; snapshot değerleri stil değişiminden etkilenmez. Gerçek rol kontrolü v0.3 sunucu katmanındadır.
