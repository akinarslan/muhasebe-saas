# PUSULA V4.3b.9 doğrulama — MANAGED_ACL_LOCAL_PASS

21.10.2026 · [Düzeltme ve kapsam raporu](../../research/PUSULA_V04_V43B9_MANAGED_ACL_FIX.md).

| Kontrol | Gerçek sonuç |
| --- | --- |
| Non-superuser PostgreSQL | Gerçek 18.6 / ayrı LOGIN session / SUPERUSER false / CREATEROLE true / self-grant boş |
| SET ve schema CREATE eksikliği | İki negatif ownership denemesi 42501; şema ve roller rollback |
| Tek-aktör yaklaşımı | İlk aday kalan bootstrap ADMIN nedeniyle reddedildi; bu yaklaşım kullanılmıyor |
| Nihai oluşturucu rol yaklaşımı | 016 COMMIT + postflight 47 tablo / 33 FORCE RLS / 16 başarılı migration |
| Kalıcı üyelik ve yetkiler | Geçici oluşturucu yok; executor üyeliği, actor SET/INHERIT ve executor schema CREATE yok |
| Executor rolü | NOLOGIN/NOSUPERUSER/NOCREATEROLE/NOCREATEDB/NOREPLICATION/NOBYPASSRLS; tablo sahibi değil |
| Definer sahipliği / search_path | Dört fonksiyon executor-owned; pg_catalog, public, pg_temp; PUBLIC EXECUTE kapalı |
| Geç hata rollback | Gerçek 22012; role, membership, schema ve permission değişiklikleri atomik geri alındı |
| Resolved 008 | Korundu; başarılı sayısı pre 15/post 16; eski satırların tamamı birebir aynı |
| Fail-closed history | Unresolved, bilinmeyen checksum, çift başarı, onaysız rollback gerçek SQL enjeksiyonlarıyla reddedildi |
| Managed fixture kabulü | 12 kontrol PASS; ayrı pinli temiz koşu PASS; serverStopped true |
| Normal runner | 20 kontrol PASS; gerçek Prisma deploy, ALREADY_APPLIED, advisory/timeout/rollback ve ACL/RLS drift kontrolleri |
| Tam normal fixture regresyonu | DB/RLS 11; Auth 62; Cloud 11; Supplier 16; PurchaseOrder 28; Stock 36 PASS |
| Managed fixture regresyonu | Auth C2 9; Supplier 16; PurchaseOrder 28; Stock 36 PASS |
| Vitest | 33 dosya, 389/389 PASS; native exit 0 |
| TypeScript | tsc --noEmit exit 0 |
| ESLint | npm run lint exit 0 |
| Production build | npm run build native exit 0; mevcut .data tracing uyarısı var |
| Cloud apply kapısı | Kapalı; managed CLI her durumda STOCK_MANAGED_APPLY_DISABLED |
| TLS planı | Allowlist/verify-full/CA süre/hostname/rejectUnauthorized/TLS1.2 testleri PASS; gerçek Neon bağlantısı yapılmadı |
| İlk 15 migration / eski DB baseline | Değişmedi |
| Normal fixture ACL baseline | Değişmedi; nihai SQL ile tekrar doğrulandı |
| Önceki raporlar / env | V4.3b.5–8 ve .env.local checksum'ları korundu |
| Gerçek Neon, recovery, production, test bulut DB | Bağlantı veya mutation yok |
| Git / R2 / provider kaynakları | Commit/push/merge, R2, branch/endpoint/snapshot işlemi yok |

Nihai normal fixture: `v42-b5e54c69-6f4f-4935-a43d-b5d359819a04`. Nihai managed fixture: `v42-4e993c86-ea7f-49f7-acc8-fa0223461e03`. İkisinin de PASS ve serverStopped=true kaydı mevcut. Normal fixture'da gerçek Prisma engine; managed fixture'da ayrı non-superuser bağlantıyla doğrudan SQL apply+COMMIT kullanıldı.

Eski 016 SHA: `80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18`.

Yeni 016 SHA: `7368c775ec5d9b2b126b4731d5985ec83d1cad077f2cd5904ff596a04f22b272`.

Şema function pini güncellendi; diğer yedi kategori sabit. Managed fixture ACL pre/post pinleri ayrı dosyada. Gerçek Neon profili yalnız tarihsel pre hash taşır; post=null ve applyEnabled=false. Bu yerel kabul Neon postflight kabulü değildir.

Yerel loglar `.data/v43b9/runner-release.log`, `managed-release.log`, `vitest-release.log`, `type-final.log`, `lint-final.log`, `build-release.log`, `results.json`, `preserved.json` içindedir. `.data` ve fixture sırları Git teslimine alınmaz.

İlk başarısızlıklar raporda korunur: süreç sandbox engeli; eski şema/ACL pin reddi; kalan otomatik ADMIN üyeliği; geçici UTF-8 etiket bozulmasının diff incelemesinde bulunup özgün satırla düzeltilmesi; PowerShell stderr nedeniyle ilk build exit kodunun belirsizleşmesi. Nihai SQL ile temiz fixture koşuları ve native build başarıları ayrıca kaydedildi.

Sonraki cloud denetimi: güncel provider GET/TLS kimliği, gerçek 008 checksum'u, güncel managed pre ACL, geçici rol adının boşluğu ve Neon'a özgü rol-grantor davranışı yeniden doğrulanmalı. `token_roles` ROLE_DELTA_UNRESOLVED; recovery ve bağımsız R2/35-21 backup sınırları korunur. Gerçek apply için ayrı inceleme ve açık kullanıcı onayı gerekir.
