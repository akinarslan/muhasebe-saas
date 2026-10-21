# PUSULA V4.3b.3 — F1/F2/F6 düzeltme raporu

21.10.2026 · Dal `feat/pusula-v030-neon-cloud` · başlangıç `1287e82fd1df1357b128fb55f0966cd1789db5c4`.

Durum: **V4.3b.3 — FIX_PASS**. Başlangıç çalışma ağacı temizdi. Commit/push/merge yapılmadı. Gerçek Neon development/test/production, gerçek PO-2026-9893, Auth/MFA verileri, .env.local, R2 ve recovery branch'lerine işlem yapılmadı. Bütün yazmalı DB işlemleri yeni UUID ve loopback PostgreSQL 18.6 fixture'ları içindir.

## F1 — Kilit sırası

Önce create PO→depo, post/reverse kabul→depo→PO sırasındaydı. Şimdi ortak sıra PO→depodur;mevcut kabul üzerinde çalışan edit/post/reverse önce kendi kabul başlığını kilitler. Create mevcut kabul başlığı kilitlemez: idempotency advisory lock ve replay kontrolünden sonra PO→depo→yeni başlık/satırlar eklenir. Edit kabul→PO→kendi taslak satırlarını DELETE/INSERT eder;depo değiştirmez.

Post PO ve depodan sonra bütün ilgili PO satırlarını UUID sırasıyla kilitler;ardından bütün varyant advisory kilitlerini ortak sıralamayla alır. Böylece farklı PO'larda varyantların satır sırası ters olsa da advisory kilit sırası değişmez. Reverse hareketleri lot/location/id sırasıyla gezer, lot FOR UPDATE ardından balance UPDATE yapar. INSERT/FK anahtar paylaşım kilitleri, kilitlenmiş üst kayıtlar veya bu transaction'ın yeni immutable kayıtları üzerindedir. Özgün movement/batch/lot kayıtları değiştirilmez. Taslak line silme kilitleri kabul başlığıyla korunur. Aynı create key replay yolu mevcut kabulü değiştirmez.

İki ayrı non-owner runtime bağlantısıyla create+post/create+reverse testlerinde üçüncü fixture yönetici bağlantısı yalnız depo kilidini tutarak yarış sırasını deterministik kurar. pg_stat_activity ve pg_blocking_pids ile ikinci komutun create'in tuttuğu PO'yu beklediği doğrulanır;ardından blokaj bırakılıp iki transaction commit edilir. Post+post farklı kabul/farklı depo aşımı ve aynı kabulün paralel replay'i de test edilir. Gerçek yarışlarda deadlock/lock-timeout başarı sayılmaz. 40P01→409 STOCK_DEADLOCK,55P03→409 STOCK_LOCK_TIMEOUT;otomatik mutation retry eklenmedi.

## F2 — Tam reversal sipariş miktarını açar

Önce POSTED satırlar, reversal olsa da toplamda kalıyordu. Artık private, SECURITY INVOKER `v43b_net_received()` hem order picker hem OVER_RECEIPT için aynı SQL hesabını sağlar. POSTED kabulün RECEIPT batch'ine reversalOfBatchId ile bağlı REVERSAL varsa o kabul toplamdan çıkarılır. Reversal batch görünürlüğü yalnız executor'ın mevcut PO aggregate kapsamına eklenir;tenant/legalEntity FORCE RLS ve kullanıcının ham kayıt görünürlüğü korunur. Helper PUBLIC/runtime EXECUTE almaz.

2m sipariş→2m kabul→tam reversal:net kabul0,kalan2;yeniden2m kabul başarılıdır. Yeni lot ve immutable hareketler oluşturulur. Başlık POSTED kalır;eski lot/movement/batch silinmez veya güncellenmez. İkinci reverse ALREADY_REVERSED ile reddedilir. Kısmi kabul,aynı PO'nun farklı satırları,başka aktörün OWN altında gizlenen kabul/reversal toplamı ve yetersiz stokta atomik ret test kapsamındadır. Reversal fiziksel tedarikçi iadesi değildir.

## F6 — Belirsiz yanıtın uzlaştırılması

Repository ve scoped maxWait8s/timeout15s değişmedi. Mal kabul servis transaction'ında SET LOCAL lock_timeout3s/statement_timeout10s uygulandı. Migration016'nın3s/30s/60s sınırları yalnız migration içindir;runtime transaction_timeout ayarlanmadı. 57014/P2028→503 STOCK_OUTCOME_UNKNOWN;diğer bağlantı hataları mevcut genel503 yolunu kullanır.

`GET goods-receipts/:id/outcome?action=post|reverse` yalnız miktar/maliyet içermeyen id/action/state döndürür. Önce mevcut membership,tenant/company/activity ve receipts.view+ilgili işlem izni doğrulanır;SQL definer kapısı da izinleri yeniden doğrular. MFA yeniden istenmez:bu endpoint mutation yapmaz. Başlık FOR SHARE,başlığı kilitlemiş devam eden komutun commit/rollback'ini bekler;bekleyemezse sonuç doğrulanamaz. Business DML yoktur;row lock nedeniyle PostgreSQL READ ONLY transaction değildir. Batch ve başlık birlikte okunarak post/reverse sonucu ayrılır.

Ağ/5xx belirsizliğinde UI yalnız bir durum sorgusu yapar. Başarı doğrulanırsa başarı gösterir;NOT_COMMITTED mesajı kontrol anına açıkça bağlanır. Sorgu başarısız veya geçersizse tam olarak “İşlem sonucu doğrulanamadı; kayıt durumunu kontrol edin.” gösterilir. Kesin4xx sunucu hatası korunur;403 step-up akışı değişmez. Her yeni action önce eski başarı mesajını temizler. Otomatik yeni receipt/post/reverse gönderimi yoktur. Aynı receipt post tekrarı idempotenttir;reverse tekrarı çift negatif hareket üretmez.

Durum sorgusu,henüz DB'ye ulaşmamış bir isteği iptal etmez. NOT_COMMITTED kontrol anındaki gözlemdir,geleceğe dönük başarısızlık garantisi değildir. UI bu yüzden “kontrol anında” ifadesini kullanır. Tekrar işlem aynı receipt kimliğiyle yürütülür;başka anahtarla kör yeni stoklama yapılmaz. Tam ağ kesintisinde doğrulanmış sonuç iddiası yoktur.

## Migration ve kalite incelemesi

- Eski GitHub016SHA: `4dc07f6a16c5d423b3dbafd06c377775212d728f701c5b3390a5dbb7cbbe5a89`.
- Yeni016SHA: `80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18`.
- Yeni SHA ve policy/function fingerprint'leri `scripts/stock/migration-baseline.json` içindedir. Mimo teslimiyle yeni resmî referans bu olacaktır;eski GitHub checksum'u değişmektedir.
- İlk15 migration aynı baseline checksum'larıyla doğrulanır;dosyaları değiştirilmedi. Yeni SQL ölçümden sonra ayrı yeni cluster'da pinli gerçek Prisma deploy ile sınandı. Late SQL hatası enjeksiyonu tüm016nesneleri ve executor rolünü rollback eder;sonra gerçek deploy47tablo/33FORCE RLS ile tamamlanır.
- `STOCK_MIGRATION_REQUIRES_SEPARATE_CLOUD_REVIEW` ve gerçek development runner kapısı değiştirilmedi. Gerçek cloud runner açılmadı.
- SECURITY DEFINER:pg_catalog/public sabit search_path,public ile nitelenmiş business tabloları,PUBLIC EXECUTE revoke,NOLOGIN/NOBYPASSRLS ve non-owner executor korunur. Güvenilmeyen role public schema CREATE verilmez. Yeni outcome fonksiyonu aynı dar kapıyı kullanır.
- Deferred completeness/cache trigger'ı kaynak/bakiye mutabakatını korur. Mevcut geniş tarama büyük tenant'larda pahalı olabilir;bu sprintte yeniden tasarlanmadı. Reverse'in tam negatifliği SQL command+immutable/unique kapılarıyla korunur;gelecek sarf/transfer/iade modülleri ek doğrulama gerektirir.
- PO UPDATE yetkisi FOR UPDATE satır kilitleri için gereklidir. Bu sprintte PO UPDATE DML eklenmedi. Kolon bazında daraltma ayrı yetki incelemesi olabilir;runtime'a executor üyeliği verilmedi.

## Test kanıtı ve ilk başarısızlıklar

Ayrıntılı koşular [doğrulama belgesindedir](../docs/validation/V04_V43B3_VERIFICATION.md). İlk sonuçlar saklandı:PowerShell npm.ps1 execution policy;ardından sandbox esbuild spawn EPERM. npm.cmd ve yalnız yerel test için izinli execution kullanıldı. İlkSQL helper/outcome dollar-quote ayraç hatası gerçekPG'de yakalandı ve düzeltildi. Test fixture'ındaki reverse action version eksikliği400ile yakalandı;version eklendi. Browser test ekleme helper'ında CRLF anchor eşleşmedi;dosya yazılmadan durdu ve düzeltildi. PowerShell pipe ile eklenen Türkçe stringlerdeki encoding kaybı Unicode ile düzeltildi. İlk yetersiz bakiye enjeksiyonu runtime SET ROLE engeline takıldı;yalnız fixture yöneticisine taşındı,uygulama güvenlik sınırı gevşetilmedi.

Son kanıtlar:Stock36/36;ayrı full koşudanDB/RLS11/11,Auth62/62,Cloud11/11;Supplier16/16,Purchase28/28;gerçek Chrome desktop/mobile4/4;Vitest373/373,31dosya;TypeScript veESLint exit0;production build native exit0. İlk build wrapper'ı stderr yönlendirmesi nedeniyle1gösterdiği için çıktı başarı sayılmadı;son koşuda LASTEXITCODE açıkça yakalanarak PUSULA_BUILD_EXIT=0 doğrulandı. Mevcut rate-store.ts .data tracing pattern uyarısı sürer;build hatası değildir. Tam kaynak testlerinin ve browser'ın ayrı fixture sonuçları bir tek tam başarılı koşu gibi sunulmaz. Tüm fixture'lar serverStopped=true ile kapandı;ledger/cache mutabakatı ve legacy satır korunumu geçti.

Önceki başarısızlıkların logları .data/v43b3 ve ilgili UUIDfixture altında korunur;teslim paketine sır/log/fixture/build artifact'ları alınmaz. 40P01 eşlemesi gerçekPG trigger'ının sentetik SQLSTATE üretmesiyle sınanır;doğal deadlock üretildiği iddia edilmez. F1 yarışları gerçek ayrı bağlantılarla,10s timeout gerçek pg_sleep/statement cancellation ile sınanır.

## Mimo'ya kesin dosya listesi

```text
LAST_REPORT.md
docs/architecture/V43B_INVENTORY_CONTRACT.md
docs/validation/V04_V43B3_VERIFICATION.md
research/PUSULA_V04_V43B3_FIX_REPORT.md
prisma/migrations/202610210016_goods_receipts/migration.sql
scripts/stock/migration-baseline.json
scripts/stock/migration-fixture.ts
scripts/stock/verify-local.ts
scripts/stock/verify.ts
src/components/inventory-desk.tsx
src/lib/cloud/receipt-outcome.ts
src/server/cloud/business/inventory.ts
tests/auth-e2e/v43b.spec.ts
tests/receipt-outcome.test.ts
```

14dosya. .data,.env,sırlar,generated Prisma client,.next ve browser artifact'ları teslim dışıdır. Gerçek Neon016apply,cloud recovery/managed grant incelemesi ve bağımsız backup/restore kabulü bu yerel sprintin sonucu değildir.
