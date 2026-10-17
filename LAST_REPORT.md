# PUSULA v0.3 — Sprint C6.1 / Davet ve TOTP UX düzeltmesi

17.10.2026 · Development / `feat/pusula-v030-neon-cloud` · **Davet, step-up ve TOTP giriş düzeltmesi. Production kabulü, canlı Resend teslimi veya tamamlanmış MFA rotation iddiası değildir.**

## Kök neden ve sonuç

`inviteUser`, herhangi bir mevcut `AuthUser.email` bulduğunda tenant üyeliği/davet durumunu ayırmadan `not_created/none` dönüyordu; controller HTTP 200 veriyor, drawer iş sonucunu kontrol etmeden kapanıyordu. Bu yanıt yoluna gelinmesi step-up/Master/permission kontrollerinin geçmiş olduğunu gösterir. Resend bu dalda çağrılmaz. Eski davranış gerçek masaüstü ve mobil tarayıcıda izole test kimliğiyle **2/2** yeniden üretildi.

Development salt okunur denetiminde iki kimlik, bir davet, sıfır mail kaydı, mevcut bootstrap ve aktif/MFA etkin operatör bulundu. Yapılandırılmış test alıcısı mevcut aktif hesaba eşleşiyordu; aynı tenant için sınırlı runtime/RLS sorgusu bir ACTIVE ve bir INVITED üyelik gösterdi. İlk kullanıcı isteğinin e-posta payload'ı elimizde olmadığından hangi mevcut adresin girildiği kesinleştirilmez. Mevcut hesapların koşulsuz aynı yanıtı alması kod ve browser kanıtıyla doğrulandı. Gerçek kullanıcı/operatör hesabı silinmedi veya yeniden kurulmadı.

Hesap Güvenliği ekranında `verified` yalnız MFA kurulumunu temsil ediyordu; step-up sonrası hâlâ aynı formu render ediyordu. Backend doğrulama kanıtı çalışıyordu, UI onu okumuyordu. Yeni durum API'si ve ortak doğrulama bileşeni bu ayrımı düzeltir.

Ayrıntılı dosya/fonksiyon kanıtı: [C6.1 denetimi](research/PUSULA_C61_INVITATION_AUDIT.md). Önceki [C6 raporu](docs/history/PUSULA_V030_SPRINT_C6_REPORT.md) arşivlendi.

## 12 kabul sorusunun yanıtı

| Soru | Gerçek sonuç |
| --- | --- |
| `not_created` neden dönüyordu? | Mevcut global kimlik için koşulsuz erken dönüş; artık HTTP 409 ALREADY_MEMBER / ALREADY_PENDING / genel INVITATION_UNAVAILABLE. |
| Davet Neon'a kaydediliyor mu? | Yeni uygun kimlikte AuthUser + pending Membership + hash/süreli AuthInvitation ve audit kaydı doğrulandı. İki eşzamanlı istekte tek davet/tek taşıyıcı çağrısı oluştu. |
| Step-up API tarafından tanınıyor mu? | Evet; geçerli kanıtla davet, eksik/expired kanıtla 403, başka kimlikte geçersizlik ve logout sonrası 401 test edildi. Beş dakika sınırında/future timestamp'te de geçersizdir. |
| Resend ne zaman çağrılıyor? | Yetkili yeni davet veya açık resend sonrasında; mevcut hesap conflict'inde çağrılmaz. Otomatik testler yalnız mock/local taşıyıcı kullanır. |
| Gönderim durumları nasıl saklanıyor? | AuthMailDelivery PENDING / ACCEPTED / LOCAL_TEST / FAILED / UNKNOWN. Invitation lifecycle ayrı timestamp'lerden PENDING/ACCEPTED/EXPIRED/CANCELLED türetilir. |
| Başarıda drawer kapanıyor mu? | Yalnız created + membershipId sonrası; liste yenilenir, arama temizlenir ve taşıyıcı sonucuna uygun bildirim görünür. |
| Hatada bilgiler korunuyor mu? | Evet; isim/e-posta korunur, panel açık kalır; requestId ile anlaşılır hata gösterilir. Başlangıçta rol verilmez; mevcut rol/özel izin yönetimi değişmedi. |
| Bekleyenler listeleniyor mu? | Evet; mevcut query yalnız aktifleri filtrelemiyordu. Pending, başarısız/iptal token ve belirsiz mail sonucu ayrı etiketlerle gösterilir. |
| TOTP UX düzeldi mi? | Sunucu teyidi sonrası yeşil onay/süre/yönetim bağlantısı; alanlar/buton gizlenir. Refresh durumu korur, expiry formu döndürür. Login TOTP aşaması read-only hesap, boş odaklanan altı hane ve ayrı doğrula/recovery/hesap değiştir eylemleridir. |
| Güvenlik korundu mu? | Better Auth/TOTP, Master, explicit DENY, tenant RLS, tek kullanımlı token, cooldown, audit, son Master ve session revoke korunur. Mevcut dış kimlik otomatik sahiplenilmez. |
| Test sonuçları? | Aşağıdaki gerçek komut sonuçları; başarısız denemeler ayrıca belirtilir. |
| Ne kaldı? | Gerçek Resend anahtar/alıcı kabulü/domain/HTTPS ve production onayı ayrı. MFA rotation çalışan özellik olarak açılmadı; belgeli operatör prosedürü/uygulama kapısı var. |

## Davet ve doğrulama davranışı

- Cloud hata cevabı yalnız sabit kod, güvenli requestId ve X-Request-Id içerir; sunucu aynı kimlik/statü/kodu loglar. Parola, cookie, token, TOTP, adres veya ham sağlayıcı mesajı loglanmaz.
- Sağlayıcı gönderimi başarısızsa pending üyelik görünür kalır; güvenlik için gönderim tokenı iptal edilir. Network/timeout, SDK statusCode:null/408/5xx ve eksik başarı ID'si belirsiz UNKNOWN durumudur; otomatik retry yoktur. Resend paneli kontrol edildikten sonra Master + step-up + cooldown ile açık resend yapılır; eski token geçersizdir.
- `GET /api/auth/step-up/status` yalnız o cookie session'ının taze DB kanıtını, expiry ve serverTime'ı no-store döndürür. UI süresi yaklaşık gösterimdir; kritik API her istekte yeniden yetkilendirir. Focus/15 saniyelik kontrol oturum kaybını da yeniden sorgular.
- Davette step-up gerekiyorsa aynı ekran üzerinde modal açılır. Bilgiler korunur; başarılı doğrulamadan sonra kullanıcı oluşturmayı **yeniden açıkça onaylar**. Otomatik replay/mail yoktur. Modal, reddedilmiş ve veri değiştirmemiş istek için liste yenilemesini beklemez.
- Buton busy/tekrar tıklama kilidi ve sınırlı ağ timeout'u kullanır. Yeni davet veya gönderim başlangıcında önceki başarı bildirimi temizlenir; yeni hata eski başarıyla karışmaz.

## Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| Başlangıç browser kök neden | **2/2** desktop/mobil; eski 200/not_created yeniden üretildi |
| Build / strict TypeScript | Başarılı |
| Lint | **0 hata / 0 uyarı** |
| Vitest | **99/99**, 16 dosya; önceki 93 korunur |
| PostgreSQL/RLS/Decimal | **11/11** |
| Önceki auth/API C1–C6 | **47/47** |
| Yeni auth/API C6.1 | **13/13**; toplam kapsam 60 kontrol |
| Demo Playwright | **22/22**, desktop/mobil, 1.4 dakika |
| Auth Playwright final | **2/2**, desktop/mobil, 2.5 dakika; pageerror ve beklenmeyen konsol hatası **0** |
| Gerçek e-posta | Bu görevde gönderilmedi; açık canlı test onayı ve sağlayıcı kabulü ayrıca gerekir |

Komutlar: `npm test`, `npm run lint`, `npm run build`, `npm run db:test`, `npm run auth:test`, `npm run auth:test:c61`, `npm run test:e2e`, `npm run test:e2e:auth`. `auth:test` artık C6.1'i de sıraya ekler; bu teslimde eski 47 ve yeni 13 ayrı başarılı komut koşularıyla doğrulandı. Auth fixture'ları yalnız izole test DB'sindedir; trace/video kapalıdır. Şema migration'ı gerekmedi.

İlk lint, render içindeki Date.now ve kullanılmayan import'u yakaladı; deterministik state ve import düzeltmesiyle geçildi, kurallar kapatılmadı. İlk düzeltilmiş browser koşuları 2/2 geçti; eklenen toast/hesap değiştirme son kontrolünde desktop login ve mobil modal beş saniyelik beklemeleri aşıldı. Snapshot'ta istekler hâlâ busy idi; HTTP sonucunu bekleyen test assertion'ları eklendi, modalın gereksiz liste beklemesi kaldırıldı ve final koşu build ile eşzamanlı başlatılmadı. Başarısız koşu başarılı sayılmaz.

Geliştirme sunucusunun önceden bilinen redirect `destination stream errored`, pg deprecation ve NO_COLOR kayıtları devam eder. Beklenen 401/403/409/429/502/503 negatif test hataları requestId ile loglanır. Son browser testi her projede dört beklenen HTTP konsol hatası ve **sıfır** beklenmeyen konsol hatası/pageerror doğruladı; sağlayıcı ham cevabı veya sır loglamadı. Desktop ve mobil hata drawer görüntüleri incelendi; eski başarı bildirimi görünmüyor, alanlar ve okunabilir hata korunuyor. Gerçek iOS/Safari ve ekran okuyucu sertifikasyonu yapılmadı. Paylaşılacak QR/recovery ekran görüntüsü üretilmedi. Geçici status bağlantı hatasının sonraki başarılı sunucu yanıtında temizlenmesi de birim regresyonuyla doğrulandı.

## Kapsam ve güvenlik sınırı

Gerçek operatörün login/TOTP/recovery bilgileri testlerde kullanılmadı. Development gerçek kayıtları yalnız salt okunur denetlendi; `.env.local` ve bootstrap dosyası değiştirilmedi. Production'a işlem, ücretli hizmet, veri temizliği veya Sprint D/v0.4/v0.5 geliştirmesi yapılmadı.

[MFA_RECOVERY.md](docs/security/MFA_RECOVERY.md) güvenli operatör prosedürünü ve pending-factor swap / session iptali / audit / rollback kabul kapısını belirtir. Kurulu Better Auth doğrulanmış faktöre doğrudan enable'ı reddeder; disable'ı açmak Master MFA sözleşmesini zayıflatacağından uygulanmadı. Gerçek faktör yenileme/kurtarma otomasyonu kalan iştir; DB'de rastgele MFA bayrağı değiştirilmedi.

C6 gerçek Resend denemesinin HTTP 403 sonucu, yeni anahtar/izinli alıcı doğrulanmadan başarı sayılmaz. C6.1 bu canlı testi tekrar etmez. API kabulü inbox teslimi değildir; webhook teslim/bounce takibi eklenmedi. Mevcut global kimliği başka tenant'a bağlama/öksüz provisioning sahiplenme otomasyonu ve 200 üyeyi aşan pagination bu düzeltmenin kapsamına eklenmedi.

## Git

Başlangıç `9a6ddcc`; mevcut `feat/pusula-v030-neon-cloud` üzerinde çalışıldı. Backend **`61a02da`**, UI **`b1f9808`** ayrı commit'ler olarak GitHub feature dalına başarıyla push edildi. Remote ancestry kontrolü geçti; main birleştirilmedi, force-push/hard reset yapılmadı. Backend 13 ve UI 7 staged dosya gerçek yerel sır/alıcı değerlerine karşı tarandı ve PASS aldı. Final production tarayıcı artifact'larında yapılandırılmış Resend anahtarı bulunmadı. Bu rapor ve denetim belgeleri ayrı dokümantasyon commit'iyle aynı dala gönderilir; `.env.local`, bootstrap, `.data`, generated ve test çıktıları Git dışındadır.
