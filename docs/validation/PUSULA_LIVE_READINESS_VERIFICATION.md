# PUSULA — Canlı hazırlık doğrulaması

24 Ekim 2026. Bu belgedeki güncel testler bu görevde gerçekten çalıştırıldı; önceki raporların PASS sonuçları yeni ölçüm diye taşınmadı. Başlangıç dalı `feat/pusula-v030-neon-cloud`, HEAD `46372244f96d4623f625377579afdeec7aa06008`, çalışma ağacı/index temiz.

## Ayrı kararlar

| Alan | Karar | Açık koşul |
| --- | --- | --- |
| BACKUP_ACCESS_DECISION | **BACKUP_ACCESS_BLOCKED** | postgres PUBLIC iki view/dört rutin ve sistem çağrısı sınırı; A/B/C'den hiçbiri gerçek güvenlik kabulü almadı |
| BACKUP_ROLE_READINESS | **BACKUP_ROLE_DDL_APPROVAL_REQUIRED**; yerel NOLOGIN hazırlığı PASS, gerçek erişim kabulü BLOCKED | Gerçek rol yok; provider erişim çözümü ve ayrı NOLOGIN DDL/post kabulü; LOGIN/export dahil değil |
| REAL_BACKUP_RESTORE_READINESS | **BLOCKED** | Gerçek anahtar custody, bucket/public/token/retention, kaynak export ve bağımsız boş hedef restore kabulü yok |
| M016_READINESS | **M016_BLOCKED** | Güncel pre eşitliği var; provider lifecycle/grantor insan kabulü, gerçek recovery ve cloud adapter/apply onayı eksik |
| M017_READINESS | **M017_BLOCKED** | Yerel canonical deploy kabulü var; gerçek016 bağımsız kabulü ve provider finance ACL/post kabulü yok |
| GO_LIVE_READINESS | **BLOCKED** | Gerçek personel/şirket kesimi/MFA ve bağımsız offsite/restore kabulü yok; GO_LIVE_PASS verilmedi |

## Gerçek komutlar ve native sonuçlar

| Komut | Güncel sonuç |
| --- | --- |
| `node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --finance017 --k5 --k5-browser` | PASS exit0;01710 kontrol grubu,235 API/SQL, desktop/mobile2 Playwright testi |
| `node --import tsx scripts/backup/verify-local.ts --approve-local-fixture --restore-fixture --source-profile=pre016` | PASS exit0;39 kontrol,40/26,15 başarılı +resolved008 |
| Aynı komut `--source-profile=post016` | PASS exit0;39 kontrol,47/33,16 başarılı +resolved008 |
| Aynı komut `--source-profile=post017` | PASS exit0;40 kontrol,56/42,17 başarılı +resolved008; dokuz dolu Finance tablo |
| `node --import tsx scripts/backup/verify-local.ts --approve-local-fixture --managed-neon-fixture` | PASS exit0;43 kontrol; PUBLIC risklerini gösterir, remote managed kabulü değildir |
| `node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --managed-profile --accounting-profile --managed-execution-rehearsal` | PASS exit0;9 senaryo; COMMITTED_INVARIANTS_ONLY |
| Aynı komut `--managed-commit-unknown` | PASS exit0;9 senaryo; beklenen COMMIT_OUTCOME_UNKNOWN/applied=null/retry=false |
| Aynı komut `--managed-post-commit-drift` | PASS exit0;9 senaryo; beklenen POST_COMMIT_REVIEW_REQUIRED/applied=true/retry=false |
| `npm.cmd test` | PASS exit0;44 dosya/497 test |
| `npx.cmd tsc --noEmit` | PASS exit0 |
| `npm.cmd run lint` | PASS exit0 |
| `node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | PASS exit0;10 kontrol |
| `node --import tsx scripts/stock/cloud-preflight.ts --read-only-development` | Süreç exit0; SQL `READONLY_AUDIT_PASS_WITH_LIMITATIONS`; provider OAuth `NEON_CREDENTIAL_EXPIRED_OR_EXPIRING`. Bu exit0 cloud READY değildir |
| Explicit API-key provider GET3/3 | HTTP200;10:42:30.751–31.364Z; key yalnız mevcut User ortamından belleğe alındı, log/hash/dosyaya yazılmadı |
| Operator-private `cross-db.ts` | exit0; üç DB katalog toplaması PASS; güvenlik kararı BLOCKED |
| Operator-private `r2-readonly.ts` | Son süreç exit0; config pin geçerli; HEAD başarısız/HTTP status yok; public/retention/token scope NOT_VERIFIED/NOT_PROVEN |

Bu görevde app/build kodu değişmedi. Build yeniden çalıştırılmadı; önceki Git tesliminin24 Ekim build exit0 ve mevcut rate-store over-bundling uyarısı tarihsel kanıttır, yeni PASS değildir. Yalnız fixture test kaynağı genişletildi; TypeScript/ESLint/Vitest ve gerçek PG kabulü günceldir.

## Yeni fixture kimlikleri

| Test | UUID | Sonuç |
| --- | --- | --- |
| Canonical017 + K1–K5 + browser | `v42-2b1c382e-41eb-42e4-9943-99b230f4ca36` | PASS; serverStopped=true |
| Backup pre016 | `e23-542c6cc0-8d63-48a8-97e0-21f4e04ef324` | PASS; serverStopped=true |
| Backup post016 | `e23-e6777dda-10fa-4a62-83e1-1c959a093d3d` | PASS; serverStopped=true |
| Backup post017 | `e23-e8bae119-b3f0-46f3-a0d1-41b9758dd2d8` | PASS; serverStopped=true |
| Managed backup risk fixture | `e22d-f5dcf631-3473-468e-b41e-8ece2481e3e6` | PASS; serverStopped=true |
|016 normal | `v42-d31b48ec-971b-4987-8748-f7de47112d97` | PASS; serverStopped=true |
|016 unknown | `v42-56c749d6-742e-423f-9892-73e5b9ab9d68` | PASS; serverStopped=true |
|016 post drift | `v42-abfa9963-f00e-4450-9d7f-e7cc07d09218` | PASS; serverStopped=true |

## Dört alanla kabul kapsamı

| Konu | Önceki engel | Yapılan somut düzeltme | Gerçek test kanıtı | Kalan işlem/onay |
| --- | --- | --- | --- | --- |
| NOLOGIN | Ayrı creator/admin temizleme ve INSERT/DELETE/executor negatifleri eksik | Tek değişen kod `scripts/backup/profile-fixture.ts`; local identity/UUID/PG180006 guard'ından sonra rollback-only roller. Exact SELECT40/47/56 ve grantor geri alma; creator ADMIN ile DROP | Üç fazda NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOREPLICATION/BYPASSRLS/PASSWORD NULL; backup→üst rol0; creator ters ADMIN=true, inherit/set=false. Gerçek synthetic login'de42501 INSERT/UPDATE/DELETE/TRUNCATE/schema CREATE/runtime SET; post016 stock executor ve post017 finance executor SET/API retleri | PG fixture davranışı provider hook değildir. Gerçek source rol/ownership/grantor/effective hak post kabulü ve ayrı DDL/LOGIN yetkisi |
| Backup sürümleri | Faz dışı şema/history ve ACL drift riski | Mevcut pin/sözleşmeler korunup matrix yeniden çalıştırıldı | Profil tablo/FORCE/history, function body/owner/definer/search_path/ACL, enum, trigger/TOC ve checksum; kötü üyelik/DML/grant-option/schema CREATE/function EXECUTE enjeksiyonları reddedilir.497 test içinde profil/history/function/grantor negatifleri | Modern profiller uzak source/CLI için hâlâ kapalı; otomatik enrollment yok |
| Sentetik restore | Dolu finans ve bağımsızlığı yanlış yorumlama riski | Mevcut pg_dump→AES-GCM/HMAC→decrypt→yeni boş local DB restore | Tüm40/47/56 tablo hash/count +katalog/RLS/function/ACL/trigger eşit; post017 dolu9 finance tablo ve journal/fund/gider/append-only. İki tenant tam backup SELECT. Wrong key/HMAC/ciphertext/decrypt negatifleri | Aynı bilgisayar/cluster/global roller hazır; bağımsız offsite, gerçek veri veya global rol restore PASS değil |
| Managed riskler | PUBLIC TEMP/CONNECT ve sistem çağrıları güvenli sanılabilir | Mevcut saldırı/risk fixture'ı tekrarlandı | PUBLIC TEMP ile temp DDL/DML; PUBLIC CONNECT ile diğer DB; definer/future SELECT/column grant veri sızıntısı; builtin large-object kalıcı yazma ve ownership drift reddi. Sequence/DDL/DML/member negatifleri de geçer | Gerçek provider rutinlerini çalıştırmadan tüm semantik sınır kanıtı yok; C allowlist eklenmedi |
|016 mekanizma | Atomic role/history, lock ve belirsiz sonuç | Mevcut local-only runner normal/unknown/post-drift provaları | Dedicated session identity, advisory busy, pre drift,42501/22012 tam rollback, ACL warning/creator/PUBLIC drift, bağlantı kaybı, commit outcome sınıflandırması; runtime3 doğrudan stock EXECUTE, PUBLIC0,47/33/history16; creator/member/CREATE kalıntısı0 | Gerçek adapter/provider lifecycle + recovery +ayrı016 onayı; false/null kapılar korunur |
|017 / K1–K5 | Provider kabulü ile yerel kabul karışabilir | Gerçek canonical SQL/Prisma non-superuser ve bütünleşik yerel testler tekrarlandı |9 Prisma model; finance DML/TRUNCATE/SET retleri, PUBLIC/auth EXECUTE/owner/RLS/constraint drift;17 tek history; retry yok. K120/K215/K316/K412/K58 =71 muhasebe, toplam235 API/SQL.10m² net4000/KDV800/brüt4800; tahsilat/gider/vadeli borç/ödeme/mutabakat | Gerçek016 kabulü, provider017 owner/ACL, ayrı017 ve API açılış onayı |
| Tarayıcı / işletme | Lost response/double collection ve kalıcılık | Gerçek Chromium desktop ve mobile viewport; sentetik gerçek MFA setup/step-up |2/2 test;2000 tahsilat commit cevabı route.abort ile kaybedilir; request tek, pending referans reload'da korunur, outcome sorgulanır; offline ve aynı context'te yeni sayfa açılışı. API/SQL suite iki personel/MASTER explicit DENY/MFA expiry/duplicate/reversal/gün sonu doğrular | Fiziksel telefon, tüm tarayıcı süreci yeniden başlatma veya gerçek personel kabulü değildir. Gerçek ZY finans kesimi/açılış ve offsite/restore imzası yok |

## Güncel salt okunur Neon kanıtı

Development kaynak transaction zamanı **2026-10-24T10:42:33.153Z**. Actor/session `neondb_owner`, DB `pusula_development`, PG18.6; default_readonly=on, READ ONLY/REPEATABLE READ, TLS doğrulamalı.40/26; identity/count/history, schema8/security10/cluster7 kategori karşılaştırmaları true. Snapshot fingerprint `7794ab78306b3e97b19400abb390fc5c5a9f8f560fd97cd61c1cf9e87c3f87eb`.494 grantor ham fingerprint `378e182781ee9cb740824ce50fc4b58de1175d629e1160478388272cda8d938a`; eski contract'tan bağımsız türetim494/494, missing0/unexpected0, **accepted=false**. Runtime veya owner'ın hakkı henüz olmayan backup hesabının hakkı sayılmadı.

Provider API güncel project/branch/endpoint pinlerini doğruladı: endpoint `ep-blue-breeze-bavbjb7l`, read_write, disabled=false; min/max0.25CU, history21600s, branch logical size55148544. Bu API GET kabulü OAuth runner credential'ını yenilemez; quota/kullanım ve provider ACL kabulü değildir.

| DB | UTC transaction | Sonuç |
| --- | --- | --- |
| neondb |10:42:45.952Z | PUBLIC CONNECT/TEMP; source dışı public view/routine yok; backup rolü yok |
| postgres |10:42:49.666Z | PUBLIC CONNECT/TEMP; pg_stat_statements ve pg_stat_statements_info SELECT; aynı isimli iki rutin +health_check_write_succeeds()+get_compute_primary_memory_bytes() EXECUTE; cloud_admin grantor/owner; hâlâ BLOCKED |
| template1 |10:42:52.637Z | PUBLIC CONNECT; TEMP yok; source dışı public view/routine yok; backup rolü yok |

Her DB21 sabit katalog sorgusu; TLS1.3, CA/hostname doğrulama; READ ONLY/REPEATABLE READ; lock3s/statement10s/transaction60s/idle15s; rollback/close3/3.24 rol/16 üyelik; iş/Auth/MFA/session/view satırları okunmadı, rutinler çalıştırılmadı. SQL'den provider mapping öğrenilmedi: aynı görevdeki explicit GET pinleri kullanıldı. Üç snapshot atomik cross-DB snapshot değildir. Katalog toplama PASS, erişim güvenliği PASS değildir.

## Koruma, başarısız denemeler ve kanıt yerleri

İlk snapshot alma denemesi sandbox Node→Git EPERM nedeniyle çalışmadı; süreç izniyle tekrar alındı. Dar private kanıt klasörü ACL'si ilk tsc/lint log yazımını engelledi; bu denemeler PASS sayılmadı, elevated final komutlar gerçek exit0. R2 private TS denetleyicisinin ilk top-level-await/CJS dönüşümü isteğe başlamadan exit1 verdi; async main düzeltmesi sonrası kontrol çalıştı, HEAD yine BLOCKED. İlk başarısız loglar saklandı; r2 final süreç exit0 güvenlik kabulü değildir. Otomatik approval rejection olmadı; ilave bulut işlem yetkisi istenmedi.

Yerel özel kanıtlar `.data/live-readiness/`: preservation, provider metadata, preflight/cross-DB JSON/log, grantor review, R2 metadata, K5/browser, üç backup profil/managed risk ve üç016 rehearsal log/exit dosyası; fixture dizinlerinde verification.json ve ayrıntılı test raporları. Güncel preflight'ın `.data/m016-cloud/current/` çıktısı ayrıca burada referans alınır. Secret/credential/dump/ciphertext/key/generated client/build/screenshot/test çıktıları Git dışındadır; rapora erişim anahtarı yazılmaz.

016 SHA `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`; canonical017/review SHA `9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`; tarihsel K5 SHA `3548d3291a7c5c97919d5dee7ac20369c0c7a4de6888b4d21d17d4dcf4ad27aa`. İlk16 raw/HEAD bytes,001–017 tüm SQL/manifest, K1–K4 kaynakları, eski raporlar ve `.env.local` başlangıç hash'leri korunur. Git index/HEAD değişmez. LAST_REPORT yalnız append edilir. Son koruma/diff **PASS**: değişmesine izin verilen iki tracked dosya dışında467 başlangıç dosyası byte-identical; LAST_REPORT eski prefix hash'i aynı; kesin5 dosya kapsamı; secret pattern/configured-secret eşleşmesi0; `git diff --check` exit0. İlk16 için önceden bulunan beş raw CRLF/Git LF farkı korunur, normalize edilmez. Bağımsız `git ls-remote` gerçek feature ref'ini yine `46372244f96d4623f625377579afdeec7aa06008` olarak doğruladı; GitHub teslim geçmişi değişmedi.

Kesin5 dosya: `scripts/backup/profile-fixture.ts`, `docs/operations/PUSULA_29_OCT_GO_LIVE_EXECUTION.md`, `research/PUSULA_LIVE_BLOCKER_RESOLUTION.md`, bu doğrulama belgesi ve `LAST_REPORT.md`.

Gerçek Neon DDL/DML/GRANT/REVOKE/migration/export, R2 upload/download, gerçek restore, yeni proje/branch/snapshot, production/recovery/test DB değişikliği, secret dosyası düzenleme ve Git stage/commit/push/merge yapılmadı. Yalnız yerel yeni fixture'larda sentetik SQL/export/restore gerçekleştirildi. `ACCOUNTING_CLOUD_REVIEW_REQUIRED`, `STOCK_MANAGED_APPLY_DISABLED`, `applyEnabled=false`, `postFingerprint=null` ve bütün uzak backup guard'ları korunur.
