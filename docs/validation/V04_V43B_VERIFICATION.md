# V4.3b — Yerel kabul doğrulaması

20.10.2026 · **V4.3b — LOCAL_ACCEPTANCE_PASS**

Bu sonuç gerçek Neon kabulü değildir. Yeni016yalnız yeni UUID/loopback PostgreSQL18.6 fixture'larında uygulandı. Mevcut Neon development/test/production,recovery/snapshot veR2'ye bağlantı veya işlem yapılmadı;gerçek PO-2026-9893 korunur. Cloud runner smoke'u DB bağlantısı oluşturmadan beklenen kapalı sonuçla durdu.

## Nihai kanıtlar

| Grup | Gerçek sonuç | Kanıt |
|---|---|---|
| Tam DB/RLS |11/11 |`v42-d399dace-5b59-4285-84fa-d8d5fb748343`|
| Auth |62/62 (C1 7,C2 9,C3 8,C4 11,C5 8,C6 6,C61 13) |Aynı tam fixture |
| Cloud API |11/11 |Aynı tam fixture |
| Supplier / PurchaseOrder |16/16 ve28/28 |Tam fixture ve son candidate'ta tekrar |
| Stock gerçek SQL/API |27/27 |Tam fixture;son candidate `v42-71074783-dd21-4ea7-87c3-0d85edcc6d48`|
|016 gerçek Prisma deploy |Pinli pre/post-schema47/33ve16migration |İki nihai fixture'da PASS |
| Browser |4/4 gerçek desktop/mobile Chrome |Son candidate71074783;v43a2/2+v43b2/2,1.0dakika |
| Vitest |368/368,30dosya |`.data/v43b/vitest-final.log`,exit0 |
| TypeScript |PASS,exit0 |`ts-accepted.log` |
| ESLint |0error/0warning,exit0 |`lint-accepted.log` |
| Production build |PASS,exit0;mevcut .data tracing pattern uyarısı |`build-accepted.log` |
| İlk15SQL |15/15checksum eşit;Git diff yok |`legacy-checksums.json` |
| Cloud guard |Beklenen BLOCKED,exit1,apply=false |`cloud-guard.log`;STOCK_MIGRATION_REQUIRES_SEPARATE_CLOUD_REVIEW |

Nihai fixture'lar `serverStopped=true` ile kapandı. Son candidate'ta AuthC2 9,Supplier16,Purchase28,Stock27vebrowser4kontrolü aynı izole cluster üzerinde koştu. Tam Auth/Cloud matrisi ayrı yeni cluster'da çalıştı;bu ayrım tek koşu gibi birleştirilmedi. Mock/saf testler Vitest'tir;ledger ve yarış sonuçları gerçek PostgreSQL/non-owner API sonuçlarıdır.

## Stock27kontrolünün kapsamı

| Alan | Doğrulanan senaryolar |
|---|---|
| Mal kabul |DRAFT stok0;tam,kısmi,birden fazla kısmi;gelen−ret,tam ret;DRAFT/CANCELLED PO ret |
| İdempotency |Aynı create key/payload aynıid;farklı payload409;post replay yeni lot/movement/balance üretmez |
| Atomiklik |Over-receipt'te receipt DRAFT kalır;lot/movement/batch/balance sayıları değişmez;ortada zorunlu SQL hatasında audit dahil birlikte rollback |
| Yarış |İki ayrı gerçek runtime bağlantısı ve farklı depolar;parent lock beklemesi gözlendi;1.5+1.5teslim/2siparişte biri commit,diğeri ret |
| Düzenleme/düzeltme |Versioned edit,stale ret,draft cancel;POSTED değişmez;tam negatif reversal,ikinci reversal ret,orijinal belge korunur |
| Ölçü |2m×152cm=3.04m²türetilmiş;otoritatif bakiye2m;sheet/piece tam sayı;fractional sheet ret;fazla precision ret |
| Kaynak |Yanlış PO line/activity/tenant/company ret;composite scope;ilk lot sonrası form/baseUnit değişimi ret |
| Yetki |Gerçek non-master role/OWN;başka aktörün receipt'i gizli ama toplam aşımı kapalı;geçerli kalan0.5teslim başarılı;ACTIVITY veexplicitDENY |
| SQL sınırı |Raw INSERT/UPDATE/DELETE/TRUNCATE veSET ROLE ret;eksik version/reason/lines ret |
| Finans |Donmuş PO snapshot;TRY FX aynen korunur;EUR/GBP nullUSD;manualVariantusdCost değişmez;receipt ve materials cost DENY DTO redaksiyonu |
| Mikro tutar |Dört adet0.000000001kısmi teslim×15.2USD;kümülatif9scale toplam bağımsız Decimal referansına eşit;GET miktarı scientific notation olmaz |
| Mutabakat |Movement signed delta toplamı bağımsızSQL SUM ileBalance'a eşit;negatif bakiye yok |
| Eski veriler |Başlangıçtaki PO/Line,MaterialVariant/PriceHistory,SupplierOfferVersion,CloudQuote/Sale/Line kimlikleri ve satır özetleri değişmedi |
| UI kaynak seçimi |Authorized receipt-orders kaynakları ve güncel kabul toplamı;ham conversion/price snapshot vevariantUsdCost dönmediği negatif kontrol |

Orta işlem hata enjeksiyonu yalnız yeni fixture'da geçici fail trigger'ı ile yapıldı;bu test trigger'ı kaldırıldı. Gerçek işletmede veri/trigger değiştirilmedi. Snapshot preservation için mevcut fixture satırları hedeflendi;yeni test kayıtları eklenmesi eski satır hash karşılaştırmasını maskelemedi. MD5 bu yerel karşılaştırmada değişiklik tespiti içindir;backup güvencesi değildir.

## Gerçek browser kanıtı

Her desktop/mobile senaryosuna ayrı sentetik tenant/account kullanıldı;credential'lar ignored şifreli fixture dosyasında. Chrome gerçek UI'da login/TOTP,PO oluşturma/onay regresyonu,depo oluşturma,onaylı PO seçme,kalan miktar,tek fiziksel paket teyidi,DRAFT kaydı,dirtyEscape reddi,INVALID_INPUT sonrasında taslağın korunması,focus geri dönüşü,step-up sonrası ikinci post tıklaması,POSTED/lot/3.04m²veF5sonrası tekrar erişimi doğruladı. Mobil document overflow kontrolü geçti. V4.3a smoke'u da desktop/mobile2/2geçti.

İlk realbrowser başarısızlıkları saklandı;başarılı son koşular önceki failure'ları PASS'a çevirmedi. Hiçbir test gerçek kullanıcı hesabı,TOTP,token veya gerçekNeon session'ı kullanmadı. MFA süre sonlandırma yardımcı fonksiyonu yalnız doğrulanmış yeni loopback marker ve@example.invalid fixture kimliği kabul eder.

## Migration ve güvenlik pinleri

016SHA-256:`4dc07f6a16c5d423b3dbafd06c377775212d728f701c5b3390a5dbb7cbbe5a89`.

| Post-schema kapsamı | SHA-256 |
|---|---|
| tables |9e91d98a786de1d9bcb7415224b4facf88c0c4c7ca6091ab03d0eb426c5f4ccd |
| columns |d278ceadd49988e4910a57fe1f7abf883e551d591c6de67d58c478ac3ff3e97c |
| constraints |337b2cdf056188340d7ce55f6089e1e64087cc1d08c090f67b343b05db70eb26 |
| indexes |d794f0746612930328dde340a32f1a3fb343a973c8dfd741dd5aa78234f8ada7 |
| policies |472ba0738c3a4b0f5d0512a23855f090d89790356f043f3177db51310289eced |
| triggers |2612b11034f380b45b0bc043adce20b25a2276f79dd9f182efded509b4b7fa95 |
| functions |fd4a5b1d52531b12a5f461f7b88b8de6965574f469e3e08a0713a75ea95b1d3b |
| types |d891fe9cc3ffd8303e957a2c4ca3173f607ffa7223e3374caa023d34cb30ba9c |

Pinler tek başına kabul sayılmadı;yukarıdaki gerçek DML/permission/race/ledger/rollback testleri ayrıca koştu. Executor NOLOGIN/NOBYPASSRLS/non-owner;runtime üyeliği/DML yok. SQL fonksiyonları ve trigger'lar .datafixture'da ölçülüp ayrı pinli fixture'larda doğrulandı. Ön pin önceki015appliedSchema'dır;ilk15migration ve eskibaseline değiştirilmedi.

## İlk başarısız koşuların kaydı

| Koşu/log | Sonuç / düzeltme |
|---|---|
| fixture-first /second |Prisma SQL delimiter failure;düzeltmenin ilk helper çalıştırması quoting hatasıyla uygulanmadı;sonra gerçekSQL düzeltildi |
| fixture-third |SQL/Prisma geçti;duplicate target marker wx fixture hatası |
| fixture-fourth /fifth |Supplier'ın tarihsel40table beklentisi ve child'a eksik stock flag'i |
| fixture-sixth |Executor pusula_can EXECUTE eksik |
| fixture-seventh |Generic trigger OLD.status alan hatası |
| fixture-eighth |15Stock temel kontrolü PASS |
| fixture-ninth |OWN scope test verisi scope_shape ihlali |
| fixture-tenth |Adversarial OWN gizli teslim toplamı hatası (yanlış200) |
| fixture-eleventh |Aşım409oldu;geçerli kalan teslimde deferred validator yanlış ret |
| fixture-twelfth /thirteenth |19ve22Stock kontrolü PASS |
| fixture-finance-finalmeasure |23kontrol PASS;mikro maliyet/decimal wire kapsamı |
| fixture-browser-third |Profile negatif testinde eksik SupplierMaterial version artışı |
| fixture-full-browser /browser-second |Browser1/4;kimlik/zamanlama ve picker/label sorunları |
| fixture-final-full |DB/Auth/Cloud/Supplier/Purchase/Stock26PASS;browser2/4 |
| browser-fourth |Browser3/4;desktop TOTP setup yanıtı/zamanlama açık |
| browser-final-frozen |Browser4/4;fixture44afbf65...kapandı |
| fixture-release-full |TamDB/Auth/Cloud/Supplier/Purchase/Stock27PASS;fixtured399dace...kapandı |
| final-acceptance |Son etiket whitelist/redaksiyon candidate'ı API27vebrowser4/4PASS;fixture71074783...kapandı |

TypeScript helper quoting hataları,ilk effect-setState lint hatası ve sandbox Vitest spawnEPERM de ilk loglarda tutuldu. SonTypeScript/lint/Vitest başarılı. Production build'de eski .data glob/rate-store tracing uyarısı sürer;derleme exit0. pg adapter concurrent-query deprecation uyarısı fixture loglarında görüldü;pg8kapsamında testler geçti,pg9geçiş kabulü sayılmaz.

## Açık kapılar ve teslim

Neon016apply,managed role/defaultACL/function incelemesi,güncel recovery/RPO ve ayrı kullanıcı onayı açık. Bağımsız R2 backup/restore veE2 definer/table kapsam engeli kapanmadı. Transfer,count freeze,sarf/remnant,çoklu paket ve yasal stok değerleme kabulü yok. V4.3c/V4.5ön koşulları [domain sözleşmesinde](../architecture/V43B_INVENTORY_CONTRACT.md).

Uygulama, migration, test ve belgelendirme dosyaları güncellendi;ilk15SQL ve gerçek bağlantı sırları korunur. `.env.local` yazılmadı. `.data/v43b`,UUIDfixture,private log/credential,generated client/build vebrowser artifact'ları teslim edilmez. Commit/push/merge yok.

[Codex raporu ve kesin25dosyalık Mimo teslim listesi](../../research/PUSULA_V04_V43B_CODEX_REPORT.md).
