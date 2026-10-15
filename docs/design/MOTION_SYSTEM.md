# Ortak hareket sistemi

Amaç: hiyerarşiyi açıklamak; işlemleri animasyon bitişine bağlamamak. [Mimari](../../ARCHITECTURE.md), [yol haritası](../../ROADMAP.md), [design system](DESIGN_SYSTEM.md).

Görsel kurallar: mikro 160 ms, kart 200 ms, drawer 300 ms, modal 240 ms, sayfa 220 ms. Easing `cubic-bezier(.22,1,.36,1)`. Tokenlar `premium.css`; MotionConfig reducedMotion=user. GPU dostu transform/opacity tercih edilir; layout ölçümü veya sürekli JS render döngüsü yoktur.

Etkileşim: sidebar genişlik/kayma; sekmelerde yüzey geçişi; KPI hover -3 px; tablo hover rengi; drawer sağdan giriş; toast kısa başarı hareketi; kaliteli skeleton. Sayfa geçişleri kaydetme veya doğrulamayı bekletmez. Form state üst çalışma alanında kalır.

Pusula dış halka 120 s, iç katman 100 s ters, ibre 16 s salınım. Fare tepkisi en fazla birkaç derece; pointer leave sıfırlar. Yalnız giriş ve dashboard. Dashboard tercihi localStorage'da saklanır.

Responsive: mobilde büyük dashboard dekoru sınırlanır; girişte form önce okunabilir kalır. Erişilebilirlik: prefers-reduced-motion tüm CSS animasyonlarını durdurur; MotionProvider da kullanıcı tercihini izler. Otomatik odak animasyon süresinden bağımsızdır.

Kabul: veri girişi sırasında animasyon state sıfırlamaz; Escape çalışır; reduced-motion E2E, mobil taşma ve sayfa hata kontrolü geçer. Yoğun işlem ekranlarında büyük pusula bulunmaz.
