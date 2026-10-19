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
