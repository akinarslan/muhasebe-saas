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
