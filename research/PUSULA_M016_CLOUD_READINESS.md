# PUSULA — Migration016 Neon cloud readiness

23 Ekim 2026 · Dal `feat/pusula-v030-neon-cloud` · HEAD `edc03121737051d1eb180e621ccd91acfcc92743`.

**M016_BLOCKED.** Development salt okunur SQL ön denetimi güncel olarak geçti; provider GET **HTTP401**, bağımsız gerçek kaynak backup/restore ve provider rol yaşam döngüsü kanıtları eksik. Bu görev gerçek016 apply veya GO_LIVE onayı değildir.

| Karar | Durum |
| --- | --- |
| M016_READY_FOR_APPROVAL | **VERİLMEDİ** — aşağıdaki P0 kapıları kapanmadı |
| M016_NEEDS_EVIDENCE | Güncel provider kimlik/kapasite,494 grantor kaydının bağımsız incelenmesi, gerçek provider rol yaşam döngüsü ve operasyon kabulü |
| M016_BLOCKED | **Nihai karar** — gerçek kaynak bağımsız offsite/key/restore kabulü yok; canlı apply girişi kapalı |

## Gerçekte tamamlanan yeni kanıt

V4.3b.10–12, K6 ve M017 raporları incelendi. V4.3b.11'in SQL ACL kusuru tarihsel; V4.3b.12'de düzeltilmiş olan016 SQL yeniden değiştirilmedi. Yeni denetim bu sabit SQL ve sözleşmeye bağlıdır.

23 Ekim **13:46:05 Türkiye /10:46:05Z** provider isteği yalnız `GET /projects/icy-queen-44442204` yaptı ve **HTTP401** aldı. Sonrasında branch/endpoint/consumption/başka proje GET'i, token yenileme, login veya alternatif credential denemesi yok. Güncel proje/branch/endpoint eşlemesi, kapasite ve korunan recovery/production/test kaynaklarının güncel varlığı doğrulanamadı. V4.3b.7–10 kanıtı güncelmiş gibi kullanılmadı.

Ayrı olarak, daha önce açıkça onaylanmış **sabit development host** üzerinde13:46:07 Türkiye /`2026-10-23T10:46:07.694Z` transaction snapshot'ı alındı:

- Host `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech`, DB `pusula_development`, actor=session_actor=`neondb_owner`. Branch `br-rough-darkness-ba6ow9zo` eşlemesi **tarihsel**; SQL erişimi provider401 eksikliğini kapatmaz.
- CA validity/hostname/servername/rejectUnauthorized/TLS≥1.2 ve bağlantının encrypted+authorized kontrolü geçti. Startup `default_transaction_read_only=on`, `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, lock3s/statement10s/transaction60s; sonunda gerçek ROLLBACK ve bağlantı kapanışı doğrulandı.
- PostgreSQL **18.6 (fd34222)**;40 tablo/26 FORCE RLS;001–015 başarı sayısı15; unresolved0;016 history satırı0 → **PENDING**.008 bir başarılı + bir bilinen rolled-back kayıt olarak korundu. Ne016 ne017 uygulandı.
- Tarihsel sözleşmeye karşı identity/count/history,8 schema,10 security ve7 cluster kategorisi eşleşiyor. Cluster24 rol/16 üyelik satırı; stock/finance executor veya creator yok. Bunlar katalog metadata'sıdır; kullanıcı/authorization atama satırları okunmadı.
- Yeni tam table/function/schema/database/column/default ACL **grantor envanteri494 kayıt** olarak toplandı. Eski `pre.grantors=null` boş ACL sayılmadı, değiştirilmedi. Yeni ölçüm kendini baseline'a enroll etmez; bağımsız inceleme bekler.
- Database CONNECT/TEMP hakları yalnız aynı development bağlantısından `pg_database` metadata'sıyla ölçüldü. Runtime/auth için development yanında neondb/postgres CONNECT/TEMP hakları görülüyor; test DB'de CONNECT=false/TEMP=true. Bu yeni bir izin değişikliği değildir; mevcut diğer DB nesne yetkileri veya fiilî erişim denemesi kabulü sayılmaz. Başka DB bağlantısı açılmadı; cross-DB nesne audit'i/backup güvenlik kabulü hâlâ eksik.
- Actor SUPERUSER=false, CREATEROLE/CREATEDB/BYPASSRLS/INHERIT=true, createrole_self_grant boş; schema CREATE ve pusula_can EXECUTE grant authority true. Katalogdaki yetki, Neon CREATE/SET/GRANT/REVOKE/DROP hook davranışının ispatı değildir; gerçek rol denemesi yapılmadı.

Yalnız sistem katalogları, migration metadata'sı ve Permission/RolePermission tanım metadata'sı okundu. Auth/MFA/session veya business row içeriği okunmadı. Kullanıcı verisi değişmedi; advisory lock bile gerçek kaynakta alınmadı.

## Kanıt kimlikleri ve inceleme teklifi

| Kanıt | SHA-256 / değer |
| --- | --- |
| Sabit016 SQL | `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567` |
| Korunan017 SQL | `9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c` |
| Güncel READ ONLY snapshot fingerprint | `7794ab78306b3e97b19400abb390fc5c5a9f8f560fd97cd61c1cf9e87c3f87eb` |
| Yeni grantor pre fingerprint | `378e182781ee9cb740824ce50fc4b58de1175d629e1160478388272cda8d938a` |
| Kaynaktan türetilen **öneri** post fingerprint | `31a3cb06da92000f3f9050b8acd15fd33c133219abdd4a8fcfe1bf121370d7a7` |
| Gerçek Neon postFingerprint | **null —016 uygulanmadı** |

`prepareManagedExecutionReview` güncel READ ONLY pre + sabit V4.3b.12 delta'sından **REVIEW_PROPOSAL_ONLY** paketini çevrimdışı üretir.16 migration fazı içerir;017 dahil edilmez. Öneri post hash'i ilk görülen gerçek posttan öğrenilmedi, gerçek post sonucu veya enrollment değildir. Eksik yetki/backup/operasyon kabulünü atlayamaz; `applied=false`, `applyEnabled=false`, `cloudAccepted=false`, `automaticRetry=false`.

Yerel özel kanıtlar `.data/m016-cloud/current/{provider,development-report,development-snapshot,managed-execution-review}.json`. Ham kataloglar, credential ve fixture log'ları teslim kapsamı dışıdır. Bu dosyaların varlığı bağımsız inceleme yerine geçmez; kaynak snapshot'ı uygulama hemen öncesinde yenilenmelidir.

## Managed mekanizma: kod ve izole fixture kabulü

Yeni `managed-execution.ts` **yalnız localIdentity/UUID/loopback/actor/port/PG18.6** doğrulamasından sonra çalışır; provider Client constructor'ı veya CLI bağlantısı yoktur. Bağımsız eski fixture pre-ACL pini ve kaynak şema beklentisi kontrol edilir. Mevcut `managed-runner --apply` hâlâ ilk aşamada `STOCK_MANAGED_APPLY_DISABLED` verir; `managed-contract.json` ve `managed-baseline.json` içindeki false/null korumaları değiştirilmedi.

Mekanizma aynı dedicated fiziksel session ve advisory2142042 kilidi altında pre'yi tekrar ölçer; exact016 checksum'unu kontrol eder.016 dosyası değişmeden dış BEGIN/COMMIT sınırını mekanizma yönetir; gövde aynı transaction'da yürür. Var olan tek `_prisma_migrations` tablosuna016 kaydı DDL ile **aynı transaction içinde** yazılır. Bu provada **Prisma CLI deploy çalıştırılmadı**; atomik metadata davranışı gelecekteki gerçek cloud adapter incelemesinin açık kabul konusudur. İkinci history tablosu, resolve/skip veya checksum rewrite yoktur.

COMMIT öncesi SELECT-only post collector ve COMMIT sonrası READ ONLY collector; source-derived expected delta ile schema/history/permission/ACL/grantor/owner/role/üyelik/default/column envanterini tam karşılaştırır. PUBLIC EXECUTE0, yalnız3 runtime API EXECUTE,4 definer ownership, creator/üyelik/schema CREATE kalıntısı0 zorunludur. Warning01 sınıfı (01006/01007 dahil) commit'i durdurur. Eski strict READ ONLY collector gevşetilmedi; pre-COMMIT post collector ayrı ve yalnız SELECT yapar.

| Durum | Mekanizma davranışı |
| --- | --- |
| Kilit veya pre drift | NOT_STARTED; yazma yok |
| Yetki/SQL/ACL/postflight hatası; rollback ve pre tam eşitliği teyitli | ROLLED_BACK_CONFIRMED; retry yok |
| Bağlantı kaybı, rollback teyitsiz | ROLLBACK_UNCONFIRMED; applied=null; retry yok |
| COMMIT gönderildi, yanıt bilinmiyor | COMMIT_OUTCOME_UNKNOWN; applied=null; rollback/reapply yok, dedicated bağlantı kapatılır |
| COMMIT sonrası post drift/hata | POST_COMMIT_REVIEW_REQUIRED; commit rollback sayılmaz; retry/restore/history düzeltmesi yok |
| Yerel COMMIT + post eşit | COMMITTED_INVARIANTS_ONLY; cloudAccepted=false |

Üç **yeni** PG18.6 fixture'da normal, kayıp COMMIT yanıtı ve post-COMMIT drift yolları geçti. Her birinde9 mekanizma senaryosu, eski V4.3b.12 managed/ACL negatifleri ve Auth9 + K1 cari20 smoke kontrolü tekrarlandı. Kayıp yanıt, gerçek COMMIT yanıtını bilerek kullanmayan deterministik simülasyondur; gerçek Neon ağ/failover kabulü değildir. Post-drift'in explicit temizliği yalnız test harness'indedir; mekanizma otomatik temizlemez. Ayrıntı [doğrulama belgesinde](../docs/validation/PUSULA_M016_CLOUD_PREFLIGHT.md).

Gerçek cloud writable adapter/approval bağlama bu görevde açılmadı. Standby inceleme paketi ve execution çekirdeği hazırdır; provider kanıtı, tam pre kabulü, backup ve açık kullanıcı onayı olmadan sadece JSON bayrağını değiştirmek geçerli bir dağıtım yolu değildir. Gerçek bağlantı adapter'i ve atomik history sözleşmesi ayrıca incelenmelidir.

## P0 kapıları: tam eksik, işlem ve yetki

| Engel | Eksik olan ve en kısa kapanış | Dosya/işlem | Beklenen yetki |
| --- | --- | --- | --- |
| Provider401 | Güncel proje/branch/endpoint/kapasite ve operasyon kimliği yok | Yetkili erişim düzeldikten sonra sabit hedefe yeni GET; `cloud-preflight.ts` | Neon hesap/proje sahibi erişim sağlamalı; bu görev credential yenilemedi |
| Yeni grantor pre review |494 satır yeni ölçüldü, önceki pin null; bağımsız kabul yok | Özel snapshot + `managed-execution-review.json`; incelenmiş versioned pre sözleşmesi | Bağımsız güvenlik/DB inceleyicisi; otomatik enrollment yok |
| Provider role lifecycle | Katalog capability var, Neon CREATE/SET/ownership/GRANT/REVOKE/DROP başarı kanıtı yok | Provider tarafından doğrulanmış davranış kanıtı veya ayrıca açık onaylı izole prova | Provider yöneticisi; bu görev gerçek rol/DDL denemesine yetki vermez |
| Gerçek kaynak geri dönüş | Mevcut40/26 kaynak için bağımsız şifreli offsite, key custody/recovery, global role/DB ACL ve gerçek restore kabulü yok | Mevcut backup motorunun source audit/export/restore runbook'u | Kaynak okuma/export, role/GRANT, anahtar, offsite/R2 ve yeni hedef restore ayrı açık yetki ister |
| Recovery | token_roles kökeni/rol farkı çözümlenmedi; güncel branch/restore kabulü yok | Önceki recovery raporları; bağımsız rol/ACL ve cutover incelemesi | Recovery sorumlusu; branch değişikliği ayrıca yetkilendirilmeli |
| Operasyon ve canlı adapter | Writer dışlama, bakım penceresi, geri dönüş sorumlusu, onaylı writable adapter/history kontratı ve016 apply yetkisi yok | Managed review paketi + sonraki incelenmiş cloud bağlantı değişikliği | Uygulama/DB sorumlusu ve hedef+checksum bağlı açık kullanıcı016 apply onayı |

Gerçek kaynak backup kabulü **BLOCKED**: default uzak backup35 tablo/21 FORCE RLS; güncel kaynak40/26,016 sonrası47/33,017 sonrası56/42. Yalnız listeyi genişletmek rol/ACL/function/cross-DB ve restore güvenlik kabulü değildir. K5'in aynı makine/aynı cluster/sentetik anahtarla56 tablolu restore'u gerçek kaynağı veya bağımsız offsite'ı doğrulamaz. Mevcut AES-GCM/HMAC/key/R2 araçları korunur; yeni backup motoru, dump, upload, restore veya backup rolü oluşturulmadı. `MANAGED_REMOTE_OBJECT_AUDIT_REQUIRED` ve `MANAGED_REMOTE_UPLOAD_NOT_APPROVED` korunur.

Recovery `br-late-river-baeipun8` için **token_roles / ROLE_DELTA_UNRESOLVED** kapanmadı. Bu görev recovery'ye bağlanmadı veya değiştirmedi; önceki şema/veri referansı tam recovery sertifikası değildir.

## En kısa güvenli sıra /29 Ekim

1. Provider erişimini düzelt; güncel development kimlik/kapasiteyi GET ile doğrula.494 grantor pre'yi bağımsız incele; uygulama öncesi READ ONLY snapshot'ı tekrar ölç ve source pinleriyle bağla.
2. Provider rol yaşam döngüsü kanıtını ve gerçek kaynak bağımsız şifreli backup/offsite/key/restore kabulünü tamamla. Bu işlemler mevcut görevde yapılmaz; kendi açık yetkileri gerekir.
3. Standby016 mekanizmasının cloud TLS/dedicated-session adapter'ini, atomik history ve bağımsız post kabul sözleşmesini incele. Writer dışlama/bakım/geri dönüş sorumlusunu kesinleştir; gerçek post beklentisini uygulama sonucundan öğrenme.
4. Ancak bunlar tamamlanınca **M016_READY_FOR_APPROVAL** değerlendirilebilir. Hedef/branch/016 checksum'u ve pencereye bağlı ayrı kullanıcı apply onayı olmadan applyEnabled=false kalır. Sonraki onaylı değişiklik CLI/adapter kapısını açabilir; şu an açılmadı.
5. Ayrı onaylı **016 → bağımsız016 post/history16 kabulü → ayrıca onaylı017 → bağımsız017 post/history17 → son56/42 gerçek backup/restore ve işletme kabulü**.016 onayı017/runtime/go-live onayı değildir.

29 Ekim'e kalan kritik yol artık016 SQL düzeltmesi değil; provider erişimi/kanıtı, gerçek geri dönüş kabulü ve operasyon onayıdır. Yerel provanın geçmesi bu süreyi garanti etmez. Kapılar kapanmazsa29 Ekim çıktısı sentetik gösterimle sınırlı kalır; gerçek verili pilot açılmaz. Gereksiz yeni sprint/özellik eklenmedi.

## Kaynak koruması ve kesin bu-görev kapsamı

M017'nin23 dosyası başlangıçta hash snapshot'ına alındı.22 dosya byte-identical; `LAST_REPORT.md` yalnız yeni özet başa eklenerek, eski23-dosyalık çalışmanın rapor geçmişi korunur.001–017 SQL ham hash'leri başlangıçla aynı. M017'nin aday/manifest/model/runner/test değişiklikleri geri alınmadı; eski K6/K1–K5/M017 raporları değiştirilmedi. HEAD/index ve `.env.local` korundu; commit/push/merge yoktur. Toplam çalışma ağacı, önceki23 dosyayla birlikte32 dosyadır; bu görevin değişiklikleri aşağıdaki10 dosyadır (LAST_REPORT ortak dosya).

- `docs/validation/PUSULA_M016_CLOUD_PREFLIGHT.md`
- `LAST_REPORT.md`
- `research/PUSULA_M016_CLOUD_READINESS.md`
- `scripts/stock/cloud-preflight.ts`
- `scripts/stock/managed-contract.ts`
- `scripts/stock/managed-execution.ts`
- `scripts/stock/managed-execution-fixture.ts`
- `scripts/stock/managed-fixture.ts`
- `scripts/stock/managed-runner.ts`
- `tests/stock-cloud-preflight.test.ts`
