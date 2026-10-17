# TOTP yenileme ve operatör kurtarma sınırı — C6.1

Bu belge prosedür ve güvenli uygulama planıdır; **çalışan bir MFA yenileme özelliği veya otomatik kurtarma CLI'si değildir**. Bu sprintte gerçek operatörün parolası, TOTP anahtarı ve recovery kodları değiştirilmedi. Public MFA disable/generate-backup/get-secret yolları kapalı kalır. QR/recovery içeren ekranlar test kanıtı olarak paylaşılmaz.

## Araştırma

[Better Auth resmî 2FA belgesi](https://better-auth.com/docs/plugins/2fa) ve kurulu `1.7.10` plugin kaynak kodu incelendi. `enableTwoFactor`, doğrulanmış bir TOTP mevcutsa `TOTP_ALREADY_ENABLED` ile reddeder. Genel `disableTwoFactor` parola kontrolünden sonra faktörü siler ve oturumu yeniler; Pusula'nın zorunlu Master MFA, çoklu oturum iptali ve denetimli yenileme sözleşmesini tek başına sağlamaz. Bu uçları doğrudan açarak “yenileme” yapılmadı.

## Bugün uygulanabilen operatör prosedürü

1. QR, secret veya recovery kodu görünmüş olabilecekse bunu güvenlik olayı olarak kayıt altına alın; olay kaydına gizli değeri/ekran görüntüsünü eklemeyin. Mevcut doğrulanmış erişimi kapatmadan önce kurtarma erişimini doğrulayın. Son Master korumasını atlamayın.
2. TOTP hâlâ erişilebiliyorsa mevcut parola+TOTP step-up ile yetkili yönetimden diğer oturumları iptal edin; iptalden sonra tekrar normal parola/TOTP ile giriş gerekir. Güncel hesap erişimi doğrulanmadan faktörü kaldırmayın. Parola sıfırlama, TOTP sırrını yenilemez.
3. TOTP kayıpsa mevcut tek kullanımlı recovery koduyla normal giriş yapılabilir. Recovery girişi kritik işlemler için TOTP step-up yerine geçmez. Başka bir doğrulanmış tenant Master'ın bulunması kurtarma incelemesine yardımcı olur; bir Master'ın başka kullanıcının MFA sırrını görmesine izin verilmez.
4. Recovery de yoksa veya faktör kompromize olmuşsa uygulamada güvenli otomatik yenileme tamamlanana kadar denetlenebilir operatör kurtarma incelemesine geçin. Kimliği bağımsız kanaldan doğrulayın, iki kişi onayı/olay numarası ve geçerli geri dönüş planı oluşturun. Kimlik kanıtı olmadan hesap açmayın, bootstrap işaretini silmeyin ve DB'de MFA bayrağı/secret/recovery satırını rastgele değiştirmeyin. Bu belgede güvenliği kanıtlanmamış bir SQL “kurtarma” komutu verilmez.

## Güvenli yenileme için kalan uygulama kapısı

- Mevcut kullanıcı + session + güncel parola/TOTP step-up; kurtarma halinde bağımsız operatör kimlik doğrulaması ve onay kaydı gerekir.
- Yeni secret ve recovery kodları **ayrı pending enrollment** kaydında, kullanıcı/oturum/amaç bağlı kısa ömürlü ve tek kullanımlı challenge ile hazırlanmalı. Mevcut doğrulanmış faktör, yeni TOTP kodu doğrulanana kadar geçerli kalmalı; kullanıcı kilitlenmemeli.
- Yeni kod doğrulanınca factor sürümü kilitlenerek tek transaction içinde yeni şifreli secret/kodlar etkinleşmeli, eski secret ve recovery kodları geçersiz olmalı. Aynı challenge ikinci kez tüketilememeli; yarış ve yarım kalma testleri yapılmalı.
- Tüm eski session/MFA/step-up kanıtları iptal edilmeli; yeni faktörle normal giriş zorunlu olmalı. İşlem başlangıç/onay/iptal/başarı audit'i yalnız aktör/hedef/olay/sürüm/tarih içermeli; secret/kod/QR içermemeli.
- Pending enrollment zaman aşımı veya iptalinde eski faktörün korunması, başarısız kod/rate-limit, concurrent rotation, eski kod reddi, çoklu session iptali, son Master ve rollback/restore testleri tamamlanmadan production'da açılmamalı.

C6.1 kullanıcı daveti/step-up UX düzeltmesi bu kapıyı tamamlamış gibi raporlanmaz.
