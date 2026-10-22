# PUSULA V4.3b.12 — DELIVERY_PASS

22.10.2026. V4.3b.10–12 kod ve raporları yalnız `feat/pusula-v030-neon-cloud` dalına normal commit/push kapsamındadır. Kullanıcı bu teslim için açık yetki verdi. Bu yetki gerçek Neon migration uygulama onayı değildir.

## Başlangıç ve kapsam

HEAD ve yerel upstream `d65ea89d915805dbf6b6e5afd111beb727cf7ef5`; ahead/behind0/0. Gerçek `git ls-remote origin refs/heads/feat/pusula-v030-neon-cloud` aynı SHA'yı doğruladı. İlk sandbox sorgusu proxy bağlantı hatası verdi; ağ erişimli salt okunur sorgu başarılı oldu. Başlangıç index boş; çalışma ağacı V4.3b.12 raporundaki18dosyayla birebir eşleşti. Beklenmeyen kullanıcı dosyası yok. Bu raporla benzersiz teslim kapsamı19dosyadır.

V4.3b.10 CLOUD_PREFLIGHT_PARTIAL ve V4.3b.11 FIX_REQUIRED belgeleri tarihsel içerikleriyle korundu. V4.3b.12 ACL_FIX_PASS, önceki kusurun giderildiği yerel kabul kaydıdır. Eski bulgular silinmedi. LAST_REPORT'un teslim başlangıcındaki içeriği değiştirilmedi; önceki sonuçları korur.

## Bu teslimde yeniden çalıştırılan kontroller

| Komut | Gerçek yeni sonuç |
| --- | --- |
| `npm.cmd test` | 35dosya / 417/417 PASS; native exit0 |
| `npx.cmd tsc --noEmit` | PASS; native exit0 |
| `npm.cmd run lint` | PASS; native exit0; ESLint uyarısı yok |
| `npm.cmd run build` | PASS; native exit0 |
| `node --conditions=react-server --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | Git LF/Windows checksum ve history/byte negatifleri9/9 PASS; native exit0; DB bağlantısı yok |

Build'de `src/lib/rate-store.ts` üzerinden mevcut geniş `.data` pattern tracing uyarısı sürüyor; derleme hatası değil. Loglar `.data/v43b12-delivery/` altındadır; teslim dışıdır. Bu teslimde production build haricinde uygulama/DB altyapısı çalıştırılmadı; PostgreSQL fixture/SQL komutu başlatılmadı.

## Bütünlük ve güvenlik

- Migration016 ham SHA-256: `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`. Stock runner, stock baseline, managed baseline ve managed contract aynı değere bağlıdır. SQL LF baytları korunur; staged Git blob'u ayrıca aynı SHA ile kontrol edilir.
- İlk15SQL ve eski DB baseline/checksum mekanizması başlangıç manifest'i ve Git farkıyla değişmemiştir. Beş tam migration adı/sabit tarihsel byte hash çifti korunur; genel LF/CRLF/whitespace normalizasyonu veya history bypass yok. Bilinen failed008 hash'i yalnız resolved rollback kabulüdür; başarılı migration SQL'i olarak kullanılamaz.
- SQL'de dört definer OWNER devri sonrası ACL işlemleri açık SET LOCAL ROLE executor altında; RESET ROLE her blokta var. Üç API fonksiyonunda runtime EXECUTE, dört definer ve iki helper'da PUBLIC revoke korunur. Complete trigger'ları owner devrinden önce actor tarafından kurulur.
- Geçici creator, kendi SET grant'ini kaldırdıktan sonra DROP edilir. Executor LOGIN/BYPASSRLS/CREATEROLE veya kalıcı schema CREATE almaz; runtime/auth executor üyeliği yok. Bu teslim kaynak ve önceki kanıtı inceler; yeni canlı SQL sonucu iddia etmez.
- Managed `post=null`, contract `postFingerprint=null`, `applyEnabled=false`, koşulsuz `STOCK_MANAGED_APPLY_DISABLED`, stock loopback/UUID ve eski cloud guard korunur. Yeni bir cloud apply yolu açılmadı. Otomatik post enrollment yok.

### Önceki PostgreSQL kanıtı — bu teslimde yeniden koşulmadı

V4.3b.12 pinli managed fixture `v42-40117b10-a561-4270-a0d9-a08b54b7fca0`: non-superuser PG18.6, test-only ACL düzeltmesi olmadan PUBLIC EXECUTE0/runtime-direct3/auth0,47/33/16;15managed+13contract+2bağımsızACL+9artifact, AuthC2 9/Supplier16/Purchase28/Stock36. Orta executor-aktif ve geç hata enjeksiyonunda tam rollback; creator/üyelik/schema CREATE kalıntısı yok; cluster kapandı.

Önceki normal Prisma fixture `v42-e2d64db7-ccc0-41d1-bc30-4ea7f4dbf2cb`: runner20, DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36; cluster kapandı. Yeni yerel managed post ACL `3ab7232843c282dae790b6a5f87c81222f2908a1b3a2c80fd89f54b58ccf4a38`. Sekiz schema hash'i ve normal fixture pinleri aynı. Bunlar [V4.3b.12 doğrulama kanıtıdır](../docs/validation/V04_V43B12_VERIFICATION.md), yeni Neon veya teslim PostgreSQL ölçümü değildir. Sanitized önceki function ACL/rol temizliği artifact'ları yalnız dosya olarak incelendi.

### Hassas bilgi ve index kontrolü

Yalnız aşağıdaki19dosya explicit path listesiyle stage edilir. `.data`, `.env`, credentials, gerçek Auth/MFA/session verisi, PostgreSQL data dizinleri, build/generated artifact'ları kapsam dışıdır. Working ve staged içerikler private-key/GitHub-token/AWS-key/Neon-key/JWT desenleri ve literal DB URL'leri bakımından taranır. Test bağlantıları yalnız synthetic/fake/string-template değerleridir; gerçek secret gönderilmez. `git diff --cached --check`, staged kapsam eşitliği ve staged016 SHA kontrolü commit öncesinde zorunludur. Sonuçlar aşağıdaki Git kaydında belirtilir.

## Kesin teslim listesi — 19 dosya

1. `prisma/migrations/202610210016_goods_receipts/migration.sql`
2. `scripts/stock/migrate.ts`
3. `scripts/stock/migration-baseline.json`
4. `scripts/stock/managed-baseline.json`
5. `scripts/stock/managed-fixture-baseline.json`
6. `scripts/stock/managed-contract.json`
7. `scripts/stock/managed-contract-fixture.ts`
8. `scripts/stock/managed-fixture.ts`
9. `research/PUSULA_V04_V43B12_ACL_FIX.md`
10. `docs/validation/V04_V43B12_VERIFICATION.md`
11. `LAST_REPORT.md`
12. `research/PUSULA_V04_V43B10_NEON_PREFLIGHT.md`
13. `docs/validation/V04_V43B10_VERIFICATION.md`
14. `research/PUSULA_V04_V43B11_MANAGED_RUNNER.md`
15. `docs/validation/V04_V43B11_VERIFICATION.md`
16. `scripts/stock/managed-contract.ts`
17. `scripts/stock/managed-runner.ts`
18. `tests/stock-managed-contract.test.ts`
19. `reports/PUSULA_V04_V43B12_CODEX_DELIVERY.md`

## Açık Neon ve R2 engelleri

Son provider401 tarihsel; güncel kimlik/kapasite/operasyon teyidi yok. Provider'a özgü rol/grantor yaşam döngüsü, eksik genişletilmiş managed pre grantor kanıtı ve gerçek post kabulü açık. Recovery token_roles farkı **ROLE_DELTA_UNRESOLVED**; tam rol eşitliği/restore kabulü yok. Bağımsız R2 backup/restore operasyonel kabulü ve35/21 allowlist'inin47/33 kapsam engeli sürüyor. Git teslimi bunları kaldırmaz.

Gerçek Neon development/test/production SQL, migration apply, gerçek rol/ACL/GRANT, recovery/branch/snapshot/restore/cutover/R2 veya .env.local değişikliği yok. Main merge, force-push ve hard reset yok. Auth/MFA/session içeriği okunmadı.

## Git teslim kaydı

| Kontrol | Gerçek sonuç |
| --- | --- |
| Kod/rapor commit mesajı | `fix(v0.4): secure V4.3b receipt function ACL and managed validation` |
| Kod/rapor commit SHA | `bf30aa92002f172d3f3d897bfcb29abf51282f3e` |
| Commit kapsamı | Tam19dosya; yukarıdaki listeyle birebir |
| Working/staged hassas bilgi taraması | PASS; gerçek secret bulunmadı; tek URL yalnız synthetic test şablonu |
| Staged diff check / kapsam / SHA | PASS; `git diff --cached --check` temiz;016 Git blob SHA27b2c82d…886a567 |
| Normal push | `git push origin HEAD:refs/heads/feat/pusula-v030-neon-cloud`; native exit0; d65ea89→bf30aa9 |
| Push sonrası HEAD/yerel upstream | İkisi de `bf30aa92002f172d3f3d897bfcb29abf51282f3e` |
| Gerçek uzak ref | `git ls-remote` aynı tam SHA'yı doğruladı |
| Ahead/behind | 0/0 |
| Çalışma ağacı | `git status --porcelain=v1` boş |

Bu tablo ilk başarılı kod/rapor push'undan sonraki gerçek gözlemdir. Yalnız bu teslim raporuna takip dokümantasyon commit'iyle kaydedilir; benzersiz teslim kapsamı19dosya olarak kalır. Takip adımı SQL/kod/pin veya test edilmiş içeriği değiştirmez. Takip commit'inin kendi SHA'sı dosya içine yazılamaz; nihai SHA/gerçek-uzak-ref/ahead-behind/temiz-ağaç sonucu son mesajda bildirilir. Normal push dışında Git tarihini değiştiren işlem yapılmadı.
