# PUSULA v0.4 — V4.2c.1 Mimo Teslim Raporu

**İşlem tarihi:** 19.10.2026
**Git dalı:** `feat/pusula-v030-neon-cloud`
**Uzak depo:** `origin` → `github.com/akinarslan/muhasebe-saas.git`
**Başlangıç HEAD:** `225cd7acb66257e800b2e09b2bbf8a0412cc31e1`
**Commit mesajı:** `feat(v0.4): add guarded migration runner with pinned checksums (V4.2c.1)`

> **Commit SHA notu:** Bu rapor teslim commit'inin içine dahil edilmiştir. Kendi commit SHA'sını içerdiği için sonsuz güncelleme döngüsü oluşur; bu yüzden **nihai commit SHA ve push doğrulaması bu raporun dışındaki teslim sonuç mesajında** belirtilmiştir. Başlangıç HEAD (`225cd7a`) ve commit mesajı yukarıda gerçektir.

## Kapsam

Codex, V4.2c.1 güvenli migration runner'ını ve yerel testleri tamamladı; stage/commit/push yapmadı ve Git teslimini Mimo'ya devretti. Teslim yalnız migration güvenliği katmanındadır:

- `scripts/db/migrate.ts` — varsayılan yalnız preflight; `--apply` olmadan deploy yok. Hedef/TLS/üretim reddi ve onay bayrakları.
- `scripts/db/migration-safety.ts` — hedef allowlist, checksum/history denetimi, rol pinleri, advisory lock ve child kapanışı.
- `scripts/db/migration-baseline.json` — 14 SQL dosyasının byte SHA-256'sı, PG18 önce/sonra schema fingerprint'leri, gelişmiş rol/ACL pinleri.
- `prisma-safe.config.ts` — Prisma engine için `sslmode=require` + `sslaccept=strict` + absolute server CA köprüsü ve run-id zorunluluğu.
- `scripts/db/verify-migration-fixture.ts`, `verify-migration-tls.ts` — izole yerel fixture ve TLS pozitif/negatif denetimi.
- `202610190014_supplier_catalog/migration.sql` revizyonu — server-side `SET LOCAL` timeout'lar, `pusula_test_runtime` grant'lerinin kaldırılması, LF sabitleme.
- `.gitattributes` — SQL migration checkout'larını LF'ye sabitler (checksum kararlılığı).
- `tests/migration-safety.test.ts` — 20 yeni birim testi.

İş mantığı (supplier domain, API, UI) **yeniden yazılmadı**. Eski 13 migration, `schema.prisma`, `package.json`, `package-lock.json`, ROADMAP/ARCHITECTURE ve backup guard kaynakları değiştirilmedi.

## Teslim edilen dosyalar (tam liste)

Codex'in `research/PUSULA_V04_V42C1_COMPLETE_REPORT.md` içindeki listesi ile çalışma ağacı karşılaştırıldı: **15 teslim dosyası + 2 korunan önceki denetim raporu = 17 dosya**. Beklenmeyen veya kapsam dışı değişiklik **yok**.

| Durum | Dosya |
| --- | --- |
| A | `.gitattributes` |
| M | `LAST_REPORT.md` |
| A | `docs/operations/SAFE_MIGRATIONS.md` |
| A | `docs/validation/V04_V42C1_VERIFICATION.md` |
| A | `prisma-safe.config.ts` |
| M | `prisma/migrations/202610190014_supplier_catalog/migration.sql` |
| A | `research/PUSULA_V04_V42B_NEON_MIGRATION_AUDIT.md` *(korunan önceki V4.2b raporu)* |
| A | `research/PUSULA_V04_V42C1_COMPLETE_REPORT.md` |
| A | `research/PUSULA_V04_V42C1_MIGRATION_SAFETY.md` |
| A | `research/PUSULA_V04_V42C_MIGRATION_READINESS.md` *(korunan önceki V4.2c raporu)* |
| M | `scripts/db/migrate.ts` |
| A | `scripts/db/migration-baseline.json` |
| A | `scripts/db/migration-safety.ts` |
| A | `scripts/db/verify-migration-fixture.ts` |
| A | `scripts/db/verify-migration-tls.ts` |
| M | `scripts/suppliers/verify-local.ts` |
| A | `tests/migration-safety.test.ts` |

### Eklenen / değiştirilen sayıları

- **Değiştirilen (M):** 4
- **Eklenen (A):** 13
- **Toplam:** 17 dosya, **+2171 / −49**

Önceki V4.2b/V4.2c denetim raporları (`PUSULA_V04_V42B_NEON_MIGRATION_AUDIT.md`, `PUSULA_V04_V42C_MIGRATION_READINESS.md`) silinmedi veya ezilmedi; ilk kez commit edilerek korunur. Ayrıca Codex'in tam raporundaki son satırdaki fazladan boş satır `git diff --cached --check` bulgusu üzerine yalnızca o boş satır silinerek giderildi; belge içeriği değiştirilmedi.

## Yeni migration checksum'ı

Migration `202610190014_supplier_catalog` için dosyanın SHA-256'sı yerelde hesaplandı ve görevde istenen değerle **birebir eşleşti**:

```
0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da
```

Bu, eski `880cda78…` hash'inin yerini alır; yeni canlı salt okunur denetim ve uygulama onayında bu yeni hash esas alınmalıdır.

### Eski 13 migration bütünlüğü

- `git status`/`git diff` yalnız 014 dosyasını gösterir; eski 13 `prisma/migrations/*/migration.sql` working tree'de değişmemiştir.
- `scripts/db/migration-baseline.json` içindeki 14 kaydın tamamı dosyaların gerçek SHA-256'sıyla yerelde karşılaştırıldı: **14/14 eşleşti, 0 uyumsuzluk.**
- `prisma/migrations/migration_lock.toml` değişmedi.

## Hassas bilgi taraması

- `git diff --cached --check` → **PASS (exit 0)**; ilk turda bulunan tek EOF boş satırı giderildi.
- Hassas dosya adı taraması (`.env*`, `.data`, `*.key`, `*.pem`, `*.crt`, `*.enc`, fixture `*.json`, `package-lock`, `schema.prisma`) → **stage edilen dosyada eşleşme yok.**
- `.gitignore` doğrulandı: `.env*` (satır 6) ve `.data/` (satır 7); `.env.local`, `.env.bootstrap.local` ve `.data` repo dışında. Untracked 119.913 `.data` dosyasının tamamı ignore ediliyor; yalnız 13 yeni dosya görünür durumda.
- Staged diff sır desenleri (`BEGIN (RSA|EC|OPENSSH|PRIVATE)`, `sk_live`, `rk_live`, `ghp_`, `AKIA…`, `xox…`, `Bearer …`) → **eşleşme yok.**
- `password/secret/token/key = "…"` atama taraması → yeni V4.2c.1 diff'inde **gerçek değer yok** (yalnız alan adı/etiketler).
- Staged diff'teki 3 `postgresql://` deseni sentetiktir: 127.0.0.1 hedefli runtime üretilen test parolaları ve `imaginary` yer tutucu. Neon gerçek bağlantı bilgisi veya kimlik bilgisi yok.
- `process.env.*` eşleşmelerinin tamamı değişken **referansıdır**; hiçbirinde gerçek değer literal olarak yazılmamıştır.
- Private TLS sertifika/anahtar dosyaları, şifreli fixture kimlikleri ve test log'ları Git dışı UUID `.data/fixtures/v42-*` dizinindedir; teslim listesine girmez.

## Gerçek commit ve push sonuçları

Aşağıdaki alanlar raporun kendi commit'i içine yazılamaz (döngü olurdu); **nihai commit SHA, push çıktısı ve son Git durumu teslim sonrası sonuç mesajında verilmiştir.**

| Öğe | Değer |
| --- | --- |
| Başlangıç HEAD | `225cd7acb66257e800b2e09b2bbf8a0412cc31e1` |
| Commit mesajı | `feat(v0.4): add guarded migration runner with pinned checksums (V4.2c.1)` |
| Nihai commit SHA | *Teslim sonrası sonuç mesajında (döngü önlemi)* |
| Push yöntemi | `origin/feat/pusula-v030-neon-cloud` dalına **normal push**; force-push yok |
| Push sonrası fark | *Teslim sonrası sonuç mesajında doğrulandı* |
| Main merge / hard reset | **Yapılmadı** |

## Testler — Codex kaynaklıdır

Aşağıdaki sonuçlar Codex'in `research/PUSULA_V04_V42C1_COMPLETE_REPORT.md` ve `docs/validation/V04_V42C1_VERIFICATION.md` kayıtlarıdır. **Mimo bu testleri bu teslimde yeniden çalıştırmamıştır ve çalıştırılmış gibi raporlamaz.**

| Kontrol | Sonuç (Codex) |
| --- | --- |
| TypeScript | PASS |
| ESLint | PASS, 0 hata/uyarı |
| Build | PASS, Next 16.4.1 (mevcut geniş `.data` rate-store pattern uyarısı sürer) |
| Vitest | **317/317**, 26 dosya, 17.44s (önceki 297 + 20 migration testi) |
| Gerçek Prisma migration güvenliği | **14/14** yerel senaryo, tam fixture |
| DB/RLS | **11/11** |
| Auth/API | **62/62** |
| Cloud/DB | **11/11** |
| Supplier DB/API | **16/16** |
| Gerçek Prisma TLS | Doğru CA kabul; yanlış CA/hostname ret |
| Playwright | Bu sprint **yeniden çalıştırılmadı**; 28/28 tarihsel kanıt |
| Gerçek Neon SQL/dump/R2/restore | **YOK** |

Son tam fixture `v42-6b2d004f-…`, TLS tamamlayıcı `v42-71ca8465-…`; ikisi de `serverStopped=true`. Başarısız denemeler başarılı toplama eklenmemiştir. Mimo'nun bu teslimde bağımsız olarak doğruladığı: dosya listesi karşılaştırması, 014 checksum'ı, 14/14 baseline hash, ignore/teslim listesi ve `--check`/sır taraması.

## Neon migration'ı uygulanmadı

`202610190014_supplier_catalog` **uygulanmadı**. Bu teslimde Neon development/test/production'a **bağlanılmadı**; rol/grant/metadata değişikliği, dump, restore veya R2 işlemi **yapılmadı**. Runner yalnız Codex'in yeni yerel sentetik fixture kümesinde (ayrı UUID `.data/fixtures/v42-*`, 127.0.0.1, PostgreSQL 18.6) doğrulanmıştır. `--apply` gerektiren gerçek uygulama ayrıca açık kullanıcı onayı bekler.

## Açık kurtarma ve production engelleri

1. **Kurtarma kanıtı yok — BLOCKED.** Kesin pre-migration UTC+İstanbul zaman/LSN noktası, seçilebilir history kapsamı, root/child branch topology, diğer DB envanteri ve sınanmış uygulanabilir geri dönüş yolu kanıtlanmadı.
2. **Neon Free 6 saat sınırı.** Operatör Console gözlemi (panel beyanı, bağımsız API/kurtarma tatbikatı değil): en eski tarih 19.10.2026, kesin saat bilinmiyor, snapshot yok. Pencere aşılırsa doğrulanmış snapshot/izole kopya/bağımsız arşiv yoksa garantili kurtarma yolu kalmaz.
3. **Restore yan etkileri.** Branch çapında restore tüm DB'lere etki eder ve yetki sınırlarını aşar; Better Auth/Master/MFA kayıtları da tarihsel PostgreSQL verisidir, sonradan yapılan değişiklikler kaybolabilir. Ayrı plan ve onay gerekir.
4. **Canlı read-only ön denetim yapılmadı.** Yeni hash (`0950d8de…`) ile güncel migration history/ACL/schema baseline'ı canlı DB'de doğrulanmadı.
5. **Açık kullanıcı onayı gerekenler:** development 014 uygulaması, MASTER'a 8 Permission genişlemesi, runtime grant'leri, bakım penceresi ve güncel kayıt baseline'ı.
6. **Sprint E kapsamı ayrı:** 35/21 allowlist, enum/function/TOC ve legacy archive uyumu incelenmedi; backup allowlist'ine yeni nesneler eklenmedi. Gerçek backup rolü/PUBLIC TEMP/CONNECT/builtin ownership, kalıcı key, bağımsız R2 yedek/readback/restore ve production kabulü açık.
7. **Ücretim/DB değişikliği yok:** yeni Neon kaynağı, test DB değişikliği veya ücretli servis oluşturulmadı.

## Sonraki öneriler (V4.2c.2 / V4.3)

1. **Onay öncesi canlı salt okunur preflight:** yeni hash ile `migrate.ts` (flagsiz, yalnız read-only) çalıştırıp 13 başarılı + 014 pending, 38 tablo/24 FORCE RLS ve rol pinlerinin eşleşmesini doğrula.
2. **Kurtarma tatbikatı:** gerçek LSN/seçilebilir kapsam ve izole kopya/snapshot seçeneklerini quota denetimiyle netleştir; uygulanabilir geri dönüş yöntemini yazılı hale getir; Auth/MFA mutabakat adımlarını tanımla.
3. **Bakım penceresi + veri baseline'ı:** yazmaları durdur, eski 10 tablo sayım/metadata referansını tazele, güncel kayıtları raporla.
4. **Açık onayla `--apply`:** `--approve-development --recovery-reviewed --confirm-master-permissions` ile 014 + MASTER genişlemesi; ardından 38/24 exact postflight, eski veri mutabakatı ve fonksiyonel kabul.
5. **Sprint E ile hizala:** backup allowlist'ini yeni tablo/enum/function/trigger/policy kapsamına genişlet; restore sırasında invariant'ların yeniden işlemesini test et.
6. **V4.3 satın alma/stok/sarf:** PurchaseOrder, makbuz/geri gönderim ve lot bazlı stok profili V4.1 modeline göre açılır.

## Görev sınırlarına uyum

Mimo yalnız onaylı Git teslimini ve bu dosyalı raporlamayı gerçekleştirdi. Neon migration çalıştırılmadı; production/test DB değiştirilmedi; restore veya R2 işlemi yapılmadı; iş mantığı yeniden yazılmadı; Master Admin, MFA veya gerçek işletme kayıtlarına dokunulmadı. Codex testleri yeniden çalıştırılmadı. `main`'e merge, force-push ve hard reset **yapılmadı**.
