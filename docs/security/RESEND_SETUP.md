# Resend — Sprint C6

Resend Node SDK `6.34.1` yalnız sunucuda kullanılır. Neon, Better Auth/TOTP ve yetki zinciri değişmez. Yeni `AuthMailDelivery` kayıtları token, bağlantı, alıcı adresi, finansal veri veya ham sağlayıcı hatası içermez. Kullanıcı yönetimi yalnız yetkili tenant üyelerinin son durumunu gösterir.

## Geliştirme testi

Git dışındaki `.env.local` dosyasındaki diğer anahtarları koruyarak ayarlayın:

```dotenv
AUTH_MAIL_PROVIDER=resend
AUTH_MAIL_MODE=test
RESEND_API_KEY= # yalnız yerelde gerçek değer
RESEND_TEST_RECIPIENT= # Resend hesabının izin verdiği doğrulanmış alıcı
BETTER_AUTH_URL=http://127.0.0.1:3000
AUTH_PUBLIC_URL=http://127.0.0.1:3000
AUTH_MAIL_ALLOW_LOCAL_LINKS=false
```

Test göndericisi daima `Pusula <onboarding@resend.dev>` olur; diğer alıcılara API çağrısından önce engel konur. Alıcıyı uygulamada tanımlamak, Resend hesabında doğrulamaz; sağlayıcı kısıtları ayrıca geçerlidir. Ayar değişikliğinde dev sunucusunu yeniden başlatın.

`npm run mail:test -- --send-live` yalnız bir bağlantısız test iletisi gönderir. Komut otomatik testlere dahil değildir; API yanıtı kabul edilmedikçe başarılı çıkmaz. API anahtarı/alıcı/ham yanıt loglanmaz. Ücretli hizmet açmaz.

Yerel davet/reset bağlantıları ancak geliştiricinin kendi çalışan uygulamasını kullandığı testte `AUTH_MAIL_ALLOW_LOCAL_LINKS=true` ile açılabilir. Bu açık onay yoksa localhost/özel ağ bağlantısı gönderilmez. Test modu production'da kapalıdır. Test dışı gerçek kullanıcılara localhost bağlantısı gönderilmez.

## Domain doğrulandıktan sonra

Resend hesabında kendi gönderici domaininizi DNS ile doğrulayın. Yayınlanan uygulamanın HTTPS origin'ini `BETTER_AUTH_URL` ve `AUTH_PUBLIC_URL` olarak aynı değere ayarlayın. `AUTH_MAIL_MODE=production`, `RESEND_FROM=Pusula <hesap@dogrulanmis-domaininiz>` ve `AUTH_MAIL_ALLOW_LOCAL_LINKS=false` kullanın. Kod değişikliği gerekmez. Mevcut development veritabanı hedef guard'ları production dağıtımına izin vermez; bu belge production kabulü değildir.

## Sonuç ve güvenlik sözleşmesi

- `PENDING`: gönderim başladı. `ACCEPTED`: Resend API kabul etti; alıcıya teslim onayı değildir. `LOCAL_TEST`: şifreli development taşıyıcısı; gerçek gönderim yok. `FAILED`: güvenli hata koduyla başarısız. Teslim/bounce webhook'u bu sprintte yoktur.
- Kota/rate-limit hataları davet API'sinde 429; diğer gönderim hataları 502 döner. Ham sağlayıcı mesajı gösterilmez. Kota dolunca plan otomatik yükseltilmez, toplu/otomatik retry yapılmaz.
- Davet 24 saat, reset 15 dakika ve tek kullanımlıktır. Davet yeniden gönderimi Master yetkisi, tenant kontrolü ve güncel parola+TOTP step-up gerektirir. 30 saniyelik tekrar sınırı vardır. Önceki davet tokenları atomik olarak iptal edilir. Başarısız gönderimin yeni tokenı da iptal edilir.
- Yeniden denemek için kullanıcı yönetimindeki bekleyen üyeyi açıp **Daveti yeniden gönder** kullanın. İlk gönderim başarısız olduğunda üyelik beklemede kalır; başarı bildirimi verilmez.
- Reset isteğinde bilinen/bilinmeyen hesap ve sağlayıcı hatası aynı genel `request_received` cevabını alır. Bu cevap gönderim onayı değildir. Resend taşıyıcısında sağlayıcının 15 saniyelik timeout'unun üzerinde 20 saniyelik yanıt tabanı ve mevcut rate-limit uygulanır; aşırı DB/ağ gecikmelerine karşı mutlak sabit süre garantisi değildir. Gönderilemeyen reset tokenı silinir; eski reset tokenları yeni istekte iptal edilir.
- E-postada yalnız işlem adı, süreli bağlantı ve güvenlik/test açıklaması vardır. Anahtar `NEXT_PUBLIC_` ile paylaşılmaz; yalnız `RESEND_API_KEY` okunur. Yerel taşıyıcı anahtar yokken geliştirme seçeneği olarak korunur ve production'da hata verir.
- İletinin her gönderim girişimi ayrı idempotency anahtarı kullanır. Sağlayıcı kabulünden sonra DB yazımı/bağlantısı kesilirse teslim durumu belirsiz kalabilir; otomatik yeniden gönderim yapılmaz. Operatör Resend panelini kontrol etmelidir.

## Doğrulama

`npm test`, `npm run auth:test:c6`, `npm run auth:test`, `npm run db:test`, `npm run test:e2e`, `npm run test:e2e:auth`, `npm run lint`, `npm run build`. Otomatik test taşıyıcıları gerçek e-posta göndermez; test DB'si ve development DB'si ayrıdır. Gerçek gönderim sonucu ve kalan gereksinimler [son raporda](../../LAST_REPORT.md) ayrı yazılır.

Resmî kaynaklar: [Node SDK](https://resend.com/docs/send-with-nodejs), [hata kodları](https://resend.com/docs/api-reference/errors), [test gönderimleri](https://resend.com/docs/dashboard/emails/send-test-emails), [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
