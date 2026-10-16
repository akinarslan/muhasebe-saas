# PUSULA v0.3 — Sprint B / Gerçek Neon PostgreSQL temeli

16.10.2026 · **Sprint B tamamlandı. v0.3 bütünü ve Sprint C auth/Master Admin henüz tamamlanmadı.**

## Sonuç

Neon'a **gerçek bağlantı kuruldu**. Kullanıcı CLI girişini tarayıcıda tamamladı. Organizasyon `org-wild-forest-12594477` Free; proje `icy-queen-44442204` / `pusula-development`; bölge Frankfurt (`aws-eu-central-1`), PostgreSQL18.

Başlangıçta yalnız default `production` (`br-autumn-union-baaldt81`) vardı. Production'a SQL, test veya migration uygulanmadı. Schema-only **development** (`br-rough-darkness-ba6ow9zo`) oluşturuldu; üretim satırları kopyalanmadı. Bu dalda iki **yeni boş** DB açıldı: `pusula_development` ve yalnız hayalî fixture'lar için `pusula_sprint_b_test`.

Neon CLI8.7.2 kuruldu. İlk npm sertifika hatası sistem CA ile çözüldü; TLS kapatılmadı. Init yalnız development dalında `--services postgres --no-agent-setup` ile çalıştı. `neon.ts` auth:false; diğer servisler tanımlı değil. Config plan yalnız Postgres/noop, conflict/warning yok gösterdi; **neon deploy gerekmedi ve çalıştırılmadı**. Şablonun7 günlük auto-expiry kuralı kaldırıldı. Free'de suspend override reddedildiği için hesap varsayılanı korundu; compute0.25 CU. Ücretli plan/hizmet açılmadı.

## Prisma, kalıcılık ve kapsam

Prisma/client/adapter-pg **7.10.1**, pg8.23.1 kuruldu. Latest etiketi8RC olduğundan kararlı7 seçildi. `prisma7.config.ts`, şema, iki sürümlü migration ve server-only client/repository eklendi. Build ve predev client üretir; generated kod Git'e konmaz.

Tenant, LegalEntity, Activity, Customer, Material, MaterialVariant, MaterialPriceHistory tabloları her iki DB'de kuruldu. Numeric USD(18,6), ölçü(12,4), composite tenant/şirket FK, FORCE RLS + WITH CHECK, transaction-local scope ve immutable fiyat geçmişi trigger'ı vardır. Migration tekrar deploy ile idempotent; reset/db push/production destructive migration kullanılmadı.

Runtime SQL ile oluşturulan non-owner `pusula_runtime`; test DB'sinde ayrı `pusula_test_runtime`. Superuser/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS ve neon_superuser üyeliği yok. Runtime tablo oluşturamaz/migration kayıtlarını okuyamaz; fiyat geçmişi yalnız insert/select. Migration owner URL uygulama client'ında kullanılmaz.

**Mevcut UI modülleri hâlâ v0.2.3 localStorage demosudur.** Kullanıcı müşterileri/fiyatları/satışları otomatik taşınmadı. UI CRUD'ları henüz repository'ye bağlanmadı. Repository internal server DAL; HTTP veri CRUD veya kullanıcı RBAC açılmadı. Yeni `/api/health/database` yalnız200/503 ve durum döndürür; iki browser projesinde gerçek bağlantı200 doğrulandı.

## Ortam ve güvenlik

`.env.local` korunarak birleştirildi: pooled runtime DATABASE_URL, direct migration DIRECT_DATABASE_URL; ayrı TEST_DATABASE_URL/TEST_DIRECT_DATABASE_URL; CLI uyum alias'ı DATABASE_URL_UNPOOLED. Rastgele rol parolaları yalnız yerel env dosyasına yazıldı. TLS verify-full; uygulama/migration config explicit development endpoint/DB/port/query-param allowlist'i uygular. Production hedefi ve driver host override'ları reddedilir.

`.env.local`, `.neon`, generated client ve test çıktıları Git dışındadır. DB connection string/parolaları rapora/Git'e konmadı;27 staged dosya gerçek yerel URL/parola değerlerine karşı tarandı ve **PASS** alındı. CLI'nin ilk OAuth login debug çıktısı tamamlanan girişte tüketilmiş tek kullanımlık callback kodunu yazdı; kalıcı token/parola gösterilmedi. Sonraki CLI çıktıları yakalanıp debug/secret çıktısı bastırıldı. CLI oturumu kullanıcı profilindedir; repoya eklenmez.

## Doğrulama

| Kontrol | Gerçek sonuç |
| --- | --- |
| Başlangıç | 63/63 Vitest, lint başarılı |
| Prisma validate/generate | Başarılı,7.10.1 |
| Migration | İki DB'de2 migration; tekrar deploy başarılı |
| Gerçek PostgreSQL suite | **11/11** |
| Son build | Başarılı, strict TypeScript,9.05 s |
| Son lint |0 hata/uyarı |
| Son Vitest | **71/71**,11 dosya,9.86 s |
| Son Playwright | **22/22**, desktop Chrome + mobil Chromium,1.4 dakika |
| npm audit --omit=dev |0 bulgu |
| Tam npm audit | Dev-only ESLint/fast-glob/braces/micromatch zincirinde5 high; force downgrade uygulanmadı |

Gerçek DB kontrolleri: restricted non-owner bağlantı, CRUD/unique/version counter, filtre olmadan SQL RLS tenant/şirket izolasyonu, yetkisiz yazma, scope eksikliğinde default-deny, pooled context sızıntısı, composite FK, Decimal0.1+0.2=0.3 ve6 hane USD, atomik fiyat tarihçesi, immutable history, rollback, DDL/migration erişim reddi, yanlış parola ve TCP connection refused. Hata testinde Neon endpoint'i kapatılmadı; ayrı loopback portu kullanıldı. Fixture'lar yalnız izole test DB'sinde tutulur.

Önceki20 browser testi korundu;2 ek HTTP health testi gerçek Neon'a bağlandı. Önceki63 Vitest'e8 hedef/HTTP sözleşme testi eklendi. İlk SQL üretiminde sandbox child-process engeli ve buna bağlı eksik migration deploy hatası oldu; izinli SQL üretiminden sonra deploy tamamlandı. İlk build test helper'ındaki dar literal host tipini yakaladı; string düzeltmesi sonrası tam kontroller geçti. Başarısız denemeler başarı sayılmadı.

## Sprint C için kalanlar

Better Auth + TOTP korunuyor; Neon Auth açılmadı. Henüz login/logout/reset/davet/pasifleştirme/session revoke/Master Admin bootstrap/özel izin matrisi/API default-deny enforcement yok. İlk sahip kimliği, auth secret ve mail taşıyıcısı C aşamasında hazırlanacak. RLS tek başına kimlik doğrulama değildir; scope doğrulanmış membership'ten üretilmeli.

D: çalışan ekranların sunucu CRUD'a geçişi, satış/teklif/kur snapshot şemaları, onaylı/idempotent localStorage import. E: bağımsız şifreli yedek/scheduler/restore testi. Bu aşamalar yapılmış gibi raporlanmadı. Dev toolchain'deki audit bulguları da güvenlik kabulü öncesinde çözülmeli; npm'nin önerdiği eslint-config-next14 major downgrade Next16 uyumu nedeniyle otomatik uygulanmadı.

## Git ve belgeler

Dal `feat/pusula-v030-neon-cloud`; başlangıç `e3290f8`; fetch sonrası uzak dal günceldi, kullanıcı değişikliği yoktu. Doğrulanan Sprint B uygulama commit'i **`6a77824e77d92f0282f30c43849874acd521d701`** GitHub feature dalına push edildi; push öncesi fetch/ancestry kontrolü geçti. Bu rapor ayrı dokümantasyon commit'iyle aynı dala gönderilir. Main `21fa89b` üzerinde korunur; bu kısmi v0.3 teslimi main'e birleştirilmedi. Force push/hard reset/veri temizliği yapılmadı. [Sprint A raporu](docs/history/PUSULA_V030_SPRINT_A_REPORT.md) arşivlendi.

[Mimari ve komutlar](docs/architecture/NEON_CLOUD.md) · [Denetim](research/PUSULA_V030_AUDIT.md) · [Auth sözleşmesi](docs/security/AUTHORIZATION.md) · [Yedek planı](docs/security/BACKUP_RECOVERY.md)

Yerel kabul: `npm ci`, `npm run build`, `npm test`, `npm run lint`, `npm run db:migrate`, `npm run db:migrate:test`, `npm run db:grants`, `npm run db:test`, `npm run test:e2e`. Dev server açıkken `/api/health/database`200 ve yalnız status göstermeli; müşteri değiştirme onayı, USD maliyet ve eski taslak/snapshot akışları önceki gibi çalışmalı.
