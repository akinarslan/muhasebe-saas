# V4.3b.3 — Yerel doğrulama

21.10.2026 · **V4.3b.3 — FIX_PASS**.

Bu belge gerçek Neon kabulü değildir. Yalnız yeni UUID,127.0.0.1 PostgreSQL18.6 fixture'ları kullanıldı. Her fixture kendi password/secret/port/data directory sınırına sahiptir;gerçek .env.local veya kullanıcı verileri değiştirilmedi.

| Grup | Sonuç / kanıt |
|---|---|
| DB/RLS |11/11;full-browser-first koşusunun stock öncesi grubu |
| Auth |C1 7,C2 9,C3 8,C4 11,C5 8,C6 6,C61 13;toplam62/62 |
| Cloud API |11/11;aynı full koşu |
| Supplier / PurchaseOrder |16/16 ve28/28;full ve candidate koşuları |
| Stock SQL/API |Son kaynakla36/36;final-api.log,fixture9440c109-90aa-4e07-b06a-6e1df0839648 |
| Migration safety |İlk15checksum,016checksum,pre/postfingerprint;gerçek Prisma deploy;lateSQL rollback ve executor rolü rollback PASS |
| Idempotency / concurrency |Aynı-key create,aynı receipt post replay,post+post;deterministik create+post/create+reverse,ikinci reversal ret |
| Ledger/cache |Bağımsız signed SUM = StockBalance,negatif stok0;başarısız işlemlerde lot/movement/batch/balance/audit rollback |
| Vitest |373/373,31dosya;vitest-final.log |
| TypeScript / ESLint |Son kaynakla PASS,exit0;typescript-release.log veeslint-release.log;0error/0warning |
| Production build |PASS,native exit0,PUSULA_BUILD_EXIT=0;build-release.log;mevcut rate-store .data tracing uyarısı |
| Gerçek Chrome desktop/mobile |4/4PASS;gerçek Chrome,v43a2/2+v43b2/2;candidate fixture,1.5dakika |

## Koşular

- `.data/v43b3/measure-elevated.log`:fixture e6417b91-d9e4-42d8-8af4-905a7d4ced24;SQL ayraç hatası;FAIL,serverStopped=true.
- `measure-second.log`:fixture d3812c15-b9f5-4703-be36-c99d79792e96;gerçek deploy/ölçüm PASS;testte eksik reverse version400;FAIL,serverStopped=true.
- `pinned-first.log`:fixture3d3feaaf-90dc-42f1-95ac-3b20be3fc19d;pinli deploy PASS,version test düzeltmesi henüz bu koşuya girmedi;FAIL,serverStopped=true.
- `pinned-second.log`:fixture f2407046-4513-4f78-9655-979651b854ce;AuthC2 9,Supplier16,Purchase28,Stock34;PASS,serverStopped=true.
- `full-browser-first.log`:fixture93029747-6ce1-4dfc-a590-9ec5e57a1189;DB11/Auth62/Cloud11/Supplier16/Purchase28PASS;stock fixture SET ROLE enjeksiyonu reddedildi,bu yüzden browser başlamadı;FAIL,serverStopped=true. Bu koşu tam başarılı gibi sunulmaz.
- `candidate-browser.log`:fixture8a7b9bd3-177e-4756-a807-1028b141443d;pinli deploy ve migration rollback,AuthC2 9,Supplier16,Purchase28,Stock35,browser4/4PASS;serverStopped=true.
- `final-api.log`:fixture9440c109-90aa-4e07-b06a-6e1df0839648;son test kaynağı ve ek in-flight outcome commit/rollback testiyleAuthC2 9,Supplier16,Purchase28,Stock36PASS;serverStopped=true. Browser bu koşuda tekrar edilmedi;uygulama kodu başarılı browser candidate'ıyla aynıdır.
- İlk build loglarında çıktı tamamlanmasına karşın PowerShell stderr wrapper exit1vardı;bu sonuç exit0diye raporlanmadı. Son build açık LASTEXITCODE kaydıyla tekrarlandı:native0. TypeScript/ESLint son kontrolü deexit0. git diff --check temiz;ilk15SQL checksum15/15aynı ve migration diff'inde yalnız016var.

## Senaryo ayrımı

F1:İki gerçek non-owner runtime connection ve gözlenen PG lock wait/blocking PID;aynı PO/depo create+post ve create+reverse;farklı depolarda fazla teslimat yarışı;aynı receipt paralel post tek batch. Doğal deadlock/lock-timeout başarı kabul edilmez. SQLSTATE40P01 API eşlemesi ayrı sentetik trigger testidir.55P03 gerçek3s header lock bekleme aşımıdır.

F2:2m→2m→tam reversal→0net/2kalan→yeni2m;farklı yeni lot;eski başlık POSTED ve immutable trace korunur;ikinci reversal reddedilir. Kısmi kabul ve aynı PO'nun ayrı satırları izoledir. OWN görünürlüğünde gizli başka aktörün reversal'ı net toplamdan düşülür. Yetersiz bakiye yalnız fixture yöneticisinin transaction içi sentetik enjeksiyonuyla sınanır;reverse reddedilince bütün enjeksiyon ve batch geri alınır.

F6:Commit öncesi zorunlu hata ve10s statement timeout tam rollback;commit cevabını kaybetme ve authorized outcome;post replay tek RECEIPT,reverse replay tek REVERSAL;gerçek foreign tenant/OWN/explicit DENY outcome engelleri. Son36kontrollük koşunun34.kontrolünde outcome'un in-flight post commit/rollback'ini gerçek row lock üzerinde bekleyip güncel sonucu verdiği de doğrulanır. UI yardımcı mantığı Vitest'te;ağ/yanıt kaybı gerçek Chrome+gerçekAPI/PG ile ayrıca sınanır. Mock/saf testler gerçekPG kanıtı diye sayılmaz.

Outcome GET business DML yapmaz;FOR SHARE transaction lock'u ile çalışan komutu bekler. Sorgu başarısızsa kesin sonuç sunulmaz. Henüz DB'ye ulaşmamış istek için NOT_COMMITTED yalnız kontrol anındaki durumdur. UI bunu açıkça belirtir ve otomatik mutation göndermez.

## Checksum ve sınırlar

Eski016: `4dc07f6a16c5d423b3dbafd06c377775212d728f701c5b3390a5dbb7cbbe5a89`.

Yeni016: `80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18`.

Yeni checksum ve schema fingerprint Mimo teslimiyle yeni referanstır. İlk15SQL değişmez. Cloud migration guard,backup kapsam kapısı ve .env.local korunur. Runtime Prisma15s artırılmadı;mal kabul runtime lock3s/statement10s,migration lock3s/statement30s/transaction60s ayrı tutulur.

İlk shell/spawn/SQL/test/encoding hataları ve düzeltmeleri [raporda](../../research/PUSULA_V04_V43B3_FIX_REPORT.md) korunur. Private log/credential/fixture dosyaları Mimo paketine girmez. Commit/push/merge yapılmadı;GitHub teslimi Mimo'ya aittir.
