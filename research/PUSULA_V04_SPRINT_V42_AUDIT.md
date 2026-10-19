# PUSULA v0.4 — V4.2 teknik denetim ve Mimo devri

19.10.2026 · `feat/pusula-v030-neon-cloud` · başlangıç **f3e1baa**, çalışma ağacı temizdi. **Codex commit/stage/push yapmadı.** Gerçek development migration'ı onaylanmadı ve uygulanmadı.

## Uygulanan kapsam

V4.1 ROADMAP/ARCHITECTURE, veri modeli, servis/migration/Prisma taslağı, UX, denetim ve LAST_REPORT incelendi. Yalnız Supplier, SupplierMaterial, SupplierOfferVersion uygulandı. PurchaseOrder/receipt/ledger/üretim/ödeme geliştirilmedi; Material/MaterialVariant ve CloudProduct otoritesi korunur. [Doğrulama](../docs/validation/V04_SPRINT_V42_VERIFICATION.md).

| Katman | Teslim |
| --- | --- |
| Prisma/migration | Üç additive model, SupplierUnit enum, `202610190014_supplier_catalog`; eski34 modelin alanları/13 migration değişmez. Yeni durumda37 model, metadata dahil38 public tablo,24 FORCE RLS; bunlar yalnız yeni yerel fixture'da uygulandı. |
| Supplier | Firma/unvan, telefon/e-posta, vergi, il/ilçe/adres, yetkili, varsayılan döviz, termin, notlar, aktiflik; arama/filtre/detay/optimistic edit; DELETE endpoint'i yok. |
| SupplierMaterial | Supplier↔mevcut Variant N:N; SKU, alış birimi, MOQ, termin, aktiflik/version; şirket+supplier+variant tekil. |
| SupplierOfferVersion | Orijinal fiyat/currency, min dahil/max hariç miktar kademesi, tarihler, referans/notlar, aktör, revision, server conversion/FX snapshot. UPDATE/DELETE/TRUNCATE trigger'la reddedilir; yeni teklif ayrı satırdır. |
| API | `/api/cloud/workspace/suppliers`, `suppliers/:id/materials`, `supplier-materials/:id`, `supplier-offers`, `supplier-comparison`; mevcut contextFor→authorize→scoped→Prisma zinciri. |
| UI | `/app` Tedarikçiler: liste/filtre, yeni drawer, detay/edit/pasifleştirme, malzeme eşleştirme/edit, teklifler/yeni sürüm, geçmiş ve miktar/tarih bazlı karşılaştırma. Demo `/` değişmez. |

V4.1'e göre somutlaştırma: Supplier.contact JSON yerine doğrulanan ayrı iletişim kolonları; otomatik code alanı yerine UUID/idempotency kimliği; teklif kaydeden `recordedById`, parent kaynak sahibi `createdById` alanından ayrıdır. Link/offer activity ve owner parent'tan gelir. SupplierMaterial variant FK ve entity/activity FK'leri elle SQL migration'dadır; ORM scalar alanları FK var olmadığı anlamına gelmez. V4.1'in geri kalan21 modeli aktif şemaya eklenmedi; stok profili ve CostUnit genişletmesi yapılmadı.

## Yetki ve veri koruma

Yeni sekiz kanonik anahtar: `suppliers.view/create/edit`, `supplierMaterials.manage`, `supplierOffers.view/create/history/costView`. V4.1 adları korunur. Talimattaki `suppliers.offers.view/create/history.view/cost.view` örneklerinin karşılıkları sırasıyla `supplierOffers.view/create/history/costView`tir; paralel alias yetki modeli yoktur. DB Permission kataloğu ve mevcut Master şablonu migration'da bu anahtarlarla genişler. Normal şablonlar/kullanıcı override'ları değişmez; gerçek Master/MFA/Neon üyeliğine işlem yoktur.

Yeni her tabloda tenant+zorunlu legalEntity, nullable activity FK, FORCE RLS; boş user/tenant/company deny. Supplier action politikası explicit DENY'ı `pusula_can` ile değerlendirir; link parent supplier ve erişilebilir mevcut material'ı, offer parent link/action/cost şartını kontrol eder. FK'ler şirket dışı supplier/variant referansını da reddeder. Runtime non-owner/NOBYPASSRLS; yeni SECURITY DEFINER yoktur. Tarihsel child owner/activity değiştirilmez; metadata editinde version+1 şartı vardır. Runtime'ın DELETE/TRUNCATE ve offer UPDATE grant'i yoktur; owner'ın offer değişikliği de trigger ile reddedilir.

API price DTO'su yalnız `supplierOffers.costView` **ve** ilgili material'ın `materials.costView` kapsamı varsa orijinal fiyat, USD normalize fiyat, FX/conversion, fiyat içerebilen not/ref verir. Diğer kullanıcıya bunlar API'de gönderilmez. Compare bu izin yoksa403; offer create ayrıca create+view+cost ve materyal costView ister. History ayrı izinlidir. API gövdesinde tenant/actor/normalizedPrice/FX snapshot kabul edilmez; server türetir. RLS satır güvenliğidir; shared backend DB credential'ını ele geçiren saldırgan için sütun bazlı DLP iddiası yoktur.

Idempotency şirket+requestKey unique ve kanonik server payloadHash ile; create/link retry aynı ID, farklı payload409. Offer revision allocation link başına advisory transaction lock altında; eşzamanlı replay tek sürüm üretir. Teklif not/fiyatı log veya audit summary'ye yazılmaz; AuditEvent aynı transaction'da aktör/action/id/revision taşır. Edit stale version409, pasifleştirme geçmişi silmez. SQL FK hata payload'ı dışarı çıkmaz; ortak hata cevabı güvenli code/requestId'dir.

Decimal string'ler hash öncesi normalize edilir (`1` ve `1.000` eşdeğer). Teklif/geçerlilik/asOf tarihleri **Europe/Istanbul iş günü**, olay timestamp'leri UTC'dir. UTC gece sınırında gelecekte görünmeyen İstanbul günü ve TCMB yayın tarihi ayrı test edilir. Migration014 açık BEGIN/COMMIT içerir; yerel runner aynı gövdeyi metadata checksum kaydıyla kendi tek transaction'ında uygular. Diğer13 migration değiştirilmedi.

## Fiyat ve karşılaştırma politikası

USD doğrudan, TRY yalnız server'ın mevcut TCMB ForexSelling servisiyle ve yayın tarihi tekliften sonra değil/7 günden eski değilse normalize edilir. Hesap ve snapshot aynı6 basamaklı USD/TRY'yi kullanır. Eski tarihli teklif için bugünkü kur uydurulmaz. TCMB erişilemiyorsa orijinal teklif saklanır ve USD karşılığı null/hesaplanamazdır. EUR/GBP saklanır; bu sprintte doğrulanmış çapraz kur entegrasyonu eklenmediği için USD hesabı yoktur. TRY entegrasyonu yerel testte enjekte edilen sentetik TCMB snapshot'ıyla kanıtlandı; canlı TCMB erişim/servis sürekliliği sertifikasyonu değildir.

Yeni SupplierUnit altı değeri taşısa da Material'ın CostUnit'ı dört değerle korunur. Aynı birim, sabit enli rulo metre↔m² ve bilinen ölçülü levha→m² dönüşümü desteklenir;9 basamakta tam gösterilemeyen dönüşüm, kg↔litre, adet↔levha veya bilinmeyen geometri ret verir. Kg/litreyle mevcut uyumsuz material'a teklif bağlamak destek varmış gibi kabul edilmez. Fiziksel stok veya rulo miktarı tutulmaz.

Para/miktar decimal string→Decimal40→numeric(24,9). Geçerlilik sonu ve miktar üst sınırı exclusive. Tier kimliği alış birimi+min/max, revizyon link genelinde artar; aynı kademede daha yeni etkin revizyon eskiyi supersede eder, expired yeni sürüm eski ucuz fiyatı tekrar geçerli yapmaz. Başka currency ile aynı kademe yeni teklif önceki revizyonun yerini alır; orijinal geçmiş ayrı izinle okunur. Link MOQ ve termin teklif conversion snapshot'ında dondurulur. Ana malzeme USD ve eski quote/sale snapshot'larına yazan kod yoktur.

Karşılaştırma seçilen asOf/temel miktar için: aktif supplier/link/material, valid interval, teklif tarihi≤asOf, aynı temel birim, doğrulanmış USD ve miktar kademesi/MOQ gerekir. Uygun olanlar fiyat+id sırasıyla; uygun olmayanlar gerekçeyle aşağıda, recommendation yalnız uygun satırlardandır. Fiyatlar kendi teklif kur snapshot'larını kullanır; bugünkü ortak kura yeniden fiyatlanmaz. Seçili varyant bazında500 link/1000 teklif sınırı aşılırsa eksik evrende “en ucuz” denmez, filtre daraltma hatası verilir. Global tüm tedarikçileri kapsayan kesin satın alma önerisi değildir.

Seçili faaliyetle uyumlu veya şirket genelindeki link'ler alınır; diğer faaliyet supplier'ları karşılaştırmaya karıştırılmaz. Aynı varyant ve supplier ilişkileri tekrar tekrar sorgulanmaz; teklifler RLS altında tek toplu sorguyla en fazla1001 satır okunup toplam1000 sınırı uygulanır. Bu, üretim performans benchmark'ı değildir.

## İzole test altyapısı ve etkisi

`scripts/suppliers/verify-local.ts` daha önce SHA-256 doğrulanmış resmî18.6 paketini yeniden pinler; UUID `.data/fixtures/v42-*` içinde yeni SCRAM cluster yaratır. Yalnız127.0.0.1, boş55432 veya boş alternatif port; Windows service/PATH değişikliği yok. **Yerel DB'nin adı pusula_sprint_b_test olsa da mevcut Neon pusula_sprint_b_test değildir:** farklı yeni cluster, yalnız loopback, explicit port ve UUID marker ile doğrulanır. Gerçek Neon test/development/production'a bağlantı açılmaz.

Yeni local fixture seçeneği yalnız test=true, NODE_ENV≠production, UUID+özel yerel marker, exact127.0.0.1/port/DB/rol ve sslmode=disable ile çalışır. Fixture modu açıkken Neon hedefi bile reddedilir; mod yokken önceki Neon verify-full allowlist aynen geçerlidir. Bu yerel TCP testine özgü plaintext transport remote TLS'yi gevşetmez. Symlink/marker/path/rol/port/query/production negatif testleri vardır. Kimlik dosyaları fixture UUID altında şifrelidir; mevcut `.data/auth-*` fixture'ları ezilmez. Master test yardımcısı regresyonların eklediği diğer üyelikler yerine asıl sentetik bootstrap üyeliğini açık header ile seçer; production auth mantığı değiştirilmedi.

Sunucu kapanışı postmaster PID+data directory+exe+creation time ile kendi süreç kimliğini doğrular; pg_ctl fast stop, PID dosyası ve süreç yokluğu kontrol edilir. Diğer uygulama/PostgreSQL süreçleri durdurulmaz. Fixture dosyaları Git dışı özel ACL'li dizinde tutulur; genel cleanup/drop yapılmaz.

## Mimo teslimi ve açık kabul kapıları

Codex stage/commit/push yapmaz; değişiklikler çalışma ağacındadır. [Doğrulama raporundaki dosya listesi](../docs/validation/V04_SPRINT_V42_VERIFICATION.md) Mimo'ya devirdir. Main/force-push/hard reset yapılmadı. Mimo önce diff ve sır taramasını incelemeli; `.data`, `.env.local`, generated Prisma, test credentials ve build çıktıları teslim kapsamı değildir.

Teslim sonucu:297/297 Vitest, DB/RLS11/11, Auth/API62/62, Cloud/DB11/11, V4.2 DB/API16/16 ve browser28/28 (6 auth/cloud/D7/V4.2+22 demo); TypeScript/lint/build PASS. Sonraki MOQ hassasiyet değişikliği için16/16 odaklı gerçek DB/API de tekrar geçti. Son29 dosya+23 client JS sır taraması PASS,16 trace'de .data0; bağımsız son süreç/port sayımları0. Ayrıntılı kanıt sınırları ve başarısız deneme kaydı doğrulama raporundadır.

Gerçek development migration'ı için **yeniden açık kullanıcı onayı** gerekir. Bu onayda hedef branch/DB, migration014, yeni8 Permission/Master şablonu bağlantısı ve grants açıkça belirtilmelidir; kullanıcı override'ları resetlenmemelidir. Ondan önce gerçek kayıt/migration baseline denetimi ve kurtarma planı gerekir. Production, gerçek test DB, yeni ücretli servis, gerçek dump/R2 veya kalıcı key üretimi onaylanmış değildir. V4.3 stok/satın alma ayrı kalır.

Sprint E allowlist hâlâ35 tablo/21 FORCE RLS ve incelenmiş eski function/enum kapsamıdır. V4.2 yeni3 tablo, SupplierUnit,2 invoker function,4 trigger ve11 policy'yi otomatik kabul etmez. Şema/ACL/TOC/checksum/restore incelemesi ayrı yapılmalı; eski güvenlik guard'ları kaldırılmadı. Neon PUBLIC TEMP/CONNECT/builtin ownership, gerçek backup hesabı ve production R2/E3/E4 kabulü açık kalır.
