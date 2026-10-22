# PUSULA V4.3b.12 doğrulama — ACL_FIX_PASS

22.10.2026. [Neden, SQL sırası, hash'ler ve kesin18dosyalık birleşik teslim kapsamı](../../research/PUSULA_V04_V43B12_ACL_FIX.md).

**Yeni SQL non-superuser PostgreSQL18.6 üzerinde test-only ACL düzeltmesi olmadan geçer.** Eski kusurlu adayın kabul edilmesini bekleyen V4.3b.11 test düzeni kaldırıldı; mevcut exact güvenlik sözleşmesi gevşetilmedi.

## Bu sprintte gerçekten çalıştırılanlar

| Kontrol | Gerçek sonuç |
| --- | --- |
| Başlangıç Git | Beklenen feature dalı ve HEAD d65ea89d915805dbf6b6e5afd111beb727cf7ef5; önceki11dosyalık çalışma korundu |
| Managed ölçüm koşusu | Yeni UUID/127.0.0.1 PG18.6 non-superuser LOGIN actor; SQL COMMIT ve deklaratif postflight PASS |
| Ayrı managed pinli koşu | Yeni temiz cluster; yeni yerel ACL pinine ve değişmeyen exact post sözleşmesine karşı PASS |
| Bağımsız neden deneyi | can_set=true/inherits=false; SET öncesi PUBLIC1/runtime-direct0 ve notices01006/01007; SET sonrası PUBLIC0/runtime-direct1; tam ROLLBACK |
| Yeni migration uyarıları | Yetkisiz revoke/grant uyarısı01006/01007 yok |
| Şema/history | 47tablo/33FORCERLS/16başarı; exact failed008 resolved kayıt korunur |
| Altı yeni fonksiyon ACL'si | PUBLIC0; doğrudan runtime3; auth0; runtime helper/trigger0 |
| Definer ownership/search_path | Dört fonksiyon executor-owned; pg_catalog,public,pg_temp |
| Rol temizliği | Creator yok; executor üst/alt üyelik0; actor SET/INHERIT=false; schema CREATE=false |
| Runtime doğrudan stok DML | Yedi tabloya gerçek INSERT42501; mevcut Stock negatifleri/izin sorguları da PASS |
| Orta ACL aşamasında hata | Executor aktifken22012; ROLLBACK sonrası schema/history/permission/role/membership/ACL/identity başlangıçla eşit |
| Geç aşamada hata | COMMIT öncesi22012; aynı tam snapshot eşitliği PASS |
| Eksik SET / schema CREATE | Beklenen42501 ve atomik rollback PASS |
| Managed history/ACL/role negatifleri | Unknown/unresolved/duplicate/rollback, CREATEROLE/SET/CREATE/creator/PUBLIC/DML/schema/non-MASTER/grantor reddi PASS |
| Git LF artifact | 9/9; Git blob/historical checksum, resolved008 ve byte/history negatifleri PASS |
| Normal gerçek Prisma runner | 20/20; deploy, ALREADY_APPLIED, history, advisory/lock timeout/rollback, ACL/RLS/schema drift PASS |
| Normal fixture regresyonları | DB11 / Auth62 / Cloud11 / Supplier16 / Purchase28 / Stock36 PASS |
| Managed fixture regresyonları | AuthC2 9 / Supplier16 / Purchase28 / Stock36 PASS |
| Nihai Vitest | 35dosya / 417/417 PASS; native exit0 |
| Nihai TypeScript | npx.cmd tsc --noEmit; native exit0 |
| Nihai ESLint | npm.cmd run lint; native exit0; uyarı yok |
| Production build | npm.cmd run build; native exit0; mevcut geniş .data tracing uyarısı var |
| Function gövdeleri | Önce/sonra6CREATE FUNCTION tanımı birebir eşit |
| İlk15SQL/eski checksum mekanizması/env/eski raporlar | Başlangıç byte SHA manifest'iyle aynı |
| Cloud kapıları | Managed post=null, postFingerprint=null, applyEnabled=false ve STOCK_MANAGED_APPLY_DISABLED korunur |

Ölçüm fixture'ı: `v42-03a3ad03-709c-43ef-beb2-8b66d3f022ff`, PASS, serverStopped=true.

Normal Git LF/Prisma fixture'ı: `v42-e2d64db7-ccc0-41d1-bc30-4ea7f4dbf2cb`, PASS, serverStopped=true.

Son pinli managed fixture: `v42-40117b10-a561-4270-a0d9-a08b54b7fca0`, PASS, serverStopped=true, native exit0. 15managed + 13contract + 2bağımsız ACL + 9artifact kontrolü geçti. Üç fixture'ın da postmaster.pid dosyası yok; normal ve managed ölçüm/pinli cluster'lar kapandı.

## Tekrarlanabilir komutlar

```text
node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --managed-profile --measure-runner --checksum-git-artifact --supplier-only
node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --git-migration-bytes
node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --managed-profile --checksum-git-artifact --supplier-only
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run build
```

İlk komut yalnız yeni yerel UUID fixture'ında ölçüm yapar; sürüm kontrollü baseline yazmaz. İncelenen yeni managed ACL pini elle güncellendi, üçüncü komutla farklı cluster'da tekrar sınandı. Normal runner pini ve sekiz schema pini yeniden ölçüldü; aynı kaldı. Hiçbir ölçüm Neon post enrollment değildir. Fixture komutları port tahsis yarışı olmaması için sırayla çalıştırıldı.

Stock36 regresyonları gerçek posting/reversal/concurrency/ledger denemelerini içerir. Sentetik40P01 enjeksiyonu API deadlock sınıflandırmasıdır; doğal deadlock gözlemi diye gösterilmez. Gerçek satır kilidi/concurrency ve statement timeout kontrolleri ayrıca çalışır. Auth/Cloud testleri yalnız yeni yerel synthetic fixture kayıtlarını kullanır; gerçek Auth/MFA/session içeriği okunmadı.

## İlk denemeler ve beklenen hatalar

Bu sprintin ilk managed ölçüm ve normal Prisma koşuları başarılıdır; beklenmeyen başarısız test/build koşusu yoktur. Eksik SET/schema CREATE42501, probe01006/01007, orta/geç hata22012, runtime INSERT42501 ve drift reddi **beklenen negatif kanıtlardır**. V4.3b.11'in önceki hata/diagnostic kayıtları yeniden başarılı test gibi sunulmadı; eski raporlar değiştirilmedi.

İlk ölçümden sonra yeni orta-aşama tam-security rollback ve candidate notice-code kontrolleri eklendi; nihai pinli managed koşu bu ek kontrolleri de çalıştırdı. İlk Vitest ve nihai Vitest417/417. Şema hash'leri değişmediği için yeni function pini uydurulmadı; ACL değişimi ayrı pin olarak kaydedildi. `src/lib/rate-store.ts` geniş `.data` build uyarısı devam eder, derleme hatası değildir.

## Kanıtlar ve teslim koruması

`.data/v43b12/`: `managed-measure.log`, `managed-pinned.log`, `normal-fixture.log`, `vitest-initial.log`, `vitest-final.log`, `typescript.log`, `lint.log`, `build.log`, başlangıç/final preservation manifest'leri. Fixture dizinlerinde `managed-contract-snapshots.json`, `acl-owner-boundary.json`, `function-acl-postflight.json`, `migration-notice-codes.json`, `stock-schema-measured.json`, `managed-acl-measured.json`, normal `stock-runner-acl-measured.json`, `executor-membership.json` ve `verification.json` bulunur.

Kanıtlar/credentials/.data/generated artifact'lar GitHub kapsamı dışıdır. Özellikle bağımsız probe testinin tek fonksiyondaki SET sonrası düzeltmesi gerçek migration sonucuna ACL müdahalesi değildir: probe tamamen rollback olur, ardından yeni SQL sıfırdan çalışır. Managed contract pozitif kontrolü herhangi bir target fonksiyon grant/revoke test enjeksiyonundan önce geçer. Sonraki negatif testler yalnız kendi bozuk durumunu kaldırır.

Yerel yeni managed post `3ab7232843c282dae790b6a5f87c81222f2908a1b3a2c80fd89f54b58ccf4a38`; yeni SQL SHA `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`. Stock/managed/contract checksum referansları eşit. Geniş role/grantor/ACL sözleşmesi değişmedi. LAST_REPORT'un başlangıç baytları yeni özetin altında aynen korunur; b10/b11 raporları korunur. git diff --check ve hassas bilgi taraması geçti; kesin liste ana raporda11sprint/18birleşik dosyadır.

Gerçek Neon development/test/production SQL, provider GET/mutation, recovery branch işlemi, migration apply, gerçek rol/ACL/GRANT, R2/restore/snapshot, .env.local değişikliği veya Git commit/push/merge yoktur. Sonuç yalnız yerel ACL_FIX_PASS; provider-specific yaşam döngüsü, eksik managed grantor pre kanıtı, gerçek post kabulü, ROLE_DELTA_UNRESOLVED ve bağımsız backup/restore engelleri açıktır.
