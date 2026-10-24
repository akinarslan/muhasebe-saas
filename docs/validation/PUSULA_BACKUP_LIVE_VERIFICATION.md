# PUSULA backup — Yerel kaynak profili doğrulaması

23 Ekim 2026 · **BACKUP_LOCAL_READY / gerçek offsite ve restore kabulü BLOCKED**.
[Teknik karar, kapsam ve somut onaylar](../../research/PUSULA_BACKUP_LIVE_READINESS.md).

## Gerçekte çalıştırılan fixture matrix'i

Her fixture yeni UUID dizini, özel SCRAM credential, loopback PostgreSQL **18.6**, checksum-pinned yerel server/client araçları ve ayrı yeni boş restore DB kullanır. `.env` yüklenmez; fixture alt süreçlerinin ortamı mevcut dar allowlist'tir. Yeni gerçek Neon bağlantısı ve R2 işlemi yoktur.

| Faz / komut | Nihai fixture | Sonuç |
| --- | --- | --- |
| `node --import tsx scripts/backup/verify-local.ts --approve-local-fixture --restore-fixture --source-profile=pre016` | `e23-91ac8ab8-649f-4186-aa2d-ad84da7cb8d9` | **PASS**,38 kontrol;40 tablo/26 FORCE RLS;15 başarı +1 bilinen rollback008; exit0, serverStopped=true |
| Aynı komut, `--source-profile=post016` | `e23-8e255aff-9788-404c-b491-2f21b652378a` | **PASS**,38 kontrol;47/33;16 başarı +1 rollback008; exit0, serverStopped=true |
| Aynı komut, `--source-profile=post017` — son deterministik history kimliğiyle | `e23-b6376176-64ff-4a38-ab0f-9fc359e03e51` | **PASS**,39 kontrol;56/42;17 başarı +1 rollback008; exit0, serverStopped=true |
| Aynı komut, profil bayrağı yok | `e23-af001aea-5a6d-4ec4-920f-a48cbaebb08d` | **PASS**,31 kontrol; legacy35/21 ve13 başarı; exit0, serverStopped=true |

Bir önceki tam matrix'teki post016 `e23-450351db-cfd7-4ddf-b10a-16c3e864a323`, post017 `e23-a7d6970e-b34b-4baa-bd9c-c1f3d2da4b2e` ve sonraki tam ACL matrix'indeki post017 `e23-bac8488a-1942-477b-8eeb-b55a10dae738` de PASS; bunlar nihai son017 koşusunun yerine sayılmadı.

Backup fixture'ı migration SQL'lerini yalnız yeni yerel cluster'a uygular; modern faz için history'ye ilgili15/16/17 başarı ve bilinen rolled-back008 ekler. Bu bir gerçek cloud migration runner veya cloud apply provası değildir. Aşağıdaki canonical017 regresyonunda mevcut gerçek Prisma yolu ayrıca çalışır; o kod değiştirilmedi.

## Export, crypto ve restore kabulü

Her modern profilde gerçek dedicated login `pusula_fixture_backup` ile READ ONLY repeatable-read snapshot; tam kaynak SELECT ve RLS/BYPASS/rol/ACL/function kontrolü; gerçek `pg_dump -Fc` ve tüm tablo DATA, FK, policy ve user trigger TOC envanteri doğrulandı. Modern SELECT/CREATE/EXECUTE yetkileri varsayılan strict politikaya ek bir gevşetme getirmez; farklı bir release açıkça seçilir.

Kaynak fazı için ham migration checksum'ları ve yalnız bilinen beş tarihsel checksum çifti kullanılır. Başarısız008 checksum'u `35ca1ae820b9e040ef189f3ff346381c591a268b74e4c37f639e94d2dded1fd9` yalnız rollback olabilir; başarılı008 ayrıca bulunmalıdır. Kayıt veya SQL checksum rewrite/resolve yapılmaz. İki008 satırının geliş sırası profil history kimliğini değiştirmez; başarı/rollback ayrımı hash'e dahildir.

Mevcut AES-256-GCM şifreleme ve HMAC manifest doğrulaması geçti. Yanlış/eksik anahtar, manifest değişikliği, bozuk ciphertext, yanlış pg_dump password, BYPASSRLS olmayan login ile export ve geçersiz archive negatifleri reddedildi. Key rotation'da hem eski hem yeni archive doğru key ile okunur; çapraz yanlış key reddedilir. Kimliği doğrulanmış plaintext yalnız özel fixture dizinine çözülür.

Gerçek `pg_restore --single-transaction --exit-on-error` yalnız yeni boş local DB'ye çalıştı. Hedefin cluster dizini, yeni DB OID'si ve boş katalogları doğrulandı. **Bütün35/40/47/56 tabloların satır sayısı ve içerik hash'leri** eşleşti. Table owner, FORCE RLS, policies, indexes, FK/CHECK/constraint, trigger tanımı/enable durumu, function tanımı/owner/SECURITY DEFINER/search_path, table/function ACL ve function grantor, column ACL ve default grant katalogları karşılaştırıldı.

İki CHECK deparse farkı, K5'teki aynı PG18 parser round-trip yöntemiyle normalize edildi; tanım parçaları silinmedi. Diğer constraint karşılaştırmaları exact kaldı. Restore'da iki tenant müşteri izolasyonu, auth/audit/price-history append-only ve sale-sealing trigger'ları gerçekten hata üretti. Backup login SELECT yapabilirken UPDATE reddedildi.

Son017 sentetik finans kapsamı:

| Tablo | Kaynak ve restore satırı |
| --- | ---: |
| FinanceAccount |10|
| FinanceAccountAccess |2|
| FinanceAllocation |2|
| FinanceExpense |2|
| FinanceFundMovement |4|
| FinanceIntent |4|
| FinanceJournal |6|
| FinanceOperation |4|
| FinancePosting |14|

İki tenant için500 açılış,200 tahsilat ve60 net +12 KDV nakit gideri içeren sentetik kayıtlar kullanıldı. Restore sonrasında journal debit-credit farkı, fund posting/movement farkı ve expense/operation farkı **0**. Journal/allocation/fund update ve expense delete işlemleri **P0001** ile reddedildi; her negatif işlem ROLLBACK edildi ve son içerik hash'leri tekrar eşleşti. Bu veri ZY Reklam işletme verisi veya gerçek işletme kabulü değildir.

## Rol/ACL ve bağımsız sözleşme negatifleri

- Gerçek fixture'da backup login'e geçici runtime üyeliği eklenince `SOURCE_ROLE_MEMBERSHIP_REJECTED`; UPDATE, SELECT WITH GRANT OPTION, schema CREATE ve function EXECUTE eklenince `BACKUP_DIRECT_ACL_GRANTOR_REJECTED`. Probe'lar finally ile yalnız fixture'da temizlendi; sonraki normal kaynak kabulü geçti.
- Yetkili yazma transaction'ında backup login'in UPDATE, TRUNCATE, CREATE TABLE ve SET ROLE denemeleri **42501** verdi. Son017'de `k4_expense` doğrudan çağrısı da42501 verdi. Retler yalnız READ ONLY ayarına dayanmaz.
- Global function ACL'de beklenmeyen grantor, PUBLIC/auth grantee ve grant-option unit negatifleri reddedilir. Eski dört PUBLIC trigger fonksiyonu yalnız kaynakla eşleşen invoker trigger sözleşmesiyle kabul edilir; yeni stock/finance API'lerinde PUBLIC EXECUTE kabul edilmez.
- Executor rolleri faza bağlı exact beklenir; creator, executor üyeliği, schema CREATE, login/superuser/BYPASSRLS/CREATEROLE/config farkı kaynak kabulünü durdurur. Backup login'in kendisi de üyelik/ownership/DDL/DML/provider-admin içermemelidir.
- Function body, owner, search_path, EXECUTE, grant-option ve return-column adının tırnak içindeki boşluk farkı reddedilir.17'nin rename/K4 body değişikliği kaynak SQL'den hesaplanır; hedef posttan beklenen fingerprint alınmaz.
- Eksik/çift başarı, bilinmeyen rollback, duplicate rollback008, bitmemiş migration ve yanlış checksum profili reddeder. Yanlış fazın envanteri otomatik kabul edilmez.
- Gerçek development URL ile modern profil çağrısı **bağlantı açılmadan** `BACKUP_RELEASE_REMOTE_NOT_APPROVED` verir. Eski managed remote object/upload ve accounting/stock guard'ları aynen durur.

## Diğer gerçek kontroller

| Komut / inceleme | Sonuç |
| --- | --- |
| `npm.cmd test` | **44 dosya /497 test PASS**, exit0 |
| `npx.cmd tsc --noEmit` | PASS, exit0 |
| `npm.cmd run lint` | PASS, exit0 |
| `npm.cmd run build` | Prisma generate + Next16 üretim build PASS, exit0; deploy yok |
| `node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | **10 kontrol PASS**, exit0; yalnız izole Git artifact |
| `node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --finance017 --k5` | **PASS**, fixture `v42-b7e76a33-dec4-4f9b-8dd9-058fe2d6d1d0`, serverStopped=true, exit0; canonical017/Prisma ve K1–K5 regresyonları |
| Kayıtlı23 Ekim snapshot function ACL karşılaştırması | **21 beklenen /21 gözlenen MATCH**;494 toplam kayıt; yeniden ölçüm=false, providerRoleApproval=false, enrollment=false |
| `git diff --check` | PASS, exit0; kaynak koruması ayrıca hash ile kontrol edildi |

Canonical017 modu K5 business testlerini çalıştırır; kendi koşullu K5 backup child'ını çağırmaz. Dolu finans backup/restore kanıtı yukarıdaki bağımsız56/42 fixture'dır. Browser testleri bu görevde çalıştırılmadı.

## İlk başarısız denemeler ve düzeltmeleri

İlk fixture'lar SupplierUnit'in eski tip listesiyle reddi,35 tabloya sabitlenmiş COPY sayımı ve CHECK deparse farkını yakaladı; profil/enum/sayım/parser düzeltmeleri sonrası geçti. ACL sorgusunun PostgreSQL `char` concat hatası açık `::text` ile düzeltildi.017'nin dinamik K4 body delta'sını hesaba katmayan ilk kaynak parser'ı function drift üretti; yedi kaynak kontrollü replace işlendikten sonra exact karşılaştırma geçti. İlk sentetik finans seed'inde nullable customer creator kullanımı, mevcut sentetik AuthUser ile düzeltildi.

Eski `--k5` candidate modu17 SQL dizini yanında16 başarılı migration bıraktığı için `db-verify` history assertion'ında durdu. Korunmuş `--finance017 --k5` canonical yolu17 başarıyla geçti; M017/M016 runner kodu bu nedenle değiştirilmedi. Başarısız candidate denemesi K5 PASS gibi gösterilmedi.

Paralel fixture denemelerinden `e23-5f36552e-84fa-4d46-8108-5ed807f8f936`, başlangıç port çakışması nedeniyle başlayamadı; kendi raporunda serverStopped=false kaldı. Ayrı yetkili salt okunur Windows süreç kontrolü aynı UUID/data dizinine ait **0 süreç ve PID dosyası yok** sonucunu verdi (`port-conflict-cleanup.json`). Bu eski rapor sonradan PASS yapılmadı. Nihai modern matrix sırayla çalıştırıldı ve tüm başarılı fixture'lar serverStopped=true döndü. Hiçbir mevcut DB/süreç durdurulmadı.

## Kanıt dosyaları, koruma ve gerçek bulut sınırı

Yerel özel `.data/backup-live/`: `pre016-accepted.log`, `post016-accepted.log`, `post017-final-accepted.log`, `legacy.log`, `k5-canonical.log`, `k5-nonempty.log` (ilk başarısız candidate modu), `vitest-final.log`, `tsc-final.log`, `lint-final.log`, `build.log`, `checksum.log`, `saved-provider-acl-review.json`, `preservation*.json`. Her UUID dizininde `verification.json` bulunur. Dump/cipher/key/fixture içeriği ve log'lar Git kapsamı dışıdır.

001–017 SQL, M017/M016 kaynakları, eski raporlar, manifest, kullanıcı planları ve LAST_REPORT korundu. Başlangıç55 hash yolundan yalnız bu görevin mevcut `scripts/backup/postgres.ts` kaynağı ilerledi. Git index/HEAD değişmedi; hiçbir commit/push yapılmadı. NEON_API_KEY değeri yazdırılmadı, hash'lenmedi veya dosyaya kaydedilmedi.

**Gerçek kaynak export'u, gerçek encryption key custody, R2 offsite ve ayrı gerçek restore hedefi henüz kabul edilmedi.** Yerel aynı-cluster restore, provider rol davranışını veya global rollerin bağımsız kurtarılmasını ispatlamaz. `ROLE_DELTA_UNRESOLVED` sürer. `BACKUP_LOCAL_READY` yalnız bu belgedeki yerel motor/sözleşme kabulüdür; GO_LIVE_PASS değildir.
