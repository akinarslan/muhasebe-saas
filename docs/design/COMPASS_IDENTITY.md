# Pusula marka kimliği

Amaç: işletmenin yönünü gösteren sakin bir kontrol merkezi. [Design system](DESIGN_SYSTEM.md), [Motion](MOTION_SYSTEM.md), [ROADMAP](../../ROADMAP.md), [ARCHITECTURE](../../ARCHITECTURE.md).

Görsel: özgün SVG katmanları; metalik gradient dış halka, ölçü çizgileri, koyu kadran, turkuaz yön iğnesi, ayrı iç yıldız ve pivot. Gerçek 3D motoru yerine SVG/CSS perspektifi; harici model/texture veya WebGL yoktur. Geist marka yazısı ve lacivert atmosfer korunur.

Etkileşim/animasyon: yavaş dış/iç dönüş ve hafif ibre hareketi. Girişte fare konumuna sınırlı Motion rotateX/Y tepkisi; dekor aria-hidden, form tıklamalarını engellemez. Dashboard düşük opacity ve kapatma tercihiyle kullanılır; sayıların üstüne çizilmez. Satış, CRM, malzeme ve maliyet ekranlarında bulunmaz.

Responsive: 540 px altında sahne daralır; giriş formu tam genişliğe gelir. Erişilebilirlik: yön bilgisi için animasyona ihtiyaç yoktur, reduced-motion statik kadran gösterir. Girişin demo olduğu sürekli belirtilir; gerçek şifre istenmez.

Kabul: giriş ve dashboard screenshot; diğer işlem ekranlarında data-compass yok; hareket kapatma kalıcı; JS animasyon frame döngüsü yok. Auth ve Master Admin yalnız v0.3'te uygulanır.
