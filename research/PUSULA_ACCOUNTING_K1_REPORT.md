# PUSULA — K1 cari hesap ve finans defteri

22 Ekim 2026. Dal: `feat/pusula-v030-neon-cloud`. Başlangıç HEAD: `fc6d41bb4380baa1839064f9f7bfd4bfe317d6b9`.

**K1_LOCAL_PASS — yalnız izole yerel altyapı kabulü. Bulut dağıtımı ve gerçek verili kullanım BLOCKED.** Bu sonuç 29 Ekim MVP'sinin, finans ekranlarının veya gerçek satış/tahsilat entegrasyonunun tamamlandığı anlamına gelmez.

## Uygulanan dar kapsam

Mevcut Customer/Supplier kartlarına composite tenant/company FK ile bağlı `FinanceAccount`, değişmez `FinanceJournal` ve `FinancePosting` hazırlandı. Yeni müşteri/tedarikçi otoritesi oluşturulmadı; mevcut müşteri ve satış iş kuralları değiştirilmedi. Prisma'nın dağıtılan şeması değiştirilmedi; hazırlık tablolarına typed raw SQL ve mevcut Prisma transaction katmanıyla erişiliyor.

- TRY açılışı ve tarih/vade; müşteri için pozitif bakiye alacak, tedarikçi için pozitif bakiye borç. Negatif bakiye kesilmez; sıfır açılış desteklenir.
- Her journal iki posting içerir; eşit borç/alacak ve scope uyumu deferred constraint trigger ile commit sırasında zorunlu. Karşı hesap yalnız sistem açılış özkaynak hesabıdır.
- Hesap başına tek açılış kaynak anahtarı; tenant/company request UUID tekilliği, normalize JSON SHA-256 payload karşılaştırması ve transaction advisory lock. Aynı istek aynı journal ID'sini verir; değişmiş payload veya yeni anahtarla ikinci kaynak reddedilir.
- UPDATE/DELETE tetikleyicileri ve runtime DML ACL reddi; düzeltme yalnız gerekçeli yeni ters journal/posting. Bir kaydın yalnız bir ters kaydı olabilir; ters kaydın tersini alma yoktur. Kaynak kayıtlar korunur.
- Ekstre tarihine kadar hareketler, borç/alacak, vade, ters kayıt bağı ve akan/son bakiye döner. Tutarlar JSON string, DB `numeric(18,2)` ve `decimal.js`; JSON number, exponent, fazla hassasiyet ve TRY dışı giriş reddedilir. Hesap listesi 200, ekstre 1000 satır sınırını aşınca sonuç kesmek yerine 422 verir.
- Üç tabloda ENABLE/FORCE RLS: tenant + legal entity + tam activity scope + kullanıcı zorunlu. `finance.accounts` okuma; yazma ayrıca `finance.approve` ve uygulama katmanında güncel MFA step-up ister. Mevcut `pusula_can` ve policy motoru kullanılır; MASTER dahil explicit DENY korunur. Normal rollere yeni izin eklenmedi. Sadece satış yetkisi finans erişimi sağlamaz.
- Dedicated NOLOGIN/NOBYPASSRLS yerel executor; runtime'a rol üyeliği veya doğrudan INSERT/UPDATE/DELETE verilmez. SECURITY DEFINER komutunda sabit search_path, PUBLIC EXECUTE reddi ve yalnız fixture runtime EXECUTE vardır. Audit özetinde tutar veya gerekçe yoktur; hata yanıtlarında SQL/bind/finans payload'ı gösterilmez.

HTTP girişleri mevcut `/api/cloud/workspace` yönlendiricisinde açıkça ayrıldı:

| Yöntem / finance yolu | İşlev |
| --- | --- |
| POST `finance/accounts` | Mevcut party için cari hesap; tekrar aynı hesap |
| GET `finance/accounts?company=…&activity=…` | Scope içi hesaplar |
| POST `finance/openings` | TRY açılışı, bookedOn/dueOn, reason, idempotencyKey |
| POST `finance/reversals` | journalId, bookedOn, reason, idempotencyKey ile ters kayıt |
| GET `finance/{accountId}/statement?company=…&activity=…&through=YYYY-MM-DD` | Tarih itibarıyla ekstre ve bakiye |

Şimdilik bu API yalnız doğrulanmış UUID fixture marker'ı, loopback hedefi ve test runtime ile açılır. Gerçek development/production yolunda `ACCOUNTING_CLOUD_REVIEW_REQUIRED` (503) döner. UI, genel manuel mahsup, satış posting'i, tahsilat/ödeme, kasa/banka/POS ve gider bu K1 paketine eklenmedi.

## Pending016 ve tek migration geçmişi

Güvenli bulut dağıtım yolu henüz kanıtlanamadığından **BLOCKED**. İlk 15 SQL, tarihsel checksum kayıtları ve 016 değiştirilmedi. 016 SHA-256:

`27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`

K1 SQL'i `scripts/accounting/local-schema.sql` altında yerel hazırlıktır; `prisma/migrations` dizinine ikinci bir zincir veya deploy edilebilir 017 eklenmedi. Harness önce mevcut 001–016 zincirini, gerçek yerel Prisma stock runner ve checksum/ACL kapılarıyla doğrular; ardından yalnız `--accounting-profile` için hazırlığı çalıştırır. SQL ayrıca PostgreSQL18.6, fixture_admin, loopback, fixture DB ve başarılı 16 migration/016 checksum ön koşulunu kontrol eder. `_prisma_migrations` kaydı eklemez; otomatik resolve/skip/restore yoktur.

Gelecekte finans migration'ı ancak tek mevcut zincirin 016 sonrası ardılı olarak hazırlanabilir. Önce 016 managed post kabul sözleşmesi ve ayrı açık gerçek apply yetkisi gerekir. Ardından K1 SQL'in yerel kimlik/runtime varsayımlarının yerine denetlenmiş provider rol/ACL sözleşmesi, deployable migration, Prisma model karşılıkları ve pre/post kabulü hazırlanmalıdır. Yerel dosyayı doğrudan buluta taşıma yolu yoktur. `postFingerprint=null`, `applyEnabled=false`, `STOCK_MANAGED_APPLY_DISABLED` değişmedi. Yerel executor kanıtı provider davranışının kanıtı sayılmaz.

## Yedek/restore değerlendirmesi

Mevcut `scripts/backup` motoru yeniden kullanılacak; ikinci motor yazılmadı. AES-GCM, mevcut anahtar yönetimi, source denetimi ve restore fixture mekanizması korunur. Mevcut backup allowlist'i 35 tablo/21 FORCE RLS seviyesindedir; mevcut 40/26 bulut baseline'ını, 016 sonrası 47/33'ü ve üç yeni finans tablosunu kapsayan kabul henüz yoktur. Yalnız tablo adlarını eklemek yeterli değildir: rol/ownership/ACL/default ACL, function/trigger, database access ve kaynak bütünlüğü de doğrulanmalıdır.

`MANAGED_REMOTE_OBJECT_AUDIT_REQUIRED` kapısı, bağımsız off-app şifreli backup + gerçek doğrulanmış restore eksikliği ve recovery `br-late-river-baeipun8` üzerindeki `token_roles / ROLE_DELTA_UNRESOLVED` engelleri sürer. Recovery branch değiştirilmedi. Bu görevde Neon backup/restore, R2 veya herhangi bir uzak SQL çalıştırılmadı; önceki backup deneyleri bu teslimin yeni testi sayılmaz. Gerçek finans verisiyle pilot açılamaz.

## Kanıt ve dosya kapsamı

Gerçekte çalıştırılan komutlar ve fixture kimlikleri [doğrulama raporunda](../docs/validation/PUSULA_ACCOUNTING_K1_VERIFICATION.md). Tarihsel V4.3b.10/11 FIX_REQUIRED kayıtları değiştirilmedi.

K1'in kesin dosya listesi (11):

1. `src/lib/cloud/accounting-contracts.ts`
2. `src/server/cloud/business/accounting/accounts.ts`
3. `src/server/cloud/business/accounting/ledger.ts`
4. `src/server/cloud/handler.ts`
5. `scripts/accounting/local-schema.sql`
6. `scripts/accounting/verify.ts`
7. `scripts/stock/verify-local.ts`
8. `tests/accounting-ledger.test.ts`
9. `research/PUSULA_ACCOUNTING_K1_REPORT.md`
10. `docs/validation/PUSULA_ACCOUNTING_K1_VERIFICATION.md`
11. `LAST_REPORT.md` (yalnız yeni özet başa eklendi; önceki içerik korundu).

Başlangıçta kullanıcı değişikliği olan `ROADMAP.md`, `docs/planning/PUSULA_7_DAY_ACCOUNTING_MVP.md`, `docs/validation/PUSULA_ACCOUNTING_MVP_ACCEPTANCE.md` bu görevde değiştirilmedi. `.env.local` ve tüm 16 migration SQL hash'leri başlangıçla aynı. Git stage/commit/push yapılmadı.
