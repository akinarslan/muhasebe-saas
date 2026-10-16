# Sprint C doğrulama kaydı

## C1 — 16.10.2026

Better Auth 1.7.10, ayrı auth SQL rolü, development/test migration ve gerçek cookie oturumları kuruldu. Public signup ve server-side provisioning dışındaki hesap oluşturma reddedilir. Auth rolü işletme tablolarını okuyamaz; runtime grants değişmedi.

Kapı: gerçek Neon auth 7/7; mevcut DB 11/11; Vitest 71/71; TypeScript ve lint başarılı. C1 yalnız temel oturumdur; MFA/yetki yönetimi sonraki kapılardadır. Production kullanılmadı.

## C2 — 16.10.2026

Gerçek Neon test DB'sinde ilk kurulumda 9/9: bootstrap kapanması, MFA öncesi reddetme, şifreli TOTP/recovery, hatalı kod, gerçek TOTP, parola+TOTP step-up, trust-device/recovery tekrar görüntüleme engeli, recovery tekrar kullanım reddi, append-only güvenlik olayı. TypeScript/lint başarılı.

Gerçek development bootstrap henüz çalışmadı: kullanıcının hazır yanıtına rağmen `.env.bootstrap.local` dosyası bulunamadı. Sırlar istenmeden dosya yolu tekrar bildirildi. Test fixture'ı yalnız test DB'de; kimlik bilgileri yerelde şifreli ve Git dışında.
