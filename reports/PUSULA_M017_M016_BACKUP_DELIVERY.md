# PUSULA M017 / M016 / Backup GitHub teslimi

24 Ekim 2026. **DELIVERY_BLOCKED — yerel doğrulama geçti; Git teslimi henüz tamamlanmadı.**

Bu rapor yalnız kaynak Git teslimini kapsar. Gerçek Neon uygulama onayı veya GO_LIVE_PASS değildir.

## Kapsam ve başlangıç

Dal: `feat/pusula-v030-neon-cloud`. Origin: `https://github.com/akinarslan/muhasebe-saas.git`.
Başlangıç HEAD, upstream ve bağımsız `ls-remote` sonucu: `edc03121737051d1eb180e621ccd91acfcc92743`.
Başlangıç ahead/behind: `0 / 0`; index boş. Planın 55 dosyası gerçek çalışma ağacıyla birebir eşleşti: 22 modified +33 untracked. Beklenmeyen kullanıcı dosyası yok.
Bu teslim raporuyla kesin kapsam **56 farklı dosya: 22 modified +34 added**. Kullanıcı kaynakları yeniden yazılmadı; LAST_REPORT dahil mevcut 55 dosyanın raw hash'leri korundu.

## Güncel doğrulama

| Komut | Sonuç |
| --- | --- |
| `npm.cmd test` | PASS, exit0; 44 dosya /497 test |
| `npx.cmd tsc --noEmit` | PASS, exit0 |
| `npm.cmd run lint` | PASS, exit0 |
| `npm.cmd run build` | PASS, exit0; compile, TypeScript ve static page generation tamamlandı |
| `node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | PASS, exit0;10 kontrol |

Test/build logları ve denetim metadata'sı ignored `.data/delivery-current/` altında; teslim edilmez. SQL fixture, dump/export veya restore bu görevde çalıştırılmadı. Önceki yerel kabul kanıtları tarihsel raporlarda korunur.

Secret taraması private key, bilinen GitHub/AWS/provider token kalıpları, credential URI ve secret assignment içerir. `.env.local` uzun credential değerleri yalnız bellekte karşılaştırıldı; rapora/loga yazılmadı. Yapılandırılmış secret eşleşmesi0.15 pattern bulgusu incelendi:6 `synthetic` token,3 açık sentetik fixture/hash/TOTP değeri,6 mock veya yerel rastgele credential ifadesi. Gerçek credential bulunmadı; bu tarama mutlak sır yokluğu garantisi değildir.

Staged kapsam tam56; deletion/rename0; her staged blob incelenmiş dosyanın Git clean-filter hash'iyle aynı. Staged secret taraması aynı15 sentetik bulguyla sınırlı, configured secret eşleşmesi0. Canonical/review/history ve dört SQL kaynak hash'i staged içerikten de doğrulandı. `.env.local`, `.data`, dump, ciphertext, key/credential, generated client, `.next`, test çıktıları kapsam dışında. İlk ağ denemesi sandbox proxy nedeniyle exit128; izinli salt okunur `ls-remote` tekrarında exit0 ve beklenen SHA alındı.

Düz `git diff --cached --check` exit2: yalnız byte-identical tarihsel K5 SQL'in CRLF satırları trailing whitespace olarak işaretlendi. `git -c core.whitespace=cr-at-eol diff --cached --check` exit0; gerçek satır sonu boşluğu hatası yok. Tarihsel byte/hash korunması için CRLF değiştirilmedi. Build uyarıları: repo dışındaki package-lock yok sayıldı; mevcut `src/lib/rate-store.ts` `.data` pattern'i344.066 dosyayla eşleşiyor, performans/over-bundling uyarısı sürüyor. Build deployment paketi olarak onaylanmadı; `.next` teslim dışı. Prisma informational stderr PowerShell'de NativeCommandError biçiminde kaydedilse de gerçek build exit0.

## Migration bütünlüğü

001–016 SQL çalışma baytları başlangıçla ve kabul edilmiş baseline'larla aynı; bu dosyalar stage edilmez. İlk16 Git blob'u da başlangıç HEAD ile aynı tutulur. Tüm16 raw SHA-256 listesi teslim edilen planın migration tablosunda bulunur.

- 016: `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`
- Canonical017 ve review kopyası: `9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`
- Tarihsel K5 adayı: `3548d3291a7c5c97919d5dee7ac20369c0c7a4de6888b4d21d17d4dcf4ad27aa`

004/005/007/008/012 çalışma dosyalarında önceden mevcut CRLF ile Git LF farkı korunur; tarihsel checksum normalize edilmez. Canonical017/review LF, eski K5 ve dört yerel SQL kaynağı `-text`; raw ve staged checksum eşitliği zorunludur. Manifest'in dört kaynak hash'i doğrulandı. Normal metinlerde Git clean-filter LF dönüşümü raw kullanıcı dosyasını yeniden yazmaz.

## Açık canlı engeller

M017_LOCAL_PASS ve BACKUP_LOCAL_READY yerel kabullerdir. M016_BLOCKED, ROLE_BLOCKED, CROSS_DB_BLOCKED ve BOTH_BLOCKED kararları korunur.494 grantor `accepted=false`; `token_roles / ROLE_DELTA_UNRESOLVED`, PUBLIC iki provider view/dört rutin ve UNKNOWN etkiler açık. Gerçek provider rol/ACL davranışı,016 managed apply ve017 provider kabulü, bağımsız şifreli backup/anahtar/offsite/restore ve ZY Reklam işletme kabulü kapanmadı.

`ACCOUNTING_CLOUD_REVIEW_REQUIRED`, `STOCK_MANAGED_APPLY_DISABLED`, `applyEnabled=false`, `postFingerprint=null` korunur. Gerçek Neon SQL/API, rol/ACL değişikliği, dump, R2 upload, restore, yeni proje/branch/snapshot veya production/recovery işlemi yapılmadı. Güvenli deploy paketi/build artifact kabulü bu Git tesliminin kapsamında değildir.

## Git teslim kanıtı

Commit SHA: henüz yok. Push exit code: henüz yok. Gerçek uzak ref: başlangıç SHA. Son ahead/behind ve çalışma ağacı teslim sonrası ölçülecek.
Önce kaynak+ilk rapor commit'i, ardından gerçekleşmiş push kanıtını kaydeden yalnız rapor commit'i kullanılacak. Rapora kendi commit SHA'sı döngüsel yazılamadığı için rapordaki teslim SHA'sı kaynak paketini ifade edecek; nihai rapor commit'i ve uzak ref son yanıtta ayrıca bildirilecek.

## Kesin dosya listesi (56)

- `.gitattributes`
- `LAST_REPORT.md`
- `docs/validation/PUSULA_ACCOUNTING_017_VERIFICATION.md`
- `docs/validation/PUSULA_BACKUP_LIVE_VERIFICATION.md`
- `docs/validation/PUSULA_M016_CLOUD_PREFLIGHT.md`
- `docs/validation/PUSULA_NEON_CROSS_DB_VERIFICATION.md`
- `prisma-finance-local.config.ts`
- `prisma-safe.config.ts`
- `prisma/migrations/202610230017_finance/migration.sql`
- `prisma/schema.prisma`
- `reports/PUSULA_M017_M016_BACKUP_DELIVERY.md`
- `reports/PUSULA_M017_M016_BACKUP_DELIVERY_PLAN.md`
- `research/PUSULA_ACCOUNTING_017_READINESS.md`
- `research/PUSULA_BACKUP_ARCHITECTURE_DECISION.md`
- `research/PUSULA_BACKUP_LIVE_READINESS.md`
- `research/PUSULA_BACKUP_MANAGED_FINAL_DECISION.md`
- `research/PUSULA_M016_CLOUD_READINESS.md`
- `research/PUSULA_M016_P0_BLOCKER_RESOLUTION.md`
- `research/PUSULA_M016_PROVIDER_REAUTH.md`
- `research/PUSULA_NEON_BACKUP_ROLE_DECISION.md`
- `research/PUSULA_NEON_CROSS_DB_AUDIT.md`
- `scripts/accounting/migration-candidate/017-finance.sql`
- `scripts/accounting/migration-candidate/history/017-finance-k5.sql`
- `scripts/accounting/migration-candidate/history/manifest-k5.json`
- `scripts/accounting/migration-candidate/manifest.json`
- `scripts/accounting/migration-contract.ts`
- `scripts/accounting/migration-fixture.ts`
- `scripts/accounting/prepare-migration.ts`
- `scripts/accounting/verify-k2.ts`
- `scripts/accounting/verify-k3.ts`
- `scripts/accounting/verify-k4.ts`
- `scripts/accounting/verify.ts`
- `scripts/backup/finance-data-fixture.ts`
- `scripts/backup/postgres.ts`
- `scripts/backup/profile-fixture.ts`
- `scripts/backup/restore-checks.ts`
- `scripts/backup/restore-fixture.ts`
- `scripts/backup/source-profile-pins.json`
- `scripts/backup/source-profile.ts`
- `scripts/backup/verify-local.ts`
- `scripts/db/verify-checksum-artifact.ts`
- `scripts/stock/cloud-preflight.ts`
- `scripts/stock/grantor-review.ts`
- `scripts/stock/managed-contract.ts`
- `scripts/stock/managed-execution-fixture.ts`
- `scripts/stock/managed-execution.ts`
- `scripts/stock/managed-fixture.ts`
- `scripts/stock/managed-runner.ts`
- `scripts/stock/migrate.ts`
- `scripts/stock/provider-credential.ts`
- `scripts/stock/verify-local.ts`
- `tests/accounting-release.test.ts`
- `tests/backup-release-profile.test.ts`
- `tests/backup-source.test.ts`
- `tests/m016-p0.test.ts`
- `tests/stock-cloud-preflight.test.ts`
