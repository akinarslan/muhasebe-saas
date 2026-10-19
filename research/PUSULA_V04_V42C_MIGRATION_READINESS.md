# PUSULA v0.4 — V4.2c son migration güvenliği ve kurtarma hazırlığı

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `225cd7acb66257e800b2e09b2bbf8a0412cc31e1`.

## Karar: BLOCKED — migration çalıştırılmamalı

Salt okunur teknik önkoşullar doğrulandı. **Console kullanılabilirliği operatör tarafından teyit edildi; fakat kesin pre-migration geri dönüş noktası ve diğer DB etkilerini kapsayan kurtarma yolu tamamlanmadığından migration hazır kabul edilmedi.** Bağımsız R2 yedeği yoktur. Ayrıca onaylı runner'ın timeout/transaction/hata davranışı ve test_runtime grant tercihi uygulama öncesi kapıdır. Bu belge migration onayı değildir. Hiçbir migration, rol/yetki değişikliği, restore, dump veya R2 işlemi yapılmadı.

## Başlangıç ve kanıt

Başlangıçta dal ve uygulama commit'i beklendiği gibiydi. Önceki iki belge değişikliği (`LAST_REPORT.md`, V42B audit) korundu; başka kullanıcı dosyası ezilmedi. Mimo'nun uygulama commit'i değiştirilmedi. Bu tur fetch/stage/commit/push/merge yoktur.

LAST_REPORT, ROADMAP/ARCHITECTURE'ın18.10 v0.4 sözleşmesi, [V4.2b.1 canlı denetimi](PUSULA_V04_V42B_NEON_MIGRATION_AUDIT.md), [V4.2 yerel doğrulama](../docs/validation/V04_SPRINT_V42_VERIFICATION.md), [yetkilendirme](../docs/security/AUTHORIZATION.md), [kurtarma](../docs/security/BACKUP_RECOVERY.md), aktif Prisma şeması, migration014 ve mevcut migration runner incelendi. V4.3 stok/satın alma veya sonraki fazlar açılmadı.

Migration014 SHA-256 değişmedi: `880cda78821cfe4b7b11484e70dc73c0d4ab2ad57a4ad0c3006d67587ac2bbc7`.

Canlı snapshot zamanı **2026-10-19T06:00:41.611Z** (09:00:41.611 Europe/Istanbul). Tek direct development bağlantısı; mevcut allowlist, mevcut CA, hostname doğrulaması ve TLS1.3 encrypted/authorized=true. URL `verify-full` şartı kontrol edildikten sonra aynı host/credential ve explicit rejectUnauthorized=true/CA kullanıldı. Baştan default_transaction_read_only=on; REPEATABLE READ READ ONLY; statement_timeout30s/lock_timeout3s; sonunda ROLLBACK ve bağlantı kapatma. Test/production/başka DB bağlantısı yok.

Git dışı kanıt: `.data/v42c-catalog.json` (katalog, sayımlar, metadata SHA256), `.data/v42c-local-check.json` (çevrimdışı kolon karşılaştırması). Yardımcılar `.data/v42c-audit.mts` ve `.data/v42c-local-check.mjs`; hiçbiri Mimo/GitHub teslimine girmez. `.env.local` yeniden yazılmadı. Sunucu pg_stat_ssl=false değeri istemci TLS kanıtı yerine kullanılmadı; gerçek istemci socket'i ayrıca doğrulandı.

## Canlı katalog ve drift

| Kontrol | Sonuç |
| --- | --- |
| PostgreSQL |18.6 (653b019) |
| Public tablo / ENABLE+FORCE RLS | **35 / 21**, tam ad listeleri Sprint E baseline ile aynı |
| Policy / kullanıcı trigger / function | **43 / 11 / 5** |
| Supplier, SupplierMaterial, SupplierOfferVersion | **Yok** |
| SupplierUnit / v42 function / supplier indeks çakışması | **Yok**, denetlenen ad/desenlerde |
| Başarılı migration checksum | **13/13 MATCH** |
| Migration014 | **Pending**, DB'de kaydı yok |
| Migration008 geçmişi | Bir eski rolled-back deneme ve bir başarılı eşleşen uygulama; unresolved başarısız kayıt **0** |
| Invalid/not-ready indeks / unvalidated constraint | **0 / 0** |
| Parent unique indeksleri | LegalEntity(tenantId,id), Activity(tenantId,legalEntityId,id), MaterialVariant(tenantId,legalEntityId,id) valid/ready |
| Enum ve function kapsamı | Mevcut üç enum; beş function tanımı önceki katalogla aynı; önceki V42B.1 beş hash doğrulaması korunur |
| Kullanıcı şemaları / extension / event trigger | Yalnız public / yalnız plpgsql1.0 / event trigger0 |
| Public dışı kullanıcı relation | Denetlenen tablo/partition/view/materialized view/sequence/foreign table türlerinde0 |
| Permission ID çakışması / MASTER şablonu | **0 / 1** |

Tablo, migration geçmişi, constraint, indeks, policy, trigger, function, enum, rol, üyelik, default ACL, tablo ACL, Permission metadata ve diğer relation katalogları önceki V42B.1 snapshot'ıyla sıralamadan bağımsız **UNCHANGED** karşılaştırıldı. Beklenmeyen değişiklik bulunmadı.308 canlı kolonun300'ü34 mevcut iş/auth modeline,8'i Prisma metadata tablosuna aittir.

Çevrimdışı Prisma karşılaştırması: pending üç Supplier modeli hariç mevcut **300 scalar kolonun adı, SQL/native türü ve nullability'si300/300 eşleşti**; eksik/fazla/farklı kolon0. Bu küçük parser projenin mevcut scalar/native türleri içindir; resmi Prisma migrate diff veya expression eşdeğerliği motoru değildir. Default ifadeleri katalogda kaydedilip fingerprint'lendi, fakat tam semantik default-expression eşdeğerliği sertifikası verilmedi. Önceki snapshot kolon/default içermediğinden bu alanların geçmişe göre değişmezliği ispatlanmış sayılmaz.

Migration008'in eski rollback kaydı korunur; geçmiş satırının farklı checksum'ı başarılı uygulamada drift demek değildir. Başarılı kaydı yerel hash ile eşleşir. `_prisma_migrations` kayıtları silinmedi/düzeltilmedi ve migrate resolve yapılmadı.

## Güvenli veri referansı

Aşağıdaki sayımlar aynı read-only snapshot'ta `count(*)` ile alındı. Satır payload'ı, ad/e-posta, parola/session/MFA, fiyat/tutar/snapshot JSON okunmadı veya loglanmadı. Owner bağlantısı kapsamındaki toplamlar referanstır; runtime RLS ile filtrelenmiş liste sayısı değildir.

| Tablo | Toplam |
| --- | ---: |
| AuthUser |2 |
| Membership |2 |
| Customer |0 |
| Material |0 |
| MaterialVariant |0 |
| MaterialPriceHistory |0 |
| CloudProduct |0 |
| CloudQuote |0 |
| CloudSale |0 |
| CloudSaleLine |0 |

**Bu sayımlar tüm DB'nin boş olduğu anlamına gelmez.** Diğer tabloların iş kayıtları sayılmadı. İki AuthUser/Membership kaydı gerçektir; kimlikleri/özellikleri incelenmedi. Örnek verilerle doldurma, seed veya “sıfırdan kurma” yapılmaz.

Bu snapshot migration anı baseline'ı değildir: onaylı işlemden hemen önce bakım/yazma durdurma penceresinde aynı metadata+sayımlar yeniden alınmalı. Uygulama yazmaları sürerse önce/sonra sayı farkı migration hasarı olarak yorumlanamaz. Sayı eşitliği de tek başına içerik değişmezliğini ispatlamaz; ileride mevcut finans snapshot'ı bulunan tablolar için içerik göstermeyen kontrollü bütünlük manifest'i ayrıca tasarlanmalıdır. Bu görev gerçek satır hash taraması yapmadı.

## Migration014'ün bütün işlem sınıfları

| SQL grubu | Yapısal/veri etkisi |
| --- | --- |
| BEGIN / COMMIT | Açık transaction; SQL dosyasında timeout yok. Başarıdan sonra otomatik down yok. |
| CREATE TYPE | SupplierUnit altı değer; mevcut CostUnit değişmez. |
| Üç CREATE TABLE | Supplier kartı, mevcut Variant bağlantısı, append-only teklif sürümleri. Eski kolon kaldırma/yeniden yaratma/backfill yok. |
| PK/indeks |3 PK +11 explicit indeks, toplam14 yeni destek indeksi; yalnız yeni boş tablolar. |
| Composite FK |9 yeni FK; entity/activity/supplier/link/variant ilişkilerinde tenant+legalEntity taşınır. Parent unique hedefleri canlıda doğrulandı. |
| CHECK |3 değer/tarih/miktar/döviz/version kontrolü; eski fiyat/snapshot yeniden hesaplanmaz. |
| RLS | Her yeni tabloda ENABLE+FORCE ve scope policy;8 restrictive policy ile toplam11 yeni policy. |
| Function/trigger |2 SECURITY INVOKER sabit search_path function;4 trigger: Supplier/Link identity-version ve Offer UPDATE/DELETE/TRUNCATE reddi. |
| REVOKE/GRANT | Yeni tablolar ve function'lar için PUBLIC hakları kaldırılır; runtime+test_runtime'a dar tablo/EXECUTE hakları verilir. Eski tablo grant'leri değiştirilmez. |
| Permission INSERT | Sekiz yeni ID, ON CONFLICT DO NOTHING; mevcut yanlış metadata varsa kendiliğinden düzelmez. Şimdi çakışma0. |
| RolePermission INSERT | Mevcut MASTER şablonuna sekiz bağlantı ekler; **mevcut efektif Master yetkisini genişletir**. Normal şablon/override resetlenmez. |

**Eski tablolarda DML var mı?** İşletme/Auth tablolarda yok; mevcut global Permission ve RolePermission tablolarında INSERT vardır. Dolayısıyla “mevcut verilere hiçbir yazma yok” iddiası yanlıştır. AuthUser/MFA/Membership ve müşteri/malzeme/fiyat/quote/sale verilerine INSERT/UPDATE/DELETE yapılmaz. Yeni FK'lerin mevcut parent üzerinde kilit ve gelecekte RESTRICT bağımlılığı etkisi vardır.

## Yetki, tenant ve gizlilik

Runtime ve auth non-owner/NOBYPASSRLS/non-superuser; schema CREATE=false. Her ikisinde development CONNECT/TEMP=true; test_runtime/test_auth CONNECT=false ve TEMP=true olarak kaldı. Rol envanteri/üyelik/efektif tablo hakları önceki denetimle aynı. Auth rolüne yeni Supplier grant'i yoktur. Yeni tablo owner'ı ileride migration'ı çalıştıran neondb_owner olacaktır; owner/provider bypass gücü ayrı bir güven sınırıdır.

Runtime ve test_runtime: Supplier/Link SELECT+INSERT+UPDATE; Offer SELECT+INSERT. Offer UPDATE ve tüm yeni tablolarda DELETE/TRUNCATE verilmez. **test_runtime development CONNECT iznine ihtiyaç duymaz ve açılmamalıdır.** Mevcut SQL test_runtime'a dormant nesne grant'i bırakır; bunun kabulü veya ayrı target-aware grant tasarımı operatör kararıdır. Bu görev SQL'i değiştirmedi; başka DB rollerini/grant'lerini düzenlemedi.

CREATE FUNCTION PostgreSQL varsayılanında PUBLIC EXECUTE alabilir;014 aynı transaction içinde iki function'da PUBLIC EXECUTE'u REVOKE eder ve yalnız runtime/test_runtime'a verir. COMMIT öncesi ara durum dış oturumlara açılmaz. Owner ve provider'ın efektif hakları ile başka rollere default ACL grant'leri ayrıca hesaba katılmalıdır. Canlı default ACL yalnız cloud_admin için public tablo/sequence üzerinde neon_superuser grant'i içerir; neondb_owner için explicit kayıt yoktur. Bu, provider yetkilerinin yokluğu anlamına gelmez.

Tenant+legalEntity composite FK ve scope RLS, transaction-local app.user_id/tenant/entity ile kullanılır. `pusula_can` explicit DENY/default-deny/action kapsamını değerlendirir. Nullable activity şirket geneli kullanım içindir; parent activity/owner eşleşmesi INSERT policy/guard ile korunur. FORCE RLS superuser/BYPASSRLS için mutlak engel değildir.

**Maliyet gizliliği API/DTO sınırıdır:** Offer SELECT policy satırı sınırlar; fiyat sütunlarını maskelemez. Server DTO için supplierOffers.costView VE ilgili materials.costView gerekir; yoksa orijinal/normalize fiyat, FX/conversion, fiyat içerebilen not/ref çıkarılır; compare403. Doğrudan shared runtime credential erişimine karşı sütun bazlı gizlilik iddia edilmez. İzinleri olmayan gerçek kullanıcıyla veri okuma denemesi yapılmadı; önceki yerel sentetik test kanıtı ve ileride ayrı sentetik kabul planı kullanılır.

## Kurtarma: gerçek kullanılabilirlik açık

19.10.2026 resmî [Neon fiyat sayfası](https://neon.com/pricing), Free için en fazla6 saat veya1GB değişim history sınırı ve bir snapshot listeler. Bu proje için aktif retention/eldeki geri dönüş noktası veya snapshot bulunduğunu ispatlamaz. Plan yükseltme veya yeni ücretli kaynak açılmadı.

Resmî [Instant restore belgesi](https://neon.com/docs/postgres/backup-restore/branch-restore) root-branch sınırlaması, branch içindeki bütün DB'lerin geri dönüşten etkilenmesi, bağlantı kesintisi ve değişimlerin geri alınması riskini açıklar. Development DB'ye özel transaction rollback ile branch restore aynı şey değildir. Aynı branch'teki test/diğer DB'leri etkileyen restore bu görevin sınırlarına uymaz; ayrı kapsam/onay gerekir. Yalnız development'ı hedefleyen kurtarma yolu ayrıca doğrulanmalıdır.

**19.10.2026 operatör Console teyidi:** Plan Free; proje pusula-development; branch development; Restore from history arayüzde kullanılabilir; history window6 saat; saat dilimi Europe/Istanbul (GMT+03:00). En eski seçilebilir tarih19.10.2026; daha eski tarihler seçilemiyor. En eski seçilebilir saat kesin doğrulanmadı. Kayıtlı snapshot yok, otomatik snapshot planı yok. Restore/Reset veya veri değiştirme yapılmadı; gerçek restore test edilmedi. Bu, hesap sahibinin Console gözlemidir; bağımsız API incelemesi veya restore başarısı değildir.

Mevcut bağlı Neon yönetim aracı yoktur. Root/child topology ve kurtarmanın diğer DB'lere etkisi bu beyanla kesinleşmedi; arayüz seçeneğinin görünmesinden topology sonucu çıkarılmadı. **Durum: sınırlı provider kurtarma adayı mevcut; doğrulanmış uçtan uca kurtarma yolu henüz yok.** Altı saat kayan bir penceredir; bu rapor veya günün seçilebilir olması belirli bir pre-migration anının ileride hâlâ kurtarılabileceğini garanti etmez. Migration anına yakın kesin UTC+İstanbul zaman/uygunsa LSN noktası ve kapsandığı pencere, operatör erişimi, branch kapsamı ve durdurma eşiği yeniden doğrulanmalıdır. Snapshot/otomatik snapshot bulunmadığından bu yöntemler mevcut kurtarma kopyası gibi listelenmez. Bağımsız R2 yedeği açığı devam eder.

| Seçenek | Durum / sınır |
| --- | --- |
| COMMIT öncesi transaction rollback | Migration kısmi DDL/DML başarısızlığında PostgreSQL rollback; deploy metadata/failure yolu ayrıca doğrulanmalı. |
| Kod/modül kapatma + forward fix | COMMIT sonrası yeni nesneleri/veriyi korur; mevcut API uyumluluğu incelenmeli. Veri kurtarma yedeği değildir. |
| Neon provider restore | Operatör Console teyidiyle Free/6 saat ve arayüz kullanılabilirliği mevcut. Kesin zaman, topology, diğer DB etkisi ve restore başarısı doğrulanmadı. **Sınırlı aday; hazır değil.** |
| Bağımsız şifreli R2 archive/restore | **Tamamlanmadı**; dar backup rolü, kalıcı key/kurtarma kopyaları ve gerçek yedek yok. |
| DROP/yeniden seed/down | Veri kaybı riski; kurtarma olarak kabul edilmez, onay yok. |

## Gelecekteki gerçek yürütme planı — ÇALIŞTIRILMADI

1. Önce kurtarma engelini çöz: ilgili branch/topology/retention ve gerçek geri dönüş noktası, yalnız development için zarar vermeyen yol, geri alma yetkilisi ve prosedür. Bağımsız yedeğin yokluğunu açık risk olarak kabul etmeden GO verme.
2. Operatör gerçek migration014 hash'ini, hedefi, MASTER genişlemesini ve runtime/test_runtime grant kararını ayrı onaylar. Mevcut SQL değişecekse yeni hash ve yeniden denetim gerekir; uygulanmış eski migration dosyalarına dokunma.
3. Bakım penceresinde kullanıcı işlemlerini güvenle durdur; kod/app süreçlerini körlemesine kill etme. Aynı direct allowlist/CA/verify-full ile yeni read-only metadata/sayım baseline'ı al. Drift, yeni pending migration, unresolved failure,14'ün önceden uygulanması, farklı checksum veya kaynak yetki değişiminde dur.
4. Repo'daki gerçek deploy giriş noktası aşağıdadır. **Şu anda çalıştırılmayacak; hazır kabul edilmez.**

```powershell
# YALNIZ ayrı uygulama onayı ve aşağıdaki runner kapıları tamamlandıktan sonra:
node --use-system-ca --import tsx scripts/db/migrate.ts
```

Bu dosya direct development allowlist kontrolünden sonra Prisma migrate deploy çağırır; test flag kullanılmaz. Ham Prisma çıktısı dışarı verilmez. Ancak runner şu an açık lock_timeout/statement_timeout ayarlamıyor. Gelecek onaylı runner sertleştirmesinde oturumda lock_timeout=3s, statement_timeout=60s ve toplam operatör süre sınırı uygulanmalı; gerçek Prisma bağlantısında etkisi doğrulanmalı. PGOPTIONS'ın Prisma engine tarafından taşındığı **varsayılmamalı**. Connection URL'ye kontrolsüz options eklemek mevcut allowlist ile de uyumlu değildir. Sırları terminal/argüman/loga taşıyan komut verilmez. Bu görev runner kodu üretmedi/değiştirmedi; bu nedenle bugün güvenle çalıştırılabilir, bütünü doğrulanmış bir deploy komutu olduğu iddia edilmez.

5.014 kendi BEGIN/COMMIT'ini kullanır; haricî psql transaction'ı içine gelişigüzel sarılmaz ve Prisma metadata kaydı atlanarak SQL elle uygulanmaz. Aynı Prisma sürümü ve gerçek runner failure/timeout/atomicity davranışı öncelikle yeni izole sentetik fixture'da ayrıca onaylı test edilmelidir; mevcut test DB'ye dokunulmaz. Önceki local runner'ın transaction gövdesi kanıtı bunun yerine geçmez.
6. SQL hata/timeout/bağlantı kesilmesinde otomatik retry yok. Sonucu bilinmeyen COMMIT'te salt okunur schema+Prisma geçmişi kontrolü yap; başarılı commit'i tekrarlama. Başarısız migration satırı varsa log/sır ifşa etmeden tanı koy. migrate resolve veya geçmiş düzeltme ayrı karardır;008 rollback kaydı korunur.
7. Başarı sonrası yazmalar açılmadan38/24,14 başarılı migration checksum, eski nesne fingerprint ve10 tablo sayımlarını mutabık kıl. Yeni nesnelerin PK/FK/CHECK/index/policy/trigger/ACL kapsamını doğrula. Eski Auth/fiyat/snapshot verilerini değiştiren fark varsa modülü açma; veri silerek rollback yapma.

## Uygulama sonrası ayrı test/kabul matrisi

| Kapı | Geçme ölçütü |
| --- | --- |
| Metadata |38 tablo/24 FORCE; policy54/trigger15/function7;014 checksum aynı; eski13 uygulama eşleşir ve008 geçmişi durur |
| Yeni nesneler |3 PK,9 composite FK,3 CHECK,14 indeks valid/ready; yeni enum;2 invoker function ve4 immutable/identity trigger |
| Yetkiler | Runtime/auth/test CONNECT ve eski ACL baseline korunur; yeni grant kararıyla tutarlı; PUBLIC tablo/EXECUTE yok; auth Supplier erişimi yok |
| Kayıt koruma | Bakım başlangıcına göre belirtilen10 tablo sayımı aynı; eski default/kolon/FK/policy/trigger/function fingerprint değişmez; beklenen Permission/Master ekleri dışında fark yok |
| Supplier API | CRUD/pasifleştirme, link/idempotency/conflict, concurrent revision, teklif geçmişi; iki tenant/company/activity ve FK reddi |
| Gizlilik | Cost DENY DTO redaksiyonu/compare403; server actor/FX türetme; logs/audit hassas fiyat içermiyor |
| Eski işlevler | Auth/MFA rolü ve mevcut session korunur; müşteri/malzeme/USD geçmişi/eski satış snapshot değişmezliği; gerçek hesaplarla mutasyon testi yok |
| Ortam ayrımı | Önce ayrıca onaylı yeni sentetik fixture; development'a test kaydı yazma ve gerçek kullanıcı akışı ayrı onay ister |

Bu tur uygulama kodu değişmedi; TypeScript/lint/Vitest/browser veya yeni fixture çalıştırılmadı. Önceki V4.2 297/297 ve28/28 testleri yerel tarihsel kanıttır; Neon deploy sonrası test sonucu değildir. Metadata diff'i ve300 kolon karşılaştırması bu turun gerçek kontrolleridir.

## Sprint E ve açık production engelleri

Migration sonrası35/21 allowlist38/24'e otomatik büyütülmez. Ayrı Sprint E incelemesinde üç tablo, SupplierUnit, iki canonical function hash'i, dört trigger,11 policy,9 FK, ACL/default, TOC ve migration inventory sürümlü olarak kapsanmalı. Yeni fixture'da dump→AES-GCM→manifest/hash→boş DB gerçek restore ile supplier offer satırları/revision/FX/conversion, tenant/Auth ilişkileri, FK/RLS/immutable ve maliyet sınırları kanıtlanmalı; yanlış key/bozuk arşiv/eksik manifest reddi korunmalı. Eski şema arşivleri ve eski anahtarlar okunabilir kalmalı.

Mevcut engine ayrıca bütün migration satırları finished&&!rolled_back beklediğinden008 çözülmüş rollback geçmişi `MIGRATIONS_INCOMPLETE` engeli oluşturabilir; checkout14/live13 ise inventory de eşleşmez. Bu görev geçmişi veya guard'ı düzeltmedi. Gerçek pusula_backup rolü yok; PUBLIC TEMP/CONNECT/builtin ownership, Managed remote ve R2 production kapıları açık. Gerçek kalıcı key/C1-C2, bağımsız yedek/readback, otomasyon/izleme ve kurtarma tatbikatı tamamlanmadan production kabulü verilmez.

## Manuel onaylar ve Mimo devri

Console plan/history bilgisi operatörce tamamlandı. Önce **kalan bilgi eksikliği** giderilmeli: kesin pre-migration geri dönüş noktası, root/child topology ve mevcut diğer DB'lere zarar vermeyen gerçek kurtarma seçeneği. Sonra runner/timeout ve test grant kararı somutlaştırılır. Kurtarma/runner güvenlik kapıları açıkken kullanıcıdan belirsiz bir deploy onayı alınarak ilerlenmez.

Gerçek migration014, Permission/Master genişlemesi ve grants için yeniden açık kullanıcı onayı; gerekiyorsa runner geliştirmesi/izole fixture testi, provider restore/new branch, gerçek backup/key/R2 ve development test verisi işlemleri için ilgili ayrı onaylar gerekir. Şu an bunların hiçbiri verilmiş kabul edilmez.

Bu turun Mimo teslimi:

1. `research/PUSULA_V04_V42C_MIGRATION_READINESS.md` — BLOCKED kararı, canlı güvenli referans ve yürütme/kurtarma planı.
2. `LAST_REPORT.md` — güncel özet.

Önceki `research/PUSULA_V04_V42B_NEON_MIGRATION_AUDIT.md` dosyası hâlâ untracked önceki teslimdir; içeriği bu tur değiştirilmedi. Mimo bunu önceki onaylı devir kapsamında ayrıca incelemeli, kaybetmemeli ve yeni V4.2c değişikliği gibi sunmamalı. Codex stage/commit/push yapmadı. Mimo yalnız ilgili belgeleri sır/diff kontrolüyle teslim edip ayrı `.md` gerçekleşmiş commit/push raporunu kullanıcıya sunar; Mimo teslimi burada gerçekleşmiş sayılmadı.
