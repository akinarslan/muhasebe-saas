# PUSULA V4.3b.7 — RECOVERY_BRANCH_PARTIAL

21.10.2026 18:54 Türkiye saati. Güncellenmiş açık kullanıcı onayıyla tek bir tam veri recovery branch ve ona bağlı tek minimum compute endpoint oluşturuldu. Gerekli business/schema karşılaştırmaları geçti; recovery'deki ek PostgreSQL rolü nedeniyle tam rol fingerprint'i eşleşmedi. Veri veya yetki düzeltmesi, silme veya yeniden oluşturma yapılmadı.

## Gerçek oluşturulan kaynaklar

| Alan | Gerçek değer |
| --- | --- |
| Proje | icy-queen-44442204 / pusula-development |
| Organizasyon | org-wild-forest-12594477, free; proje free_v3 |
| Recovery adı | pusula-v43b6-pre-migration-016-20261021 |
| Recovery ID | br-late-river-baeipun8 |
| Parent ID | br-rough-darkness-ba6ow9zo / development |
| Kopyalama | init_source=parent-data; tam veri; schema-only değil |
| Branch POST | Tek istek, HTTP 201; oluşturulma 2026-10-21T15:52:18Z |
| Provider parent timestamp | 2026-10-21T15:51:53Z |
| Provider capture parent LSN | 0/38201C8 |
| Endpoint ID | ep-aged-flower-bauhc0to |
| Recovery host | ep-aged-flower-bauhc0to.c-8.eu-central-1.aws.neon.tech |
| Bağlanılan DB | pusula_development, yalnız yeni recovery ve onaylı development kaynağı |
| Endpoint POST | Tek istek, HTTP 201; oluşturulma 2026-10-21T15:52:37Z |
| Endpoint tipi | read_write primary; tüm denetim SQL'i READ ONLY |
| Compute | min=max 0.25 CU, autoscaling üst sınırı 0.25 |
| Auto-suspend | suspend_timeout_seconds=0: plan varsayılanı; Free için 5 dakika |

**Düzeltme:** V4.3b.6 raporundaki 0 değerinin süresiz çalışma ihtimali şeklindeki yorumu doğru değildi. Güncel OpenAPI açıklamasında 0 plan varsayılanıdır, -1 otomatik duraklamayı kapatır. Yeni endpoint için 0 istendi ve GET ile 0 doğrulandı. [Neon endpoint API](https://api-docs.neon.tech/reference/createprojectendpoint), [güncel planlar](https://neon.com/docs/introduction/plans). Otomatik duraklamanın fiilen gerçekleştiğini görmek için beş dakika beklenmedi; son GET sırasında endpoint active idi. Hiçbir mevcut endpoint ayarı değiştirilmedi.

## Oluşturma öncesi kontroller ve kapasite

Git dalı feat/pusula-v030-neon-cloud, HEAD f56caed5eadb64e76304777f83477f1677c19d19. Önceki rapor değişiklikleri korundu. Proje, organizasyon, development adı/ID ve kaynak endpoint/hostname GET ile tekrar doğrulandı. İsim boştu, 4/10 branch ve bekleyen provider işlemi olmadığı görüldü; POST'tan hemen önce kimlik, slot, isim ve son operasyonlar yeniden kontrol edildi.

Windows proje yoluyla eşleşen süreç/servis/zamanlanmış görev yoktu. Source SQL gözleminde başka development oturumu, prepared transaction, subscription veya database replication slot yoktu. Yalnız plpgsql extension vardı. Kullanıcının uygulamanın kapalı ve başka kullanıcı bulunmadığı beyanı dikkate alındı. Bu gözlemler harici veya daha sonra bağlanacak yazıcıların yokluğunu kesin kanıtlamaz.

Organizasyon free, proje free_v3 ve branch limiti 10 API ile doğrulandı. Kullanıcı Console kanıtı 1 GB / 100 CU-saat hak ve 0,14 GB / 2,16 CU-saat kullanım gösteriyor. Tüketim GET bu devam koşusunda da **HTTP 403** döndürdü (2026-10-21T15:51:23Z civarı). Güncellenmiş onay bu 403'e rağmen devam edilmesini açıkça sağladı. Kullanım verileri API ölçümü, kesin kalan kota veya sıfır maliyet garantisi sayılmadı.

Son provider GET 2026-10-21T15:53:41.359Z: 5/10 branch, 5 endpoint, 1 snapshot; tüm branch'ler ready. Cursor ile son boş sayfaya kadar 118 operasyon: pending 0, failed 0. Kaynak ve recovery endpoint active, diğer üçü idle idi. Yeni endpoint min/max 0.25, suspend_timeout_seconds 0 ve doğru branch bağı GET ile doğrulandı. Ücretli plan veya kaynak açılmadı; kaynak yalnız doğrulanan Free projesinde oluşturuldu. Gerçek artımlı storage/compute tüketimi ölçülemedi; proje sayaçları synthetic_storage_size=0 / compute_time_seconds=7780 kesin kalan kota veya bu koşunun kullanım ölçümü olarak kullanılmadı. Copy-on-write artımlı veri/retention tüketimi devam edebilir. 0.25 CU'nun on dakika çalışması aritmetik olarak 0.0417 CU-saat eder; bu gerçekleşmiş kullanım ölçümü değildir.

## Yeni kaynak referansı ve RPO

Oluşturma öncesi REPEATABLE READ READ ONLY kaynak referansı 2026-10-21T15:51:53.529Z; MVCC 40961:40961:, gözlenen cluster LSN 0/3820190. Provider branch capture LSN 0/38201C8 ve parent timestamp 15:51:53Z döndürdü. Branch resource oluşturma zamanı capture zamanından yaklaşık 25 saniye sonradır; ikisi aynı kavram değildir. Gözlenen cluster LSN, provider capture LSN veya MVCC snapshot'ın birebir eşiti sayılmadı.

Kaynak sonrasında tekrar denetlendi: 15:53:03.268Z ve 15:53:25.368Z. Önce/sonra business digest, şema ve izin fingerprint'leri aynıydı; recovery business/schema referansı da bunlarla eşleşti. Recovery tamamlayıcı READ ONLY gözlemi 15:53:23.948Z. Kapsanan iş tablolarında gözlenen kayıp/fark yoktur; tam veritabanı veya gelecekteki kaynak yazıları için RPO=0 iddiası yoktur. Capture sonrasındaki yazılar recovery'ye otomatik taşınmaz.

Tam branch kopyası kaynak branch'teki diğer veritabanlarını ve Auth/MFA/session dahil veriyi de kapsar. Katalog metadatasında neondb, postgres, pusula_development, pusula_sprint_b_test (ve template DB'ler) görülür. SQL bağlantıları yalnız pusula_development'e yapıldı. Diğer veritabanı içerikleri ile Auth/MFA/session satırları okunmadı; bunlar için içerik eşitliği iddiası yoktur.

## SQL karşılaştırma sonuçları

Her bağlantıda açık CA, rejectUnauthorized, hostname/servername ve TLS 1.2 alt sınırı kullanıldı; encrypted/authorized kontrolü geçti. Başlangıç default_transaction_read_only=on; REPEATABLE READ READ ONLY transaction içinde sorgulandı. Lock timeout 3s, statement timeout 10s, transaction timeout 30s; tüm bağlantılar ROLLBACK ile kapatıldı. SSL doğrulaması devre dışı bırakılmadı, .env.local değiştirilmedi.

- Kaynak/recovery PostgreSQL 18.6 (fd34222), 40 tablo, 26 FORCE RLS; sekiz şema kategori hash'i eşit.
- 15 başarılı migration, tüm checksum'lar eşit; bilinen migration 008 resolved rollback kaydı korundu, unresolved 0.
- 015 SHA-256: 181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a.
- 016 her iki tarafta yok/pending; pusula_stock_executor yok. Migration 016 uygulanmadı.
- Migration history fingerprint eşit: decc11179da6577bc7de87bdba9fff38981d61cc2d7c6aa13501857ebb6c8302.
- Supplier 1, SupplierMaterial 1, SupplierOfferVersion 0, PurchaseOrder 1, PurchaseOrderLine 1, Material 1, MaterialVariant 1; yedi tablonun deterministik digest'leri kaynak/capture sonrası kaynak/recovery arasında eşit. Ham business satırları rapora yazılmadı.
- PO-2026-9893 APPROVED, 1 satır, 2 linear_meter, 3.04 square_meter, factor 1.52, USD 30.40; Decimal dönüşüm doğrulandı.
- Aynı tenant/legalEntity kapsamında PO→Supplier, PO line→SupplierMaterial→aynı supplier/variant, variant→Material join'i 1 eşleşme; iki tarafta da aynı. Supplier'ın insan tarafından verilen isminin anlamı doğrulanmadı; teknik ilişkiler ve digest eşitliği doğrulandı.
- Rol memberships, default privileges ve eski sınırlı ACL hash'leri eşit. Eski ACL baseline'ının beş supplier/purchase tablosunu dışlaması nedeniyle ayrıca bu beş tabloyu da içeren **tüm public tablolar için pusula% rollerinin etkin SELECT/INSERT/UPDATE/DELETE/TRUNCATE** hash'i alındı ve eşleşti: 9b5003386446276246d0eb2376dd77ec1302f000b17dbfc1b214a27d49e485f8. Bu her rol/obje/EXECUTE/sequence yetkisinin eksiksiz dump'ı değildir.

## Açık rol farkı — PARTIAL gerekçesi

İlk recovery denetimi rol baseline'ı eşleşmediği için PRIVILEGE_DRIFT ile durdu; TLS/şema/migration o aşamada geçmişti. Salt okunur tanılama kalan business kontrollerini tamamladı ve farkı izole etti; hiçbir normalization veya yetki düzeltmesi yapılmadı.

Kaynak roles hash'i ea06d98051bc3100dec1fe9ce9276a310d0fa6b29e2874665a79e41f0ac2ce01; recovery 5ae08e81389b3e24444e597c6fcf4f500eee54ee2bf51f1e356252410816e3c5.

Recovery'de kaynakta bulunmayan tek ek rol: **token_roles**. Gözlenen özellikler: LOGIN=false, SUPERUSER=false, CREATEDB=false, CREATEROLE=false, BYPASSRLS=false, bu DB için CONNECT=false, TEMP=true, public CREATE=false. Kaynakta bulunan tüm rollerin ölçülen alanları recovery'de eşit; üyelik hash'i de aynı. Rolün provider tarafından beklenen bir ekleme olduğu bağımsız kanıtla doğrulanamadı; zararsız veya tam uyumlu varsayılmadı. Bu nedenle tam rol bütünlüğü onayı yok ve sonuç PASS değil PARTIAL. Yeni branch korunur; ileride bu rol farkının açıklanması gerekir. Bu sonuç managed Neon'da migration 016 uyumluluk onayı değildir.

## Korunan kaynaklar ve işlemler

Production br-autumn-union-baaldt81, preview br-patient-block-bald8u59, eski recovery br-broad-river-bavv5pey, snapshot snap-frosty-sky-bav0qeo6 ve kaynak development br-rough-darkness-ba6ow9zo son GET envanterinde korundu. Mevcut dört endpoint kimliği de korunur. Provider'a yalnız GET'ler, bir branch POST ve bir yeni endpoint POST gönderildi. İki POST da 201 döndü; belirsiz mutation yanıtı veya kör retry olmadı. PATCH/DELETE, silme, yeniden adlandırma, restore veya otomatik yeniden oluşturma yoktur.

Başarısızlıklar: önceki V4.3b.7 koşusu kapasite 403 nedeniyle oluşturma öncesi BLOCKED idi (aşağıda tarihçe); güncel tüketim GET yine 403; ilk recovery SQL denetimi PRIVILEGE_DRIFT nedeniyle native exit 1. Tamamlayıcı salt okunur tanılama farkı saklamadı ve karşılaştırma PARTIAL kaydedildi. Branch/endpoint POST hatası yoktur.

Yerel kanıtlar .data/recovery-v43b7/approved altında: provider.json, capacity-resume.json, local-writers.json, source.json, creation.json, endpoint.json, recovery.json (ilk başarısız SQL), source-after.json, source-diagnostics.json, recovery-diagnostics.json, comparison.json, final/provider.json. Token ve bağlantı parolaları çıktılanmadı; .data stage edilmedi. Test/build çalıştırılmadı. Yalnız istenen iki rapor ve LAST_REPORT güncellendi; önceki rapor değişiklikleri korundu. SQL DML/DDL/GRANT, migration, production/test SQL bağlantısı, R2, Auth/MFA/session içerik erişimi, plan yükseltme, .env.local değişikliği, Git commit/push/merge yoktur.

[Doğrulama tablosu](../docs/validation/V04_V43B7_RECOVERY_VERIFICATION.md).

---

## Önceki koşu — tarihsel kayıt (güncellenmiş onay öncesi)

# PUSULA V4.3b.7 — RECOVERY_BRANCH_BLOCKED

21.10.2026, 18:40 Türkiye saati. Yeni recovery branch veya endpoint oluşturulmadı.

## Karar ve yetki sınırı

Kullanıcı tek bir tam veri recovery branch ve gerekirse minimum kapasitede doğrulama endpoint'i oluşturulmasına koşullu yetki verdi. Aynı talimat: **"Ücretli yükseltme, otomatik ek ücret veya kapasite belirsizliği varsa işlem öncesinde dur."**

Güncel proje ve organizasyon GET istekleri başarılıdır; tüketim GET isteği HTTP 403 döndürdü. Kalan storage/compute kapasitesi bağımsız olarak doğrulanamadı. Bu koşullu yetki altında oluşturma yapılmadı. V4.3b.6 READY sonucu, kullanıcı Console kanıtı ve belirtilen artık riskler üzerine sınırlı bir ön kontrol sonucuydu; V4.3b.7'nin belirsizlikte durma koşulunu kaldırmaz.

## Güncel provider kanıtı

GET denetimleri 2026-10-21T15:40:15Z civarında gerçekleştirildi. TLS sistem CA doğrulaması etkin; token çıktılanmadı. Provider'a yalnız GET gönderildi.

| Kontrol | Gerçek sonuç |
| --- | --- |
| Proje | `icy-queen-44442204` / `pusula-development` |
| Organizasyon | `org-wild-forest-12594477`, plan `free`; proje owner tipi `free_v3` |
| Kaynak | `br-rough-darkness-ba6ow9zo` / `development`, ready |
| Kaynak endpoint | `ep-blue-breeze-bavbjb7l`, idle, enabled, min/max 0.25 CU |
| Kaynak host | `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech` |
| Envanter | 4 branch, 4 endpoint, 1 snapshot |
| Branch kotası | API: 10; mevcut 4, önerilen oluşturma sonrası 5 olurdu |
| İsim çakışması | `pusula-v43b6-pre-migration-016-20261021` mevcut değil |
| Provider işlemleri | Cursor ile boş sayfaya kadar taranan 112 kayıt; pending 0, failed 0 |
| History retention | 21600 saniye / 6 saat |
| Kaynak logical size | 55,148,544 bayt; artımlı maliyet veya kalan storage değildir |
| Güncel tüketim | Proje+organizasyon filtreli `/consumption_history/v2/projects` GET: HTTP 403 |

API proje sayaçları `synthetic_storage_size=0`, `data_storage_bytes_hour=0`, `compute_time_seconds=7780` döndürdü. Bunlar kalan kota veya yeni kaynakların ücretsizliğine ilişkin kanıt olarak kullanılmadı. Yeni endpoint oluşturulmadığı için yeni endpoint'in gerçek compute ve auto-suspend sonucu yoktur.

Kullanıcının önceki Console/ekran görüntüsü kanıtı: Free, 1 GB storage, 100 CU-saat, 10 branch; kullanım 0,14 GB / 2,16 CU-saat / 4 branch. Bu tarihsel kullanıcı kanıtı korundu; güncel API ölçümü veya kesin kalan kota diye sunulmadı. [Neon'un 2 Ekim 2026 duyurusu](https://neon.com/blog/neon-free-plan-1-gb-per-project) genel 1 GB / 100 CU-saat / 10 branch haklarını destekler; hesaba özgü güncel tüketimi ölçmez.

## SQL doğrulamasının durumu

Kapasite kapısı geçmediği için bu koşuda development SQL denetimi veya yeni kaynak referansı oluşturulmadı; böylece compute uyandırılmadı. Güncel aktif yazıcı denetimi de tamamlanmış sayılmaz. Önceki V4.3b.6 SQL sonuçları yeni koşulmuş gibi raporlanmıyor.

Son tarihsel referans: 2026-10-21T15:31:40.043Z, MVCC `39937:39937:`, gözlenen cluster LSN `0/37E98E8`. O koşuda PostgreSQL 18.6, 40 tablo, 26 FORCE RLS, 15 başarılı migration, 015 checksum eşleşmesi, 016 pending; PO-2026-9893 APPROVED, bir satır, 2 m / 3,04 m² / 30,40 USD doğrulanmıştı. Ayrıntı: [V4.3b.6 raporu](PUSULA_V04_V43B6_RECOVERY_SAFETY.md). Bu eski referans gelecekteki oluşturma anını veya RPO sıfırı kanıtlamaz.

Yeni branch ID, endpoint ID, capture zamanı/LSN ve recovery SQL karşılaştırma sonuçları **yoktur**; oluşturma denenmedi. Migration 016 bu görevde uygulanmadı. Mevcut durumuna ilişkin bu koşunun kanıtı yeni SQL değil, önceki rapordur.

## Korunan kaynaklar

- Development `br-rough-darkness-ba6ow9zo`.
- Production `br-autumn-union-baaldt81`.
- Preview `br-patient-block-bald8u59` / `pusula-v42-restore-verification`.
- Eski recovery `br-broad-river-bavv5pey` / `pusula-v43a-pre-migration-015`.
- Snapshot `snap-frosty-sky-bav0qeo6` / `pusula-v42-before-supplier-migration`.
- Mevcut dört endpoint envanterde korundu. Hiçbirine PATCH/DELETE veya başka mutation gönderilmedi.

Planlanan parent yalnız development idi. Tam branch kapsamı sadece `pusula_development` ile sınırlı değildir; diğer veritabanlarını, rollerini ve Auth/MFA/session dahil kaynak verilerini de kapsar. Bu koşuda hiçbir SQL satırı okunmadı.

## Başarısız denemeler, dosyalar ve devam koşulu

Başarısız provider denemesi: tüketim GET HTTP 403. Branch/endpoint oluşturma denemesi yoktur; dolayısıyla belirsiz POST sonucu veya yeniden deneme yoktur. Yerel OpenAPI inceleme amaçlı bir `node -e` komutu PowerShell tırnak ayrıştırması yüzünden başarısız oldu; provider'a gitmedi, karar için kullanılmadı.

Yerel GET helper ve temizlenmiş kanıtlar `.data/recovery-v43b7/` altında tutuldu. Teslim belgeleri bu rapor, `docs/validation/V04_V43B7_RECOVERY_VERIFICATION.md` ve LAST_REPORT.md güncellemesidir. Önceki kullanıcı/rapor değişiklikleri korundu. Git dalı `feat/pusula-v030-neon-cloud`, HEAD `f56caed5eadb64e76304777f83477f1677c19d19` olarak kaldı.

Devam için yeni branch ve 0.25 CU doğrulama endpoint'inin mevcut Free sınırlarında kalacağına ilişkin kapasite belirsizliği giderilmelidir. Sonra yazıcı, TLS READ ONLY kaynak doğrulaması ve tutarlı referans hemen oluşturma öncesinde yeniden alınmalıdır. Önceki koşullu yetki, bu engel aşılmadan POST izni sayılmadı.

Neon POST/PATCH/DELETE, SQL bağlantısı, migration, restore/finalize/cutover, R2, .env.local değişikliği, Auth/MFA/session içerik erişimi, plan yükseltme, Git commit/push/merge veya test/build yapılmadı.
