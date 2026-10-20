# V4.3a — Codex bağımsız test doğrulaması

20.10.2026 · **AUDIT_FIX_REQUIRED / NO-GO**

Kapsam, bulgu konumları, etkileri ve düzeltme önerileri: [bağımsız denetim](../../research/PUSULA_V04_V43A_INDEPENDENT_AUDIT.md).

## Başlangıç ve bütünlük

- Dal: `feat/pusula-v030-neon-cloud`.
- HEAD: `2ab48ada004c830d1424cb95a8ab5a9ab052a55c`.
- Başlangıç tracked değişiklikleri: LAST_REPORT.md, prisma/schema.prisma, scripts/db/{migrate.ts,migration-baseline.json,migration-safety.ts,verify-migration-fixture.ts}, scripts/suppliers/{verify-local.ts,verify.ts}, src/app/globals.css, src/components/cloud-desk.tsx, src/lib/auth/catalog.ts, src/server/cloud/handler.ts.
- Başlangıç untracked: docs/validation/V04_V43A_VERIFICATION.md, prisma/migrations/202610200015_purchase_orders/, research/PUSULA_V04_V43A_GLM_REPORT.md, scripts/purchases/, src/components/purchase-desk.tsx, src/lib/cloud/{purchase-contracts.ts,purchase-pricing.ts}, src/server/cloud/business/purchases.ts, tests/purchase-pricing.test.ts.
- Git dışı kayıtlar: `.data/audit-v43a/initial-status.txt`, `initial.diff`, `initial-hashes.json`, `checksums.json`. İlk Node hash toplama girişimi `spawnSync git EPERM` verdi; shell-native Get-FileHash ile kaydedildi.
- Uygulama/SQL/Prisma/test kaynakları değiştirilmedi. Yalnız bu iki rapor eklendi. Commit, push, checkout, reset, merge yok.
- Son SHA-256 karşılaştırmasında başlangıç manifestindeki hiçbir dosya değişmedi; `final-integrity.json` kaydı `changedOriginalFiles: []`. Dal ve HEAD aynı kaldı. Üç başarılı fixture'ın tamamında `serverStopped:true` ve postmaster.pid yokluğu doğrulandı.

## Genel testler — bağımsız tekrar koşusu

| Test | Komut | Sonuç / kanıt |
| --- | --- | --- |
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit --incremental false` | exit 0; `.data/audit-v43a/typescript.log`; incremental dosya yazımı kapalı |
| ESLint | `node node_modules/eslint/bin/eslint.js .` | exit 0, 0 hata/uyarı; `eslint.log` |
| Vitest ilk girişim | `node node_modules/vitest/vitest.mjs run` | exit 1; esbuild alt süreç başlatması sandbox EPERM; `vitest.log`; ürün test başarısızlığı değil |
| Vitest izinli tekrar | aynı komut | 28 dosya, 344/344 PASS; `vitest-retry.log` |
| Fixture ilk girişim | aşağıdaki fixture komutu | exit 1, preparation failed; sandbox alt süreç kısıtıyla ilişkilendirildi; `fixture.log`; ayrıntıyı runner bastırıyor |
| Fixture izinli tekrar | `node --conditions=react-server --import tsx scripts/suppliers/verify-local.ts --approve-local-fixture --migration-safety` | exit 0; tüm scriptler PASS; `fixture-retry.log` |

İlk başarısız girişimler silinmedi. Test kaynakları veya beklenen değerler yeşil sonuç üretmek için değiştirilmedi. İzinli tekrarlar yalnız alt süreç çalıştırma kısıtını kaldırdı.

## Gerçek PostgreSQL 18.6 migration ve tam regresyon

Yeni fixture: `v42-c2932110-97db-4098-a08f-9f930c5917c8`.

Kanıt dizini: `.data/fixtures/v42-c2932110-97db-4098-a08f-9f930c5917c8/`.

`verification.json`: `status:PASS`, `failureCode:null`, `serverStopped:true`, 15 migration, 40 public tablo, 26 FORCE RLS. Fixture 18.6 binaries/archive pin kontrolünden geçti; mevcut eski fixture kümeleri kullanılmadı. Runner yalnız loopback ve kendisine ait PID/data directory kimliğini doğruluyor.

| Test grubu | Gerçek PASS sayısı |
| --- | ---: |
| Migration safety | 18 |
| scripts/db/verify.ts | 11 |
| Auth C1 | 7 |
| Auth C2 | 9 |
| Auth C3 | 8 |
| Auth C4 | 11 |
| Auth C5 | 8 |
| Auth C6 | 6 |
| Auth C61 | 13 |
| Cloud D | 11 |
| Supplier | 16 |
| Purchases | 16 |

Auth C serisi toplamı 62. Bunlar senaryo/check sayılarıdır; Vitest test sayısına eklenerek tek bir unit-test sayısı olarak sunulmaz.

Migration safety 18 kontrolü: baseline-schema-pin; wrong-checksum; column-drift; shared-env-readonly-preflight-reference; lock-timeout-real-prisma; unresolved-retry-blocked; statement-timeout-real-prisma; child-timeout-real-prisma; nontransactional-partial-failure; partial-retry-blocked; normal-real-prisma-015; ten-table-two-tenant-auth-financial-content-preserved; actual-next-env-loader-private-fixture; already-applied-no-replay; no-test-or-auth-supplier-grants; purchase-order-runtime-grants-fail-closed; eight-master-permissions-explicitly-observed; six-master-purchase-permissions-explicitly-observed.

Fault-injection aşamalarındaki `FAILED/PRISMA_CHILD_FAILED` logları beklenen enjeksiyon sonucudur; son normal apply başarılıdır. Gerçek preflight 38 tablo/24 FORCE/14 migration, postflight 40/26/15. 10 tablo × iki tenant referans içeriği korundu. Bu kontrollü fixture eski canlı verilerin bütünü hakkında kanıt değildir.

Runtime PO SELECT/INSERT/UPDATE ve line SELECT/INSERT/DELETE var. Runtime line TRUNCATE, test_runtime'ın migrate sonrası PO SELECT'i ve auth'ın line SELECT'i yok. Acceptance runner daha sonra yalnız kendi yeni test rolüne gerekli test grant'lerini veriyor; production grant genişlemesi iddiası değil. SQL negative/permission testlerinde non-owner bağlantı kullanılıyor; admin ile yapılan kontroller ayrıca kaynak scriptte görülebilir.

## Checksum ve schema fingerprint

İlk 14 migration SQL'inde HEAD diff'i yok. HEAD baseline'daki ilk 14 checksum aynı; yerel 15 dosyanın tamamı baseline SHA-256 ile eşleşiyor. Yeni 015:

`e6327df97daa1c933b8d81c7f7dbbd1b8d62060994d75eb7f0c6ebbf06fe94cc`

`checksums.json` 15 satırlık bağımsız dosya hash kaydıdır. Schema tables/columns/constraints/indexes/policies/triggers/functions/types pinleri gerçek PG pre/post catalog üzerinden doğrulandı. Fingerprint eşleşmesi F01–F10 davranış kusurlarını engellemedi. Migration 015 gerçek Prisma deploy yoluyla çalıştı; bu koşuda 42P01/42703 gözlenmedi. SQL-only CHECK/trigger/RLS ile Prisma modeli birlikte incelendi.

## Ek bağımsız adversarial testler

Uygulama/test dosyalarını değiştirmemek için acceptance runner ve purchase scriptinin kopyaları `.data/audit-v43a/runner.ts` ve `probes.ts` altında oluşturuldu. Kopyalarda relative import yolları ayarlandı; uygulama kodu aynen import edildi. Ek probe'lar var olan acceptance beklentilerini değiştirmedi. Probe logundaki script PASS'i orijinal 16 check'in geçtiğini anlatır; aşağıdaki kusurların düzeldiği anlamına gelmez.

İlk ek fixture: `v42-89a9493c-ceea-4d8a-8f68-d9de63461bd9`; genişletilmiş koşu için ayrıca yeni fixture: `v42-4eaaf6ce-9a7f-48cf-9d93-fe93103f2ede`. İkisi de `status:PASS`, `serverStopped:true`. Genişletilmiş koşu yeni üç senaryo eklemek için yapıldı; önceki bulgular iki ayrı kümeye karşı tekrar üretildi. Kopya runner migration-safety bayrağı olmadan 15 SQL'i yeni boş kümeye uyguladı; gerçek Prisma/fingerprint kanıtı yukarıdaki tam koşudadır.

Komut:

`node --conditions=react-server --import tsx .data/audit-v43a/runner.ts --approve-local-fixture --supplier-only`

Genişletilmiş ham kanıt: `.data/fixtures/v42-4eaaf6ce-9a7f-48cf-9d93-fe93103f2ede/audit-v43a-probes.log`; üst seviye `probes-fixture-extended.log`.

| Probe | Gözlenen sonuç | Hüküm |
| --- | --- | --- |
| materials-cost-deny | materials.costView DENY + HTTP 200 + variantUsdCost `4` | F01 doğrulandı |
| purchase-unit-price-total | 2 metre, 15.2 USD/metre; beklenen 30.4, dönen 46.208 | F02 doğrulandı |
| delete-approve-race | runtime silme açık transaction → API approve 200 → silme commit; APPROVED / 0 satır | F03 doğrulandı |
| runtime-mismatched-variant-snapshot | link 152 cm, line varyantı 137 cm, iki snapshot `{}`; runtime INSERT commit | F04 doğrulandı |
| draft-cancellation | geçerli version ile taslak cancel → 503 SERVICE_UNAVAILABLE | F05 doğrulandı |
| approval-without-step-up | session stepUpAt NULL, approve → 200 / approved true | F06 doğrulandı |
| create-with-edit-denied | create mevcut, edit DENY; ilk line INSERT → 503 | F07 doğrulandı |
| base-quantity-rounding | exact 1.52000000152, saklanan 1.520000002, HTTP 200 | F09 doğrulandı |
| manual-null-price | manualCurrency USD, manualUnitPrice NULL → 503 | F10 doğrulandı |
| parallel-approve | eşzamanlı iki approve: bir 200 ve bir 409 VERSION_CONFLICT | Bu interleaving PASS |

Ek probe'lar gerçek Request/handler yanıtını ölçüyor; doğrudan HTTP socket/Next route E2E değildir. Tenant/şirket negatifleri ve aynı-key aynı/farklı payload/concurrent create, onay sonrası normal PATCH reddi, APPROVED cancel, audit ve variant/sales snapshot korunması orijinal gerçek DB testlerinde ayrıca geçti.

## UI testi ve yapılmayanlar

Komut: `node node_modules/vitest/vitest.mjs run --config .data/audit-v43a/ui.config.mts`.

İlk `ui.log` koşusunda bağımsız testin PowerShell kodlaması Türkçe buton seçicisini bozduğu için 1/1 FAIL. Yalnız Git dışındaki test seçicisi ASCII regex'e çevrildi. `ui-retry.log`: 1/1 PASS; kayıtlı TRY 50'nin editörde USD ve boş fiyatla açıldığı doğrulandı (F08). Bu, hatalı davranışı belgeleyen testtir; ürünün doğru davranış testi değildir. Mocked fetch ve jsdom kullanıldı.

Gerçek masaüstü/mobil browser, responsive layout, klavye/focus, çift confirm etkileşimi ve HTTP cookie taşıma testi **NOT RUN**. Next dev/build başlatılmadı. ACTIVITY/OWN kapsamlı tam normal-user matrisi, farklı key'lerle paralel numara tahsisi, tüm line INSERT/DELETE race varyasyonları, tam tarihi TCMB matrisi, whole-sheet miktar politikası ve sıfır fiyatlı pending workflow **tamamlanmış kabul edilmez**. Neon veya mevcut kullanıcı verisiyle test yapılmadı.

## Son kapı

Genel test PASS'leri yeniden üretildi; ek gerçek DB testleri teslim engelleyici kusurları ortaya çıkardı. **AUDIT_FIX_REQUIRED / GitHub NO-GO**. Düzeltme kapsamı GLM'ye ayrı görev olarak verilmeli; bu denetim kaynakları düzeltmedi ve Mimo teslimini başlatmadı. Kanıt dosyaları Git dışında tutuldu; fixture kimlik/PID/dizin kayıtları yerelde korunuyor, raporlara bağlantı parolaları veya oturum sırları kopyalanmadı.
