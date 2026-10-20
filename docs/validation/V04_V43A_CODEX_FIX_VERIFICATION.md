# V4.3a Codex düzeltme doğrulaması

20.10.2026 · **FIX_PASS — F01–F10 kapandı; yerel V4.3a kabulü tamamlandı.** Neon migration, GitHub push veya production/go-live onayı değildir.

[Düzeltme/kök neden/dosya/regresyon ayrıntıları](../../research/PUSULA_V04_V43A_CODEX_FIX_REPORT.md).

## Korunan sınırlar

Dal/HEAD `feat/pusula-v030-neon-cloud` / `2ab48ada004c830d1424cb95a8ab5a9ab052a55c`. İlk durum ve diff `.data/fix-v43a/initial-status.txt`, `initial.diff`; eski baseline `baseline-before.json`. Önceki denetim ve GLM belgeleri korunuyor. Test çıktıları Git dışındaki `.data/fix-v43a/` ve `.data/fixtures/v42-*/` altında. Neon/R2 veya gerçek kullanıcı verisi yok; commit/push/checkout/reset/merge yok.

## Koşu geçmişi — başarısız sonuçlar korunur

| Koşu | Sonuç |
| --- | --- |
| TypeScript tsc-1…tsc-6 | PASS; `--incremental false`; ara kod aşamalarının çıktıları ayrı saklı |
| Migration bootstrap `v42-c5130a98-c240-49c0-8f3b-f9cefcdcef85` | Prisma normal015 ve içerik koruma PASS; eski post-schema pin nedeniyle APPLIED_SCHEMA_DRIFT_CONSTRAINTS; serverStopped true. Bu bir kabul PASS'i değildir. |
| Fingerprint güncellemesinin ilk araç girişimi | Otomatik onay denetimi baseline değiştirme riskini gerekçe göstererek reddetti; komut çalışmadı. Kullanıcının açık 6. madde yetkisi ve dar hash farkları incelendikten sonra yalnız dört post-015 pinini güncelleyen, korunan pinleri assert eden komut onaylandı. Drift koruması kaldırılmadı. |
| Functional1 `v42-2061b14c-ecce-4917-9282-ec701862a972` | Supplier16, Purchases25 PASS; henüz sonraki normal-user/history/browser kapsamını içermez; serverStopped true |
| Functional2 `v42-2ead5296-3b2c-4033-9e5c-4d74b446cdc5` | FAIL: normal OWN kullanıcının görünmeyen şirket siparişleriyle numara çakışması409; `purchases-verify.log` korunur; serverStopped true. Numara tahsisi düzeltildi. |
| Vitest1 | 344/344 PASS; yeni UI dosyası eklenmeden önceki ara koşu |
| ESLint1 | FAIL: effect içinden state update ve kullanılmayan returnLabel; promise deferred effect ve ortak bileşende etiket kullanımı düzeltildi |
| Functional3 `v42-4072b1d3-1005-42b9-bb97-3ac8538fc2dc` | Supplier16, Purchases28 PASS; gerçek normal-user, historical TRY, SQL yarışları dahil; serverStopped true |
| Vitest2 | 29 dosya,354/354 PASS; yeni10 test dahil |
| ESLint2 | PASS,0 hata/uyarı |
| Browser1 `v42-f7da2c79-94da-4881-9383-297125a4b378` | İki proje FAIL: yeni test katalog GET için yanlış endpoint kullandı; `materials.find is not a function`. Endpoint `/workspace/catalog` olarak düzeltildi ve status assertion eklendi. Ürün hatası olarak sunulmaz; log ve error context korunur; serverStopped true. |
| Tam fixture1 `v42-433ea7d5-5421-45b7-9015-fecd0a0cf3e1` | Zorunlu migration/DB/Auth/Cloud/Supplier/Purchases kontrolleri PASS; browser'ın exact label seçicisi takıldı. Hata bağlamı kaydedildi; kimliği doğrulanan yalnız kendi Playwright ağacı durduruldu. Koşu toplamı FAIL, serverStopped true. Combobox rol seçicisi ve test timeout'u düzeltildi. |
| Browser3 `v42-69f9967a-1e85-4504-99e7-b70b8521e2fa` | İki proje FAIL: kayıt/düzenleme/dirty guard ve step-up işlendi; test, ortak bileşenin zaten otomatik kapattığı dialogda dönüş butonu bekledi. Test beklentisi otomatik kapanışa uyarlandı; ürünün step-up koruması gevşetilmedi; serverStopped true. |
| Ek UI regresyonu | Yeni sipariş sonrası ayrıntı seçimi kalıcı hale getirildi; `ui-extra.log` PASS. |
| Vitest-final | 29 dosya,355/355 PASS; toplam11 yeni unit/component testi |
| ESLint-final-2 / Build-final | exit0 / exit0; son UI düzeltmesi dahil. Build'de aynı tek rate-store warning'i var. |
| Build1 | exit0; optimize production compile, TypeScript ve route generation PASS. Mevcut rate-store.ts dinamik `.data` dosya pattern'i için bir Turbopack warning var. |
| tsc-final / eslint-final | exit0/exit0; lint0 hata/uyarı |

Build komutu `.data/fix-v43a/build.cjs` üzerinden `node node_modules/next/dist/bin/next build`. DATABASE_URL/AUTH_DATABASE_URL loopback kapalı porta override edildi; test/direct URL'ler ve dış servis anahtarları boşaltıldı. Build hiçbir DB migration veya gerçek veri sorgusu yapmadı. Build warning'i gizlenmedi; kapsam dışı eski rate-store dosyası değiştirilmedi.

## Nihai tam fixture

Komut:

`node --conditions=react-server --import tsx scripts/suppliers/verify-local.ts --approve-local-fixture --migration-safety --purchase-browser`

Nihai yeni fixture: `v42-e20dd3a4-a688-4a06-a3b8-673bfb50d651`.

Üst log `.data/fix-v43a/final-fixture-2.log`; ayrı scriptler, `migration-safety.json`, `post-schema.json`, `playwright.log`, `browser-results/.last-run.json` ve `verification.json` fixture dizininde. Toplam status PASS, failureCode null, serverStopped true.

| Katman | Sonuç |
| --- | --- |
| PostgreSQL | 18.6; yeni cluster, yalnız127.0.0.1 |
| Gerçek Prisma migration safety | 18/18 PASS |
| Preflight | 38 tablo /24 FORCE RLS /14 migration; drift yok |
| Postflight | 40 tablo /26 FORCE RLS /15 migration; fingerprint ve ACL kapıları PASS |
| DB/RLS | 11/11 PASS |
| Auth C1/C2/C3/C4/C5/C6/C61 | 7+9+8+11+8+6+13 =62 PASS |
| Cloud D | 11/11 PASS |
| Supplier | 16/16 PASS |
| Purchases | 28/28 PASS |
| Browser desktop/mobile | Gerçek Chrome:2/2 PASS; aynı yeni fixture, gerçek localhost HTTP API |

Browser smoke; MFA enrollment/login, API üzerinden sentetik malzeme/supplier/link kurulumu, drawer'dan sipariş kaydı, bağımsız30,40USD toplamı, manuel fiyatın editörde korunması, tek dirty confirm ve reddedildiğinde input koruması, step-up olmadan403, parola/TOTP step-up sonrası approve200, mühürlenmiş edit butonunun kalkması, cancel200, document-level yatay taşma olmaması ve sıfır pageerror doğruladı. Mobil Chromium iPhone13 viewport'u kullanıldı; gerçek iOS Safari cihaz testi değildir. Runner'ın bu koşuda belleğe alınmış eski browser check etiketi auth/cloud/d7/supplier adını içerir; gerçek CLI argümanı yalnız `v43a.spec.ts`, sonuç2/2'dir. Kaynaktaki etiket artık targeted purchase browser olarak düzeltilmiştir; eski browser paketinin çalıştığı iddia edilmez.

Migration safety; checksum/kolon drift, gerçek lock/statement/child timeout, unresolved/partial retry blokları, normal Prisma deploy, on tablo iki-tenant içerik koruma, environment loader, no-replay ve runtime/auth/test ACL sınırlarını kapsar. Enjeksiyon aşamasındaki beklenen FAILED satırları normal migration başarısızlığı olarak sayılmaz.

## F01–F10 kabul kanıtı

| Bulgu | Regresyon ve gözlenen davranış |
| --- | --- |
| F01 | Gerçek non-master login; OWN başka aktörü404; OWN materyal kapsamı redacted; LEGAL_ENTITY pozitif kontrol; explicit DENY ve ACTIVITY DENY altında variantUsdCost yok. PO alış fiyatı ayrı yetkilendirilir. |
| F02 | Decimal referansı2×15,20=30,40USD, temel3,04m². Offer birim/kademe hataları422; tarihi TRY76/50×2=3,04USD, fetch engelli. Unit test levha/m² ve EUR/GBP/unavailable politikası. |
| F03 | İki gerçek runtime bağlantısı; silme devam ederken onay katalogda lock bekler; ardından409 ve DRAFT/0. INSERT/onay iki satırı mühürler. Boş SQL onayı reddedilir; çift onay bir200/bir409. |
| F04 | Runtime SQL yanlış varyant/offer link, boş snapshot, bozuk toplam ve miktarı reddeder; doğru snapshot klonu kabul edilir. |
| F05 | Taslak cancel200 + NULL approval; yeniden approve409; önceki onaylı cancel testi PASS. |
| F06 | Geçerli login MFA, NULL stepUpAt ile403 STEP_UP_REQUIRED; step-up sonrası200. |
| F07 | Edit DENY altında ilk create200; sonraki PATCH403 ve doğrudan line append reddi. |
| F08 | Redacted GET sonrası preserveLineId PATCH200; fiyat injection400, başka order line404; sunucudaki fiyat/toplam aynı. Dört currency UI restore ve gizli payload unit testleri PASS. |
| F09 | Dokuz basamağa sığmayan qty×factor422; sipariş sayısı aynı, rollback doğrulandı. |
| F10 | NULL manuel fiyat400 INVALID_INPUT;503 yok. |

Mevcut aynı-key/same-payload replay, farklı-payload409, paralel aynı-key tek kayıt, yeni farklı-key paralel numara tekilliği, tenant/company negatifleri, stale version409, audit ve manuel materyal maliyeti/eski satış snapshot digest koruması da aynı gerçek fixture'da geçti.

## Fingerprint ve teslim kontrolü

Yeni015 checksum ve post-schema pinleri `scripts/db/migration-baseline.json` içinde; gerçek final Prisma koşusu bu pinlerle geçti. İlk14 checksum ve pre-015 schema/privileges korunur. Post-015 yalnız constraints/indexes/policies/functions hash'leri değişti; tables/columns/triggers/types aynı. SQL scope yeni PO tabloları/fonksiyonları/indeksleri ve yeni permission seed'iyle sınırlı.

015 SHA-256: `181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a`. Bağımsız `old-migration-integrity.json`:14 kontrol,0 değişiklik. `git diff --check` exit0.

Mimo'ya verilecek kesin28 dosya [düzeltme raporunda](../../research/PUSULA_V04_V43A_CODEX_FIX_REPORT.md). `.env/.data` veya sırlar bu listeye dahil değil. FIX_PASS alınması otomatik Neon apply veya GitHub push yetkisi vermez.

Sonuç: **FIX_PASS.** Başarısız ilk koşular yukarıda saklıdır; başarı yalnız son yeni fixture ve son355 Vitest/TypeScript/ESLint/build sonuçlarına dayanır. Mevcut backup fail-closed sınırı ve hedefli smoke kapsamı düzeltme raporunda açıklandı.
