# PUSULA — Risk-managed doğrulaması

24 Ekim 2026 · Başlangıç dalı `feat/pusula-v030-neon-cloud`, HEAD `46372244f96d4623f625377579afdeec7aa06008`. Önceki commit edilmemiş6 dosyalık çalışma ağacı korunur; bu görev ayrı8 dosyalık değişiklik getirir. Git staging/commit/push yapılmadı.

## Kararlar ve anlamları

| Durum | Güncel sonuç |
| --- | --- |
| RISK_MANAGED_POLICY_PASS | **Yerel fixture sözleşmesi/negatifleri/adapter için PASS**; disabled remote profili etkinleştirmez |
| RISK_MANAGED_POLICY_BLOCKED | **Gerçek Neon için geçerli**; C/provider davranış kabulü ve remote object adapter açık |
| CREDENTIAL_LIFECYCLE_PASS | Yerel normal/hata/timeout/worker crash sonrası kapanış kabulü |
| CREDENTIAL_LIFECYCLE_BLOCKED | Bağımsız verifier kaybı negatifinde beklendiği gibi üretilir; closed=false olduğu sürece iş kabul edilmez |
| BACKUP_REMOTE_READY_FOR_APPROVAL | **VERİLMEDİ** |
| BACKUP_REMOTE_BLOCKED | **GEÇERLİ**; gerçek rolün kapatma yetkisi, gerçek key/offsite/restore kanıtları eksik |

Altı durum kodda ayrı isim/type olarak tanımlı. `riskManagedReadiness()` caller supplied boolean ile READY üretmez. Enabled varsayılan false; mevcut strict/managed selector ve manifest şeması yeni adı reddeder. Gerçek uzak CLI/export/upload yolu eklenmedi.

## Bu görevde gerçekten çalıştırılan komutlar

```powershell
node --import tsx scripts/backup/verify-local.ts --approve-local-fixture --restore-fixture --source-profile=pre016 --risk-managed-fixture
node --import tsx scripts/backup/verify-local.ts --approve-local-fixture --restore-fixture --source-profile=post016 --risk-managed-fixture
node --import tsx scripts/backup/verify-local.ts --approve-local-fixture --restore-fixture --source-profile=post017 --risk-managed-fixture
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run lint
node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact
```

| Nihai kontrol | Sonuç |
| --- | --- |
| pre01640/26/15+resolved008 |59 kontrol, exit0, serverStopped=true; `e23-eec51b1d-b4b9-4690-ba0b-1fc0d91fdb72` |
| post01647/33/16+resolved008 |59 kontrol, exit0, serverStopped=true; `e23-158daec1-a67a-4467-b1ef-0611213158b8` |
| post01756/42/17+resolved008 |61 kontrol, exit0, serverStopped=true; `e23-141e9e37-105b-4f0f-b3ed-bfcb028d1d52` |
| Vitest | PASS exit0;45 dosya/510 test; yeni profil13 test |
| TypeScript | PASS, exit0; `tsc-complete.log` |
| ESLint | PASS exit0; `lint-complete.log` |
| Checksum Git artifact | PASS, exit0;10 kontrol |

Her faz hem **yeni lease tabanlı adapter** hem mevcut normal profil regresyonu üzerinden gerçek pg_dump/pg_restore çalıştırır. Source/restore/metadata DB'leri yalnız o çalıştırmanın yeni UUID loopback PG18.6 cluster'ındadır; mevcut Neon test DB değildir. Build bu görevde istenmedi/çalıştırılmadı; eski build PASS yeni kanıt yapılmadı.

## Credential senaryoları — her release'de ayrı test

| Senaryo | Gerçek davranış ve kabul |
| --- | --- |
| Normal | Child process DB bağlantısı açıp exit0 olur; yeni giriş kapatılır; rol NOLOGIN/PASSWORD NULL; active0; eski parola bağlantısı reddedilir |
| Worker hata | Gerçek child error/exit24; outcome WORKER_FAILED, cleanup doğrulanır; başarılı backup sonucu üretilmez |
| Deadline | Gerçek child `pg_sleep(30)` ile açık backend tutar;3 saniyelik lease süresi sonunda outcome DEADLINE_EXCEEDED; timeout backend PID'sinin gerçekten sonlandırıldığı ayrıca assert edilir |
| Worker crash | Gerçek child process exit23; supervisor process/verifier çalışmaya devam eder; yeni giriş ve eski credential kapanışı doğrulanır |
| Verifier kaybı | Bağımsız kontrol bağlantısı bilerek kapatılır; worker outcome SUCCEEDED olsa da lifecycle BLOCKED/closed=false; dış fixture yöneticisi active0 olduğunu ayrıca kontrol eder |
| Güvenlik iş yükü | Aynı kısa credential ile DML/DDL/role/EXECUTE retleri ve diğer DB metadata sınıflandırması; sonra kapanış doğrulanır |
| Gerçek adapter iş yükü | Aynı lease içinde source audit/snapshot→dump→GCM/HMAC→ayrı kopya→decrypt→boş hedef restore; ardından credential kapanışı doğrulanır |

Her senaryoda başlangıç NOLOGIN/PASSWORD NULL ve active0 zorunlu. Backend sonlandırma `application_name` veya bütün DB kullanıcılarıyla değil **rol OID** filtresiyle yapılır. Başlangıçta aynı rolün mevcut oturumu varsa aktivasyon reddedilir. Bağımsız verifier yönetici PID'si bütün normal senaryolarda aynı kalır; başka kullanıcı oturumları hedeflenmez. Kapanışta yeni giriş önce engellenir, ardından rolün bütün DB'lerdeki canlı backend'leri kapatılır; bağımsız metadata ve gerçek eski-credential bağlantı denemesi gerekir.

Aktivasyonda kullanılabilir plaintext parola SQL'e gönderilmez: istemci ürettiği yüksek entropili secret için salted SCRAM-SHA-256 verifier oluşturur; sunucunun gerçekten SCRAM sakladığı boolean olarak denetlenir. Verifier da hassastır, rapora/loga yazılmaz. Worker secret'ı yalnız private IPC'den alır; pg_dump libpq credential'ı yalnız o child'ın dar ortamındadır. Gerçek secret dosyası üretilmedi/değiştirilmedi. SCRAM client/stored/server key türetimi [RFC5802](https://www.rfc-editor.org/rfc/rfc5802) ailesini kullanır; gerçek PostgreSQL SCRAM girişinin başarılı/başarısız olmasıyla uçtan uca doğrulandı.

Deadline sonrasında job başarılı sayılmaz. Nihai pre016/post016/post017 timeout cleanup süreleri sırasıyla **141/159/144ms**; her birinde yaşayan bir backup backend gerçekten sonlandırıldı, bağımsız active0 ve eski credential reddi doğrulandı. Ayrıntılı PID'ler `risk-managed-verification.json` içindedir; sıfır milisaniyelik hard kill garantisi verilmez. Parent supervisor/host crash, live owner yetki kaybı veya kontrol DDL lock'u için bağımsız dış gözetmen kabulü bu fixture'dan çıkarılamaz; uzak BLOCKED nedenidir.

## Negatif güvenlik / PUBLIC etkileri

- Gerçek Tenant/Business ve AuthUser INSERT/UPDATE/DELETE/TRUNCATE denemeleri42501. Post017'de FinanceJournal için aynı dört deneme42501; profil ACL sözleşmesi diğer Finance tablolarının da sadece SELECT hakkını doğrular.
- CREATE/ALTER ROLE, role GRANT, runtime SET; post016 stock executor ve post017 finance executor SET; CREATE SCHEMA/kalıcı CREATE TABLE ve uygulama function API EXECUTE42501. Önceki profil fixture'ının üyelik/DML/grant-option/schema/function ACL enjeksiyon retleri de aynı çalıştırmada korunur.
- Aynı backup login Customer'da iki tenant'ı tam görür. BYPASSRLS bu okuma için gereklidir; nesne SELECT yoksa veri erişimi verdiği varsayılmaz.
- Tam pg_database envanteri kaydedilir: datallowconn, effective CONNECT/TEMP/CREATE. Bağlantısı yasaklanan postgres/template1 için gerçek bağlantı retleri doğrulanır. Yeni `pusula_backup_fixture_risk` DB'sine PUBLIC CONNECT ile bağlanılır; PUBLIC view metadata okunur. template0 bağlantısızlığı katalogda ayrıdır.
- Yeni yerel metadata DB'de **gerçek pg_stat_statements1.12 C uzantısı** çalışır. Başka rolün SQL metni `<insufficient privilege>`/NULL, queryid0/NULL; kendi metni görünür; pg_stat_statements_info metadata'sı okunur. Sorgu metinleri log/rapora yazılmaz. Neon binary'sine eşitlik iddiası yoktur.
- Gerçek provider'dan okunan PL/pgSQL health-upsert davranışının yerel reproduction'ı INVOKER olarak çağrılır; tablo DML hakkı olmayan backup için iç42501/P0001 ret; health table count0. Gerçek provider rutini çağrılmaz. Memory rutininin gövdesi yalnız incelendi; bütün replica/provider durumları için PASS verilmedi.
- PUBLIC TEMP yeni metadata DB'de temp CREATE/INSERT'e izin verir. `lo_create` kendi kalıcı large-object'ini oluşturur/ownership verir; `lo_unlink` ile yalnız o sentetik OID kaldırılır. Bunlar “hiç yazamaz” diye gizlenmez. Rol postflight'ında ownership0 şartı vardır; iş/Auth/finans verisi yazma veya yükseltme istisnası yoktur.
- Rol flags, membership0, ownership0 ve source catalog/table/column/default/function ACL/RLS/trigger/constraint/index snapshot'ı işlem öncesiyle aynı olmalıdır. Adapter öncesinde ayrı metadata DB kaldırılır; kaynak kabulünde mevcut daha sıkı strict sözleşme kullanılır. Böylece canlı PUBLIC istisnasının uygulanmış olduğu iddia edilmez.

## Backup / restore kanıtı ve sınırı

Yeni adapter'ın lease'i sırasında mevcut source audit ve repeatable-read snapshot ile custom pg_dump alınır; TOC tam tablo/finans trigger kapsamı doğrulanır. Mevcut AES-256-GCM/HMAC ile şifrelenir, ayrı yerel klasöre ciphertext kopyalanır, hash/tag/MAC doğrulanır, decrypt sonucu yeni boş DB'ye mevcut pg_restore motoruyla uygulanır.

40/47/56 tablonun tamamında veri hash/count; migration geçmişi ve resolved008; kolon/constraint/FK/index/trigger/policy; FORCE RLS; function owner/body/definer/search_path/EXECUTE; table/column/default ACL ve grantor eşitliği kontrol edilir. Post017 dokuz dolu Finance tablo; journal/posting, allocation/fund/gider dengeleri ve append-only retleri korunur. Normal mevcut matrix'in yanlış key/manifest/cipher/decrypt ve restore guard negatifleri de geçer.

Ayrı kopya aynı bilgisayarda, restore DB aynı yeni cluster'dadır. Global roller zaten vardır; pg_dump global rol/DB ACL/uygulama MFA anahtarını bağımsız kurtarmış sayılmaz. Gerçek key custody, R2 offsite, harici boş hedef ve RPO/RTO kanıtı yoktur. Local source manifest'i fixture+strict-v1; ayrı risk-managed sidecar uzaktan export/upload yetkisi değildir.

## Provider katalog kanıtı

Yalnız24 Ekim13:53:40.074Z transaction'ında sabit development host'un `postgres` katalogları okundu. PG180006, actor neondb_owner, READ ONLY/REPEATABLE READ, TLS CA+hostname; rollback/close. Dört pg_proc tanımı, dil/symbol/library, owner/definer/config ve extension versiyonu; iki view definition/owner/reloptions alındı. Hiçbir provider fonksiyonu çağrılmadı, view satırı veya iş/Auth/MFA verisi okunmadı. Exact isim/hash ve sınıflandırma [uygulama raporunda](../../research/PUSULA_RISK_MANAGED_IMPLEMENTATION.md).

PG18.6 araç ZIP SHA `e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2`; pg_stat_statements DLL yalnız bu mevcut arşivden no-overwrite ile çıkarıldı, SHA `dc06a2ded89ae2b60a23019b4ad5107bd20e0b6e6571102f9f26e6ca13d24e1c`. Fixture bu DLL hash'ini bağlanmadan kontrol eder. Gerçek Neon host'unda DLL/binary yükleme veya değişiklik yoktur.

## İlk başarısız denemeler saklandı

İlk TypeScript kontrolü dar NODE_ENV tipleri ve child process overload sorunlarını yakaladı. İlk PG fixture, geç worker sonucunun timeout outcome'unu değiştirdiği yarışı yakaladı; terminal sonuç Promise.race'in dönüşünden alınacak şekilde düzeltildi. Sonraki fixture envanter sorgusunun reserved-word alias hatasını42601 ile yakaladı; can_connect/can_temp/can_create ile düzeltildi. C extension probu ilk eklenişinde bağlantı değişkeni kapsamı yanlıştı; TypeScript ve fixture hata verdi, doğru DB bağlantısı kapsamına taşındı. Bu denemeler PASS sayılmadı; bütün ilgili fixture'lar kendi serverStopped=true sonucu ile kapandı.

Ara matrix58/58/60, C probe eklenmiş59/59/61 ve nihai SCRAM aktivasyonlu59/59/61 ayrı log'lardır; rapor nihai `*-complete.log` dosyalarına dayanır. Tek Client üzerinde eşzamanlı katalog query deprecation uyarısı sıralı sorguya çevrildi; kapanmış source snapshot'a ikinci query/end çağrısı da kaldırıldı. Son tip/lint/test sonuçları nihai kaynak içindir.

## Koruma ve kesin kapsam

Bu görevde değişen8 yol: `scripts/backup/verify-local.ts`; dört yeni `scripts/backup/risk-managed*.ts`; yeni `tests/backup-risk-managed.test.ts`; `research/PUSULA_RISK_MANAGED_IMPLEMENTATION.md`; bu belge. Önceki LAST_REPORT, profile-fixture ve dört untracked kullanıcı raporu aynen korunur. İlk001–017 migration, kaynak SQL/manifest, strict/managed policy, remote guards ve `.env.local` koruma hash'leri **PASS**: değişen harness dosyası dışında472 başlangıç dosyası byte-identical; kesin kapsam8, secret pattern/configured-secret eşleşmesi0, diff whitespace kontrolü PASS; HEAD aynı, index boş. İlk16'nın mevcut CRLF/LF tarihsel ayrımı normalize edilmedi.016 SHA `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`,017 SHA `9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`. `applyEnabled=false` / `postFingerprint=null` değişmedi.

Yerel özel kanıtlar `.data/risk-managed/`: before.json, provider-definitions.json/log/okuyucu, tüm başarısız/ara/nihai fixture log/exit dosyaları, Vitest/TypeScript/ESLint/checksum logları. UUID fixture dizinlerinde risk-managed-verification.json, DB erişim envanteri, adapter sidecar, archive/decrypt ve ayrıntılı restore kanıtı vardır. Dump/cipher/key/credential/fixture/generated çıktıları teslim koduna dahil edilmez.

Gerçek Neon CREATE/ALTER ROLE/GRANT/REVOKE,016/017 apply, gerçek export/R2 upload/restore, yeni proje/branch/snapshot, production/recovery/test DB müdahalesi, `.env.local`/secret düzenlemesi ve Git stage/commit/push/merge yoktur. Mevcut `BACKUP_ACCESS_BLOCKED` ve uzak export/upload/accounting/stock kapıları otomatik kaldırılmadı.
