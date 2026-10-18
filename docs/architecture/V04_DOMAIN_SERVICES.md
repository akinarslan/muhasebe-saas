# PUSULA v0.4 — V4.1 domain servis sözleşmeleri

19.10.2026 · **TASARIM; endpoint, servis veya migration uygulanmadı.** [Veri modeli](V04_DATA_MODEL.md), [SQL planı](drafts/V04_MIGRATION_PLAN.md), [UX](../design/V04_UX_FLOWS.md).

Mevcut `/api/cloud/[...path]` → cloudRequest → catalogRequest/documentRequest/importRequest → contextFor/authorize/scoped → Prisma zinciri korunur. Yeni domain route'ları gelecekte açık allowlist dispatch ile eklenir; mevcut catch-all'ın bilinmeyen path'leri catalog handler'a bırakması otomatik destek değildir. Başka bir runtime/auth bağlantısı veya katalog kopyası kurulmaz. `CatalogService` gibi aşağıdaki isimler mantıksal sınırdır; halen kodda bu isimde sınıflar bulunduğu iddiası yoktur.

## Servis sınırları

| Servis | Komut / sahip olduğu veri | Sahip olmadığı veri |
| --- | --- | --- |
| CatalogService | Mevcut Material/Variant/CloudProduct kimlikleri, profile ve aktiflik; mevcut costEdit kontrollü manuel fiyat | Supplier teklifinden otomatik usdCost yazma |
| SupplierService | Supplier, SupplierMaterial, immutable OfferVersion; şirket/variant/para birimi kontrolü | Fiziksel stok veya borç |
| PurchaseService | PO taslak/onay/revizyon, Receipt/Return belgeleri; posting orchestration | Ledger'a ayrı transaction ile yazma; v0.6 cari |
| InventoryLedgerService | Tek dar SQL posting kapısı, Batch/Movement/Balance; receive/return/transfer/count/reverse | Quote/Sale olayıyla sarf; doğrudan balance CRUD |
| RecipeCostService | Published recipe+manual USD material version+explicit machine rate+FX üzerinden yeni Decimal preview | StockLot edinim maliyetini katalog maliyeti sayma; gerçek sarf |
| MachineCatalogService | Process/machine, doğrulanmış capability, product option, immutable USD rate sürümü | Doğrulanmamış medya/makine eşleşmesini otomatik açma |

Uygulama hizmeti parent ilişkileri ve field izinlerini kontrol eder; aynı invariant SQL function/FK/trigger'da tekrar korunur. DB runtime owner/BYPASSRLS olmaz. Business runtime auth tablolarına SELECT alamaz. AuditEvent aynı transaction'dadır; hassas ham fiyat/contact payload'ı summary'ye koyulmaz. Audit payload'u entity IDs, action, revision, reason, requestId ve masked alan adları taşır. Detay finans audit'i gerekiyorsa aynı cost yetkisiyle ayrı DTO; users.audit tek başına USD vermez.

## Önerilen API — henüz mevcut değil

Ortak prefix `/api/cloud/workspace`; UUID id, decimal string miktar, strict Zod whitelist. POST gövdesinde tenantId/userId/createdById/role/hesaplanmış bakiye/tutar otoritesi kabul edilmez. legalEntity/activity session membership ve DB kayıtlarından doğrulanır. Metadata editleri version zorunlu; stale409. Cookie session, origin kontrolü, body limit, no-store, requestId ve güvenli error code mevcut handler sözleşmesiyle aynı kalır.

| Kaynak | Önerilen işlemler |
| --- | --- |
| `/suppliers`, `/:id/materials`, `/supplier-materials/:id/offers` | GET list/detail, POST create/link/new-offer-version, PATCH versioned metadata; DELETE yok |
| `/purchase-orders`, `/:id/approve`, `/:id/revisions`, `/:id/close` | POST açık komutlar; approve step-up; revise geçmişi değiştirmez |
| `/goods-receipts`, `/:id/post`, `/supplier-returns`, `/:id/post` | Draft ve post ayrımı; posting server yeniden hesaplar |
| `/stock/locations`, `/stock/lots`, `/stock/movements` | Yetkili GET; location create/edit; lot/movement genel CRUD yok |
| `/stock/transfers`, `/stock/counts`, `/stock/counts/:id/start-or-approve`, `/stock/postings/:id/reverse` | POST komut; start/approve ayrı action, reverse gerekçe+step-up |
| `/recipes`, `/:id/versions`, `/:id/publish`, `/:id/preview` | Draft çocuk edit; publish sonrası mühür; explicit sürümle hesap |
| `/machines`, `/processes`, `/capabilities`, `/machine-product-options`, `/machine-rates` | Katalog yönetimi, teknik doğrulama, yeni tarife sürümü; geçmişe PATCH yok |

Komut input'u clientRequestKey(UUID), kanonik payloadHash(server), version/parent IDs ve ham gözlem miktarlarıdır. Response receipt/transfer/batch ID, POSTED state ve authorized quantity DTO'su; HTTP201 ilk kayıt,200 replay. Replay'de yetkiler **yeniden** doğrulanır; key veya kaynak belgeyi bilen biri finans response'unu geri alamaz. Aynı key+farklı payload409 IDEMPOTENCY_CONFLICT; hash hesaplamasında normalize Decimal string ve server-scope+operation vardır, volatile requestId yoktur. Farklı key aynı kaynak belgeyi post ederse kaynak unique guard mevcut sonucu authorized DTO ile döner veya409 ALREADY_POSTED. İki ayrı gerçek kabulü key değiştirerek ayırt etmek zorunludur; aynı kâğıt belge numarasının güvenilir tekil olmadığı açıkça gösterilir. PO kümülatif guard fazladan teslimi engeller, birim belgesi sahteciliğini kanıtlamaz.

## İş akışları ve failure semantics

Receipt yalnız APPROVED/açık PO, active supplier/variant ve yetkili konumda. Kısmi teslim örneği: 100m sipariş→30m kabul→70m kabul; siparişin kendisi0, ilk kabul30, ikincisi100 fiziksel stok. Üçüncü1m409 OVER_RECEIPT. Roll lotlama 30m ve70m fiziksel ruloları gerçekten temsil etmiyorsa operatör doğru paket/lot ayrımını girer; sipariş ölçüsü fiziksel paketin kanıtı değildir. Bütün header/line/lot/cost/delta/audit commit'i tek transaction'dır.

Transfer iki yönün de yetkisini, count freeze'lerini ve ROLL bütün-rulo kuralını denetler. Aynı lotta iki çıkış10 bakiyeden7+7 isterse biri başarılı, diğeri409 INSUFFICIENT_STOCK, bakiye3. Hata target credit'i veya audit'i tek başına bırakmaz. Batch durumunun idempotency key ile yeniden sorgulanması timeout'tan sonra güvenli sonuç verir; yeni key ile kör replay yok.

Receipt reversal bütün özgün batch'in negatifidir ve bağımlı transfer/iade/tüketim varsa reddedilir; önce bu bağımlılıklar kontrollü ters kayıtla çözülür. Transfer reversal hedefte stok yeterli değilse reddedilir. Return reversal özgün lot/cost'u geri getirir ve ikinci reversal unique ile reddedilir. Hiçbir reversal geçmiş receipt/offer snapshot'ını değiştirmez. Backdate ile geçmişte negatif stok oluşmasını gizlemek yasak: v0.4 posting balance tarihi commit-time'dır; occurredAt iş tarihi ayrıca kaydedilir, kapalı dönem düzeltmesi ayrı politika kapısıdır. Tarihsel raporlar postedAt ile reconcile edilir; farklı tarihle üretilirse açık iş tarihi etiketi gerekir.

Count freeze aktifken tüm giriş/çıkış/transfer/reverse409 LOCATION_COUNT_FROZEN; diğer lokasyonlar çalışır. Yetkili iptal freeze'i kaldırır. Sayım farkı countLine'a bağlı movement; observed value balance UPDATE değildir. Qty0 farkta hareket0 yazılmaz, count batch'in sıfır farkla kapanma kuralı deferred validator'da açıkça desteklenir (başka batch türünde boş set yasak).

Rate/recipe preview için selectedDate+revision+variant priceVersion+FX source/publicationdate döner. Geçersiz/geçmiş FX veya unsupported conversion422; boş fiyat0 değildir. Mevcut TCMB tazelik ve manuel kur izinleri korunur; EUR offer için ayrı kaynak belgelendirilmeden otomatik EUR kuru uydurulmaz. Satış kayıt entegrasyonu ayrı sprintte yeni snapshot alanlarının sürümlenmesini ister; eski immutable snapshot kopyaları yeniden yazılmaz.

HTTP401 session,403 permission,404 görünmeyen resource (tenant varlığı sızmaz),409 state/version/idempotency/stock/freeze,422 conversion/compatibility/FX,503 DB/servis. Transaction failure sahte başarı veya demo fallback üretmez; form taslağı korunur. Log yalnız requestId/code/status, raw SQL/secret/müşteri/vergi bilgisi yoktur.

## Master Admin izin kataloğu taslağı

Yeni eylemler mevcut Permission/RolePermission/UserPermissionOverride modeline eklenir; bu teslimde seed veya gerçek kullanıcı grant'i yapılmadı. Roadmap'teki inventory/stock ve machine.cost.rate edit gibi alternatif yazımlar için aşağıdaki **tek kanonik** ad seti seçildi; ad alias'ları yetkiyi kendiliğinden genişletmez.

| Kaynak | Ayrı permission ID'leri |
| --- | --- |
| Tedarikçi | suppliers.view/create/edit/export; supplierOffers.view/create (fiyatlı içerik); supplierMaterials.manage |
| Sipariş | purchases.view/create/edit/approve/cancel/close; purchases.costView/export |
| Mal kabul | receipts.view/create/post/reverse; receipts.costView |
| İade | supplierReturns.view/create/approve/post/reverse |
| Depo/stok | stock.view (mevcut); stock.locationsManage, stock.movementsView, stock.transfer, stock.reverse, stock.valuationView/export |
| Sayım | stock.countView/countCreate/countStart/countApprove/countCancel; stock.adjust (mevcut, tek başına countApprove vermez) |
| Reçete | recipes.view/create/edit/publish/costView |
| Makine | machines.view/manage; machineCapabilities.manage/verify; machineProductOptions.manage; machineRates.view/create |
| Mevcut maliyet | materials.costView/costEdit/history korunur; offer/receipt yetkileri bu anahtarları otomatik vermez |

Legacy stock.receive/issue genel anahtarları yeni receipts.post veya supplierReturns.post'a otomatik eşlenmez; üretim çıkışı v0.5'e kadar API'de açılmaz. supplierOffers.view fiyatlı teklif okur; supplier kartını görmek için gerekmez. SupplierOffers.create fiyat yazabildiği için finansal yetki sayılır. Maliyet DTO'su kendi kaynak iznini **ve** referans verilen materyalin materials.costView kapsamını kontrol eder; bir satır görünmüyorsa onu aggregation üzerinden çıkarma/hesaplama sızıntısı da engellenir. Option/recipe cost tüm material/rate costScopes yetkili değilse redacted olur; kullanıcıya mevcut API'nin desteklediği manuel satış fiyatı akışı korunur.

Master kendi tenant'ında bu aksiyonları kullanıcı başına OWN/ACTIVITY/LEGAL_ENTITY/TENANT scope ile atar. Mevcut `decide` ve SQL pusula_can DENY önceliği kalır; isMaster flag'i yetki bypass değildir. Normal kullanıcının self-role/self-override değişikliği kapalı kalır. Kritik onay, reverse, capability verify, rate publish/create ve izin değişikliği step-up gerektirir. Tutar limit/requiresApproval şu an yönetim UI'sinde tam destekli değildir: yeni approve butonu bunları hazır özellik saymaz. Approval gereksinimi server-state APPROVED ve ayrı action ile korunur; iki-person kuralı zorunlu olacaksa ayrı acceptance/policy gerekir.

## Geliştirme kabul sırası

V4.2 katalog→V4.3 belgeler→V4.4 ledger/concurrency→V4.5 makine/reçete→V4.6 API/RLS/DTO/UI. Bağımlı ledger fonksiyonları tamamlanmadan V4.3 post açılmaz. Önce migration fixture + negatif SQL, sonra service/API, en son UI. [Tam senaryo matrisi](../../research/PUSULA_V04_SPRINT_V41_AUDIT.md) gelecekte çalıştırılacaktır; bu tasarımda başarılı uygulama testi iddia edilmez.
