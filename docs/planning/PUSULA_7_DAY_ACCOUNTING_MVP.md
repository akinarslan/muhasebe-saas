# PUSULA — 7 günlük acil ön muhasebe MVP planı

**MVP_PLAN_READY · 22 Ekim 2026 · Hedef: 29 Ekim 2026.** Plan hazırdır; muhasebe MVP'si henüz geliştirilmiş, test edilmiş veya canlıya kabul edilmiş değildir. Gerçek veriyle pilot **yedek/restore ve diğer kabul kapıları geçene kadar BLOCKED**. Takvim bir teslim garantisi değildir.

Başlangıç: `feat/pusula-v030-neon-cloud`, HEAD `fc6d41bb4380baa1839064f9f7bfd4bfe317d6b9`; çalışma ağacı temiz. İptal edilen geniş İç Kullanım v1 planı yeniden yürütülmez. Bu görev yalnız dört dokümantasyon dosyasıdır; kodlama, migration, DB/provider/R2 veya Git commit/push işlemi yoktur.

## Karar ve minimum kapsam

Öncelik günlük ön muhasebe: **müşteri → mevcut satış → cari alacak → kısmi/tam tahsilat → kasa/banka → gider/tedarikçi borcu → ödeme → günlük rapor/ekstre**. Katalog USD maliyeti, satış ve kur snapshot'ları korunur. Ön muhasebe; yasal genel muhasebe, e-fatura veya banka/POS entegrasyonunun hazır olduğu iddiası değildir.

İlk pilot için müşteri/tedarikçi kartı, TRY açılış bakiyesi, alacak/borç, tarih-vade, nakit/havale/EFT/kredi kartı, kısmi tahsilat/ödeme, hesap bağlantısı ve referans, gerçek gider kategorisi/belgesi, yetkili ters kayıt, idempotency, finans gizliliği, günlük raporlar ve bağımsız şifreli yedekten başarılı geri yükleme zorunludur. TRY dışındaki tutarlar kayıpsız saklanır ve ayrı gösterilir; ilk pilotta yeni finans hareketleri **yalnız TRY** hesaplarda yapılır. USD maliyet/kur snapshot'ı kullanımı devam eder. ZY Reklam'ın zorunlu günlük tahsilatı USD/EUR ise bu dar kapsam yeterli değildir: çoklu para birimi/kur farkı paketi ve takvim yeniden kabul edilmeden pilot açılmaz.

Migration016, ileri stok, üretim/reçete, fiziksel sarf, sesli asistan, dış SaaS/abonelik, self-service kuruluş, AI ve özel entegrasyonlar ertelendi; kodları ve önceki hedefleri silinmedi. Satış kaydı stok hareketi üretmeyecek. Çek/senet ve mail-order otomasyonu bu haftanın dışındadır; bunlar zorunlu gerçek işlemse kapsam dışı kayıtları tamamlanmış saymadan pilot sınırı yeniden onaylanır. Kredi kartı bu kapsamdan çıkarılmaz: manuel onay/referans ve POS bekleyen hesabıyla desteklenir, terminal entegrasyonu şart değildir.

## GAP ANALYSIS — kaynak ve kanıt sınırı

“Kullanılabilir”, yeniden kullanılabilecek mevcut bileşeni anlatır; tüm ZY iş akışının canlı kabulü demek değildir. Yerel test, development'a uygulanmış şema ve kullanıcı manuel bulut kabulü ayrı kanıtlardır. Bu görevde test suite'i veya canlı bağlantı çalıştırılmadı.

| Modül | Sınıf | Mevcut kanıt / yeniden kullanım | Eksik iş ve dosya/modül bağlantısı |
| --- | --- | --- | --- |
| Müşteri kartı/seçimi/iletişim | Kullanılabilir | [catalog.ts](../../src/server/cloud/business/catalog.ts), [contracts.ts](../../src/lib/cloud/contracts.ts), [CloudDesk](../../src/components/cloud-desk.tsx), ortak CustomerDrawer; scoped CRUD/idempotency var. Sprint D ve önceki yerel Cloud testleri | Gerçek finans hesabı ve müşteri ekstresi yok; yeni accounting party bağlantısı. Firma/şahıs alanlarının işletme ihtiyacı mevcut kart alanlarıyla doğrulanacak, ikinci müşteri tablosu yapılmayacak. |
| Satış/teklif ve kalıcı satırlar | Kullanılabilir | [documents.ts](../../src/server/cloud/business/documents.ts), [Prisma şeması](../../prisma/schema.prisma): CloudSale/Line, CloudQuote ve CloudPaymentPlan. Sunucu hesaplama, transaction, payload hash, immutable snapshot | Satışın cari posting'i eksik; yeni satış+AR tek transaction; eski satışlar için açık kesim/mutabakat kararı. `CloudPaymentPlan` gerçekleşmiş ödeme değildir. |
| Maliyet, rulo, marj/markup, KDV, FX | Kullanılabilir | [pricing.ts](../../src/lib/pricing.ts), [tcmb.ts](../../src/lib/tcmb.ts), [resources.ts](../../src/server/cloud/resources.ts); USD otoritesi, manuel fiyat/kur, tarihsel snapshot, scoped maliyet redaksiyonu | Satış tahmini maliyetini gerçek nakit gider veya gerçek fiziksel sarf gibi raporlamama; küçük UI/rapor etiketi ve güncel yetki kabulü. |
| Müşteri/cari ekranı ve satış UX | Küçük düzeltme gerekiyor | `/app` CloudDesk mevcut; `/` [Workspace](../../src/components/workspace.tsx) localStorage demo | Finans UI `/app` içine bağlanmalı; demo bakiye/ödeme/dashboard gerçek kayıt yerine kullanılmamalı. Yenileme ve hata sonrası state, Türkçe sayı/tarih, ödeme formu UX. |
| Tedarikçi kartı | Kullanılabilir | [suppliers.ts](../../src/server/cloud/business/suppliers.ts), SupplierDesk. [V4.2f](../../research/PUSULA_V04_V42F_CLOUD_ACCEPTANCE.md) temel MASTER/TOTP kart-kalıcılık kullanıcı kabulü; ileri varyant/fiyat senaryoları sınırlı | Supplier'a bağlı AP hesabı ve borç belgesi yok. PO onayı tedarikçi borcu veya ödeme sayılmaz. |
| Cari alacak/borç/açılış/ekstre | Eksik | `src/lib/types.ts` ve [finance.ts](../../src/lib/finance.ts) demo tip/hesapları var; Prisma'da gerçek AR/AP/journal yok | Yeni accounting ledger, kaynak belge bağları, açılış, vade ve ters kayıt; aşağıdaki K1–K2. Demo `Math.max(0, balance)` finans doğrulaması olarak taşınmaz. |
| Tahsilat/ödeme ve tahsis | Eksik | Demo Payment ve sunucuda yalnız ödeme planları var; handler'da gerçek finance route yok | Yeni collection/payment/allocation servisi, duplicate/replay ve concurrent outstanding kontrolü; CloudSaleLine/PaymentPlan'a sonradan satır ekleme yok. |
| Kasa/banka/POS hesapları | Eksik | İzin adları var, kalıcı hesap/hareket servisi yok | TRY hesap, opening, hareket; kasa/banka yeterli bakiye politikası, POS→banka mahsuplaşması; K2. |
| Gerçek gider ve kategori | Eksik | CloudExpenseType ürünün **maliyet gider tarifesidir**; gerçek işletme harcaması değildir | Mevcut fiyat katalogunu değiştirmeden ayrı ExpenseDocument/Category; peşin veya vadeli giderin doğru journal'ı; K3. |
| Günlük finans paneli | Eksik | [dashboard.tsx](../../src/components/dashboard.tsx) ve demo finance hesapları var | Gerçek scoped journal sorguları: AR/AP, tahsilat/ödeme, hesap bakiyesi, net/KDV/brüt satış, vadesi gelenler ve ekstre; K3. |
| RBAC/MFA/scoping/audit | Kullanılabilir | [policy.ts](../../src/lib/auth/policy.ts), [context.ts](../../src/server/authorization/context.ts), [izin kataloğu](../../src/lib/auth/catalog.ts), auth/MFA; MASTER dahil explicit DENY. Temel bulut TOTP kabulü ve önceki yerel testler var | Finance izinlerinin katalogda bulunması endpoint'in geliştirildiği anlamına gelmez. Yeni journal/FK/RLS/DTO, normal kullanıcı ve iki tenant/legal entity/activity negatifleri zorunlu. |
| Backup/encryption/restore | Eksik: gerçek kaynak kabulü | [core.ts](../../scripts/backup/core.ts), [keys.ts](../../scripts/backup/keys.ts), [restore-fixture.ts](../../scripts/backup/restore-fixture.ts), [policy.ts](../../scripts/backup/policy.ts); yerel fixture/kriptografi kanıtı mevcut | [postgres.ts](../../scripts/backup/postgres.ts)35 tablo / 21 FORCE RLS allowlist; gerçek kaynak son kanıt40/26, finance sonrası daha fazla. Remote audit/rol, kapsam, off-app şifreli kopya, gerçek restore, anahtar ve alarm kabulü açık; B hattı. |
| Mal kabul/lot/stok | Pilot için ertelenebilir | V4.3b.12 ACL_FIX_PASS; yerel PG18.6 ve GitHub teslimi tamam;016 Neon'da pending | Gerçek stok düşümü/üretim/transfer/sayım için hazır kabul edilmez. Korunan016 yeni SHA `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`. |
| Üretim/reçete/ileri SaaS | Pilot için ertelenebilir | [V04_DATA_MODEL](../architecture/V04_DATA_MODEL.md), [domain tasarımı](../architecture/V04_DOMAIN_SERVICES.md), ROADMAP hedefleri | Bu haftanın fiilî ön muhasebe kabulüne bağımlı yapılmaz; WorkOrder veya sahte stok journal'ı eklenmez. |

Kaynak incelemesi: ROADMAP/ARCHITECTURE/LAST_REPORT, Prisma, cloud handler/catalog/documents/resources, pricing/finance/types, auth policy/izinler, backup CLI/core/postgres/policy/storage ve önceki doğrulama raporları. [Sprint D](../../research/PUSULA_V030_SPRINT_D_AUDIT.md) kalıcı müşteri/ürün/gider tarifesi/satış/teklif altyapısını ve sınırını açıklar. [V4.3a.4](../../research/PUSULA_V04_V43A4_CLOUD_ACCEPTANCE.md) temel PO kabulüdür, ödeme/cari kabulü değildir. Son teslimde417 Vitest/TypeScript/ESLint/build/artifact9 PASS **tarihsel kanıt**; yeni muhasebe modülleri için başarı sayılmaz.

## İlk kodlama paketi K1 — küçük ama gerçek ledger

Bu bölüm sonraki yetkili geliştirme için dosya planıdır; aşağıdaki yeni dosya/model adları **taslak**, henüz oluşturulmadı.

| Dosya | İş |
| --- | --- |
| `src/lib/cloud/accounting-contracts.ts` — yeni | Decimal string, tarih/vade, TRY account/party/source, idempotency ve strict payload şemaları. |
| `src/server/cloud/business/accounting/ledger.ts` — yeni | Tek journal posting kapısı; party/account doğrulama, lock sırası, kaynak tekilliği, toplamlar, append-only/audit. |
| `src/server/cloud/business/accounting/accounts.ts` — yeni | Mevcut Customer/Supplier bağlantısı ve hesap/ilk açılış komutları; ikinci kart otoritesi yok. |
| `prisma/schema.prisma` + `prisma/migrations/<incelenecek_finans_migration>/migration.sql` | Öneri: FinanceAccount, FinanceJournal, FinancePosting, FinanceAllocation ve gider belge/kategori modeli; composite tenant/entity/source FK, unique ve SQL immutability/RLS. İlk paket yalnız ledger/account/opening; allocation/gider sonraki paketlerde. Migration adı/sırası henüz seçilmedi. |
| `src/server/cloud/handler.ts` | Mevcut allowlist dispatcher'a açık finance route; bilinmeyen route'un catalog'a düşmesi destek sayılmaz. |
| `src/lib/auth/catalog.ts` + izin seed/migration | Mevcut finance/accounts/collect/payables/pay/cash/bank/approve ve reports.finance adlarını yeniden kullan; eksik opening/reverse/expense/account-manage aksiyonları ayrı incelenir. Rol şablonlarına sessiz yetki ekleme yok. |
| `tests/accounting-ledger.test.ts`, `scripts/accounting/verify-local.ts` — yeni | Mevcut UUID/loopback PG18.6 harness'i üzerinden gerçek fixture; ayrı sentetik kaynaklar, rollback/replay/tenant negatifleri. Yeni ikinci PostgreSQL harness'i yazma. |
| `docs/validation/PUSULA_ACCOUNTING_K1_VERIFICATION.md` — yeni | Native sonuç, fixture kimliği, geçmeyen testler ve kalan sınırlar; gerçek test yoksa PASS yok. |

K1 çıkışı: sıfırdan sentetik fixture'da açılış/cari journal/ekstre, explicit DENY, çapraz tenant/şirket FK, tekrar istek ve rollback kanıtı. K2'den önce ledger tasarımı onaylı ve tutarlı olmalı. Mevcut satış hesap motoru, müşteri API'si ve Auth yeniden yazılmaz.

### P0 teknik bağımlılık: pending016 ve migration grafiği

Neon'un son onaylı durumu15 migration / 40 tablo / 26 FORCE RLS;016 pending. [Mevcut runner](../../scripts/db/migrate.ts)016 varken cloud review guard'ıyla duruyor; stock runner yalnız yerel. Finans migration'ını sıradan017dosya olarak ekleyip `migrate deploy` demek016'yı da uygulamaya çalışabilir. **016'yı sahte resolve, silme, yeniden adlandırma veya eski history/checksum'u değiştirerek atlamak yasaktır.**

23 Ekim ilk karar: değişmemiş ilk 15 geçmişle uyumlu, bağımlılıkları açık bir finance dağıtım manifest'i/ayrı migration hattı tasarlanıp izole fixture'da kanıtlanacak; aynı DB için çakışan migration otoriteleri yaratılmayacak. Mevcut kaynakların016 tablolarını beklemesi (UI ve Prisma dahil) ayrıca değerlendirilecek. Güvenli ayrıştırma mümkün değilse016 için açık provider/post kanıtı ve ayrı kullanıcı onayı zaman bağımlılığı olarak kalır; “stok ertelendi” bu engeli otomatik kaldırmaz. Bu karar verilmeden cloud finans deploy planı hazır kabul edilmez. Canlı migration bu görevde veya takvim gereği kendiliğinden uygulanmaz.

## Minimum finans sözleşmesi — uygulanacak kurallar

1. Journal header ve posting satırları tek transaction, para başına borç/alacak dengeli; taraf, kaynak belge, tarih/vade, actor ve audit izlenebilir. Bu operasyonel iç defterdir; resmî genel muhasebe uygunluk iddiası yok. Cari bakiye immutable posting toplamıdır; cache varsa bu toplamla mutabık, ayrı otorite değil.
2. Müşteri alacağı satış brütünden; gelir net ve KDV ayrı alt toplam. Yeni CloudSale + tek kaynaklı AR journal aynı transaction'da commit/rollback. Sale/Line/kur/USD cost snapshot'ı değiştirilmez. Tahsilat planı alacak veya tahsilat olayını çoğaltmaz. Eski sale/import kayıtları otomatik borçlandırılmaz: kesim tarihi ve açık kaynak mutabakatı; açılışa alınan borç bir kez daha satıştan yazılmaz.
3. Tedarikçi borcu onaylı gerçek borç/gider belgesinden; PO onayı veya tedarikçi teklifi tek başına borç değildir. Peşin gider expense+kasa çıkışı; vadeli gider expense+AP; sonra ödeme AP+kasa çıkışı, ikinci gider oluşturmaz. Tek gider ekonomik olayı iki kez yazılmaz.
4. Tahsilat AR'ı azaltır, bağlı nakit/banka/POS hesabını artırır; ödeme AP'ı ve çıkış hesabını azaltır. Belge tahsisi aynı party/currency/entity içindedir; kısmi tutar ≤ açık borç/alacak. Fazla ödeme/avans MVP'de açık hata, bakiye sessiz0'a kırpılmaz. Kasa/banka eksi bakiyeye izin verilmez; kredili hesap sonraki açık politikadır.
5. Kredi kartı için onaylı terminal referansı ve POS bekleyen hesabı kullanılır. POS tahsilatı banka kullanılabilir bakiyesi değildir. Manuel settlement: brüt POS kapatma = net banka girişi + ayrı komisyon gideri. Kart numarası/CVV saklanmaz; reddedilen/belirsiz kart işlemi tahsil edildi gösterilmez. Haricî ödeme servisi çağrısı yok.
6. Request key+payload hash aynı işlemde tekrar için eski sonucu döndürür; farklı payload409. Ayrıca sourceType/sourceId/event ve aynı hesap/sağlayıcı terminal referansı için ekonomik tekillik, iki farklı key ile aynı satışın/tahsilatın iki kez işlenmesini engeller. Vadesi/party'si farklı gerçek iki tahsilat key'e göre ayırt edilir.
7. Kaynak açık kalemleri ve hesaplar deterministik sırada kilitlenir; iki eşzamanlı tahsilat/ödeme toplam açık tutarı/hesap bakiyesini aşamaz. Anahtar üretimini her retry'da değiştiren UI yok; belirsiz sonucu request/source referansıyla sorgula, kör mutation retry yapma.
8. Düzeltme/silme yerine yetkili, gerekçeli ters journal ve karşı allocation. Bir kez reversal; tahsisli satış/borç ters kaydı önce ilişkili tahsilat/ödemenin güvenli çözümünü ister. Kaynak journal/CloudSale immutable kalır. Açılışlar bir kez, tarihli ve karşı hesaplı; günlük satış/tahsilat/gider KPI'ına katılmaz.
9. API decimal string + sunucuda Decimal/SQL numeric; para2basamak, USD snapshot mevcut hassasiyette, açık yuvarlama. İstemci bakiye/tenant/actor/tutar toplamı otorite değildir. Yetkisiz read/aggregate/export'ta finans alanı sızmaz; MFA ve step-up mevcut kritik onay/ters/açılış akışına bağlanır. MASTER explicit DENY'ı aşmaz.
10. TRY dışı kaynaklar otomatik toplam/kur uydurma ile bağlanmaz; pilotta cross-currency settlement reddedilir. Katalogdaki tahmini USD iş maliyeti nakit gider sayılmaz; dashboard satış, KDV, tahsilat, ödeme ve gideri ayrı gösterir. Net tahminî iş kârı “gerçek stok sarfı/üretim kârı” diye adlandırılmaz.

## 7 günlük iş paketleri ve kritik yol

22 Ekim yalnız bu GAP/plan teslimi. 23–29 Ekim yedi takvim günü; ekip kapasitesi/saat taahhüdü yok. Her günün kod paketi yeni kullanıcı geliştirme yetkisi kapsamında açılır; bu belge kodlama yetkisi değildir. Sürüm hedefleri korunur: ön muhasebe v0.6işlerinin seçili kısmı öne alınır; geniş v0.4stok/v0.5üretim ve v0.8SaaS hedefleri durur, silinmez.

| Gün / öncelik | Paket ve bağımlılık | Teslim / gerçek kabul | Bloker ve başarı ölçütü |
| --- | --- | --- | --- |
| 23 Ekim D1 / P0 | K1 ledger/account/opening tasarımı+ilk yerel dikey dilim; migration grafiği kararı; TRY pilot kapsamı; paralel B0 backup yolu/rol/kapsam | Kod+unit+PG18.6fixture+kısa K1 raporu: opening/ekstre, kaynak tekilliği, transaction/RLS/DENY | Migration016ayrıştırması ve kaynak backup yetkisi kararı yoksa cloud dağıtımı BLOCKED. |
| 24 Ekim D2 / P0 | K1 tamamlama + yeni satış→AR ve onaylı tedarikçi borcu; eski kayıt/açılış kesimi | Mevcut documents.ts içine tektransaction hook; aynı satış iki key ile tekborç; immutable cost/rate; fixture+rapor | K1 geçmeden bakiyeUI açılmaz; açıklanamayan açılış farkı0. |
| 25 Ekim D3 / P0 | K2 collection/payment/allocation; cash/bank/POS ve settlement | Kısmi/tam, referans, concurrency, rollback, fazla tahsilat/eksi hesap reddi; UI/fixture+rapor | POS'ı banka gibi gösteren kestirme yok; doğrudan runtime journal DML reddi. |
| 26 Ekim D4 / P0 | K3 gider belge/kategori, ekstre ve günlük panel; K2 veri modeli hazır | Satış/gider/tahsilat/ödeme ayrı; sayı/tarih/FX; invoice→AP→payment tek expense; mevcut müşteri/satış UI yeniden kullanımı | İki oturum ve yetkisiz finansread; raporlar journal'a fark0. |
| 27 Ekim D5 / P0 | K4 entegrasyon ve düzeltme/ters kayıt; backup B1 aday paket | 10 m² senaryo, iki tenant/legal entity/activity, cost/finans redaksiyon, aynıkey/farklıkey, imported/açılış çift sayım negatifleri; kod+fixture+rapor | Önceki çalışan modüllerde regresyon0; full suite yalnız entegrasyon noktası. |
| 28 Ekim D6 / P0 | Özellik dondurma; B2 son şema şifreli bağımsız yedek/gerçek restore; deployment önkoşulu | Sırlar ayrı, yeni boş izole restore, tablo/rol/ACL/RLS/ledger toplamları/hash/ilişkiler ve uygulama smoke; belgeli RPO/RTO ölçümü | Ayrı açık gerçek kaynak/migration/restore yetkisi olmadan işlem yok. Backup veya dağıtım eksikse gerçek veri pilotu NO-GO. |
| 29 Ekim D7 / P0 | K5 yetkili işletme kullanıcılarıyla kontrollü pilot/karar; yalnız tüm ön kapılar geçmişse | [Kabul belgesi](../validation/PUSULA_ACCOUNTING_MVP_ACCEPTANCE.md), rol bazlı manuel akış, eğitim/runbook ve imza | Kritik hata0, açıklanamayan finansfarkı0, restorePASS. Aksi `PILOT_BLOCKED`; sentetik demo teslimi yapılır, GO_LIVE_PASS yok. |

Kritik yol: **migration grafiği + K1 → satış/AP bağlantısı → tahsilat/ödeme → gider/rapor → güvenlik/mutabakat → final şema restore → açık yetkili pilot**. Backup yolu D1'de paralel başlar; son güne ertelenmez. Doğru önceki testleri her belge değişiminde yeniden koşma: pakette etkilenen unit/PG/negatifler, K4 ve release adayında full Vitest/TS/lint/build ve uçtan uca kabul; yeni şema veya güvenlik değişirse ilgili backup/restore kanıtı yenilenir. Eski test sayıları yeni özellik kanıtı değildir.

## Yedek/restore B hattı ve R2 dışı seçenekler

Mevcut engine AES-256-GCM, doğrulanan manifest, key-vault ve yerel restore araçlarına sahiptir; bu gerçek development kaynağının kabul edilmiş yedeği demek değildir. R2 transport'u atlamak kaynak rolü/PUBLIC TEMP/CONNECT/diğer DB izinleri, definer ve büyüyen şema kapsamını çözmez. `MANAGED_REMOTE_OBJECT_AUDIT_REQUIRED` ve allowlist kapıları gevşetilmez. Finance tabloları eklendikten sonraki **tam fiilî şema** için kapsam incelemesi gerekir; 35/21'i40/26 veya 47/33sayısına çevirmek tek başına kabul değildir. token_roles/ROLE_DELTA_UNRESOLVED tam rol restore eşitliği iddiasını engeller.

| Seçenek | Kanıtlanmış parça / henüz kanıtlanmamış | Bu hafta karar |
| --- | --- | --- |
| Mevcut şifreli engine + R2 | Repo yerel kriptografi/fixture kanıtı var; gerçek kaynakrolü, upload/restore/operasyon kabulü açık | B0'da süre ve önkoşullar netleşirse mevcut altyapıyı tamamla; sıfırdan başka engine yazma. |
| Kontrollü operatörün bağımsız backup makinesi + şifreli arşiv + ikinci cihaz/offsite kopya | PostgreSQL export/restore formatı ve repo şifreleme bileşenleri destekli; **bu topolojide ZY gerçek kaynağıyla uçtan uca kanıt yok** | R2 transport yetişmezse incelenecek en dar alternatif. Kaynak yetkileri ve mevcut güvenlik politikası ayrıca onaylanır; runtime/owner şifresini uygulamadan kopyalayan kestirme yok. Anahtar uygulamadan/backup dosyasından ayrı, geri kurtarılabilir. Restore ve manuel her gün başarı kaydı olmadan kabul yok. |
| Başka bağımsız nesne deposu | Mevcut storage.ts R2 endpoint/bucket'a sabit; yalnız S3uyumlu denmesi yeterli değil | Adapter, private erişim ve gerçek download/restore yeni iş; daha hızlı/kanıtlanmış seçenek diye sunulmaz. |
| Neon branch/snapshot veya aynı makinedeki dump | Kaynak sağlayıcı/uygulama kaybından bağımsız kopya/anahtar kurtarma kanıtı değil | Tek başına canlıkabulü sağlamaz; recovery yardımcı katmanı olarak korunur. |

[PostgreSQL18 pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html) tek DB için tutarlı mantıksal arşiv sağlar; cluster rolleri ayrıca ele alınır. Bu özellik tek başına düzenli production yedek stratejisi değildir. [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html) arşivi ayrı hedefe geri yükler; arşivde olmayan veri/rolleri geri getiremez. Bu belgeler aracın yeteneğini doğrular, ZY kaynak dump/şifreleme/taşıma/restore başarısını kanıtlamaz. **Bugün kabul edilmiş bağımsız gerçek-kaynak R2 alternatifi yoktur.**

B0: kaynak/anahtar/topoloji ve güncel şema planı; B1: sentetik tam şema export→encrypt→independent copy→decrypt→restore provası; B2: ayrı onayla son release şemasında gerçek kaynak backup/ayrı hedef restore, hash/rol/finansmutabakatı ve uygulama smoke. Önerilen pilot hedefi her kapalı iş günü ve kritik değişim öncesi bağımsız kopya, RPO≤24saat ve RTO≤4saat; bunlar işletmenin onaylayacağı **hedef**, ölçülmüş garanti değildir. Bu tolerans kabul edilmiyorsa daha sık yedek/geri kurtarma şartı konur. İlk yedek/restore gerçek iş verisi girişinden önce geçer; başarı/freshness alarmı veya pilotta sorumlu kişinin kanıtlı günlük kontrolü zorunlu.

## 29 Ekim'e yetişmeme riski ve karar

En büyük riskler migration hattının016'dan güvenli ayrılması, gerçek backup rol/izin ve restore kabulü, immutable allocation/reversal yarışları ve POS settlement'ıdır. Bunlar görünmez biçimde ertelenemez; gerekiyorsa sentetik MVP gösterimi teslim edilir ve gerçek veri pilotu ertelenir. Çoklu döviz/kur farkı, çek/senet, banka/POS API, e-belge, geçmiş tüm satışların otomatik taşınması, tam stok/üretim ve gelişmiş rapor/AI bu tarihe taahhüt edilmez. Gerekli işletme verisinin kesim/açılış mutabakatı atlanmaz.

Kapsam teyitleri D1 işletme sahibi+muhasebe: TRY ile sınır yeterli mi, kart terminalreferansı/komisyon süreci, opening kaynağı, zorunlu çek/senet var mı, personel rolleri, yedek sorumlusu ve RPO/RTO. Bilinmeyenler “işletme kullanmıyor” diye varsayılmadı. Plan geliştirmeye yol gösterir; gerçek Neon migration, backup/restore veya işletme pilotu için ayrı açık kullanıcı onayı gerekir.

## Bu ilk teslimin sonucu

`MVP_PLAN_READY`: GAP, bağımlılık, dosya bazlı ilk paket ve planlanan kabul yazıldı. Uygulama hâlâ eksik; `GO_LIVE_PASS` verilmedi. Dört dosya: bu plan, [kabul matrisi](../validation/PUSULA_ACCOUNTING_MVP_ACCEPTANCE.md), [ROADMAP](../../ROADMAP.md) ve [LAST_REPORT](../../LAST_REPORT.md). Önceki sürüm kararları/ACL_FIX_PASS/GitHub teslimi korunur. Bu görevde yalnız belge aritmetiği ve bağlantı/kapsam kontrolleri yapılır; yeni API/PG/restore test sonucu iddia edilmez.
