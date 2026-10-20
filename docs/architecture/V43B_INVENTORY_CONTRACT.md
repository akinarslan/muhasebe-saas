# V4.3b — Mal kabul ve stok sözleşmesi

V4.1 model adları korunur: GoodsReceipt/Line,StockLocation,StockLot,StockPostingBatch,StockMovement,StockBalance. Bunlar yedi yeni tablo;local katalog47tablo/33FORCE RLS hedefidir. PO ticari belge,kabul fiziksel belge,Movement otoritatif ledger,Balance mutabık cache'dir. Eski `MaterialVariant.inStock` açılış bakiyesi sayılmaz;`usdCost` güncellenmez.

## Kaynak ve yaşam döngüsü

`APPROVED PO → DRAFT GoodsReceipt → POSTED → ayrı REVERSAL batch`. DRAFT düzenlenebilir/iptal edilebilir;POSTED belge ve lot/movement/batch değiştirilemez. Reversal header'ı değiştirmez;tam özgün hareket setine negatif kayıt ekler,bakiyeyi azaltır ve bir kez yapılabilir. Önceki kabul miktarını yeniden kullanılabilir sipariş bakiyesine dönüştürmez. Transfer/iade/sayım/sarf API'leri bu sprintte yoktur.

Gelen miktar pozitif,ret miktarı0..gelen;ret>0 gerekçe zorunlu. Kullanılabilir giriş=gelen−ret. Tam ret fiziksel belge/audit/batch olarak POSTED olabilir;lot/zero-delta movement üretmez. Eksik satırlı belge,geçersiz version veya gerekçesiz iptal SQL kapısında da reddedilir. Aynı create key+normalize payload aynıid;farklıpayload409. POSTED receipt post tekrarında yeni stok yok;reversal tekrarı409.

## Fiziksel otorite

- ROLL:tek fiziksel rulo/receipt satırı;otorite `linear_meter`,initialLengthM ve widthCm korunur. 152cm×2m=3.04m² yalnız türetilen alandır;ikinci stok değildir. Çok rulo için ayrı kabul belgeleri gerekir;uydurulmuş package bölüşümü yok.
- SHEET:tek ölçülü parti,otorite sheet,tam sayı;en/boy ve PO'nun donmuş alan faktörü eşleşmeli. PIECE:tam sayı adet. BULK:mevcut square_meter girdileri için aynı-birim alan girişi.
- kg/litre pricing/profil eşlemesi,ROLL'ün alanla satın alınmasından uzunluk çıkarımı ve kesilmiş/remnant geometri desteklenmez;uydurulmuş dönüşüm yerine ret. Mevcut CostUnit/ilk15 migration değiştirilmedi.
- numeric(24,9) miktarlar;uygun olmayan precision sessiz yuvarlanmaz. HTTP miktarları scientific notation yerine açık decimal string'dir. Görsel geometri Decimal60 ile türetilir;DB miktarı SQL numeric otoritesidir.
- V4.1 nullable Variant inventory profil kolonları yerine bu kesitte ilk immutable lotun form/baseUnit'i profil kilididir. Variant başına advisory lock ve executor'ın dar variant görünürlüğü sonraki lotta farklı form/birim girişini reddeder. Malzeme kataloğunu düzenlemek eski lot geometrisini değiştirmez. Kalıcı profil yönetimi/multiple-package dağıtımı V4.5 ön koşuludur.

## Fiyat ve redaksiyon

Lot edinimi mevcut PO line price/FX snapshot'ından türetilir;güncelkur fetch edilmez. TRY snapshot korunur,EUR/GBP doğrulanmamış USD null kalır. Original currency/unit price,purchase unit,stock base unit,USD stock-unit price ve kaynak/normalization bilgisi ayrı saklanır. Vergi/KDV/navlun/ek edinim bileşenleri dahil değildir;`taxTreatment` bunu açıklar. Manuel katalog `variantUsdCost` lot snapshot'ına taşınmaz.

`CUMULATIVE_HALF_UP_9_V1`:her kabulün tutarı,round((önceki kabul+bu kabul)×birim fiyat,9)−round(önceki kabul×birim fiyat,9). Böylece mikro kısmi teslimlerde yuvarlama artığı birikmez;tam teslimde toplam PO'nun yuvarlanmış fiyatına bağlanır. Para9scale önceki PO sözleşmesiyle uyumludur;V4.1 genelUSD6taslağından bu nedenle ayrılır. Edinim DTO'su receipts.costView **ve** kaynak materials.costView gerektirir;explicit DENY uygulanır. Stock.view miktar/geometry verir;finansal nested snapshot veya manuel katalog fiyatını vermez.

## Dar SQL kapısı

Runtime yeni tablolarda yalnız SELECT ve `v43b_command(text,jsonb)`,`v43b_order_received(uuid)` EXECUTE alır;ledger/cache/receipt raw DML veya executor üyeliği yok. Executor NOLOGIN,NOBYPASSRLS,non-owner,minimal grant,sabit pg_catalog/public search_path kullanır;PUBLIC EXECUTE revoke edilir. Trigger/function sahibi business tablo sahibi değildir. FORCE RLS superuser/BYPASSRLS tehdidini ortadan kaldırmaz;ayrı non-owner rol gerekir. [PostgreSQL RLS](https://www.postgresql.org/docs/18/ddl-rowsecurity.html),[definer/search_path/EXECUTE kuralları](https://www.postgresql.org/docs/18/sql-createfunction.html).

Caller tenant/actor argümanı vermez;mevcut scoped session context ve aktif Membership kullanılır. Bu,önceki sistemdeki sunucu içi shared trusted runtime sınırıdır;runtime credential'ı son kullanıcıya verilmez. MFA session kontrolü HTTP/server katmanında requireMfa ile yapılır;SQL fonksiyonu browser cookie/MFA kanıtı okumaz veya yeni Auth SELECT yetkisi almaz. Çalınmış runtime credential'ı için MFA garantisi iddia edilmez.

Receipt/PO/location satır kilitleri,variant advisory lock,source unique key,composite FK,CHECK,immutable trigger ve deferred completeness/cache kontrolü aynı transaction'ı korur. Posting sonunda receipt,lot,movement,balance,batch ve audit birlikte commit olur. User OWN görünürlüğünün kümülatif teslimi eksiltmemesi için yalnız executor içinde current PO'ya ait aggregate görünürlüğü kullanılır;raw receipt satırları kullanıcıya açılmaz. Deferred mutabakat action kapsamını ayrıca gözetir. Runtime INSERT/UPDATE/DELETE/TRUNCATE ve SET ROLE ile gate'i aşamaz.

Gelecekte transfer,count,return,consumption eklenirse aynı lokasyon/PO/lot/balance kilit sırası,count freeze,negatif stok kontrolü ve deferred doğrulayıcı genişletilmelidir. Mevcut receive/reverse dışı kind'ler kapalıdır. Karmaşık farklı komut yarışlarında deadlock/timeout atomik başarısızlık olabilir;otomatik sınırsız retry yoktur. Receipt post key/source ile sonuç tekrar sorgulanır;başka key ile kör stoklama yapılmaz.

## API ve izinler

Prefix `/api/cloud/workspace`:

| Kaynak | İşlem |
|---|---|
| receipt-orders |GET yetkili APPROVED kaynaklar,satırlar ve posted kabul toplamı |
| goods-receipts |GET liste/detail;POST draft;PATCH versioned draft |
| goods-receipts/:id/post |POST step-up+receipts.post |
| goods-receipts/:id/cancel |POST draft+version+gerekçe+receipts.cancel |
| goods-receipts/:id/reverse |POST step-up+gerekçe+receipts.reverse |
| stock/locations |GET stock.view;POST stock.locationsManage |
| stock/lots |GET miktar/lot/izinli edinim DTO |
| stock/movements |GET stock.movementsView;edit/delete yok |

Canonical receipts.view/create/edit/post/cancel/reverse/costView ve stock.locationsManage/movementsView eklenir. Mevcut stock.view kullanılır;legacy stock.receive/issue/adjust yeni action'lara eşlenmez. Seed yalnız MASTER;normal rol şablonları genişletilmez. create/edit/cancel taslak işlemleri post'a veya yetki bypass'a dönüşmez. Kaynak PO/Material/Supplier görünürlük izinleri de korunur.

Listeler200ile sınırlıdır;daha büyük işletme için pagination/filter ve remainingqty/lot detail ergonomisi ayrı geliştirmedir. Kod ilk fiziksel alım akışını açar;depo hiyerarşisi/pasifleme,geometrik parça kesimi ve üretim sarfı çalışıyor gibi gösterilmez.

## Yerel migration ve bulut kapısı

`npm run stock:test:local -- --approve-local-fixture --with-browser --purchase-browser` yalnız yeni UUID loopback PG18.6 cluster'ı oluşturur. İlk15checksum,016checksum,pre/post-schema ve gerçek non-owner testler korunur. `--measure-stock` yalnız izole fixture'da yeni SQL'in ölçüm çıktısını ignored dosyaya yazar;baseline'ı otomatik değiştirmez. Pinli kabul ayrı koşudur.

016 repository'de pending'dir;bulut runner yeni dosyayı görünce `STOCK_MIGRATION_REQUIRES_SEPARATE_CLOUD_REVIEW` ile bağlantıdan önce durur. Gerçek Neon apply prosedürü,managed executor/grant uyumluluğu,güncel recovery/RPO ve bağımsız backup/E2 definer denetimi ayrı inceleme/onay gerektirir. Backup allowlist35/21olarak fail-closed kalır;47/33ve yeni definer'lar otomatik kabul edilmez. Mevcut gerçek PO-2026-9893 bu sprintte okunmaz/değiştirilmez.
