# PUSULA v0.4 — Sprint V4.2 doğrulama

19.10.2026 · `feat/pusula-v030-neon-cloud` · başlangıç **f3e1baa** · **Git teslimini Mimo yapacak; Codex commit/push yapmadı.**

## Sonuç ve kapsam

Supplier kartları, mevcut MaterialVariant eşleştirmesi, immutable offer version ve tarih/miktar/birim kontrollü fiyat karşılaştırması geliştirildi. `/app` altında Tedarikçiler modülü, ortak SearchField ve Radix drawer kullanır; mobil/klavye/form taslağı davranışı test kapsamındadır. USD/TRY kaynaklı normalize fiyatlar orijinal tekliften ayrı snapshot'tır; EUR/GBP doğrulanmış kaynak yoksa hesaplanamaz. Tedarikçi fiyatı ana MaterialVariant.usdCost veya eski quote/sale snapshot'ını güncellemez.

Migration **202610190014_supplier_catalog** yalnız yeni yerel PostgreSQL18.6 cluster'larında uygulandı.37 Prisma modeli / metadata dahil38 tablo /24 FORCE RLS. **Neon development, production veya mevcut Neon test DB'ye uygulanmadı.** Üç yeni tablo dışında stok/satın alma/üretim/ödeme modeli açılmadı.

| Kontrol | Sonuç |
| --- | --- |
| Prisma validate / generate | PASS; offline şema kontrolü ve yerel generated client |
| TypeScript | PASS |
| ESLint | PASS,0 hata/uyarı |
| Production build | PASS, Next16.4.1; mevcut geniş .data pattern uyarısı sürer |
| Vitest | **297/297**,25 dosya,16.42s; önceki258 +26 supplier pricing/contract/tarih/hassasiyet +13 fixture target |
| DB/RLS regresyon | **11/11**, yalnız yeni yerel cluster |
| Auth/API C1–C6.1 | **62/62** (7+9+8+11+8+6+13), yalnız hayalî hesap/yerel taşıyıcı |
| Cloud/DB regresyon | **11/11**, yeni yerel cluster |
| V4.2 gerçek DB/API | **16/16**, gerçek foreign-tenant ve activity ayrımı dahil |
| Desktop/mobil Auth+cloud+D7+V4.2 Playwright | **6/6**,1.1 dakika; iki V4.2, iki Auth/cloud, iki D7 |
| Demo Playwright | **22/22**,56.4s; toplam browser **28/28** |
| Sır / dağıtım trace taraması | PASS;29 teslim dosyası+23 production client JS;16 trace'de .data girdisi0 |
| Gerçek development migration | **UYGULANMADI**, ayrı onay gerekir |
| Neon/R2/production/Master/MFA gerçek veri işlemi | **YOK** |

## Kanıtın sınırı

Gerçek yerel DB kontrolü: iki supplier→aynı variant; bir supplier→iki variant; request replay/conflict; concurrent version/replay; immutable owner UPDATE/DELETE reddi; tarihler/expiry; TCMB biçimli sentetik TRY snapshot'ı ve EUR/GBP null; conversion/tier sıralama; explicit cost DENY DTO redaksiyonu; revoke sonrası detail/replay reddi; restricted normal kullanıcının başka şirketi görememesi; gerçek yabancı tenant satırları ve cross-tenant composite FK reddi; seçili faaliyet dışı supplier'ların karşılaştırmadan çıkarılması; pasifleştirme/version; fixture tenant'ının Variant/PriceHistory/Quote/Sale/Line hash'inin değişmemesi. Bu, gerçek müşteri verisi veya canlı Neon süreklilik kanıtı değildir.

Son tam koşu **v42-3ce925eb-61a1-4309-987d-d54a1330e26a**,127.0.0.1:55432, PostgreSQL18.6, PID27820:14 migration/38 tablo/24 FORCE RLS; DB/Auth/cloud/V4.2 ve browser28/28 birlikte PASS, serverStopped=true. Kanıt `.data/fixtures/v42-3ce925eb-61a1-4309-987d-d54a1330e26a/verification.json` ve aynı dizindeki test log/PNG'lerdir; bunlar Git dışıdır.

Son MOQ hassasiyet sertleştirmesi sonrası297 Vitest, TypeScript/lint/build ve **v42-19a74f00-b401-4f2b-ad04-5c20ec754a7f** odaklı yerel koşuda Auth C2 9/9+V4.2 16/16 tekrar geçti; bu sunucu da güvenle kapandı. MOQ hesabı40 basamaklı Decimal ile yapılır; büyük24,9 değerinin sessizce20 anlamlı basamağa yuvarlanması ve9 kesir basamağını aşan dönüşüm ayrı testtir. Bu, üretim hacmi benchmark'ı değildir.

Bağımsız son CIM/port kontrolü: bu çalışmaya ait v42 PostgreSQL süreci0;55432 ve3100 listener0. Son odaklı süreç PID10868 idi; yalnız kendi data/exe/creation kimliğiyle kapatıldı.29 dosyalık Mimo listesi gerçek working tree listesiyle birebir,29 yerel Markdown bağlantısı ve `git diff --check` PASS. ROADMAP/ARCHITECTURE, eski13 migration, backup motoru ve package-lock değişmedi; index boş, yeni commit/push yok.

V4.2 browser kapsamı:503'te form koruma, dirty Escape onayını iptal, klavye focus trap, reload sonrası gerçek yerel DB kalıcılığı, link ve iki offer sürümü, history ve karşılaştırma, ölçüt değişince eski önerinin silinmesi, pasifleştirme, arama focus ölçümü ve kart içi responsive sınırlar. Desktop/mobil PNG'ler açılıp incelendi. Yalnız document.scrollWidth testi yeterli sayılmadı; panel scrollLeft0 ve modül kutusunun panel içinde kalması ayrıca doğrulandı. Gerçek Neon yeniden giriş/compute restart kalıcılık kabulü ayrı development onayı sonrasıdır.

Normal kullanıcıya fiyat/API snapshot gönderilmemesi ve karşılaştırma403 ayrı kanıtlandı. Testteki TCMB snapshot'ı bağımlılık enjeksiyonudur; kullanıcı API'den rate/normalizedUsd/tenant/actor gönderemez. Gerçek TCMB ağ servisiyle EUR/GBP çapraz kur veya bağımsız fiyat doğrulama sertifikasyonu yoktur. Eski Vitest ve browser sonuçları bu sprintin yeni testleri yerine sayılmadı.

Fixture tamamen yeni UUID dizininde,127.0.0.1/SCRAM/özel ACL ile; aynı DB adı mevcut Neon test DB'ye bağlanıldığı anlamına gelmez. `PUSULA_LOCAL_FIXTURE` marker/port/rol kontrolü yalnız test ve non-production ortamına açıktır; açıkken tüm remote URL'ler reddedilir. Varsayılan Neon verify-full politikası değişmedi. Fixture kimlik dosyaları mevcut ortak test fixture'larına yazılmaz. İş bitiminde yalnız kendi PID/data/exe/creation identity'siyle sunucu kapatılır.

## Denemeler ve düzeltmeler

İlk iki tam koşu eski çok üyelikli Auth fixture seçimi yüzünden C3/C4'te durdu; fixture helper asıl bootstrap membership'i açıkça seçecek şekilde düzeltildi. Üçüncü koşu tüm eski DB/Auth/cloud regresyonlarını geçti; yeni V4.2 test materyalinin zorunlu margins alanı eksik olduğundan400/FAIL aldı. Sonraki supplier-only koşu14/14 geçti. Yeni gerçek foreign-tenant fixture eklenince bütün tenantları hash'leyen kontrol bilinçli yeni satırı değişiklik sandı; kontrol korunacak asıl fixture tenant'ına sınırlandırıldı. Bu koşu da FAIL kaydedildi, başarı sayılmadı. Sonrasında15/15, faaliyet senaryosu eklenince16/16 geçti. Tüm koşular kendi sunucularını güvenle kapattı.

İlk browser denemelerinde senaryolar arasında paylaşılan rate-limit kovaları429, generic status locator'ında başarı+loading strict çakışması, ilk auth isteğinde bekleme aşımı ve select label exact eşleşme hatası görüldü. Ürün limitleri kaldırılmadı: yalnız doğrulanmış yeni yerel fixture'da senaryolar arası rate-limit reset, salt okunur auth route ısınması, uygun bekleme ve erişilebilir combobox role locator'ı kullanıldı. Bilinen pg@9.0 deprecation mesajının Next tarafından error kanalına iletilmesi tam mesajla ayrı sayılır; diğer beklenmeyen console/pageerror testi hâlâ başarısız yapar. Son Auth browser audit'i her projede beklenen HTTP6, beklenmeyen0; desktop knownPg1/mobile0.

İlk browser6/6 sonrası mobil PNG'de kart içi kırpılma bulundu. Grid min-content genişliği, scroll container ve checkbox/buton yerleşimi düzeltildi; daha güçlü kart sınırı ölçümüyle tam browser koşusu tekrarlandı. Son6/6 ve demo22/22 bu düzeltmeden sonradır. Başarısız denemeler PASS toplamına eklenmedi. Bekleyen kayıtta alanlar kilitli, hata yanıtında taslak korunur; karşılaştırma miktarı/birimi/tarihi değişince önceki öneri gösterilmez.

Prisma offline diff ilk sandbox child-process EPERM ve geçici UTF-8 BOM hatasıyla durdu; güvenlik/TLS kapatılmadan izinli local renderer ve BOM'suz geçici dosyayla düzeltildi. PowerShell npx.ps1 execution policy engeli aşılmadı; doğrudan Node/npm.cmd entrypoint'leri kullanıldı. İlk lint effect/state ve test değişken adı hataları düzeltildi. Bunlar başarı kaydı değildir.

Mevcut pg deprecation/Next development stream/NO_COLOR/reduced-motion uyarıları görüldü; sıfır warning/log iddiası yoktur. Build'de rate-store geniş `.data` pattern uyarısı sürer;16 dağıtım trace'inde .data girdisi0 olarak doğrulandı. Gerçek Safari/Firefox/ekran okuyucu veya üretim yükü sertifikasyonu yapılmadı.

## Yeniden üretim ve Mimo dosyaları

Yalnız aynı Windows ortamındaki doğrulanmış taşınabilir18.6 araçlarıyla, **yeni yerel synthetic fixture**:

```powershell
npm.cmd run suppliers:test:local -- --approve-local-fixture --with-browser
```

Bu komut gerçek development migration'ı yapmaz. `--supplier-only` daha kısa yeni modül alt kümesidir; tam DB/Auth regresyonu yerine sayılmaz. Fixture/browse logları, encrypted test credentials ve PNG'ler yalnız `.data/fixtures/v42-UUID` altında Git dışındadır. Auth trace/video kapalı; screenshots sentetiktir. Ortak D7 screenshot dosyaları local fixture modunda değiştirilmez.

Mimo'ya devredilecek **29 çalışma ağacı dosyası**; index boş, HEAD hâlâf3e1baa. `.data`, `.env.local`, generated Prisma ve build çıktıları teslim edilmeyecek. Dependency/paket sürümü/lockfile değişmedi; package.json yalnız yeni yerel test komutunu ekler.

```text
LAST_REPORT.md
docs/validation/V04_SPRINT_V42_VERIFICATION.md
research/PUSULA_V04_SPRINT_V42_AUDIT.md
package.json
prisma/schema.prisma
prisma/migrations/202610190014_supplier_catalog/migration.sql
scripts/auth/fixture-files.ts
scripts/auth/fixture.ts
scripts/auth/master-fixture.ts
scripts/auth/prepare-browser.ts
scripts/suppliers/verify-local.ts
scripts/suppliers/verify.ts
src/app/globals.css
src/components/cloud-desk.tsx
src/components/supplier-desk.tsx
src/lib/auth/catalog.ts
src/lib/cloud/supplier-contracts.ts
src/lib/cloud/supplier-date.ts
src/lib/cloud/supplier-pricing.ts
src/server/cloud/business/suppliers.ts
src/server/cloud/handler.ts
src/server/db/local-fixture.ts
src/server/db/target.ts
tests/auth-e2e/auth.spec.ts
tests/auth-e2e/d7.spec.ts
tests/auth-e2e/local-isolation.ts
tests/auth-e2e/v42.spec.ts
tests/local-fixture-target.test.ts
tests/suppliers.test.ts
```

[Teknik denetim ve izin eşlemesi](../../research/PUSULA_V04_SPRINT_V42_AUDIT.md). Gerçek development migration ve yeni8 Permission/Master/grant uygulaması ayrı açık kullanıcı onayı bekler. Gerçek Neon backup rolü/PUBLIC TEMP/CONNECT/builtin ownership ve R2/E3/E4 production kapıları korunur; backup allowlist'ine yeni nesneler eklenmedi. Main/GitHub teslimi bu çalışma kapsamında Codex tarafından yapılmadı.
