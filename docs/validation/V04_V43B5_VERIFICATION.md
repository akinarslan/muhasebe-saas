# V4.3b.5 — READ-ONLY preflight doğrulaması

21.10.2026 · **RECOVERY_PREFLIGHT_PARTIAL / READONLY_CATALOG_PASS**.

## Son koşu — kullanıcı Console kanıtı ve gerçek READ ONLY denetimi

Kullanıcıekran görüntüsü doğrulaması:Free,storage31,69MB,compute0,02CU-saat,4branch,6saatretention. Bu değerler kullanıcıkanıtıdır;APIölçümü veya kalan kapasite değildir. Kalan kota ve yeni kaynak maliyeti türetilmedi.

| Gerçek kontrol |Sonuç |
|---|---|
| Providerkimliği |2026-10-21T15:11:52Z başlayan3GET200;doğruproje/development/endpoint;free_v3,4/10branch,21600sretention |
| DBTLS |CAgeçerli,hostname/CAzorunlu,minTLS1.2;encrypted/authorizedPASS |
| Hedef |Yalnız`pusula_development`,developmentendpoint;PG18.6 |
| SQLsınırı |Startupdefault_readonlyon;REPEATABLE READ READ ONLY;statement10s/lock3s/transaction30s |
| Katalog |40tablo/26FORCERLS;8/8schemafingerprint015referansına eşit |
| History |15başarılı,15checksumeşit;015SHA181a783a…35b1614a;016yok/pending |
| Hatalıkayıt |Unresolved0;008company_metadata için1bilinenresolvedrollback ayrı kaydedildi |
| Rol/ACL |Executorrolüyok;mevcutroles/memberships/defaults/aclhash4/4eşit |
| İşsayım |Supplier1,PurchaseOrder1,Material1,MaterialVariant1 |
| HedefPO |PO-2026-9893var,APPROVED,1satır,30,40USD;2m×1,52=3,04m² |
| Kapanış |SaltokunurtransactionROLLBACK ilekapandı,connectionClosed=true |

SQLsnapshot2026-10-21T15:12:46.816Z /18:12:46Türkiye saati. Kanıtlar `.data/recovery-v43b5/provider-console-followup.json` ve`catalog-console-followup.json`. YetkilendirilenkısaDBokuması yeni recoveryoluşturma izni veya quotaPASSsayılmadı. Auth/MFA/sessioniçeriği okunmadı;runtimeSQLkapısı/migrationrunner/applyçalıştırılmadı. MevcutprivilegepinACLkapsamınınbeşSupplier/POtablosunu dışladığı sınırlaması raporda açıkça belirtildi.

GenelsonuçPARTIAL:kalanstorage/CU,snapshotlimiti ve yeni kaynak/endpointmaliyetinin güncelteyidi eksik. ÖncekiConsumption403kanıtı sürüyor;kullanıcıConsolekullanımı bununAPIölçümü olduğu anlamına gelmez. RPO/captureveDBkopyalama kapsamı üzerinde ayrı karar,onaysızoluşturma yoktur.

## Önceki devam koşusu — erişimPASS,kapasiteUNVERIFIED

21Ekim18:05:52–18:06:30Türkiye saati /15:05:52–15:06:30UTC:

- ProjeGET200;projeadı/ID,PG18metadata,beklenen development kimliği veendpoint hostu doğrulandı.
- BranchGET200:4branch,dördü ready;ownerbranches_limit10. Korunanproduction/recovery/preview kimlikleri mevcut.
- EndpointGET200:4endpoint ve4branch eşleşmesi;development0.25CU,dördü idle veenabled.
- SnapshotGET200:korunacak snapshotmevcut,source development;1kayıt. Snapshotkotası yanıtla doğrulanamadı.
- OperationsGET200:görüntülenen100kayıtta pending/failed0;bu sınırlı listedeki gözlemdir.
- Eski `/orgs/{id}` GET404;doğru `/organizations/{id}` yolu,aynıprojeorg_id eşleşmesiyle GET200;planfree. Yeni/belirsizhedefe geçilmedi.
- Consumptionv2GET,yalnızaynıproje/organizasyon filtresiyle403. Storagekullanılan/kalan vecompute/snapshotkotaları güvenilir biçimde tamamlanamadı.

**Durma:**Kapasitegeçmediği için developmentDBTLS bağlantısı açılmadı;READONLYSQL,canlıhistory/schema/ACLvePOkontrolleri NOT_RUN olarak kaldı. Yenilenmişprovidererişim artık401engeline takılmıyor. Sıfır/deprecatedprojectstoragealanları vebranchlogicalboyut toplamı kapasitekanıtı sayılmadı. Plan/ücret değişikliği yapılmadı.

Kanıtlar `.data/recovery-v43b5/provider.json` ve`capacity-resume.json`. Önceki401`provider-previous-401.json` içinde korundu. GüncelConsumptionAPIplan kısıtı [resmîAPIbelgesinden](https://api-docs.neon.tech/reference/getconsumptionhistoryperprojectv2) kontrol edildi;yerelpublicAPIspec doğruorganizationsyolunu belirlemek için okundu. Yeniden tokenyenileme/NeonCLI/POST çağrısı yoktur.

Bir sonraki gerekli kanıt aynıhesabın güncel storage/compute/snapshotUsage-Kotalarıdır;tokenyenileme ilkengel değildir. Kapasite veücretsizbranchuygunluğu doğrulanmadanDBveoluşturmaaşaması yoktur.

## İlk koşudaki gerçek denetim — tarihsel

| Adım | Kanıt / sonuç |
|---|---|
| Gitbaşlangıç |`f56caed5eadb64e76304777f83477f1677c19d19`,beklenenfeaturedalı,temiztree |
| İlkproviderGET |2026-10-21T14:20:23.751Z;HTTPyanıtı alınmadan genel taşıma hatası;`provider-first.json` |
| SistemCA ileaynıGET |2026-10-21T14:20:40.376Z;GET `/projects/icy-queen-44442204`→401;`provider.json` |
| Kimlikbilgisi metadatası |expires_at2026-10-20T18:51:53.354Z;mevcut tokenexpired;APIkeypresent=false;`access-summary.json` |
| Providerlistenvanter/kota |İlkprojeGETbaşarısız olduğu içinçalıştırılmadı |
| DB/SQL |Bağlantı0,sorgu0;providerkimliği/kapasitesi doğrulanmadığından duruldu |
| YerelSHA |001–01515/15;01680229d59…f4bbe18eşit;`local-integrity.json` |
| Kaynak/baselineguard |Eski ve yeni cloudguard korunuyor;source/SQL/baseline değişikliği yok |

Token değerleri,refresh token,idtoken,user_id,değerli bağlantıURL'leri veyaAuth/MFA/session satırları yazdırılmadı. Mevcut.credentials dosyası yalnız memory'de okundu;yenilemeAPI'si veyaNeonCLIçağrılmadı. `.env.local` için APIkeyvarlığı kontrolü ve bütünlükhash'i alındı;dosya değiştirilmedi. HTTP401,PostgreSQL TLS veya veri bütünlüğü testi değildir.

Yalnız sabit GETmetodu kullanan yeni helper `.data/recovery-v43b5/provider.mjs` çalıştırıldı. Token yenileme veya yanetki riski taşıyan eski CLI/provider helper'ları kullanılmadı. Önceki live-readonly.ts AuthUser/Membership sayımları içerdiği için çalıştırılmadı. `.data` yardımcıları ve logları teslim dosyası değildir.

## Çalıştırılmayan kontroller

PGsürümü,40tablo/26FORCERLS,15başarılımigration,015canlıSHA,016pending,failed/rollbackayrımı,şema/rol/ACL drift,executorvarlığı,iştablosayımları vePO-2026-9893özeti **NOT_RUN**. Önceki sprint sonuçları bugünkü kanıt olarak kullanılmadı. Kapasite eksikliği nedeniyle yeni recoverybranch'in oluşturulabilirliği ve maliyeti de doğrulanmadı.

Vitest,TypeScript,ESLint,build,yerelPGfixture veya migrationrunner çalıştırılmadı;bu görev yalnız read-onlyön denetim ve raporlama kapsamındadır.

## İlk koşunun sınırları ve sonraki adımı — güncel durum yukarıdadır

ProviderPOST/PATCH/DELETE0;SQLINSERT/UPDATE/DELETE/DDL/GRANT0;branch/endpoint/snapshotoluşturma,silme,restore/finalize,R2dump/upload,gerçekAuth/MFAokuma/yazma veGitcommit/push/merge yoktur. Hedef proje/dal değişmedi.

Önce kullanıcı mevcutprovidererişimini görev dışında yenilemeli;sonra aynı izinliGETön denetimi yeniden yapılmalıdır. Kapasite,hedef veTLSgeçmedenDB'ye bağlanılmamalı. VeriRPO'su kabul edilmiş değil;parentLSN/timestamp ve hangiDB'lerin kopyalanacağı henüz ölçülmedi. Koşullu kurtarma planı [rapordadır](../../research/PUSULA_V04_V43B5_RECOVERY_PREFLIGHT.md). Şu anda brancholuşturma veya migrationapply için onay istenmez;önce engel giderilmelidir.
