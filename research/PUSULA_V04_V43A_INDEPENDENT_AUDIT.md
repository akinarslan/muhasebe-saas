# PUSULA V4.3a — bağımsız Codex denetimi

20.10.2026 · Karar: **AUDIT_FIX_REQUIRED / NO-GO**

TypeScript, ESLint, 344 birim testi ve GLM'nin yerel kabul testleri bağımsız tekrar koşusunda geçti. Buna rağmen ek adversarial testler bir kritik maliyet sızıntısı, üç yüksek önem düzeyinde kusur ve altı orta düzeyde kusur gösterdi. GitHub teslimi öncesinde düzeltme ve hedefli tekrar doğrulama gerekiyor. Uygulama, migration, Prisma şeması ve mevcut testler değiştirilmedi; commit/push yapılmadı.

## Kapsam ve kanıt sınırı

Başlangıç dalı `feat/pusula-v030-neon-cloud`, HEAD `2ab48ada004c830d1424cb95a8ab5a9ab052a55c`. Başlangıç durum/diff/hash kayıtları Git tarafından dışlanan `.data/audit-v43a/` altında. İstenen ROADMAP, ARCHITECTURE, AGENTS, V04_DATA_MODEL, V04_DOMAIN_SERVICES, V04_MIGRATION_PLAN, GLM raporu, doğrulama raporu ve LAST_REPORT okundu; değiştirilmiş tracked dosyalar ve yeni dosyalar incelendi. Next.js yerel `route.md` rehberi de okundu.

Tüm DB testleri bu denetimde oluşturulan ayrı PostgreSQL 18.6 kümelerinde, yalnız `127.0.0.1` üzerinde çalıştı. Neon development/test/production ve R2 bağlantısı yapılmadı. API testleri gerçek session, Prisma, non-owner runtime, RLS ve `cloudRequest(Request)` üzerinden yürütüldü; dinleyen Next.js HTTP sunucusu üzerinden ağ testi değildi. Ek SQL testlerinde fixture admin bağlantısı yalnız kurulum/izin değişikliği için kullanıldı; satır yarışı ve yanlış varyant INSERT'i gerçek non-owner uygulama bağlantısıyla yapıldı.

Masaüstü/mobil gerçek tarayıcı, görsel taşma ve klavye E2E çalıştırılmadı; PASS sayılmaz. UI için bir mocked API/jsdom bileşen testi çalıştırıldı. Üretim güvenliği veya canlı eski verilerin bütünü için garanti verilmez.

## Öncelikli bulgular

### F01 — CRITICAL: Material maliyet DENY kararı PO ayrıntısından aşılabiliyor

- Konum: `src/server/cloud/business/purchases.ts:93`, `:173`, `:215`, `:237`. Referans sözleşme: `docs/architecture/V04_DOMAIN_SERVICES.md:66` civarındaki kaynak maliyet izni + materyal maliyet kapsamı koşulu.
- Tetikleme: Kullanıcıda `purchases.view/costView` var; aynı şirket için `materials.costView` explicit DENY uygulanıyor. PO detail GET hâlâ `variantUsdCost` döndürüyor. `withCosts` yalnız sipariş kaynak iznine bakıyor; materyal kaynağının maliyet izni tekrar değerlendirilmiyor.
- Gerçek kanıt: `materials-cost-deny` probe sonucu HTTP 200 ve `variantUsdCost: "4"`. Bu değer teklif fiyatı değil, manuel `MaterialVariant.usdCost` snapshot'ı.
- Etki: İzin matrisiyle özellikle gizlenen katalog maliyeti alternatif API üzerinden okunabiliyor. Normal supplier teklifi DTO'sunun iki izinli koruması PO yolunda korunmamış.
- En dar düzeltme: Materyal maliyet snapshot'ını döndürmeden önce ilgili `variant.material` kaynağında `materials.costView` kontrolü yap; yetkisiz alana DTO'da yer verme. PO toplamı/kendi alış fiyatı politikasını kaynak bazında açık tut; materyal manual maliyetini bu izne otomatik dahil etme. Aynı DENY testini normal kullanıcı ve ACTIVITY/OWN kapsamlarında ekle.

### F02 — HIGH: Satın alma birimi fiyatı yanlış miktarla çarpılıyor

- Konum: `src/server/cloud/business/purchases.ts:121`, `:130`, `:137`; `src/lib/cloud/purchase-pricing.ts:34`, `:65`, `:80`.
- Tetikleme: Alış birimi `linear_meter`, temel birim `square_meter`, rulo eni 152 cm. `purchaseFx` fiyatı USD'ye dönüştürüyor ama temel birime bölmüyor; `purchaseLineMath` bunu temel miktarla çarpıyor. TRY dalı da normalizasyona sabit faktör `"1"` veriyor. Teklifteki alış birimi ile input biriminin eşitliği de kontrol edilmiyor; kademe karşılaştırması input miktarıyla doğrudan yapılıyor.
- Gerçek kanıt: 2 metre × 15,20 USD/metre = **30,40 USD** olmalı. API `orderedBaseQty=3.04`, fiyat `15.2`, toplam **46.208000000 USD** üretti. Manuel fiyat yolu da aynı matematiği kullanıyor.
- Etki: Faktör kadar yüksek/düşük sipariş toplamı; levha/rulo dönüşümlerinde finansal yanlışlık. Mevcut kabul testleri yanlış toplamı beklenen değer olarak sabitlemiş (`scripts/purchases/verify.ts` içindeki 13.7 ve 254.144 beklentileri).
- En dar düzeltme: Fiyatın paydasını açık tanımla; USD/alış birimini USD/temel birime faktöre bölerek çevir veya alış miktarıyla çarp. Teklif seçiliyken teklif birimini/kademesini koru; farklı input birimi destekleniyorsa miktarı teklif birimine açıkça dönüştür. Aynı fiziksel alımın metre/m²/levha eşdeğerlerini karşılaştıran bağımsız test kullan.

### F03 — HIGH: SQL satır silme/onay yarışı mühürlemeyi bozuyor

- Konum: `prisma/migrations/202610200015_purchase_orders/migration.sql:150`, `:155`; `src/server/cloud/business/purchases.ts:529`.
- Tetikleme: T1, DRAFT sipariş satırını runtime ile siler ve henüz commit etmez. Line trigger parent durumunu kilitsiz SELECT ile DRAFT okur. T2 aynı siparişi API ile onaylayıp commit eder. T1 sonra commit eder.
- Gerçek kanıt: `delete-approve-race`: `approval:200`, `deleted:1`, son durum `APPROVED`, `lineCount:0`. Onay audit'i oluşturulurken satır T2 snapshot'ında hâlâ görünürdür.
- Etki: Onaylanmış belgenin içeriği sonradan değişir; mühürleme/audit tutarsızlaşır. Normal PATCH header güncellemesiyle seri hale gelse de doğrudan izinli SQL yolu güvence altında değil.
- En dar düzeltme: Line INSERT/DELETE ve approve/cancel aynı parent satır kilidini, tutarlı sırayla alsın; kilit alındıktan sonra durumu tekrar doğrula. Boş sipariş onayını da DB seviyesinde reddet. İki gerçek bağlantıyla bu interleaving'i regresyon testi yap.

### F04 — HIGH: Runtime SQL yanlış varyant ve boş snapshot kaydedebiliyor

- Konum: `prisma/migrations/202610200015_purchase_orders/migration.sql:87`, `:103`, `:108`, `:150`; Prisma modelleri `prisma/schema.prisma:632`.
- Tetikleme: Geçerli DRAFT order ve supplier link kullanılıp satır `variantId` aynı şirkette başka bir varyant olarak gönderiliyor; `conversionSnapshot` ve `priceSnapshot` `{}` veriliyor. Composite FK'ler her referansı ayrı ayrı doğruluyor; `link.variantId = line.variantId` ve `offer.supplierMaterialId = line.supplierMaterialId` ilişkisini birlikte zorunlu kılmıyor. Snapshot biçim/hesap eşitliği guard'ı yok.
- Gerçek kanıt: `runtime-mismatched-variant-snapshot` probe gerçek non-owner Prisma bağlantısında INSERT başarıyla commit etti; link 152 cm varyantına bağlıyken satır 137 cm varyantını gösterdi. Boş iki snapshot da kabul edildi. Teklif-link uyuşmazlığı ayrıca runtime probe edilmedi; statik SQL boşluğudur.
- Etki: Sonraki onayla kalıcı yanlış malzeme/maliyet geçmişi; servis kontrolleri doğrudan SQL ile aşılabiliyor. Tenantlar arası FK atlatıldığı iddiası değildir.
- En dar düzeltme: Link/variant/offer/header eşitliklerini geniş composite FK veya dar constraint trigger ile doğrula; snapshot sürüm/decimal alanları ve quantity/factor/price eşitliklerini doğrula. Trusted shared runtime'ın raw maliyet okuyabilmesi ayrı bir tehdit sınırıdır; burada bulgu yazılan iş verisinin tutarlılığıdır.

### F05 — MEDIUM: DRAFT → CANCELLED her zaman CHECK'e takılıyor

- Konum: `prisma/migrations/202610200015_purchase_orders/migration.sql:94`, `:131`; `src/server/cloud/business/purchases.ts:558` civarı cancel yolu.
- Tetikleme: API taslak iptalinde approval alanlarını NULL bırakıyor; trigger bunu özellikle istiyor. Ancak CHECK, CANCELLED için `approvedAt IS NOT NULL` şartını zorunlu kılıyor.
- Gerçek kanıt: `draft-cancellation` HTTP 503 `SERVICE_UNAVAILABLE`; taslak iptal edilemiyor. Mevcut 16 test yalnız APPROVED → CANCELLED'i test ediyor.
- Etki: Geçerli iptal akışı çalışmıyor; kullanıcı bağlantı hatası sanıyor.
- En dar düzeltme: CHECK'i onaylanmadan iptal edilen kaydı da kabul edecek şekilde durum geçmişiyle uyumlu hale getir; damga kurallarını trigger'la çeliştirme. Taslak iptalini bağımsız test et.

### F06 — MEDIUM: Onay için yakın tarihli step-up uygulanmıyor

- Konum: `src/server/cloud/business/purchases.ts:517`, `:528`; `src/server/authorization/context.ts:76` civarında yalnız genel MASTER MFA kontrolü. Tasarım: `docs/architecture/V04_DOMAIN_SERVICES.md` approve step-up şartı.
- Tetikleme: Oturumun `stepUpAt` alanı NULL yapılır; MFA login geçerli kalır. Onay action'ı yalnız `purchases.approve` yetkisine bakar.
- Gerçek kanıt: `approval-without-step-up` HTTP 200, `approved:true`. Sahte/oturumsuz istek değil; geçerli MFA oturumudur.
- Etki: Tasarımın kritik onay için istediği ek kimlik doğrulama kapısı yok. Oturum ele geçirilmesi senaryosunda koruma zayıflar; tek başına başka tenant erişimi kanıtı değildir.
- En dar düzeltme: Mevcut `requireMfa(headers,true,source)` kapısını onaya uygula, sabit STEP_UP_REQUIRED yanıtı ve UI doğrulama akışı ekle. Normal kullanıcıyı da kapsa.

### F07 — MEDIUM: Create izni, edit iznine örtük bağımlı

- Konum: `prisma/migrations/202610200015_purchase_orders/migration.sql:114`; `src/server/cloud/business/purchases.ts:384` civarı create yetki kontrolleri.
- Tetikleme: Kullanıcıda view/create ve gerekli supplier/material erişimleri var; `purchases.edit` DENY. Header oluşturma izni var ama ilk line INSERT policy'si edit zorunlu tutuyor.
- Gerçek kanıt: `create-with-edit-denied` HTTP 503. Transaction başarısız olduğundan header tek başına kalmıyor.
- Etki: Master'ın ayrı create/edit izinleri çalışmıyor; yalnız sipariş oluşturması istenen personel oluşturamıyor.
- En dar düzeltme: İlk satır oluşturma komutunu create yetkisiyle, sonraki taslak değişimini edit yetkisiyle açıkça ayrıştır; edit DENY'ı genel yazma iznine dönüştürme. Normal rol/OWN kapsamlı negatif test ekle.

### F08 — MEDIUM: Manuel fiyatlı taslağı düzenlemek para birimi/fiyatı kaybediyor

- Konum: `src/components/purchase-desk.tsx:342`, `:349`.
- Tetikleme: TRY 50 fiyatlı mevcut satırda “Taslağı düzenle” açılır. `openDraft` DTO'daki fiyat ve para birimini taşımak yerine `manualCurrency:"USD"`, `manualUnitPrice:""` kuruyor.
- Kanıt: Statik kod + bağımsız jsdom bileşen testi, kaydedilmiş TRY 50'nin USD ve boş fiyatla açıldığını doğruladı. Bu test gerçek browser/DB değildir.
- Etki: Kullanıcı aynı fiyatı tekrar girmek zorunda; para birimini fark etmezse yanlış fiyat kaydeder. Kaynak kaydı yalnız editörü açmakla değişmez.
- En dar düzeltme: Yetkili DTO alanlarından manuel fiyat/para birimini yeniden yükle. Maliyet izni olmayan kullanıcı mevcut manuel satırı koruyacaksa server-side preserve semantiği tasarla; görünmeyen fiyatı boş alanla ezme.

### F09 — MEDIUM: Temel miktarda sessiz veritabanı yuvarlaması

- Konum: `src/lib/cloud/purchase-pricing.ts:27`, `:39`; `prisma/schema.prisma:645` civarı Decimal(24,9).
- Tetikleme: Dokuz basamaklı geçerli alış miktarı, faktörle çarpıldığında dokuzdan fazla basamak üretiyor. Faktörün scale'i kontrol ediliyor ama çarpımınki kontrol edilmiyor.
- Gerçek kanıt: `base-quantity-rounding` API 200; `1.000000001 × 1.52 = 1.52000000152` yerine DB `1.520000002` sakladı.
- Etki: Miktar ve saklanan fiyat/conversion snapshot eşitliği bozulabilir; tekrarlı kabul/hesaplamalarda hassasiyet kayması. Ölçülen örnekte fark çok küçüktür; büyük finansal zarar gösterilmedi.
- En dar düzeltme: Sonucun scale'ini doğrula ve reddet veya açık sürümlenmiş yuvarlama politikasını miktar/fiyat/snapshot boyunca aynı uygula. “Exact 9-place” yorumunu kanıtla uyumlu tut.

### F10 — MEDIUM: Eksik manuel fiyat validation'dan geçip 503 oluyor

- Konum: `src/lib/cloud/purchase-contracts.ts:18`, `:22`; `src/server/cloud/business/purchases.ts:132`.
- Tetikleme: `offerVersionId:null`, `manualCurrency:"USD"`, `manualUnitPrice:null`. Refine yalnız para biriminin varlığını gerektiriyor; fiyat zorunluluğu yok. Non-null assertion runtime doğrulaması sağlamıyor.
- Gerçek kanıt: `manual-null-price` HTTP 503. Fiyatı olmayan satır için tanımlı pending politika veya input hatası yerine servis hatası çıkıyor.
- Etki: Yanlış API sözleşmesi ve yanıltıcı hata yönetimi; işlem rollback oluyor.
- En dar düzeltme: Teklif/manual ayrımını discriminated validation ile tamamla. Fiyat zorunluysa NULL'u sabit input hatasıyla reddet; fiyat bekleyen satır desteklenecekse ayrı açık durum tanımla.

## Migration ve mimari değerlendirmesi

015 SHA-256: `e6327df97daa1c933b8d81c7f7dbbd1b8d62060994d75eb7f0c6ebbf06fe94cc`; dosya, baseline ve GLM raporu eşleşiyor. İlk 14 SQL dosyasında HEAD'e göre diff yok; ilk 14 baseline checksum da HEAD ile aynı. Gerçek migration safety koşusunda pre-015 sekiz yapı fingerprint'i ve post-015 sekiz fingerprint eşleşti. Bu pin eşleşmesi davranış güvenliğinin kanıtı değildir: yukarıdaki kusurlar pinlenmiş şemada vardır.

Migration BEGIN/COMMIT, session-local 3s lock, 30s statement ve 60s transaction timeout kullanıyor. Runner aynı bağlantıda advisory lock alıp Prisma child tamamlanana kadar tutuyor; child/backend sonlandırması invocation etiketiyle sınırlı. Checksum/kolon drift, lock/statement/child timeout, unresolved retry, nontransactional partial failure ve no-replay testleri geçti. Nihai SQL gerçek PG18.6 üzerinde uygulandı; eski 42P01/42703 hataları bu yolda yeniden görülmedi. OLD/NEW yalnız trigger fonksiyonlarında. Yeni business tabloları FORCE RLS; permissive scope ve restrictive action policy birleşimi var. UPDATE permission mapping trigger'da; yeni DELETE/TRUNCATE tablo grant genişlemesi yok. Bununla birlikte F03/F04/F07 business invariant eksiklerini gösteriyor.

Composite tenant/entity ve activity FK'leri mevcut. Temel negatif tenant ve şirket testleri geçti; yabancı supplierMaterial/offer ID için bütün olası API kombinasyonları ayrıca probe edilmedi. Activity/OWN normal kullanıcı matrisi eksiksiz çalıştırılmadı. Satır policy'sindeki `l.activityId IS NOT DISTINCT FROM o.activityId` şirket geneli linkin faaliyetli siparişte kullanımını da kısıtlıyor; tasarımdaki paylaşım davranışı ayrıca netleştirilmeli, doğrulanmış tenant açığı sayılmamalı.

V4.2 servisinin manuel materyal maliyetini teklif fiyatından ayırması ve supplier DTO'sunun iki maliyet iznini kontrol etmesi V4.3a'da korunmalı. PO create/approve stok, cari ve ödeme tablosuna yazmıyor; MaterialVariant.usdCost otomatik güncellenmiyor. Gerçek fixture'da variant/price history/quote/sale/sale-line içerik digest'i korundu. Audit summary'leri ham fiyat yerine lineCount/kimlik içeriyor; hata yanıtlarında raw SQL/fiyat görülmedi. Sipariş onayı ile mal kabulün ayrılması doğru; mal kabul, kapatma ve revizyon akışları bu sprintte uygulanmış sayılmaz.

USD identity ve EUR/GBP unavailable davranışı test edildi. TRY yalnız TCMB snapshot doğrulamasından geçiyor; mevcut teklif için yeniden güncel TCMB sorgulanması, geçmiş teklif kurunu her zaman çözemez. Gerçek tarihsel TCMB matrisi test edilmedi. KDV/iskonto için bu sürümde ayrı alan ve tam hesap sözleşmesi yok; gösterilen total yalnız mevcut USD satır toplamı, vergi dahil kesin toplam değildir.

Prisma'daki PO createdAt ve line variant indeks tanımları SQL 015'te CREATE INDEX olarak bulunmuyor; bu bakım/performance uyumsuzluğu sonraki migration diff'inde değerlendirilmelidir. PURCHASING şablonuna yeni izinler eklenmişken SQL seed yalnız MASTER'a ekliyor; mevcut ve sonradan şablon uygulanan kullanıcıların farklı davranması için ayrıca rol kabul testi gerekir. Bu iki statik gözlem için runtime zarar iddiası yapılmadı.

## UI değerlendirmesi ve sınırlar

Liste/status/arama, detail, çok satırlı drawer, busy/error durumları ve doğru catch-all dispatch mevcut. Company/activity değişiminde parent key'i bileşeni yeniden kuruyor; dirty onayı ve beforeunload koruması var. Supplier ve Purchase ayrı mount ediliyor; aynı anda iki bağımsız taslak tutulmuyor. Çift window.confirm gerçek tarayıcıda reproduce edilmedi; PASS/FAIL hükmü verilmedi.

F08 dışında offer-backed edit açılışında mevcut linklerin offer cache'i otomatik yüklenmiyor (`loadOffers` yalnız link değişiminde); edit-only kullanıcı için supplier listesi yalnız purchases.create ile yükleniyor. Bunlar statik UX inceleme notları; browser kanıtı yok. CSS min-width/overflow ve Radix dialog/focus altyapısı mevcut olsa da mobil taşma, Escape/Tab/focus restore ve gerçek API üzerinden etkileşim doğrulanmış değil.

## Test değerlendirmesi ve düzeltme sırası

Tam sonuçlar ve ilk başarısız girişimler [doğrulama raporunda](../docs/validation/V04_V43A_CODEX_AUDIT_VERIFICATION.md). Bağımsız genel testler: TypeScript PASS; ESLint 0/0; Vitest 344/344; migration safety 18/18; DB/RLS 11; Auth C1/C2/C3/C4/C5/C6/C61 toplam 62; Cloud D 11; Supplier 16; Purchases 16. Ek gerçek paralel approve testi bir 200/bir 409 verdi. Aynı-key concurrent create mevcut testte tek kayda indi. Ayrı key'lerle paralel numara tahsisi ve tüm rollback interleaving'leri ayrıca test edilmedi.

1. F01 maliyet DENY sızıntısını kapat.
2. F02 birim/fiyat sözleşmesini düzelt; yanlış beklenen değerleri bağımsız hesaplarla değiştir.
3. F03 parent lock ve F04 ilişki/snapshot invariant'larını SQL'de tamamla.
4. F05–F10 iş akışı, step-up, izin bağımsızlığı, editör ve hassasiyet/validation sorunlarını gider.
5. Ayrı normal kullanıcı/ACTIVITY/OWN matrisi ve fixture üzerinde gerçek masaüstü/mobil HTTP/browser kabulü ekle.

GLM'nin güçlü yanı mevcut auth/context/transaction yapısını yeniden kullanması, additive migration, gerçek PG fixture, timeout/fingerprint testleri ve stok/cari sınırını koruması. Zayıf yanı kabul testlerinin uygulamadaki yanlış matematiği tekrar etmesi; taslak iptali, materyal DENY, SQL yarışları ve ilişki eşitliklerini kapsamaması. Mevcut PASS beyanları sayısal olarak yeniden üretilebildi; güvenli teslim sonucunu tek başına desteklemiyor.

**Son karar: AUDIT_FIX_REQUIRED. GitHub teslimi NO-GO.** GLM düzeltmeleri ayrı görevde yapmalı; bu denetimde hiçbir düzeltme veya Mimo teslimi başlatılmadı.
