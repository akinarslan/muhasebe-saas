# V4.3a doğrulama — Satın Alma Siparişleri ilk çalışan modül

Tarih: 20.10.2026 (İstanbul) · Branch: `feat/pusula-v030-neon-cloud` · HEAD `2ab48ad` (commit'siz) ·
Karar kodu: **V4.3a — LOCAL_ACCEPTANCE_PASS**

## Kabul koşusu (tek koşu, gerçek sonuçlar)

Komut: `npm run suppliers:test:local -- --approve-local-fixture --migration-safety --supplier-only`
Fixture: `v42-f8a7c083-db7f-480a-9a77-5baeebd82e9f` · PostgreSQL 18.6 · 127.0.0.1:55432 ·
`.data/fixtures/v42-f8a7c083-.../verification.json` `status: PASS`, `failureCode: null`, `serverStopped: true`.

### Migration safety — 18 kontrol PASS (ms değerleri gerçek)

| Kontrol | Durum | ms |
| --- | --- | --- |
| baseline-schema-pin | PASS | 33 |
| wrong-checksum | PASS | 2 |
| column-drift | PASS | 18 |
| shared-env-readonly-preflight-reference | PASS | 0 |
| lock-timeout-real-prisma | PASS | 4406 |
| unresolved-retry-blocked | PASS | 2 |
| statement-timeout-real-prisma | PASS | 31115 |
| child-timeout-real-prisma | PASS | 4054 |
| nontransactional-partial-failure | PASS | 1330 |
| partial-retry-blocked | PASS | 2 |
| normal-real-prisma-015 | PASS | 1261 |
| ten-table-two-tenant-auth-financial-content-preserved | PASS | 0 |
| actual-next-env-loader-private-fixture | PASS | 0 |
| already-applied-no-replay | PASS | 85 |
| no-test-or-auth-supplier-grants | PASS | 0 |
| purchase-order-runtime-grants-fail-closed | PASS | 0 |
| eight-master-permissions-explicitly-observed | PASS | 0 |
| six-master-purchase-permissions-explicitly-observed | PASS | 0 |

Preflight: 38 tablo/24 FORCE RLS, 14 başarılı migration, `pending: 202610200015_purchase_orders`, drift yok.
Postflight: 40 tablo/26 FORCE RLS, 15 migration, `ALREADY_APPLIED`, replay yok.
ACL gözlemi (`poRights`): runtime PO SEL/INS/UPD + POLine SEL/INS/DELETE TRUE; runtime POLine TRUNCATE, test_runtime PO SELECT, auth POLine SELECT — hepsi FALSE (fail-closed doğrulandı).
`appliedSchema` 8 hash, `v42-10349b4e` koşusunun gerçek `post-schema.json` çıktısından `migration-baseline.json`'a pinlendi; ikinci koşu bunlarla birebir uyuştu (drift yok).

### Doğrulama scriptleri

- `scripts/auth/verify-c2.ts` — 9/9 PASS
- `scripts/suppliers/verify.ts` — 16/16 PASS (V4.2 regresyon koruması)
- `scripts/purchases/verify.ts` — 16/16 PASS. Kontrol adı listesi (gerçek log):
  1. multi-line offer-backed draft order; same-key replay and conflicting payload 409
  2. list shows order with lineCount; status/supplier filters and search
  3. detail freezes exact Decimal conversion and USD totals for master
  4. explicit cost DENY redacts prices and blocks manual-price creation
  5. revoked view permission hides detail/list and blocks creation
  6. manual-price line records MANUAL snapshot and requires costView
  7. EUR/GBP never fabricate USD; TRY only follows an explicit TCMB snapshot
  8. draft edit replaces all lines; stale version conflicts 409
  9. approve stamps approver; re-approve and stale concurrent approve rejected
  10. approved order cannot be edited again; cancellation seals all paths
  11. database guards: immutable identity, forced version step, sealed lines
  12. concurrent same-key creates collapse to one order; numbers unique
  13. foreign tenant and foreign company stay invisible; scope via real APIs
  14. audit events recorded for created, updated, approved and cancelled orders
  15. inactive supplier blocks new orders; offer flow untouched
  16. material USD costs, price history and quote/sale snapshots unchanged; backup stays failed-closed

### Derleme / unit

- Vitest: 344/344 PASS (28 dosya; `tests/purchase-pricing.test.ts` 15/15).
- `npx tsc --noEmit`: temiz. `npm run lint`: 0 hata / 0 uyarı.

## Kısıtlara uyum

- Migration yalnız izole yerel fixture DB'de uygulandı. Neon (development/test/production), R2, restore/finalize işlemi yok.
- 014 ve öncesi checksum'lar değişmedi; `scripts/backup/postgres.ts` sabit pinleri dokunulmadı (PO tabloları yedekte yok; gerçek aktif tablo sayımı 40).
- PL/pgsql'de `OLD`/`NEW` yalnız trigger fonksiyonlarında; RLS politikalarında yalnız geçerli satır + `pusula_can`; tenant/LegalEntity/Activity/DENY kontrolleri zayıflatılmadı.
- PO akışı stok/cari/ödemeye dokunmaz; `MaterialVariant.usdCost` otomatik güncellenmez; TRY yalnız açık TCMB snapshot'ı ile dönüşür, EUR/GBP hiçbir zaman USD'ye çevrilmez (`CURRENCY_SOURCE_UNVERIFIED`); approve sonrası snapshot ve satırlar mühürlü.

## Bilinen iterasyon geçmişi (gerçek, uydurma yok)

Eksploratif koşularda doğrulama sabitlemeleri: yedek fail-closed sayımı 38→40; PO DTO `fxSnapshot` iç içe fx alanına bağlandı; fixture yabancı-tenant INSERT'i kendi kendine yeterli yabancı grafına taşındı (composite FK ihlali giderildi); partial-schema kontrolleri 015 tablo sınıflandırmasına göre güncellendi (`supplierTables === 3` invarianı korunarak); fixture bootstrap'ta Role seed'i ilk cross-join'e (011) ve `Role` tablosunun 005'te var olmasına bağlı olarak döngü içine konumlandırıldı; `has_table_privilege` kolon alias lowercasing. Önceki kabul koşusunun `APPLIED_SCHEMA_DRIFT` ile düşmesi beklendi (iki fazlı post-schema pin bootstrap'ı), ardından 8 hash sabitlenerek ikinci koşu tam PASS oldu. Koşu kayıtları `.data/fixtures/v42-*` altında korunmaktadır.

## Teslim

Commit/push yapılmadı. Git teslimi Mimo'ya. Detaylı sprint raporu: `research/PUSULA_V04_V43A_GLM_REPORT.md`.
