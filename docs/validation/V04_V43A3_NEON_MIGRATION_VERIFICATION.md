# V4.3a.3 — Neon migration015 verification

20.10.2026 · **MIGRATION_PASS / CLOUD_ACCEPTANCE_PARTIAL**

| Kapı | Gerçek kanıt | Sonuç |
|---|---|---|
| Yetki/bakım |Development015 açık onayı;tüm yazıcılar kapalı kullanıcı teyidi |PASS |
| Git |Beklenen feature dalı/HEAD1c41d04;önceki değişiklikler korundu |PASS |
| Provider/SQL hedefi |Development br-rough-darkness-ba6ow9zo,ep-blue-breeze-bavbjb7l,pusula_development |PASS |
| Recovery |br-broad-river-bavv5pey/ep-wispy-frog-ba755foo;READ ONLY yeniden karşılaştırma |PASS,kopya yaşı/RPO sınırı var |
| Checksum |İlk14+015 baseline/history eşleşmesi;015 SHA181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a |PASS |
| Bakım SQL kapısı |15:28:58.940UTC diğer client/prepared/çakışan lock0 |PASS |
| Son preflight |15:29:03.526UTC38/24,14başarılı,çözülmüş008=1,pending015,driftfalse |PASS |
| Apply |Güvenli runner tek apply;exit0,APPLIED40/26 |PASS |
| Bağımsız postflight |15:29:34.178UTC40/26,15başarılı,çözülmüş008=1,unresolved0,post-schema8pin |PASS |
| İzinler |6purchases permission/6MASTER/0diğer rol;runtime/auth/test/PUBLIC grant kontrolleri |PASS |
| Constraint/index |invalid/not-ready0,unvalidated0;FK tanımları pinli |PASS |
| Eski kayıtlar |37tablo rowcount+MD5 özet eşit;Permission/RolePermission eski altkümesi korunuyor |PASS |
| Runtime Prisma |pusula_runtime,READ ONLY,boş PO listesi ve olmayan detaynull |PASS (DAL) |
| API handler |Oturumsuz GET401 |PASS (negatif) |
| Oturumlu API |Gerçek kullanıcı session'ıyla200/404 |YAPILMADI |
| Kullanıcı liste/detay ekranı |Computer Use apps/browsers boş |YAPILMADI |
| Yazmalı kabul |Yeni test kaydı oluşturulmadı |YAPILMADI,ayrı senaryo/onay gerekir |
| Bağımsız backup |Önceki kapsam/rol/ACL engelleri |AÇIK |

Son flagsiz runner `ALREADY_APPLIED,applied=false`;ikinci deploy yapılmadı. Apply hata/retry/resolve yok. SQL TLS CA/hostname kontrolü korundu. AuthUser2/Membership2/Supplier1;SupplierMaterial0/Offer0;PO0/Line0. Permission66→72,RolePermission100→106;history toplam15→16 (eski resolved008 korunur). Diğer37 eski tablo içerik özetleri beklenen seed ekleri dışlanarak aynı.

## Kanıtlar ve kapsam sınırı

Gitignored `.data/recovery-v43a3/`: `preflight-final.log`,`apply.log`,`postflight-independent.log`,`postflight-runner.log`,`preservation-before.json`,`preservation-after.json`,`permission-check.json`,`runtime.json`,`final-comparison.json`,`before.json`,`after.json`,`source-before.json`,`source-after.json`,`recovery.json`. Private provider metadata/yerel digest'ler commit edilmez. Kod/SQL/env değişikliği yok. Tam uygulama test suite'i yeniden çalıştırılmadı;gerçek DB kontrolleri yukarıdaki kapsamla sınırlıdır.

Recovery capture12:47:55UTC;uygulama15:29UTC civarı. Ön karşılaştırmada toplam/schema/ACL eşitliği görüldü;capture sonrası aynı toplamlı değişiklikleri dışlayan full recovery-content kanıtı yoktur. Bakım penceresinde uygulama öncesi/sonrası içerik korunması ayrıca37tablo özetleriyle ölçüldü. MD5 karşılaştırması yedek değildir.

API kontrolü gerçek handler fonksiyonuna yapılmıştır;networkHTTP veya oturumlu yetki kabulü değildir. Mevcut scope'ta runtime Prisma okumaları session doğrulamasını temsil etmez. Gerçek detay kaydı yok;olmayan detay DAL null'u başarılı detay ekranı sayılmaz. Kullanıcının oturum açık uygulamasında liste ve detay kontrolü tamamlanmalı;gerekirse rapordaki somut sentetik yazma senaryosu ayrıca onaylanmalıdır.

Production,recovery,preview,snapshot kimlikleri/endpoint bağlantıları korundu. R2,restore/finalize,rol genişletme(015'in onaylıMASTER seed'i dışında),resource silme,ücretli plana geçiş yok. Bağımsız backup engeli kapatılmadı. Commit/push/merge yok.

[Uygulama komutu,ayrıntılı zaman/sonuç ve kalan kabul kapıları](../../research/PUSULA_V04_V43A3_NEON_MIGRATION_REPORT.md).

Mimo teslimi yalnız bu sprintin üç dosyası:`research/PUSULA_V04_V43A3_NEON_MIGRATION_REPORT.md`,`docs/validation/V04_V43A3_NEON_MIGRATION_VERIFICATION.md`,`LAST_REPORT.md`. Önceki raporlar korunmuştur.
