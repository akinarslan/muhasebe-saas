# Sprint D — başlangıç denetimi

17.10.2026. Başlangıç e41d81d; feature dalı temiz ve remote ile aynıydı. Uzak main uygulaması feature'dan geridedir; uygulama ile merge edilmedi. Ortak atadan sonraki append-only ROADMAP/ARCHITECTURE kararları dosyalara korunarak alındı: makine/proses/ürün ayrımı, tarihsel USD/TRY snapshot, ürün–malzeme–tedarikçi ilişkileri ve stok/fire/üretim analitiği sonraki sürümlerde kalır.

D1: Customer yalnız ad/email/sourceId; Material/Variant/USD history temel tabloları var. Ürün, gider katalogları, teklif revizyonu, ilişkisel satış/satır/vade, import batch/record eksik. /app yalnız session başlangıcıdır. Demo Workspace localStorage kullanır; gerçek buluta otomatik fallback yapamaz. Mevcut Decimal motoru, CustomerDrawer, SaleForm, Customers, CostCalculator korunacaktır.

Model kararı: müşteri alanları ve aktiflik/version; malzeme/varyant metadata ve fiyat versiyonu; ayrı satılabilir Product ve ExpenseType; immutable quote revisions ve sale line/plan snapshot'ları. RLS tenant/şirket/faaliyet/owner + action, composite FK ve Decimal; audit/idempotency tek transaction. İçe aktarma önce explicit preview, demo varsayılan dışlama, onay ve hash/record eşleme ile yapılır. Production ve gerçek Master değişmez; veri testleri yalnız izole test DB'sinde.

D2–D6 uygulama ve gerçek test sonuçları tamamlandıkça bu denetime ve LAST_REPORT.md'ye işlenecektir. Sprint E bağımsız şifreli yedek/restore henüz yapılmış sayılmaz.
