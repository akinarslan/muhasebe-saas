# PUSULA v0.4 — Sprint V4.2c.1 / Tam teslim raporu

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `225cd7a`.

**Yerel geliştirme ve kabul tamamlandı. Gerçek Neon migration uygulaması BLOCKED; ayrıca onay gerekir.**

Bu dosya teknik raporun, doğrulama kanıtlarının ve operatör prosedürünün eksiksiz birleşimidir. Yeni test veya işlem gerçekleştirildiği anlamına gelmez. Commit/push yapılmadı. Önceki teslimdeki14 dosyaya ek olarak yalnız bu tam rapor oluşturuldu; böylece bu sprint için Mimo inceleme listesi15 dosyadır. Önceki V42B/V42C raporları ayrıca korunur.

---

## Teknik karar ve güvenlik değerlendirmesi

# PUSULA v0.4 — V4.2c.1 migration güvenliği

19.10.2026 · `feat/pusula-v030-neon-cloud` · uygulama HEAD `225cd7acb66257e800b2e09b2bbf8a0412cc31e1` korunur.

## Sonuç

Runner geliştirmesi ve yerel kabul tamamlandı. **Gerçek Neon migration'ı BLOCKED:** kesin kurtarma noktası/topology ve diğer DB'leri koruyan uygulanabilir kurtarma yolu hâlâ kanıtlanmadı. Yeni014 hash'i sonraki canlı salt okunur denetim ve açık uygulama onayında esas alınmalı. Bu sprintte gerçek Neon'a bağlantı, migration, rol/grant, dump/R2 veya restore işlemi yoktur. [Operatör prosedürü](../docs/operations/SAFE_MIGRATIONS.md) · [gerçek test kanıtı](../docs/validation/V04_V42C1_VERIFICATION.md).

## Korunan başlangıç

Başlangıç dalı doğru, HEAD225cd7a idi. Önceki LAST_REPORT/V42B/V42C belge değişiklikleri korundu. ROADMAP/ARCHITECTURE'ın18.10 sözleşmesi, veri modeli/domain servisleri, yetkilendirme ve backup belgeleri incelendi. Eski13 migration, mevcut modüller, Master/MFA, gerçek env, demo ve backup guard kaynakları değiştirilmedi. Stage/commit/push/fetch/merge yapılmadı.

## Runner'da değişen davranış

- Varsayılan komut yalnız preflight; `--apply` olmadan deploy yok. Development için ayrıca hedef/restore-review/Master yetki genişlemesi onay bayrakları gerekir. Bayraklar operatör beyanıdır; kurtarma doğrulaması sayılmaz.
- Exact direct development endpoint/DB/owner, production reddi, verify-full girdi/CA/hostname doğrulaması. Branch kimliği mevcut endpoint allowlist'iyle bağlanır; bağımsız Neon API branch keşfi yapılmaz.
- Test yalnız yeni UUID/loopback marker ve fixture_admin; mevcut Neon test DB kabul edilmez. Test negatifleri yanlış DB/host/pooler/rol/production/TLS/query/fragment sınırlarını kapsar.
- Yerel SQL byte checksum pinleri; uygulanan başarılı history eşleşmesi; unresolved/unknown/duplicate history reddi.008'in eski resolved rollback kaydı silinmeden kabul edilir. Bu yorum backup guard'larını değiştirmez.
- Önce/sonra exact PG18 tablo/kolon/type/default/constraint/index/RLS/policy/trigger/function/enum fingerprint'leri; uzak rol/üyelik/default ACL/eski tablo hakları için ayrı pin. Beklenmeyen schema/relation/extension/event trigger ve izin farkı durdurur.
- Runner başına advisory lock; benzersiz Prisma application_name. Child hata/timeout'unda yalnız kendi backend'lerini sonlandırma ve kapandığını kontrol; raw stdout/stderr bastırma; güvenli hata ve gerçek kısmi schema durumu raporu.
- Başarılı geçmiş+postflightta tekrar deploy edilmez; ALREADY_APPLIED. Yeni unresolved failure operatör incelemesi olmadan retry edilmez. Otomatik migrate resolve/metadata düzeltme/restore yok.

## Timeout kanıtı ve sınırları

014 transaction'ı artık3s lock,30s statement,60s transaction limiti koyar; child toplam90s. Gerçek Prisma subprocess normal uygulaması1.482s idi. Parent kilidi3s beklemeden sonra kesildi (engine açılışı dahil4.485s); pg_sleep31,30s statement limitine takıldı (toplam31.452s).4s test child limiti4.031s'de kendi migration backend'ini kapattı. Ayarlar PGOPTIONS'ın miras alındığı varsayımıyla değil SQL'in içinde gerçek server oturumuna uygulanır.

60s transaction_timeout komutu gerçek014'te çalıştı; ayrı60 saniyelik transaction-timeout negatif koşusu yapılmadı. Node toplam limitinin normal90s değeri kadar beklenmedi; aynı mekanizma4s injection ile doğrulandı. Bunlar boş yeni tablolara yönelik development limitleridir; büyük production/backfill performans garantisi değildir.

Prisma, explicit transaction içindeki ilk timeout'tan sonra history/log yazarken “transaction aborted” hatasını öne çıkardı. Bu nedenle ham Prisma çıktısından kesin timeout nedeni iddia edilmedi; sentetik PostgreSQL server logu timeout nedenini doğruladı. Runner güvenli FAILED +35 tablo/Supplier0/unresolved1 raporladı. Kısmi autocommit CREATE+division-by-zero testi ayrıca fiziksel nesne bıraktı ve retry engellendi; bütün migration'ların otomatik atomic olduğu varsayılmadı.

## TLS kabulü

Prisma'nın require+strict+server CA köprüsü yeni yerel PostgreSQL TLS fixture'ında gerçek engine ile sınandı: doğru CA kabul, yanlış CA ret, güvenilir fakat yanlış hostname sertifikası ret. Sentetik1 günlük sertifikaları mevcut Git OpenSSL3.5.7 üretti; private dosyalar yalnız ACL korumalı Git dışı UUID fixture'dadır. Remote TLS guard gevşetilmedi. Bu kanıt gerçek Neon sertifika/engine oturumunun bugün yeniden test edildiği anlamına gelmez; sonraki onaylı preflightta gerçek CA kontrolü gerekir.

## Migration014 revizyonu ve izin etkisi

Eski014 hash `880cda78821cfe4b7b11484e70dc73c0d4ab2ad57a4ad0c3006d67587ac2bbc7` artık yeni uygulama onayı için kullanılamaz. Son dosya SHA-256:

`0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`

Değişiklik: üç SET LOCAL ve açıklama; yeni Supplier tablo/function grant'lerinden pusula_test_runtime kaldırıldı; SQL LF sabitlendi. Geri kalan tablo/FK/CHECK/RLS/trigger ve Permission/Master mantığı korunur. `.gitattributes` tüm SQL migration checkout'larını LF'ye sabitler; eski13 dosyanın içerik hash'i değişmedi.

Yeni tablo sayısı38, FORCE24; üç tablo, SupplierUnit,9 FK,3 CHECK,3 PK+11 explicit indeks,11 policy,4 trigger,2 invoker function. Eski iş/Auth satırlarına DML yok; Permission/RolePermission INSERT'leri vardır. Sekiz Permission oluşturulması ve MASTER'a atanması **ayrı güvenlik olaylarıdır**, fakat014 aynı transaction'da her ikisini yapmaya devam eder. Yeni anahtarlar suppliers.view/create/edit, supplierMaterials.manage, supplierOffers.view/create/history/costView. MASTER şablonundaki mevcut üyeler yeni eylemleri alır; gelecekte normal roller için ayrı onaylı atama gerekir. Bu görev Master hesabını/üyeliğini/MFA'yı değiştirmedi.

Normal rol/override, tenant ve scope genişletilmez. Explicit DENY `pusula_can`/server policy'de korunur. Fiyat alanlarının gizliliği supplierOffers.costView VE material costView ile server DTO'dadır; RLS sütun maskelemez. İki tenant/company/activity, maliyet redaksiyonu ve izin iptali sonrası erişim reddi Supplier16/16 regresyonunda doğrulandı. Yetki bypass veya ortak DB credential kompromisine karşı yeni DLP iddiası yoktur.

Development SQL yalnız pusula_runtime'a Supplier/Link SELECT/INSERT/UPDATE, Offer SELECT/INSERT ve iki invoker function EXECUTE verir. PUBLIC tablo/EXECUTE COMMIT öncesinde kaldırılır; auth erişimi yoktur. **Test rolü development CONNECT istemez ve açılmaz.** Fixture gerekli test grant'lerini yalnız kendi yeni cluster'ında ayrı kurar. Gerçek Neon runtime/auth/test rollerine hiçbir işlem yapılmadı.

## Veri ve fixture sınırları

Yeni cluster yalnız127.0.0.1, SCRAM, ayrı UUID data dizini; service/PATH değişimi yok. İki hayalî tenant/Auth/müşteri/malzeme/fiyat geçmişi/ürün/quote/sale/line kaydı negatif senaryolardan önce oluşturuldu. Eski10 tablonun tüm sentetik satır JSON hash'leri tüm failure/reset/normal migration dizisinden sonra aynı kaldı; hash'ler ve snapshot'lar yalnız fixture kanıtında, gerçek kayıtlar kullanılmadı.

Negatifler arasında yalnız fixture'ın yeni failed014 satırları DELETE ve synthetic_partial_migration DROP ile açıkça resetlendi. Bu, gerçek DB için önerilen recovery/resolve prosedürü değildir. Gerçek008 rollback geçmişi hiçbir şekilde değiştirilmedi. Bütün kullanılan fixture sunucuları kendi PID/exe/data kimliğiyle durduruldu; dosyalar özel Git dışı yerde kaldı. Fixture kanıtının gerçek Neon verisi korumasını tek başına sertifikalandırdığı söylenmez.

## Kurtarma kararı ve sonraki kapılar

Operatör gözlemi Free/development, history arayüzü mevcut,6 saat, en eski tarih19.10.2026; kesin saat bilinmiyor; snapshot/otomatik snapshot yok. Gerçek restore yapılmadı. Bu, panel beyanıdır; bağımsız API veya kurtarma tatbikatı değil. [Neon restore belgesi](https://neon.com/docs/postgres/backup-restore/branch-restore) branch çapındaki etkiyi ve root-branch şartını açıklar. Diğer DB'leri etkileyen restore mevcut yetki sınırlarını aşar; önceden ayrıca plan/onay gerekir.

Migration öncesi kesin UTC+İstanbul zaman/uygunsa LSN ve gerçek seçilebilir kapsam, root/child durumu, diğer DB envanteri ve erişebilen operatör doğrulanmalı. Pencere kayan ve değişim boyutuyla sınırlıdır; altı saati garantili kurtarma süresi saymayın. Aşıldığında hazır bağımsız arşiv/snapshot/izole kopya yoksa garantili yol yoktur. [Fiyat sayfasındaki](https://neon.com/pricing) Free snapshot/branch kotaları, veri kapsamı ve olası storage/compute kullanımı Console'da kontrol edilmeden yeni kopya ücretsiz varsayılmaz. Bu sprint yeni kaynak oluşturmadı.

Kurtarmada Auth/Master/MFA da tarihsel PostgreSQL verisidir: yeni parola/MFA/oturum/rol değişiklikleri kaybolabilir. Önce/sonra güvenli sayım+ilişki/rol/RLS mutabakatı ve yetkili kontrollü giriş, gerekirse ayrıca onaylı session iptali gerekir. Hassas Auth/MFA içeriği loglanmaz. Additive failure otomatik restore tetiklemez; kod/modül kapatma, read-only inceleme ve veri kaybetmeyen forward fix önce değerlendirilir.

Gerçek migration için kalanlar: yeni hash ile canlı read-only kontrol; kurtarma kanıtı ve diğer DB izolasyonu; bakım/yazma durdurma; güncel kayıt baseline'ı; yeni014+MASTER genişlemesi+runtime grant için açık kullanıcı onayı. Sonra38/24 exact postflight, eski veri mutabakatı ve ayrı fonksiyonel kabul. Bu kapılar açıkken **gerçek migration onayı istenip çalıştırılmaz; BLOCKED korunur.**

Sprint E35/21/enum/function/TOC ve legacy archive uyumu ayrı incelemedir. Gerçek backup rolü/TEMP/CONNECT/builtin ownership, kalıcı key ve kurtarma kopyaları, gerçek R2 yedek/readback/restore ve production işletimi açık kalır. Hiçbir guard otomatik genişletilmedi.

## Mimo'ya teslim

Bu sprint: `.gitattributes`, `prisma-safe.config.ts`,014 SQL, `scripts/db/migrate.ts`, `migration-safety.ts`, `migration-baseline.json`, `verify-migration-fixture.ts`, `verify-migration-tls.ts`, `scripts/suppliers/verify-local.ts`, `tests/migration-safety.test.ts`, bu rapor, SAFE_MIGRATIONS, doğrulama raporu ve LAST_REPORT. Önceki untracked V42B/V42C raporları ayrıca korunur; yeni kod kapsamı gibi sunulmaz. Mimo diff/hash/secret kontrolünden sonra normal commit/push ve ayrı gerçekleşmiş `.md` teslim raporu yapar. Codex bunları yapmadı; `.data`, env, keys, credentials, generated/build çıktıları teslim dışıdır.

---

## Gerçek test kanıtları ve doğrulama sınırları

# V4.2c.1 — gerçek yerel migration güvenliği kanıtı

19.10.2026 · feature dalı · HEAD225cd7a korunur · **yerel kabul PASS; gerçek Neon migration BLOCKED**.

## Sonuçlar

| Kontrol | Sonuç |
| --- | --- |
| TypeScript | PASS |
| ESLint | PASS,0 hata/uyarı |
| Build | PASS, Next16.4.1; mevcut geniş .data rate-store pattern uyarısı sürer |
| Vitest | **317/317**,26 dosya,17.44s; önceki297 +20 migration history/target testi |
| Gerçek Prisma migration güvenliği | **14/14** yerel senaryo, tam fixture |
| DB/RLS | **11/11**, yeni yerel cluster |
| Auth/API | **62/62** (7+9+8+11+8+6+13), sentetik hesap/yerel mail taşıyıcısı |
| Cloud/DB | **11/11**, yeni yerel cluster |
| Supplier DB/API | **16/16**, iki tenant/activity, cost DENY ve izin iptali dahil |
| Gerçek Prisma TLS | Doğru CA PASS, yanlış CA/hostname ret PASS; ayrı yerel sentetik sertifikalar |
| Playwright | Bu sprint yeniden çalıştırılmadı; UI değişmedi. Önceki28/28 tarihsel kanıttır. |
| Gerçek Neon SQL/dump/R2/restore | **YOK** |

Tam son fixture **v42-6b2d004f-d7c9-4456-b5d5-4788fd6924a3**,127.0.0.1:55432, PostgreSQL server/initdb/pg_ctl18.6, PID33188, statusPASS/serverStopped=true. Kanıt: Git dışı aynı dizindeki `verification.json`, `migration-safety.json`, `post-schema.json`, `partial-failure.json` ve test logları. Normal014 süresi1.482s; son SQL hash `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`.

TLS tamamlayıcı **v42-71ca8465-c333-45f1-86b0-56130145c285**, statusPASS/serverStopped=true. OpenSSL3.5.7; yeni private test cert/key dosyaları. Gerçek Prisma doğru CA ile bağlandı; yanlış CA ve doğru CA'ya rağmen hostname uyuşmazlığı reddedildi. Normal migration/old-content/no-replay/permissions ve AuthC2 9/9+Supplier16/16 bu fixture'da da geçti. Bu hızlı tamamlayıcı lock/statement negatiflerini tekrar koşmadı; onları tam fixture kanıtlar.

## Gerçek14 senaryo

1. PG18 exact35/21 baseline ve katalog pinleri.
2. Yanlış uygulanmış checksum reddi.
3. Beklenmeyen Customer kolon drift reddi.
4. Gerçek runner→Prisma child altında parent lock timeout; FAILED raporu35 tablo/Supplier0/unresolved1.
5. Aynı unresolved history ile retry reddi.
6. Gerçek child SQL'ine enjekte edilmiş pg_sleep31 için30s statement timeout; üç yeni tablo kalmadı.
7.4s toplam child timeout,4.031s; yalnız kendi tag'li backend'i sonlandırıldı, aktif oturum kalmadı.
8. Transaction dışı CREATE+division-by-zero; fiziksel kısmi tablo gerçekten kaldı.
9. Kısmi uygulama sonrası retry reddi; gerçek schema durumu dosyaya raporlandı.
10. Asıl014'ün gerçek Prisma deploy ile başarılı uygulanması.
11. Negatifler öncesindeki iki tenant'ın10 eski Auth/iş tablosunun tüm sentetik içerik hash'leri aynı.
12. Başarılı014'e ALREADY_APPLIED; yeniden deploy yok.
13. Yeni Supplier nesnelerinde auth/test role grant'i yok; runtime DELETE/TRUNCATE ve PUBLIC hakları yok.
14. MASTER için sekiz yeni bağlantının ayrı gözlemi.

Unit20, yanlış development/test/production/host/pooler/role/TLS/query/fragment ve history durumlarını ağsız kontrol eder. Rol/grant/TLS testleri backup kontrollerinin yerine geçmez.

## Başarısız denemeler ve kanıt sınırı

İlk baseline üretimi sandbox esbuild spawnEPERM nedeniyle başlamadı; izinli yerel çalıştırmayla tamamlandı. İlk fixture denemelerinde Prisma'nın transaction-aborted mesajı asıl timeout'u maskeledi; `_prisma_migrations.logs` üzerinden beklenen timeout metni bulunmadı. Bu denemeler PASS sayılmadı. Sonrasında PG server logu yalnız boolean timeout kanıtı olarak kullanıldı; raw stderr dışarı verilmedi.

İlk negatifler sonrası sentetik LegalEntity seed kolon hatası düzeltildi. Fixture içinde main çağrısında gerçek env yüklenmesini önlemek için local marker varsa env yükleme kapatıldı. Kilit ilk aşamada preflight metadata sorgusunu da beklettiği için fixture hook'uyla preflight sonrasında alınacak şekilde düzeltildi; bu hook yalnız local test hedefinde kabul edilir. Bunlar gerçek Neon hataları değildir. Bütün başarısız fixture'ların kendi serverStopped=true kayıtları tutuldu; hiçbiri başarılı toplam içine alınmadı.

Timeout failure'ında014 DDL transaction'ı rollback oldu; Prisma failed-history satırı ayrı kaldı. Testler arasında failed014 satırları ve synthetic_partial_migration yalnız bu yeni test cluster'ında açık reset ile kaldırıldı; migrate resolve kullanılmadı. Gerçek geçmişe/008'e işlem yapılmadı.60s transaction-timeout negatifinde60 saniye beklenmedi; komut başarılı014'te yürütüldü. Child90s mekanizması4s test limitiyle kanıtlandı. Büyük DB/üretim performansı ölçülmedi.

Post-schema pinleri PG18'in gerçek yerel kataloglarından üretildi ve baseline manifest'ine incelenmiş hash'ler olarak eklendi; runtime otomatik enroll yoktur. Remote privilege pinleri önceki onaylı development metadata snapshot'ından gelir. Bu sprint yeni Neon bağlantısı açmadığı için güncel uzak izin/TLS/topology kabulü iddia edilmez.

UI kaynakları değişmedi. Build geniş .data uyarısı, pg/NO_COLOR ve beklenen negatif Auth HTTP test kayıtları var; sıfır sunucu log hatası iddiası yoktur. Browser/Safari/Firefox/ekran okuyucu sertifikasyonu yapılmadı.

## Uygulama ve kurtarma kapıları

Gerçek development14 pending kabulü, yeni dosya hash'i ve güncel kayıt/ACL baseline'ı yeniden read-only doğrulanmalı. Console operatörünün Free6 saat bilgisi gerçek restore kanıtı değildir. Kesin tarih-saat/LSN, root/child, diğer DB etkileri, Auth/MFA koruma mutabakatı ve kullanılabilir kurtarma yolu açık kalır. Bağımsız R2, dar backup rolü ve production kabulü yok. [Teknik karar](PUSULA_V04_V42C1_MIGRATION_SAFETY.md) · [Komut ve kurtarma prosedürü](../docs/operations/SAFE_MIGRATIONS.md).

Codex stage/commit/push yapmadı. Git dışı fixture'lar, private TLS keys, ortam/bağlantı sırları Mimo teslim listesine girmez. Son sır/diff/işlem kimliği kontrolleri teslimde ayrıca doğrulanır.

Son teslim kontrolü:14 ilgili dosyada yapılandırılmış yerel sırlar ve URL parola bileşenlerine karşı tarama PASS;5 yerel belge bağlantısı ve14 migration manifest hash'i PASS. Git diff whitespace kontrolü PASS, index boş, HEAD225cd7a ve feature dalı değişmedi. Bağımsız son CIM/port sayımı: fixture postgres0, schema-engine0,55432 listener0. Yeni helper/TLS dosyaları dahil son Next build de PASS; geniş .data uyarısı sürer. Src/schema/package/backup kaynaklarında bu sprint diff'i yoktur; ilk13 SQL hash'i korunur.

---

## Operatör komutları ve kurtarma prosedürü

# Güvenli migration — V4.2c.1 operatör prosedürü

19.10.2026. Bu runner yalnız incelenmiş13 migration üzerine `202610190014_supplier_catalog` uygular. Genel bootstrap veya production runner değildir. **Gerçek development uygulaması kurtarma kapısı ve ayrı kullanıcı onayı bekler.**

## Hedef ve çalışma kipleri

`scripts/db/migrate.ts` varsayılan olarak yalnız preflight yapar. `--apply` olmadan Prisma deploy başlatılmaz. Production NODE_ENV, yanlış direct host/branch endpoint'i, pooler, yanlış DB/rol, URL fragment/ek seçenek ve doğrulanmamış TLS girdisi reddedilir. Development rolü yalnız neondb_owner'dır; runtime/auth kullanılamaz. Test modu yalnız UUID marker ile yeni127.0.0.1 fixture'ı kabul eder; mevcut Neon test DB reddedilir. Marker/dizin/port/rol guard'ları korunur.

Operatör URL'si `sslmode=verify-full` içermelidir. Node preflight mevcut CA ve hostname doğrulaması yapar. Prisma engine'in farklı URL sözlüğüne yalnız config içinde `sslmode=require` + `sslaccept=strict` + absolute server CA yolu ile çevrilir; bağlantı/TLS zorunluluğu ve hostname doğrulaması korunur. Operator env dosyası değiştirilmez. [Prisma engine TLS parametreleri](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql). Bu köprü gerçek yerel Prisma+TLS pozitif/negatif testine tabidir; gerçek Neon engine bağlantı kabulü ayrıca ölçülmelidir.

```powershell
# Read-only katalog preflight; migration yapmaz.
node --use-system-ca --import tsx scripts/db/migrate.ts
```

Bu sprintte yukarıdaki komut gerçek Neon üzerinde çalıştırılmadı. Preflight oturumu yalnız runner eşzamanlılık advisory lock'ı alır, metadata sorguları READ ONLY transaction içindedir; session sonlanınca advisory lock bırakılır. Runner dışındaki schema değişikliğine karşı bakım penceresi hâlâ gerekir.

```powershell
# YALNIZ gelecekte ayrı gerçek uygulama onayı ve kurtarma kapısı tamamlanınca:
node --use-system-ca --import tsx scripts/db/migrate.ts --apply --approve-development --recovery-reviewed --confirm-master-permissions
```

Bu bayraklar operatör beyanıdır; restore başarısını otomatik ispatlamaz. Bu belge veya kodun varlığı kullanıcı onayı yerine geçmez. Mevcut “db:migrate” alışkanlığı değişmiştir: flagsiz çağrı artık deploy yapmaz; `--test` mevcut Neon test DB'yi açmaz. Bu davranış kasıtlıdır.

## Checksum ve drift

`migration-baseline.json`14 SQL dosyasının byte hash'ini, PG18 yapısının önce/sonra fingerprint'lerini ve development rol/üyelik/default ACL/eski tablo efektif hak fingerprint'lerini taşır. Fingerprint'ler runtime'da otomatik yenilenmez. Yeni migration, eski checksum farkı, unresolved failure, duplicate successful history, beklenmeyen nesne/kolon/default/index/FK/policy/trigger/function/enum veya uzak izin farkı işlemi durdurur. Postflight yeni Supplier grant'leri ve PUBLIC erişimsizliği ayrıca kontrol edilir.

Migration008'in eski rolled-back denemesi korunur; başarılı tek uygulama hash'i esas alınır. Yeni unresolved hata sessizce geçilmez. Bu runner'ın history yorumunun Sprint E backup guard'ını değiştirmediğine dikkat edin.

014 son SHA-256: `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`. Yeni canlı denetim ve gelecekteki uygulama onayı **bu yeni hash'i** kullanmalı. `.gitattributes` SQL'i LF sabitler; ilk13 SQL içerikleri değiştirilmedi. Baseline dosyasına rastgele yeni checksum yazmak güvenlik incelemesi değildir.

## Timeout ve transaction sınırları

014 explicit BEGIN/COMMIT içinde server-side `SET LOCAL lock_timeout='3s'`, `statement_timeout='30s'`, `transaction_timeout='60s'` uygular. Ayarlar parent Node/PGOPTIONS varsayımıyla taşınmaz; Prisma'nın migration backend'inde SQL olarak yürür. Child toplam90s ile sınırlıdır. Normal fixture uygulaması yaklaşık1.5s olduğundan30s statement payı yeni boş tablo/index/FK işlemleri için geniştir; parent lock beklemesi3s'de kesilir.60s transaction limiti çoklu statement toplamını;90s child limiti engine açılışı/advisory bekleme ve server limiti sonrasını sınırlar. Bunlar development014 içindir; büyük backfill'e taşınmaz, timeout sonrası otomatik artırılmaz.

Prisma her migration'ı kendiliğinden tek transaction'a sarıyor varsayılmaz. İlk13 eski SQL değiştirilmedi. 014'ün DDL ve Permission/Master INSERT'leri kendi transaction'ındadır; Prisma metadata başlangıç/başarı/hata kayıtları aynı atomic sınırda sayılmaz. Testte transaction dışı CREATE+division-by-zero fiziksel nesne bırakırken explicit014 lock/statement hatasında üç yeni tablo kalmadığı gözlendi.

Child stdout/stderr son16KiB RAM kuyruğunda yalnız sabit hata sınıflaması için tutulur; terminale/dosyaya/raw error nesnesine aktarılmaz. Prisma ilk SQL hatasını “transaction aborted” ile maskeleyebilir; genel PRISMA_CHILD_FAILED bir başarı veya belirli timeout nedeni diye yorumlanmaz. Yerel timeout kanıtı yalnız sentetik PG server logundan boolean olarak doğrulanır.

Timeout'ta kendi Node child'ı durdurulur; benzersiz application_name+current DB+current user ile yalnız bu çağrının backend PID'leri sonlandırılır. Kapanış en fazla5s gözlenir; kalan backend varsa hata. Başka postgres/uygulama süreçleri hedeflenmez. PostgreSQL backend sonlandırma yalnız açıkça onaylı migration çağrısının kendi oturumları içindir; preflight yalnız okuma kipinde çağrılmaz.

## Uygulamadan önce

1. Mimo teslim diff/sır kontrolü, branch ve son dosya hash'ini doğrula. Gerçek kullanıcının migration014/Master genişlemesi/grants için ayrı onayı olmalı.
2. Kurtarma yolunu somutlaştır: exact UTC ve İstanbul pre-migration noktası, gerçekten seçilebilir history/LSN, branch topology, diğer DB etkisi, yetkili operatör ve sınanmış/uygulanabilir geri dönüş yöntemi. Onaylı olmayan branch/snapshot/restore oluşturma.
3. İş yazmalarını kontrollü bakım penceresinde durdur; eski10 tablo sayım/metadata referansını yeniden al. Eski referansı güncel iş verisi olarak kullanma. Ham Auth/MFA/finans içeriklerini raporlama.
4. Preflight ve pinler eşleşmeli;13 başarılı migration+014 pending ve test_runtime development CONNECT=false kalmalı. Doğru TLS zinciri olmadan çalıştırma.
5. R2 bağımsız yedeğinin yokluğu açık kalır. Boş iş tablosu sayımları Auth/MFA ve diğer tabloların önemsiz olduğu anlamına gelmez. Kurtarma kanıtı eksikse **BLOCKED**.

## Başarısızlık, kısmi uygulama ve tekrar deneme

- Timeout, nonzero child veya bağlantı belirsizliğinde başarı yazılmaz. Güvenli hata kodu ve gerçek tablo/Supplier nesne/unresolved metadata sayısı raporlanır; payload/log/URL yazılmaz.
- Yeni process aynı unresolved kaydı görünce durur. Otomatik migrate resolve, metadata silme, DROP, retry veya restore yoktur.
- Sonucu belirsiz COMMIT'te önce read-only katalog ve checksum denetlenir. Başarılı14/38/24 ve exact post-pin doğrulanırsa ALREADY_APPLIED döner; tekrar deploy edilmez.
- Kısmi kalıcı nesne varsa önce etki/bağımlılık/metadata incelenir; ayrı onayla forward fix/kurtarma planı hazırlanır. Yeni tablolarda veri oluştuktan sonra DROP bir geri alma yöntemi sayılmaz.
- Fixture negatif senaryoları arasındaki failed-row DELETE ve synthetic_partial_migration DROP yalnız o yeni hayalî cluster'ın açık test reset'idir. Gerçek operatör prosedürü değildir; resolved-success işareti atılmaz. Gerçek008 geçmişi değiştirilmez.

## Yetki etkisi

Sekiz anahtar: suppliers.view/create/edit; supplierMaterials.manage; supplierOffers.view/create/history/costView. Permission oluşturma katalog olayıdır; MASTER RolePermission bağlantısı mevcut Master yetkisini genişleten ayrı atama olayıdır.014 aynı transaction içinde her ikisini yapar ve operatörden açık Master onayı istenir. Normal rol şablonları, Membership, tenant kapsamı, override ve MFA güncellenmez. Master rolünü paylaşan kullanıcılar bu yetkileri alır; explicit DENY değerlendirmesi ve tenant/entity/activity scope korunur.

Development014 yalnız pusula_runtime'a Supplier/Link SELECT+INSERT+UPDATE, Offer SELECT+INSERT ve iki invoker function EXECUTE verir. Test rolü grant'leri kaldırıldı; fixture bunları yalnız kendi yeni cluster'ında açıkça kurar. Test rolüne development CONNECT açılmaz. Auth Supplier erişimi almaz. PUBLIC tablo ve function EXECUTE hakları COMMIT'ten önce kaldırılır.

Maliyet gizliliği server DTO ve suppliers/materials cost izinleriyle korunur; RLS sütun maskelemez. Shared DB credential kompromisine karşı column DLP iddiası yoktur. Ayrı normal-role izin atama operasyonu gelecekte tasarlanabilir; bu sprint otomatik Master ekini kaldırmadı, etkisini açık onay kapısına aldı.

## Neon Free kurtarma sınırı

Operatör Console gözlemi: Free, development, Restore from history kullanılabilir,6 saat; en eski tarih19.10.2026, kesin en eski saat bilinmiyor; snapshot/otomatik snapshot yok. Bu gerçek restore kanıtı değildir. [Neon fiyat sayfası](https://neon.com/pricing) history için6 saat/1GB değişim sınırı ve bir snapshot listeler; kullanım/maliyet/kota Console'da tekrar doğrulanmalıdır. Yeni kaynak açılmadı.

[Neon restore belgesi](https://neon.com/docs/postgres/backup-restore/branch-restore) root branch şartını, tüm branch DB'lerine etkiyi ve tarihsel durumun mevcut verinin yerini aldığını açıklar. Pusula Better Auth tabloları da PostgreSQL verisidir; sonradan oluşturulmuş kullanıcı/MFA/şifre/oturum değişiklikleri kaybolabilir. İlgili tüm kayıt/rol/RLS mutabakatı ve yetkili kontrollü giriş kontrolü gerekir; session iptali/hesap değişikliği ayrıca onaylı olmalıdır.

Pencere aşılırsa bu teyitli history seçeneği kullanılamaz; doğrulanmış snapshot/izole kopya/bağımsız arşiv yoksa elde garanti bir kurtarma yolu kalmaz. Bu yüzden otomatik restore yapılmaz. İzin verilecekse izole kopya veya snapshot seçenekleri ancak ayrı onay, quota/ücret ve hassas veri kapsamı denetimiyle oluşturulabilir. Şu an hiçbirisi oluşturulmuş veya ücretsiz garanti edilmiş değildir.

## Sonraki kabul

38/24 exact post-schema+014 checksum; eski10 tablo sayım/içerik mutabakatı; Auth/MFA kayıt koruma; Supplier CRUD/history, iki tenant/company/activity, revoke sonrası403/cost redaksiyonu; eski fiyat/sale snapshot değişmezliği. Önce yeni sentetik fixture kullanılır; development'a hayalî test kaydı ekleme ayrıca onay ister. Sprint E38/24/enum/function/TOC/restore incelemesi ayrı kalır; backup guard'ları otomatik genişletilmez. [Kanıt ve açık kapılar](../docs/validation/V04_V42C1_VERIFICATION.md).
