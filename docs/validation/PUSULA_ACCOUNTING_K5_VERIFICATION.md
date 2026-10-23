# K5 — bütünleşik yerel kabul kanıtı

23 Ekim 2026. **K5_LOCAL_PASS**. CLOUD_READY_FOR_APPROVAL **BLOCKED**. GO_LIVE_PASS **verilmedi / BLOCKED**.

## Gerçekte çalıştırılanlar

| Komut | Sonuç |
| --- | --- |
| `node --import tsx scripts/accounting/prepare-migration.ts` | PASS: çevrimdışı017 SQL + kaynak hash manifest'i |
| `npm.cmd test` | PASS:41 dosya/462 test;2 release/coverage testi yeni |
| `npx.cmd tsc --noEmit` | PASS |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS: Prisma generate + Next16 production build |
| `node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --k5 --k5-browser` | PASS:235 API/SQL +56 tablo backup/restore + desktop/mobile2/2 |
| `node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | PASS:9 kontrol |
| `git diff --check` ve korunan kaynak hash'leri | PASS |

Nihai fixture **`v42-fe3c040b-4649-48c3-88a4-8b22fb1fa385`**. `status=PASS`, `serverStopped=true`, `failureCode=null`, `neonOperations=false`, `r2Operations=false`. Gerçek PG18.6 sunucusu kapatıldı. Desktop35,0s, mobile13,2s; toplam1,3 dakika. Mobile, gerçek Chromium motorunda iPhone13 profilidir; fiziksel Safari/iPhone kanıtı değildir. Screenshot/video/trace kapalıdır.

Komut log'ları `.data/k5/{fixture-final,vitest-final,tsc-final,lint-final,build-final,checksum}.log`. Fixture dizininde `verification.json`, `accounting-verify-k5.log`, `k5-business-verification.json`, `k5-backup.log`, `k5-backup-verification.json`, `playwright.log` bulunur. Şifreli kopya/sentetik anahtar operator-private Git dışı dizindedir; teslim artefact'ı veya gerçek offsite değildir.

017 aday SHA256: `3548d3291a7c5c97919d5dee7ac20369c0c7a4de6888b4d21d17d4dcf4ad27aa`. Kaynak dört SQL hash'i `migration-candidate/manifest.json` içindedir. Aynı SQL review işareti olmadan reddedildi ve rollback doğrulandı; ardından marker ile byte-identical uygulandı. Canonical history16 kaldı.

Son restore kanıtı56 tablonun satır sayısı/hash'lerini kaydeder. `unbalanced=0`, `fund_mismatches=0`, `expense_mismatches=0`. Ham source katalog hash'i `eef5b6d6cdd88696ec11230fadc7a58143ff0a962ebe67aa307f01cbc8d6ba9a`; PostgreSQL CHECK parser round-trip sonrası kaynak ve restore katalog hash'i aynı: `8fdb2b272759b8c36770b53a920a02b78c31700f5b51e5af4348e1f7c44eec2f`. Yalnız belirtilen iki CHECK'in eşdeğer deparse farkı normalize edildi; CHECK(true) zayıflatması gerçekten tespit edilip rollback edildi. Default ACL, kolon ACL ve diğer kataloglar karşılaştırmanın içindedir.

K1 20 + K2 15 + K3 16 + K4 12 + K5 8; DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36 =235 adlandırılmış API/SQL kontrolü. Migration pre/post, lock/rollback/checksum/ACL drift kontrolleri ayrıca harness'tedir. K5 yedek ve tarayıcı sonuçları ayrı ölçülür. Önceki gün raporları bugünün yeni kabulü yerine sayılmaz.

## Yeni ölçümler

- Aynı fixture'da gerçek10m² satış:4.000 net/800 KDV/4.800 brüt;2.000 nakit→2.800 kalan;500 peşin gider→1.500 kasa artışı;son2.800→0müşteri borcu.
- Tedarikçi gideri1.200, ödeme300, kalan900; ödeme terslenir ve doğru ödeme tekrar yapılır; tek gider korunur.
- İki ayrı LE yetkili, kasaya atanmış, gerçek parola/TOTP/step-up oturumu eşzamanlı3.000/3.000 tahsilat dener;200+409 ve kalan1.800. Sonra bağımlılıklar doğru sırayla terslenir.
- Gün sonu bağımsız posting toplamı: REVENUE−4.000 / VAT−800 / EXPENSE+1.500 / INPUT_VAT+200 / CASH+4.000 / SUPPLIER−900. Müşteri carisi0; tüm journal dengeleri0; fiziksel StockMovement sayısı değişmez.
- Finanssız gerçek personel hesabı/cari/kasa403; süresi geçmiş step-up finans yazması403 ve sayılar aynı; gerçek MFA yenilemesi başarılı.
- Browser: sunucuda commit edilmiş POST yanıtı kesilir; requestfailed sonrası reload; opak intent ile sonuç sorgusu, tek POST; offline→online yenileme; uygulama sekmesi kapanıp yeniden açıldığında DB verisi korunur. Desktop/mobile ve viewport kontrolü.
- Aday017 SQL review işareti olmadan rollback; marker sonrası byte-identical SQL ile tam API regresyonu. History16; gerçek canonical017 veya provider kabulü değil.
- Backup: dar yerel SELECT/BYPASSRLS, read-only ve EXECUTE/DML negatifleri;56 tablo TOC; AES-GCM/HMAC; ayrı yerel kopya; bozuk tag reddi; yeni boş DB restore; tüm tablo hash'leri; katalog/default ACL; parser round-trip CHECK eşdeğerliği ve gerçek zayıflatılmış CHECK negatif kontrolü; journal/fon/gider mutabakatı.

## Başarısız geliştirme koşuları

- `v42-260945ff-c948-48fd-9c3e-d5792c6a731a`:235 kontrolün K5 ilk6'sı geçti; sonraki sentetik personel kurulumu ortak loopback auth kotası429 ile durdu. Kurulum fazları önceki suite sayaçlarından izole edildi; production rate limit değiştirilmedi.
- `v42-79ac15cc-2ea3-4f90-8002-6e50fcc6b112`:K5 API8 ve eski tüm suite'ler geçti. Desktop yanıt kesme testi requestfailed'i beklemeden reload yapıyordu; explicit bekleme eklendi. Mobile offline→online sonrası eski hata mesajını yakaladı; FinanceDesk başarılı veri yüklemesinde hata temizlemesi düzeltildi.
- `v42-c4c0bdae-82ec-4de6-af95-2546ed28bca2`:235 API/SQL kontrolü geçti. Gerçek restore sonrası56 tablonun veri hash'leri eşleşti; katalog exact-string karşılaştırması iki CHECK'in deparse/reparse farkında durdu.
- Dar backup debug koşuları `v42-0dd0892a-50f0-4c3b-ba8c-2077c1814d53`, `v42-202d489a-1622-4735-aaac-6a0ef1658f50`: yalnız local candidate+backup tanılama; entegre kabul sayılmadı. Fark yalnız `Supplier.v42_supplier_values` ve `SupplierOfferVersion.v42_offer_values` CHECK tanımlarındaydı; veri farkı yoktu. Kaynak CHECK'in PostgreSQL parser'ı ile yeniden ayrıştırılması ve zayıflatılmış constraint negatif testi eklendi.
- Dar profil `v42-2c876fde-2b78-4d69-bb81-d458db98f735`: yeni parser karşılaştırması + restore + desktop/mobile PASS ve serverStopped=true. API235'i içermediği için nihai kabul yerine sayılmadı; yukarıdaki ayrı tam fixture yeniden çalıştırıldı.

`--browser-only` ilk tanılama çağrısı gerekli `--with-browser` olmadan preflight'ta reddedildi; DB başlatılmadı. Diğer başarısız fixture'larda serverStopped=true ölçülür. Ara veya dar profil başarıları son tam kabul yerine kullanılmaz.

## Sınırlar ve bütünlük

Başlangıç `.data/k5/start-hashes.json`; tüm kullanıcı kaynakları, K1–K4 rapor/verification/test/local SQL ve ilk16 migration hash'leri buradan denetlenir. Yeni artifact/kanıtlar `.data/k5/` ve `.data/fixtures/{id}/` altındadır; hassas auth/DB anahtarları raporlara yazılmaz. LAST_REPORT yalnız öne K5 özeti eklenerek korunur.

Fixture SQL/restore gerçek pg18.6 araçlarıyla yereldir. Ayrı kopya aynı makinededir; bağımsız offsite kanıtı yoktur. Restore yeni boş DB'dir; global roller aynı cluster'da önceden yaratılmıştır. Remote backup allowlist35/21 ve managed audit/upload kapıları değişmez. Manifest'in opsiyonel source-policy alanı bu fixture için boş bırakılır; remote strict kaynak kabulü diye etiketlenmez.

`ACCOUNTING_CLOUD_REVIEW_REQUIRED`, managed016 `applyEnabled=false / postFingerprint=null`, recovery `ROLE_DELTA_UNRESOLVED` ve canlı işletme kabulü eksikleri sürer. Gerçek Neon SQL/GRANT, R2, snapshot/recovery/production değişikliği, gerçek kaynak restore'u, `.env.local` düzenlemesi ve Git commit/push/merge yoktur.
