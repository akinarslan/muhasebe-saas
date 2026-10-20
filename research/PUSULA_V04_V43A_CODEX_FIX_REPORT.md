# PUSULA V4.3a — Codex düzeltme raporu

20.10.2026 · Dal `feat/pusula-v030-neon-cloud` · HEAD `2ab48ada004c830d1424cb95a8ab5a9ab052a55c`

**FIX_PASS — yerel V4.3a kabulü.** F01–F10 gerçek PostgreSQL regresyonlarıyla kapandı. Nihai yeni fixture `v42-e20dd3a4-a688-4a06-a3b8-673bfb50d651`: migration safety18/18, DB/RLS11, Auth62, Cloud11, Supplier16, Purchases28 ve gerçek desktop/mobile browser2/2 PASS; serverStopped true. Son Vitest355/355, ESLint0/0, TypeScript ve build PASS. Build'de eski rate-store dosya pattern'i için tek warning korunuyor.

Nihai karar ve koşu kanıtı [doğrulama belgesinde](../docs/validation/V04_V43A_CODEX_FIX_VERIFICATION.md). Önceki bağımsız denetim ve GLM raporları tarihsel kayıt olarak aynen korunmuştur. Bu görevde commit/push, Neon migration, R2, snapshot/preview işlemi yapılmadı. Gerçek kullanıcı verileri kullanılmadı.

## F01–F10 düzeltmeleri

### F01 — manuel katalog maliyetinin kaynak izni

Kök neden: PO DTO'su yalnız `purchases.costView` kontrol ederek `variantUsdCost` döndürüyordu. `src/server/cloud/business/purchases.ts` artık her satırın materyal kaynağında ayrıca `materials.costView` değerlendiriyor. Siparişin kendi alış fiyatı PO maliyet iznine bağlı; katalog maliyeti ikinci kaynağın iznine bağlı. İç snapshot'lar ham olarak DTO'ya yayılmıyor.

Gerçek PostgreSQL regresyonu: `scripts/purchases/verify.ts` F01 kontrolü davet/kabul/login ile gerçek non-master oturumu oluşturuyor. OWN sipariş okuma ve başka aktör siparişine 404, OWN materyal maliyeti kapsamı uyuşmazlığında redaksiyon, şirket ALLOW ile pozitif kontrol, explicit DENY ile redaksiyon, materyal ACTIVITY ALLOW/DENY ve yanlış faaliyet bağlamında 404/403 doğrulanıyor. DTO hâlâ yetkili alış fiyatını veriyor; `variantUsdCost` ve ham nested snapshot sızmıyor. Sonuç PASS.

Kalan sınır: Shared trusted DB runtime rolü ham maliyet sütunlarını okuyabilir; son kullanıcıya bu rol verilmez. Bu, mevcut V4.1 tehdit sınırıdır.

### F02 — alış fiyatının paydası ve tarihsel FX

Kök neden: USD/alış-birimi fiyatı temel stok miktarıyla çarpılıyordu. `purchase-pricing.ts` toplamı alış miktarı × USD/alış-birimi üzerinden hesaplıyor. `purchases.ts` snapshot'ta `usdPurchaseUnitPrice` ve temel birime bölünmüş `normalizedUsdUnitPrice` alanlarını ayrı tutuyor. Alış fiyatı ile teklif birimi uyuşmuyorsa 422; miktar kademesi aynı teklif biriminde değerlendiriliyor. Supplier minimumu temel miktarla kontrol ediliyor. Ara hesaplarda Decimal precision 40 kullanılıyor.

Teklif seçilince mevcut günün TCMB kuru tekrar çekilmiyor: immutable teklifin factor ve FX snapshot'ı kullanılıyor. TRY'nin orijinal fiyatı aynı snapshot'taki TCMB ForexSelling USDTRY ile normalize ediliyor; USD identity, EUR/GBP unavailable kalıyor. Manuel TRY satırı mevcut tarihli TCMB doğrulamasını kullanmaya devam ediyor. Fiyat normalizasyonu dokuz basamak, satır toplamı HALF_UP dokuz basamak; `roundingVersion` snapshot'ta açık.

Testler: `tests/purchase-pricing.test.ts` metre/m² ve levha örnekleri; DB F02 kontrolü 2 × 15,20 = 30,40 USD ve 3,04 m²; farklı teklif birimi ve kademe reddi. Ayrı tarihsel TRY testi, önceki güne ait 76 TRY/metre ve 50 USDTRY ile 2 metreyi 3,04 USD buluyor; global fetch engellenerek güncel kura başvurulmadığı doğrulanıyor. Gerçek DB PASS.

Eski yanlış beklentiler bağımsız alış miktarı referansıyla değiştirildi: 10×15,2=152; 3×6,5=19,5; toplam171,5; manuel 2×5=10; düzenleme11×15,2=167,2. `scripts/purchases/verify.ts` ve unit testte eski area×metre-price beklentilerini korumak doğru olmazdı. TRY/EUR/GBP kuralları ayrıca mevcut unit ve gerçek DB testlerinde geçti.

Kalan sınır: Desteklenmeyen EUR/GBP için USD toplam pending kalır; bu sürüm KDV, iskonto veya mal kabul edinim maliyetini uygulamaz.

### F03 — parent kilidi ve boş onay engeli

Kök neden: Line trigger parent durumunu kilitsiz okuyordu. Migration015 line INSERT/DELETE guard'ı aynı parent'a `FOR UPDATE` alıyor. Servis PATCH/approve/cancel yolları da önce görünür, scope'lu parent'ı kilitliyor. DB ve API boş sipariş onayını reddediyor; onaylı header'a aynı statüyle edit de kapalı. Onay damgasının gelecek zaman kontrolü DB `clock_timestamp()` ile yapılıyor.

DB regresyonu: İki non-owner bağlantıda silme transaction'ı açık tutuluyor; admin katalog gözlemi ikinci bağlantının gerçekten lock beklediğini doğruluyor. Silme commit sonrası approve409 ve DRAFT/0 satır; doğrudan SQL boş onay da reddediliyor. INSERT/approve yarışı commit sonrası iki satırı mühürlüyor; onay sonrası yeni INSERT reddediliyor. İki paralel approve bir200/bir409 veriyor. PASS.

Kalan sınır: Karmaşık doğrudan SQL batch'lerinde PostgreSQL deadlock/timeout transaction'ı iptal edebilir; invariant'ı bozarak başarılı commit kabul edilmez. Her olası interleaving'in matematiksel ispatı iddia edilmiyor.

### F04 — DB ilişki ve snapshot bütünlüğü

Kök neden: Ayrı composite FK'ler referansların birbirine ait olmasını ve JSON içeriğini garanti etmiyordu. Migration015 invoker trigger'ı artık parent actor/activity, SupplierMaterial→supplier/variant, offer→link/unit/revision/original price, baseUnit, dönüşüm faktörü ve miktar eşitliğini doğruluyor. Manuel geometri faktörü hesaplanıyor; teklif faktörü kendi immutable snapshot'ıyla karşılaştırılıyor. Snapshot version/roundingVersion, decimal string biçimleri, currency/source/FX durumu, USD unit/base/total eşitlikleri ve null USD alanları doğrulanıyor. Yeni SECURITY DEFINER veya geniş grant yok.

DB regresyonu: Gerçek runtime yanlış varyant, başka linkin teklifi, boş conversion, boş price, bozuk toplam ve bozuk temel miktarı reddediyor; aynı kaydın geçerli klonu pozitif kontrol olarak kabul ediliyor. Eski bozuk admin fixture INSERT'i geçerli snapshot klonuyla değiştirildi; foreign-header görünmezlik testi için sahte boş-snapshot child oluşturulmuyor. PASS.

Kalan sınır: JSON gelecekteki vergi/iskonto şeması değildir; yeni snapshot sürümü ayrı sözleşme ve migration denetimi gerektirir. Manual TCMB snapshot'ının gerçek kaynağını sunucu belirler; SQL rolü harici kaynağın kriptografik imzasını doğrulamaz.

### F05 — iki iptal yolu

Kök neden: CHECK bütün CANCELLED kayıtları için approval timestamp istiyor, trigger ise taslak iptalinde NULL istiyordu. Migration015 CHECK yalnız APPROVED/CLOSED için timestamp istiyor; geçiş trigger'ı DRAFT cancel'da NULL'u, APPROVED cancel'da önceki damganın korunmasını sağlıyor.

DB F05 testi taslak cancel200, NULL approvedAt ve yeniden approve409'u doğruluyor. Önceki onaylı cancel regresyonu da PASS. Değişen dosyalar: migration015 ve `scripts/purchases/verify.ts`. İade/teslim sonrası iptal kuralları V4.3b öncesinde uygulanmış sayılmaz.

### F06 — onay step-up

Kök neden: Onay yalnız business iznine bakıyordu. `purchases.ts` mevcut `requireMfa(headers,true,source)` mekanizmasını çağırıyor; STEP_UP_REQUIRED/MFA_REQUIRED sabit403 olarak dönüyor. `purchase-desk.tsx` bu hatada ortak doğrulama bileşenini dialog içinde açıyor. `step-up-verification.tsx` mevcut varsayılan davranışı koruyarak dönüş butonu etiketini özelleştirebiliyor; doğrulama sonrası kullanıcı onayı tekrar veriyor.

DB F06 testi geçerli MFA login oturumunda stepUpAt NULL iken403, sonra geçerli step-up ile200 görüyor. PASS. Kullanıcının TOTP kurulumu yoksa mevcut hesap güvenliği akışı gerekir; onay izni step-up yerine geçmez.

### F07 — create/edit ayrımı

Kök neden: İlk line INSERT policy'si edit gerektiriyordu. Migration015 yalnız aynı DB transaction'ında oluşturulan, version1 ve actor'a ait parent'ın ilk satırlarını create izniyle kabul ediyor (`xmin`/current transaction karşılaştırması). Daha sonra insert/delete/edit için edit zorunlu. İstemciden set edilebilen bir context bayrağına güvenilmiyor; header insert version/revision1 sınırında.

DB F07: edit explicit DENY altında create200, sonraki PATCH403 ve runtime sonradan line INSERT reddi. PASS. Create-only kullanıcıya genel edit veya append izni açılmadı.

### F08 — editör fiyatı ve gizli fiyat koruması

Kök neden: Editör manuel fiyatı boş ve para birimini USD kuruyordu. `purchase-desk.tsx` yetkili DTO'dan gerçek para birimi/fiyatı yüklüyor. CostView yoksa mevcut manuel satır `{preserveLineId,expectedDate}` ile gönderiliyor; miktar/birim/link değiştirilemiyor, fiyat istemciye gelmiyor. `purchase-contracts.ts` strict edit union'ı bu şekli tanıyor. `purchases.ts` kilitli mevcut siparişin kendi satırını bulup fiyat/dönüşüm/miktarı server-side koruyor; yabancı order line, tekrar edilen preserve ID ve ek fiyat alanı reddediliyor.

Gerçek DB F08: redacted GET, preserve PATCH200, fiyat enjeksiyonuna400, başka sipariş satırına404, yetki geri geldiğinde aynı fiyat ve toplam. PASS. `tests/purchase-desk.test.tsx` TRY/USD/EUR/GBP fiyat yükleme, gizli fiyat payload'ı, edit-only supplier yükleme, offer cache yükleme ve kirli drawer Escape/onay reddi kontrollerini yapıyor. PASS.

Kalan sınır: Maliyet izni olmadan manuel fiyatlı satırda yalnız teslim metadata'sı değiştirilebilir; miktar/birim değişimi yetkili fiyatlama gerektirir. Bu, gizli fiyatı istemciye göndermeden korumak için bilinçli dar sözleşmedir.

### F09 — miktar hassasiyeti

Kök neden: Çarpımın scale'i doğrulanmadan numeric(24,9)'a gönderiliyordu. `purchase-pricing.ts` dokuzdan fazla ondalık basamak üreten temel miktarı reddediyor; servis bunu422'ye çeviriyor. Snapshot ve kolon aynı tam temsil edilebilir miktarı tutuyor; stok miktarı yuvarlanmıyor.

Unit ve DB F09: `1.000000001 × 1.52` reddediliyor; transaction sonrasında ek sipariş kalmıyor. PASS. Çok küçük/büyük veya desteklenmeyen geometri için operatör girdiyi düzeltmelidir.

### F10 — eksik manuel fiyat

Kök neden: Refine yalnız currency alanını zorunlu kılıyordu. `purchase-contracts.ts` teklifsiz satırda pozitif manuel fiyatı da gerektiriyor. Unit ve DB F10 testi NULL fiyatı400 INVALID_INPUT ile reddediyor;503 yok. Preserve edit şekli yalnız sunucuda bulunan satır üzerinden bu kuraldan ayrılıyor. Fiyatsız bağımsız manuel satır oluşturma desteklenmiyor.

## Ek denetim notlarının sonucu

- Prisma'daki PO createdAt ve line variant indeksleri SQL015'e eklendi; isim/kolon sırası uyumlu.
- PURCHASING şablonuna GLM'nin eklediği otomatik yeni izinler kaldırıldı. SQL seed gibi yeni purchases izinleri yalnız MASTER'a otomatik ekleniyor; normal kullanıcıya açık override/şablon işlemi gerekiyor. Var olan rol ilişkilerini topluca silme/genişletme yok.
- Normal OWN testi, RLS altında `count()` ile şirket genelinde numara tahsisinin çakıştığını buldu. Tahsis artık görünmeyen kayıtlara erişmeden opak dört haneli aday seçiyor; şirket unique index'i otorite, çakışmada en fazla20 tam transaction tekrarı var. Aynı-key replay ve farklı-key paralel oluşturma testleri geçti. Numara bu sürümde art arda sıra garantisi vermez; dört haneli yıllık numara alanı kapasitesi9999'dur.
- Company/activity detay erişimi seçili bağlamı doğruluyor. Şirket geneli SupplierMaterial faaliyetli siparişte kullanılabiliyor; çocuk activity/actor parent'tan geliyor. Yanlış tenant/company temel negatifleri ve normal ACTIVITY/OWN matrisi geçti.
- Edit-only kullanıcı supplier listesini yükleyebiliyor; mevcut offer-backed satırın offer listesi editör açılışında yükleniyor. Kaydedilmemiş değişiklik koruması korunuyor.
- Yeni sipariş kaydından sonraki liste yenilemesinin ayrıntıyı temizleyebilmesi de düzeltildi: yeni order ID seçime bağlanıyor. Ayrı kalıcı UI regresyonu bu davranışı doğruluyor.
- MaterialVariant.usdCost, stok, cari, ödeme, eski satış/teklif snapshot'larına servis yazımı eklenmedi. Fixture digest ve migration content-preservation testleri geçti. Browser fixture kurulumu yalnız yeni sentetik veri oluşturuyor.

## Migration disiplini

İlk14 SQL ve pre-015 schema/privilege pinleri korundu. 015 gerçek Neon'a uygulanmadığı için kendi SQL'i düzeltildi. Son SQL'in SHA-256'ı ve dört değişen post-schema fingerprint'i gerçek Prisma fixture çıktısından güncellendi; tables/columns/triggers/types hash'leri aynı kaldı. Runner'ın drift, lock, timeout, partial-failure, no-replay ve ACL kapıları kaldırılmadı. İlk eski-pin drift sonucu silinmedi.

Kabul yerel V4.3a kod kapsamıdır; production/go-live onayı değildir. Mevcut backup allowlist'i35 tablo/21 FORCE sınırında ve yeni40 tabloluk şemaya fail-closed davranışı sürüyor. PO tabloları için gerçek yedek/restore kabulü yapılmadı; yedek guard'ı yeşil göstermek için genişletilmedi. Gerçek Neon015 apply ve operasyonel yedek kapsamı ayrıca incelenmeli. Gerçek browser smoke hedefli PO akışıdır; eski tüm browser paketinin yeniden koşulduğu iddia edilmez.

## Mimo'ya kesin dosya listesi

Aşağıdaki liste feature dalındaki GLM teslimi, korunan denetim belgeleri ve bu düzeltmenin tamamını kapsar. Bu bir commit/push talimatı değildir; gerçek Neon apply ayrıca kullanıcı onayı ister.

```text
LAST_REPORT.md
prisma/schema.prisma
prisma/migrations/202610200015_purchase_orders/migration.sql
scripts/db/migrate.ts
scripts/db/migration-baseline.json
scripts/db/migration-safety.ts
scripts/db/verify-migration-fixture.ts
scripts/suppliers/verify-local.ts
scripts/suppliers/verify.ts
scripts/purchases/verify.ts
src/app/globals.css
src/components/cloud-desk.tsx
src/components/purchase-desk.tsx
src/components/step-up-verification.tsx
src/lib/auth/catalog.ts
src/lib/cloud/purchase-contracts.ts
src/lib/cloud/purchase-pricing.ts
src/server/cloud/handler.ts
src/server/cloud/business/purchases.ts
tests/purchase-pricing.test.ts
tests/purchase-desk.test.tsx
tests/auth-e2e/v43a.spec.ts
research/PUSULA_V04_V43A_GLM_REPORT.md
research/PUSULA_V04_V43A_INDEPENDENT_AUDIT.md
research/PUSULA_V04_V43A_CODEX_FIX_REPORT.md
docs/validation/V04_V43A_VERIFICATION.md
docs/validation/V04_V43A_CODEX_AUDIT_VERIFICATION.md
docs/validation/V04_V43A_CODEX_FIX_VERIFICATION.md
```

`.env*`, `.data/`, generated Prisma client, build dizinleri, fixture, browser sonuçları ve sırlar bu listeye dahil değildir. GitHub teslimi veya V4.3b geliştirmesi bu görevde başlatılmadı.
