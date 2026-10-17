# Neon Cloud — v0.3 Sprint A / B / C

16.10.2026. **Sprint B/C gerçek Neon bağlantısı, auth/TOTP, izin ve RLS kontrolleriyle doğrulandı.** Gerçek operatör hesabı production kabulünden ayrıdır; Resend C6 taşıyıcısı eklendi, canlı gönderim/domain koşulları [kurulum belgesindedir](../security/RESEND_SETUP.md); işletme ekranlarının buluta taşınması Sprint D, bağımsız yedek Sprint E kapsamındadır. v0.3 bütünü/production kabulü tamamlanmış değildir. [Denetim](../../research/PUSULA_V030_AUDIT.md), [ana mimari](../../ARCHITECTURE.md).

## Sprint B — gerçek kurulum

- Organizasyon `org-wild-forest-12594477`: CLI üzerinden **Free** doğrulandı. Proje `icy-queen-44442204` / `pusula-development`, Frankfurt `aws-eu-central-1`, PostgreSQL18.
- Başlangıçta yalnız default `production` (`br-autumn-union-baaldt81`) vardı. Production'a SQL/test/migration uygulanmadı. **Schema-only** `development` (`br-rough-darkness-ba6ow9zo`) oluşturuldu; üretim satırları kopyalanmadı. Compute0.25 CU; Free hesabın uyku ayarı değiştirilmedi. Varsayılan CLI şablonunun yeni dalları7 günde sona erdirme kuralı kaldırıldı.
- Neon CLI8.7.2 kuruldu, kullanıcı tarayıcıda login tamamladı. `neon init` açık geliştirme dalına pinlenerek `--services postgres --no-agent-setup` ile çalıştı. MCP/plugin veya Neon Auth etkinleştirilmedi. `.neon` yerel context'i Git dışında kalır.
- `neon config plan` yalnız **Postgres**, `noop`, conflict/warning yok sonucu verdi. Bu nedenle `neon deploy` ile gereksiz bir değişiklik uygulanmadı. `neon.ts` içinde auth:false; functions/storage/data-api/realtime bildirilmez.
- Bu dalda iki yeni boş DB: **pusula_development** (uygulama temeli), **pusula_sprint_b_test** (yalnız hayalî entegrasyon fixture'ları). production/neondb üzerinde destructive test yok.
- Prisma/client/adapter-pg **7.10.1**, pg8.23.1. `latest`8.0.0-rc.23 olduğundan RC kurulmadı. Prisma7.10 yapılandırması `prisma7.config.ts` ve komutlarda açık `--config` yoluyla kullanılır. `prisma/schema.prisma`, iki sürümlü SQL migration ve generated server client vardır.
- Tenant, LegalEntity, Activity, Customer, Material, MaterialVariant ve append-only MaterialPriceHistory tabloları kuruldu. Company composite FK, numeric(18,6) USD/numeric(12,4) ölçü, FORCE RLS, WITH CHECK ve transaction-local tenant/company context gerçek non-owner rollerle test edildi. Auth/izin/satış/teklif tablolarının kalan geçişleri sonraki sprintlerdedir.
- SQL ile `pusula_runtime` ve ayrı `pusula_test_runtime` oluşturuldu; NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS, neon_superuser üyeliği yok. Runtime migration tablosunu okuyamaz, schema oluşturamaz; fiyat geçmişini değiştiremez. Migration owner URL runtime'a verilmez.
- `src/server/db` server-only DAL ve tipli CompanyRepository içerir. Henüz HTTP CRUD/API izin katmanı değildir. Tek yeni HTTP route `/api/health/database`, yalnız `{status:ok|unavailable}` ve200/503 döndürür; host/SQL/secret sunmaz.

### Güvenli komutlar ve yeniden kurulum

`.env.local`: DATABASE_URL pooled runtime; DIRECT_DATABASE_URL direct migration owner; DATABASE_URL_UNPOOLED yalnız uyum alias'ı; TEST_DATABASE_URL pooled ayrı test rolü ve TEST_DIRECT_DATABASE_URL direct test owner. Diğer env satırları korunarak birleştirildi. TLS `verify-full`; parolalar yerelde rastgele üretildi, `.env.local`/`.neon`/generated client Git dışıdır. İlgisiz kullanıcı env ayarları ezilmez. Runtime URL'lerinin dar endpoint/DB/port/TLS/query-param allowlist'i production hedefini reddeder. Migration script'i ve Prisma config aynı guard'ı uygular.

```powershell
npm ci
npm run db:generate
# Yalnız onaylı development endpoint'i ve önceden oluşturulmuş boş DB'ler:
npm run db:setup
npm run db:migrate
npm run db:migrate:test
npm run db:grants
npm run db:test
```

Setup tekrarında mevcut runtime rolünün yerel parolası kullanılır; bilinmeyen mevcut rolün parolası resetlenmez. Migration tekrarında yeni işlem oluşmaz; iki migration her DB'de tamamlanmış olarak doğrulandı. Gerçek DB suite'i11 kontrol; yanlış parola ve ayrı loopback TCP-refused senaryosunda güvenli unavailable sonucu verir. Neon endpoint'i kesilmedi. Sentetik fixture'lar yalnız test DB'de tutulur. Mevcut localStorage/demo verisi DB'ye otomatik aktarılmadı. [Son test sonuçları](../../LAST_REPORT.md).

## Sprint A kararları — arka plan ve sonraki fazlar

## Sağlayıcı araştırması

Neon standart PostgreSQL'i pooled/direct bağlantılarla sunar. Uygulama için pooled, migration ve dump/restore için direct bağlantı seçilir. PgBouncer transaction mode nedeniyle kalıcı session `SET` değerlerine güvenilmez. Bağlantı sayısı her süreçte küçük tutulacak; singleton pool/adapter ve bağlantı zaman aşımı kullanılacak. 10.000 istemci kabulü gerçek veritabanının aynı anda 10.000 sorguyu çalıştırabileceği anlamına gelmez. [Resmî bağlantı rehberi](https://neon.com/docs/connect/connection-pooling).

Managed Better Auth GA ve Next.js desteğine sahiptir, fakat MFA henüz roadmap'tedir. Zorunlu Master Admin MFA için **uygulamanın yönettiği Better Auth + two-factor/TOTP** seçilir; Neon veritabanı ana sağlayıcı kalır. [Neon roadmap](https://neon.com/docs/auth/roadmap), [Better Auth 2FA](https://better-auth.com/docs/plugins/2fa). Neon Auth URL/API key bu seçim için gerekmez.

Object Storage S3 tarzı, branch ile çatallanan nesne depolamasıdır; S3'ün bütün özelliklerini sunduğu varsayılmaz. Functions branch yanında HTTP/cron/trigger işlemleri çalıştırabilir. v0.3'te mevcut Next.js sunucu işlemleri korunur; bu ürünlere zorunlu bağımlılık eklenmez. Aynı Neon hesabındaki storage bağımsız felaket yedeği olarak kabul edilmez. [Storage](https://neon.com/docs/storage/overview), [Functions](https://neon.com/docs/compute/functions/overview).

### Plan ve maliyet — araştırma anındaki liste

[Resmî fiyatlar](https://neon.com/pricing): Free, proje başına 100 CU-saat/ay, 1 GB PostgreSQL; 10 branch, en fazla 2 CU; inactive compute 5 dakika sonra uyur. Restore sınırı **6 saat veya 1 GB değişiklik**, bir snapshot; 5 GB Object Storage. Functions kotası ayrı: 10 active/400 waiting kapasite-saat ve 1M invocation. Ücretsiz geliştirme için değerlendirilecek; hesaptaki gerçek plan henüz bilinmiyor. Fiyat/limitler kurulumda yeniden kontrol edilir.

Launch listesi kullanım bazlı 0.106 USD/CU-saat +0.35 USD/GB-ay; örnek 15 USD/ay bir teklif/sabit ücret değildir. Ücretli yükseltme veya hizmet açılmadı. Bağımsız yedek nesne depolama/scheduler maliyeti ayrıca değerlendirilecek.

## Uygulama sınırı

Mevcut `Workspace` localStorage demo state'i, `CustomerDrawer`, `SaleForm`, `CostCalculator` ve Decimal domain motoru korunur. Yeni gerçek çalışma alanı sunucu session -> membership -> authorization -> service -> repository zincirine bağlanır. Demo ile bulut ayrı giriş ve veri sağlayıcısı kullanır. Bulut bağlantısı kesilirse localStorage/demo kayıtlarına otomatik fallback **yapılmaz**; hata açıkça gösterilir, işlem tamamlanmış sayılmaz, taslak korunur.

ORM kararı: PostgreSQL connector ile Prisma; tipli repository/service sınırı, sürümlü migration ve transaction desteği için uygun. Standart node-postgres adapter tercih edilir; Neon Data API zorunlu tutulmaz. Prisma/adapter/Better Auth sürümleri Sprint B kurulumunda Node24/Next16 uyumu ve kilit dosyasıyla sabitlenecek; bu aşamada paket kurulmadı. Elle SQL RLS/constraint migration'ları ORM migration dizinine eklenir. Generated client tarayıcıya import edilmez.

`DATABASE_URL`: uygulama pooled, sınırlı runtime rolü. `DIRECT_DATABASE_URL`: yalnız migration yönetici bağlantısı; HTTP route'larına verilmez. İkisi TLS gerektirir. Geçişte başlangıç owner bağlantıları yalnız setup/migration için kullanılabilir; runtime için ayrı `NOSUPERUSER NOBYPASSRLS` non-owner rol zorunlu. RLS sahibi/owner bağlantısıyla testin geçmesi güvenlik kanıtı değildir.

Staging ve production ayrı Neon projeleri/kimlik bilgileri ve deploy ortamlarıyla ayrılır; maliyeti düşürmek için geliştirme projesinde test branch'i kullanılabilir. Production verisi preview'e otomatik kopyalanmaz. Destructive test ve restore yalnız açıkça belirlenmiş boş test hedefinde çalışır.

## Tasarlanacak şema ve repository sınırları

| Alan | Modeller / önemli invariant |
| --- | --- |
| İşletme | Tenant -> LegalEntity -> Activity; composite unique/FK ile şirketler arası ilişki engeli |
| Kimlik | Better Auth User/Session/Account/Verification/TwoFactor; Membership aktifliği ve tenant ilişkisi |
| İzin | Role, Permission, RolePermission, RoleAssignment, UserPermissionOverride; membership ve scope; explicit deny önceliği |
| CRM | Customer, Supplier kartı; tenant+source ID unique; supplier satın alma/borç akışı v0.4/v0.6 |
| Katalog | Material, MaterialVariant, MaterialPriceHistory, ExpenseType, Product; Decimal USD; append-only fiyat versiyonu |
| Maliyet | CostCalculation, CostSnapshot, ExchangeRateSnapshot, Quote; tutar/birim/kur/source/tarih ve maliyet kopyası immutable |
| Satış | Sale, SaleLine, PaymentPlan; client maliyetini otorite saymadan sunucuda aynı Decimal motoruyla yeniden hesaplama |
| Denetim | AuditEvent, ImportBatch/ImportRecord; actor/tenant/target/reason ve redakte edilmiş değişiklik özeti |

UUID/composite ID eşleme ile legacy ID'ler kaybolmaz. USD, oran, miktar/ölçüler PostgreSQL numeric/Prisma Decimal; tarih date, olay zamanı timestamptz/UTC. Demo Payment/Payable kayıtları gerçek kasa/cari hareketine çevrilmez. Snapshot içindeki bütün malzeme/gider/kur bilgileri güncel tablolara canlı join ile yeniden fiyatlanmaz.

## Gerçek test kapıları

Sprint B kapısı gerçek development/test DB'lerinde geçti: migration tekrarları, CRUD, FK/Decimal, non-owner RLS çapraz tenant/şirket sorguları, transaction sonrası scope sızıntısı, rollback, immutable fiyat geçmişi ve yanlış parola/TCP bağlantı hataları doğrulandı. Health endpoint yalnız durum verir; host, schema, SQL ve sırlar dönmez. Bu sonuç kimlik/rol testi değildir; Sprint C API negatif izin/session testleri olmadan bulut UI açılmaz.

## Şimdi gereken kurulum

Bağlantı kurulumu tamamlandı; yeni proje açılması veya connection string'in sohbete gönderilmesi gerekmiyor. Mevcut `.neon` context'ini `development` üzerinde koruyun; her CLI çağrısında project/branch'i açık seçin. Production'a checkout/init/deploy/migration yapılmaz. Yeniden kurulum gerekiyorsa yukarıdaki allowlist ve rol ayrımını koruyan komutları kullanın; `.env.local` dosyasını silmeyin veya varsayılan owner URL ile runtime değerini ezmeyin.

Sonraki Sprint C: Better Auth + TOTP, güvenli bootstrap, ilk yönetici e-postası, davet/reset için mail taşıyıcısı, session revoke ve default-deny kişi bazlı API izinleri. Bunlar için yeni bilgiler kendi aşamasında istenecek; bu Sprint B isteğinin kapsamı genişletilmedi.

## Sprint C — çalışan kimlik / yetkilendirme katmanı

16.10.2026. Yukarıdaki Sprint B açıklamaları o aşamanın tarihsel kaydıdır. C'de Better Auth1.7.10, TOTP, server-only bootstrap, scoped membership/role/override ve `/api/cloud` sözleşmeleri eklendi. [Gerçek güvenlik sözleşmesi](../security/AUTHORIZATION.md), [kurulum](../security/MASTER_ADMIN_SETUP.md), [test kapıları](../security/AUTH_TEST_MATRIX.md).

- Aynı development dalı ve aynı iki DB kullanılır; production branch/DB kullanılmaz. Neon Auth/ücretli hizmet açılmadı.
- Auth tabloları ayrı sınırlı `pusula_auth` / `pusula_test_auth` rollerindedir; business runtime auth tablolarını okuyamaz, auth rolü işletme tablolarını okuyamaz. URL rol adı guard'ları owner yanlış kullanımını reddeder. Global şablon Role/Permission salt okunurdur; tenant güvenlik tabloları FORCE RLS'dir.
- Prisma7.10.1 korunur. C1–C5 için yeni ileri migration'lar vardır; önceki başarılı migration'lar değiştirilmez. SQL `pusula_can` ve ek restrictive kaynak politikaları, cloud session'dan türeyen kullanıcı/tenant/şirket/faaliyet/owner kapsamını sınırlar. Eski internal repository HTTP'ye doğrudan bağlanmaz.
- `AUTH_DATABASE_URL`, `TEST_AUTH_DATABASE_URL`, `AUTH_SECRET`, `AUTH_TEST_SECRET` yalnız Git dışı `.env.local` dosyasına korunarak birleştirilir. Secret/parola/token çıktısı yoktur. `.env.bootstrap.local` boş yerel şablondur; gerçek operatör doldurmadan hesap açılmaz.
- Auth browser testleri 3100 portunda, `.next-auth-e2e` çıktısında ve sadece test DB'sinde çalışır; development UI testleri 3000/.next ile ayrıdır. Test fixture kimlik bilgileri `.data` içinde şifrelidir. Auth trace/video kapalıdır.
- Davet/reset transport arayüzüne Resend C6 taşıyıcısı ve kalıcı gönderim durumları eklendi. API kabulü teslim onayı değildir; canlı test sonucu LAST_REPORT.md içindedir. Yerel encrypted outbox development testi içindir; production'da kapalıdır. Kayıp TOTP operatör recovery ve bağımsız restore Sprint E/operasyon kabulünde tamamlanmalıdır.
- `/` v0.2.3 localStorage demosu; `/app` gerçek session başlangıcı; `/admin/users` gerçek rol/izin yönetimi. Tam satış/teklif/finans/cloud import Sprint D'ye bırakıldı. v0.3 bütünü ve production dağıtımı tamamlanmış değildir.

Komutlar: `npm run auth:setup`, `npm run auth:roles`, `npm run auth:bootstrap`, `npm run auth:test`, `npm run test:e2e:auth`. Bootstrap yalnız gerçek operatör yerel alanlarını doldurduktan sonra çalıştırılmalıdır. Yeniden seed mevcut kurulmuş Master'ı sessizce yeniden etkinleştirmez; bootstrap kayıt işareti silinmez.

## C6.1 — 17.10.2026 denetimi

Development'ta mevcut bootstrap, MFA etkin operatör ve bekleyen üyelik salt okunur doğrulandı; bu görevde gerçek kullanıcı oluşturulmadı/silinmedi ve operatör faktörleri testlerde kullanılmadı. Davet conflict/requestId, session bağlı step-up status API'si ve lifecycle/gönderim durumu ayrımı eklendi. Yeni migration gerekmedi. [Kök neden](../../research/PUSULA_C61_INVITATION_AUDIT.md), [MFA kurtarma sınırı](../security/MFA_RECOVERY.md) ve [son doğrulama](../../LAST_REPORT.md) günceldir. C6 canlı Resend 403 kabulü/domain ve production onayı ayrı kalır.
