# İlk Master Admin ve hesap güvenliği

Bu kurulum yalnız onaylı Neon **development** veritabanını kullanır. Production dağıtımı değildir.

1. Git dışında kalan `.env.bootstrap.local` dosyasını yerelde doldurun: `BOOTSTRAP_EMAIL`, `BOOTSTRAP_NAME`, `BOOTSTRAP_PASSWORD` (12–128 karakter), `BOOTSTRAP_TENANT_NAME`, `BOOTSTRAP_COMPANY_NAME`. Parolayı sohbete/issue'ya göndermeyin. Güçlü, benzersiz bir parola kullanın.
2. Migration, auth rolü ve rol şablonları kurulu olmalı. `npm run auth:bootstrap` çalıştırın. Komut sırları yazmaz; ilk başarıdan sonra kalıcı bootstrap işareti yeni kurulumları engeller. Mevcut bir kimliği sessizce Master yapmaz. Kurulum kısmi hata verirse kapalı kalır; operatör incelemesi gerekir.
3. `/login` üzerinden giriş yapın, `/account/security` sayfasında parola ile TOTP kurulumunu başlatın. QR yerelde çizilir, üçüncü bir QR servisine gönderilmez. Kurtarma kodlarını güvenli bir yere kaydedin; yalnız bu adımda görüntülenir. Kodla kurulumu doğrulayın.
4. Master yönetimine erişim için MFA zorunludur. Rol/izin/pasifleştirme/davet ve oturum sonlandırma öncesinde aynı sayfada parola + TOTP ile yeniden doğrulama yapın; beş dakika geçerlidir. Trusted device ile MFA atlama kapalıdır. MFA kapatma ve recovery tekrar görüntüleme HTTP üzerinden açık değildir.
5. Kurulumdan sonra özel bootstrap dosyasındaki parolayı kaldırın veya dosyayı güvenli biçimde saklayın. Bootstrap dosyası bir yedek değildir. Son aktif Master uygulama işlemlerinde korunur; kendi erişimini değiştirmek yasaktır.

## E-posta sınırı

SMTP/API sağlayıcısı henüz bağlanmadı. Development taşıyıcısı davet/reset mesajlarını `.data/auth-mail/*.enc` içinde auth secret ile şifreli test iletisi olarak saklar. Gerçek e-posta gönderildiği iddia edilmez. Bu dosyalar ve secret Git dışındadır. Test okuyucusu yalnız sunucu/operatör kodudur; HTTP outbox endpoint'i yoktur. Production'da yerel taşıyıcı hata verir; gerçek sağlayıcı kurulmadan teslimat yapılamaz.

Kayıp TOTP ve tükenmiş recovery kodları için otomatik MFA kapatma akışı yoktur. Operatör kimlik doğrulaması ve denetlenebilir kurtarma prosedürü ayrıca gerekir; veritabanında gelişigüzel MFA bayrağı değiştirilmemelidir.
