# v0.3 kimlik ve yetkilendirme — Sprint C

16.10.2026. Better Auth **1.7.10** + Prisma **7.10.1** gerçek Neon development/test PostgreSQL üzerinde çalışır. Neon Managed Auth açılmadı. Bu belge çalışan geliştirme uygulamasını ve sınırlarını anlatır; production kabulü veya bağımsız yedek teslimi değildir. [Test kanıtı](AUTH_TEST_MATRIX.md), [ilk yönetici kurulumu](MASTER_ADMIN_SETUP.md).

## Kimlik ve oturum

Better Auth Prisma adapter'ı AuthUser/Session/Account/Verification/RateLimit/TwoFactor tablolarını ayrı **pusula_auth** rolüyle kullanır; testte **pusula_test_auth**. Bu roller non-owner/NOBYPASSRLS'dir ve işletme tablolarını okuyamaz. Business runtime auth tablolarına erişemez. Hedef, TLS ve kullanıcı adı guard'ları owner bağlantısının yanlışlıkla runtime olmasını reddeder.

Parolalar Better Auth'ın hash mekanizmasıyla saklanır. Session cookie httpOnly, SameSite=Lax, production Secure; cookie cache kapalı, sekiz saat ömürlüdür. Korunan her istekte session, güncel kullanıcı durumu, aktif üyelik ve veritabanından izinler okunur. HTTP JSON'dan bearer session token'ları ayrıca çıkarılır. localStorage kimlik/yetki kaynağı değildir. DB hatası 503'tür; demo fallback yoktur.

Public signup endpoint'i yoktur; server API üzerinden doğrudan signup da AsyncLocalStorage provisioning kapısı olmadan reddedilir. Mutasyonlarda sabit origin kontrolü, veritabanı rate limit, normalize e-posta HMAC'li hesap kovası ve hassas step-up kovası vardır. İstemcinin forwarded IP değiştirmesi hesap kovasını atlatmaz. `/api/auth/*` açık endpoint listesiyle sınırlandırılır; genel Better Auth admin/get-token/MFA-disable/trust-device API'si açılmaz.

Davet token'ı 256-bit rastgele, SHA-256 ile saklanmış, 24 saat süreli ve atomik tek kullanımlıktır. Kabul edilen kullanıcı rol verilmeden aktif olur; erişim default deny'dır. Parola sıfırlama Better Auth üzerinden 15 dakika ve tek kullanımlıktır; eski oturumları iptal eder. Yanıt hesap varlığını söylemez. SMTP yoktur: geliştirme taşıyıcısı yalnız `.data/auth-mail/*.enc` dosyalarına secret ile şifreli test iletisi yazar; HTTP outbox yoktur ve production'da bu taşıyıcı çalışmaz. Gerçek e-posta teslimatı ayrıca kurulmalıdır.

## Master ve MFA

Bootstrap yalnız özel yerel dosya kullanan operatör CLI'sidir. Global tek kurulum işareti ve transaction kilidiyle kapanır; public Master kaydı yoktur. Mevcut kullanıcı sessizce terfi ettirilmez. Tenant Master'dır; platform çapında tüm firmaları gören süper kullanıcı değildir. Gerçek operatör dosyası doldurulmadığından bu teslimde gerçek ilk yönetici hesabı oluşturulmuş sayılmaz.

TOTP plugin'i kurulumu kodla doğrular. QR yerelde çizilir. TOTP secret ve recovery kodları Better Auth ile şifrelidir; recovery yalnız ilk üretimde gösterilir ve atomik karşılaştırmalı tüketimle tek kullanımlıdır. HTTP tekrar gösterme/yenileme/disable/trusted-device yolları kapalıdır. Master için yalnız twoFactorEnabled bayrağı yetmez: mevcut session satırında başarılı MFA kanıtı gerekir. Rol/override/davet/pasifleştirme/oturum iptali ve manuel kur için parola + TOTP step-up beş dakika geçerlidir. Recovery ile giriş yapılabilir; kritik step-up için TOTP gerekir. Kayıp TOTP için operatör kurtarma prosedürü bu sürümde otomatikleştirilmedi.

Kendi rol/override/üyelik değişikliği yasaktır. Son aktif Master'ın pasifleştirilmesi/demotion aynı tenant için transaction advisory lock + güncel count ile korunur; iki eşzamanlı işlem testi vardır. Rol ve override değişikliği sürüm kontrolüyle atomiktir; aktörün açık DENY veya kapsam sınırı daha geniş bir granta dönüştürülemez.

## Policy, kapsam ve RLS

`contextFor` -> aktif session -> kullanıcıya ait aktif Membership -> güncel RoleAssignment/RolePermission ve UserPermissionOverride -> `authorize`. Client tenant/user/role beyanı otorite değildir. `x-pusula-membership` yalnız oturum sahibinin üyelikleri arasından seçim yapabilir.

Karar: eşleşen scope içinde **DENY**, sonra özel **ALLOW**, sonra rol **ALLOW**, aksi halde **default deny**. Kapsam OWN, ACTIVITY, LEGAL_ENTITY, TENANT; composite FK şirket/faaliyet bağını korur. Departman/tutar/onay alanları geleceğe ayrılmıştır; bu sürümün yönetim formunda açık değildir. Desteklenmeyen koşullu ALLOW veri erişimi vermez.

Business runtime'ın Sprint B tenant/şirket FORCE RLS ve WITH CHECK politikaları korunur. Cloud transaction her zaman `app.user_id`, `app.tenant_id`, `app.legal_entity_id` değerlerini transaction-local set eder. Müşteri/malzeme SELECT/INSERT ve fiyat/history yolları ek `pusula_can` scope/action politikalarına tabidir. Pooled işlem bittiğinde context sızmaz. Şirket adları yalnız aktif üyeliğin grant kapsamından listelenir. Auth dışındaki tenant güvenlik tabloları FORCE RLS'dir. Global Role/Permission şablonları runtime için salt okunurdur.

Eski CompanyRepository, kullanıcı context'i olmayan Sprint B internal DAL olarak kalır; HTTP'ye doğrudan açılmaz. Bu servis runtime credential'ları bir güven sınırıdır; SQL bağlantı parolası son kullanıcıya verilmez. Cloud controller'ları daima doğrulanmış context kullanır.

## API ve hassas alanlar

`/api/cloud`: users GET/PATCH/invite/sessions, invitations/accept, context, customers GET/POST, materials GET/cost PATCH, exchange-rate POST. Tam satış/stok/finans CRUD'u oluşturulmadı. Yetkisiz istekler 401/403; gizlenen kayıt 404 veya filtrelenmiş liste olabilir. Strict Zod şemaları sahte userId/role/tenantId alanlarını reddeder.

Malzeme DTO'su pozitif alan listesiyle seçilir. materials.costView yoksa nested variants içinde usdCost yoktur; history/snapshot/derived margin payload'ları bu API'ye eklenmez. Fiyat audit özeti tutarı içermez; gerçek eski/yeni değer ayrı immutable fiyat geçmişindedir. Gelecek Sprint D satış/CSV/teklif/dashboard bulut DTO'ları aynı projeksiyon kuralına bağlanmadan açılmamalıdır.

Eski `POST /api/exchange-rate` shared-token yolu **403 ile kapalıdır**. TCMB GET demo için korunur, manuel seçenek kapalıdır. Gerçek manuel kur `/api/cloud/exchange-rate` ile tenant'a özel immutable Decimal kayıt ve audit oluşturur; global demo cache'i değiştirmez.

AuditEvent, tenant/şirket, aktör, hedef, UTC zaman, eylem ve sabit güvenli değişiklik özetini taşır. Runtime yalnız insert/select yapabilir; trigger update/delete'i owner için de engeller. Yetki/müşteri/fiyat/kur değişikliği ile audit aynı business transaction'ındadır. AuthSecurityEvent MFA/bootstrap olaylarını ayrı append-only tabloda saklar. Parola/token/secret/recovery veya tam müşteri payload'ı audit'e yazılmaz. Global session temizliği ayrı auth bağlantısındadır; üyelik iptali önce commit edilir, temizleme kesintisi erişimi geri açmaz.

## Görünür sınırlar

`/` yerel v0.2.3 demo; `/login`, `/app`, `/account/security`, `/admin/users` gerçek session kullanır. Demo verileri otomatik import edilmez. Sprint D gerçek satış/teklif/kur snapshot geçişi ve onaylı import; Sprint E bağımsız şifreli yedek/restore hâlâ bekler. Development outbox, Neon hesabı içi storage veya localStorage işletme yedeği sayılmaz. Üretim maili, operator hesabı/MFA kurulumu, dev-only dependency advisory ve production deployment kabulü ayrıca kapanmalıdır.

Resmî kaynaklar: [Better Auth Prisma](https://better-auth.com/docs/adapters/prisma), [TOTP](https://better-auth.com/docs/plugins/2fa), [sessions](https://better-auth.com/docs/concepts/session-management), [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).
