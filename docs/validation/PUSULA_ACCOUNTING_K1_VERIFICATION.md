# K1 — gerçek yerel doğrulama

22 Ekim 2026. **K1_LOCAL_PASS; cloud ve gerçek verili pilot BLOCKED.** Bu rapor yalnız bu görevde yeniden çalıştırılan testleri güncel kanıt sayar. [Kapsam ve sınırlar](../../research/PUSULA_ACCOUNTING_K1_REPORT.md).

## Gerçekte çalıştırılan kontroller

| Komut | Sonuç |
| --- | --- |
| `npm.cmd test` | PASS, 428 Vitest testi; 11 yeni accounting input testi dahil |
| `npx.cmd tsc --noEmit` | PASS, exit 0 |
| `npm.cmd run lint` | PASS, exit 0 |
| `npm.cmd run build` | PASS, exit 0; Prisma generate + Next production build |
| `node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | PASS, 9 Git LF/historical checksum artifact kontrolü |
| `node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --accounting-profile` | PASS; gerçek PostgreSQL18.6, Auth C2 9 + K1 20 kontrol |
| `node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture` | PASS; ayrı PostgreSQL18.6 fixture'da DB11, Auth62, Cloud11, Supplier16, Purchase28, Stock36 |
| `git diff --check` | PASS |

Komut çıktıları `.data/k1/{vitest,tsc,lint,build,git-lf-artifact,fixture-final,regression-fixture}.log` altında yereldir; Git teslimine dahil değildir. Test ve build alt süreçleri sandbox'ın spawn kısıtı nedeniyle yetkili yerel çalıştırma ile başlatıldı. Uzak DB veya provider komutu yoktur.

### Fixture kimlikleri

- Nihai K1: `v42-d4b8cb5a-0264-400f-8b52-8c68359bab5f`, `status=PASS`, `serverStopped=true`, `failureCode=null`.
- Tam mevcut modül regresyonu: `v42-67cb097e-2ccc-42bb-9646-a21ab1d93187`, aynı PASS/stop sonucu.
- İlk geliştirme denemesi `v42-11456d2f-5d2c-4ea6-9960-a9267e8eba53` FAIL idi: ters kaydın ertesi günü ile bugünkü ekstre beklentisi uyuşmuyordu. Test tarihi düzeltildi, açık as-of testi eklendi. Sunucu kapandı. Ara başarılı 19 kontrollü fixture nihai 20 kontrollü kabulün yerine sayılmaz.

Her iki nihai çalışma mevcut harness'in UUID dizini, SCRAM kimlikleri, loopback, PG180006 ve process/data-directory doğrulamasını kullandı. Gerçek yerel Prisma 016 apply, rollback/lock/history/ACL/scope drift testleri de harness içinde yeniden geçti. Bulut 016 apply yapılmadı. K1 hazırlığı yalnız accounting profilinde 016 sonrasına eklendi; tam regresyon fixture'ı dağıtılan 16 migration şemasını kullandı.

### K1'in 20 integration kontrolü

1. Customer/Supplier bağlantısı ve aynı party hesabının tekrar oluşturulmasında aynı ID.
2. Eşzamanlı aynı açılış isteğinin tek journal olarak replay edilmesi.
3. Ekstre tarihi/vadesi, `0.30` Decimal tutarı ve eşit iki posting.
4. Aynı anahtarla farklı payload reddi; yanıtta tutar ifşası yok.
5. Yeni request anahtarıyla aynı açılış kaynağının reddi.
6. Pozitif tedarikçi borcu ve negatif müşteri bakiyesinin korunması.
7. Transaction hatasında journal, posting ve finance audit sayılarının tümünün değişmemesi.
8. Yetkili ters kayıt, idempotent replay, ikinci ters kayıt reddi, kaynak posting'lerin korunması.
9. As-of tarihinden sonraki hareketin ekstre dışında kalması ve tam sıfır açılış.
10. Runtime doğrudan DML, executor SET üyeliği ve PUBLIC EXECUTE reddi.
11. Administrative UPDATE/DELETE ile bile append-only ihlalinin reddi.
12. Yanlış tenant, kullanıcı, entity ve activity ile RLS'de boş sonuç.
13. MASTER explicit finance.accounts DENY ile hem API hem doğrudan RLS okuma reddi.
14. Sayısal JSON, fazla ondalık, USD ve geçmiş vade reddi.
15. Dengesiz iki posting'in deferred COMMIT sırasında reddi ve journal rollback'i.
16. Okuma yetkisi sürerken finance.approve DENY ile API ve doğrudan SQL komutu reddi.
17. Yanlış party, olmayan hesap ve yabancı entity reddi.
18. Eksik fixture veya uzak URL ile bulut kapısının context sorgusundan önce reddi.
19. Güncel step-up olmadan yazma reddi.
20. `_prisma_migrations` başarılı tarihçesinin 16 olarak kalması.

Vitest'teki 11 yeni test ayrıca üst sınır dahil Decimal string normalizasyonu; JSON number, exponent, NaN/Infinity, taşma, baştaki sıfır, virgül, fazla hassasiyet; geçersiz takvim günü; TRY/vade sözleşmesini sınar. DB kontrollerinin yerine unit test sonucu kullanılmadı.

## Bütünlük ve uygulanmayan işlemler

Başlangıç hash snapshot'ı `.data/k1/start-hashes.json`: ilk 15 SQL ve 016 byte hash'leri aynı; 016 SHA-256 `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`. Git LF artifact kontrolü tarihsel CRLF/LF checksum kurallarını yeniden doğruladı. Baseline/checksum/managed guard dosyaları değiştirilmedi. Hazırlık SQL'i canonical migration klasöründe değildir, otomatik resolve veya ikinci migration tablosu yoktur.

`ROADMAP.md`, iki plan/kabul dosyası ve `.env.local` başlangıçla byte-identical. `LAST_REPORT.md` önceki içeriği birebir korunarak başına K1 özeti eklendi. V4.3b.10/11/12 tarihsel raporlarına dokunulmadı. Git stage/commit/push yapılmadı. Test dosyaları sentetik veri ve değişkenlerden alınan geçici kimliklerle çalışır; gerçek Auth/MFA sırları, fixture dizinleri veya build çıktıları raporlara kopyalanmadı.

## Açık kabul engelleri

- Managed `postFingerprint=null`, `applyEnabled=false`, `STOCK_MANAGED_APPLY_DISABLED` devam eder. Gerçek 016 kabulü ve açık apply yetkisi olmadan 017 taslağının bulut dağıtımı hazırlanmış sayılmaz.
- K1 executor/ACL davranışı yalnız izole PostgreSQL18.6'da kanıtlandı; Neon provider davranışı ölçülmedi.
- Mevcut backup motorunun 35/21 allowlist'i ve managed object audit/bağımsız backup+restore kabulü güncel finans şemasını kapsamaz. Yeni motor veya gerçek backup/restore çalıştırılmadı.
- Recovery `br-late-river-baeipun8`, `token_roles / ROLE_DELTA_UNRESOLVED` değişmedi. R2 işlemi, snapshot/branch, restore veya cutover yoktur.
- Finans UI, satış alacağı, tahsilat/ödeme, kasa/banka/POS ve gider sonraki paketlerdir. Bu kabul yalnız K1 altyapısına aittir.
