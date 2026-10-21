# PUSULA V4.3b.4 — Migration 016 bulut hazırlığı

21.10.2026 · Dal `feat/pusula-v030-neon-cloud` · başlangıç HEAD/upstream `cd4ffcfeb576cef64b553c875e59617716ed1383`. Çalışma ağacı başlangıçta temizdi. Upstream yalnız yerel Git ref'iyle karşılaştırıldı;fetch/push yapılmadı.

**Durum: LOCAL_RUNNER_READY.** Son izole PostgreSQL 18.6 kabul koşusu, 20 runner kontrolü ile DB/RLS 11, Auth 62, Cloud API 11, Supplier 16, PurchaseOrder 28 ve Stock 36 kontrolünü birlikte geçti. Vitest 379/379; TypeScript, ESLint ve production build native exit0. Bütün fixture sunucuları kapatıldı. Bu sonuç gerçek Neon uygulama veya kurtarma kabulü değildir.

Bu sprint yalnız yerel runner hazırlığıdır. Neon hesabına/API'sine veya development/test/production SQL'e bağlanılmadı. Yeni branch/snapshot, restore/finalize, R2 dump/upload, gerçek Auth/MFA okuma/yazma, .env.local değişikliği veya commit/push/merge yapılmadı. Yalnız herkese açık sağlayıcı/PostgreSQL dokümantasyonu okundu.

## 016 bütünlüğü ve ayrı kapı

Migration kimliği `202610210016_goods_receipts`;SHA-256 **`80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18`**. SQL016,ilk15SQL ve mevcut iki migration baseline dosyası değiştirilmedi. Yeni ACL pinleri ayrı `scripts/stock/runner-baseline.json` içindedir.

`scripts/stock/migrate.ts` eski `scripts/db/migrate.ts` dosyasından ayrı bir016aşamasıdır. Eski `STOCK_MIGRATION_REQUIRES_SEPARATE_CLOUD_REVIEW` engeli aynen kalır. Yeni CLI yalnız `--test`,isteğe bağlı `--apply` ve `--approve-local-fixture` kabul eder. Bulut seçeneği yoktur;onaysız/yanlış hedef daha env dosyası veya bağlantı açılmadan reddedilir. Gerçek Neon için bu yerel CLI'ye bayrak eklemek yeterli değildir:sonraki ayrı onaylı aşamada managed ACL/rol profili,TLS ve güncel recovery kanıtı incelenmelidir. Yerel ACL pinleri Neon ACL pinleri diye kullanılmaz.

| Aşama | Kontrol |
|---|---|
| Hedef |Mevcut UUID fixture marker,loopback host,port,database,fixture_admin,data_directory vePG18.6 kimliği;production/uzak test reddi |
| Yerel artifact |Tam16migration manifest'i;ilk15checksum;016sabit SHA ve mevcut stock pin'i;BEGIN/COMMIT ile3s/30s/60s timeout sözleşmesi |
| Preflight |15başarılı migration,40tablo/26FORCE RLS;015appliedSchema pin'i;ACL/rol/izin pin'i;READ ONLY REPEATABLE READ |
| Apply |Açık yerel apply onayı;eski runner ile aynı advisory key2142042;yeniden preflight;mevcut sınırlı/tagged Prisma child |
| Postflight |16başarılı migration,47tablo/33FORCE RLS;016schema ve ACL pin'leri;executor NOLOGIN/NOBYPASSRLS/non-owner |
| Tekrar |Postflight de doğrulanarak ALREADY_APPLIED;child spawn yok,history değişmez |
| Başarısızlık |Unresolved/rolled-back/unknown/duplicate/checksum uyuşmazlığı reddi;şema/ACL drift ve kısmi tablo/rol reddi;otomatik resolve/retry/cleanup yok |

ACL hash kapsamı:public tablo ve kolon ACL'leri,function EXECUTE ve sahiplik,public schema izinleri,database CONNECT/TEMP/CREATE izinleri,defaultACL,pusula rol özellikleri ve üyelikleri,Permission/RolePermission tanımları. Şema pin'i function gövdeleri,trigger,policy,index,constraint,column,type tanımlarını kapsar. Ek schema/extension/event trigger/large object/view/sequence/domain/operator gibi beklenmeyen nesneler de reddedilir. Hash'lerde parola veya business/Auth satırları bulunmaz. Pre/post pin'ler yalnız izole localfixture profiline aittir.

Normal runner ayrıca ACL pin dosyasının null/eksik/bozuk olmasını reddeder; pin yokluğunda denetim atlanmaz. ACL ölçümü yalnız fixture harness'inde yapılabilir ve pin dosyasını otomatik değiştirmez. Son 379 test içinde bu fail-closed sınırın negatif testi de vardır.

Preflight'ın kendisinde de SET LOCAL lock3s/statement30s/transaction60s vardır. 55P03 ve57014 ayrı preflight hata kodlarına dönüşür. Apply SQL'inin3/30/60s sınırları değiştirilmedi;Prisma child90s dış sınırı ve yalnız kendi tagged backend'lerini temizleme davranışı korunur. Uygulama servisinin15s interactive transaction sınırı bu runner'ın sınırı değildir.

Programmatic `fixtureBeforeApply` yalnız kimliği doğrulanmış localfixture testinde kilit yarışı enjekte eder;CLI'de böyle bir seçenek yoktur. Test harness'i yalnız kendi failed metadata satırını açıkça temizleyip sonraki başarılı apply'i sınar. Runner gerçek veya yerel history'yi kendiliğinden silmez/resolve etmez. Advisory lock sadece aynı protokole uyan runner'ları dışlar;uygulama yazılarını veya bağımsız DDL'i dondurmaz.

## Güncel pre-016 kurtarma planı — uygulanmadı

Mevcut `pusula-v43a-pre-migration-015` (`br-broad-river-bavv5pey`) 015vePO-2026-9893öncesidir;pre-016yedek veya güncelRPO kanıtı olarak kabul edilmez. Aşağıdaki kimlikler kaynak kodu/tarihsel rapor referansıdır;bugünkü provider envanteri bu sprintte teyit edilmedi:

- Proje:`icy-queen-44442204`.
- Kaynak development:`br-rough-darkness-ba6ow9zo`.
- Doğrudan endpoint:`ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech`;DB:`pusula_development`.
- Korunacak production:`br-autumn-union-baaldt81`;preview:`br-patient-block-bald8u59`;eski recovery ve snapshot silinmez/değiştirilmez.

1. **Önce güncel kota teyidi.** Ayrı izinli provider READ ONLY aşamasında proje ayrıntıları,tüm sayfalarıyla branch listesi,snapshot listesi ve endpoint eşleşmeleri alınır;plan ve Console Billing/Usage ekranında storage kullanılan/limit/kalan,branch/history/snapshot etkisi,compute kullanılan/kalan,quota uyarıları ve pending operations tarih/saatle kaydedilir. Tarihsel4/10branch ve1/1snapshot bilgisi güncel kapasite sayılmaz. Eksik/deprecated0metrikten boş alan veya ücretsiz maliyet sonucu çıkarılmaz. GET proje usage değerleri faturalama sayacı değildir;billing için consumption_history/Console kullanılır. [Proje ayrıntıları](https://api-docs.neon.tech/reference/getproject),[sayfalı branch listesi](https://api-docs.neon.tech/reference/listprojectbranches),[snapshot listesi](https://api-docs.neon.tech/reference/listsnapshots).
2. **Kaynak kimliğini sabitle.** Branch ID,ad,parent,endpoint host/branch/database ilişkisi,PG sürümü ve connection hedefi kod allowlist'iyle karşılaştırılır. Production veya test DB bağlantısı açılmaz. Gerçek AuthUser/AuthSession/AuthTwoFactor içerikleri okunmaz. Aktif iş yazıları için bakım/capture penceresi ve kabul edilenRPO kullanıcıyla belirlenir.
3. **Ön referans.** Güncel development üzerinde ayrı izinli REPEATABLE READ READ ONLY oturumda40/26/15,ilk15checksum,şema/managedACL/rol pin'leri,sipariş/malzeme/tedarikçi/teklif/quote/sale gibi izinli business tablo sayımları ve kanonik satır digest'leri kaydedilir. PO-2026-9893varlığı,satır sayısı ve izinli aggregate değerleri ayrıca karşılaştırma referansıdır;ham müşteri/fiyat/auth satırları rapora dökülmez. Auth/MFA verisi incelemesi bu izne dahil sayılmaz. Aynı source snapshot/captureLSN ve sonradan oluşan yazılar ayrıştırılmalıdır.
4. **Ayrı oluşturma onayı.** Önerilen benzersiz isim:`pusula-v43b-pre-migration-016-YYYYMMDD-HHMMSS` (UTC zaman eki). Parent açıkça developmentID;parent-data kopyası,sourcebranch'in tümDB ve hassasAuth verisini kapsayabileceği için onay kapsamı bunu belirtmelidir. Eski branch/snapshot temizlenmez. Endpoint gerekiyorsa minimum uygun compute ve süre sınırı ayrı onaylanır;plan/kota teyidi olmadan ücretsiz kabul edilmez. Bu sprintte POST/CREATE yapılmadı ve oluşturma komutu çalıştırılmadı.
5. **Yeni bağlantı planı.** Yeni branchID/parent/timestamp/LSN ve endpoint bağları kaydedilir. Doğrudan TLS `verify-full`,güvenilirCA,hostname ve encrypted/authorized socket doğrulaması gerekir;IP ile hostname kontrolünü atlama veya rejectUnauthorized=false kullanılmaz. Recovery bağlantısı kaynak runtime/auth URL'lerine yazılmaz;.env.local değiştirilmez. Sırlar yalnız izinli private workspace'te tutulur,log/rapor/commit'e girmez.
6. **Kopyayı doğrula.** Recovery ile capture referansında migration checksum'ları,40/26/15,şema/ACL/rol fingerprint'leri ve izinli business sayım/digest'leri karşılaştırılır. 015vePO-2026-9893dahil olmalıdır. Oluşturma sırasında kaynak yazı devam ettiyse daha sonraki canlı kaynakla naif eşitlik istenmez;captureRPO ve değişiklik aralığı açıkça kaydedilir. HangiDB'lerin kopyalandığı teyit edilir. Bir salt okunur karşılaştırma tam restore provası yerine geçmez.
7. **Uygulama kapısı.** Ancak güncel recovery kanıtı,managed executor/grant uyumluluğu ve izinli cloudpreflight tamamlandıktan sonra ayrı açık development016apply onayı istenir. Yerel9dosya teslimi veya bu LOCAL_RUNNER_READY sonucu bulut apply izni değildir.
8. **Hata halinde dur.** Yanıt kaybı dahil önce salt okunur history/schema/ACL durumu değerlendirilir.016başarılı vepostflightuyumluysa tekrarapply yok;başarısız metadata,kısmişema veyaACLdrift varsa otomatik retry,resolve,downmigration,DROP,restore/finalize yapılmaz. Kaynak veriler ve mevcut kurtarma noktaları korunur. Recovery branch üzerinde ayrı izinli inceleme/restore provası,sonra gerekiyorsa veri kaybı/RPO veAuth/MFA etkisini açıkça belirten ayrı restore/cutover onayı gerekir. `.env.local` otomatik recovery hedefiyle değiştirilmez.

## Risk ayrımı

| Konu | Uygulama öncesi zorunlu kapı | Sonraki iyileştirme |
|---|---|---|
| SECURITY DEFINER/search_path |Sabit gövde/hash,sahip/grant ve public CREATE güven sınırı;qualified public tablo/kompozit tür kullanımı;PUBLIC EXECUTE kapalı |Ayrı reviewed migration ile açık pg_temp-last tutarlılığı |
| pg_temp |016tablo başvuruları public ile nitelenmiş;pusula_can public,pg_temp yolunu kullanır. Yerel malformed temporaryPOshadow gerçek definer sorgusunu değiştiremez |Bu test tümolası shadow saldırılarının kanıtı değildir;ileride eklenen unqualified adları ayrıca incele |
| MFA |HTTP requireMfa kontrolü ve session doğrulaması korunmalı;runtime credential son kullanıcıya verilmez. SQL definer cookie/TOTP kanıtı doğrulamaz |GerekirseDB seviyesinde güçlü action-attestation mimarisi;bu sprint SQL'in MFA doğruladığı iddiası yok |
| Executor |Managed Neon'da CREATE ROLE,grantor/defaultACL,NOLOGIN/NOBYPASSRLS/non-owner,üyelik ve en az yetki ayrıca teyit edilmeli. Mevcut SQL checksum'u değişmeden yerelde doğrulandı |FOR UPDATE için gerekli UPDATE yetkisini kolon bazında daraltma ayrı gözden geçirme |
| Integrity trigger |Deferred mutabakat ve immutable kapılar korunmalı;gerçek ilk cloud iş yükünün sınırı belirlenmeli |Mevcut tüm görünürtenantbakiyelerini/header'ları her deferredrow için tarama büyüyebilir;hacim ölçümü ve kaynak odaklı optimizasyon ayrı sprint |
| R2backup/restore |Mevcut bağımsız yedek kabulüBLOCKEDolarak açık tutulmalı;güncel provider recovery ile bağımsız yedek eşit sayılmaz |Ayrı E2 yetki/function/coverage ve gerçek restore kabulü |
| Backupallowlist |35tablo/21FORCE RLS allowlist'i40/26mevcutşema ve47/33sonşema ile uyumsuz;SCHEMA/RLS/function güvenlik engelleri gevşetilmedi |Yeni nesnelerin kapsam,yetki,satır içerik ve restore bütünlüğü review edilmeden yalnız sayıları büyütme |

[PostgreSQL SECURITY DEFINER güvenliği](https://www.postgresql.org/docs/18/sql-createfunction.html) güvenilir schema yolunu ve temp nesne riskini açıklar;[search_path davranışı](https://www.postgresql.org/docs/18/runtime-config-client.html) temp schema'nın ad çözümleme etkisini belirtir. Bu nedenle `pg_temp` sonunu açıkça yazmamak genel olarak risksiz değildir;016için qualified başvurulara ve mevcut yetki sınırına dayanılır. Bu sprintte onaylı016SHA'yı değiştirecek function/SQL değişikliği yapılmadı.

## Testler, açık engeller ve teslim

[Doğrulama belgesi](../docs/validation/V04_V43B4_VERIFICATION.md) gerçek fixture kimliklerini,başarısız ilk koşuları ve son sonuçları içerir. YeniACLpinleri ölçümden sonra ayrı yeniUUIDcluster'da doğrulanır. Gerçek Neon rol/TLS/kota/güncelRPO ve bağımsız R2restore kanıtları henüz yoktur;yerel runner başarısı bunları kapatmaz.

Mimo'ya kesin teslim listesi:

```text
LAST_REPORT.md
research/PUSULA_V04_V43B4_CLOUD_READINESS.md
docs/validation/V04_V43B4_VERIFICATION.md
scripts/stock/migrate.ts
scripts/stock/runner-baseline.json
scripts/stock/runner-fixture.ts
scripts/stock/migration-fixture.ts
scripts/stock/verify-local.ts
tests/stock-migration-runner.test.ts
```

9dosya. `.data`,fixture/log/credential,.env,generated Prisma client,.next ve test artifact'ları teslim dışıdır. GitHub teslimini Mimo yapar;Codex commit/push/merge yapmadı.
