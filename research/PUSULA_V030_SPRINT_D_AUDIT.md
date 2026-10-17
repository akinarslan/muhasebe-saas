# Sprint D — başlangıç denetimi

17.10.2026. Başlangıç e41d81d; feature dalı temiz ve remote ile aynıydı. Uzak main uygulaması feature'dan geridedir; uygulama ile merge edilmedi. Ortak atadan sonraki append-only ROADMAP/ARCHITECTURE kararları dosyalara korunarak alındı: makine/proses/ürün ayrımı, tarihsel USD/TRY snapshot, ürün–malzeme–tedarikçi ilişkileri ve stok/fire/üretim analitiği sonraki sürümlerde kalır.

D1: Customer yalnız ad/email/sourceId; Material/Variant/USD history temel tabloları var. Ürün, gider katalogları, teklif revizyonu, ilişkisel satış/satır/vade, import batch/record eksik. /app yalnız session başlangıcıdır. Demo Workspace localStorage kullanır; gerçek buluta otomatik fallback yapamaz. Mevcut Decimal motoru, CustomerDrawer, SaleForm, Customers, CostCalculator korunacaktır.

Model kararı: müşteri alanları ve aktiflik/version; malzeme/varyant metadata ve fiyat versiyonu; ayrı satılabilir Product ve ExpenseType; immutable quote revisions ve sale line/plan snapshot'ları. RLS tenant/şirket/faaliyet/owner + action, composite FK ve Decimal; audit/idempotency tek transaction. İçe aktarma önce explicit preview, demo varsayılan dışlama, onay ve hash/record eşleme ile yapılır. Production ve gerçek Master değişmez; veri testleri yalnız izole test DB'sinde.

D2–D6 uygulama ve gerçek test sonuçları tamamlandıkça bu denetime ve LAST_REPORT.md'ye işlenecektir. Sprint E bağımsız şifreli yedek/restore henüz yapılmış sayılmaz.
## Uygulanan D2–D5 kararları

Customer genişletildi; Company-geneli müşteri birden fazla faaliyette kullanılabilir. CloudProduct/ExpenseType ürün ve maliyet giderini ayırır. Material metadata/version, Variant priceVersion ve immutable tarihçe korunur. Yeni iki additive migration izole test ve development DB'lerine deploy edildi; production'a SQL uygulanmadı.

Teklif revizyonu ayrı immutable satır; satış/satır/TRY ödeme planı ilişkisel ve tek transaction'dır. Idempotency key + payload hash + advisory lock tekrarları sınırlar. Decimal motoru sunucuda gerçek katalog/gider fiyatlarından çalışır; istek toplamları strict şema ile reddedilir. TCMB sunucu fetch veya açık manual DB record snapshot'ı kullanılır. Snapshot'lar USD fiyat/birim/ölçü/tüketim/fire/gider/kur/KDV/iskonto/ürün sürümü taşır.

Yeni tablolar FORCE RLS ve composite şirket/faaliyet FK taşır. Session scope DB üyeliğinden gelir. Explicit DENY sonrası USD katalog ve nested belge maliyetleri API'de yoktur; costScopes karma kaynak görünürlüğünü denetler. CostView olmayan manuel fiyatlı kayıt motor maliyetini değiştiremez. Eski internal API ile yeni fiyat API'si aynı priceVersion'ı artırır.

Import önce doğrulama/önizleme, sonra hash/step-up/açık onaydır. Müşteri/malzeme/ürün ile normalize tarihsel satış/teklif desteklenir. Eski USD fiyat zincirleri orijinal zaman ve legacy aktör etiketiyle immutable history'ye alınır; gerçek import aktörü audit'te ayrıdır. Finansal tutarlar eski katalog ve kurdan tekrar hesaplanır; uyuşmazlık bloklar. Batch/record eşlemesi ve mutabakat tek transaction'dadır. Gerçek işletme verisi otomatik taşınmadı.

/app yeni CloudDesk, ortak CustomerDrawer/CostCalculator/NumericInput/Button ile mevcut lacivert/turkuaz dili kullanır. / demo Workspace ve mevcut SaleForm değiştirilmeden korunur. Bulut state localStorage'a yazılmaz; eski taslak/tema/pusula kalır. Müşteri değişiminde kalem/maliyet taslağı açık onay olmadan temizlenmez. Hata drawer'ı kapatmaz veya başarı göstermemelidir.

## Denemeler ve doğrulama kaydı

İlk DB koşusunda ilişkisel nested create içine parent composite FK alanları gereksiz eklenmişti; Prisma reddetti. Alt create parent ilişkiden scope alacak şekilde düzeltildi. Import onayında scope helper'ın fazla payload alanlarını yayması Prisma doğrulama hatası yaptı; helper açık alan projeksiyonuna çevrildi. Sonraki 11/11 paket; explicit deny, geçmiş fiyat zinciri, tarihsel satış/teklif mutabakatı, immutable SQL ve idempotency'yi içerir. Bir ara koşuda Prisma transaction hatası görüldü; başarılı final koşu ayrı kaydedilir.

İlk browser bulut koşusu opsiyonel boş plaka uzunluğunu NaN olarak gönderen form yolunu buldu; boş/geçersiz ayrıldı. Sonraki combobox test seçiminde label yerine erişilebilir role/name seçimi düzeltildi. Başarısız browser koşuları başarılı sayılmadı. Vitest sandbox başlangıcında EPERM alt süreç hatası izinli koşuyla giderildi. Migration öncesi hash yardımcı betiğinin ESM import'u başarısız oldu; additive deploy gerçekleşti. Hash kaydı deploy sonrasında alındı; migration öncesi/sonrası birebir hash kanıtı iddia edilmez. Development kontrolleri yalnız bağlantı ve kayıt sayımı/hash okur; gerçek CRUD testleri izole DB'dedir.

Son build/lint/test/browser sonuçları LAST_REPORT.md'de yer alır. Otomatik tarayıcı çıktıları yalnız hayalî test verisidir; QR/TOTP/recovery trace/video kaydı yapılmaz. Source/user/token/connection string Git'e eklenmez.

## Bilinen kapsam sınırı

Eski müşteri içermeyen maliyet teklifleri ve demo ürün ID'li satışların otomatik şirket/ürün eşleme sihirbazı yoktur. Önizleme bunları inceleme gerektiren olarak sayar; ilişki/tarihsel katalogları normalize dosyada belirlenmeden finansal import onaylanmaz. Gider/tedarikçi şablonları otomatik operasyonel harekete çevrilmez. Bulut açık form taslağı bellektedir; sayfa yenilemesinde kalıcılık sözü yoktur. Kaydedilmiş belgeler Neon'dadır. Sprint E yedek/scheduler/restore ve production/operasyon/MFA recovery kabulü ayrıca gerekir.

Son denetimde satış alt kayıtlarının daha sonra INSERT ile genişletilmemesi için `202610170013_sale_line_sealing` eklendi. Guard, parent MVCC xmin'i aynı transaction kimliğiyle karşılaştırır; SaleLine/PaymentPlan yalnız ana satışın oluşturulduğu transaction'da eklenebilir. Güncelleme/silme immutable trigger'ları da korunur. Yeni ve tarihsel satışlar tek transaction'da yazılır. Ek SQL negatif testleri mevcut satışa sonradan plan/satır eklemenin reddini doğrular. Sprint E restore planı bu trigger'ların oluşturulma sırasını/atomik restore davranışını da doğrulamalıdır.
