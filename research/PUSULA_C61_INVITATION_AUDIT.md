# PUSULA C6.1 — davet / Master Admin / TOTP denetimi

17.10.2026 · `feat/pusula-v030-neon-cloud` · Başlangıç `9a6ddcc`. Kullanıcı dosyaları korunur. Development kayıtları yalnız salt okunur denetlendi; gerçek operatör ile login/test/rotation yapılmadı. Değiştirilen fixture'lar yalnız `pusula_sprint_b_test` içindedir. Resend'e gerçek gönderim yapılmadı.

## Kanıtlanan kök nedenler

`src/server/auth/invitations.ts::inviteUser` önce session/membership/permission/step-up/Master kontrollerini geçiyor, ardından `AuthUser.email` bulunduğunda koşulsuz `{status:"not_created",delivery:"none"}` dönüyordu. `src/server/cloud/handler.ts::cloudRequest` bunu HTTP 200 olarak iletiyordu. Bu dalda `sendInvitation` çağrılmadığından ne yeni davet ne Resend çağrısı oluşur. Gözlenen yanıt, bu istek için step-up/yetki kontrollerinin geçmiş olduğunun da kod kanıtıdır; 200'ün kendisi e-posta başarısı değildir.

Development salt okunur gözlemi: iki kimlik, bir davet, sıfır mail delivery satırı; bootstrap kaydı mevcut. Yapılandırılmış bootstrap/test alıcısı mevcut aktif ve MFA etkin kimliğe eşleşiyor. Aynı tenant için sınırlı runtime/RLS sorgusu bir ACTIVE ve bir INVITED üyelik gösterdi. Mevcut davet kabul/iptal edilmemiş ve denetim anında süresi dolmamıştı. Kullanıcının ilk Network isteğinin adres payload'ı kaydedilmedi; bu nedenle hangi mevcut kimliğin girildiğine ilişkin kesin iddia yapılmaz. Her iki mevcut kimlik türü de eski koşulsuz dalı tetikler. Önceki raporlardaki “gerçek kullanıcı yok” durumu bu denetimde güncel değildir; mevcut kullanıcı silinmedi veya yeniden bootstrap edilmedi.

Değişiklik öncesinde izole **desktop + mobil gerçek browser** koşusunda mevcut test Master adresi davet edildi. İkisinde de HTTP 200/not_created, drawer kapanması ve yeni davet olmaması yeniden üretildi; 2/2 baseline geçti. Bu işlem gerçek operatörün credentials/TOTP bilgilerini kullanmadı.

`src/components/user-administration.tsx` HTTP 200 sonrasında iş sonucunu kontrol etmeden `setInvite(false)` çağırıyordu. Başarılı sonuç, iş reddi ve gönderim hatası kullanıcı açısından ayrışmıyordu. Listede yalnız ACTIVE filtresi bulunmadı; pending üyelikler zaten listeleniyordu. Eski search filtresinin yeni üyeyi gizlememesi için başarıda arama temizlendi.

`src/components/security-form.tsx` içindeki `verified` state'i MFA kurulum durumuydu. Step-up sonrası yine true kaldığı için aynı parola/TOTP formu render ediliyordu; sunucudaki `stepUpAt`/geçerlilik durumu hiç okunmuyordu. Backend'in beş dakikalık kanıtı izole testte doğru çalıştı; UX bu kanıtı göstermiyordu.

## Değişen sözleşme

- Aynı yetkili tenant'ta mevcut üyelik: **409 ALREADY_MEMBER**. Bekleyen üyelik: **409 ALREADY_PENDING**; açık yeniden gönderme kullanılmalı. Yetkili tenant üyeliğine eşleşmeyen kimlik: **409 INVITATION_UNAVAILABLE**, kimlik otomatik firmaya bağlanmaz veya terfi ettirilmez. Yetkisiz caller kimlik aramasından önce 401/403 alır.
- Yeni davet yalnız gerçekten kaydedilip taşıyıcı sonucu alındığında `created` döner. Kimlik ve tenant/user UNIQUE constraint'leri paralel oluşturmanın çift üyelik/mesaj üretmesini önler. Yarışı kaybeden çağrı güvenli conflict alır; bu sırada üyelik henüz commit olmadıysa genel INVITATION_UNAVAILABLE olabilir.
- Cloud hata cevapları güvenli UUID `requestId`, sabit hata kodu ve `X-Request-Id` içerir. Sunucu yalnız requestId/status/code loglar; body, e-posta, parola, cookie, token, TOTP ve sağlayıcı ham cevabı loglanmaz. Mevcut DB outage testi yeni minimal hata sözleşmesini doğrular.
- AuthInvitation lifecycle (NONE/PENDING/ACCEPTED/EXPIRED/CANCELLED), mevcut timestamp'lerden sunucuda türetilir; mail delivery durumundan ayrıdır. Mail kaydı PENDING/ACCEPTED/LOCAL_TEST/FAILED/**UNKNOWN** taşır. SDK'nın transport hatasını statusCode:null cevabına dönüştürdüğü gerçek kaynakta görüldü; gerçek SDK/sahte network testi bu durumu UNKNOWN olarak korur. HTTP 408/5xx ve geçersiz başarı cevabı da belirsiz sonuç olarak ele alınır. Eski token fail-closed iptal edilir; otomatik resend yapılmaz.
- Gönderim başarısızsa pending üyelik listede kalır. Mail ve davet durumları ayrı gösterilir; yeni token için yetkili explicit resend ve cooldown gerekir. Mevcut 24 saat/15 dakika tek kullanım, eski token iptali ve 30 saniyelik davet cooldown'u korunur.
- `GET /api/auth/step-up/status` yalnız o cookie session'ının güncel DB kanıtını, expiresAt ve serverTime döndürür; no-store. Beş dakikanın sınır anında veya geleceğe ait timestamp'te kanıt geçersizdir. Başka oturum/kimlik ve logout sonrası kanıt aktarılamaz. API her kritik işlemde bağımsız enforcement yapar.
- Ortak `StepUpVerification`: sunucu teyidi sonrası yeşil onay, kalan süre, yönetim bağlantısı; parola/kod/buton gizlenir. Yenilemede durum sunucudan okunur; expiry'de form döner. Focus ve 15 saniyelik kontrol iptal/session değişimini yeniden sorgular. İstemci sayacı yetki kaynağı değildir.
- Davette step-up gerekirse form üzerinde güvenli modal açılır. Alanlar korunur, doğrulama sonrası kullanıcı **yeniden açıkça oluşturmayı onaylar**; otomatik mail veya işlem replay yoktur. İşlemde timeout, busy ve tekrar tıklama kilidi vardır. Başarısızlıkta drawer açık ve alanlar dolu kalır; yalnız created+membershipId sonucunda kapanır, liste yenilenir ve gerçek taşıyıcı bildirimi gösterilir.
- TOTP login aşaması hesabı salt okunur gösterir; parola alanı kaldırılır, boş altı haneli kod odaklanır, ayrı doğrulama/kurtarma/hesap değiştir eylemleri vardır. Hareketli pusula tasarımı korunur.

## MFA yenileme sınırı

[MFA_RECOVERY](../docs/security/MFA_RECOVERY.md) resmî Better Auth belgesi ve kurulu plugin davranışına dayanan operatör prosedürü/uygulama kapısını içerir. Güvenli pending-factor swap, tüm session iptali, audit ve rollback ile tamamlanmış rotation bu sprintte uygulanmadı. Public disable/secret/recovery yenileme yolları açılmadı; gerçek operatör faktörüne dokunulmadı.

## Doğrulama ve sınırlar

Güncel komut sonuçları [LAST_REPORT.md](../LAST_REPORT.md) ve [AUTH_TEST_MATRIX](../docs/security/AUTH_TEST_MATRIX.md) içindedir. Otomatik Resend testleri mock transport/fetch kullanır; gerçek gönderim için ayrıca açık kullanıcı onayı ve sağlayıcının izin verdiği test alıcısı gerekir. C6'daki gerçek HTTP 403 sonucu, yeni anahtar/izinli alıcı doğrulanmadan başarılı sayılmaz. Kendi domaini/HTTPS uygulama adresi ve production kabulü ayrıdır.

Neon şema migration'ı gerekmedi; mevcut string mail status ve timestamp'ler kullanıldı. RLS, explicit DENY, Master MFA/step-up, immutable audit, son Master, default-deny ve session revocation korundu. Başka tenant'a mevcut global kimlik ekleme ve öksüz provisioning kaydını otomatik sahiplenme bu düzeltmede açılmaz; operatör incelemesi gerekir. Mevcut liste 200 üyeyle sınırlıdır; genel pagination bu sprint kapsamına eklenmedi. UI süre sayacı ağ gecikmesinde yaklaşık olabilir; sunucu yetkilendirmesi belirleyicidir.
