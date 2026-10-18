# PUSULA v0.4 — Sprint V4.1 mimari denetim

19.10.2026 · `feat/pusula-v030-neon-cloud` · **Yalnız analiz ve uygulanmamış tasarım.** Başlangıç yerel31d8d9d; fetch sonrası uzak39c6001 ROADMAP ve3bcbe9e ARCHITECTURE commitleri `--ff-only` ile korundu. Yerel/uzak ayrışma yoktu; main'e işlem yapılmadı.

## Denetlenen kaynak ve bulgular

| Kaynak | Bulgu / V4.1 kararı |
| --- | --- |
| [ROADMAP](../ROADMAP.md), [ARCHITECTURE](../ARCHITECTURE.md) | 18.10 sözleşmesi esas: v0.4 katalog/tedarik/stok; gerçek üretim sarfı v0.5, cari/ödeme v0.6. Eski farklı faz açıklamalarının yeni kararları geçersiz kıldığı varsayılmadı. Bu iki dosya bu teslimde değiştirilmedi. |
| [NEON_CLOUD](../docs/architecture/NEON_CLOUD.md) | Pooled runtime/direct ops, ayrı auth rolü, işlem-local scope ve demo ayrımı korunur. Tarihsel E1 “restore yok” ifadesi güncel E2.3 yerel fixture kanıtının yerine geçmez; production hâlâ kapalı. |
| [AUTHORIZATION](../docs/security/AUTHORIZATION.md), [policy](../src/lib/auth/policy.ts), [catalog](../src/lib/auth/catalog.ts) | Explicit DENY/default deny ve mevcut costView/costEdit adları gerçek otorite; OWN/ACTIVITY/company scope. Tutar/approval ayarları tam yönetim UI desteği değildir. Yeni action matrisi henüz seed edilmedi. |
| [BACKUP_RECOVERY](../docs/security/BACKUP_RECOVERY.md), [E2.3](../docs/validation/SPRINT_E23_VERIFICATION.md) | Yerel restore31/31 eski35 tablo içindir; gerçek Neon backup/R2/kalıcı key kabulü değildir. Yeni tablolar/definer fonksiyonu otomatik backup kapsamına alınamaz. |
| [Prisma](../prisma/schema.prisma), 13 SQL migration | **34 uygulama modeli**, migration metadata ile **35 tablo**, **21 FORCE RLS**. DO/FOREACH6+5 tablo ve doğrudan10 tablo birlikte sayıldı; yalnız grep doğrudan FORCE sayısı10 eksik olurdu. |
| [DAL](../src/server/db/repository.ts), [context](../src/server/authorization/context.ts) | Transaction-local user/tenant/legalEntity; mevcut kaynaklar composite FK. Yeni actor/scope payload otoritesi değil. Internal repository public API yapılmaz. |
| [catalog servis](../src/server/cloud/business/catalog.ts), [belgeler](../src/server/cloud/business/documents.ts), [contracts](../src/lib/cloud/contracts.ts) | Strict sözleşme, version, advisory lock, idempotency, server Decimal/FX, costScopes projeksiyonu ve immutable snapshot altyapısı var. Henüz Supplier/receipt/stock modülleri yok. Mevcut Material.unit sadece4 tür; kg/litre pricing desteği iddia edilemez. |
| [handler](../src/server/cloud/handler.ts), [import](../src/server/cloud/business/imports.ts) | /api/cloud workspace dispatch mevcut modüller içindir; yeni path eklemek uygulama işidir. Başarısızlık503/demo fallback yok; import gerçek stok açılış belgesi yerine geçmez. |
| [backup PG](../scripts/backup/postgres.ts), [security](../scripts/backup/source-security.ts) | Tam tablo/RLS/TOC, 13 checksum ve5 function hash sabit. Yeni24 tablo+enum/trigger/definer değişimi fail-closed inceleme gerektirir. |

## Kritik tasarım kararları ve risklerin karşılığı

1. **Stok çift sayımı:** ROLL tek temel eksen linear_meter, m² sabit enden türetilir. StockLot'ta mutable kalan boy ve location otoritesi yok; Balance+ledger tek bilgi. Tek fiziksel rulo aynı anda iki konumda olamaz; bölme/remnant v0.5.
2. **Concurrency:** StockBalance yalnız ledger cache/kilit satırı; runtime doğrudan yazamaz. Tek posting fonksiyonu, global lock sırası, yetersiz stok ret, deferred batch/source coverage. Kilitsiz SUM veya yalnız TypeScript kontrolü yeterli değildir.
3. **Exactly-once sınırı:** işlem key/hash + kaynak belge unique; replay güncel izinle projekte edilir. Farklı key ile aynı fiziksel kabulü tekrar beyan etme riski yalnız teknik key ile çözülemez; kaynak belge/PO cumulative+operatör kontrolü gerekir.
4. **Tarih ve maliyet:** three-source ayrımı; özgül lot edinim değeri ve FIFO aday sırası seçildi, hareketli ortalama yok. Bu yeni tasarım kararı migration onayında teyit edilir. USD/TRY/FX/conversion snapshot immutable; Material manuel fiyat ve eski Sale/Quote değişmez.
5. **Gizlilik:** orijinal fiyat+FX de USD'yi türetebilir; yalnız usdCost alanını gizlemek yetersiz. DTO whitelist, kaynak+materyal costScopes, export/summary/audit dahil. RLS satır güvenliğidir; shared server role raw SQL kompromisini column-DLP çözüyor iddiası yok.
6. **Faaliyet/şirket:** supplier zorunlu şirket scoped; tüm yeni ilişkiler compositeFK ve activity guard. Cross-tenant UUID, aynı şirkette yanlış activity, owner kaynakları ve transfer iki tarafı ayrı denetlenir.
7. **DB garantisinin koşulu:** Prisma draft tek başına SQL RLS/trigger/posting garantisi sağlamaz. Uygulama migration'ında SQL guard'lar ve dar executor rolü olmazsa tasarım kabul edilmez. Definer fonksiyonu E2'de ayrı güvenlik incelemesi ister; mevcut yasak kaldırılmaz.
8. **İleriki kapsam:** v0.5 üretim/sarf/fire olay türleri yalnız future tasarım notudur; bu sürümde bunları post eden endpoint yok. Kasa/tedarikçi borcu/ödeme v0.6; finans defteri SupplierReturn'dan türetilmez.

## Gelecek test ve kabul matrisi — henüz çalıştırılmadı

Bu tablo V4.2–V4.6 için çalıştırılabilir testlerin tasarım girdisidir. PASS sonucu değildir. DB/RLS testleri gelecekte ayrıca onaylı **yeni izole fixture** üzerinde gerçek non-owner rollerle; mevcut Neon test DB bu görevde kullanılmadı.

| # | Senaryo / giriş | Beklenen kanıt |
| --- | --- | --- |
| 1 | Tek variant, iki supplier, farklı teklif para birimi/sürüm | N:N iki bağlantı; bağımsız teklifler, manuel usdCost ve priceHistory değişmez |
| 2 | 100m PO, 30+70m iki receipt | PO tek başına0, ardından30/100; exact satır/lot/ledger/balance/audit eşleşmesi |
| 3 | 100m üstüne1m, eşzamanlı iki kısmi kabul | Parent lock sonrası kümülatif≤100; biri gerekiyorsa409, yarım kayıt yok |
| 4 | Aynı receipt key/hash retry ve iki concurrent POST | Tek kaynak batch/lot/hareket; aynı ID, güncel izinli response |
| 5 | Aynı key farklı içerik; başka key aynı kaynak | İlki409; ikincisi tek source unique, ikinci stok yok |
| 6 | Bakiye10, paralel iki7 çıkış | Tek7 başarılı, diğeri409; bakiye3 ve ledger aynı |
| 7 | Yetkili/izinsiz doğrudan negatif balance/movement DML, TRUNCATE | Runtime grant ve posting guards reddeder; mevcut satır korunur |
| 8 | Transfer hedef insert/audit/commit aşaması zorunlu hata | İki taraf birlikte rollback; source değişmez, orphan credit yok |
| 9 | Tam transfer/replay/reverse; ters yönde eşzamanlı transfer | Toplam0, tek batch/pair; deadlock sınırlı retry, tekrar stok yok |
| 10 | 50m ROLL transfer20m; aynı ruloda iki konum | Partial ret; tam kalan transfer geçer, tek-konum kuralı korunur |
| 11 | Kısmi supplierReturn, fazla/tekrar iade | Receipt/lot cumulative ve mevcut balance sınırı; maliyet özgün; v0.6 finans hareketi0 |
| 12 | Receipt reversal'da bağımlı transfer/return; ikinci reversal | Bağımlılık çözülmeden ret; source geçmişi değişmez; ikinci tam reverse yok |
| 13 | 152cm×50m, 76m² purchase conversion | Tek50m bakiye;76m² türetilir; iki miktar toplanmaz |
| 14 | Bilinmeyen en, sheet0.5, kg↔litre/density eksik |422; rounding ile sessiz kabul yok, stok değişmez |
| 15 | Numeric NaN/Infinity/overflow/10. basamak | DB+API finite/precision ret; JS Number kullanmadan Decimal kanıtı |
| 16 | COUNTING sırasında receipt/transfer/return/reverse | Aynı location lock/freeze409; diğer lokasyon çalışır |
| 17 | Count expected10 observed8; onay/retry/cancel/sıfır fark | Tek-2delta, audit ve thaw; sıfır fark0movement; yetkisiz iptal ret |
| 18 | Unknown lot count ve eksik acquisition snapshot | Otomatik0 maliyetli lot yok; açık ayrı onaylı süreç gerekir |
| 19 | Çapraz tenant/şirket FK ve API ID; missing context | SQL23503/RLS ret, API görünmez404; başkasının kayıt varlığı sızmaz |
| 20 | ACTIVITY/OWN kapsamı, shared kart, explicit DENY+Master ALLOW | Sunucu ve non-owner SQL aynı deny; parent/child activity tutarlı |
| 21 | Maliyet izni olmayan stock.view/receipts.view | USD/TRY orijinal fiyat, nested snapshot, valuation/export/audit/aggregate sızıntısı yok |
| 22 | Yetki revoke sonrası idempotent replay/durum sorgusu | Güncel scope ile403/404 veya redacted DTO; eski maliyet response'u cache'den dönmez |
| 23 | Kullanıcı kendine grant/override/isMaster ve tenant body gönderir | Merkezi mevcut kontroller ve strict schema reddeder; audit kaybı yok |
| 24 | Makine137cm, medya152cm; lazer tip/kalınlık yanlış, doğrulanmamış UV medya | Uyumsuzluk422; isimden compatibility yok; verified capability gerekli |
| 25 | Recipe wrong product/variant/process, duplicate cost components | Composite/SQL guard ve strict calculation ret; aynı ink gideri iki kez toplanmaz |
| 26 | Published recipe/rate/offer veya posted child edit/insert/delete | Immutable/sealing guard ret; yeni revizyon geçer; eski preview sonucu sabit |
| 27 | Yeni supplier fiyatı/machine rate/TCMB→eski quote/sale | Eski USD/TRY/snapshot byte/hash unchanged; yeni preview açık yeni sürüm kullanır |
| 28 | PO revision/close/cancel ile concurrent receipt | Global lock/state guard; iki revizyona aynı remaining hak yazılmaz |
| 29 | Transaction commit sonrası ağ kopması/restart/ikinci login | Aynı key durum sorgusu tek committed belge; bulut kalıcılığı ancak sonraki onaylı Neon development testinde kanıtlanır |
| 30 | Ledger/balance ve receipt/return/transfer/count source coverage | Her lot/location miktar/cost mutabakatı; forged/missing/fazla movement commit'te ret |
| 31 | Definer function dış scope/raw caller, search_path saldırısı, executor membership | Yetkisiz EXECUTE/role yolu kapalı; FORCE RLS geçerli, arbitrary SQL/source yok |
| 32 | Yeni tablo/enum/function ile E2 eski allowlist | Backup BLOCKED; otomatik allowlist yok; ayrıca incelenmiş fixture dump+restore sonrası yeni kabul |
| 33 | Mobil/klavye/503/timeout/dirty drawer, demo-cloud ayrımı | UI testinde taslak korunur; yanlış başarı/offline fallback/double submit yok |

## Bu teslimde gerçekten doğrulananlar

58 modellik bağımsız [Prisma taslağı](../docs/architecture/drafts/V04_SCHEMA.prisma) yüklü yerel Prisma CLI ile `validate` işleminden geçti. Ayrı Git dışı config kullanıldı; `.env.local` yüklenmedi ve placeholder URL `127.0.0.1:1/design_only` ile hiçbir DB bağlantısı açılmadı. Validate SQL CHECK/RLS/trigger semantiğini veya migration uygulanabilirliğini doğrulamaz. Canlı Prisma config/şema, migration, uygulama kodu ve package/lockfile değişmedi. Yeni executable uygulama veya kalıcı schema generator eklenmedi.

Kaynak envanteri statik olarak karşılaştırıldı: migration CREATE TABLE adları + metadata = backup expectedTables35; DO/FOREACH ve doğrudan FORCE adları = expectedForcedTables21; draft eski34 ad + yeni24 ad =58, 102 draft relation. **54 yerel Markdown bağlantısı**, yedi teslim dosyasında yapılandırılmış yerel sırlara karşı tarama ve `git diff --check` geçti. `.data` ve `.env.local` Git dışında doğrulandı. FK index planı ve önerilen sayılar gözden geçirildi. İlk statik kontrol yardımcısının Git child process çağrısı sandbox EPERM aldı; subprocess ihtiyacı kaldırılarak açık yedi dosyalık listeyle bütün kontroller tekrar başarıyla tamamlandı. Bu bir migration veya DB testi değildi.

Tarihsel E2.3 Vitest258/258 veya restore31/31 bu sprintte tekrar çalıştırılmış gibi sunulmaz. Dokümantasyon değişikliği için DB/API/browser/build regression koşulmadı; yeni modüller için gerçek kabul matrisi yukarıda bekler.

## Açık kararlar ve ayrı operatör onayları

V4.1 tasarımı tamamlandı; uygulama güvenliği henüz kanıtlanmadı. Sonraki iş paketi için onay gerekenler: (1) canlı Prisma şemasına ve sürümlü SQL migration'a dönüşüm, (2) yeni izole fixture DB/rol oluşturma ve gerçek concurrency/RLS testi, (3) geliştirme migration/rol/grant/permission uygulaması, (4) supplier/UI/domain servis geliştirmesi, (5) profil/backfill/açılış stoku için gerçek veri mutabakatı. Production migration, main merge/deploy, gerçek Neon dump/R2/kalıcı key üretimi ayrı kalır.

V4.1 model kararları açıkça öneridir: şirket başına supplier; özgül lot maliyeti/FIFO çıkış öneri sırası; ROLL tam-rulo transferi; sayım boyunca lokasyon freeze; kg/litre pricing için ayrıca genişletme; unknown lot/açılış belgesi mevcut taslağın dışındadır. Bu tercihler bir ürün gereksinimiyle çatışırsa uygulamadan önce tasarım revizyonu gerekir, veri içe aktarma ile dolanılmaz.

Gerçek Neon backup rolünün PUBLIC TEMP/CONNECT/builtin large-object riskleri ve E3/E4 production kapıları kapanmadı. Neon Free/R2 korunur; yeni ücretli servis, yeni Neon bağlantısı, gerçek veya test DB şema değişikliği, SQL GRANT/REVOKE, Master/MFA/müşteri verisi işlemi yok. Gerçek migration, tablo oluşturma ve modüllerin uygulama koduna geçiş **bu teslimle yetkilendirilmiş değildir**.
