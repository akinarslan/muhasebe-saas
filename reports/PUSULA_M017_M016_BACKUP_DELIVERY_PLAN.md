# PUSULA — M017 / M016 / Backup GitHub teslim planı

23 Ekim 2026 · Hedef: 29 Ekim ZY Reklam ön muhasebe.

**GIT_DELIVERY_READY — yalnız incelenen kaynak/doküman paketinin sonraki onaylı Git teslimi için.** Zorunlu TypeScript, ESLint, Vitest, build ve Git artifact kontrolleri bu görevde çalıştırılıp geçti. **Staging/commit/push yapılmadı; teslim gerçekleşmiş sayılmaz.** Neon, backup/export, restore ve canlı kullanım engelleri devam ediyor.

## Git başlangıcı ve kesin kapsam

| Kontrol | Ölçüm |
| --- | --- |
| Dal | `feat/pusula-v030-neon-cloud` |
| HEAD | `edc03121737051d1eb180e621ccd91acfcc92743` |
| Upstream | `origin/feat/pusula-v030-neon-cloud` |
| Gerçek uzak ref | `git ls-remote --exit-code origin refs/heads/feat/pusula-v030-neon-cloud`: aynı tam SHA, native exit0 |
| Ahead / behind | `0 / 0`; yerel upstream ile HEAD aynı, uzak SHA da bağımsız okundu |
| Başlangıç index | Staged dosya0; `git diff --cached --quiet` exit0 |
| Çalışma ağacı | **22 tracked değişiklik +32 yeni dosya =54**; bu rapor eklendiğinde **22 +33 =55** |
| Silme / rename | Yok; önceki commit'lere, kullanıcı değişikliklerine veya raporlara müdahale edilmedi |

Önceki61 dosyalık K1–K6 paketi bu çalışma ağacının güncel sayısı değildir. Mevcut HEAD üzerindeki M017/M016/backup ve sonraki karar farkları esas alındı. İlk16 migration ve K1–K4 SQL kaynakları değişmemiş bağımlılıklardır; tekrar stage listesine alınmaz. Yeni canonical017, mevcut review kopyası ve eski K5 adayı birlikte korunur. Kullanıcı planları/K1–K5 raporları mevcut HEAD'de kalır; LAST_REPORT geçmişi teslim hazırlığında değiştirilmedi.

### Açık dosya listesi — gelecekteki staging için, bu görevde çalıştırılmadı

M = HEAD'e göre değişmiş22 tracked dosya; A = yeni33 dosya (bu rapor dahil). Aşağıdaki literal listeler dosya kapsamının tamamıdır; directory/glob veya `git add .` kullanılmaz.

```powershell
$modified = @(
  '.gitattributes'
  'LAST_REPORT.md'
  'prisma-safe.config.ts'
  'prisma/schema.prisma'
  'scripts/accounting/migration-candidate/017-finance.sql'
  'scripts/accounting/migration-candidate/manifest.json'
  'scripts/accounting/prepare-migration.ts'
  'scripts/accounting/verify-k2.ts'
  'scripts/accounting/verify-k3.ts'
  'scripts/accounting/verify-k4.ts'
  'scripts/accounting/verify.ts'
  'scripts/backup/postgres.ts'
  'scripts/backup/restore-fixture.ts'
  'scripts/backup/verify-local.ts'
  'scripts/db/verify-checksum-artifact.ts'
  'scripts/stock/managed-contract.ts'
  'scripts/stock/managed-fixture.ts'
  'scripts/stock/managed-runner.ts'
  'scripts/stock/migrate.ts'
  'scripts/stock/verify-local.ts'
  'tests/accounting-release.test.ts'
  'tests/backup-source.test.ts'
)
$new = @(
  'docs/validation/PUSULA_ACCOUNTING_017_VERIFICATION.md'
  'docs/validation/PUSULA_BACKUP_LIVE_VERIFICATION.md'
  'docs/validation/PUSULA_M016_CLOUD_PREFLIGHT.md'
  'docs/validation/PUSULA_NEON_CROSS_DB_VERIFICATION.md'
  'prisma-finance-local.config.ts'
  'prisma/migrations/202610230017_finance/migration.sql'
  'research/PUSULA_ACCOUNTING_017_READINESS.md'
  'research/PUSULA_BACKUP_ARCHITECTURE_DECISION.md'
  'research/PUSULA_BACKUP_LIVE_READINESS.md'
  'research/PUSULA_BACKUP_MANAGED_FINAL_DECISION.md'
  'research/PUSULA_M016_CLOUD_READINESS.md'
  'research/PUSULA_M016_P0_BLOCKER_RESOLUTION.md'
  'research/PUSULA_M016_PROVIDER_REAUTH.md'
  'research/PUSULA_NEON_BACKUP_ROLE_DECISION.md'
  'research/PUSULA_NEON_CROSS_DB_AUDIT.md'
  'scripts/accounting/migration-candidate/history/017-finance-k5.sql'
  'scripts/accounting/migration-candidate/history/manifest-k5.json'
  'scripts/accounting/migration-contract.ts'
  'scripts/accounting/migration-fixture.ts'
  'scripts/backup/finance-data-fixture.ts'
  'scripts/backup/profile-fixture.ts'
  'scripts/backup/restore-checks.ts'
  'scripts/backup/source-profile-pins.json'
  'scripts/backup/source-profile.ts'
  'scripts/stock/cloud-preflight.ts'
  'scripts/stock/grantor-review.ts'
  'scripts/stock/managed-execution-fixture.ts'
  'scripts/stock/managed-execution.ts'
  'scripts/stock/provider-credential.ts'
  'tests/backup-release-profile.test.ts'
  'tests/m016-p0.test.ts'
  'tests/stock-cloud-preflight.test.ts'
  'reports/PUSULA_M017_M016_BACKUP_DELIVERY_PLAN.md'
)
$paths = $modified + $new # 55 unique literal files
# SONRAKI ACIK GIT TESLIM ONAYINDAN SONRA, bu gorevde degil:
# git --literal-pathspecs add -- $paths
```

Kod kapsamı:017 non-superuser owner/ACL temizliği, dokuz Prisma modeli ve canonical geçmiş;016 kaynak-türetilmiş review/local rehearsal ve P0 grantor/credential kontrolleri;40/26 →47/33 →56/42 backup profilleri, resolved008 ve restore regresyon yardımcıları. Fixture **kaynak kodu** teslim edilir; fixture credential dosyaları, dump/restore çıktıları ve gerçek ölçüm dosyaları teslim edilmez.

## Migration SHA-256 / byte bütünlüğü

001–015 raw çalışma dosyaları `scripts/db/migration-baseline.json` ile,016 `scripts/stock/migration-baseline.json` ile birebir eşleşti. İlk16 SQL bu görevde değişmedi, Git değişiklik listesinde yok. Aşağıdaki adlar `prisma/migrations/<ad>/migration.sql` dosyalarını ifade eder:

| Migration adı | Değişmemiş raw çalışma SHA-256 |
| --- | --- |
| 202610160001_foundation | `8aee85371a154958570ba41ae9a4da7eefc6b54790c74e36af88a4a6a356af23` |
| 202610160002_scope_security | `94d2742fdd32026bf430185366795498ad20351ff937566f0c50f08713ee7d86` |
| 202610160003_auth_identity | `5280b80d14245e06f42df12d8dad0f5989f3b3e009c32172c617808ac8db7649` |
| 202610160004_auth_mfa | `96a7e660105b3ff8f897e0894d6eb8ceea3ee7152a4747c04cd1cbf449020644` |
| 202610160005_authorization | `27bfae7c1ba1622774e57d4fe226893f46089b5c68bef3e8779fe2c7c7ed899a` |
| 202610160006_invitation | `800cafc67b3b22d52428bbb7081fd709cd52b86c04e50c36b0621b89e5585506` |
| 202610160007_resource_policy | `b0154ad979dd5a3ba077dbfa65379fee95eb420283b59166c2c52ca0a986bd86` |
| 202610160008_company_metadata | `db552670276d5e5d5b7ed37a78cc618bac9a79d8dc3e5d72cabe239dd4e7d36a` |
| 202610160009_last_login | `f068d522fb5f8c7472294fd804c24952b3ab7704cd2c3d689587a2767cd51752` |
| 202610170010_auth_mail | `662eb41d02e3b3d6707facb83a7d5c8209e7c7679cce236579278f1f791496a7` |
| 202610170011_cloud_business | `d50442a98f4bc6dfce20f9daecced81755bb950bfc702bda60f148d2170c378c` |
| 202610170012_cloud_catalog_controls | `ee460b6466adbae8755b64840af36de3eb4d52756947ce6e6153fb2a791e2e2e` |
| 202610170013_sale_line_sealing | `91ab80f3b4b879007808377e6a43a477495426685d0f8c364384a2e370711085` |
| 202610190014_supplier_catalog | `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da` |
| 202610200015_purchase_orders | `181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a` |
| 202610210016_goods_receipts | `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567` |

**Canonical017 actual=expected:** `9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`. Review kopyası byte-identical, manifest.sha256 aynı;4 kaynak hash'i doğrulandı. Eski K5 artifact SHA `3548d3291a7c5c97919d5dee7ac20369c0c7a4de6888b4d21d17d4dcf4ad27aa`, yalnız tarihsel; yeni017 hash'i diye kullanılmaz.

**Git LF ayrımı:**004/005/007/008/012 çalışma dosyalarında önceden var olan tarihsel CRLF byte farkı bulunuyor. HEAD LF SHA'ları sırasıyla:

- 004 `eced9930cf54c6253430f3a5b3a77d4e98906ee6978b620769be8af181359abb`
- 005 `813bb385499c1f39c7a808ca030ac8f9585ddbb4db32bbfa0d7b6f6858b04a98`
- 007 `014cf289639104b7549448d0a0c752feb153c7be07cc707eaa9cfe55a48cba6d`
- 008 `5aa71bc7fd52a4d06b053623205dbe9f5530959bd46682dd7030722c1f2955ec`
- 012 `5179a9075660b49861b9176fc5713e28c6ee59109f083473525a1209a77ced39`

Bunlar `scripts/db/migration-checksum.ts` içindeki **tam beş onaylı çift**; genel newline toleransı veya baseline yenilemesi yok. Diğer11 dosya HEAD ile raw byte-identical. Mevcut migration geçmişi ve rolled-back008 hash'i korunur; Git LF artifact kontrolü bu ayrımı gerçek dosyalarla doğruladı. İlk16 tekrar stage edilmez veya newline dönüşümüyle yeniden yazılmaz.

017 canonical/review için `text eol=lf`, K1–K4 raw SQL ve tarihsel K5 için `-text` mevcut `.gitattributes` ile korunuyor. Bu byte-hassas girdilerde Git clean-filter hash'i raw hash'e eşit. 017'de CR yok. Normal metin dosyaları LAST_REPORT ve dört raporda mevcut CRLF/LF karışımı Git clean sırasında LF'ye dönüşür; metin geçmişi silinmez. Bu beş dosya: `docs/validation/PUSULA_ACCOUNTING_017_VERIFICATION.md`, `docs/validation/PUSULA_M016_CLOUD_PREFLIGHT.md`, `research/PUSULA_M016_CLOUD_READINESS.md`, `research/PUSULA_M016_PROVIDER_REAUTH.md`, `LAST_REPORT.md`. Bunlar migration hash girdisi değildir; hiçbirini bu görevde normalleştirmedim.

## Bu görevde çalıştırılan doğrulamalar

| Komut / kontrol | Sonuç |
| --- | --- |
| `npm.cmd test` | PASS;44 dosya,497 test,23.16s; native exit0 |
| `npx.cmd tsc --noEmit` | PASS; native exit0 |
| `npm.cmd run lint` | PASS; native exit0 |
| `npm.cmd run build` | PASS; Prisma7.10.1 client generate, Next16.4.1 compile2.3min, TypeScript ve7 static sayfa; native exit0 |
| `npx.cmd tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | PASS;10 kontrol, native exit0; bulut bağlantısı yok |
| `git diff --check` | PASS; çalışma farklarında whitespace hatası yok |
| Yerel secret / byte / inventory denetleyicisi | PASS; native exit0; gerçek configured-secret eşleşmesi0,15 pattern bulgusu elle sınıflandırıldı |

Build uyarıları korunur: repo dışındaki `C:\Users\tb\package-lock.json` yok sayıldı; değişmemiş `src/lib/rate-store.ts` geniş `.data` pattern'i344.033 dosyayla eşleştiği için performans/over-bundling uyarısı verdi. **Build çıktısının güvenli deployment paketi olduğu onaylanmadı**; `.next`/üretilmiş dosyalar bu Git tesliminde yok. Prisma informational stderr satırlarının PowerShell logundaki NativeCommandError biçimi native build başarısızlığı değildir; gerçek exit0 ve tamamlanan build ölçüldü. Bu görev packaging veya rate-store kodunu değiştirmedi.

Secret taraması: private-key blokları, bilinen token/anahtar kalıpları, literal credential URI ve secret assignment; ayrıca `.env.local` içindeki uzun credential değerleri yalnız bellekte teslim metinleriyle karşılaştırıldı, değerler çıktı/rapora yazılmadı.15 eşleşme: tests/m016-p0 içindeki6 `synthetic` token,3 açık sentetik fixture/hash/TOTP değeri ve6 mock/yerel rastgele credential interpolasyonu veya sentetik URL. Gerçek erişim credential'ı bulunmadı; sentetik test literal'leri gerçek credential olarak sunulmaz. `NEON_API_KEY` değeri okunmadı. Tarama mutlak sır yokluğu garantisi değildir; sonraki staged blob taraması yine zorunlu.

Yerel özel kanıtlar `.data/delivery-plan/` altında: beş doğrulama logu ve native `.exit` kayıtları, `review.json` (path/hash/EOL/secret bulgu metadata'sı), denetleyici. İlk sandbox Node→Git spawn EPERM denemesi başarılı sayılmadı; izinli yerel çalıştırma native0 ile tamamlandı. Gerçek PostgreSQL fixture/K1–K5 SQL, M017 non-superuser deploy veya backup export/restore **bu görevde yeniden çalıştırılmadı**; bunlar önceki doğrulama raporlarının tarihsel kanıtıdır. Buradaki497 Vitest sonucu günceldir.

## Teslim dışı ve korunan kararlar

Kesin liste dışında `.data`, `.env.local` ve diğer gerçek env/credential dosyaları, `.next`, generated Prisma client, `next-env.d.ts`, `*.tsbuildinfo`, key/vault/certificate, dump/ciphertext, backup/restore çıktıları, fixture credential/env dosyaları ve test log/coverage/screenshot çıktıları yoktur. Git tracked yasak yollar taraması0; değişmeyen `.env.example` stage edilmez. Host/proje kimlikleri secret değildir; parola/token içermeyen karar raporlarında kalır.

| Korunan sonuç | Teslimdeki kanıt / anlamı |
| --- | --- |
| M017_LOCAL_PASS | `research/PUSULA_ACCOUNTING_017_READINESS.md`; yerel kabul, cloud apply yetkisi değil |
| M016_BLOCKED | `research/PUSULA_M016_CLOUD_READINESS.md`; ayrı provider/backup/apply kapıları açık |
| BACKUP_LOCAL_READY | `research/PUSULA_BACKUP_LIVE_READINESS.md`; gerçek bağımsız offsite/restore kabulü değil |
| PROVIDER_REAUTH_PASS | `research/PUSULA_M016_PROVIDER_REAUTH.md`; sonraki API-key kanıtı eski401'i tarihsel bırakır; cloud-preflight OAuth kodunu otomatik yenilenmiş yapmaz |
| ROLE_BLOCKED | `research/PUSULA_BACKUP_MANAGED_FINAL_DECISION.md`; eski ROLE_NEEDS_EVIDENCE raporu da korunur |
| CROSS_DB_BLOCKED | `research/PUSULA_NEON_CROSS_DB_AUDIT.md`; PUBLIC iki view/dört rutin ve UNKNOWN etkiler |
| BOTH_BLOCKED | `research/PUSULA_BACKUP_ARCHITECTURE_DECISION.md`; yeni proje otomatik çözüm/READY değil |

`ACCOUNTING_CLOUD_REVIEW_REQUIRED`, `STOCK_MANAGED_APPLY_DISABLED`, applyEnabled=false/postFingerprint=null; backup remote-profile/object/upload guard'ları korunur. 494 grantor accepted=false ve `token_roles / ROLE_DELTA_UNRESOLVED` açık. Migration016 gerçek Neon kabulü,017 provider ACL/Prisma bulut kabulü, bağımsız şifreli backup/key/offsite/restore ve ZY Reklam gerçek işletme kabulü Git teslimiyle kapanmaz. Eski raporlar yeni durum gibi yeniden tarihlenmedi veya silinmedi.

## Sonraki açık onaylı Git tesliminin sırası

1. Bu55 dosyanın değişmediğini ve HEAD/dal/upstream/gerçek uzak ref'in yukarıdaki SHA'da olduğunu yeniden karşılaştır. Beklenmeyen dosya, byte/secret/test hatası veya uzak dal ilerlemesi varsa **DELIVERY_BLOCKED**; reset/rebase/force ile aşma.
2. Yalnız yukarıdaki55 literal path'i stage et. `git diff --cached --name-only` kümesi tam55 olmalı; staged deletion/rename ve ilk16 migration farkı0 olmalı. Her staged blob'u incelenen dosyanın Git clean-filter blob hash'iyle eşleştir; canonical017/review/source/history hash'lerini staged içerikten yeniden doğrula. Secret taramasını staged içerikte ve `git diff --cached --check` ile tekrarla. Bu görevde staging olmadığından staged55 kabulü yapılmış gibi raporlanmaz.
3. Ayrı Git teslim onayıyla tek commit için öneri: `feat(accounting): prepare M017 M016 and backup local acceptance`. Commit'in yalnız55 yolu içerdiğini doğrula; kullanıcı geçmişini koru.
4. Yalnız `git push origin HEAD:refs/heads/feat/pusula-v030-neon-cloud` normal push. main merge, yeni branch, force veya history rewrite yok. Uzak ilerlemişse işlemi durdur.
5. Tam commit SHA, gerçek remote ref, ahead/behind, `git status --porcelain`, staged kapsam sonucu ve push native exit code raporlanmalı. Bu görev bunları gelecek başarılı teslimmiş gibi doldurmaz.

Başlangıçta hashlenen467 mevcut dosya (001–017, eski çalışma ağacı, raporlar ve `.env.local` dahil) korundu; bu görev yalnız bu raporu ekler. Git index kayıtlarının SHA-256 özeti `30d24e93075bcf47242e237c896d8495ae4d3038931a78c395bf2faff3833bc7`; index/HEAD değişmedi. Üretilmiş yerel test/build/artifact çıktıları ignored kaldı. Gerçek Neon SQL/API, migration, rol/ACL, dump/export, R2/restore, proje/branch/snapshot veya production işlemi yok.

29 Ekim'e altı takvim günü var. Kaynak Git teslim hazırlığı tamamlandı; gerçek kaynak erişimi ve bağımsız kurtarma kabulü takvimin kritik yolu olmaya devam eder. **Bu plan GO_LIVE_PASS değildir.**
