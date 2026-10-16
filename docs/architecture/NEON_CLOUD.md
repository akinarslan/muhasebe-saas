# Neon Cloud — v0.3 mimari kararı / Sprint A

16.10.2026. **Bu belge tasarım ve kurulum sözleşmesidir; bağlantı henüz kurulmadı.** Sprint B gerçek staging bağlantı testi tamamlanmadan kapanmaz. [Denetim](../../research/PUSULA_V030_AUDIT.md), [ana mimari](../../ARCHITECTURE.md).

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

Sprint B: migration boş disposable Neon test DB'de; yeniden deploy idempotent; bağlantı kesintisi/timeout; CRUD ve FK/Decimal; runtime rolü RLS çapraz tenant direct SQL testi, transaction sonrası scope sızıntısı testi. Health endpoint yalnız durum/opaque request ID verir; host, schema, SQL ve sırlar dönmez. Bağlantı ayrıntılı kontrolü yetkili operatöre aittir. **Bu testler henüz yapılmadı.** Sprint C API negatif izin/session testleri olmadan bulut UI açılmaz.

## Şimdi gereken kurulum

1. [Neon Console](https://console.neon.tech)'da **Free**, boş `pusula-development` projesi oluşturun. Ücretli yükseltme yapmayın. Bölgeyi işletmenin veri barındırma gereksinimine göre seçin; projedeki bölge/plan adını bildirin.
2. Yalnız staging/development branch'i seçin. Connect bölümünden pooling ON ve OFF URL'lerini alın. URL'yi bölerek/parolayı değiştirerek elle türetmeyin.
3. Proje kökündeki Git dışı `.env.local` dosyasına `DATABASE_URL` ve `DIRECT_DATABASE_URL` koyun. Mevcut dosya varsa üzerine yazmayın. Örnek anahtarlar `.env.example` içindedir; şifreli URL'leri sohbet/issue/commit'e yapıştırmayın.
4. Burada yalnız “hazır”, plan ve bölgeyi bildirin. Neon hesap parolası veya API key paylaşmanız gerekmiyor. Bağlantı doğrulanınca migration/runtime rol ayrımı yapılacak. Auth secret yerelde üretilecek; ilk yönetici e-postası ve davet/reset mail taşıyıcısı Sprint C'de gerekli olacak.
