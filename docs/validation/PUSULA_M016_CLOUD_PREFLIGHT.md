# PUSULA — M016 cloud salt okunur preflight ve yerel mekanizma doğrulaması

23 Ekim 2026 · Nihai **M016_BLOCKED** · Gerçek migration uygulanmadı.

## Güncel gerçek provider ve SQL

| Kontrol | Gerçek sonuç |
| --- | --- |
| `node --use-system-ca --import tsx scripts/stock/cloud-preflight.ts --read-only-development` | Komut native exit0: denetim tamamlandı; provider401 ve SQL kısmi kabul birlikte raporlandı. Bu exit code cloud readiness değildir. |
| Provider GET | `2026-10-23T10:46:05.514Z` /13:46:05 Türkiye; yalnız `/projects/icy-queen-44442204`, HTTP401. Sonrasında başka GET/refresh/login yok. |
| SQL snapshot | `2026-10-23T10:46:07.694Z` /13:46:07 Türkiye; sabit onaylı development host/DB/owner |
| TLS | CA validity, hostname/servername, rejectUnauthorized=true, minTLS1.2, stream encrypted+authorized PASS |
| Transaction | Startup default_transaction_read_only=on; repeatable read READ ONLY; lock3s/statement10s/transaction60s; sonunda ROLLBACK+close true |
| PostgreSQL |18.6 (fd34222) |
| Şema/history |40 tablo/26 FORCE RLS;15 başarılı001–015; unresolved0;016 satırı0/PENDING;017 yok |
|008 | Başarılı `db552670276d5e5d5b7ed37a78cc618bac9a79d8dc3e5d72cabe239dd4e7d36a`; bir rolled-back `35ca1ae820b9e040ef189f3ff346381c591a268b74e4c37f639e94d2dded1fd9` |
| Eski sözleşmeyle fark | Identity/count/history,8 schema,10 security,7 cluster kategorisi eşit.24 rol,16 membership metadata satırı; stock/finance executor/creator yok. |
| Grantor kapsamı |494 yeni table/function/schema/database/column/default ACL satırı; hash `378e182781ee9cb740824ce50fc4b58de1175d629e1160478388272cda8d938a`; pre.grantors=null korunur, enrollment yok |
| Actor | neondb_owner=session_actor; SUPERUSER=false, CREATEROLE/CREATEDB/BYPASSRLS/INHERIT=true; self-grant boş; schema CREATE/pusula_can EXECUTE grant authority true |
| Database CONNECT/TEMP | Aynı DB'den pg_database metadata'sı; development/neondb/postgres runtime/auth CONNECT+TEMP true; pusula_sprint_b_test CONNECT=false/TEMP=true. ACL göstergesidir; başka DB bağlantısı/nesne verisi veya fiilî erişim denemesi yok. |
| Mahremiyet | Auth/MFA/session/business satırı yok; yalnız katalog, migration ve Permission/RolePermission tanım metadata'sı |

Provider current mapping **UNVERIFIED**; SQL `historical-approved-host-only` olarak etiketlendi. Kaynak TLShost/DB/actor kontrolü provider GET yerini tutmaz. Eski401 yeniymiş gibi aktarılmadı: bu görevde yeni401 gerçekten alındı. Production/recovery/mevcut remote test DB bağlantısı veya provider mutation yok.

Özel kanıtlar: `.data/m016-cloud/current/{provider,development-report,development-snapshot}.json`, `.data/m016-cloud/read-only-run.log`. Snapshot fingerprint `7794ab78306b3e97b19400abb390fc5c5a9f8f560fd97cd61c1cf9e87c3f87eb`. Credentials ve ham kataloglar Git/rapor içeriğine taşınmaz.

## Çevrimdışı cloud inceleme planı

Gerçek READ ONLY snapshot'ı `prepareManagedExecutionReview()` ile mevcut sözleşme ve16-dosyalık stock manifest'e karşı çevrimdışı doğrulanıp `.data/m016-cloud/current/managed-execution-review.json` üretildi; native exit0. Bu adımda yeni network/SQL bağlantısı yok.

Plan `REVIEW_PROPOSAL_ONLY`, applyEnabled/applied/cloudAccepted false, automaticRetry=false.16 faz dosyası;017 yok. Öneri expected-post fingerprint `31a3cb06da92000f3f9050b8acd15fd33c133219abdd4a8fcfe1bf121370d7a7` güncel pre + source-pinned V4.3b.12 delta'sından hesaplandı. **Gerçek Neon post ölçümü değildir; postFingerprint=null.** Grantor pre bağımsız incelemesi, provider role lifecycle, source backup/key/offsite/restore, maintenance ve user apply onayı eksikleri plan içinde açıkça listelenir. Hiçbir pin kendiliğinden güncellenmez.

## Gerçek yerel PG18.6 komutları

Ortak komut:

```powershell
node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --managed-profile --accounting-profile --managed-execution-rehearsal
```

| Mod / ek bayrak | Son yeni fixture | Sonuç |
| --- | --- | --- |
| Normal | `v42-86a2f17b-7651-461d-b03d-6aa724305f1e` | PASS, COMMITTED_INVARIANTS_ONLY |
| `--managed-commit-unknown` | `v42-7f45c4bf-5600-41ad-92b3-43e5a085ba26` | PASS; beklenen COMMIT_OUTCOME_UNKNOWN, applied=null |
| `--managed-post-commit-drift` | `v42-1b413a51-0a67-4848-8901-e549f2fc302d` | PASS; beklenen POST_COMMIT_REVIEW_REQUIRED, applied=true |

Üçünün native exit0, status=PASS, serverStopped=true, failureCode=null, neonOperations=false, r2Operations=false. Her biri **yeni loopback cluster**; mevcut Neon test DB değildir. Yeni dump/backup rolü/R2/restore/snapshot yoktur. Komutlar `.env.local` yüklemez.

Her fixture'da9 mekanizma senaryosu:

1. Başka connection advisory kilidi: NOT_STARTED/BUSY; hiçbir yazma yok.
2. Pre schema drift: NOT_STARTED; engine değiştirmez. Enjeksiyonun explicit kaldırılması test harness'indedir.
3. Runtime etkin role düşürülmüş yetki:42501; ROLLED_BACK_CONFIRMED, tam pre ve history eşitliği.
4. Geç division-by-zero:22012; DDL+rol+metadata tam rollback.
5. PUBLIC EXECUTE enjeksiyonu: pre-COMMIT bağımsız delta reddi, tam rollback.
6. Creator remnant: role/security delta reddi, tam rollback.
7.01 sınıfı01007 warning transport enjeksiyonu: STOCK_REHEARSAL_ACL_WARNING ve rollback. Bu sentetik warning testidir; ayrıca eski bağımsız owner-boundary fixture'ı gerçek etkisiz REVOKE/GRANT01006/01007 davranışını yeniden ölçer.
8. Transaction'da bağlantı kapatılır: ROLLBACK_UNCONFIRMED, applied=null, retryAllowed=false; engine teyitsiz rollback'i başarılı saymaz.
9. Moda göre normalcommit, gerçek COMMIT yanıtını bilerek kullanmama veya COMMIT sonrası drift. Ayrı actor connection gerçek tek başarılı016 history kaydını ve eski satırların aynılığını doğrular; engine hiçbir durumda otomatik reapply/resolve/restore yapmaz.

Bu provada gerçek Prisma CLI deploy yerine exact016 gövdesi ve tek `_prisma_migrations` metadata INSERT'i aynı transaction'dadır. Başarılı016 sayısı16; buna ek eski rolled-back008 ayrı satır olarak korunur.17 finans migration uygulanmaz. Yeni bir metadata tablosu yaratılmaz; bu atomic registration davranışı gerçek cloud adapter review maddesidir.

Normal modda pre-ACL hash'i mevcut bağımsız `managed-fixture-baseline.json` pre piniyle eşleşir; pre+V4.3b.12 kaynak delta'sından expected post **DDL'den önce** hesaplanır. COMMIT öncesi ve sonrası exact bütünlük ayrı SELECT collector'larıyla ölçülür.6 v43b function,4 definer, PUBLIC0/runtime3/auth0 EXECUTE; grantor/owner/search_path, yedi FORCE RLS tablosu,47/33 post, izinler, tüm role/member/default/column katalogları ve geçici creator/SET/INHERIT/schema CREATE temizliği kabul edilir. Gerçek yedi runtime INSERT reddi ve kalan DML/TRUNCATE katalog retleri mevcut ACL helper'ında tekrar çalıştı. Bilinen history/checksum/role/ACL/grantor drift negatifleri de mevcut V4.3b.12 fixture'ında geçti.

Her üç yeni cluster'da AuthC2 9 + K1 cari20 smoke kontrolü PASS;235 K1–K5 tam API kabulü veya browser/restore bu görevde yeniden çalıştırılmış sayılmaz. M017'nin önceki235/API/build kanıtı tarihsel olarak aynen korunur.

Özel log'lar `.data/m016-cloud/final-{normal,unknown,post-drift}.log`; fixture dizinlerinde `verification.json`, `managed-execution-rehearsal.json`, `managed-contract-snapshots.json`, `managed-result.json`, `acl-owner-boundary.json`, `function-acl-postflight.json`. Kaydedilen expected post kaynak/delta beklentisidir; Neon enrollment değildir.

## Diğer gerçekten çalıştırılan kontroller

| Komut / kontrol | Sonuç |
| --- | --- |
| `npm.cmd test` | PASS;42 dosya /469 test; native exit0 |
| `npx.cmd tsc --noEmit` | PASS; native exit0 |
| `npm.cmd run lint` | PASS; native exit0 |
| `node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | PASS;10 kontrol; native exit0 |
| `git diff --check` ve source preservation | PASS;001–017 ham hash, M017'nin22 diğer dosyası, eski LAST_REPORT suffix'i, env/HEAD/index korundu |

CLI input/--apply red testleri credential/env/network erişiminden önce durur; yeni grantor ölçümü baseline'a enroll olmaz; yeni review paketi apply açamaz ve actual post pin'i yazamaz. Build bu görevde tekrar çalıştırılmadı; app/Prisma modeli değişmedi. Süreç ve read-only ağ erişimleri gerektiğinde sandbox dışı izinle, aynı kapsamda yapıldı; migration001–017 dosyaları değiştirilmedi.

## Ara/başarısız geliştirme koşuları

- `v42-6a32aa31-0b95-48e0-9f92-1c46acecc52b`:uyarı-negatifi beklenen warning yerine42501 verdi; genel fixture FAIL, serverStopped=true.
- `v42-f21d28f2-a13d-4a10-b6cd-c58b21bd3054`:redakte tanılama aynı nedenin42501 olduğunu gösterdi. Sahiplik cleanup sonrası eski actor'ın executor function REVOKE'u artık uyarı değil doğrudan yetki hatasıdır. Warning transport testi explicit01007 enjeksiyonuna ayrıldı; gerçek GRANT/REVOKE warning deneyi mevcut bağımsız owner-boundary testinde kaldı. SQL016 veya yetki kapısı gevşetilmedi.
- `v42-4332b065-ab51-467b-b7db-7a7a7a3d6359`, `v42-22e19dee-2edf-4ba3-97ec-a4423570775b`, `v42-3500b0d8-27be-4272-8e88-fd2793a95e65`:üç mod PASS. Son bağımsız pre-ACL pin kapısı eklendikten sonra yukarıdaki üç yeni final fixture tekrarlandı; ara PASS son kabul yerine sunulmadı.

## Korunan engeller

Güncel provider401,494 grantor incelemesi, provider role lifecycle kanıtı, gerçek bağımsız offsite/key/restore, writer/bakım/geri dönüş sorumlusu ve gerçek cloud adapter+apply onayı eksik. `token_roles / ROLE_DELTA_UNRESOLVED` açık. `applyEnabled=false`, `postFingerprint=null`, `pre.grantors=null`, `STOCK_MANAGED_APPLY_DISABLED` ve `ACCOUNTING_CLOUD_REVIEW_REQUIRED` korundu.

Gerçek development'ta yalnız yukarıdaki READ ONLY işlem yapıldı. Neon DDL/DML/GRANT/apply, gerçek dump, R2 upload, restore, snapshot, branch yaratma veya recovery/production/mevcut test DB değişikliği yok. Git stage/commit/push/merge yok.29 Ekim gerçek verili pilot bu kapılar kapanmadan BLOCKED. [Karar ve en kısa sıra](../../research/PUSULA_M016_CLOUD_READINESS.md).
