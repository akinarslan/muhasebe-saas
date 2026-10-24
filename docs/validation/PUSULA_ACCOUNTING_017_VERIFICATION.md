# PUSULA — Finans017 yerel doğrulaması

23 Ekim 2026 · **M017_LOCAL_PASS** · Gerçek Neon/GO_LIVE: **BLOCKED**.

Başlangıç HEAD `edc03121737051d1eb180e621ccd91acfcc92743`; feature dalı korundu, stage/commit/push/merge yok.

## Gerçek komutlar

| Komut | Sonuç |
| --- | --- |
| `node --import tsx scripts/accounting/prepare-migration.ts` | PASS; yalnız çevrimdışı artifact üretimi |
| `node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --finance017 --k5` | PASS; yeni izole PostgreSQL18.6,10 finans migration kontrol grubu +235 API/SQL regresyonu; restore kapalı |
| `npx.cmd prisma validate --config prisma7.config.ts` | PASS;9 finans modeli ve reverse ilişkiler |
| `npm.cmd run db:generate` | PASS; yalnız local generated client |
| `npm.cmd test` | PASS;41 dosya /463 test, native exit0 |
| `npx.cmd tsc --noEmit` | PASS; native exit0 |
| `npm.cmd run lint` | PASS; native exit0 |
| `npm.cmd run build` | PASS; Prisma generate + Next16.4.1 production build, native exit0 |
| `node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | PASS;017 dahil10 kontrol, native exit0 |
| `git diff --check`, ilk16 ham hash ve archived K5 hash | PASS; byte'lar değiştirilmedi |

Native süreçler sandbox spawn kısıtı nedeniyle gerektiğinde süreç izniyle çalıştırıldı. Ağ/provider erişimi kullanılmadı. Build mevcut üst-dizin package-lock yok sayma ve rate-store `.data` glob'unun büyüklüğü uyarılarını verdi; native exit0. Bunlar build başarı gibi gizlenmiş hata değildir; bu görev rate-store veya deployment packaging değiştirmedi. Env dosyası düzenlenmedi.

## Nihai fixture ve kanıtlar

Nihai fixture: `v42-10c5dbc6-1178-49cf-9b30-6911f019f257`. Nihai tam harness sonucu PASS, serverStopped=true, failureCode=null; neonOperations=false, r2Operations=false. Finance evidence restoreOperations=false.

Yerel/Git dışı kanıtlar: `.data/m017/{fixture-final,vitest-final,tsc-final,lint-final,build-final,checksum-final}.log`; fixture dizininde `verification.json`, `finance017-verification.json`, `finance017-{failure,deploy,repeat,introspection,model-diff}.log`, `finance017-failure-classification.json` ve suite log'ları. Credentials veya dump/backup rapora eklenmez.

Yeni SHA-256 **`9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`**: canonical017 ve aday birebir, LF, manifest eşleşir. Eski SHA `3548d3291a7c5c97919d5dee7ac20369c0c7a4de6888b4d21d17d4dcf4ad27aa` archived K5 SQL'inde birebir korunur. Dört K1–K4 SQL kaynak hash'i değişmez. İlk16 ham hash başlangıç snapshot'ıyla eşleşir;016 SHA `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`.

Bağımsız referans katalog hash'i ve actual hash aynı:

`bd8443745b9eb1bcd92cbeb42731f9d7525c1c8182ecc7f3bcab071cef1be914`

Referans, hash-pinned eski K1–K4/K5 DDL'inin hedef uygulanmadan önceki rollback-only çalışmasından gelir; target post fingerprint'i otomatik öğrenilmez. Fonksiyon gövdesi satır sonları LF normalize edilir; yapısal/kural farkları normalize edilmez. Ayrı ACL sözleşmesinde owner, grantor, rol flags, üyelik, kolon/default ACL ve8 runtime giriş açıkça tanımlıdır.

## Gerçek kabul ayrıntısı

1.001–015 mevcut immutable yerel fixture yolu,016 mevcut gerçek Prisma/stock runner kabulü, ardından canonical017 ayrı gerçek Prisma deploy. Aynı tek `_prisma_migrations` tablosunda17 başarılı kayıt. Fixture'da önce eklenen reviewed rolled-back008 checksum'u `35ca1ae820b9e040ef189f3ff346381c591a268b74e4c37f639e94d2dded1fd9` ve önceki tüm satırlar birebir korunur. Bu gerçek Neon history okuması değildir.
2. Gerçek aktör `fixture_finance_owner`: LOGIN, SUPERUSER=false, BYPASSRLS=false, CREATEDB=false, CREATEROLE=true, INHERIT=false, createrole_self_grant boş, server180006. Test provisioning aktöre şema/baseline nesne sahipliği sağlar; adayın içine superuser tamiri veya test-only ACL düzeltmesi uygulanmaz.
3. Exact canonical SQL önce aynı aktörde COMMIT yerine rollback ile denenir.01006/01007 dahil01 sınıfı ACL warning listesi boş.16 function owner executor,7 definer,16 sabit search_path,24 efektif izin (executor16 + runtime8); PUBLIC/auth/diğer non-superuser roller giriş alamaz. Fonksiyon ACL grantor'ı executor. Creator yok, executor'ın üst/alt üyeliği yok, schema CREATE yok; global üyelik snapshot'ı öncekiyle aynı.
4.9 finans tablosu, tüm56 tablo/42 FORCE RLS; indeks/constraint/kolon/policy/trigger/function/enum envanterinin8 kategorisi referansla tam eşleşir. Table owner migration actor, executor SELECT/INSERT, yalnız access tablosunda DELETE ve intent.closed kolonunda UPDATE; runtime yalnız SELECT ve izinli function EXECUTE. Default ACL değişmez.
5. Review marker yokken red; schema CREATE veya SET üyeliği eksikken red; geç division-by-zero sonrası schema, roles, memberships, ACL ve history eski snapshot'ıyla eşit. Gerçek Prisma hata enjeksiyonu private phase kopyasında aynı geç hatayı üretir: DDL/rol rollback olur, tek unresolved017 metadata satırı kalır. Bunun REVIEW_REQUIRED olduğu kaydedilir; yalnız fixture harness'i test satırını açıkça temizler. Runner otomatik resolve/delete/skip yapmaz; mevcut/gerçek history değiştirilmez.
6. Başarılı gerçek canonical Prisma deploy sonrası ikinci deploy metadata dahil hiçbir yeni kayıt üretmez.9 tabloda dört ayrı runtime DML/TRUNCATE denemesi (36 deneme) ve executor SET gerçek42501. Auth EXECUTE grant, RLS disable, function SECURITY INVOKER, executor üyeliği, drop finance_statement index ve drop posting CHECK negatifleri yakalanıp rollback edilir.
7. Prisma validate/generate ve gerçek datasource → güncel schema diff. Finans tabloları/indeksleri/FK'ları için hiçbir Finance DDL yok; DROP FUNCTION/POLICY/TRIGGER/RLS kaldırma yok. Genel diff'teki eski stock/FK/index farkları mevcut modelleme borcudur; diff uygulanmaz. Kabul edilmiş017 sonrası katalog aynı kalır.
8. Gerçek transaction'da scope ayarlı sentetik Tenant satırı commit edilir; COMMIT yanıtı bilerek kullanılmaz. Bağımsız admin bağlantısı tek dayanıklı satırı görür; sınıflandırma REVIEW_REQUIRED, otomatik retry yoktur. Yalnız sentetik probe açıkça temizlenir. Bu gerçek ağ kopması testi değil, deterministik response-loss simülasyonudur.
9. K1 20 + K2 15 + K3 16 + K4 12 + K5 8 =71 muhasebe; DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36 ile toplam235 API/SQL kontrolü. İki tenant/şirket/activity, finanssız yetki, MASTER explicit DENY, gerçek MFA süresi/yenileme, aynı request/source tekrarları, append-only journal/allocation/fund, dependency reversal, aynı açık borca iki ayrı personelin eşzamanlı tahsilatı ve gün sonu posting mutabakatı geçti. StockMovement sahte tüketimle değiştirilmez.

Bu görevde K5 backup/restore ve Playwright yeniden çalıştırılmadı; `--finance017` profili `--k5` ile birlikte olsa da backup job'unu çalıştırmaz. Önceki56 tablo restore ve browser kabulü K5 tarihsel kanıtıdır.

## Başarısız ve ara geliştirme koşuları

Tüm aşağıdaki cluster'lar izole yeni fixture'dır ve serverStopped=true ölçüldü; hiçbiri Neon/R2/restore değildir.

- `v42-8380136b-e494-4f36-a804-4803fe54e458`:017 çağrısında process-env fixture marker aktarımı eksikti; REMOTE_TEST_NOT_APPROVED. Kimlik kapısı gevşetilmeden çağrı bağlamı düzeltildi.
- `v42-797558ab-271c-46fa-b18b-edbc1420245c` ve `v42-d81bfb1e-b5df-41c6-bd28-476245243dd3`:DDL creation search_path'ta pg_catalog ilk sıradaydı; non-superuser CREATE red. Yaratım public/pg_temp'a, fonksiyonların sabit yolu pg_catalog/public'e ayrıldı. İkincisinde redakte tanılama eklendi.
- `v42-85c0f00a-35fa-4d4e-89a8-27163c85ee85`:fixture actor `pusula_can` sahibi değildi; GRANT authority eksikliği bulundu. Baseline function ownership doğru modellendi.
- `v42-e227f9d8-5851-4738-9acf-2d6405c1aeb1`:schema CREATE kullanımı grant authority sağlamıyordu; fixture gerçek schema owner yaptı, canonical preflight grant authority kontrolü eklendi.
- `v42-523b8893-4ca5-4b4d-aa0c-18d518832070`:önceki artifact ile gerçek canonical/non-superuser +235 API PASS; sonraki eklenmiş Prisma diff/gerçek Prisma hata yolu kabulünün yerine sayılmaz.
- `v42-c923f2e9-1943-4882-8cb8-21266b85e81c`:güçlendirilmiş artifact, gerçek Prisma rollback/deploy/repeat ve model diff PASS; commit probe Tenant RLS context eksikliğinde reddedildi. Probe tenant scope'u ayarlandı, RLS gevşetilmedi.
- `v42-11390cdb-849d-418e-8ba8-3c25530faa76`:aynı nihai017 checksum ile10 migration grubu +235 API PASS. Son phase inventory/URL allowlist korumaları eklendikten sonra yukarıdaki yeni nihai cluster yeniden çalıştırıldı.
- İlk Prisma validate introspection reverse one-to-one alanlarında6 composite unique hatası verdi. SQL unique'leri değiştirmeden reverse relation koleksiyon gösterimiyle giderildi; validate ve gerçek model diff geçti.

## Sınırlar

Yerel M017_LOCAL_PASS managed/Neon kabulü değildir.016 gerçek managed post/history16, provider role/ACL/grantor yaşam döngüsü,017 provider pre/post ve ayrı apply yetkisi; gerçek bağımsız şifreli backup/restore; recovery ROLE_DELTA_UNRESOLVED ve işletme kabulü BLOCKED kalır. `ACCOUNTING_CLOUD_REVIEW_REQUIRED` ve `STOCK_MANAGED_APPLY_DISABLED` açıktır.29 Ekim gerçek veri pilotu ancak bu ayrı kapılar kapanırsa mümkündür. [Kapsam ve kısa güvenli yol](../../research/PUSULA_ACCOUNTING_017_READINESS.md).
