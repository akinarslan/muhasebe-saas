# V4.3b.4 — Migration 016 yerel doğrulaması

21.10.2026 · **LOCAL_RUNNER_READY**.

Başlangıç HEAD ve upstream cd4ffcfeb576cef64b553c875e59617716ed1383;dal feat/pusula-v030-neon-cloud;başlangıç tree temiz. Gerçek Neon API/SQL,testDB/production,Auth/MFA,R2 ve recovery operasyonu yapılmadı. Her test yeni UUID/loopback PostgreSQL18.6fixture içindir.

## Doğrulama matrisi

| Grup | Sonuç |
|---|---|
| SQL bütünlüğü |016SHA80229d59…f4bbe18aynı;ilk15SQL ve baseline korunuyor |
| Preflight |40/26/15,015schema ve ayrıACLprepin;PASS |
| Apply/postflight |Gerçek Prisma deploy,47/33/16,016schema veACLpostpin;PASS |
| ALREADY_APPLIED |History birebiraynı,ikinci deploy yok;PASS |
| Drift |YanlışACLpin,kolon,kısmitablo,rawgrant,executorBYPASSRLS,NO FORCE RLS,historychecksum reddi;PASS |
| Hata enjeksiyonu |GeçSQLdivisionbyzero rollback;gerçek3slocktimeout preflight vePrismaapply;failedhistorydurması;PASS |
| Rol/ACL/izin/function |Ölçüm ve ayrı pinli koşu;şema/default/table/column/function/databaseACL,rol/sahiplik/üyelik,Permission/RolePermission pinleri;PASS |
| Auth/Supplier/Purchase/Stock |final-acceptance.log:DB/RLS11/11,Auth62/62,Cloud11/11,Supplier16/16,Purchase28/28,Stock36/36;PASS |
| Vitest |Son379/379,32dosya;vitest-final.log;exit0 |
| TypeScript/ESLint |Son kaynaklaPASS,exit0;typescript-final.log/eslint-final.log;0error/0warning |
| Production build |PASS,nativeexit0,PUSULA_BUILD_EXIT=0;build-release.log;mevcut .data tracing uyarısı |

## Koşular ve ilk başarısızlıklar

- `.data/v43b4/measure-first.log`:fixture3e5f99f8-04b6-4aa5-93f4-aa3fe8376d05;cluster kimlik normalizasyonu kontrolündeFAIL,serverStopped=true. inet host() veWindowscase/dizin normalizasyonu eklendi;ham bağlantı bilgisi loglanmadı.
- İlkTypeScript kontrolü test env literal'ında zorunluNODE_ENV eksikliğini buldu;test env düzeltilerek geçildi. Hata shell çıktısında saklandı;uygulama veya SQL değişikliği gerektirmedi.
- `measure-second.log`:fixture2a2165c0-bdd0-426e-9e5b-54c0549fdfc7;ilk ACL ölçümü veAuthC2/Supplier/Purchase/Stock regresyonları;databaseACL kapsamı sonradan eklenince bu ölçüm resmî pin yapılmadı.
- `measure-final.log`:fixture297ee843-ea64-4862-b291-ad3ab0531061;genişletilmişACLölçümü;AuthC2 9,Supplier16,Purchase28,Stock36PASS;serverStopped=true. Ölçüm JSON'u yalnız ignoredfixture'a yazıldı;baseline'a kopyalama ayrı adımdı.
- `pinned-first.log`:fixtured6a0dc3e-6b0b-49a4-9661-5f2b6b6d981f;LOCKenjeksiyonu preflightcatalog sorgusunu da engelledi. Beklenen applyhatasından önce55P03geldi;FAIL,serverStopped=true. Preflightlocktimeout ayrı sınıflandırıldı veapplyenjeksiyonu yerel fixturehookile preflightsonrasına taşındı.
- `pinned-second.log`:fixturea0f313c3-7a40-4e87-9d7e-711e6a1caacd;gerçek runnerpreflight,contention/rollback,apply/postflight veALREADY_APPLIEDPASS;AuthC2 9,Supplier16,Purchase28,Stock36PASS;serverStopped=true.
- `full-release.log`:tamfixture52d44052-5d4d-4ebb-80dc-960211aa77df;runner20kontrol,migrationrollback/deploy,DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36PASS;serverStopped=true.
- Son kaynak incelemesinde ACL pin JSON'unun null/bozuk olmasının denetimi atlamaması için requireAclPins eklendi; yeni negatif test ile Vitest toplamı 379 oldu. `final-acceptance.log`: fixture4d25f6b4-942d-479b-9026-3b90fa42bcfa; son kaynakla runner20, DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36 PASS; serverStopped=true, exit0. ACL ölçüm modundaki kullanılmayan post placeholder da64hex biçimine getirildi; normal baseline hash'leri değiştirilmedi.

Son Git kontrolünde HEAD/upstream hâlâ başlangıç commit'idir. Migration001–016, eski cloud runner, mevcut migration baseline dosyaları ve scripts/backup için diff yoktur. İlk15SHA15/15eşit;016SHAaynenkorunur. git diff --check temizdir. Build'deki tek mevcut .data tracing pattern uyarısı kapsam dışı performans uyarısı olarak korunmuştur.

Failed Prismahistory satırının silinmesi yalnız runner-fixture.ts içindeki sentetik tek test satırına uygulanır;runner'da resolve/delete/retry yolu yoktur. Üçüncü test bağlantısının kilidi ve hook yalnız loopbackfixture'a aittir. Mevcut source SQL ve baseline dosyaları hata enjekte etmek için değiştirilmez.

## Yeniden üretim

```text
npm.cmd run stock:test:local -- --approve-local-fixture
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
npm.cmd run build
```

İlk komut tek kullanımlık yerelcluster oluşturur vekapatır;gizliURL/secret'lar childenv ile verilir. Runner'ın preflight/apply/tekrar/hata testleri,regresyon script'lerinden önce çalışır. `--measure-runner` yalnız ayrı bilinçli ölçüm içindir;normal runner pinleri otomatik güncellemez.

ACL pre:`d54f91f77fcd5b3dcadaab534d3bd6f03fd581ed3afc72cec18641db45c20efa`.

ACL post:`00dc3dc15d3a9b5bc94a817c7923b771d76272b6c528c0fbe881f4ee0a69c6e7`.

Bu pinler Neon managedACLuyumluluğu kanıtı değildir. Eski cloudrunner guard'ı ve35/21backupallowlist aynen kalır. Güncel pre-016recovery oluşturulmadı;kota,parentID/TLS veveri eşitliği bu sprintte canlıteyit edilmedi. Tam kurtarma planı,riskayrımı vekesin9dosyalık Mimo listesi [rapordadır](../../research/PUSULA_V04_V43B4_CLOUD_READINESS.md).
