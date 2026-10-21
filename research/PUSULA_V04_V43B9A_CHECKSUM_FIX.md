# PUSULA V4.3b.9a — CHECKSUM_FIX_PASS

## Sonuç

Git'ten alınan tarihsel LF migration'lar ile development'ta kayıtlı eski byte checksum'ları arasındaki uyumsuzluk, yalnız beş doğrulanmış dosya/hash çifti için dar karşılaştırma kuralıyla çözüldü. İlk 15 migration SQL'i, eski baseline ve tarihsel DB kayıtları değiştirilmedi. Migration dosyalarının okunan ham SHA-256 değerleri korunur; dosya veya DB history normalleştirilmez. 016 SHA aynı kalır: `7368c775ec5d9b2b126b4731d5985ec83d1cad077f2cd5904ff596a04f22b272`.

Başlangıç dalı `feat/pusula-v030-neon-cloud`, HEAD `f56caed5eadb64e76304777f83477f1677c19d19`. Önceki V4.3b.5–9 ve DELIVERY_BLOCKED raporları tarihsel kayıt olarak korundu. Commit/push/merge yapılmadı. Bu sprintte gerçek Neon SQL/API, production/test/recovery kaynağı, R2 veya `.env.local` işlemi yoktur. PostgreSQL testleri yeni izole UUID/loopback fixture cluster'larındadır; gerçek Neon'a migration 016 uygulanmadı.

## Önce gerçek PostgreSQL history kanıtı

Canlı Neon SQL yasağına uyularak, önceki gerçek development READ ONLY okumasının ham history kayıtları incelendi: `.data/recovery-v43a1/live-readonly.json`, zaman `2026-10-20T12:09:34.380Z`. Eşlik eden `live-readonly.ts`, kayıtların `public._prisma_migrations` tablosundan REPEATABLE READ READ ONLY transaction içinde okunduğunu gösterir. Dosyadaki yalnız migration metadata'sı kullanıldı; Auth/MFA/session satırları okunmadı. Bu yeni canlı gözlem değildir.

Bu ham kayıtta beş migration'ın başarılı checksum'ları mevcut baseline ile birebir eşleşir. Dolayısıyla sorunun eski baseline'ın yanlış hash taşıması olduğu varsayımı bu tarihsel kanıtla desteklenmedi. Sonraki V4.3b.8 gerçek READ ONLY kanıtı da 15 başarılı migration'ın baseline checksum'larına eşit olduğunu kaydetmişti; bu toplu sonuç, eski ham satırların yerine yeni ham history dump'ı gibi sunulmadı. Güncel DB durumunun ayrı cloud denetiminde yeniden teyidi gerekir.

Ek somut bulgu: eski resolved 008 kaydının checksum'u `35ca1ae820b9e040ef189f3ff346381c591a268b74e4c37f639e94d2dded1fd9`; aynı migration'ın başarılı kaydı `db552670276d5e5d5b7ed37a78cc618bac9a79d8dc3e5d72cabe239dd4e7d36a`. V4.3b.9'daki yalnız başarılı dosya checksum'unu kabul eden kontrol gerçek eski rollback için yetersizdi. Şimdi bu **tek** kanıtlanmış failed checksum yalnız finished=false/rolled_back=true olan 008 history satırında kabul edilir. SQL artifact'ı veya başarılı migration checksum'u olarak kabul edilmez; aynı 008 için tam bir başarılı kayıt ve en fazla bir rollback şartı korunur.

## Bağımsız byte ve Git analizi

`core.autocrlf=true`, sistem Git config'inden gelir. `core.eol` tanımlı değildir. Committed `.gitattributes` kuralı `prisma/migrations/**/migration.sql text eol=lf`. Beş dosyada `git ls-files --eol` çıktısı `i/lf w/mixed attr/text eol=lf` oldu.

Önceki teslim raporundaki genel “CRLF dosya” ifadesi burada daha kesinleştirildi: çalışma ağacındaki beş dosyanın tamamı CRLF değildir. Her birinde **yalnız son LF önünde tek bir CR vardır**; diğer satırlar LF'dir. Git blob'u hiç CR içermez. Her dosyada şu byte eşitliği doğrulandı: `workingBytes == gitBytes[:-1] + b'\r\n'`. İçerik, UTF-8 karakterler, SQL komutları, boşluklar ve diğer satır sonları aynıdır.

| Migration | Git / çalışma boyutu | Ek CR'nin sıfır tabanlı konumu | Git LF adedi |
| --- | --- | --- | --- |
| 004 auth_mfa | 1936 / 1937 | 1935 | 52 |
| 005 authorization | 7494 / 7495 | 7493 | 171 |
| 007 resource_policy | 6304 / 6305 | 6303 | 72 |
| 008 company_metadata | 635 / 636 | 634 | 10 |
| 012 cloud_catalog_controls | 980 / 981 | 979 | 19 |

| Migration | Çalışma ağacı = baseline = başarılı PostgreSQL history SHA-256 | Git HEAD LF blob SHA-256 |
| --- | --- | --- |
| 004 | `96a7e660105b3ff8f897e0894d6eb8ceea3ee7152a4747c04cd1cbf449020644` | `eced9930cf54c6253430f3a5b3a77d4e98906ee6978b620769be8af181359abb` |
| 005 | `27bfae7c1ba1622774e57d4fe226893f46089b5c68bef3e8779fe2c7c7ed899a` | `813bb385499c1f39c7a808ca030ac8f9585ddbb4db32bbfa0d7b6f6858b04a98` |
| 007 | `b0154ad979dd5a3ba077dbfa65379fee95eb420283b59166c2c52ca0a986bd86` | `014cf289639104b7549448d0a0c752feb153c7be07cc707eaa9cfe55a48cba6d` |
| 008 | `db552670276d5e5d5b7ed37a78cc618bac9a79d8dc3e5d72cabe239dd4e7d36a` | `5aa71bc7fd52a4d06b053623205dbe9f5530959bd46682dd7030722c1f2955ec` |
| 012 | `ee460b6466adbae8755b64840af36de3eb4d52756947ce6e6153fb2a791e2e2e` | `5179a9075660b49861b9176fc5713e28c6ee59109f083473525a1209a77ced39` |

Git'in text/eol işlemesi repository blob'unda bu CR'leri kaldırmıştır; mevcut çalışma dosyalarının karışık satır sonları ile baseline tarihsel byte biçiminden kalmıştır. Hangi editörün veya işlemin ilk CR'yi eklediğine dair kanıt yoktur. Git/config/attributes değiştirilmedi; kaynak dosyalar yeniden checkout veya renormalize edilmedi.

## Güvenli kabul yöntemi

Yeni `scripts/db/migration-checksum.ts` yalnız yukarıdaki beş **tam migration adı + iki sabit SHA-256** eşleşmesini bilir. İki yönde karşılaştırma yapılabilir; bu, SQL'in aynı gözlemlenmiş iki byte biçiminden biri olduğunu doğrular. Ad değişirse, hash bilinmiyorsa veya tek bir byte farklıysa bu özel kabul uygulanmaz. Diğer dosyalar ve 016 için ham checksum eşitliği gereklidir.

Genel LF/CRLF dönüştürme, whitespace trim, BOM silme, metin decode/re-encode veya otomatik baseline güncelleme yoktur. Tamamen CRLF'ye dönüştürülmüş ama gözlemlenmemiş üçüncü biçimler de reddedilir. `migrationFiles()` hâlâ dosyanın gerçek ham hash'ini döndürür; history checksum'ları yazılmaz. Uyumluluk yalnız güvenlik karşılaştırması noktasındadır.

Kural eski DB runner dosya kontrolünde, ortak başarılı history karşılaştırmasında, stockFiles/stock history kontrolünde ve yerel fixture giriş kontrolünde kullanılır. Eski cloud guard, target/TLS allowlist, stock loopback/UUID kontrolü, 016 sabit SHA, şema/ACL pinleri, advisory lock ve transaction/timeout sınırları korunur. Managed cloud apply hâlâ koşulsuz kapalı; managed post pin hâlâ null'dır. R2/backup ve recovery kontrollerine dokunulmadı.

## Eski ve yeni davranışın gerçek doğrulaması

Önceki teslimde Git artifact'ıyla gerçek `stockFiles()` çağrısı `STOCK_LEGACY_CHECKSUM_REJECTED` vermişti. Yeni kodla aynı LF artifact kabul edilir. `.data` altında oluşturulan yeni UUID artifact'ları ilk 15 SQL'i doğrudan `git show HEAD:<path>` baytlarıyla, henüz commit edilmemiş 016'yı çalışma ağacındaki sabit SHA'lı adaydan alır. Gerçek Git branch/worktree oluşturulmadı. Bu bir tam repository checkout iddiası değil, migration artifact ihracıdır.

`verify-checksum-artifact.ts` önce normal Windows çalışma ağacında gerçek stockFiles'ı, sonra izole LF artifact'ta aynı kodu çalıştırır. Tek karakter, SQL komutu, bilinmeyen checksum, eksik dosya ve yanlış migration adı artifact içinde denenip reddedilir. Kaynak dosyalara yazılmaz; deneme dosyaları yalnız o UUID artifact'ında değiştirilip geri konur. Başarılı/resolved history, unresolved ve çift başarı da gerçek güvenlik fonksiyonlarıyla sınanır.

Managed PostgreSQL fixture'ı gerçek ayrı non-superuser LOGIN session'ında, tarihsel eski failed 008 checksum'unu taşıyan sentetik resolved satırı korur. **Aynı gerçek PostgreSQL kataloğunda hem çalışma ağacı hem Git LF manifestiyle preflight ve postflight aynı sonucu verir.** Yeni 47/33/16 şema, rol sahipliği ve kalıntı denetimleri geçer. Bunun yanında normal Prisma runner fixture'ı ilk 15 migration'ı Git LF baytlarıyla uygular; gerçek engine, mevcut çalışma ağacı dosyaları ve LF history arasındaki kontrollü farklılığa karşı sınanır. Bu işlemler yalnız yeni izole test cluster'larındadır; gerçek Neon history'sine yazılmaz.

## Test sonuçları ve ilk başarısızlıklar

- Git artifact kontrolü: 9/9 PASS.
- İlk hedefli Vitest: 3 dosya / 39 test PASS (düzeltilmiş negatif test sonrası).
- Nihai Vitest: 34 dosya / 395 test PASS.
- Managed PG18.6: 14 managed + 9 artifact kontrolü; Supplier 16, PurchaseOrder 28, Stock 36 ve Auth C2 9 PASS; sunucu kapandı.
- Git LF history ile normal runner: 20 runner kontrolü, gerçek Prisma deploy/ALREADY_APPLIED/lock timeout/rollback; DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36 regresyonları. Kesin final durum ve fixture kimlikleri doğrulama belgesinde kaydedilir.
- TypeScript, ESLint ve production build: native exit 0. Mevcut geniş `.data` tracing uyarısı devam eder.

İlk denemeler saklandı: eski “Git artifact reddedilmeli” reproducer'ı yeni kabul nedeniyle PASS yazıp kendi eski beklentisi gereği exit1 verdi; yeni pozitif verifier ile değiştirildi. İlk SQL negatif testi 008'de bulunmayan ALTER sözcüğünü değiştirmeye çalıştığı için byte'ları değiştirmedi ve yanlış beklentiyle başarısız oldu. Test CREATE/ALTER komutunu gerçekten değiştirecek biçimde düzeltildi; 39/39 ve artifact 9/9 tekrar geçti. Bu, üretim checksum kontrolünün değişmiş SQL'i kabul ettiği anlamına gelmez. Native cmd çok satırlı ilk çağrının yalnız formatter'ı çalıştırdığı görüldü; fixture komutu ayrı süreç olarak başlatıldı ve gerçek PG kayıtları alındı. Hiçbiri gizlenmedi veya geçmiş fixture sonucu yeni gibi sunulmadı.

## Korunan sınırlar ve sonraki teslim

30 korunacak dosyanın başlangıç SHA manifest'iyle karşılaştırması: ilk 16 SQL (016 dahil), eski baseline'lar, managed pinler, `.gitattributes`, `.env.local` ve önceki research/validation raporları değişmedi. Yalnız checksum güvenlik kodu, test harness'i ve yeni raporlar geliştirildi; LAST_REPORT başına bu sprint özeti eklendi. Git HEAD değişmedi. Geçici rol sahipliği çözümü korunur; managed fixture commit sonrası executor üyeliği/schema CREATE kalıntısını tekrar denetler.

`token_roles` ROLE_DELTA_UNRESOLVED kalır. Tarihsel provider 401, güncel managed preflight, Neon'a özgü role/grantor davranışı ve post pin enrollment ayrı cloud denetimi gerektirir. Recovery tam rol/restore kabulü değildir; bağımsız R2 ve 35/21 backup allowlist engelleri açık kalır. CHECKSUM_FIX_PASS, bulut apply veya GitHub teslimi yapılmış demek değildir.

## GitHub teslimine hazır kesin dosya listesi

V4.3b.9 ve önceki tamamlanmış raporlarla birlikte toplam 29 dosya; bu sprintte stage/commit/push yapılmadı:

1. `prisma/migrations/202610210016_goods_receipts/migration.sql`
2. `scripts/stock/migrate.ts`
3. `scripts/stock/migration-baseline.json`
4. `scripts/stock/migration-fixture.ts`
5. `scripts/stock/managed-preparation.ts`
6. `scripts/stock/managed-baseline.json`
7. `scripts/stock/managed-fixture.ts`
8. `scripts/stock/managed-fixture-baseline.json`
9. `tests/stock-migration-runner.test.ts`
10. `tests/stock-managed-preparation.test.ts`
11. `research/PUSULA_V04_V43B9_MANAGED_ACL_FIX.md`
12. `docs/validation/V04_V43B9_VERIFICATION.md`
13. `LAST_REPORT.md`
14. `research/PUSULA_V04_V43B5_RECOVERY_PREFLIGHT.md`
15. `docs/validation/V04_V43B5_VERIFICATION.md`
16. `research/PUSULA_V04_V43B6_RECOVERY_SAFETY.md`
17. `research/PUSULA_V04_V43B7_RECOVERY_CREATION.md`
18. `docs/validation/V04_V43B7_RECOVERY_VERIFICATION.md`
19. `research/PUSULA_V04_V43B8_NEON_COMPATIBILITY.md`
20. `docs/validation/V04_V43B8_VERIFICATION.md`
21. `reports/PUSULA_V04_V43B9_CODEX_DELIVERY.md` (tarihsel BLOCKED raporu)
22. `scripts/db/migration-checksum.ts`
23. `scripts/db/verify-checksum-artifact.ts`
24. `scripts/db/migrate.ts`
25. `scripts/db/migration-safety.ts`
26. `scripts/stock/verify-local.ts`
27. `tests/migration-checksum-compat.test.ts`
28. `research/PUSULA_V04_V43B9A_CHECKSUM_FIX.md`
29. `docs/validation/V04_V43B9A_VERIFICATION.md`

İlk 15 migration, eski DB baseline ve `.gitattributes` bu listede yoktur. `.data`, credentials, build/generated artifact'ları teslim edilmez. Tekrarlanabilir komutlar ve kanıtlar [doğrulama tablosundadır](../docs/validation/V04_V43B9A_VERIFICATION.md).
