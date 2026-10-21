# PUSULA V4.3b.8 ? NEON_COMPATIBILITY_BLOCKED

21.10.2026, SQL g?zlemi 22:49:17 T?rkiye saati (19:49:17.398Z). G?rev yaln?z kaynak incelemesi, provider GET ve development ?zerinde TLS do?rulamal? READ ONLY denetimidir. Migration uygulanmad?.

## Karar

**NEON_COMPATIBILITY_BLOCKED.** Mevcut development ?emas? ve temel grant yetkileri do?ruland?; fakat de?i?memi? 016 i?in yeni role fonksiyon sahipli?i devrinin gerekli SET ROLE ko?ulu do?rulanm?? de?ildir. PostgreSQL 18'in standart davran??? alt?nda mevcut session ayar? ve SQL bu ko?ulu sa?lamaz. Managed servis istisnas? varsay?lmad?, DDL ile test edilmedi. Cloud runner ayr?ca hen?z yoktur; yerel runner hem managed ACL profiline hem ger?ek migration ge?mi?ine do?rudan uygun de?ildir.

| Karar | Durum | Anlam? |
| --- | --- | --- |
| A. Managed role/ACL ?n ko?ullar? yeterince do?ruland? m?? | BLOCKED | CREATE ROLE ve mevcut nesnelere grant yetkileri var; yeni role SET/ownership ge?i?i ??z?mlenmeden t?m SQL i?in uyumluluk onay? yok |
| B. Pre-016 recovery g?venlik kap?s? kabul edilebilir mi? | PASS_WITH_LIMITATIONS | Tarihsel pre-016 ?ema ve kapsanan business verisi i?in kopya kan?t? kabul edilebilir; tam rol b?t?nl???, fiil? restore/cutover ve g?ncel provider mevcudiyeti i?in ko?ulsuz kap? kabul? yok |
| C. G?venli cloud runner haz?rl???na ge?ilebilir mi? | PASS_WITH_LIMITATIONS | Ayr? haz?rl?k ?al??mas?yla a?a??daki engelleri ??zmek m?mk?nd?r; bu karar runner haz?r veya apply yetkisi anlam?na gelmez |

## Ger?ek hedef ve salt okunur SQL kan?t?

Git dal? `feat/pusula-v030-neon-cloud`, HEAD `f56caed5eadb64e76304777f83477f1677c19d19`. Ba?lang??ta LAST_REPORT ve V4.3b.5?7 rapor de?i?iklikleri vard?; korundu. Uzak GitHub ref'i bu g?revde sorgulanmad?, commit/push yok.

Onayl? tek SQL hedefi: `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech:5432`, DB `pusula_development`, bilinen development branch `br-rough-darkness-ba6ow9zo`. Host/DB/URL rol allowlist'i ve ?nceki provider kimlik kan?t? kullan?ld?. Bu ko?unun g?ncel provider GET'i 401 oldu?undan branch e?lemesi yeni API kan?t? olarak sunulmuyor. Recovery, production veya test SQL ba?lant?s? a??lmad?.

A??k CA, sertifika ge?erlili?i, hostname/servername, `rejectUnauthorized=true`, minimum TLS 1.2 ve encrypted/authorized kontrol? ge?ti. Ba?lang?? `default_transaction_read_only=on`; `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`; lock 3s, statement 10s, transaction 30s. Sonunda ROLLBACK ve ba?lant? kapan??? do?ruland?. Advisory lock al?nmad?; DDL/DML/GRANT denemesi yap?lmad?.

| Ger?ek SQL ?l??m? | Sonu? |
| --- | --- |
| current_user / session_user | `neondb_owner` / `neondb_owner` |
| server_version | 18.6 (fd34222) |
| transaction/default read only | on / on |
| public tablolar / FORCE RLS | 40 / 26 |
| ?ema baseline | Sekiz kategorinin tamam? e?it |
| Migration history | 15 ba?ar?l?, unresolved 0; 008 i?in bilinen bir resolved rollback kayd? |
| Migration 015 | SHA `181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a` e?it |
| Migration 016 / executor | Uygulanmam?? / rol yok |
| Yeni tablo, v43b fonksiyon ve dokuz permission ?ak??mas? | Yok |
| MASTER tan?m? | Var; kullan?c? atama/Auth i?erikleri okunmad? |
| Di?er development oturumlar? / ?l??len di?er kilitler | G?zlem an?nda bo? |
| Event trigger / large object | Yok / yok |

Yerel 001?015 checksum 15/15 e?le?ir. 016 SHA `80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18` korunur. Kaynak koddan beklenen postflight 47 tablo / 33 FORCE RLS / 16 ba?ar?l? migration'd?r; bunlar ger?ek Neon postflight sonucu de?ildir.

Kayna??n ?ema hash'leri, migration history hash'i, ?l??len rol metadatas?, geni?letilmi? pusula tablo ACL hash'i ve yedi izinli business tablo count/digest'i V4.3b.7 kaynak tan?lamas?yla ayn?. PO-2026-9893 halen APPROVED, bir sat?r, 2 m ? 3.04 m?, USD 30.40; kapsaml? ili?ki kontrol? e?le?ti. Ham business sat?rlar? rapora yaz?lmad?. Auth/MFA/session i?erikleri okunmad?.

## Managed rol ve sahiplik engeli

`neondb_owner`: LOGIN, CREATEROLE, CREATEDB, REPLICATION ve BYPASSRLS true; SUPERUSER false. `neon_superuser` ?yeli?inde INHERIT/SET true. Bu managed y?netim yetkisidir; ger?ek superuser kabul edilmez. Public ?ema sahibi `pg_database_owner`; development DB sahibi neondb_owner oldu?undan actor public CREATE yetkisine sahiptir. T?m 40 public tablonun sahibi neondb_owner'd?r. Mevcut public fonksiyonlar da neondb_owner'a aittir. Kullan?lan dillerin kullan?m haklar? katalogda kaydedildi.

Actor'?n public tablolar i?in SELECT/INSERT/UPDATE/DELETE/REFERENCES/TRIGGER grant option sorgular?n?n t?m? true. `pusula_can(text,uuid,uuid,uuid,text)` i?in EXECUTE WITH GRANT OPTION true. Bu, mevcut nesnelere planlanan grant'lerin temel ?n ko?ulunu destekler. Gelecekte olu?acak role veya nesneye ger?ek DDL ba?ar?s? kan?t? de?ildir.

**Kritik:** `current_setting('createrole_self_grant')=''`. Migration sat?r 5'te executor'? yarat?r; actor'a executor SET ?yeli?i veren bir GRANT veya session self-grant ayar? i?ermez. Sat?r 385, 405, 426 ve 443 yeni role fonksiyon sahipli?i devreder. [PostgreSQL 18 ALTER FUNCTION](https://www.postgresql.org/docs/18/sql-alterfunction.html), yeni sahibe SET ROLE yap?labilmesini ve yeni sahibin schema CREATE yetkisini ister. SQL, ge?ici schema CREATE grant/revoke ad?mlar?n? i?erir; **SET yolu eksiktir**. [createrole_self_grant belgesi](https://www.postgresql.org/docs/18/runtime-config-client.html#GUC-CREATEROLE-SELF-GRANT), bo? ayar?n SET/INHERIT otomatik self-grant sa?lamad???n? a??klar. Otomatik ADMIN se?ene?i SET yerine ge?mez.

Standart PG18 kurallar?yla ilk ownership devrinin ba?ar?s?z olmas? beklenir. Bu bir DDL hata g?zlemi de?ildir; katalog + SQL + resm? kuraldan ??kar?md?r. Neon hook'lar?n?n bu yolu de?i?tirdi?ine dair yeterli kan?t yoktur. Devir sonras?ndaki REVOKE/GRANT ve executor-owned trigger fonksiyonlar? i?in actor'?n yetkileri de ayn? sahiplik yoluna ba?l?d?r. Bu y?zden yaln?z CREATEROLE=true ?zerinden PASS verilemez. Mevcut production/test rolleriyle SET ROLE denenmedi; hi?bir ?yelik de?i?tirilmedi.

[Neon rol belgesi](https://neon.com/docs/manage/roles) Console/API rollerinin managed neon_superuser ?yeli?ini ve SQL ile olu?turulan rollerin otomatik ayn? yetkiyi almad???n? anlat?r. Executor'?n gereksiz neon_superuser/BYPASSRLS ?yeli?iyle sorunu ??zmek g?venlik modeline ayk?r? olur; burada b?yle bir i?lem veya ?nerilen haz?r grant komutu yoktur.

## Uygulama rolleri ve yetki geni?lemesi

`pusula_runtime` ve `pusula_auth`: LOGIN true; SUPERUSER/CREATEROLE/CREATEDB/REPLICATION/BYPASSRLS false, public CREATE false; privileged ?st rol ?yeli?i yok. Owner bu roller ?zerinde ADMIN ?yeli?ine sahip, mevcut INHERIT ve SET se?enekleri false. Runtime'?n business DML, auth rol?n?n auth tablo ACL'leri katalogdan al?nd?; Auth sat?rlar? okunmad?. MASTER bir PostgreSQL y?netici rol? de?il, uygulama Permission/RolePermission tan?m?d?r.

016 yedi yeni tablonun tamam?nda runtime'a yaln?z SELECT, executor'a SELECT/INSERT/UPDATE/DELETE verir. Runtime'a executor ?yeli?i, schema CREATE veya do?rudan stok DML verilmez. Auth'a yeni stok yetkisi verilmez. Actor'a ait yeni nesneler i?in mevcut default ACL'de runtime/auth'a otomatik DML grant'i g?r?lmedi; cloud_admin'?n default grant'leri actor'?n default ACL'si olarak yorumlanmad?.

Executor'a mevcut Tenant/LegalEntity/Activity/Material/MaterialVariant/Supplier/SupplierMaterial/SupplierOfferVersion ve authorization tablolar?nda SELECT, PurchaseOrder/PurchaseOrderLine ?zerinde SELECT+UPDATE, AuditEvent ?zerinde SELECT+INSERT verilir. Bu ama?l? bir yeni yetki y?zeyidir; eski tablolara hi? dokunulmuyor denemez. UPDATE, `FOR UPDATE` kilitleri i?in de gerekir; immutable g?vence yaln?z ACL de?ildir, RLS ve kapal? fonksiyon y?zeyine dayan?r. MaterialVariant.usdCost i?in UPDATE grant'i yok. Mevcut runtime/auth rollerine eski nesneler ?zerinde yeni grant yok. Executor NOLOGIN/NOBYPASSRLS/non-table-owner tasar?m? ve ?yelik yasa?? korunmal?d?r; y?netici owner'?n BYPASSRLS yetkisi ?nceden vard?r.

## Yeni yedi tablo ve SECURITY DEFINER incelemesi

| Tablo | Kaynak SQL'de izolasyon ve yazma modeli |
| --- | --- |
| StockLocation | ENABLE/FORCE RLS; tenant/entity ve activity FK; stock.view / locationsManage; runtime SELECT |
| GoodsReceipt | ENABLE/FORCE RLS; tenant/entity/activity, composite PO/location FK; receipts izinleri; DRAFT durum/version gate |
| GoodsReceiptLine | ENABLE/FORCE RLS; composite receipt/orderLine FK; izin ve miktar/rejection CHECK; runtime SELECT |
| StockLot | ENABLE/FORCE RLS; composite receiptLine/variant FK; stock.view ve kontroll? executor i? okuma; insert-only lot |
| StockPostingBatch | ENABLE/FORCE RLS; composite receipt/reversal FK; tek posting ve tek reversal unique index; insert-only |
| StockMovement | ENABLE/FORCE RLS; composite batch/line/lot/location/variant FK; nonzero miktar, insert-only defter |
| StockBalance | ENABLE/FORCE RLS; composite lot/location FK; nonnegative cache ve deferred ledger mutabakat? |

Her tabloda permissive tenant/entity/user-context scope, restrictive SELECT ve restrictive executor write ko?ullar? birlikte bulunur. Activity/OWN k?s?tlar? `pusula_can` ?zerinden uygulan?r; activity her tabloda kat? e?itlik de?ildir (izinli entity-wide depolar ve actor/OWN kurallar? vard?r). Executor'?n order/variant context ile geni?leyen i? okumalar? tenant/entity scope'u kald?rmaz; uygulama kullan?c? yetkisi, command i?indeki op bazl? kontrollerle korunur. Context GUC'leri uygulama taraf?ndan do?rulanm?? oturumdan transaction-local kurulmal?d?r; DB credential sahibi sald?rgana kar?? ba??ms?z kimlik do?rulama mekanizmas? say?lmaz.

Yeni d?rt SECURITY DEFINER fonksiyonu `v43b_command`, `v43b_complete`, `v43b_order_received`, `v43b_receipt_outcome` executor-owned olacak ?ekilde yaz?lm??t?r. Yeni tablolar?n sahibi migration actor neondb_owner kal?r. `v43b_immutable` ve `v43b_net_received` SECURITY INVOKER/helper olarak actor-owned kal?r. Net helper yaln?z executor'a EXECUTE; command/order_received/outcome yaln?z runtime'a EXECUTE verir. T?m yeni fonksiyonlarda PUBLIC EXECUTE ayn? transaction i?inde REVOKE edilir. Deferred complete yaln?z trigger y?zeyidir. Executor'a ge?ici verilen public CREATE commit ?ncesi kald?r?l?r.

T?m yeni fonksiyonlarda `search_path=pg_catalog,public`. **pg_temp a??k?a sonda yoktur.** [PostgreSQL g?venli definer rehberi](https://www.postgresql.org/docs/18/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY), pg_temp'in a??k?a sonda olmas?n? ?nerir. ?ncelenen yeni g?vdeler uygulama relation/type ve helper referanslar?n? `public.` ile niteler; built-in fonksiyonlar pg_catalog ile ??z?l?r. Mevcut pusula_can kendi `public,pg_temp` yolunu kullan?r. Bu nedenle yaln?z pg_temp eksikli?inden do?rulanm?? bir temp-table exploit sonucu ??kar?lmad?. Buna ra?men ?al??ma zaman?nda malicious temp/type shadowing do?rulamas? bu g?revde yap?lmad?: PASS_WITH_LIMITATIONS; cloud haz?rl???nda a??k pg_temp-son s?zle?mesi ve sald?rgan fixture testi ayr?ca incelenmeli, SQL hash'i sessiz de?i?tirilmemelidir. Public CREATE yetkisi olan mevcut roller yaln?z y?netici d?zeyindedir; runtime/auth de?ildir.

MASTER'a eklenecek dokuz izin: receipts.view/create/edit/post/cancel/reverse/costView, stock.locationsManage, stock.movementsView. SQL'de permission ve rolePermission INSERT'leri tek transaction i?indedir; g?ncel katalogda ID ?ak??mas? yok. Yeni izinler t?m MASTER atamalar?n?n kapsam?na yans?r; bu a??k?a planlanan uygulama yetki geni?lemesidir. Mevcut pusula_can fonksiyon tan?m? ve TypeScript decide mant??? explicit DENY'? ALLOW ?st?nde tutar; MASTER bunu bypass etmez. Ger?ek kullan?c? override veya role assignment i?erikleri incelenmedi.

Maliyet DTO redaksiyonu `inventory.ts` i?inde receipts.costView ve kaynak material i?in materials.costView ko?ullar?n?n birlikte sa?lanmas?na dayan?r; acquisitionSnapshot ancak bu ko?ulla d?ner. Bu bir API s?n?r?d?r: runtime'?n StockLot SELECT hakk? acquisitionSnapshot s?tununu DB seviyesinde gizlemez. Runtime credential g?venli?i ?nemlidir; RLS sat?r izolasyonu maliyet s?tun redaksiyonu de?ildir.

Immutable trigger'lar lot/movement/batch UPDATE/DELETE/TRUNCATE'? reddeder, post edilmi? receipt'i ve sat?rlar?n? korur. Ayr? reversal hareketleri as?l defteri de?i?tirmez. Deferred complete trigger'? posting/header/ledger/cache b?t?nl???n? commit'te denetler. Idempotency, version kontrol?, PO?location?s?ral? order line/variant?lot/balance kilit s?ras? ve advisory transaction kilitleri kaynakta vard?r. Bunlar statik inceleme ve ?nceki yerel test kan?t?d?r; bu g?revde ger?ek Neon fonksiyonlar? yarat?lmad?/?al??t?r?lmad?.

## Transaction, kilit ve runner s?n?rlar?

016 a??k BEGIN/COMMIT i?erir; rol, tablolar, indeksler, policy/trigger/function/grant ve permission DML ad?mlar? PostgreSQL transaction'?nda geri al?nabilir. CREATE DATABASE, CONCURRENTLY veya haric? yan etki yoktur. 3s lock / 30s statement / 60s transaction s?n?r? SQL'dedir. Bu, COMMIT sonras? geri alma veya t?m Prisma history'sinin ayn? transaction'da geri al?naca?? garantisi de?ildir; engine ba?ar?s?z deneme kayd? b?rakabilir. Ger?ek Neon rollback provas? yap?lmad?.

Yeni tablolar ve indeksler yeni relation'larda kilit al?r. Mevcut LegalEntity, Activity, PurchaseOrder, PurchaseOrderLine, MaterialVariant composite FK hedefleridir; FK kurulumu hedefte SHARE ROW EXCLUSIVE t?r? kilit gerektirebilir ve yaz?larla ?at???r. Permission/RolePermission seed'leri row-exclusive/row kilitleri al?r; GRANT/sahiplik i?leri kataloglarla yar??abilir. [PG18 kilitler](https://www.postgresql.org/docs/18/explicit-locking.html) ve [CREATE TABLE](https://www.postgresql.org/docs/18/sql-createtable.html) esas al?nd?. ?l??len oturum/kilit bo?lu?u gelecekteki writers'? d??lamaz. K?sa bak?m penceresi, uygulama writer durdurma ve apply hemen ?ncesi tekrar g?zlem gerekir. Advisory 2142042 yaln?z bu protokole uyan runner'lar? seri hale getirir; uygulamay? dondurmaz.

`scripts/db/migrate.ts` 016 dosyas?n? g?r?rse `STOCK_MIGRATION_REQUIRES_SEPARATE_CLOUD_REVIEW` ile durur. `scripts/stock/migrate.ts` yaln?z kimli?i do?rulanm?? loopback fixture kabul eder, remote'a ba?lant? a?amaz. Bu kap?lar kald?r?lmad?. `stockSecurity` sadece SELECT yapan export olarak denetimde kullan?ld?; main/runStock/runPrisma/inspectStock ?al??t?r?lmad?.

Ger?ek stockSecurity pre hash'i `59252aa93cf52f7d087e066bcf7ab0b469cd1bd5cd57a372642ce2f7bb07c009`; yerel fixture pre pin'i `d54f91f77fcd5b3dcadaab534d3bd6f03fd581ed3afc72cec18641db45c20efa` ile farkl?. Bu do?rudan drift kusuru de?ildir; managed ve fixture ACL profilleri farkl?d?r. Yerel post pin'i Neon postflight diye kullan?lamaz. Ayr?ca inspectStock t?m history kay?tlar?n? finished ve not-rolled-back ister; ger?ek 008 resolved rollback kayd? bu kontrolle uyumsuzdur. History silme/resolve/normalize yap?lmad?. Gelecek runner yaln?z a??k?a do?rulanm?? resolved ge?mi?i checksum ve kay?t kimli?iyle incelemeli; genel ignore bayra?? olmamal?.

## Recovery, provider ve backup

Recovery `br-late-river-baeipun8` / `pusula-v43b6-pre-migration-016-20261021`, endpoint `ep-aged-flower-bauhc0to` korunur. Bu g?revde SQL ba?lant?s? yok. ?nceki capture 2026-10-21T15:51:53Z, LSN 0/38201C8; 015 ve kapsanan PO/business verisi kopyada do?rulanm??t?. G?ncel development'?n kapsanan digest/hash'leri tarihsel kaynakla ayn?; bu t?m DB veya ileri yaz?lar i?in RPO=0 de?ildir.

?nceki rol kan?t?: source 24/recovery 25, tek ek token_roles; di?er 24 rol ve ?l??len t?m kategoriler equalExcludingToken=true. token_roles NOLOGIN/NOBYPASSRLS/NOCREATEROLE/NOCREATEDB, ?yelik ve sahiplik ba??ml?l??? yok; PUSULA DB CONNECT yok, public CREATE yok. PUBLIC'den TEMP/USAGE ve s?n?rl? public EXECUTE etkinli?i vard?r. Mevcut rollerin haklar?na geni?leme ?l??lmedi. Rol?n sa?lay?c? k?keni h?l? bilinmiyor: **ROLE_DELTA_UNRESOLVED**.

Bu rol source development'ta yoktur ve 016 SQL'inde ad? ge?mez; tek ba??na source apply i?in somut bir SQL ba??ml?l?k engeli de?ildir. Restore sonras? tam rol fingerprint'ine dayal? runner kontrol?n? durdurabilir; gelecekte yeni membership/ownership/grant veya sa?lay?c? davran??? eklenmesi teorik risktir, mevcut kan?tta g?zlenmedi. Somut bulgu ek rol ve tam fingerprint fark?d?r; somut yetki s?z?nt?s? veya veri bozulmas? de?ildir. Kopya kapsanan pre-016 ?ema/veri kurtarma referans? olarak de?erlidir; ko?ulsuz restore/cutover ve tam authorization e?de?erli?i kabul? de?ildir. Rol fark? tek ba??na mutlak migration yasa?? kan?tlamaz, fakat bu g?revde ba??ms?z managed ownership engeli ve eksik runner/recovery operasyonel kan?tlar? nedeniyle g?venli apply karar? verilemez.

Provider ilk node GET denemesinde TLS/fetch seviyesinde yan?t alamad?; `--use-system-ca` ile TLS do?rulamas? a??k ikinci GET HTTP 401 d?nd?. Token yenileme veya ba?ka API mutation denenmedi. Yeni 5 branch/5 endpoint/1 snapshot ve haz?r kaynak iddias? bu ko?u i?in yok; bunlar V4.3b.7 tarihsel envanteridir. Production `br-autumn-union-baaldt81`, preview `br-patient-block-bald8u59`, eski recovery `br-broad-river-bavv5pey`, snapshot `snap-frosty-sky-bav0qeo6` i?in hi?bir de?i?iklik iste?i g?nderilmedi. G?ncel varl?klar? API ile yeniden teyit edilemedi.

Ba??ms?z R2 backup/restore sistemi operasyonel kabul edilmi? de?ildir. `scripts/backup/postgres.ts` allowlist'i 35 tablo/21 FORCE RLS; mevcut 40/26'y? ve gelecekte 47/33'? kapsamaz. Managed remote source/upload kap?lar? kapal?d?r. Yaln?z say?lar? de?i?tirmek; yeni verilerin i?erik, ACL/RLS, fonksiyon, rol, ?ifreleme/anahtar ve ger?ek restore kabul?n? sa?lamaz. Branch kopyas? ba??ms?z/off-provider backup de?ildir. Restore/finalize/cutover veya R2 i?lemi yap?lmad?.

## Kritik kontrol matrisi ve sonraki plan

| Konu | Durum | A??k s?n?r |
| --- | --- | --- |
| Yerel SQL b?t?nl???, ilk 15 checksum | PASS | 016 sabit SHA korunur |
| G?ncel development TLS/RO/40/26/15/015/016 pending | PASS | G?zlem an? i?in |
| Mevcut CREATE/schema/ownership/grant haklar? | PASS | Gelecek executor devir hakk?na e?it de?ildir |
| Executor SET ROLE / ALTER FUNCTION OWNER | BLOCKED | Standart PG18 ile eksik SET yolu; managed istisna kan?tlanmad? |
| Post-owner GRANT/REVOKE/trigger yetkileri | NEEDS_EVIDENCE | Yeni sahiplik/?yelik profiline ba?l? |
| RLS/FK/immutable/transaction tasar?m? | PASS_WITH_LIMITATIONS | Statik ve tarihsel yerel kan?t; Neon postflight de?il |
| SECURITY DEFINER / pg_temp / maliyet s?n?r? | PASS_WITH_LIMITATIONS | Qualified nesneler; pg_temp-son a??k de?il, maliyet API redaksiyonu |
| MASTER izinleri / explicit DENY | PASS_WITH_LIMITATIONS | Kaynak + permission metadata; ger?ek kullan?c? yetki senaryosu testi yok |
| Managed pre/post pin ve ger?ek ge?mi? kabul? | BLOCKED | Yerel hash farkl?; bilinen resolved 008 runner'a uyumsuz |
| Recovery kapsanan veri/?ema | PASS_WITH_LIMITATIONS | Tarihsel capture ve digest e?itli?i; restore tatbikat? yok |
| token_roles k?keni / tam rol e?itli?i | NEEDS_EVIDENCE | ROLE_DELTA_UNRESOLVED |
| G?ncel provider kaynak envanteri | NEEDS_EVIDENCE | GET 401 |
| Bak?m penceresi / writers durdurma | NEEDS_EVIDENCE | Anl?k bo? oturum gelecekteki bo?lu?u kan?tlamaz |
| Ba??ms?z R2/47-33 restore kabul? | BLOCKED | 35/21 allowlist ve remote kap?lar? |

Sonraki ayr? haz?rl?k ?al??mas?: (1) provider read eri?imini yeniden i?ler h?le getirip korunan kaynaklar?n mevcut oldu?unu GET ile teyit et; (2) SET/ownership ve devir sonras? grant zincirini Neon'un resm? a??klamas? veya ayr?ca yetkilendirilmi? izole do?rulama yoluyla ??z; (3) g?venli ??z?m SQL/session/runner de?i?ikli?i gerektirirse ayr? incele, checksum/pin zincirini g?ncelle, asla mevcut 016'y? sessiz de?i?tirme; (4) managed pre profili ve post invariant'lar? i?in ayr? fail-closed cloud runner tasarla, resolved 008 ge?mi?ini ?zel olarak ele al; (5) definer pg_temp, maliyet ve sald?rgan context/deny testlerini yerel fixture kan?t? olarak ?al??; (6) recovery rol fark? ve restore runbook s?n?rlar?n? ayr? kabul karar?yla belgele; (7) bak?m/RPO ve hemen-?nce preflight'? planla. Ger?ek Neon apply i?in ayr?ca a??k kullan?c? onay? gerekir.

Yerel sanitized kan?tlar `.data/recovery-v43b8/` alt?nda `development.json`, `provider.json`, `summary.json`, `preservation-before.json` ve denetim yard?mc?lar?d?r; Git teslimine al?nmaz. ?nceki `.data/recovery-v43b7` kan?tlar? de?i?tirilmedi. Test/build veya yerel fixture ko?usu yap?lmad?; ge?mi? 20/36/379 testleri yeni cloud kan?t? gibi sunulmad?.

GitHub teslimine haz?r bu g?rev dosyalar?: `research/PUSULA_V04_V43B8_NEON_COMPATIBILITY.md`, `docs/validation/V04_V43B8_VERIFICATION.md`, `LAST_REPORT.md`. ?nceki V4.3b.5?7 dosyalar? ayr?ca korunur. Migration/source/env dosyalar? de?i?medi; commit/push/merge, rol/ACL mutation, yeni branch/endpoint/snapshot, production/test/recovery SQL, restore veya R2 i?lemi yoktur.
