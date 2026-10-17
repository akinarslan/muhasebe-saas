# Sprint C doğrulama kaydı

## C1 — 16.10.2026

Better Auth 1.7.10, ayrı auth SQL rolü, development/test migration ve gerçek cookie oturumları kuruldu. Public signup ve server-side provisioning dışındaki hesap oluşturma reddedilir. Auth rolü işletme tablolarını okuyamaz; runtime grants değişmedi.

Kapı: gerçek Neon auth 7/7; mevcut DB 11/11; Vitest 71/71; TypeScript ve lint başarılı. C1 yalnız temel oturumdur; MFA/yetki yönetimi sonraki kapılardadır. Production kullanılmadı.

## C2 — 16.10.2026

Gerçek Neon test DB'sinde ilk kurulumda 9/9: bootstrap kapanması, MFA öncesi reddetme, şifreli TOTP/recovery, hatalı kod, gerçek TOTP, parola+TOTP step-up, trust-device/recovery tekrar görüntüleme engeli, recovery tekrar kullanım reddi, append-only güvenlik olayı. TypeScript/lint başarılı.

Gerçek development bootstrap henüz çalışmadı: kullanıcının hazır yanıtına rağmen `.env.bootstrap.local` dosyası bulunamadı. Sırlar istenmeden dosya yolu tekrar bildirildi. Test fixture'ı yalnız test DB'de; kimlik bilgileri yerelde şifreli ve Git dışında.

## C3 — 16.10.2026

Gerçek Neon 8/8: session->membership; sahte membership seçimi reddi; hash davet token'ı/tek kullanım; rol ve override kalıcılığı/audit; izin kaldırmanın mevcut oturuma anında etkisi; self-change/stale version reddi; serialized last-master koruması; session revoke/pasifleştirme; tenant audit RLS ve append-only. Karar motoru 10/10 birim testi. TypeScript/lint başarılı.

Başlangıçtaki C3 advisory lock sorgusu Prisma void dönüş tipi yüzünden başarısızdı; text cast sonrası kapı geçti. Bu başarısız koşu başarılı sayılmadı. Şablon seed'inin transaction süresi açıkça sınırlandı. Gerçek yönetici dosyası olmadığından kullanıcı isteği doğrultusunda hesap açılmadı; boş yerel şablon ve kurulum belgesi hazırlandı. SMTP yok; test carrier gerçek teslimat değildir.

## C4 — 16.10.2026

Gerçek Neon/HTTP 11/11: 401/sahte kimlik; faaliyet düzeyinde filtrelenmemiş SQL RLS; çapraz tenant/şirket; sahte payload alanları; müşteri create+audit; pozitif USD alan projeksiyonu; yetkisiz fiyat/kur 403; Decimal fiyat geçmişi/audit; tenant'a özel immutable manuel kur; cross-origin reddi; mevcut oturumda yetki kaldırma. Mevcut DB 11/11, Vitest 81/81, TypeScript/lint başarılı.

Eski global manuel kur shared-token POST yolu güvenlik gerekçesiyle kapatıldı; TCMB GET/demo hesapları korunur. Eski manuel POST testleri yeni kapanma sözleşmesini doğrular; gerçek yetkili kur/validation yeni Neon suite'inde doğrulanır. Firma RLS korunur; app.user_id olan cloud transaction'ları ek action/activity/own politikalarına tabidir. Kimliksiz eski internal DAL yalnız Sprint B iç kullanımındadır, HTTP'ye açılmaz.

Metadata migration'ı ilk denemede PowerShell UTF-8 BOM nedeniyle 42601 verdi; henüz uygulanmamış dosyanın BOM'u kaldırıldı, sadece başarısız kayıt rolled-back işaretlendi ve iki development DB'de deploy geçti. Başarılı migration değiştirilmedi/veri silinmedi. Ham Prisma teşhis çıktısı otomatik inceleme tarafından reddedildi; yalnız hata kodu/kategori teşhisi kullanıldı.

## C5 — son doğrulama

- Son `npm run auth:test`: **41/41** gerçek Neon kontrolü (C1 7, tekrar C2 7, C3 8, C4 11, C5 8). İlk C2 enrollment koşusu ayrıca 9/9 idi; tekrar kullanılan MFA fixture'ında enrollment iki kez yapılmaz. Browser suite her seferinde yeni kullanıcıyla enrollment yapar.
- Son Vitest **81/81**, 12 dosya; eski 71 testlik kapsama 10 policy testi eklendi. Eski 7 shared-token kur testi, kapatılan yolun yeni güvenlik sözleşmesine göre güncellendi; yetkili kur/validation gerçek Neon C4 kontrollerindedir.
- Sprint B DB **11/11**, build/strict TypeScript başarılı, lint 0 hata/uyarı.
- Demo Playwright **22/22**, masaüstü ve mobil, 1.3 dakika. Giriş tasarım prototipi bildirimi gerçek session/demo ayrımı olarak güncellendi; pusula ve tercih akışı korunur.
- Auth Playwright **2/2**, iki uzun uçtan uca senaryo: gerçek parola girişi, MFA öncesi sayfa engeli, QR/TOTP enrollment, recovery ilk gösterim, password+TOTP step-up, ALLOW/DENY preview/save/reopen, mobil yatay taşma, çıkış ve MFA ile tekrar giriş. Sayfa JavaScript hatası 0. Yeni API/browser fixture'ları ayrı test tenant'larında; trace/video kapalıdır.
- Doğrudan development auth bağlantısı ayrıca başarılı; gerçek kullanıcı sayısı **0**, bootstrap henüz kapanmamış. Bu, gerçek operatör kurulumu tamamlandı demek değildir.
- `npm audit --omit=dev`: 0. Tam audit: dev-only braces zincirinde 5 high; registry'de yamalı sürüm bulunmadı, Next14 major downgrade uygulanmadı.

## Başarısız denemeler ve sınırlar

Son başarılı koşudan önce QR Base32 test dönüşümü, kayıttan sonra eski liste state'i ve mobil toast'ın Yönet düğmesini örtmesi bulundu; düzeltildi. Beş saniyelik varsayılan assert soğuk dev metadata yenilemesine yetmediği için test önce PATCH sonucunu, sonra yenilenmiş listeyi sınırlı süreyle bekler. Mobilin ilk browser paket ayarı kurulu Chrome'a düzeltildi. Takılan tanı koşuları kesildi, başarı sayılmadı.

Tekrar C3 last-master testi, önceki browser fixture'larının aynı tenant'a Master eklemesiyle yanlış varsayım yaptı; test ayrı tenant'a alındı ve tüm C1–C5 sıralı suite sonrasında geçti. Generated `.next-auth-e2e` ilk lint kapsamına girdi; yalnız generated/test/private çıktı klasörleri ignore edilerek gerçek kaynak lint'i temizlendi. Kod kuralları devre dışı bırakılmadı.

Next geliştirme sunucusu bazı korunan sayfa yönlendirmelerinde `destination stream errored` kaydı ve adapter/pg `client.query` deprecation uyarısı üretir. Gerçek HTTP beklenen 401/403/redirect sonuçları ve browser JS hata kontrolü geçmiştir; bu uyarılar gizlenmedi. Production başlangıç/operasyon kabulü, gerçek cihaz/Safari ve tam accessibility sertifikasyonu ayrıca yapılmalıdır. Görseller hayalî test kullanıcılarıdır; MFA QR/recovery ekranları paylaşılmaz.

## C6.1 — 17.10.2026

- Değişiklik öncesi gerçek browser baseline: **2/2**, mevcut test kimliğinde HTTP 200/not_created ve drawer kapanması masaüstü/mobilde yeniden üretildi. Resend veya gerçek operatör credentials kullanılmadı.
- Yeni `npm run auth:test:c61`: **13/13** gerçek izole Neon/HTTP kontrolü. Mevcut/pending üye conflict, requestId, yetkisiz istek gizliliği, geçerli/eksik/expired step-up, concurrent create tek mesaj, liste lifecycle/delivery, başka kimliğe kanıt aktarımının reddi, explicit DENY, eşleşmeyen kimliği firmaya bağlamama, forbidden/rate-limit/network/provider failure, explicit resend ve logout.
- Mevcut C1–C6: **47/47** korundu. C5 outage testine yeni minimal requestId sözleşmesi assertion'ı eklendi. C6 eski token/tek kullanım/reset kontrolleri korunur. Yeni toplam auth/API kapsamı **60 kontrol**; paket `auth:test` C6.1'i de sıraya ekler.
- Vitest **99/99**, 16 dosya. C6'daki 93 test korunur; expiry sınırı/lifecycle, server-confirmed UI, remount/expiry/fail-closed, TOTP focus/read-only/recovery/account switch ve gerçek SDK normalized network gizliliği eklendi.
- Son build ve strict TypeScript başarılı; lint 0 hata/uyarı. PostgreSQL/RLS suite **11/11**. Demo browser **22/22**, 1.4 dakika.
- Auth browser final **2/2**, 2.5 dakika: başarı paneli/yenileme, 409 drawer/input koruma, modal step-up ve form devamı, pending conflict, sahte provider failure, yanlış eski başarı bildiriminin görünmemesi, TOTP odak/hesap değiştirme ve logout desktop/mobilde geçti. Her projede dört beklenen HTTP konsol hatası; sıfır beklenmeyen konsol hatası ve pageerror. Hata drawer PNG'leri incelendi; sır/QR/recovery içermeyen hayalî fixture'lardır ve Git dışındadır.
- Development salt okunur denetiminde mevcut operatör/MFA ve pending üyelik bulundu. Gerçek operatörle destructive test yapılmadı; gerçek mail gönderilmedi. Şema/migration değişikliği gerekmedi.

İlk C6.1 lint, render sırasında `Date.now()` çağrısını ve kullanılmayan test import'unu yakaladı. State başlangıcı deterministik yapılıp import düzeltildi; kurallar kapatılmadı. İlk UI görsel incelemesinde önceki başarının toast'ı yeni hata sırasında görünüyordu; yeni davet/submit başlangıcında temizlenmesi ve regresyon assertion'ı eklendi. Geçersiz/eksik/çakışan isteklerin beklenen 401/403/409/429/502/503 kayıtları requestId ile güvenli loglanır. Eski Next development redirect stream, pg deprecation ve NO_COLOR uyarıları devam eder; browser pageerror kontrolü ayrıca yapılır.

TOTP rotation için çalışan bir endpoint eklenmedi; [belgeli operatör prosedürü/kalan kapı](MFA_RECOVERY.md) ve [kök neden denetimi](../../research/PUSULA_C61_INVITATION_AUDIT.md) geçerlidir.
