# Sprint E2 — mimari ve yetki denetimi

18.10.2026. Başlangıç `c570f7b`; feature dalı/fetch kontrol edildi, başlangıç çalışma ağacı temiz. D7 arama/davet UI, D auth/izin/RLS ve immutable finansal snapshot'lar korunur. Next'in yerel environment-variables rehberi okunarak CLI'de @next/env kullanıldı; web route veya UI eklenmedi.

## Sağlayıcı ve gerçek kanıt

E1 HeadBucket200, auto/EEUR kaydı korunur. E2 preflight resmî AWS SDK ile HeadBucket'ı tekrar geçti. Public/custom domain ve token bucket-scope S3 HeadBucket'tan çıkarılamaz. Yönetim tokenı bulunmadığından bağımsız API kontrolü yapılmadı.

18.10.2026 hesap sahibi Dashboard'dan doğruladı: **Public Development URL Disabled; Custom Domains bağlı değil; S3 token Object Read & Write; yalnız pusula-backups-development**. Bu kanıt **operatör/panel beyanı** olarak kaydedilir. `preflight --confirm-r2-security-reviewed` public ayarları `operator-attested-disabled`, token kapsamını operatör beyanı olarak etiketler; bağımsız API denetimi iddia edilmez. Kullanıcı E2 geliştirmeye devamı onayladı, gerçek dump ve upload öncesinde ayrıca onay şartını tekrarladı; bu işlemler çalıştırılmadı.

[Neon roller](https://neon.com/docs/manage/roles): Console/API/CLI-created kimlikler neon_superuser üyeliği alır; yönetilen servis gerçek PostgreSQL superuser sağlamaz. Yönetilen admin, okuma yanında yazma/yönetim yetkileri de taşır. SQL-created rol kendiliğinden bu üyeliği almaz. [Neon pg_dump](https://neon.com/docs/manage/backup-pg-dump), [PG18 pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html) ve [Cloudflare SDK](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) esas alındı.

Allowlist development owner ile yalnız BEGIN READ ONLY/katalog SELECT/ROLLBACK: mevcut owner **NOSUPERUSER, BYPASSRLS, CREATEDB, CREATEROLE**; `pusula_backup` rolü sayısı **0**. Parola/rol adı veya kayıt içeriği dökülmedi. CREATE/ALTER/GRANT ya da yetkiyi deneyerek test eden SQL çalıştırılmadı. Owner'ın BYPASSRLS olması, başka role aynı niteliği verebildiğini kanıtlamaz.

## Önerilen özel backup kimliği — uygulanmadı

- SQL/provider tarafından onaylanmış ayrı `pusula_backup` login. Runtime/auth/migration owner'dan farklı credential, uygulamada kullanılmaz.
- BYPASSRLS zorunlu; FORCE RLS sahibi olmak tek başına yeterli değil. pg_read_all_data tek başına RLS'yi bypass etmez. Politikalara backup OR koşulu eklenmez ve mevcut RLS gevşetilmez.
- CONNECT, şema USAGE, bütün tablolara/sequence'lara SELECT ve gelecekteki migration owner default SELECT grants gerekir. CREATE, INSERT/UPDATE/DELETE/TRUNCATE, sequence USAGE/UPDATE ve neon_superuser üyeliği verilmez. Servis hesabı kaynak DB'ye direct/verify-full bağlanır; erişim kapsamı çok tenantlı hassas veri olduğu için secret manager'da korunur.
- Neon'un mevcut yönetilen yetkileriyle sınırlı login'e BYPASSRLS atanması **henüz kanıtlanmadı**. PostgreSQL'de bu nitelik ayrıcalıklıdır. Hesap sahibinin/provider'ın desteklediği yöntem onaylanmadan rol oluşturulamaz. Console'dan geniş yetkili admin açıp read-only backup hesabı diye adlandırmak çözüm değildir; CLI bu hesabı reddeder.
- Mevcut izinlerle dar BYPASSRLS kimliği mümkün değilse Neon destekli operatör/backup rol modeli istenir. Geniş admin kimliğiyle ayrı denetimli manuel yedek seçeneği ayrıca güvenlik kararı gerektirir; bu CLI otomatik owner fallback yapmaz.
- Restore operatörü ayrı kimliktir. pg_dump cluster-global rol/parolaları yedeklemez. Managed roller/extension/owner/ACL hedef ortamda onaylı runbook ile kurulmalı; admin rol snapshot'ı doğrudan hedefe uygulanmaz. Test hedefinde veri yükleme bitmeden runtime grant'leri açılmaz. E4'te --no-owner/--no-acl gibi seçeneklerin hedefe uygunluğu ayrıca incelenir, kaynak dump bunları kaybetmez.

## Gerçek işlem öncesi ayrı onay listesi

1. PostgreSQL18 pg_dump/pg_restore/psql ve yerel hayalî35-table fixture üzerinde gerçek dump + --list kanıtı.
2. Sınırlı BYPASSRLS backup rolünün provider destekli kurulumu için açık onay; sonra yalnız SELECT/USAGE, owner olmayan ve yazma/DDL yetkisi olmayan katalog kanıtı.
3. BACKUP_SOURCE_DATABASE_URL direct allowlist development/backup rolü/verify-full. Mevcut env korunacak, URL sohbet/loga girmez.
4. BACKUP_ENCRYPTION_KEY ve BACKUP_KEY_ID oluşturma/saklama için ayrı kullanıcı onayı; offline key kurtarma kopyaları.
5. R2 Standard, public proxy yok ve doğru bucket korunmalı. r2.dev/custom domain kapalı ve bucket-scope panel incelemesi hesap sahibi tarafından yukarıda doğrulandı; bu operatör beyanıdır. S3 Object Read & Write hazır izni silme de içerebilir; uygulamada DeleteObject yoktur. Gerçek işlemden önce ayarların korunması ve ayrı onay gereklidir.
6. Dump'ın auth/TOTP/session verileri de taşıdığı kabul edilerek özel yerel disk/ACL ve yedek erişimi onaylanmalı. Dump onayı ile upload onayı ayrıdır.
7. Onaydan sonra önce create/verify, ayrı upload/remote verify. Gerçek restore/E3 tamamlanana kadar production-ready kabulü yok.

## Mevcut sınırlar

PostgreSQL araçları yok: standart PG18 klasöründe yalnız data bulundu; PATH'te araç yok. Docker daemon çalışmıyor. Paket/anahtar/DB rolü kurulumu kendiliğinden yapılmadı. Gerçek fixture pg_dump, development dump, gerçek R2 PUT/DELETE, restore ve E3 otomasyon yapılmadı. İzole testler stream bytes, taklit PG bağlantısı/TOC ve bellek içi S3 kullanır; gerçek DB yedeği kanıtı değildir. [CLI ve format](../docs/operations/BACKUP_ENGINE.md), [doğrulama](../docs/validation/SPRINT_E2_VERIFICATION.md).

E3 bağımlılıkları: secret dağıtımı, runner/scheduler maliyet ve default-branch kısıtı, idempotent günlük iş kimliği, kalıcı durum/freshness alarmı, retention dry-run. E4: ayrı boş açık onaylı hedef, key kurtarma, roller/extension/grants runbook, restore/Auth session iptali/RLS ve finansal satır-hash/ilişki doğrulaması. Bunlar E2'de uygulanmadı.
