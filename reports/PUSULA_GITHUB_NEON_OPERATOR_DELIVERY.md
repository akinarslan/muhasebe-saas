# PUSULA — GitHub teslimi ve Neon operatör bağlantısı

24 Ekim 2026. Yalnız mevcut feature dalına normal Git teslimi, mevcut Windows User API key'iyle üç provider GET ve sabit development DB'de READ ONLY katalog kontrolü. Gerçek rol uygulaması yapılmadı.

| Alan | Sonuç |
| --- | --- |
| GitHub kaynak teslimi | **GITHUB_DELIVERY_PASS** |
| Neon API | **NEON_API_AUTH_PASS** |
| PostgreSQL | **NEON_DATABASE_READONLY_PASS** |
| Operatör bağlantısı | **NEON_OPERATOR_CONNECTION_READY** |
| Backup rolü gerçek uygulaması | **BACKUP_ROLE_REAL_APPLY_APPROVAL_REQUIRED** |
| Gerçek remote backup | **BACKUP_REMOTE_BLOCKED** |

## GitHub kanıtı ve kesin kapsam

Repository `https://github.com/akinarslan/muhasebe-saas`; ref `refs/heads/feat/pusula-v030-neon-cloud`. Başlangıç local/remote `46372244f96d4623f625377579afdeec7aa06008`. Başlangıç fetch ve iki push öncesi bağımsız ls-remote beklenen HEAD ile eşleşti; beklenmeyen ilerleme yoktu.

| Aşama | Commit SHA | Push exit | Bağımsız gerçek uzak HEAD |
| --- | --- | --- | --- |
| Önce kabul edilmiş backup/NOLOGIN çalışmalarının teslimi,17 dosya | `79eb5e526874c709cc20574948fda7c19b61b7af` |0 | `79eb5e526874c709cc20574948fda7c19b61b7af` |
| Dar API-key düzeltmesi/test/bağlantı doğrulaması,4 dosya | `9bf20b43cc4adf05094713fffe6ee662cf7026e8` |0 | `9bf20b43cc4adf05094713fffe6ee662cf7026e8` |

İkinci push sonrasında `git rev-list --left-right --count HEAD...origin/feat/pusula-v030-neon-cloud` sonucu **0/0**, `git status --porcelain` boş: çalışma ağacı temiz. Bu rapor ile LAST_REPORT append'i kaynak tesliminden sonraki ayrı normal belge commit'idir. Rapor kendi kendisinin commit SHA'sını içeremez; yukarıdaki SHA doğrulanmış son kaynak+verification teslimini tanımlar. Belge commit'inin nihai uzak HEAD/push/temiz ağaç doğrulaması özel final Git receipt'inde ve kullanıcıya son yanıtta kaydedilir.

Kesin teslim kapsamı **22 benzersiz yol**; stage yalnız açık dosya listeleriyle yapıldı. İlk17 yol:

1. `LAST_REPORT.md`
2. `scripts/backup/profile-fixture.ts`
3. `scripts/backup/verify-local.ts`
4. `docs/operations/PUSULA_29_OCT_GO_LIVE_EXECUTION.md`
5. `docs/operations/PUSULA_BACKUP_ROLE_APPLY_RUNBOOK.md`
6. `docs/validation/PUSULA_BACKUP_ROLE_PREAPPLY_VERIFICATION.md`
7. `docs/validation/PUSULA_LIVE_READINESS_VERIFICATION.md`
8. `docs/validation/PUSULA_RISK_MANAGED_VERIFICATION.md`
9. `research/PUSULA_BACKUP_PRACTICAL_SECURITY_DECISION.md`
10. `research/PUSULA_BACKUP_ROLE_APPROVAL_PACKET.md`
11. `research/PUSULA_LIVE_BLOCKER_RESOLUTION.md`
12. `research/PUSULA_RISK_MANAGED_IMPLEMENTATION.md`
13. `scripts/backup/risk-managed-fixture.ts`
14. `scripts/backup/risk-managed-lease.ts`
15. `scripts/backup/risk-managed-worker.ts`
16. `scripts/backup/risk-managed.ts`
17. `tests/backup-risk-managed.test.ts`

İkinci staged liste:

18. `scripts/stock/provider-credential.ts`
19. `scripts/stock/cloud-preflight.ts`
20. `tests/stock-provider-credential.test.ts`
21. `docs/validation/PUSULA_NEON_OPERATOR_CONNECTION_VERIFICATION.md`

Son belge staged listesi: bu rapor (**22. yol**) ve daha önce teslim edilmiş LAST_REPORT'a yalnız kısa sonuç append'i. Toplam üç commit'te17+4+2 dosya değişikliği; tekrar eden LAST_REPORT nedeniyle22 benzersiz yol.

## Gerçek test sonuçları

| Komut / kontrol | Sonuç |
| --- | --- |
| `npm.cmd test`, ilk teslim |45 dosya/510 test PASS, exit0 |
| `npm.cmd test`, final credential kaynağı |46 dosya/519 test PASS, exit0 |
| `npx.cmd tsc --noEmit` |İlk/final PASS, exit0 |
| `npm.cmd run lint` |İlk/final PASS, exit0 |
| `npm.cmd run build` |İlk/final PASS, exit0 |
| `node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` |İlk/final PASS,10 kontrol, exit0 |
| Exact NOLOGIN+risk-managed PG18.6 fixture |66 kontrol PASS, exit0, serverStopped=true/failureCode=null |
| Staged diff/secret/kapsam eşitliği |PASS; stage17 ve4, final belge listesi ayrı kontrol edilir |
| Korunan kullanıcı/migration/env baytları |PASS; dar provider2 dosyası ve LAST_REPORT append'i dışında mevcut dosyalar aynı |

Fixture komutu `node --import tsx .data/backup-role-approval/verify-role-local.ts --approve-local-fixture --restore-fixture --source-profile=pre016 --risk-managed-fixture`; UUID `e23-09c7e2c2-0dce-4ea1-ab7a-062ca015035a`. Bu private harness mevcut runner'ı kaynak değiştirmeden çağırır; B SQL'sinde yalnız fixture DB adı eşlenir. Yanlış hedef, busy lock, normal rollback, exact cleanup, geç22012, duplicate42710, eksik grant42501/01007; bütün eski state geri dönüşleri kontrol edildi. Non-superuser creator ADMIN yönü, SELECT40/ownership0/NULL parola ve risk-managed lease success/error/timeout/crash/bağımsız kapanış/şifreli sentetik restore kontrolleri geçti. Yerel yetki provisioning'i/Windows C binary testi Neon grantor hook veya patched binary kabulü değildir.

Final build'in derlediği uygulama kaynakları değişmedi; sonrasında yalnız API-key helper'ın trailing CR/LF reddi güçlendirildi ve test/TSC/lint519 ile tekrar geçti. Provider script'leri uygulama bundle'ının parçası değildir. Build mevcut üst dizin lockfile ve rate-store `.data` geniş dosya örüntüsü/over-bundling uyarılarını verdi; exit0 bu uyarıları kapatmaz. Yeni uygulama mimarisi veya bu alanda kapsam dışı düzeltme yapılmadı.

## Güncel bağlantı ve dar düzeltme

[Bağlantı doğrulaması](../docs/validation/PUSULA_NEON_OPERATOR_CONNECTION_VERIFICATION.md): `node --use-system-ca --import tsx scripts/stock/cloud-preflight.ts --read-only-development` gerçekten çalıştı. Windows User NEON_API_KEY yalnız process belleği/environment içinde kullanıldı; değeri argv/URL/log/Git/rapora yazılmadı. OAuth yenilenmedi. Açık API key varsa expired OAuth okunmaz; hatada başka kimliğe fallback yapılmaz. Key yoksa mevcut OAuth expiry retleri korunur. `managed-runner.ts` offline/mutation yasakları değişmedi.

Provider ölçümü15:23:07.249Z: project/branch/exact endpoint üç GET HTTP200, sabit ID/host/project/name/read_write/disabled=false eşleşti. İlk Node sistem CA etkin olmayan deneme provider NEEDS_EVIDENCE/trace=[] üretti; PASS sayılmadı. Sistem CA seçeneğiyle TLS doğrulaması korunarak final geçti.

Kaynak transaction15:23:09.004Z: direct host `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech:5432`, DB `pusula_development`, actor=session actor `neondb_owner`, PG18.6; verified TLS, readonly startup, REPEATABLE READ READ ONLY, kısa timeout, ROLLBACK/close.40/26;001–015 başarılı+resolved008; full pre schema/security/cluster/history eşit. Current fingerprint `7794ab78306b3e97b19400abb390fc5c5a9f8f560fd97cd61c1cf9e87c3f87eb`; grantor494/hash `378e182781ee9cb740824ce50fc4b58de1175d629e1160478388272cda8d938a`.

İkinci bağımsız source authority ölçümü15:23:23.475Z: rol yok, SELECT grant authority40/40, CONNECT/USAGE grant authority=true;494/494/missing0/unexpected0, accepted=false; pg_signal_backend üyeliği var. Gerçek backend kapatma kanıtı değildir. Anlık başka client/ilgili lock yokluğu gelecekteki DDL/ACL dışlaması değildir. İş/Auth/MFA/session satırları veya parola/verifier okunmadı.

## Gerçek rol uygulaması ve backup için kalan kapılar

NOLOGIN SQL B SHA `8b082cfd7386c36825fcdaa4e2e3e00089d9f67168b237fe16eaafd0d9d42fe6` aynen korundu. Sabit hedef/exact40 SELECT+public USAGE+source CONNECT; NOLOGIN/PASSWORD NULL/connlimit0/BYPASSRLS; yönetim/runtime/Auth/executor üst üyelik0 ve yalnız beklenen creator ters ADMIN kenarı.25 rol/17 üyelik/536 grantor/42 grant/session0 **planlanan değerlerdir**, gerçek post ölçümü değil.

Gerçek uygulama için ayrı hedef/SQL/fresh fingerprint'e bağlı onay; bakım/yazar dışlaması; BEGIN/kısa timeout; exact rol/ACL/ownership/üyelik/önceki494 tuple validator; herhangi bir sapmada COMMIT öncesi ROLLBACK; başarılı tek COMMIT ve bağımsız READ ONLY postflight gerekir. Belirsiz COMMIT'te replay/drop/retry yoktur. [Runbook](../docs/operations/PUSULA_BACKUP_ROLE_APPLY_RUNBOOK.md), [onay paketi](../research/PUSULA_BACKUP_ROLE_APPROVAL_PACKET.md) geçerlidir. Eski14:42Z cross-DB pinleri bu görevde yeni ölçüm diye kullanılmadı; yetkili fresh drift kontrolü gerçek apply kapısıdır.

Remote backup BLOCKED: PUBLIC CONNECT/TEMP ve kendi kalıcı large-object/kaynak tüketimi; health_check_write_succeeds() provider tablo upsert etkisi; C extension gerçek provider davranışı; BYPASSRLS ile bütün kaynak tenant/Auth/MFA okuması; live role/session0/credential reddi; supervisor/host crash dış denetleyicisi; bağımsız anahtar custody/offsite ve gerçek boş hedef restore kabulü eksik. API GET veya NOLOGIN hazırlığı bunları çözmez. Migration016/017 ve go-live kabulü verilmedi.

## Bütünlük ve yasak işlemler

Migration001–017 SQL değiştirilmedi.016 SHA `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`; canonical017 SHA `9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`; tarihsel K5 adayı korundu. Mevcut CRLF/LF uyarıları normalize edilmedi; checksum artifact PASS. Staged içerik gerçek .env credential değerleri ve User API key'iyle yalnız bellekte eşleştirildi; key/private-key/credential URI kalıpları tarandı. Sadece incelenen dinamik loopback fixture URI şablonu secret olarak değerlendirilmedi; public bucket/CA adları secret değildir.

`.env.local`, `.data`, credential/key/dump/ciphertext/fixture/generated/build çıktıları stage edilmedi. applyEnabled=false/postFingerprint=null, STOCK_MANAGED_APPLY_DISABLED, ACCOUNTING_CLOUD_REVIEW_REQUIRED ve uzak backup guard'ları değişmedi. Gerçek rol/ACL/LOGIN/export/R2/restore/migration veya production/recovery/test müdahalesi yok; force-push/rebase/reset/main merge/yeni branch yok.

Özel kanıt `.data/operator-delivery/`: initial/operator staged listeleri, scope/secret kontrolleri, iki kaynak commit/push exit/ls-remote receipt'i, test/build/checksum logları, provider/source/authority metadata ve decision.json. Bu klasör GitHub teslimine dahil değildir.
