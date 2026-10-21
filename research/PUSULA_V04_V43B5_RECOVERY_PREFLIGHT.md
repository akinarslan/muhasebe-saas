# PUSULA V4.3b.5 — Recovery preflight

21.10.2026 · **RECOVERY_PREFLIGHT_PARTIAL** · **READONLY_CATALOG_PASS**.

Başlangıç dalı `feat/pusula-v030-neon-cloud`, HEAD `f56caed5eadb64e76304777f83477f1677c19d19`; çalışma ağacı temizdi. Bu görev salt okunur ön denetimdir. Git commit/push/merge yapılmadı; önceki GitHub teslim yetkisi bu göreve taşınmadı.

## Son denetim — Console kanıtı ve güvenli development kataloğu

### Kanıt kaynakları birbirinden ayrıldı

Kullanıcı,NeonConsole ekran görüntüsüne dayanarak `pusula-development` projesinin Free plan,Storage **31,69MB**,Compute **0,02CU-saat**,branchsayısı **4** vehistoryretention **6saat** gösterdiğini doğruladı. Bunlar **kullanıcının ekran görüntüsü doğrulamasıdır**;APIstorage/compute ölçümü veya kalan kota olarak sunulmaz. Bu sayılardan kalanstorage,kalanCU-saat veya yeni recovery'nin maliyeti hesaplanmadı. Görüntünün storage kapsamı/ölçüm anı APIbranchlogical_size metriğine eşlenmedi;iki farklı metrik eşit kabul edilmedi.

**21Ekim18:11:52Türkiye saati /15:11:52UTC** başlayan yeni,sabitGETmetotlu provider denetimi şu kimlikleri bağımsız doğruladı:

- Proje:`pusula-development` /`icy-queen-44442204`;plan`free_v3`.
- Branch:`development` /`br-rough-darkness-ba6ow9zo`;state`ready`.
- Kaynakendpoint:`ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech`;aynıbranch'e bağlı,min/max0.25CU.
- Branchsayısı4,APIownerbranches_limit10;history_retention_seconds21600yani6saat.

Önceki koşudaki snapshot/endpoint envanteri veConsumption403kanıtları ayrı zamanda alınmıştır;aşağıda korunur. Storage31,69MBvecompute0,02değerleri bu yeniGETyanıtından alınmış gibi gösterilmez.

### Gerçek TLS ve READ ONLY katalog sonucu

Kullanıcının bu devam talimatındaki sınırlıDBdenetimi yetkisi ve doğrulanan kimlik üzerinden,**yeni kaynak oluşturmadan** mevcut developmentDB'ye tek,kısa ve süre sınırlı bağlantı yapıldı. Bu karar yalnız salt okunur inceleme içindir;kalan kapasite veya yeni recovery oluşturma kapısının geçtiği anlamına gelmez. Mevcutcompute uyandırılabilir;bu okumanın compute tüketimi0veya yeni kaynak maliyetinin ücretsiz olduğu iddia edilmez.

Bağlantı öncesinde host,DBveverify-fullhedefi kontrol edildi;güvenilirCA dosyası ve sertifika geçerliliği doğrulandı. Bağlantıda CA+`rejectUnauthorized:true`+açıkservername/TLS1.2minimum kullanıldı;socket encrypted/authorized teyit edildi. Startup'tan itibaren `default_transaction_read_only=on`;transaction `REPEATABLE READ READ ONLY`,statement10s,lock3s,transaction30s sınırındaydı. Denetim sonunda ROLLBACK ile salt okunur transaction kapandı ve bağlantı sonlandırıldı.

| Kontrol |21Ekim18:12:46Türkiye saati /15:12:46UTCsnapshot'ındaki gerçek sonuç |
|---|---|
| HedefDB |Yalnız development üzerindeki `pusula_development` |
| PostgreSQL |18.6(fd34222) |
| TLS/read-only |CA/hostname doğrulamasıPASS;transaction_read_onlyve default_transaction_read_only=on |
| Katalog |40tablo,26ENABLE+FORCE RLS |
| Şema fingerprint |tables,columns,constraints,indexes,policies,triggers,functions,types:8/8mevcut015appliedSchema pin'iyle eşit |
| Başarılımigration |15;başarılı kayıtların15checksum'u mevcutmanifest ile eşit |
| 015SHA |`181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a`;eşleşti |
| 016 |History kaydı yok;henüz uygulanmamış/pending |
| Başarısızlık/rollback |Unresolved0;öncedenbilinen008company_metadata için1resolvedrollbackayrı kaydedildi;bu kayıt016uygulaması değildir |
| Stokexecutorrolü |`pusula_stock_executor` mevcutdeğil |
| Mevcutprivilegepinleri |roles,memberships,defaults,acl:4/4eşit;beklenmeyen fark bulunmadı |
| İzinliiştablosayımları |Supplier1,PurchaseOrder1,Material1,MaterialVariant1 |
| PO-2026-9893 |Var,APPROVED,1satır |
| İzinliPOtoplamı |30,40USD |
| Miktar/dönüşüm |2linear_meter×1,52=3,04square_meter;snapshotfactor ile Decimalhesabı eşit |

Privilege karşılaştırması `scripts/db/migration-baseline.json` içindeki mevcutremoteprofil kapsamındadır. Bu profilin tableACL sorgusu Supplier/SupplierMaterial/SupplierOfferVersion/PurchaseOrder/PurchaseOrderLine tablolarını kapsam dışı bırakır;sonuç bütünolasıgrant'ların veya gelecekteki016managedexecutoruyumluluğunun tamamına teşmil edilmez. Auth/MFA/session satırları veya içerikleri okunmadı;yalnız sistemkatalog metadatası ve yukarıdaki izinliişözeti sorgulandı. Müşteri,aktör,parola,session,ürünadı ve gereksizfinansalanları çıktıya alınmadı.

### Güncel sonuç ve açık kapılar

**RECOVERY_PREFLIGHT_PARTIAL**:hedef ve güvenliREADONLYkatalog tamamlandı;önerilen recovery için kaynakdevelopment ve015/POreferansı artık güncelolarak doğrulandı. Consolekullanım kanıtı eklendi. AncakAPIstorage/computeconsumption403engeli,kalanstorage/CUkotası,snapshotlimiti ve yeni recovery/endpointmaliyetinin güvenilir teyidi halen eksiktir. Bu nedenle `RECOVERY_PREFLIGHT_PASS` veya yeni kaynak için “ücretsiz/kota yeterli” sonucu verilmez.

RPO kullanıcıtarafından henüz kabul edilmiş değil;bugünküSQLsnapshot yeni bir recoverycapture değildir. Ayrı oluşturma onayından önce güncelquota/maliyet kanıtı,sourcecapture zamanı/RPOvehangiDB'lerin kopyalanacağı netleştirilmelidir. Oluşturulacak kopyada015checksum ve yukarıdakiPOdurum/satır/toplam/miktarözeti aynıcapture referansıyla karşılaştırılmalıdır. Yeni branch/snapshot oluşturulmadı,016apply yapılmadı;hiçbir kaynak silinmedi,veri/rol/ACL/.env.local değiştirilmedi. Gitcommit/push yoktur.

Yeni privatekanıtlar:`provider-console-followup.json` ve`catalog-console-followup.json`. Consolebilgisi kullanıcıbeyanı olarak raporlandı;API veyaSQL ölçümüyle birleştirilmedi. Yardımcılar yalnız Gitignored `.data/recovery-v43b5/` içinde;teslimyineüçbelgedir.

## Önceki devam denetimi — erişim düzeldi, API kapasite engeli sürdü

**21 Ekim 2026 18:05:52–18:06:30 Türkiye saati / 15:05:52–15:06:30 UTC** aralığında mevcut yenilenmiş erişimle güvenilir sistem CA deposu üzerinden yalnız GET istekleri yapıldı. Onaylı proje, development branch ve kaynak endpoint kimlikleri güncel provider yanıtlarıyla eşleşti. Erişim sorunu artık engel değildir.

| Kontrol | Devam koşusundaki gerçek sonuç |
|---|---|
| Proje |GET200;`pusula-development` / `icy-queen-44442204`;PG18metadata,aws-eu-central-1 |
| Organizasyon |Aynı projenin org_id değeri `org-wild-forest-12594477`;doğru `/organizations/{id}` GET200;plan`free` |
| Proje planı/branch sınırı |Owner subscription_type`free_v3`,branches_limit10;mevcut4branch |
| Korunan branch'ler |Development,production,eski recovery vepreview kimlikleri eşleşti;dördü de`ready` |
| Snapshot |`snap-frosty-sky-bav0qeo6` mevcut;source development;1snapshot;hesaba ait güncel snapshot sınırı yanıtta yok |
| Endpoint'ler |4endpoint;her biri beklenen branch'e bağlı;dördü de`idle`,disabled=false |
| Development hedefi |`ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech`→`br-rough-darkness-ba6ow9zo`;0.25–0.25CU |
| Operations |Görüntülenen100işlemde pending0/failed0;bu sınırlı gözlem tüm tarihsel işlemler için garanti değildir |
| Gerçek storage/kalan |**CAPACITY_UNVERIFIED**;projectsynthetic_storage_size0ve data_storage_bytes_hour0kapasite kanıtı olarak kullanılmadı |
| Compute/kota |Projectcompute_time_seconds7780döndü;bu alan doğrulanmış güncel faturalama/kalan kota değildir |
| Tüketim GET |Aynıorg ve yalnız onaylıproject_ids filtresiyle `/consumption_history/v2/projects`→**403** |
| DB/READONLYSQL |**NOT_RUN**;kapasite durma koşulu nedeniyle DBbağlantısına geçilmedi |

Önceki helper'ın `/orgs/{id}` yolu404döndü. Resmî API belgesindeki `/organizations/{id}` yolu,projenin aynıorg_id eşleşmesi kontrol edilerek kullanıldı ve200alındı;başka organizasyon veya projeye geçilmedi. Consumptionv2GET'inin Free hesap için kullanılamaması, [resmî metrik API belgesindeki plan kısıtıyla](https://api-docs.neon.tech/reference/getconsumptionhistoryperprojectv2) uyumludur. Ücretli plana geçilmedi ve POST/PATCH/DELETE yapılmadı.

`branch_logical_size_limit_bytes=1073741824` döndü. Bu alan ve aşağıdaki branch logical_size değerleri,projenin storage kullanılan/kalan hesabı yerine geçmez. Copy-on-write dalların logical_size değerleri veya snapshot boyutu toplanarak güvenilir proje storage tüketimi hesaplanmadı. Snapshot sınırı,kalan storage,compute kotası/uyarıları ve yeni branch'in ücretsiz oluşturulabilirliği halen teyitsizdir. Bu nedenle yeni branch için hazırlık PASS değildir ve **RECOVERY_PREFLIGHT_BLOCKED / CAPACITY_UNVERIFIED** sonucu korunur.

### Doğrulanan branch ve endpoint eşleşmeleri

| Branch | Güncel ad | logical_size (byte) | Endpoint |
|---|---|---:|---|
| `br-rough-darkness-ba6ow9zo` |development |55148544 |`ep-blue-breeze-bavbjb7l` |
| `br-autumn-union-baaldt81` |production |31686656 |`ep-soft-surf-baowiyco` |
| `br-broad-river-bavv5pey` |pusula-v43a-pre-migration-015 |54771712 |`ep-wispy-frog-ba755foo` |
| `br-patient-block-bald8u59` |pusula-v42-restore-verification |108822528 |`ep-curly-base-ba5jc1c2` |

Eski recovery parent'ı development, parentLSN`0/3638E80`,parenttimestamp`2026-10-20T12:47:55Z` olarak tekrar görüldü. Snapshot adı`pusula-v42-before-supplier-migration`,created_at`2026-10-19T11:03:46Z`,full_size54370304byte;source yine development. Bu eski kaynaklar güncelpre-016capture sayılmaz.

### Güncellenen sonraki adım

Token yenilemek artık gerekli ilk adım değildir. Önce aynı hesaba ait Console Usage/Billing görünümünden veya uygun izinli salt okunur kaynaktan güncel storage kullanılan/limit/kalan,snapshot sınırı,compute kullanılan/kalan ve kota uyarıları tarih/saatle doğrulanmalıdır. Yeni branch'in Free plana sığdığı ve ek ücret gerektirmediği teyit edilmeden DB veya oluşturma aşamasına geçilmeyecektir. Bu görevde Console oturumu açılmadı,plan yükseltilmedi ve başka erişim yöntemiyle kısıt aşılmadı.

Kapasite geçerse yalnız doğrulanmış development host ve `pusula_development` DB için güvenilirCA+hostname TLS ve READ ONLY kontrolleri yapılabilir. PG18provider metadatası,gerçek PostgreSQL bağlantısı/sürümü veya40/26/15şema kanıtı değildir. PO-2026-9893ve migration015halen bugün SQL ile doğrulanmadı. Yeni recovery için önerilen parent artık güncelprovider ile eşleşmiştir;capture zamanı/RPO,DBkopyalama kapsamı ve yeni endpoint maliyeti halen koşulludur. Yeni branch veya016apply izni verilmiş değildir.

Devam koşusunun Gitignored kanıtları:`provider.json` ve `capacity-resume.json`;ilk401kanıtı`provider-previous-401.json` içinde korundu. Yeni bir SQLbağlantısı,Auth/MFA/session okuması veya kaynak değişikliği yoktur.

## İlk koşu — tarihsel401engeli

**21 Ekim 2026 17:20:40 Türkiye saati / 14:20:40 UTC** itibarıyla yalnız onaylı proje için yapılan `GET /projects/icy-queen-44442204` çağrısı **HTTP401** döndü. Başarılı proje yanıtı alınamadığı için proje adı/ID, plan, envanter veya kapasite bugün provider verisiyle teyit edilmiş değildir.

Mevcut Neon erişim kaydının `expires_at` metadatası **20 Ekim 2026 21:51:53 Türkiye saati / 18:51:53.354 UTC** gösteriyor. Token süresi dolmuş. Mevcut kayıt ve process ortamında ayrı API anahtarı yok; `.env.local` içinde de yalnız anahtarın varlığı kontrol edildi ve bulunmadı. Token, refresh token, kullanıcı kimliği veya bağlantı parolası rapora/loga yazılmadı. Neon CLI otomatik token yenileyebileceği için çalıştırılmadı. OAuth token yenileme/login POST'u yapılmadı.

İlk standart Node GET denemesi HTTP yanıtına ulaşamadan genel taşıma hatası verdi; neden kodu o denemede kaydedilmedi. Ardından Windows'un güvenilir sistem CA deposu `--use-system-ca` ile kullanıldı; sertifika doğrulaması kapatılmadan HTTP401 alındı. İlk hatanın kesin TLS nedeni kanıtlanmış sayılmaz. Sistem CA ile HTTP yanıtına ulaşılması, PostgreSQL TLS bağlantısı veya DB hedef doğrulaması anlamına gelmez.

Talimattaki “güncel kapasitenin güvenilir şekilde belirlenememesi” durma koşulu uygulandı. **Gerçek development DB'ye bağlantı açılmadı.** Tarihsel veya yerel veriler güncel bulut kanıtı yerine kullanılmadı.

## Gerçekten yapılan kontroller

| Kontrol | Bu görevdeki sonuç |
|---|---|
| Git dalı/HEAD/başlangıç ağacı |Beklenen dal veSHA;temiz |
| Kaynak belgeler ve runner |İstenen hazırlık/teslim raporları,runner ve baseline dosyaları okundu |
| Yerel001–015migration checksum |15/15eşit |
| Yerel016SHA |`80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18`;eşit |
| Eski/yeni bulut engelleri |`STOCK_MIGRATION_REQUIRES_SEPARATE_CLOUD_REVIEW` ve `STOCK_CLOUD_APPROVAL_REQUIRED` korunuyor |
| Onaylı provider projeGET |HTTP401;proje verisi alınamadı |
| Kimlik bilgisi metadatası |Süresi dolmuş erişim tokenı;ayrı API anahtarı yok |
| Provider POST/PATCH/DELETE |0 |
| PostgreSQL bağlantısı/SQL |0;Auth/MFA/session içerikleri okunmadı |

## İlk koşunun kapasite ve bütünlük matrisi — devam sonuçları yukarıdadır

| Gereken kanıt | Durum |
|---|---|
| Plan/abonelik |UNVERIFIED;öncekiFree bilgisi bugünkü teyit değildir |
| Branch sayısı/sınırı |UNVERIFIED;list çağrısına geçilmedi |
| Snapshot sayısı/sınırı |UNVERIFIED;list çağrısına geçilmedi |
| Gerçek storage/kalan alan |CAPACITY_UNVERIFIED;eksik veri sıfır sayılmadı |
| Compute tüketimi/kota uyarıları |UNVERIFIED |
| Endpoint→branch/host eşleşmeleri |UNVERIFIED |
| Bekleyen provider işlemleri |UNVERIFIED;“0işlem” iddiası yok |
| Yeni branch'in Free plana sığması |UNVERIFIED;ücretsiz veya oluşturulabilir kabul edilmedi |
| DB sürümü/40tablo/26FORCE RLS |NOT_RUN |
| Canlı15migration/015checksum/016pending |NOT_RUN;yerel checksum kontrolü canlıhistory doğrulaması değildir |
| Canlıfailed/rollback kayıtları |NOT_RUN |
| Canlışema/rol/ACL drift,executor rolü |NOT_RUN;yerelACLpinleri managedNeon kanıtı değildir |
| Supplier/PO/Material/Variant toplamları |NOT_RUN |
| PO-2026-9893varlık/durum/satır/toplam/dönüşüm |NOT_RUN;korunamadığına dair bulgu yok,bugünkü doğrulama da yok |

## İlk koşudaki tarihsel referanslar

Onaylı proje `pusula-development` / `icy-queen-44442204`; parent adayı development `br-rough-darkness-ba6ow9zo`; DB `pusula_development`; doğrudan endpoint kod referansı `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech`.

Korunacak kimlikler:production `br-autumn-union-baaldt81`,eski recovery `br-broad-river-bavv5pey`,preview `br-patient-block-bald8u59`,snapshot `snap-frosty-sky-bav0qeo6`. Bunların bugünkü varlık/parent/endpoint veya kota etkisi bu koşuda teyit edilmedi. Başka proje/branch'e geçilmedi.

Önceki raporlarda eski recovery'nin015vePO-2026-9893öncesine ait olduğu kaydedilmişti. Eski recovery güncelpre-016kurtarma noktası sayılmaz. Önceki4/10branch,1/1snapshot ve40/26/15gibi bulgular bugün yeniden ölçülmüş değildir.

## İlk koşuda önerilen salt okunur sıra

1. Kullanıcı mevcut Neon oturumunu bu görev dışında yeniler veya uygun mevcut erişim sağlar; sırlar sohbete yapıştırılmaz. Codex bu görevde token yenilemez ve ücretli plan başlatmaz.
2. Aynı proje için GETproje, tüm sayfalarıyla branch/snapshot/endpoint listeleri, operations, plan/usage bilgileri tekrar alınır. Güncel storage kullanılan/limit/kalan ile compute ve yeni branch maliyeti güvenilir olarak belirlenemezse yine durulur. Deprecated/eksik0alanlardan kapasite çıkarılmaz. Console teyidi gerekiyorsa bu,eksik kanıt olarak açıkça kaydedilir.
3. Provider kimliği ve kapasite geçerse, yalnız doğrudan onaylı development host/DB için CA dosyası ve hostname doğrulamalı TLS yöntemi kontrol edilir. `rejectUnauthorized:true`, güvenilirCA ve açıkservername kullanılmalı;şifreli/authorized socket teyit edilmelidir. Hatalı TLS'de fallback veya doğrulamayı kapatma yoktur.
4. Yalnız REPEATABLE READ READ ONLY transaction içinde PGsürümü,40/26/15,015checksum,016yokluğu,failed/resolved kayıtlar,şema ve managedrol/ACL referansları incelenir. Auth/MFA/session tablolarının içeriklerine girilmez. Supplier,PurchaseOrder,Material,MaterialVariant toplamları ve yalnız istenenPOözeti alınır;beklenmeyen farkta durulur.

Mevcut `scripts/db/migration-safety.ts` içindeki `migrationClient()` CA+servername+rejectUnauthorized:true ayarlarını içeriyor. Bu,bugün DBTLS'nin başarıyla denendiği anlamına gelmez. Eski live-readonly helper'ı AuthUser/Membership sayımları içerdiği için çalıştırılmadı. Bu göreve uygun dar sorgu kapsamı gerekir;genel runner veya eski helper körlemesine çağrılmamalıdır.

## Yeni recovery branch için koşullu hazırlık

| Karar | Plan / henüz eksik kanıt |
|---|---|
| İsim |`pusula-v43b-pre-migration-016-YYYYMMDD-HHMMSS`;oluşturma anınınUTCzamanı ve benzersizlik teyidi kullanılmalı |
| Parent |Yalnız yeniden doğrulanmış `br-rough-darkness-ba6ow9zo`;başka dala geçiş yok |
| Verinin kapsadığı zaman |Provider create yanıtındaki gerçek parenttimestamp/LSN ve capture noktası;bugün oluşturulmuş capture yok |
| RPO |Kullanıcı tarafından kabul edilmiş RPO henüz yok. Planlı yazı durdurma ile capture sonrası kayıp0hedefi önerilebilir;gerçek0RPO garantisi bugün verilemez |
| Kopyalanan DB'ler |Parent-data branch bütün kaynak branch DB'lerini veAuth/MFA verilerini de kapsayabilir. İzinli metadata listesiyle kapsam teyit edilmeli;bu sprintte DBlistesi alınmadı |
| Endpoint/compute |Oluşturma ve bağımsız SQL karşılaştırması ayrı ihtiyaçlardır. Yeni endpoint ancak doğrulama gerektiğinde,en düşük uygunCU/askıyaalma ayarı ve süre sınırıyla planlanmalı. Bugünkü kota/ücret doğrulanmadığı için maliyet0denemez |
| Kaynakla karşılaştırma |Aynı capture referansına bağlı schema/managedACL/rol/migrationchecksum ve izinli businesssayım/digest'leri;canlıyazılar sürüyorsa sonraki kaynağa naif eşitlik uygulanmaz |
| 015vePOkanıtı |Yeni kopyada başarılı015veeşitSHA,016yokluğu,PO-2026-9893varlık/durum/satır/toplam/miktar-dönüşüm değerlerinin sourcecapture ile eşleşmesi |

Güncel provider veDB bulguları olmadığı için plan koşulludur;branch oluşturma hazırlığı doğrulanmış sayılmaz. Capacity veREADONLYbütünlük geçtikten sonra **yeni branch oluşturmak için ayrıca açık kullanıcı onayı** gerekir. Bu rapor oluşturma veya016apply izni değildir. Mevcut recovery/snapshot silinmez;R2backup/restore ve eski35/21coverage engeli ayrı kalır.

## Teslim ve kanıt

Değişen yalnız üç belge:

```text
research/PUSULA_V04_V43B5_RECOVERY_PREFLIGHT.md
docs/validation/V04_V43B5_VERIFICATION.md
LAST_REPORT.md
```

Private ve Gitignored kanıtlar `.data/recovery-v43b5/` altındadır. Rawtoken/parola/APIkey saklanmadı;yalnız GETizleri,durum/expiry metadatası ve yerelchecksum özeti vardır. Uygulama/SQL/runner/baseline/.env.local değişikliği yoktur;test veya build çalıştırılmadı. [Doğrulama belgesi](../docs/validation/V04_V43B5_VERIFICATION.md).
