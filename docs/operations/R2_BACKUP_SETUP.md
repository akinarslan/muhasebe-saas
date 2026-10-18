# R2 yedek kurulumu — kullanıcı kurulumu bekliyor

18.10.2026. Plan; çalışan entegrasyon değildir.

1. Cloudflare Dashboard > R2 içinde hesap durumunu ve mevcut bucket'ları kontrol edin. Aktivasyon/ödeme veya ek servis kabulünü hesap sahibi açıkça onaylamalıdır; bu görevde yapılmadı.
2. `pusula-backups-development` varsa ayar/içeriğini doğrulayın; yeniden oluşturmayın veya üzerine yazmayın. Yoksa hesap sahibi Standard private bucket oluştursun; mümkünse EU yerleşimi seçilip gerçek ayar kaydedilsin.
3. Public Development URL (`r2.dev`) ve bütün custom domain erişimleri kapalı olmalı. Workers/public proxy veya paylaşılabilir presigned URL açılmasın. S3 endpoint'i internetten ulaşılabilir kalır; nesneler yalnız doğrulanmış S3 istekleriyle erişilir.
4. Yalnız bu bucket için Object Read & Write S3 kimliği; Admin yetkisi yok. Bu hazır izin silme yetkisi de içerebilir; append-only olduğu iddia edilmez. Motor silme yapmayacak; daha dar/geçici kimlik ayrıca değerlendirilecek. Restore ayrı Object Read, retention ayrı onaylı operatör kimliği kullanmalı.
5. Account ID, S3 Access Key ID ve Secret Access Key'i sohbet/Git yerine Git dışı `.env.local` içine ekleyin; mevcut satırları koruyun. `.env.example` alanları henüz backup motoru tarafından tüketilmiyor. Sırları rapor veya ekran görüntüsüne koymayın.
6. S3 bucket-scope anahtarı public ayarların kapalı olduğunu tek başına kanıtlamaz. Hesap sahibinin ayar kontrolü veya ayrı salt okunur yönetim erişimi gerekir.
7. PostgreSQL18 pg_dump/pg_restore kurulup sürümleri doğrulanmalı. Kaynak direct/unpooled + TLS verify-full; owner/runtime/auth hesabı backup hesabı yapılmamalı. FORCE RLS tablolarının tamamını okuyacak ayrı backup rolünün güvenlik modeli gözden geçirilmeli; eksik dump yerine fail-closed davranılmalı. Rol/grant uygulanmadı.
8. Ayrı boş restore DB'si ve açık hedef onayı hazırlayın. Development veya dolu sprint test DB'sini kullanmayın. Fingerprint/allowlist/izolasyon doğrulanmadan restore yok.

Kaynaklar: [Başlangıç](https://developers.cloudflare.com/r2/get-started/), [tokenlar](https://developers.cloudflare.com/r2/api/tokens/), [public erişim](https://developers.cloudflare.com/r2/buckets/public-buckets/), [Neon pg_dump](https://neon.com/docs/manage/backup-pg-dump). [Denetim ve maliyet](../../research/PUSULA_V030_SPRINT_E_AUDIT.md).
