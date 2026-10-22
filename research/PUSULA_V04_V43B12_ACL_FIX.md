# PUSULA V4.3b.12 — ACL_FIX_PASS

22.10.2026. Migration 016'nın non-superuser sahiplik devri sonrası ACL hatası düzeltildi. İzole PostgreSQL18.6 üzerinde test-only ACL düzeltmesi olmadan güvenli postflight geçer. **Bu yerel kabul gerçek Neon apply onayı değildir.** Gerçek Neon SQL/API, recovery/production/test bulut DB, R2, restore veya provider işlemi yapılmadı.

## Kesin neden ve bağımsız kanıt

V4.3b.11'in bulgusu ayrı bir minimal PostgreSQL deneyiyle yeniden doğrulandı. Gerçek ayrı LOGIN aktörü `fixture_managed_owner`, SUPERUSER=false, CREATEROLE=true, createrole_self_grant boş, sürüm180006. Transaction içinde geçici `fixture_acl_probe_owner` ve tek SQL probe fonksiyonu oluşturuldu. Actor'a INHERIT FALSE/SET TRUE üyeliği verilip fonksiyon devredildi.

Katalogdaki `can_set=true, inherits=false` durumunda actor'ın REVOKE/GRANT komutları hata yerine `01006` ve `01007` uyarıları verdi. PUBLIC EXECUTE kaldı; doğrudan runtime EXECUTE oluşmadı. Aynı transaction'da yalnız `SET LOCAL ROLE fixture_acl_probe_owner` eklenince PUBLIC kaldırıldı ve runtime grant'i yeni sahip grantor'ıyla oluştu. Deney ROLLBACK oldu; tüm schema/security/rol/üyelik snapshot'ı başlangıçla aynı kaldı. Bu, migration adayının postflight'ına müdahale eden bir test-only düzeltme değildir; ayrı probe nesnesiyle nedenin bağımsız kanıtıdır.

[PG18 rol üyeliği](https://www.postgresql.org/docs/18/role-membership.html), SET ile otomatik INHERIT yetkilerini ayırır. [ALTER FUNCTION](https://www.postgresql.org/docs/18/sql-alterfunction.html) sahiplik devri için SET yolunu ve yeni sahibin schema CREATE yetkisini ister. SET yetkisinin varlığı, henüz SET ROLE yapılmamış aktörün sonraki GRANT/REVOKE için sahip ayrıcalıklarını kullanmasını sağlamaz. Eski ACL komutlarının başarısızlığı ile COMMIT'in başarılı olması bu yüzden birlikte mümkündür.

## Eski ve yeni yetki sırası

| Bölüm | Önce | Yeni |
| --- | --- | --- |
| Command | OWNER executor; actor altında PUBLIC revoke ve runtime grant | Immutable helper PUBLIC revoke aktörde; SET LOCAL ROLE executor; command PUBLIC revoke/runtime grant; RESET ROLE |
| Complete/constraint trigger | Önce OWNER devri, actor altında etkisiz PUBLIC revoke, sonra trigger kurulumu | Trigger'lar aktör hâlâ fonksiyon/table owner iken kurulur; OWNER executor; schema CREATE revoke; SET executor; PUBLIC revoke; RESET |
| Order received/outcome | OWNER executor; schema CREATE revoke; actor altında ACL | OWNER executor; schema CREATE revoke; SET executor; PUBLIC revoke/runtime grant; RESET |
| Son temizlik | Creator kendi SET grant'ini kaldırır, actor creator'ı DROP eder | Aynı yaşam döngüsü korunur; ek executor SET geçişleri her blokta RESET edilir |

Complete trigger'larını sahiplik devrinden önce kurmak, actor'a kalıcı/geçici doğrudan complete EXECUTE grant'i ekleme gereğini kaldırır. Trigger kurulumu, sahiplik ve PUBLIC kapatma aynı BEGIN/COMMIT transaction'ındadır. Başka session'a commit edilmiş açık pencere bırakılmaz. Yeni SQL runtime/auth'a executor üyeliği vermez. Executor LOGIN/BYPASSRLS veya kalıcı schema CREATE almaz; tablo sahibi olmaz.

Altı fonksiyonun CREATE FUNCTION tanımları önceki SQL ile birebir aynıdır. Dolayısıyla iş kuralları, search_path, RLS, immutable ledger, audit, kilit sırası ve fonksiyon gövdeleri değişmedi. Transaction/timeout3s/30s/60s ve permission seed kuralları korundu. SQL farkı yalnız ACL yetki sırası, açık role geçişleri ve complete trigger kurulum yeridir.

## Checksum ve yeniden ölçülen pinler

| Artifact | Önce | Yeni sonuç |
| --- | --- | --- |
| Migration016 SHA-256 | `7368c775ec5d9b2b126b4731d5985ec83d1cad077f2cd5904ff596a04f22b272` | `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567` |
| Managed fixture pre ACL | `a5f8f3453c2796acbff4441c37c3a1d92f3154319699cd82d9f953bc5aea9aac` | Aynı |
| Managed fixture post ACL | `d41e2388751ffe3a2d54f98cf9a1ef756d5869fff318f4bfd2f078d712fe65cd` | `3ab7232843c282dae790b6a5f87c81222f2908a1b3a2c80fd89f54b58ccf4a38` |
| Normal fixture pre/post ACL | `d54f91f77fcd5b3dcadaab534d3bd6f03fd581ed3afc72cec18641db45c20efa` / `00dc3dc15d3a9b5bc94a817c7923b771d76272b6c528c0fbe881f4ee0a69c6e7` | Yeniden ölçüldü; aynı |
| Sekiz post schema kategorisi | Mevcut migration-baseline değerleri | Gerçek kataloglardan yeniden ölçüldü; 8/8 aynı |
| Function schema hash | `985bc3b9cf0cb7fdd3930786d8fbad6c60d6e2732d057e19cf3536f981c9b227` | Aynı; ACL hash'inden ayrıdır |

Yeni SQL checksum'u stock runner, stock migration baseline, managed baseline ve managed contract'ta eşleşir. Managed post ACL pini yalnız yeni yerel ölçüm/bağımsız invariant kontrolü incelendikten sonra değiştirildi; yeni temiz fixture'da pinli kabul tekrarlandı. Yerel measurement bayrağı gerçek cloud enrollment değildir.

İlk15SQL, eski DB baseline ve tarihsel beş checksum çifti/resolved008 uyumluluğu değişmedi. Gerçek Neon post fingerprint'i ölçülmedi: `postFingerprint=null`, managed `post=null`, `applyEnabled=false` ve `STOCK_MANAGED_APPLY_DISABLED` aynen duruyor. Yerel yeni ACL hash'i Neon post sonucu yapılmadı. Mevcut tarihsel pre kanıtının tarihi, içeriği veya eksik grantor alanı değiştirilmedi.

## Gerçek PostgreSQL postflight

Doğrudan yeni SQL COMMIT'inden sonra, herhangi bir admin ACL düzeltmesi yapılmadan:

| Fonksiyon | Sahip | PUBLIC EXECUTE | Doğrudan runtime EXECUTE |
| --- | --- | --- | --- |
| v43b_command(text,jsonb) | pusula_stock_executor | Yok | Var |
| v43b_complete() | pusula_stock_executor | Yok | Yok |
| v43b_order_received(uuid) | pusula_stock_executor | Yok | Var |
| v43b_receipt_outcome(uuid,text) | pusula_stock_executor | Yok | Var |
| v43b_immutable() | migration actor | Yok | Yok |
| v43b_net_received(uuid) | migration actor | Yok | Yok; executor helper EXECUTE var |

Toplam PUBLIC0, doğrudan runtime3; Auth altı fonksiyonun hiçbirini execute edemiyor. İzinler sadece efektif `has_function_privilege` ile değil gerçek ACL grantee/grantor satırlarıyla da ölçüldü; sözleşmenin exact ACL/ownership/membership deltası geçti. Candidate SQL'de 01006/01007 ACL uyarısı yok. Table47/FORCERLS33/başarılıhistory16 ve bilinen resolved008 korunur.

Creator yok, executor'ın üst/alt üyeliği yok, actor SET/INHERIT yok, schema CREATE yok; executor NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS. Commit sonrası actor SET ROLE denemesi42501. Yedi stok tablosunda gerçek runtime INSERT denemeleri42501 ile reddedildi. Diğer DML/TRUNCATE yetkisizliği katalog ve mevcut Stock regresyonlarıyla da sınanır.

Postflight validator'ın beklenen izinleri gevşetilmedi. V4.3b.11 fixture'ındaki test-only dört revoke/üç grant ve bunları geri alma bloğu kaldırıldı. Yeni doğrulama ilk pozitif kabulü doğrudan yeni migration sonucuna uygular. Sonraki negatif testlerin kendi açık enjeksiyon/geri alma işlemleri bu düzeltme ile karıştırılmaz.

## Rollback ve regresyonlar

Non-superuser fixture üç önceki negatifin yanında yeni orta-aşama hata enjeksiyonunu içerir: executor aktifken command runtime grant'inden hemen sonra division-by-zero22012. ROLLBACK sonrası identity/schema/history/permission/ACL/tüm roller/grantor üyelikleri başlangıç snapshot'ıyla eşittir. Creator/executor kalmaz. Geç COMMIT öncesi hata da aynı tam güvenlik kontrolüyle sınanır. Eksik SET ve eksik schema CREATE varyantları42501 verir. Bunlar beklenen negatiflerdir; gerçek bulut rollback provası değildir.

Managed contract negatifleri CREATEROLE, SET üyeliği, schema CREATE, creator kalıntısı, runtime ledger DML, PUBLIC execute, ek schema, non-MASTER permission ve grantor drift'i reddeder. Normal Prisma runner gerçek deploy, ALREADY_APPLIED, history korunması, advisory/lock timeout, rollback, ACL/RLS/schema/history drift ve temp-shadow regresyonlarını çalıştırır. Supplier/PurchaseOrder/Stock/Auth/Cloud testleri yeni fixture'larda çalıştırıldı; mal kabul/ters kayıt/gerçek iki bağlantı concurrency/immutable ledger ve bakiye mutabakatı Stock kapsamındadır. Sayılar, fixture kimlikleri ve native exit sonuçları [doğrulama belgesindedir](../docs/validation/V04_V43B12_VERIFICATION.md).

## Açık Neon engelleri

Bu sprint canlı Neon erişimi içermiyor. Son provider401 tarihsel; güncel kimlik/operasyon/plan/kota teyidi yok. Provider'a özgü CREATE/GRANT/SET/REVOKE/DROP davranışı yerel PG18.6 kanıtıyla kesinleşmez. Managed pre'nin eksik genişletilmiş grantor kanıtı, gerçek post kabulü ve ayrı cloud connector/apply incelemesi açık. Kapalı runner sınırı gevşetilmedi.

Recovery `br-late-river-baeipun8` üzerinde hiçbir işlem yok; **ROLE_DELTA_UNRESOLVED** ve token_roles köken belirsizliği korunur. Recovery tam rol eşitliği/restore kabulü değildir. Bağımsız R2 backup/restore ve mevcut35/21 allowlist'inin47/33 kabul engelleri sürer. Bu yerel ACL_FIX_PASS gerçek migration uygulama izni veya production kabulü değildir.

## Kesin dosya listesi ve GitHub hazırlığı

Bu sprintte11dosya değişti/oluşturuldu:

1. `prisma/migrations/202610210016_goods_receipts/migration.sql`
2. `scripts/stock/migrate.ts`
3. `scripts/stock/migration-baseline.json`
4. `scripts/stock/managed-baseline.json`
5. `scripts/stock/managed-fixture-baseline.json`
6. `scripts/stock/managed-contract.json`
7. `scripts/stock/managed-contract-fixture.ts`
8. `scripts/stock/managed-fixture.ts`
9. `research/PUSULA_V04_V43B12_ACL_FIX.md`
10. `docs/validation/V04_V43B12_VERIFICATION.md`
11. `LAST_REPORT.md`

Başlangıçtan korunan7dosya da henüz commit edilmemiş birleşik GitHub teslim kapsamındadır:

12. `research/PUSULA_V04_V43B10_NEON_PREFLIGHT.md`
13. `docs/validation/V04_V43B10_VERIFICATION.md`
14. `research/PUSULA_V04_V43B11_MANAGED_RUNNER.md`
15. `docs/validation/V04_V43B11_VERIFICATION.md`
16. `scripts/stock/managed-contract.ts`
17. `scripts/stock/managed-runner.ts`
18. `tests/stock-managed-contract.test.ts`

Toplam18dosya; önceki raporlar tarihsel sonuçlarıyla aynen korunur. `.data`, yerel kanıt/fixture credentials ve generated/build artifact teslim dışıdır. .env.local değiştirilmedi; gerçek Auth/MFA/session içeriği okunmadı. Dal `feat/pusula-v030-neon-cloud`, HEAD/yerel upstream `d65ea89d915805dbf6b6e5afd111beb727cf7ef5`; commit/push/merge yapılmadı. GitHub'a gönderim ayrı görevdir.
