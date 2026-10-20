# PUSULA V4.3b — Codex geliştirme raporu

20.10.2026 · `feat/pusula-v030-neon-cloud` · başlangıç HEAD `295c29879b4c0fc7c24de6f5cecd5b5ddaf40697`.

**V4.3b — LOCAL_ACCEPTANCE_PASS.** Gerçek PG18.6/Prisma,27StockSQL/API,DB11/Auth62/Cloud11/Supplier16/Purchase28,desktop/mobile4/4,368Vitest,TypeScript,ESLint veproductionbuild başarılı. Build'de mevcut .data tracing uyarısı korunur. Gerçek Neon'a016 uygulanmadı;bu sprint yalnız yeni UUID/loopback PostgreSQL18.6 fixture'larını kullanır. Gerçek `PO-2026-9893`,Auth/MFA,production,mevcut Neon test DB,snapshot/recovery ve R2'ye işlem yapılmadı.

## Uygulanan model ve akış

Yedi yeni FORCE RLS tablo:GoodsReceipt,GoodsReceiptLine,StockLocation,StockLot,StockPostingBatch,StockMovement,StockBalance. Local katalog **47tablo/33FORCE RLS/16migration**. V4.1 adları ve tek ledger/cache ayrımı korundu;ikinci stok defteri oluşturulmadı.

Onaylı PO seçimi → miktar/ret/gerekçe ile DRAFT → MFA+receipts.post → aynı transaction'da lot,batch,movement,balance,audit vePOSTED. Taslakta stok yok;ret edilen kısım stoklanmaz. Tam ret belgesi POSTED olabilir ama lot/zero-delta hareket üretmez. Kümülatif kabul PO miktarını aşamaz. Parent kilidi iki bağlantılı yarışta doğrulandı. Aynı normalize create key+payload aynıid;farklı payload409. Post replay stoklamaz. Draft versioned edit/cancel;POSTED kayıtlar değişmez. Tam reversal ayrı negatif batch/hareket oluşturur;eski receipt korunur,ikinci reversal reddedilir ve kabul hakkı otomatik yeniden açılmaz.

StockLocation bu kesitte düz depo/konumdur;hiyerarşik raf/pasifleme servisi yok. Her receipt satırı tek fiziksel rulo veya tek ölçülü levha/adet partisini temsil eder;operatör doğrulaması API ve SQL'de zorunludur. Çoklu rulo paketlemesi ayrı receipt belgeleriyle yapılır;otomatik hayalî lot dağıtımı yok.

## Fiziksel miktar ve maliyet

V4.1'in rulo otoritesi korunur:2metre,152cm rulo için ledger/balance **2linear_meter**;UI türetilen **3.04m²** gösterir. Aynı stok ikinci kez m² olarak yazılmaz. Lot width/initialLength/form ve donmuş conversion/cost snapshot taşır. SHEET/PIECE sayıları tam sayı;sheet en/boy ve PO faktörü uyumlu olmalıdır. Mevcut BULK square_meter aynı-birim girişi desteklenir;kg/litre,alanla alınmış rulodan uzunluk çıkarımı,remnant ve üretim kesimi unsupported olarak reddedilir.

V4.1'deki nullable Variant inventory profil kolonları yerine bu sprintte ilk immutable lotun form/baseUnit'i esas alınır. Variant advisory lock ve dar internal görünürlük,başka aktörün lotu görünmese de profil değişikliğini reddeder. Mevcut MaterialVariant.inStock bakiyeye dönüştürülmez;usdCost otomatik yazılmaz. Kalıcı profil yönetimi V4.5'te ayrı genişlemedir.

Edinim PO'nun donmuş orijinal para birimi/birim fiyat/FX snapshot'ından türetilir. TRY snapshot değiştirilmez,EUR/GBP için USD uydurulmaz. KDV/navlun/ek edinim bileşenleri hariç olduğu snapshot/UI'da açık. PO fiyat ölçeğiyle uyumlu9basamak kullanılır;V4.1 genelUSD6taslağından gerekçeli farktır.

Mikro kısmi teslimlerde tutarlar `CUMULATIVE_HALF_UP_9_V1` ile dağıtılır:round(kümülatif yeni×fiyat,9)−round(kümülatif önceki×fiyat,9). Bağımsız Decimal yeniden hesaplaması,miktar başına yuvarlama farkının birikmediğini kanıtlar. Miktar9scale tam temsil edilemiyorsa ret;silent quantity rounding yok. HTTP decimal string'ler scientific notation'a dönüşmez;gösterim geometrisi Decimal60 ile hesaplanır.

## Güvenlik ve veritabanı invariant'ları

Canonical receipts.view/create/edit/post/cancel/reverse/costView ve stock.locationsManage/movementsView eklendi;stock.view kullanıldı. Yalnız MASTER seed'i;normal şablonlara yeni yetki eklenmedi. Legacy stock.receive/issue/adjust otomatik yeni komut izni değildir. OWN/ACTIVITY ve explicit DENY mevcut decide/pusula_can sistemindedir;masterflag bypass değildir.

Runtime yeni receipt/ledger/cache tablolarında yalnız SELECT ve iki dar command/read fonksiyonu EXECUTE alır. NOLOGIN,NOBYPASSRLS,non-owner `pusula_stock_executor`;üyelik yok,PUBLIC EXECUTE yok,sabit search_path ve minimal grant. Yeni Auth SELECT yetkisi verilmez. Composite FK,CHECK,unique kaynak/key,immutable/truncate guard ve deferred ledger/cache completeness uygulanır. Direct runtime DML veya SET ROLE ile aşma negatif testleri geçti. FORCE RLS ile executor'ın table-owner/BYPASSRLS olmaması birlikte önemlidir. [PostgreSQL RLS](https://www.postgresql.org/docs/18/ddl-rowsecurity.html),[definer güvenliği](https://www.postgresql.org/docs/18/sql-createfunction.html).

MFA HTTP/server katmanında requireMfa ile post/reverse öncesi doğrulanır. SQL gate browser session/MFA payload'ı okumaz;shared trusted runtime credential'ının ele geçirilmesine karşı MFA garantisi yoktur. Bu önceki sistemin server-only credential sınırıdır;son kullanıcıya DB rolü verilmez.

Edinim DTO'su receipts.costView ve kaynak materials.costView ister;explicit DENY halinde nested cost snapshot da yoktur. Manuel variantUsdCost lot snapshot'ına taşınmaz. Audit finansal payload yerine action/target/version tutar.

## API ve UI

Mevcut cloudRequest/contextFor/scoped/Prisma zincirine inventoryRequest eklendi. `/workspace/receipt-orders`,goods-receipts list/detail/create/PATCH,/:id/post/cancel/reverse,stock/locations,lots,movements. Kullanıcı tenant/actor veya hesaplanmış bakiye/tutar veremez. SQL guard'ı eksik line array/version/cancelreason alanlarını da reddeder. Sabit hata kodları ve atomik rollback korunur;automatic mutation retry yoktur.

`/app` içinde Mal Kabul ve Stok:depo oluşturma,onaylı sipariş/kalan/kısmi-tam teslim göstergesi,ret gerekçesi,DRAFT edit/cancel,MFA post/reverse,lot detayları,miktar/alan ve append-only hareket listesi. Boş/yükleniyor/hata/yetkisiz durumları,kirli taslak için Escape/navigasyon uyarısı,dialog focus geri dönüşü ve mobil taşma kontrolü vardır. MFA sonrası açık ikinci kullanıcı tıklaması gerekir;otomatik post replay yapılmaz.

## Migration güvenliği

016:`202610210016_goods_receipts`. SHA-256:

`4dc07f6a16c5d423b3dbafd06c377775212d728f701c5b3390a5dbb7cbbe5a89`

İlk15 SQL değişmedi;checksum'lar hem eski baseline hem Git referansı ile korunur. Yeni SQL explicit transaction+3slock/30sstatement/60stransaction sınırında;yerel fixture015 sonrası pre-schema ve016 post-schema pinleriyle gerçek Prisma deploy kullanır. Stock baseline `scripts/stock/migration-baseline.json`;ön pin mevcut migration-baseline.appliedSchema'dır. Ölçüm baseline'ı otomatik yenilemez;ayrı pinli koşu yapılır.

Bulut runner016'yı görünce bağlantıdan önce `STOCK_MIGRATION_REQUIRES_SEPARATE_CLOUD_REVIEW` ile kapanır. Gerçek Neon apply komutu bu sprintte verilmedi/çalıştırılmadı. Managed executor/grant uyumluluğu,cloud preflight/recovery/RPO ve kullanıcı onayı ayrı kapıdır. Backup35/21veE2 definer engeli korunur;47/33ve yeni functions allowlist'e otomatik alınmadı.

## Gerçek testler ve ilk başarısızlıklar

Ayrıntılı final kanıt ve fixture kimlikleri [validation belgesinde](../docs/validation/V04_V43B_VERIFICATION.md) tutulur. Hiçbir yerel fixture sonucu gerçek Neon kabulü sayılmaz.

Başarısız ilk denemeler ignored `.data/v43b/` ve ilgili UUID fixture loglarında korunur:

- İlk iki Prisma denemesi SQL dollar delimiter hatası;üçüncüdeSQL başarılı ama target marker ikinci wx yazımı fixture'ı durdurdu.
- Supplier regresyonunun tarihsel40tablo beklentisi ve stock flag'in child ortamına eksik geçişi;47/33 fixture beklentisi ayrı açık flag ile düzeltildi.
- Executor'ın eksik pusula_can EXECUTE hakkı;sonra ortak trigger'ın StockLocation üzerinde OLD.status alanına erişmesi. İkisi gerçekPG hatasıyla bulundu/düzeltildi.
- Test normal OWN scope'u için zorunlu legalEntityId eksikti;fixture sözleşmesi düzeltildi.
- Adversarial OWN testi **başka aktörün tesliminin toplama katılmamasını** yakaladı. Command içinde dar current-order aggregate görünürlüğü ile düzeltildi. Ardından deferred completeness'in normal kullanıcıya ait geçerli kalan kabulü yanlış reddi bulundu;kapsamı action yetkisine bağlandı. Aynı negatif ve pozitif testler yeniden geçti.
- Profile negatif testinde SupplierMaterial'ın mevcut version artışı kuralı atlanmıştı;test mevcut guard'ı gevşetmeden düzeltildi.
- İlk TypeScript test yardımcı kodu quote hataları ve ESLint effect içinde setState hatası giderildi. Sandbox Vitest spawnEPERM,aynı yerel testin izinli çalıştırılmasıyla aşıldı.
- İlk browser koşuları1/4,sonraki2/4 ve3/4 aşamalarında kaldı. Ayrı test kimlikleri,gerçek login/MFA/POST yanıtını bekleme,select erişilebilir adları ve setup zamanlaması düzeltildi. Browser ayrıca **onaylı sipariş seçicisindeki eksik tenant/entity projeksiyonu yüzünden boş liste** kusurunu buldu;API regresyonu eklendi. İlk başarısızlıklar son4/4 ile silinmedi. Kesin kanıt olmayan network arızası teşhisi yapılmadı.

## Açık sınırlar ve sonraki sprintler

V4.3c:tedarikçi iadesi,ek edinim giderleri/KDV ve sayfalama/filtre kapsamı ayrıca tasarlanmalı. V4.5:kalıcı inventory profile yönetimi,çoklu fiziksel paket,geometrik kesim/remnant,üretim sarfı/çıktısı ve fire. Transfer/count/freeze/issue API'leri bu teslimde çalışmıyor;aynı kilit sırası,negatif stok ve deferred kaynak doğrulaması genişletilmeden açılamaz. Reversal şu an tam receipt batch'idir;gelecekte bağımlı transfer/sarf varsa önce bağımlılık guard'ları eklenmelidir.

Listeler200ile sınırlı;depo hiyerarşisi/pasifleme ve daha büyük veri için pagination açık. Farklı karmaşık komut yarışlarında deadlock/timeout atomik ret olabilir;sınırsız retry yoktur. Fiziksel uygunluk operatörün tek-rulo/parti teyididir;genel kesme optimizasyonu değildir. Tüm bunlar yerel kabulün kapsam sınırıdır;cloud/production-ready veya bağımsız backup başarısı değildir.

[Ayrıntılı domain/API/migration sözleşmesi](../docs/architecture/V43B_INVENTORY_CONTRACT.md).

## Mimo'ya kesin teslim dosyaları

```text
LAST_REPORT.md
package.json
prisma/schema.prisma
prisma/migrations/202610210016_goods_receipts/migration.sql
scripts/auth/prepare-browser.ts
scripts/db/migrate.ts
scripts/purchases/verify.ts
scripts/suppliers/verify.ts
scripts/stock/migration-baseline.json
scripts/stock/migration-fixture.ts
scripts/stock/verify-local.ts
scripts/stock/verify.ts
src/components/cloud-desk.tsx
src/components/inventory-desk.tsx
src/lib/auth/catalog.ts
src/lib/cloud/receipt-contracts.ts
src/server/cloud/handler.ts
src/server/cloud/business/inventory.ts
tests/auth-e2e/local-isolation.ts
tests/auth-e2e/v43a.spec.ts
tests/auth-e2e/v43b.spec.ts
tests/receipt-contracts.test.ts
docs/architecture/V43B_INVENTORY_CONTRACT.md
research/PUSULA_V04_V43B_CODEX_REPORT.md
docs/validation/V04_V43B_VERIFICATION.md
```

25dosya. `.data`,fixture,env,sırlar,generated Prisma client,build/browser artifact'ları teslim edilmez. Codex commit/push/merge yapmadı;GitHub teslimi Mimo'ya aittir. Main/force-push/reset işlemi yok.
