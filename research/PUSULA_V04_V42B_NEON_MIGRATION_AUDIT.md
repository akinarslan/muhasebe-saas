# Sprint V4.2b.1 — canlı salt okunur denetim tamamlandı

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `225cd7acb66257e800b2e09b2bbf8a0412cc31e1`.

**Güncel sonuç: bağlantı/katalog engeli kalktı. Migration uygulanmadı ve uygulama onayı bekleniyor.** Aşağıdaki V4.2b BLOCKED metni ilk denemenin tarihsel kaydıdır; güncel canlı bulgular için bu bölüm esas alınmalıdır. Şema önkoşullarında engelleyici nesne çakışması bulunmadı; tam production kabulü, backup uygunluğu veya bütün kolonlarda drift olmadığı iddia edilmez.

## Canlı kanıt ve kapsam

İki denetim bağlantısı yalnız önceden allowlist edilmiş `pusula_development` direct hedefine açıldı. Her ikisi başlangıçtan default_transaction_read_only=on ve REPEATABLE READ READ ONLY kullandı; sorgu sınırı30s, lock sınırı3s, sonunda ROLLBACK ve bağlantı kapatma. DDL/DML/GRANT/REVOKE, migration, başka DB bağlantısı, dump veya R2 işlemi yok. Müşteri/finans/Auth kayıt içerikleri veya toplu iş kaydı sayımları okunmadı. Permission ID/module ve MASTER şablon sayısı yalnız uygulama yetki metadata'sıdır.

| Denetim | Gerçek sonuç |
| --- | --- |
| PostgreSQL | **18.6 (653b019)** |
| Read-only | `transaction_read_only=on` |
| İstemci TLS | **TLSv1.3**, socket encrypted=true, authorized=true, hostnameVerified=true; mevcut CA ve rejectUnauthorized=true |
| Neon sunucu göstergesi | `pg_stat_ssl.ssl=false`; bu değer istemci TLS kanıtı olarak kullanılmadı. İstemci socket'i ayrıca doğrulandı; sunucu iç hop'un nedeni bu denetimde kanıtlanmadı. |
| Public tablolar | **35**, Sprint E baseline isim listesiyle birebir eşleşti |
| ENABLE+FORCE RLS | **21**, baseline isim listesiyle birebir eşleşti |
| Policy / kullanıcı trigger / function | **43 / 11 / 5** |
| Supplier / SupplierMaterial / SupplierOfferVersion | **Üçü de yok** |
| SupplierUnit / v42 function / supplier indeks adları | Sorgulanan ad desenlerinde çakışma yok |
| Migration014 | **Pending**, migration geçmişinde kaydı yok |
| Başarılı migration checksum | **13/13 MATCH**, her migration için tek başarılı, geri alınmamış kayıt |
| Çözümlenmemiş başarısız migration | **0** |
| Invalid/not-ready indeks / not-valid constraint | **0 / 0** |
| Public dışı kullanıcı tablo/view/sequence/foreign relation | Sorgulanan nesne türlerinde **0** |
| Yeni sekiz Permission ID çakışması | **0** |
| MASTER rol şablonu | **1** |

Git dışı ham metadata kanıtı `.data/v42b-catalog.json`; sorgu yardımcısı `.data/v42b-audit.mts`. Ham dosya sır veya gerçek iş kaydı içeriği yazmaz; GitHub'a teslim edilmez. İlk komutun checksum sınıflandırma hatası aşağıda açıklandı; ham migration satırları korunarak sınıflandırma çevrimdışı yeniden hesaplandı.

## Migration geçmişindeki önemli ayrım

`202610160008_company_metadata` için **iki geçmiş satırı** var:

- Önceki deneme: finished=false, rolled_back=true, applied_steps_count=0; checksum `35ca1ae820b9e040ef189f3ff346381c591a268b74e4c37f639e94d2dded1fd9`.
- Başarılı uygulama: finished=true, rolled_back=false, applied_steps_count=1; checksum `db552670276d5e5d5b7ed37a78cc618bac9a79d8dc3e5d72cabe239dd4e7d36a`, yerel SQL ile eşleşiyor.

İlk yardımcı script isim başına ilk satırı seçtiğinden MISMATCH yazdı. Bu çıktı gerçek uygulanmış checksum drift'i olarak kabul edilmedi. Ham satırlar incelendi; başarılı kayıtlar bazında13/13 eşleşme ve unresolved0 doğrulandı. Yardımcı script seçimi düzeltildi, yakalanan metadata üzerinden çevrimdışı yeniden hesaplandı; yeni DB değişikliği yapılmadı. `granted_company_metadata` SELECT politikası LegalEntity üzerinde mevcut. Geri alınmış geçmiş kaydı silinmedi veya resolve işlemi uygulanmadı.

**Sprint E açısından ayrı engel:** mevcut inspectSource bütün migration satırlarında finished && !rolled_back ister; dolayısıyla bu çözülmüş rollback geçmişi bile `MIGRATIONS_INCOMPLETE` reddine yol açabilir. Ayrıca checkout14/live13 inventory farkı vardır. Bunlar migration geçmişini değiştirerek veya guard'ı gevşeterek giderilmedi. Daha erken rol/TEMP engeli ilk hata olabilir. Uygulanmış checksum eşleşmesi, mevcut backup preflight'ın geçmesi anlamına gelmez.

## Yapısal uygulanabilirlik ve drift sınırı

Canlı parent unique indeksleri **valid ve ready**: LegalEntity(tenantId,id), Activity(tenantId,legalEntityId,id), MaterialVariant(tenantId,legalEntityId,id). Migration014'ün composite FK hedefleri hazırdır. Mevcut beş function canonical SHA-256 değerinin tamamı Sprint E'deki incelenmiş expectedFunctions değerleriyle eşleşir; hepsi SECURITY INVOKER. Mevcut tablo/FORCE isimleri, enum kataloğu, policy/trigger tanımları, constraint ve indeks metadata'sı kaydedildi. Public dışı sorgulanan relation yok; yeni nesne çakışması bulunmadı.

**Bu denetim tam kolon/type/default/nullability diff'i veya extension/event-trigger envanteri karşılaştırması değildir.** Checksum eşleşmesi tek başına manuel DDL drift'ini dışlamaz. Yukarıdaki isim/sayı/function-hash/parent-indeks kontrollerinde engelleyici fark bulunmadı; bütün şemanın drift-free olduğu sertifikası verilmez. Ek tam katalog baseline karşılaştırması gerekirse ayrıca yalnız salt okunur yöntemle tamamlanmalıdır.

Mevcut35/21 canlı doğrulandığı için SQL'in üç CREATE TABLE ve üç ENABLE+FORCE işlemiyle hedefi **38 tablo/24 FORCE RLS** olarak somutlaşır; henüz bu hedefe geçilmedi. Yeni toplam policy54, trigger15, function7 beklenir; yeni SQL'deki9 FK/3 CHECK/14 indeks ayrı post-migration kontrolüdür.

Migration SQL ve hash'i değişmedi: `880cda78821cfe4b7b11484e70dc73c0d4ab2ad57a4ad0c3006d67587ac2bbc7`. Auth/müşteri/malzeme/quote/sale tablolarına veri veya kolon değişikliği yok. Yeni FK'ler mevcut parent'larda kilit/gelecekte RESTRICT etkisi oluşturur. Permission/RolePermission eklemeleri MASTER yetkisini genişletir; gerçek kullanıcı/MFA kaydı güncellenmez. İş verisi önce/sonra bütünlük kontrolü migration uygulanmadığından yapılmadı.

## Güncel rol ve varsayılan erişim bulguları

| Rol | Development CONNECT | TEMP | Public CREATE | BYPASSRLS / superuser |
| --- | --- | --- | --- | --- |
| pusula_runtime | true | true | false | false / false |
| pusula_auth | true | true | false | false / false |
| pusula_test_runtime | **false** | true | false | false / false |
| pusula_test_auth | **false** | true | false | false / false |

Dört rol LOGIN'dır; CREATEDB/CREATEROLE false. Migration'ın test_runtime'a grant vermesi development CONNECT=false nedeniyle şu anda o kimliğe bağlantı açmaz; grant'in kendisi ve ileride CONNECT açılması riski ayrı kabul kararıdır. Bu kararda bir değişiklik yapılmadı. Canlı default ACL yalnız cloud_admin için public tablo/sequence üzerinde neon_superuser grant'lerini gösterir; neondb_owner için katalogda explicit default ACL kaydı yoktur. Owner/provider ayrıcalıkları kalkmış sayılmaz. Özel `pusula_backup` rolü mevcut rol envanterinde yoktur. TEMP ve backup rolü/diğer DB izolasyon engelleri çözülmedi; başka DB'lere bağlantı açılmadı.

## Kabul kapılarının güncel durumu

- A bağlantı/sayım/uygulanmış checksum: **tamamlandı**. İlk planın “hiç rolled-back satır yok” ölçütü gerçek geçmişle karşılanmaz; çözülmüş geçmişin unresolved hatadan farkı yukarıda belgelenmiştir.
- B drift/ACL: yeni nesne yokluğu, parent unique indeksler, tablo/FORCE listeleri ve beş function hash'i doğrulandı. Tam kolon ve tüm nesne türü diff'i kapsam dışı kalan kanıt sınırıdır.
- C izinler: runtime/auth özellikleri, test rolü CONNECT=false, default ACL, Permission çakışması0 ve MASTER1 doğrulandı. Test_runtime grant kapsamı için operatör kararı gerekir.
- D kurtarma/bakım penceresi/timeout ve gerçek migration sonrası iş verisi koruma planı: açık.
- E gerçek migration: **ONAY BEKLER**; hiçbir deploy/SQL uygulaması yok.
- F/G post-migration metadata ve Supplier/tenant/cost/snapshot fonksiyon testleri: uygulanmadı; önceki V4.2 yerel fixture sonuçları canlı test değildir.
- H backup/production: dar rol/TEMP/CONNECT, rollback-history guard, yeni38/24 şema kapsamı, gerçek key/yedek/restore işletimi açık.

Sonraki adım: migration014'ün hedefi/hash'i, sekiz Permission+MASTER genişlemesi, iki runtime grant'i, timeout/bakım penceresi ve kurtarma planını kapsayan ayrı açık kullanıcı onayı beklenir. **Bu rapor uygulama talimatı veya production kabulü değildir.**

Mimo teslimi yine yalnız bu rapor ve LAST_REPORT.md'dir. Codex stage/commit/push yapmadı; uygulama, migration, ortam ve guard kaynakları korunur. Bu tur yalnız metadata denetimi ve belge güncellemesidir; TypeScript/lint/Vitest/browser yeniden çalıştırılmadı.

---

# V4.2b ilk deneme — tarihsel kayıt (güncel karar yukarıdadır)

# PUSULA v0.4 — V4.2b Neon development migration ön denetimi

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `225cd7acb66257e800b2e09b2bbf8a0412cc31e1`.

## Karar: BLOCKED — canlı katalog doğrulaması tamamlanmadı

Migration014 kaynak incelemesinde additive yapıdadır; **mevcut Neon development'a güvenle uygulanabilir olduğu henüz doğrulanamadı. Migration uygulanmamalı.** Salt okunur Neon denetimini başlatacak komut otomatik onay incelemesinde kapasite hatasıyla reddedildi; işlem çalıştırılmadı. Bu, SQL'in güvensiz bulunduğu veya Neon'un bağlantıyı reddettiği anlamına gelmez. İnceleme atlanmadı ve bağlantı başka yoldan denenmedi. Güncel PostgreSQL sürümü, canlı checksum, drift, çakışma ve efektif yetkiler bu teslimde **DOĞRULANMADI**.

Git fetch başarılı; ardından yerel/uzak farkı **0/0**. Mimo'nun belirtilen V4.2 commit'i tam hash ile doğrulandı; başlangıç çalışma ağacı temizdi. Stage/commit/push/merge yapılmadı. LAST_REPORT'taki önceki “Mimo'ya devredilecek” kaydı tarihsel kalmıştır; V4.2 kodu artık bu commit'tedir.

## Kaynaklar ve kanıt sınırı

İncelenenler: [V4.1 denetimi](PUSULA_V04_SPRINT_V41_AUDIT.md), [veri modeli](../docs/architecture/V04_DATA_MODEL.md), [domain servisleri](../docs/architecture/V04_DOMAIN_SERVICES.md), [migration taslağı](../docs/architecture/drafts/V04_MIGRATION_PLAN.md), [V4.2 denetimi](PUSULA_V04_SPRINT_V42_AUDIT.md), [V4.2 doğrulama](../docs/validation/V04_SPRINT_V42_VERIFICATION.md), [Prisma](../prisma/schema.prisma), 14 migration, runtime hedef doğrulaması ve Sprint E kaynak güvenliği/TOC kontrolleri.

Migration014 SHA-256: `880cda78821cfe4b7b11484e70dc73c0d4ab2ad57a4ad0c3006d67587ac2bbc7`.

`git diff f3e1baa 225cd7a` eski 13 migration ve backup kaynaklarında değişiklik göstermedi; schema.prisma'ya101, yeni SQL'e176 satır eklendi. Yeni modeller dışında eski alan değişimi yok. Bu karşılaştırma canlı DB checksum kanıtı değildir.

| Konu | Bu teslimde kanıt |
| --- | --- |
| PostgreSQL sürümü | Güncel bilinmiyor. Git dışı önceki E2.2b katalog kaydı18.6 gösterir; güncel ölçüm değildir. |
| Mevcut tablo/FORCE sayısı | Kaynak baseline35/21; önceki katalog kaydı ayrıca incelendi. Bugünkü Neon sayımı yapılmadı. |
| Prisma migration geçmişi | Yerelde14 SQL var. Canlıda ilk13'ün tam ve checksum eşleşmesi,014'ün pending olması henüz doğrulanmadı. |
| Supplier nesne çakışması/drift | Kaynakta yeni adlar belli; canlıda yoklukları ve beklenmeyen nesneler doğrulanmadı. |
| Mevcut kayıtlar | Hiçbir müşteri, malzeme, fiyat, teklif, satış veya Auth satırı okunmadı; toplu sayım da yapılmadı. |
| Canlı rol/default ACL | Yeni gözlem yok. Aşağıdaki tarihsel bulgular tekrar doğrulanmalıdır. |

Git dışı `.data/v42b-audit.mts` hazırlandı: yalnız allowlist direct development hedefi, CA+hostname doğrulaması, bağlantı başlangıcından `default_transaction_read_only=on`, REPEATABLE READ READ ONLY,30s sorgu/3s kilit sınırı; katalog/izin metadata'sı ve migration checksum karşılaştırması. Test/prod/fixture hedefi kullanmaz. Komut çalışmadığından `.data/v42b-catalog.json` bu denemenin kanıtı olarak üretilmedi. Yardımcı script Mimo teslim kapsamı değildir. Sonraki oturumda yeniden gözden geçirilerek çalıştırılmalıdır; tek başına tam drift sertifikasyonu değildir.

## Migration014 kapsamı ve veri etkisi

SQL'de üç CREATE TABLE vardır: Supplier, SupplierMaterial, SupplierOfferVersion. Yeni SupplierUnit altı değer içerir; mevcut CostUnit değişmez. Yeni üç tablo FORCE+ENABLE RLS döngüsüne girer. Baseline gerçekten35 tablo/21 FORCE ise geçiş **38/24** olur; canlı başlangıç sayısı doğrulanmadan bu sonuç gerçekleşmiş sayılmaz. Prisma37 model, metadata dahil38 hedef tablo tarif eder.

Yeni nesneler: üç PK ve11 explicit indeks (PK destek indeksleriyle14 yeni indeks), dokuz composite FK, üç CHECK, iki SECURITY INVOKER function, dört trigger,11 RLS policy (üç scope + sekiz restrictive). Bu rakamlar SQL ve döngü genişletmesinden hesaplandı; canlı kurulum ölçümü değildir.

Eski işletme tablolarında UPDATE/DELETE/TRUNCATE/DROP veya fiyat backfill'i yok. MaterialVariant.usdCost, MaterialPriceHistory, quote/sale snapshot alanları değiştirilmez. Mevcut LegalEntity/Activity/MaterialVariant tablolarına yeni child FK bağımlılıkları eklenir; bunlar eski parent kayıtlarının gelecekte silinmesini/güncellenmesini RESTRICT ile etkiler. “Eski tablolara hiçbir etkisi yok” denemez.

**Mevcut yetki verisine DML vardır:** Permission'a sekiz anahtar, RolePermission'a mevcut MASTER için bağlantılar INSERT edilir. AuthUser/MFA/Membership kaydı güncellenmez; fakat MASTER sahiplerinin efektif uygulama yetkileri genişler. Normal rol şablonları ve override'lar resetlenmez. ON CONFLICT DO NOTHING mevcut yanlış module/label kaydını düzeltmez; sekiz ID'nin önceden varlığı/anlamı ve MASTER şablonunun tekil varlığı önceden kontrol edilmelidir. MASTER yoksa ikinci INSERT sessizce sıfır satır üretir.

## Tenant, RLS ve maliyet güvenliği

SupplierMaterial→Supplier, Offer→SupplierMaterial ve link→MaterialVariant tenant+legalEntity+id composite FK kullanır. Üç tabloda LegalEntity ve nullable Activity composite FK'si vardır. Nullable activity'nin MATCH SIMPLE davranışı şirket genelindeki kaynaklar içindir; company FK ayrıca zorunludur. Önce LegalEntity(tenantId,id), Activity(tenantId,legalEntityId,id), MaterialVariant(tenantId,legalEntityId,id) referans unique indekslerinin valid/ready olduğunu doğrula. createdById/recordedById AuthUser'a yeni FK ile bağlanmaz; uygulama/session/policy aktör sınırı kullanılır.

Scope policy boş user'ı reddeder ve tenant/company GUC eşleşmesi ister. Restrictive action politikaları `pusula_can`, erişilebilir parent ve material üzerinden daraltır; INSERT'te owner/activity/aktiflik ve offer maliyet izinleri denetlenir. Kimlik/version trigger'ları scope/owner/parent değişimini, offer trigger'ları UPDATE/DELETE/TRUNCATE'ı engeller. FORCE RLS ayrıcalıklı BYPASSRLS/superuser için mutlak engel değildir. Runtime rolün non-owner/NOBYPASSRLS özellikleri canlıda yeniden doğrulanmalıdır. [PostgreSQL18 RLS davranışı](https://www.postgresql.org/docs/18/ddl-rowsecurity.html).

**Maliyet gizliliği sütun RLS'si değildir.** Offer SELECT politikası view+parent sınırı koyar; maliyet sütunlarını tek başına maskelemez. Server DTO, supplierOffers.costView ve ilgili materials.costView yoksa fiyat/FX/conversion/not/ref alanlarını çıkarır; compare403 olur. Shared runtime credential'ının doğrudan SQL erişimine karşı sütun gizliliği iddiası yoktur. Handler/DTO ve DB credential sınırı birlikte korunmalı; migration sonrası maliyet-DENY API testi zorunludur.

## Grants, roller ve varsayılan erişim

SQL yeni tablolarda PUBLIC haklarını kaldırır; Supplier/Link SELECT+INSERT+UPDATE, Offer SELECT+INSERT haklarını **pusula_runtime ve pusula_test_runtime** rollerine verir. DELETE/TRUNCATE ve Offer UPDATE verilmez. İki yeni function PUBLIC EXECUTE kaldırılır, aynı iki role EXECUTE verilir. Function'lar invoker'dır; yeni SECURITY DEFINER yoktur. Auth rollerine explicit yeni grant yoktur. CREATE/ALTER ROLE veya eski rol üyelik değişimi yoktur.

**Özel inceleme kapısı:** development migration'ı test_runtime rolüne de hak verir. Önceki E2.2b katalog kaydında pusula_test_runtime development CONNECT=false, schema CREATE=false idi; bu güncel veya kalıcı garanti değildir. CONNECT'in doğrudan/PUBLIC/üyelik yollarıyla hâlâ kapalı olduğu doğrulanmalı; gelecekte açılması bu yeni grant'leri kullanılabilir kılar. İki rolün birlikte grant edilmesinin development için kabulü veya ayrı target-aware grant tasarımı kullanıcı tarafından kararlaştırılmalıdır. Bu görevde SQL değiştirilmedi.

Önceki katalogda PUBLIC TEMP vardı; cloud_admin default ACL'leri neon_superuser'a tablo/sequence hakları veriyordu. Bunlar yeni ölçüm değildir. Yeni nesne owner'ı gerçek migration çalıştıran roldür; onun global ve schema-specific default ACL'leri birlikte incelenmeli. PUBLIC REVOKE başka role default grant'i veya owner/provider ayrıcalığını kaldırmaz. RLS sahibi/bypass istisnaları ayrıca değerlendirilmelidir. [PostgreSQL18 yetki modeli](https://www.postgresql.org/docs/18/ddl-priv.html).

## Olası hatalar ve kilitler

- Mevcut enum/table/index/function adı çakışması; önceden kısmi/manual kurulum; migration checksum drift'i: dur, otomatik DROP/IF NOT EXISTS ile geçme.
- Eksik runtime/test_runtime rolü veya grant/CREATE/REFERENCES yetkisi; eksik pusula_can/Permission/Role; eksik/invalid parent unique key: transaction başarısız olur. Güncel katalog onayı yoktur.
- Yeni FK'ler parent LegalEntity/Activity/MaterialVariant üzerinde kilit alabilir; normal indeksler yeni boş tablolardadır. Permission/RolePermission INSERT'i eşzamanlı yetki yönetimiyle bekleyebilir. Uzun transaction ve migration advisory lock çakışmaları için bakım penceresi gerekir. [PostgreSQL18 kilit uyumluluğu](https://www.postgresql.org/docs/18/explicit-locking.html).
- SQL BEGIN/COMMIT içerir fakat lock_timeout/statement_timeout içermez. Gelecekte onaylı runner oturumunda sınırlı süreler (örneğin3s/60s) ayarlanıp sınır aşımında durulmalıdır; korumasız doğrudan SQL kopyalama veya sınırsız retry önerilmez. Mevcut runner yalnız deploy çağırır; bu sürelerin uygulanacağı yöntem ayrıca doğrulanmalıdır.
- Local fixture geçmişte gövdeyi kendi transaction'ına alarak çalıştırdı. Bu kanıt gerçek Neon/Prisma deploy metadata/failure davranışını tek başına ispatlamaz.

## Rollback ve kurtarma

COMMIT öncesi hata PostgreSQL transaction'ını geri alır; bağlantı kapatılır, durum salt okunur yeniden denetlenir. Prisma başarısız migration metadata kaydı ayrıca kalabilir; ham loglar sır içerebileceğinden paylaşılmaz. Migration resolve veya yeniden deneme ayrı inceleme/onay ister; checksum dosyası değiştirilmez.

Başarılı COMMIT sonrası otomatik down migration yoktur. Önce modül yazmalarını durdurup feature erişimini kapatma/uyumlu kod geri dönüşü tercih edilir; eski şemayı koruyan forward fix değerlendirilir. Supplier verisi oluşmuşsa DROP veri kaybıdır ve bu görev tarafından onaylanmaz. Kontrollü fiziksel geri alma ancak yeni nesne/bağımlılık/satır sayımı, izin metadata baseline'ı ve kurtarma yöntemi hazırken ayrı onayla tasarlanır. Permission/Master bağlantıları yalnız bu migration'ın gerçekten eklediği kayıtlar ispatlanırsa hedeflenebilir; önceden mevcut izinler topluca silinmez. `_prisma_migrations` manuel silinerek başarı taklidi yapılmaz.

Gerçek bağımsız yedek/restore hazır değil. Development uygulaması için dahi kabul edilebilir veri kurtarma seçeneği, bakım penceresi ve risk kabulü açıkça belirlenmeden öneri GO olamaz. Provider restore seçeneği mevcut plan/retention üzerinden ayrıca doğrulanmalı; otomatik kurtarma garantisi verilmez.

## Sprint E etkisi — guard'lar değişmedi

expectedTables35/expectedForcedTables21 ve beş function hash'i sabittir; enum allowlist SupplierUnit içermez. Yeni tablolar otomatik kabul edilmez. Migration sonrası extra_type kontrolü `SOURCE_OBJECT_OR_PRIVILEGE_REJECTED`, function kapsamı `SOURCE_FUNCTION_COVERAGE_REJECTED`, tablo/RLS kapsamı `SCHEMA_COVERAGE_REJECTED` / `RLS_COVERAGE_REJECTED` üretebilir; ilk hata rol/ACL guard sırasına bağlıdır. Bu, kaynak incelemesidir; gerçek Neon preflight koşusu yapılmadı.

**Migration öncesinde de** checked-out14 migration ile canlı geçmiş13 ise checksum inventory karşılaştırması `MIGRATION_CHECKSUM_MISMATCH` verecektir; daha erken rol/TEMP guard'ı bunu maskeleyebilir. “Önce yedek alırız” varsayımı bu checkout'ta doğrulanmış değildir. dump TOC denetimi de35 tabloyu bekler.

Gelecek ayrı backup geliştirmesi:38/24 isimleri, SupplierUnit, iki canonical PG18 function hash'i, dört trigger/11 policy/dokuz FK ve ACL snapshot'ını sürümlü incelemeyle ekle; beklenmeyen nesne reddini koru. Eski arşivleri yeni allowlist'e zorlayıp okunamaz yapma; arşiv şema sürümü/anahtar ID'sine göre önceki kurtarma yolu korunmalıdır. Gerçek yerel fixture dump→AES-GCM→manifest/hash→boş hedef restore testi yeni üç tablonun satır/içerik hash'ini, offer revision/FX/conversion snapshot'ını, iki tenant, Auth ilişkileri, FK/RLS/grants/immutable trigger davranışını kapsamalı. Yanlış key, bozuk ciphertext, eksik/karışık manifest reddi tekrar doğrulanmalı. Bu görevde guard veya şifreleme kodu değiştirilmedi.

Gerçek Neon dar backup rolü/TEMP/diğer DB CONNECT/builtin ownership sorunları çözülmüş kabul edilmez. Managed remote güvenlik/upload engelleri sürer. Kalıcı key ve iki bağımsız kurtarma kopyası, gerçek şifreli yedek/readback, E3 işletim ve E4 kurtarma kabulü olmadan production kabulü yoktur.

## Ayrı kabul kapıları ve test planı

| Kapı | İşlem ve geçme koşulu | Durum |
| --- | --- | --- |
| A — güncel salt okunur audit | Yalnız allowlist development/verify-full; PG18,35/21 tam isim eşleşmesi, ilk13 SHA256 eşleşmesi,014 pending; failed/rolled-back kayıt yok | **BLOCKED**, komut çalışmadı |
| B — drift/ACL | Bütün kolon/type/default/nullability; parent unique/FK/constraint valid, mevcut policy/function/trigger tanımları; beklenmeyen schema/view/sequence/extension/event trigger; yeni tüm adların yokluğu | Yapılacak; isim/sayı eşleşmesi tek başına yeterli değil |
| C — roller/izinler | Owner/membership/BYPASSRLS ve efektif ACL; default ACL; test rolü CONNECT sınırı; sekiz permission conflict ve MASTER; önce/sonra hak matrisi | Yapılacak, yeni kullanıcı içeriği okunmaz |
| D — veri baseline/kurtarma | Kontrollü yazma penceresi, eski tablo toplu sayımları/uygun içerik göstermeyen bütünlük özeti ve kullanılabilir kurtarma planı | Ayrı plan/onay; bu teslimde satır sayılmadı |
| E — migration | Hedef+014 hash+izin/Master/grant kapsamı+timeout+rollback için açık kullanıcı onayı | **ONAY YOK** |
| F — migration sonrası metadata |38/24 tam ad;14 başarılı checksum; yeni9 FK,14 indeks,3 CHECK,3 PK,11 policy,4 trigger,2 invoker function; owner/ACL/default ve eski katalog baseline farkı | Gerçek deploy sonrasında ayrı salt okunur kontrol |
| G — fonksiyonel kabul | Supplier CRUD/pasifleştirme; link/idempotency/concurrency; immutable teklif/geçmiş; iki tenant/company/activity; cost DENY; eski fiyat/snapshot bütünlüğü | Önce yeniden izole sentetik fixture; development'a test veri yazımı ayrıca onay ister |
| H — backup/production | Genişletilmiş guard+gerçek yeni fixture restore; gerçek rol/key/yedek/kurtarma işletimi | Açık production engeli |

Bu teslimde TypeScript/lint/Vitest/browser yeniden çalıştırılmadı; uygulama kodu değişmedi. V4.2 raporundaki297/297 Vitest, DB/API ve28/28 browser sonuçları **önceki yerel fixture** kanıtıdır; bugünkü Neon migration testi değildir. Yeni test başarısı iddiası yok. İlk PowerShell upstream ifade hatası tırnaklanarak düzeltildi; yerel tek satır Node analiz denemesi quoting hatasında durdu, veri bağlantısı yapmadı. Başarısız denemeler PASS sayılmadı.

## Sonraki adım ve Mimo teslim listesi

Önce otomatik onay incelemesi kullanılabilir olduğunda **zaten onaylanmış salt okunur development audit'ini** tamamla; yeni SQL uygulama onayı istemeden önce canlı bulgularla bu raporu güncelle. Test_runtime grant kararı, timeout yöntemi ve kurtarma kapısı çözülmeden migration önerilmez. Gerçek migration, permission/Master/grants ve varsa backup/rol düzenlemeleri için ayrı açık kullanıcı onayı gerekir. Production/test DB bağlantısı veya fixture başlatma bu görevde yapılmadı.

Mimo'nun inceleyeceği ve uygun bulursa normal commit/push yapacağı **yalnız iki dosya**:

1. `research/PUSULA_V04_V42B_NEON_MIGRATION_AUDIT.md` — bu rapor; eksik canlı kanıtı BLOCKED olarak teslim eder.
2. `LAST_REPORT.md` — güncel karar/engel ve Mimo devir özeti.

Codex stage/commit/push yapmadı. Mimo `.data`, `.env*`, credentials, generated/build çıktısı eklememeli; diff/sır kontrolünden sonra ayrı `.md` teslim raporunda gerçek commit/push sonucunu kaydedip kullanıcıya dosya olarak sunmalıdır. Mimo çalıştırılmadı, mesaj gönderilmedi ve onun teslimi gerçekleşmiş gibi raporlanmadı.
