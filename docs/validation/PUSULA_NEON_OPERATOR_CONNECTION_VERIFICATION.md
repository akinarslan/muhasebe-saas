# PUSULA — Neon operatör bağlantısı doğrulaması

24 Ekim 2026. Yalnız mevcut development kaynağı; API GET ve PostgreSQL READ ONLY katalogları. Bu belge mutation yetkisi veya gerçek backup kabulü değildir.

| Alan | Karar |
| --- | --- |
| API | **NEON_API_AUTH_PASS** |
| PostgreSQL | **NEON_DATABASE_READONLY_PASS** |
| Birleşik bağlantı | **NEON_OPERATOR_CONNECTION_READY** |
| Gerçek backup rolü uygulaması | **BACKUP_ROLE_REAL_APPLY_APPROVAL_REQUIRED** |
| Gerçek remote backup | **BACKUP_REMOTE_BLOCKED** |

## Dar kod düzeltmesi

`scripts/stock/provider-credential.ts`, açık process `NEON_API_KEY` varsa OAuth dosyasını okumadan bu kimliği seçer. Boş veya printable ASCII dışındaki karakterleri olan key reddedilir. Key yoksa eski OAuth yolu ve expiry doğrulaması aynen sürer. Seçilen key için HTTP/TLS hatasında OAuth veya başka kimliğe retry yoktur; token refresh/persist yoktur. Metadata yalnız credentialSource=api_key/oauth kaydeder. Geçerlilik uydurma expiry ile değil gerçek sabit GET sonucuyla belirlenir.

`cloud-preflight.ts` yalnız üç sabit route'a GET yapar; redirects reddedilir, her istek20s sınırındadır, HTTP200 şarttır. Branch project_id ve exact endpoint id/project/branch/host/read_write/disabled=false birlikte doğrulanır. DB startup'a idle transaction15s eklenir; PG18.6 zorunludur. `managed-runner.ts` incelendi; offline hazırlık modülü ve --apply reddi değişmedi. API GET başarısı CREATE/GRANT veya herhangi bir mutation yetkisi sayılmaz.

Windows User ortamından key yalnız PowerShell process belleğine aktarılıp child'a environment ile verildi; argv, URL, rapor, dosya veya log içine değeri yazılmadı. Sonrasında process environment girdisi kaldırıldı. `.env.local` veya eski OAuth credential dosyası düzenlenmedi.

Güvenli çalıştırma, User ortamından `NEON_API_KEY` process'e aktarıldıktan sonra:

```text
node --use-system-ca --import tsx scripts/stock/cloud-preflight.ts --read-only-development
```

Bu ortamda `--use-system-ca` olmadan ilk deneme provider NEEDS_EVIDENCE/READONLY_AUDIT_FAILED ve trace=[] verdi; bu deneme API PASS sayılmadı. Windows güvenilir CA deposunu etkinleştiren son komutla üç GET geçti. TLS/hostname doğrulaması kapatılmadı, rejectUnauthorized=false veya NODE_TLS_REJECT_UNAUTHORIZED=0 kullanılmadı. İlk SQL ölçümü de READ ONLY başarılıydı; nihai kabul aşağıdaki daha yeni snapshot'a dayanır.

## Güncel gerçek provider GET ölçümü

Başlangıç `2026-10-24T15:23:07.249Z`, credentialSource=api_key, CURRENT_IDENTITY_CONFIRMED, üç HTTP200:

1. `/projects/icy-queen-44442204`
2. `/projects/icy-queen-44442204/branches/br-rough-darkness-ba6ow9zo`
3. `/projects/icy-queen-44442204/endpoints/ep-blue-breeze-bavbjb7l`

Project `icy-queen-44442204`; branch `br-rough-darkness-ba6ow9zo`, name=development; endpoint `ep-blue-breeze-bavbjb7l`, host `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech`, read_write/disabled=false. Plan quota veya provider SQL lifecycle kabulü NOT_ESTABLISHED kalır. Ücretli destek/yeni proje/yeni motor yoktur.

## Güncel gerçek PostgreSQL ölçümü

Direct endpoint: aynı host:5432, `pusula_development`, current_user=session_user=`neondb_owner`, PG18.6. Pooler kullanılmadı. CA+hostname doğrulaması ve authorized/encrypted TLS kontrolü; startup default_transaction_read_only=on; BEGIN REPEATABLE READ READ ONLY; lock3s, statement10s/query15s, transaction60s, idle15s; terminal ROLLBACK ve close başarılı.

Kaynak40 tablo/26 FORCE RLS;001–015 başarılı migration+resolved008; schema/security/history/cluster karşılaştırmaları eski pre sözleşmesiyle eşit. Güncel snapshot fingerprint `7794ab78306b3e97b19400abb390fc5c5a9f8f560fd97cd61c1cf9e87c3f87eb`.494 grantor satırı hash'i `378e182781ee9cb740824ce50fc4b58de1175d629e1160478388272cda8d938a`; bağımsız expected494/matched494/missing0/unexpected0, accepted=false. Bu değerler aynı olsa da eski dosya güncel ölçüm yerine kullanılmadı.

Ek bağımsız READ ONLY authority transaction zamanı `2026-10-24T15:23:23.475Z`: `pusula_backup` yok; 40 tablonun SELECT grant authority ve source CONNECT/public USAGE grant authority doğrulandı. Actor NOSUPERUSER/CREATEROLE/BYPASSRLS; pg_signal_backend üyeliği mevcut. Rol olmadığı için gerçek backup backend kapatma veya eski credential rejection testi yapılmadı. Başka kaynak client session/ilgili kilit görülmedi; bu anlık gözlem bakım penceresi/yazar dışlama garantisi değildir. Parola/verifier veya iş/Auth/MFA/session satırları okunmadı.

## NOLOGIN paketinin yeniden incelemesi

[Runbook](../operations/PUSULA_BACKUP_ROLE_APPLY_RUNBOOK.md) SQL B gövdesi değiştirilmedi: SHA-256 `8b082cfd7386c36825fcdaa4e2e3e00089d9f67168b237fe16eaafd0d9d42fe6`. Tam40 tablo SELECT/public USAGE/source CONNECT; NOLOGIN/PASSWORD NULL/CONNECTION LIMIT0/BYPASSRLS; NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOREPLICATION; backup'ın üst role üyeliği yok; beklenen creator ADMIN ters kenarı ayrı validator ile kontrol edilir. Eski494 tuple korunmalıdır.

25 rol/17 üyelik/536 source grantor/42 explicit grant/0 backup session **beklenen post-delta** değerleridir; gerçek post ölçümü değildir. Gerçek CREATE/GRANT yoktur. Güncel fingerprint'e bağlı ayrı onay, başka DDL/ACL yazarlarının dışlanması, exact validator ve COMMIT öncesi rollback sözleşmesi gerekir. COMMIT belirsizliğinde otomatik retry yoktur.

Cross-DB altı PUBLIC nesnenin önceki24 Ekim14:42Z definition pinleri tarihsel kanıttır; bu görevde yalnız development DB yetkili olduğundan başka DB yeniden okunmadı. Gerçek apply onayında ayrıca yetkili fresh cross-DB drift kontrolü gerekir. PUBLIC CONNECT/TEMP, kendi kalıcı large-object, health routine'in provider tablo upsert etkisi ve C extension belirsizliği sürer. Supervisor/host crash kapanışı, gerçek credential yaşam döngüsü, bağımsız key/offsite/restore kabulü açık kalır; adapter remote BLOCKED'tır.

## Yerel kabul ve koruma

Gerçekten çalıştırılan testlerin nihai sonuçları [teslim raporundadır](../../reports/PUSULA_GITHUB_NEON_OPERATOR_DELIVERY.md). Exact NOLOGIN+risk-managed PG18.6 fixture66/66 PASS; UUID `e23-09c7e2c2-0dce-4ea1-ab7a-062ca015035a`, serverStopped=true/failureCode=null. Wrong target/busy lock/normal rollback/cleanup/22012/42710/42501+01007 ve eski state eşitliği kanıtlandı. Yerel grant authority fixture provisioning'inden gelir; Neon bootstrap/grantor hook kabulü değildir.

Private kanıtlar `.data/operator-delivery/`: provider-final.json, development-report-final.json/development-snapshot-final.json, authority.json, preflight-system-ca.log ve yerel test/build/checksum logları. `.data`, dump/cipher/key/fixture/generated çıktıları Git dışında kalır. Migration001–017 değişmez;016 SHA `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`;017 SHA `9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`. applyEnabled=false/postFingerprint=null, STOCK_MANAGED_APPLY_DISABLED, ACCOUNTING_CLOUD_REVIEW_REQUIRED ve remote backup guard'ları korunur.

Gerçek Neon rol/ACL/LOGIN/credential/dump/export/R2/restore/migration işlemi veya production/recovery/test müdahalesi yapılmadı. Yalnız incelenmiş feature dalı dosyaları için yetkili normal Git commit/push yapıldı; ayrıntı teslim raporunda.
