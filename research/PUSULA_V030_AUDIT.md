# PUSULA v0.3 — Sprint A denetimi

16.10.2026 · Başlangıç ve origin/main `21fa89bb851f69673527a0bc3910ae15b0167746` · `feat/pusula-v030-neon-cloud`.

## Gerçek durum

**Sprint A tamamlandı; v0.3 tamamlanmadı.** Neon hesabına erişilmedi, proje/ücretli hizmet oluşturulmadı, veritabanı bağlantısı veya migration çalıştırılmadı. `.env.local` yok; process ortamında DATABASE_URL, DIRECT_DATABASE_URL, AUTH_SECRET ve NEON_AUTH_BASE_URL tanımlı değildi. Yalnız var/yok kontrolü yapıldı; secret içeriği okunup raporlanmadı. Talimatın “Bağlantı bilgileri, hesap erişimi veya ücretli bir hizmet gerekiyorsa ilgili aşamada dur” kapısı nedeniyle Sprint B gerçek bağlantı bilgilerini bekler.

Git ağacı başlangıçta temizdi; fetch sonrası main değişmemişti. İstenen yeni dal origin/main üzerinden oluşturuldu. Mevcut kullanıcı verileri/taslakları silinmedi, otomatik import/seed yapılmadı. Bu sprint uygulama kodunu veya paket sürümünü değiştirmedi; çalışma hâlâ v0.2.3 demo özellikleridir. Ana dal v0.3 teslimi olarak güncellenmeyecek; Sprint A belgeleri ayrı feature branch'e push edilir.

## Okunan kaynaklar ve kod denetimi

README, ROADMAP, ARCHITECTURE, LAST_REPORT ve docs/design içindeki beş tasarım belgesi incelendi. Mevcut kaynak/test yapısı, Workspace veri sahipliği, login prototipi, TCMB route/store ve bağımlılıklar denetlendi. Next16.4.1, Node24, React19, strict TypeScript, Zod, Decimal, Radix ve Motion mevcut. ORM, PostgreSQL client, Better Auth ve gerçek session yok.

| Kod alanı | Şimdi | Sonraki geçiş |
| --- | --- | --- |
| workspace.tsx readInitial/setData/setCatalog/saveQuote/saveSale | localStorage demo ve taslak ana kaynağı | Sunucu repository/service, ayrı demo adapter; bulut hatasında demo fallback yok |
| login/page.tsx | Gerçek şifre almayan açık prototip | Pusula korunarak email+password/MFA, ayrı demo girişi |
| api/exchange-rate + rate-store | Sunucu TCMB ve disk cache; manuel token endpoint | fx.manual_override ve audit; gerçek cloud modda token bypass kapatılması |
| pricing.ts / finance.ts | Decimal, USD ve immutable snapshot domain kuralları | Aynı motor sunucuda yeniden hesaplar; istemci tutarı otorite değil |
| migrate.ts / catalog-seed.ts | Eski demo/null onarımı, USD seed koruması | Export/preview/explicit gerçek kayıt seçimi/idempotent import; otomatik demo taşıma yok |
| Müşteri/CRM/SaleForm | Paylaşılan drawer ve atomik müşteri değişikliği onayı | İş akışı/taslak korunarak sunucu CRUD ve permission DTO |

## Neon araştırma sonucu

- PostgreSQL taşınabilir; pooled uygulama / direct migration-dump ayrımı; transaction-mode pool'da session state'e güvenilmez. [Bağlantı](https://neon.com/docs/connect/connection-pooling).
- Managed Better Auth GA/Next.js destekli, fakat MFA henüz roadmap'te. Zorunlu Master Admin MFA nedeniyle uygulamanın yönettiği Better Auth + two-factor seçildi. Bu karar kurulu/çalışan auth demek değildir. [Neon](https://neon.com/docs/auth/roadmap), [TOTP plugin](https://better-auth.com/docs/plugins/2fa).
- Object Storage branch-aware S3 tarzı; Functions HTTP/cron işlerini branch yanında çalıştırır. İkisi için proje/bölge/özellik sınırları kurulumda doğrulanmalı; v0.3 mimarisinde zorunlu bağımlılık yok. [Storage](https://neon.com/docs/storage/overview), [Functions](https://neon.com/docs/compute/functions/overview).
- Free plan kısa restore penceresi bağımsız/üç yıllık yedek değildir. Gerçek hesaptaki plan bilinmiyor. Ücret ve kota araştırması [Neon mimari kararında](../docs/architecture/NEON_CLOUD.md); bağımsız yedek önerisi [kurtarma planında](../docs/security/BACKUP_RECOVERY.md).

## Sprint kapıları

| Sprint | Durum / çıkış kanıtı |
| --- | --- |
| A — Denetim | Tamamlandı: araştırma, tasarım belgeleri, güvenli env örneği ve başlangıç regresyon testleri |
| B — PostgreSQL | Başlamadı: staging bağlantısı, migration/CRUD/FK/Decimal ve gerçek runtime RLS testleri gerekli |
| C — Auth/Admin | Başlamadı: login/logout/reset/davet/pasifleştirme/revoke/TOTP; taze yetki kontrolü ve negatif API testleri gerekli |
| D — Kalıcı kayıt | Başlamadı: CRM/katalog/fiyat geçmişi/teklif/satış ve onaylı idempotent import gerekli |
| E — Yedek | Başlamadı: ayrı hesap/bucket/scheduler/secret kurulumu ve gerçek izole restore tatbikatı gerekli |
| F — Son kabul | Başlamadı: gerçek auth/DB/backup kanıtları + tam regresyon gerekli |

## Başlangıç doğrulaması

| Komut | Gerçek sonuç |
| --- | --- |
| npm run build | Başarılı, strict TypeScript, 7.29 s |
| npm run lint | Başarılı, 0 hata/uyarı |
| npm test | 63/63, 9 dosya, 9.72 s |
| npm run test:e2e | 20/20, desktop Chrome + mobil Chromium, 1.3 dakika |

Browser koşusu kendi test context'lerini kullandı. Console/runtime hata kontrolleri içeren mevcut CRM akışları geçti. Reduced-motion bildirimi ve Node FORCE_COLOR uyarısı hata olarak sayılmadı. Başka uygulamanın süreci durdurulmadı. Bu testler v0.2.3 regresyon kanıtıdır; Neon/auth/RLS/restore testi olarak sunulmaz. Sprint A değişiklikleri belge ve boş env sözleşmesi olduğu için yeni uygulama davranış testi eklenmedi.

Playwright'ın başlattığı `next dev`, Next16.4.1'in standart `AGENTS.md` rehberini üretti. Dosyanın içeriği `node_modules/next/dist/server/lib/generate-agent-files.js` ile doğrulandı; yalnız yerel Next dokümanlarını okumayı isteyen managed block içerir ve bu commit'e eklenir. Kurulu Next'in environment-variables, data-security ve authentication rehberleri de incelendi; sırların NEXT_PUBLIC ile yayımlanmaması ve server data access sınırı tasarımda korunur.

## Devam etmek için gereken

Yalnız boş Neon Free development/staging projesi ve `.env.local` içinde pooled DATABASE_URL + direct DIRECT_DATABASE_URL. Sohbette “hazır”, bölge ve plan yeterlidir. Hesap parolası/API key gerekmiyor. Ayrıntılı [kurulum adımları](../docs/architecture/NEON_CLOUD.md#şimdi-gereken-kurulum). Auth e-posta taşıyıcısı/ilk sahip e-postası ve bağımsız backup hedefi kendi sprintlerinde istenecek; henüz ücretli hizmet veya prod geçiş talep edilmiyor.
