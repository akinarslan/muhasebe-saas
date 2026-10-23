# PUSULA — K5 entegre işletme kabulü ve bulut hazırlığı

23 Ekim 2026 · `feat/pusula-v030-neon-cloud` · hedef 29 Ekim ZY Reklam iç kullanım MVP.

| Ayrı karar | Sonuç |
| --- | --- |
| K5 yerel kabul | **K5_LOCAL_PASS** |
| CLOUD_READY_FOR_APPROVAL | BLOCKED |
| GO_LIVE_PASS | BLOCKED; verilmedi |

Nihai fixture **`v42-fe3c040b-4649-48c3-88a4-8b22fb1fa385`**:235 API/SQL kontrolü,56 tablo şifreli yedek/restore ve desktop/mobile2/2 PASS; `serverStopped=true`. 462 Vitest, TypeScript, ESLint, production build ve9 checksum artifact kontrolü geçti. Bu sonuç yalnız yereldir.

Yeni işletme özelliği geliştirilmedi. K1–K4 SQL/rapor/testleri ve kullanıcı değişiklikleri korundu. Ürün kodundaki değişiklik yalnız bağlantı geri gelip finans verileri başarıyla yenilendiğinde eski ağ hatasının temizlenmesidir; gerçek mobil kabul bunu yakaladı. Finans, POS, satış, fiyatlama veya stok motoru yeniden yazılmadı.

## Entegre muhasebe kanıtı

`verify-k5.ts` önceki suite'lerle aynı izole PG18.6 fixture'da gerçek API/transaction kullanır. Kesişimden kaçınmak için sentetik dönem 26 Ekim 2026'dır; gerçek işletme belgesi değildir.

10 m² vinil (100×200cm ×5), manuel kur40: net4.000 + KDV800 = brüt4.800 TRY. Satış anındaki USD31,008 maliyet yalnız tahmindir. İlk personel 2.000 nakit tahsil eder; belge kalanı2.800. Aynı tahsilat yeni request key ile replay edilince yeni journal/operation/allocation/fon hareketi yoktur. Peşin500 işletme gideri kasa artışını1.500'e indirir. İkinci personel son2.800 tahsilatı yapar; kaynak belge ve müşteri carisi0 olur.

Tedarikçi bakım gideri net1.000 + KDV200 =1.200 vadeli borç oluşturur. Kısmi300 ödeme →900 kalan; ödeme ters kaydı →1.200; doğru300 ödeme →900. Gider ikinci kez yazılmaz. Ayrı sentetik satışta iki farklı gerçek personel/MFA oturumu aynı kalan için eşzamanlı3.000'er tahsilat dener: biri200, diğeri409; toplam4.800'ü aşmaz. Bu test hareketi ve ikinci satış append-only terslenir.

Gün sonu farkları: net satış4.000, KDV800, brüt4.800, tahsilat4.800, ödeme800, net gider1.500, gider KDV200, brüt gider1.700, tedarikçi kalan900, kasa/nakit artışı4.000. Raporun bütün bu toplamları bağımsız posting toplamlarıyla eşleştirilir; tüm journal'lar dengeli kalır. StockMovement sayısı değişmez; fiziksel stok tüketimi yapılmış gibi kayıt yoktur.

Gerçek personel kurulumları parola + TOTP + step-up kullanır. Step-up tarihi testte gerçekten geçmişe alınır; yazma403 ve finans tablo sayıları sabit; gerçek parola/TOTP ile step-up tekrar yapılır. Finanssız üçüncü personel cari hesap, cari ekstre ve kasa verisini403 ile alamaz. Sentetik kimliklerin kurulumu öncesinde önceki suite'lerin ortak loopback-IP rate-limit sayaçları izole edilir; eşzamanlı finans veya süresi dolmuş MFA testi sırasında sayaç sıfırlanmaz. Üretim limitleri ve rol şablonları değişmez.

## Masaüstü ve mobil

`k5.spec.ts` localhost `/app` üzerinde gerçek DB/MFA kullanır. 4.800 satış, 2.000 tahsilat,500 gider,1.500 kasa ve son2.800 tahsilat/4.300 kasa ekranlardan doğrulanır. Tahsilat POST'u route.fetch ile gerçek sunucuya gönderilir;200/commit sonrası yanıt `connectionfailed` ile kesilir. Tek POST sayılır; sayfa yenilenince opak pending referans korunur, sonuç sorgusuyla SUCCEEDED bulunur ve ikinci POST oluşmaz. Offline→online veri yenilemesi ve eski hata mesajının temizlenmesi sınanır. Uygulama sekmesi kapatılıp yeni sekmede açılır; satışın kapalı kalanı ve gerçek kasa kaydı yeniden DB'den okunur. Yatay tablolar kaydırılabilir; belgenin viewport'u aşmadığı ölçülür.

Bu uygulama sekmesi/bağlantı kurtarma kabulüdür. Gerçek Chrome motorunda Desktop Chrome ve Chromium/iPhone13 mobil profilidir; fiziksel iPhone/Safari kabulü değildir. Gerçek internet sağlayıcısı/Neon kesintisi veya production process failover kabulü değildir.

## Finans017 teknik hazırlığı

Çevrimdışı üretici `prepare-migration.ts` dört değişmemiş yerel SQL'in SHA256'larını manifest'e koyar ve tek `migration-candidate/017-finance.sql` üretir. Fixture runtime isimleri `pusula_runtime` ile değiştirilir; lokal DB/aktör guard'larının yerini açık operator-review, PG18.6, kabul edilmiş016/history16 ve sınırlı runtime rolü precondition'ları alır. Son şema56 tablo/42 FORCE RLS; executor NOLOGIN/NOBYPASSRLS ve runtime DML yasağı postcondition'ları korunur.

Harness bu adayı değiştirmeden, yerel 001–016 runner kabulünden sonra uygular. Review işareti olmadan reddi ve hiçbir FinanceAccount yaratılmadığı da ölçülür. Aynı aday üzerinde K1–K4 ve K5 gerçek API regresyonları çalışır. Aday canonical migration dizinine konulmadı; `_prisma_migrations` hâlâ16, ikinci geçmiş veya resolve yoktur. Bu DDL kabulü gerçek Prisma017 registration/provider kabulü değildir.

Operatörce onaylı terfi sırası, eksik canlı kanıtlar ve gereken ayrı onaylar [canlıya geçiş belgesinde](../docs/operations/PUSULA_INTERNAL_MVP_GO_LIVE.md). İlk16 checksum, managed016 engelleri ve `ACCOUNTING_CLOUD_REVIEW_REQUIRED` değiştirilmedi. Gerçek provider rol/ACL, bağımsız backup/restore ve işletme kabulü yokken CLOUD_READY_FOR_APPROVAL verilmez.

## Yedekleme kritik yolu

Mevcut `scripts/backup` pg_dump/TOC, AES-256-GCM + HMAC, verify ve private decrypt motoru yeniden kullanılır. Crypto veya storage motoru yeniden yazılmaz. Varsayılan uzak35/21 allowlist'i aynı kalır. Yalnız guarded fixture helper,56 tablo/42 RLS kapsamını seçebilir. TOC'de eksik journal/posting/allocation/gider negatifleri unit testtedir.

Yerel dar backup rolünde BYPASSRLS vardır; superuser/DDL/executor üyeliği/DML ve finans definer EXECUTE yoktur, default read-only ölçülür. Repeatable-read snapshot'tan export alınır. Şifreli arşiv ayrı private yerel dizine kopyalanır; digest/HMAC/GCM doğrulaması, bozuk tag reddi ve decrypt sonrası yeni template0 DB'ye gerçek pg_restore çalışır. 56 tablonun tüm satır içerik hash'leri, schema/kolon/default ACL, ownership, function/trigger, FORCE RLS/policy, FK/index/constraint ve finans mutabakatı karşılaştırılır.

Eski iki CHECK'in restore sırasında PostgreSQL tarafından eşdeğer şekilde yeniden ayrıştırılması özel olarak ele alınır: kaynak tanımı aynı tipli boş scratch tablosuna PG18.6 parser'ıyla tekrar eklenir ve hedef deparse tanımıyla eşleşmesi zorunludur. Parantez/cast metni keyfî silinmez. Hedef Supplier CHECK'i gerçekten CHECK(true) yapılınca fark yakalanır; değişiklik rollback edilir. Diğer kataloglar ve veri hash'leri tam eşleşir.

Bu, ayrı boş DB'ye **sentetik yerel** restore'dur; DB aynı yeni fixture cluster'ındadır ve global roller önceden vardır. Ayrı dizin aynı bilgisayardadır, bağımsız offsite değildir. Sentetik recovery key private test dizinindedir; gerçek key custody kabulü yoktur. Manifest'te remote strict policy kabulü iddia edilmez; opsiyonel source-policy alanı bırakılmaz. Gerçek kaynak, provider backup rolü, database/global role ACL kurtarma, güvenilir bağımsız offsite ve gerçek restore hâlâ BLOCKED.

[Gerçek doğrulama kaydı](../docs/validation/PUSULA_ACCOUNTING_K5_VERIFICATION.md). Neon/R2/production/recovery/snapshot işlemi, `.env.local` değişikliği veya Git commit/push/merge yapılmadı.

## Dosya kapsamı

Yeni kabul kaynakları: `scripts/accounting/{verify-k5,k5-staff}.ts`, `tests/auth-e2e/k5.spec.ts`, `tests/accounting-release.test.ts`. Çevrimdışı hazırlık: `scripts/accounting/prepare-migration.ts`, `migration-candidate/{017-finance.sql,manifest.json}`. Yerel backup uyumluluğu: `scripts/backup/{accounting-fixture,accounting-coverage}.ts`; mevcut `postgres.ts` TOC kontrolü opsiyonel fixture kapsamı alır, varsayılan35 kalır; `restore-fixture.ts` mevcut katalog sorgularını yeniden kullanım için export eder. Harness `scripts/stock/verify-local.ts` K5 profilini seçer. Ürün düzeltmesi `src/components/finance-desk.tsx` içindeki başarılı yenilemede hata temizlemesidir. Üç teslim belgesi ve LAST_REPORT özeti eklendi.
