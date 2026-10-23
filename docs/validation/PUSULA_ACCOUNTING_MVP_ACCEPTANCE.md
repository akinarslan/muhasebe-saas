# PUSULA ön muhasebe MVP — kabul sözleşmesi

**22 Ekim 2026 · PLANLANDI / NOT_RUN.** Bu belge yeni muhasebe özelliğinin test sonucu değildir. [7 günlük plan ve GAP](../planning/PUSULA_7_DAY_ACCOUNTING_MVP.md) ile birlikte uygulanacaktır. İlk teslimin sonucu `MVP_PLAN_READY`; mevcut gerçek-veri pilotu kabulü **BLOCKED**, `GO_LIVE_PASS` yoktur.

Kodlama, migration, gerçek Neon/DB/R2/restore, browser oturumu veya Git işlemi bu görevde yapılmadı. Önceki V4.3b.12 yerel ACL_FIX_PASS ve teslimdeki417test, yeni finans ledger/ödeme/rapor kabulü sayılmaz. Yalnız aşağıdaki örneğin Decimal aritmetiği belge hazırlanırken bağımsız kontrol edildi.

## Test ortamı ve kanıt kuralı

Önce mevcut harness ile yeni UUID/127.0.0.1 PostgreSQL18.6 fixture; hayalî iki tenant, aynı tenant içinde iki legal entity ve iki activity, farklı permission/explicit DENY kullanıcıları. Runtime tablo sahibi/superuser/BYPASSRLS olamaz. MFA/Auth testleri sentetik fixture verisiyle; gerçek parola/TOTP/session loglanmaz. Her pakette unit + gerçek PG transaction/SQL negatifleri + gerekiyorsa API/UI ve kısa doğrulama belgesi; kullanılan commit/SQL hash, native exit, fixture kapanışı ve başarısız denemeler kaydedilir. İşletme manuel kabulü otomatik test olarak sunulmaz.

Migration sırası ve finance dağıtım hattı onaylanmadan gerçek cloud deploy komutu yok. Pending016 sessiz uygulanmaz veya history'de sahte başarılı gösterilmez. İlk15SQL/tarihselchecksum ve016SHA `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567` korunur. Yeni finans şemasının tam tablo/RLS/ownership/ACL sayıları ancak tasarım+ölçümden sonra belirlenir; bugünden40/26 veya 47/33hedefi uydurulmaz.

## Ana otomatik senaryo A — 10 m² vinil, kısmi tahsilat ve gider

Temiz fixture; başka kayıt/açılış yok. Finans para birimi TRY, nakit hesabı açılış0; müşteri açılış0. İş tarihi T=`2026-10-29`, İstanbul saat dilimi; örnek vadeT. Sabit sentetik kur40TRY/USD, örnek KDV%20 **yalnız test girdisidir**, güncel kur veya uygulanacak vergi oranı tavsiyesi değildir. İstek saati/kur sağlayıcısı testte deterministik; canlı TCMB'den değişken test sonucu üretilmez.

| Adım | Girdi / beklenen kalıcı sonuç |
| --- | --- |
| A1 müşteri | `/app` mevcut müşteri oluşturma/seçim akışı; tek Customer, doğru tenant/entity/activity kapsamı. Aynı request tekrarında ikinci müşteri yok. |
| A2 ürün ve ölçü | Mevcut satılabilir vinil baskı ürünü,100cm×200cm,5adet → net baskı alanı10 m². 152cm rulo varyantı; her kenar2cm; tekli yerleşim ve reusableM2=0 açık test varsayımı. |
| A3 maliyet tahmini | Gerekli en104cm, boy204cm; tüketim tahmini10,20linear_meter, alan15,504 m²;10 m² otomatik fiziksel tüketim değildir. USD2/m² → malzemeUSD31,008. Mürekkep5+işçilik8+elektrik1+makine4+kesim2+laminasyon0+montaj4=USD24; toplam tahminUSD55,008. Aynı maliyet bileşeni iki tarifeden toplanmaz. |
| A4 satış | Manuel netUSD100 referansı ile TRY4000net,800KDV,4800brüt. Mevcut sunucu maliyet/kur snapshot'ları ve satırları; `CloudSale.currency=TRY`. Tahmini kârUSD44,992; marj=kâr/net satış, markup=kâr/maliyet; ikisi farklı etiketlidir. |
| A5 cari | Aynı transaction'da tek SALE kaynaklı journal; müşteri alacağı4800TRY. Net gelir4000/KDV800 ayrıdır. Satış kaydı müşteri alacağına bir kez yansır. İster plans4800olsun ister boş olsun gerçekleşmiş tahsilat0. |
| A6 tahsilat | Nakit2000TRY, benzersiz request ve işlem referansı; aynı customer/sale ve cash account'a allocation. Açık alacak2800, nakit2000. Satış toplamı4800 ve USD snapshot değişmez; PaymentPlan'a tahsilat satırı eklenmez. |
| A7 gerçek gider | İşin tahminî maliyetinden ayrı, işe otomatik dağıtılmayan ofis gideri500TRY; testte KDV0; kategori ve belge referansı. Peşin gider journal'ı ile nakit500azalır. Katalog CloudExpenseType güncellenmez. |
| A8 rapor | Günlük net satış4000, KDV800, brüt satış4800; tahsilat2000; nakit gider500; toplam nakit çıkışı500, tedarikçi ödeme0; nakit bakiye1500; banka/POS0; toplam AR2800/AP0. Müşteri ekstresi4800−2000=2800. Satış tahsil edildi sanılmaz. |
| A9 tekrar/hata | Satış/tahsilat/gider aynı key+payload tekrarında mevcut sonuç; ikinci journal/hesap hareketi yok. Aynı key farklı tutar409. Aynı sale için farklı key ile ikinci AR posting reddi/önceki kaynak sonucu. Kısmi transaction hatası bütün journal/allocation/audit değişikliklerini geri alır. |
| A10 stok sınırı | Fiziksel sarf yoktur. Stok tabloları yoksa yok kalır; varsa movement/balance değişmez.10,20 m tahmin sadece maliyet snapshot'ıdır. Üretim, gerçek fire veya gerçek stok kârı tamamlandı denmez. |

Müşteri, satış, journal, allocation ve hesap hareketi ID bağlarıyla takip edilir; açıklama metniyle ilişkilendirme yeterli değildir. KDV müşteri borcunda brüt tutara dahildir; kârda gelir değildir. USD tahminî maliyet gider journal'ına ikinci kez yazılmaz. Bu senaryoda4800−2000=2800ve0+2000−500=1500eşitlikleri kesin; toleransla gizlenen fark kabul edilmez.

### Tam ödeme varyantı A-FULL

A8sonrasında kalan2800aynı nakit hesaba tahsil edilir: AR0, toplam tahsilat4800, cash4300. İkinci tamamlama isteği ikinci tahsilat oluşturmaz; yeni key ile kalan aşımı422/409ve sıfır mutation. Aynı müşterinin başka satışını yanlışlıkla kapatmak composite kaynak bağlarıyla engellenir.

## Tamamlayıcı otomatik test matrisi

Tüm satırlar **NOT_RUN / geliştirme sonrası zorunlu**. Ayrı senaryolar ana A8toplamlarıyla karıştırılmaz.

| ID / paket | Senaryo ve başarı ölçütü |
| --- | --- |
| F01 / K1 | Yeni account/customer/supplier açılışı, tek kayıt ve tarih. Opening AR1000 olan ayrı fixture'da satış4800/tahsilat2000 → AR3800. Açılış günlük satış/tahsilat değildir; farklı key ile aynı kesim hesabını ikinci açma reddi. |
| F02 / K1–K2 | Her journal currency bazında debit=credit. Decimal string,0/negatif/taşma/NaN/precision/fazla ondalık payload reddi; yetkisiz caller calculated balance gönderemez. |
| F03 / K2 | TRY tedarikçi borç belgesi1500, bankaopening1000, ödeme600 → AP900/banka400; PO onayı veya offer eklemek AP üretmez. Vadeli gider borcu ödeme sırasında ikinci gider yazılmaz. |
| F04 / K2 | Nakit, havale/EFT ve kart ayrı referanslı hareket. TRY borca USDhesap/cross-currency tahsis reddi. TRY/USD/EUR totals ayrı; doğrulanmamış kurla birleşik bakiye yok. Mevcut USD satışları otomatikTRY borçlandırılmaz. |
| F05 / K2 | Ayrı kart fixture'ında AR4800/kart2000 → AR2800/POS2000/banka0. Settlement komisyon40ise POS−2000,banka+1960,gider+40; kalanPOS0. Aynı terminal/settlement referansı ikinci kez yazılmaz. Reddedilen kartta journal yok. |
| F06 / K2 | İki gerçek PG bağlantısında AR2800'e aynı anda2000+2000 isteği; en fazla biri2000başarır, diğeri açık tutarı aşamaz; toplam tahsilat≤borç. Aynı nakit kaynağından eşzamanlı ödeme eksi bakiye yaratamaz. |
| F07 / K2 | Source unique, request key+hash, farklı key/aynı ekonomik referans, timeout/lost response/reconciliation. Aynı cevap replay; otomatik yeni key veya kör retry yok. Gerçek iki ayrı ödeme doğru referanslarla ayrı kalır. |
| F08 / K3 | Peşin500gider ve vadeli500gider farklı fixture: birinde cash azalır, diğerinde AP artar. Vadeli gider ödemesinde AP düşer, gider tekrar artmaz. Katalog gider tarifesi değişimi eski gider belgesini/satış cost snapshot'ını değiştirmez. |
| F09 / K4 | Ana A'da giderden önceki cash2000/AR2800durumunda tahsilatı yetkili ters kayıt: cash0/AR4800; eski journal değişmez. Aynı reversal ikinci kez yok. Yetersiz kaynak bakiye/bağlı settlement veya tahsisli kaynak belge düzeltmesinde atomik red; yarım allocation çözümü yok. |
| F10 / K4 | Eski satış/import + aynıborç opening mutabakatı: bir ekonomik borç bir kez alınır. Approved source listesi dışında backfill yok. SaleLine/PaymentPlan sealed INSERT/UPDATE/DELETE kuralları korunur. |
| S01 / K1–K4 | İki tenant, iki legal entity ve activity/OWN kapsamı; okuma, yazma, join/FK, id ile fetch ve aggregate/export sızıntısı yok. Eksik tenant/session/context reddi; istemci actor/tenant beyanı otorite değil. |
| S02 / K1–K4 | MASTER dahil explicit DENY; collect izni pay/approve/reverse vermez. Finance/accounts/cash/bank/reports.finance ayrı kontrol; `sales.view` tek başına finans ledger/rapor okumaz. Maliyet izni olmayan kullanıcı nested USD/marj/audit toplamını göremez. |
| S03 / K1–K4 | Mevcut MFA/step-up yok veya süresi dolmuşken kritik opening/reversal/onay reddi. Yetki iptali sonrası eski oturum yeni finans çağrısı yapamaz. Finance-post raw DML/UPDATE/DELETE/TRUNCATE runtime'a kapalı; audit immutable. |
| T01 / tüm paketler | Sale+AR, tahsilat+allocation+hesap, gider+AP/cash ve audit ortasına hata enjeksiyonu; hepsi rollback. Aynı istek tekrarında tek sonuç; tutarsız state “başarılı” gösterilmez. |
| R01 / K3–K4 | İstanbul iş günü [00:00,next00:00), vadeT/geçmiş/gelecek, customdate; UI rapor toplamı bağımsız SQLjournal toplamıyla fark0. İlk/son saat kayıtları doğru güne girer. |
| R02 / K3–K4 | Satış, tahsilat, gider, tedarikçi ödeme, nakit hareketi ve opening KPI'ları ayrı. Tahsilat gelir, borç ödemesi ikinci gider, POS bekleyen banka bakiyesi sayılmaz. Boş, sayfalı ve çokkayıt raporu aynı mutabakatı verir. |
| Q01 / K4–release | Etkilenen unit/DB/API/UI testleri; sonunda full Vitest/TypeScript/ESLint/build. Müşteri değişiminde taslak korunur; F5sonrası kalıcı kayıtlar gelir; save doubleclick/hatalıform mükerrer finans üretmez. |
| B01 / B1 | Yeni finance şeması dahil tam kapsama ait manifest; bilinmeyen tablo/definer/ACL/rol/kolon grant drift'i fail-closed. Eski35/21allowlist kör genişletilmez; dump rolü runtime/auth/owner değildir. |
| B02 / B1 | AES-GCM/tag/hash/manifest bozulması, eksik/yanlış key, eksik dosya veya yarım kopya “restore başarılı” sayılmaz. Şifreli arşiv ve anahtar birbirinden ayrı, kurtarma sorumlusu erişimi kontrollü. |
| B03 / B2 | Ayrı onaylı son release kaynak backup'ı bağımsız hedefe alınır; uygulama kapalı/kayıp varsayımıyla arşiv+bağımsız araç+ayrı key ile boş izole hedefe gerçek restore. Kaynak/target schema/history/count/digest, journal/AR/AP/cash/allocation/KDVtoplamları, FK/rol/ACL/RLS ve uygulama smoke eşit. RPO/RTO ölçülür. |
| B04 / B2 | Restore hedefi productionendpoint'e bağlanmaz; dış mail/ödeme/işler kapalı. Auth secret/session kurtarma/iptal prosedürü ve backup credentials/keys ayrı onaylı runbook'la yönetilir; hassas içerik rapora/loga yazılmaz. |

## Manuel işletme kabulü — otomasyondan ayrı

Gerçek işletme verili adımlar ancak B03/B04ve tüm kritik otomatik kontroller geçip ayrı açık kullanıcı onayı verildikten sonra başlar. Öncesinde yalnız sentetik işletme benzeri verilerle prova yapılır. Manuel kanıt: tarih, environment/commit, rol, maskeli kayıt referansları, beklenen/gerçek toplam ve onaylayan; parola/TOTP/PAN/CVV/session/sır ekran görüntüsü yok.

1. İşletme sahibi, muhasebe ve satış personeli kendi izinli hesaplarıyla giriş/MFA ve yetkisiz menü/API reddini görür; personel başkasının hesabını kullanmaz.
2. Satış personeli mevcut müşteri/ürünü seçer veya kart oluşturur; A2ölçülerini ve satış fiyatını girer. Muhasebe USD snapshot/kur/KDV ve10 m²–15,504 m²ayrımını kontrol eder. Stok düşümü olmadığının etiketi görünür.
3. Muhasebe cari alacağı4800, tahsilat2000, kalan2800ve nakit2000kontrol eder. Tahsilat planı gerçek ödeme diye gösterilmez; F5ve yeni oturum kalıcılığı doğrulanır.
4. Yetkili kişi500ofis giderini ilgili kasaya kaydeder; günlük raporda cash1500/AR2800; kayıtların source/party/account bağları açılıp bağımsız mutabakat yapılır.
5. Ayrı kontrollü veriyle supplier borcu/partial bankaödeme ve kart/POS/komisyon senaryoları yapılır; banka ile POS bekleyen ayrılır. Zorunlu çek/senet veya döviz işlemi kapsam dışıysa pilot veri setine sokulmaz; kapsam yetersizse kabul reddedilir.
6. Çift tıklama, aynı referansı tekrar gönderme, yanlış hesap ve yetkisiz düzeltme denenir; tutar değişmez. Gerekçeli yetkili reversal kullanıcıya doğru etkiyi gösterir; orijinal belge silinmez.
7. İş günü sonu müşteri/tedarikçi ekstresi ve kasa/banka/POS toplamları işletmenin onaylı başlangıç ve bağımsız işlem listesiyle karşılaştırılır. Sonraki yedek başarısı/freshness kaydı kontrol edilir; kurtarma sorumlusu prosedürü uygulayabildiğini teyit eder.

## 29 Ekim GO / NO-GO kapısı

| Zorunlu kanıt | İmzayı verecek rol / mevcut durum |
| --- | --- |
| Finans migration hattı ve target/session/TLS/source history güvenliği; ayrı deploy onayı | Teknik sorumlu + kullanıcı / BEKLİYOR |
| F/S/T/R/Q kritik testleri ve ana A / A-FULL örneği, kayıpsız eskiUSDsnapshot | Teknik sorumlu / NOT_RUN |
| Opening kesimi, eski satış ve borç kayıtları mutabakatı, kur/para birimi kapsamı | Muhasebe + işletme sahibi / BEKLİYOR |
| Tam son şema bağımsız şifreli backup + gerçek restore + veri/yetki mutabakatı | Backup sorumlusu + teknik sorumlu / BLOCKED |
| Personel/MFA/DENY/cost-finans redaksiyon ve hata/kurtarma/runbook eğitimi | İşletme sahibi + rol kullanıcıları / NOT_RUN |
| Yetkili kontrollü manuel pilot ve açıklanamayan fark0 | Muhasebe + işletme sahibi / NOT_RUN |

Hiçbir kritik hata/eksik kanıt “tarih yetişsin” diye kabul edilmez. Yedek veya restore yoksa güvenli sentetik demo/yerel MVP gösterimi yapılabilir; gerçek iş verisi için **PILOT_BLOCKED** kalır. `GO_LIVE_PASS` ancak tüm zorunlu kapılar ve kullanıcı onayıyla verilebilir; bu belge onu vermiyor. R2 yerine başka depolama seçmek B03kanıtını kaldırmaz. Migration016gerçekapply, provider rol davranışı, ROLE_DELTA_UNRESOLVED ve bağımsız backup engelleri çözülmüş sayılmadı.

Gereksiz tekrar denetimi yok: değişen paket için hedefli kontroller, entegrasyon/release için full suite; final şema veya yetki/backup değişiminde ilgili kanıt yeniden üretilir. Başarılı API testini restore veya manuel işletme kabulü yerine kullanma.

## Bu ilk teslimde yapılan belge doğrulaması

Yalnız beklenen dört dosya değişti; yeni belgelerdeki 31 yerel dosya bağlantısı mevcut. Örnek rulo/maliyet/KDV/alacak/kasa aritmetiği bağımsız Decimal hesabıyla doğrulandı. ROADMAP eski baytları başta, LAST_REPORT eski baytları sonda hash eşitliğiyle korundu. `git diff --check` geçti; source/scripts/Prisma/migration değişikliği yok, Git index boş ve HEAD değişmedi. Uygulama suite'i, yeni finans API/E2E, PostgreSQL fixture veya gerçek restore bu görevde **çalıştırılmadı**; yukarıdaki tüm işlev kabul satırları NOT_RUN olarak kalır.
