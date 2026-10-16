# PUSULA v0.3 — Sprint A / Neon kurulum kapısı

16.10.2026 · **v0.3 tamamlanmadı. Sprint A tamamlandı; Sprint B için staging bağlantısı bekleniyor.**

## Git ve yapılan çalışma

Dal: `feat/pusula-v030-neon-cloud`. Başlangıç/origin main `21fa89bb851f69673527a0bc3910ae15b0167746`; çalışma ağacı temizdi. Fetch yapıldı, main'de ek değişiklik yoktu; yeni dal güncel origin/main üzerinden açıldı. Sprint A commit'i **`b9c8701fbfa850811093816317fabf8d04380adb`** GitHub feature branch'ine push edildi. Bu sonuç raporu ek dokümantasyon commit'iyle aynı dala gönderilir. Main'e eksik v0.3 birleştirilmedi; force push/hard reset kullanılmadı.

Mevcut kod/mimari/tasarım belgeleri ve resmî Neon/Better Auth/PostgreSQL kaynakları incelendi. Neon, standart PostgreSQL + pooled uygulama/direct migration bağlantısıyla seçildi. Prisma ve standart PostgreSQL adapter'ı repository/service sınırında planlandı; paket kurulmadı. Managed Better Auth MFA desteği henüz yol haritasında olduğundan zorunlu Master Admin MFA için uygulamanın yönettiği Better Auth + TOTP seçildi. Bu bir mimari karardır, çalışan kimlik doğrulama değildir.

Uygulama kodu ve paket sürümü değiştirilmedi; v0.2.3 demo, müşteri değişim onayı, USD maliyet motoru, TCMB, premium pusula ve taslaklar korunur. `.env.example` dosyasına boş sunucu değişkenleri eklendi. Gerçek secret/URL veya tarayıcı kullanıcı verisi okunup commit edilmedi. [Önceki rapor](docs/history/PUSULA_V023_REPORT.md) arşivlendi.

## İstenen 11 durum cevabı

| Soru | Gerçek durum |
| --- | --- |
| Neon bağlantısı gerçekten kuruldu mu? | **Hayır.** `.env.local` ve DATABASE_URL/DIRECT_DATABASE_URL yok. Bağlantı/migration çalıştırılmadı. |
| Kullanılan Neon planı | Hesap/proje bilinmiyor. Hedef Free geliştirme; ücretli hizmet açılmadı. |
| PostgreSQL'de tutulan kayıtlar | Henüz hiçbiri; cloud modül geçişi başlamadı. |
| localStorage'da kalanlar | Demo müşteri/satış/borç/custom ürün, malzeme/varyant/USD fiyat geçmişi/gider/teklif; aktif taslak ve UI tercihleri. |
| Master Admin çalışıyor mu? | Hayır. Bootstrap/MFA/rol/özel izin tasarımı belgelendi; runtime uygulanmadı. |
| Özel izinler API'de uygulanıyor mu? | Hayır. Mevcut manuel kur token kontrolü gerçek kullanıcı RBAC yerine geçmez. |
| Yedekleme gerçekten çalışıyor mu? | Hayır. Bağımsız şifreli hedef, scheduler ve alarm tasarımı hazır; kurulmadı. |
| Restore testi yapıldı mı? | Hayır. İzole gerçek test DB ve backup hedefi olmadan başarı iddia edilmedi. |
| Mevcut kullanıcı verileri korundu mu? | Evet; uygulama veri yazma yolları değiştirilmedi, kullanıcı tarayıcısı temizlenmedi, otomatik import yok. |
| Hangi testler geçti? | Mevcut v0.2.3 build/lint +63 Vitest +20 Playwright. Bunlar cloud/auth/RLS kanıtı değildir. |
| v0.4 için ne eksik? | Sprint B–F: gerçek Neon/migration/CRUD/RLS, auth/MFA/API izinleri, kalıcı modüller/onaylı import, bağımsız backup ve restore, güvenlik/E2E kabulü. |

## Başlangıç doğrulaması

| Kontrol | Sonuç |
| --- | --- |
| npm run build | Başarılı, strict TypeScript, 7.29 s |
| npm run lint | Başarılı, 0 hata/uyarı |
| npm test | **63/63**, 9 dosya, 9.72 s |
| npm run test:e2e | **20/20**, desktop Chrome ve mobil Chromium, 1.3 dakika |
| Git secret sınırı | `.env.local` git check-ignore ile dışlanıyor; gerçek env/secret tanımlı değildi |

Testler izole demo context'lerinde çalıştı. Motion reduced-motion ve Node FORCE_COLOR bildirimi uyarıdır; başarısız test gizlenmedi. Sprint A yalnız belge/boş env değişikliği olduğu için mevcut kodun doğrulaması tekrar genişletilmedi. Yeni veritabanı/güvenlik testleri ilgili sprintlerde gerçek test veritabanıyla eklenecek.

## Oluşturulan belgeler

- [Neon mimarisi, fiyat/limit araştırması ve kurulum](docs/architecture/NEON_CLOUD.md)
- [Auth, kişisel izin matrisi, MFA ve RLS sözleşmesi](docs/security/AUTHORIZATION.md)
- [Bağımsız şifreli yedek ve restore prosedürü](docs/security/BACKUP_RECOVERY.md)
- [localStorage export/preview/onaylı idempotent geçiş](docs/migration/LOCAL_TO_NEON.md)
- [Sprint A kod ve güvenlik denetimi](research/PUSULA_V030_AUDIT.md)

## Devam için gerekli tek kurulum

Talimatın bağlantı/hesap gerektiğinde ilgili aşamada durma kuralı uygulanıyor. [Neon Console](https://console.neon.tech) içinde boş **Free development/staging** projesi hazırlayın. Connect'ten pooling ON ve OFF URL'lerini alıp proje kökündeki Git dışı `.env.local` dosyasına `DATABASE_URL` ve `DIRECT_DATABASE_URL` olarak ekleyin. Mevcut dosyanız varsa üzerine yazmayın. URL/parolayı sohbete veya GitHub'a koymayın; burada yalnız **hazır**, projenin **planı ve bölgesi** yeterlidir. Hesap parolası veya Neon API key gerekmiyor.

Gerçek bağlantı doğrulandıktan sonra Sprint B şema/migration/repository ve non-owner runtime rolü/RLS testleriyle devam eder. Auth e-posta taşıyıcısı/ilk yönetici kimliği ve bağımsız backup hedefi kendi aşamalarında istenecek. Production verisi test amacıyla silinmeyecek; v0.4 stok/alımlar ve v0.6 cari/kasa işlevleri bu çalışmada erkenden açılmayacak.
