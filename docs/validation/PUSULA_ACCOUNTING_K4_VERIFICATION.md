# K4 — izole yerel doğrulama

23 Ekim 2026. **K4_LOCAL_PASS.** Bulut/pilot BLOCKED.

## Çalıştırılan kontroller

| Komut | Sonuç |
| --- | --- |
| `npm.cmd test` | PASS: 40 dosya / 460 test |
| `npx.cmd tsc --noEmit` | PASS, exit 0; build TypeScript kontrolü de geçti |
| `npm.cmd run lint` | PASS, exit 0 |
| `npm.cmd run build` | PASS, exit 0; Prisma generate + Next 16.4.1 production build |
| `node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | PASS: 9 Git LF/tarihsel checksum kontrolü |
| `node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --k4 --k4-browser` | PASS: 227 API/SQL kontrolü + desktop/mobile 2/2 |
| `git diff --check` ve korunan dosya hash'leri | PASS |

Nihai fixture: **`v42-c553c928-daa1-479f-82d1-f0124806b9ab`**. `status=PASS`, `serverStopped=true`, `failureCode=null`, `neonOperations=false`, `r2Operations=false`. Gerçek PostgreSQL 18.6 sunucusu kapatıldı. Tarayıcı testleri desktop 30,7s / mobile 14,1s, toplam 1,7 dakika. Son SQL kaynağının cari açılış bypass reddi de bu fixture'ın PostgreSQL log'unda ölçüldü.

Nihai komut log'ları `.data/k4/{vitest-accepted,tsc-final,lint-accepted,build-accepted,checksum-final,fixture-accepted}.log`; fixture `verification.json`, `accounting-verify-k4.log` ve `playwright.log` dosyalarıdır. Son kaynak hash'leri `.data/k4/final-source-hashes.json` ile yeniden karşılaştırıldı. Son build'de mevcut `rate-store.ts` için geniş `.data` dosya taraması uyarısı var; build exit 0'dır ve ilgili kur motoru değiştirilmedi.

## PostgreSQL kabul kapsamı

`verify-k4.ts` gerçek API + izole PostgreSQL üzerinde şunları ölçer:

1. 3.000 TL peşin kira: tek gider, 2.500 net / 500 KDV / 3.000 kasa çıkışı ve üç posting.
2. 5.000 TL vadeli bakım: tek gider ve tedarikçi borcu; kasa değişmez.
3. 2.000 kısmi + 3.000 son ödeme: kalan 3.000 → 0; gider belge sayısı artmaz.
4. Aynı intent'in eşzamanlı/yeni request key replay'i, değişmiş payload ve yeni intent'le aynı belge referansı; ikinci ekonomik kayıt yok.
5. Fon hareketi INSERT izni geçici kaldırılarak geç hata: belge, operation, journal, posting, hareket ve finans audit'i tamamen rollback; izin finally'de geri verilir. Ayrı intent audit'i finans rollback'i sayılmaz. Yetersiz fon da tam rollback.
6. 12.000 brüt gerçek satış/tahsilat, 8.000 ödeme/gider; net/KDV/brüt ve nakit farkları ile bağımsız journal toplamı mutabakatı.
7. Aktif ödeme varken gider ters kaydı reddi; peşin giderin ertesi gün terslenmesi önceki gün raporunu değiştirmez, ters dönem eksi gider/ödeme içerir.
8. Önce ödeme sonra vadeli gider ters kayıtları; tahsis/borç kapanır, kaynak belge sayısı değişmez.
9. Müşteri açılışı satış/gelir/tahsilat değildir; vade, as-of bakiye ve ileri tarihli reversal doğru yansır.
10. Oturumsuz istek, başka tenant/kullanıcı, company/activity, MASTER explicit finance.payables/materyal maliyet DENY ve runtime DML negatifleri. DENY altında outcome/close reddi; izin geri gelince gerçek SUCCEEDED sonucu korunur. `materials.costView` DENY tam özet/kâr okumasını da reddeder.
11. Gerçek finanssız kullanıcı oturumu gider/özet/fon tutarı okuyamaz ve gider yazamaz.
12. Decimal/tarih/kategori negatifleri, güvenli intent kapatma/geç POST reddi, MFA/fixture kapıları, PUBLIC EXECUTE kapalılığı ve migration sayısı 16. Cari açılış endpoint'i kasa ledger bypass'ını reddeder.

Mevcut K1 20, K2 15, K3 16; DB 11, Auth 62, Cloud 11, Supplier 16, Purchase 28, Stock 36 kontrolleri aynı genişletilmiş şemada yeniden çalıştırılır. K3 katalog beklentisi yalnız K4 fixture marker'ında 56/42'ye genişletilir; diğer iddialar gevşetilmez. K1/K2 suite kaynakları değiştirilmedi.

## Tarayıcı kapsamı

`k4.spec.ts` ayrı sentetik kullanıcılarla localhost uygulamasında gerçek parola/TOTP ve step-up kullanır. Mevcut K3 satış, nakit/EFT tahsilat, borç ödemesi, ekstre ve POS settlement senaryosunu; gider formundan 3.000 peşin kira, 5.000 vadeli bakım, dönem filtreleri, finans kartları ve tedarikçi ekstresini birlikte doğrular. Desktop ve mobile projelerinde belge genişliğinin viewport'u aşmaması da kontrol edilir. Screenshot/video/trace kapalıdır.

## Geliştirme sırasında yakalanan hatalar

- İlk Vitest sandbox içinde `spawn EPERM` ile başlayamadı; yerel süreç izniyle tekrar çalıştırıldı. İlk 460 testin birinde invalid Türkçe API decimal'i üst seviye refinement'ta Decimal exception üretti; guard düzeltildi, 460/460 yeniden geçti.
- `v42-bbfc9bf8-73e6-424c-81ef-29162e56c0d1`: özet JSON parametresinde eksik PostgreSQL type cast; tüm eski suite'ler geçti, K4 başlamadan sorgu reddedildi. Cast eklendi.
- `v42-7c2c4644-f552-4e71-adcd-60d9af893499`: peşin gider geçti; yeni tedarikçi hesabını oluşturan fonksiyonun aynı SELECT snapshot'ında okuma denemesi vadeli gideri reddetti. Hesap komutu ve takip eden SELECT ayrı SQL ifadeleri yapıldı.
- `v42-544b6ee0-89d7-4017-a7b8-a2ddfd9c2ac3`: ilk dokuz finans kontrolü geçti; payables DENY operation'ı RLS ile gizleyince outcome NOT_COMMITTED döndü. EXPENSE intent'i için outcome ve close'a açık güncel payables kontrolü eklendi.
- `v42-5cc5e6ef-51b2-4ff3-bd9a-8e0e9d56aff5`: 12 K4 ve tüm eski API/SQL suite'leri geçti. Desktop/mobile testleri kategori select'inde `getByLabel(... exact)` seçicisi option metinleri nedeniyle eşleşmedi. Erişilebilir combobox rolü/adı kullanıldı; finans assertion'ları gevşetilmedi. Sonraki son koşuya cari açılış bypass negatif kontrolü de eklendi.
- `v42-46a0865c-c0ad-4e08-a5ce-eaec4d9cd28f`: yeni maliyet DENY testinin değişkenleri yanlış test kapsamına eklendiği için K4 ReferenceError ile durdu; aynı hata ara build'in TypeScript kontrolünde de yakalandı. Test doğru kapsama taşındı; `tsc --noEmit` yeniden geçti. Bu koşu kabul sayılmadı.

Bu fixture'ların `serverStopped=true` kapanışı ölçüldü. Başarısız veya ara kısmi çalıştırmalar yerel kabul sayılmaz.

## Bütünlük ve sınırlar

Başlangıç hash'leri `.data/k4/start-hashes.json`; komut log'ları `.data/k4/`, fixture ölçümleri `.data/fixtures/{fixtureId}/` altındadır. Secret/bağlantı string'leri rapora alınmaz. `.env.local`, 001–016 SQL, K1/K2/K3 hazırlık SQL'leri ve raporları korunur. LAST_REPORT eski içeriğinin önüne yalnız K4 özeti eklenir. Başlangıçtaki kullanıcı değişiklikleri reset/stash/checkout ile değiştirilmedi.

Gerçek Neon/R2/restore/snapshot/production veya Git commit/push/merge yoktur. Cloud finance kapısı ve bağımsız backup/restore kabul engelleri açıkça devam eder; yerel sonuç managed/provider kabulü değildir.
