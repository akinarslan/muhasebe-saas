# PUSULA v0.4 — Sprint V4.2c.1 / güvenli migration runner

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `225cd7a` korunur · **Yerel geliştirme/kabul PASS; gerçek Neon migration BLOCKED ve onaysız.**

Runner varsayılan preflight, explicit apply/Master/recovery kapıları, direct hedef/rol/TLS koruması, exact checksum ve önce/sonra katalog/uzak izin pinleri kazandı. Gerçek Prisma session'ında014 SET LOCAL ile3s lock/30s statement/60s transaction limiti;90s child ve yalnız kendi tag'li backend cleanup'ı uygulanır. Başarısızlıkta gerçek kısmi schema raporu ve unresolved retry reddi var; otomatik resolve/restore yok.008'in eski rolled-back geçmişi korunur; backup guard'ı değiştirilmedi.

014'ten test_runtime grant'leri çıkarıldı; test grant'leri yalnız yeni yerel fixture'da verilir. MASTER'a sekiz izin ekleme aynı SQL transaction'ında sürer ve ayrı açık onay bayrağı gerektirir; normal roller/override/tenant/MFA değişmez. SQL LF sabitlendi. Yeni014 SHA-256: `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`; sonraki canlı denetim bu hash'i kullanmalı. Eski13 migration değişmedi.

Vitest317/317,26 dosya; TypeScript/lint/build PASS. Tam yeni PG18.6 fixture'da migration güvenliği14/14, DB/RLS11/11, Auth/API62/62, Cloud/DB11/11 ve Supplier16/16 PASS. İki tenant'ın10 eski Auth/iş tablosu içerik hash'leri negatif senaryolar ve gerçek Prisma deploy sonrasında aynı. Ayrı gerçek Prisma TLS fixture'ı doğru CA'yı kabul, yanlış CA/hostname'i ret etti. Her sunucu kendi PID/data kimliğiyle kapatıldı. Başarısız ilk denemeler başarı sayılmadı; ayrıntılar doğrulama raporunda. UI değişmedi; Playwright bu sprint yeniden çalıştırılmadı.

[Karar ve Mimo listesi](research/PUSULA_V04_V42C1_MIGRATION_SAFETY.md) · [Gerçek test kanıtları](docs/validation/V04_V42C1_VERIFICATION.md) · [Güvenli komut/kurtarma](docs/operations/SAFE_MIGRATIONS.md).

Bu sprint gerçek Neon'a bağlantı, migration, rol/grant, Master/MFA/veri/env değişikliği, dump/R2/restore veya ücretli kaynak yoktur. Operatörün Free6 saat/Restore UI teyidi gerçek kurtarma başarısı değildir; kesin geri dönüş noktası, topology ve diğer DB'leri koruyan kurtarma yöntemi hâlâ açık. Bu nedenle gerçek uygulama onayı istenerek engel atlanmaz; kapılar kapandıktan sonra ayrıca açık onay gerekir. Codex commit/push yapmadı. Mimo bu sprint14 dosyayı inceler; önceki V42B/V42C belgelerini korur. .data/env/TLS private key/generated/build teslim dışıdır.

---

# Önceki V4.2c kaydı

# PUSULA v0.4 — Sprint V4.2c / son migration ve kurtarma hazırlığı

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `225cd7a` · **BLOCKED: Console kurtarma seçeneği operatörce teyit edildi; kesin kurtarma noktası/kapsamı ve runner kapıları açık.**

Development direct bağlantısında mevcut CA/hostname doğrulamalı TLS1.3 ve read-only snapshot ile35 tablo/21 FORCE RLS,13/13 başarılı migration checksum,014 pending ve Supplier nesnelerinin yokluğu yeniden doğrulandı.008'in eski rolled-back kaydı korundu; unresolved failure0. Önceki katalog/izin metadata'sına göre beklenmeyen fark yok;300 scalar kolon adı/türü/nullability eşleşti. Default-expression semantik eşdeğerliği veya tam bağımsız drift sertifikası iddia edilmez.

19.10.2026 06:00:41.611Z güvenli referansı: AuthUser2, Membership2; Customer/Material/MaterialVariant/MaterialPriceHistory/CloudProduct/CloudQuote/CloudSale/CloudSaleLine0. Yalnız toplamlar okundu; gerçek satır/PII/finans/Auth/MFA içeriği okunmadı. Bu, diğer tabloların boş olduğu veya yedeğe ihtiyaç olmadığı anlamına gelmez. Snapshot anı migration öncesi bakım penceresinde yeniden alınmalıdır.

Migration eski iş/Auth tablolarını değiştirmez; Permission/RolePermission INSERT'i MASTER yetkisini genişletir. Test_runtime development CONNECT=false kalmalı; yeni SQL'deki dormant grant tercihi ayrı karardır. Mevcut runner açık lock/statement timeout uygulamıyor. Operatör Console teyidi: pusula-development/development, Free, Restore from history kullanılabilir,6 saat history, Europe/Istanbul; en eski tarih19.10.2026, kesin en eski saat bilinmiyor. Snapshot ve otomatik snapshot planı yok. Gerçek restore test edilmedi; root/child ve diğer DB etkileri kesinleşmedi. Bu bilgi bağımsız API/restore kanıtı değildir. Branch restore diğer DB'leri de etkileyebilir. Bağımsız R2 yedeği ve dar backup rolü hazır değil; production engelleri sürer.

[Son güvenlik, sayım referansı ve kurtarma/yürütme planı](research/PUSULA_V04_V42C_MIGRATION_READINESS.md). Migration/DDL/DML/grant, başka DB bağlantısı, restore/dump/R2 veya commit/push yapılmadı; env ve migration hash'i korundu. Uygulama değişmediğinden test suite'leri yeniden çalıştırılmadı. Mimo'ya bu tur yalnız yeni V42C raporu ve LAST_REPORT devredilir; önceki untracked V42B raporu korunur. Kurtarma ve runner kapıları kapanmadan hazır kabul edilmez; gerçek migration ayrıca açık onay bekler.

---

# Önceki V4.2b.1 kaydı

# PUSULA v0.4 — Sprint V4.2b.1 / canlı salt okunur denetim tamamlandı

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `225cd7a` · **Migration uygulanmadı; ayrı onay bekleniyor.**

Onaylı pusula_development direct bağlantısı mevcut CA/hostname doğrulaması ve TLS1.3 ile açıldı; read-only transaction sonunda ROLLBACK ve bağlantı kapatma yapıldı. PostgreSQL18.6;35 tablo,21 FORCE RLS,43 policy,11 trigger,5 invoker function doğrulandı. Supplier tabloları/enum/v42 function çakışması yok;014 pending. Mevcut parent composite unique indeksleri valid/ready, invalid constraint/index yok. Hedef38/24 henüz uygulanmadı.

Başarılı13 migration'ın checksum'ları13/13 eşleşir; unresolved başarısız kayıt0.008'in ayrıca eski rolled-back denemesi vardır: ilk script bu satırı seçip yanlış MISMATCH verdi; ham metadata incelenip başarılı kayıt bazında düzeltildi. Geçmiş silinmedi. Mevcut Sprint E guard'ı rollback geçmişini de reddedebilir; yeni tablo/enum/function ve14/13 migration inventory engelleri ayrıca sürer.

Runtime/auth non-superuser/NOBYPASSRLS; test rollerinin development CONNECT=false durumu doğrulandı. Test_runtime'a yeni grant kapsamı, timeout ve kurtarma planı ayrı kabul kapısıdır. Tam kolon/tüm nesne türü drift sertifikası verilmedi. Gerçek kullanıcı/müşteri/finans/Auth içeriği okunmadı; migration, yetki/veri değişikliği, test/production bağlantısı, dump/R2 veya commit/push yapılmadı.

[Güncel canlı kanıt ve sınırlar](research/PUSULA_V04_V42B_NEON_MIGRATION_AUDIT.md). Mimo teslimi yalnız bu dosya ve denetim raporu; Git dışı yardımcı/kanıt teslim edilmez. Önceki BLOCKED metinleri tarihsel kayıttır; bağlantı engeli bu tur kalktı. Gerçek migration için kullanıcı onayı beklenir.

---

# Önceki V4.2b ilk deneme kaydı

# PUSULA v0.4 — Sprint V4.2b / Neon migration ön denetimi

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `225cd7acb66257e800b2e09b2bbf8a0412cc31e1` · **BLOCKED: canlı katalog denetimi tamamlanmadı.**

Mimo'nun V4.2 teslimi tam commit hash'iyle doğrulandı. Başlangıç çalışma ağacı temiz; origin fetch sonrası yerel/uzak farkı0/0. Codex stage/commit/push yapmadı.

Migration014 kaynak incelemesi üç yeni tablo, SupplierUnit, dokuz composite FK, üç CHECK,11 policy, dört trigger ve iki invoker function gösterir.35/21 baseline doğruysa hedef38/24'tür; **bugünkü Neon sayımı ve checksum/drift kontrolü yapılmadı**. Salt okunur bağlantı komutu otomatik onay incelemesinin kapasite hatası nedeniyle çalıştırılmadı; koruma aşılmadı. Önceki katalog ve yerel fixture sonuçları güncel canlı kanıt olarak kullanılmadı.

Eski işletme/fiyat/snapshot tablolarına DML yok; fakat sekiz Permission ve MASTER bağlantısı eklenir, mevcut parent tablolara FK bağımlılığı doğar. Development üzerinde test_runtime rolüne de grant verilmesi, güncel default ACL/CONNECT durumu, runner timeout ve kurtarma planı ayrıca kabul kapısıdır. Sprint E35/21 guard'ları değişmedi; yeni enum/function/table kapsamı fail-closed reddedilir. Gerçek Neon backup hesabı ve production kurtarma engelleri açıktır.

[Denetim, rollback ve ayrı kabul kapıları](research/PUSULA_V04_V42B_NEON_MIGRATION_AUDIT.md). Migration/yetki değişikliği, gerçek veri okuma veya sayımı, dump/R2, test/production bağlantısı yapılmadı. Uygulama kodu değişmediğinden test suite'leri yeniden çalıştırılmadı; önceki V4.2 sonuçları tarihsel kanıttır.

Mimo'ya devir: yalnız bu dosya ve `research/PUSULA_V04_V42B_NEON_MIGRATION_AUDIT.md`. Git dışı audit yardımcısı teslim kapsamı değildir. Önce canlı salt okunur denetim tamamlanmalı; gerçek migration için ayrıca açık kullanıcı onayı gerekir. Mimo commit/push ve ayrı teslim raporu henüz yapılmadı.

---

# Önceki V4.2 çalışma raporu (Mimo tesliminden önceki kayıt)

# PUSULA v0.4 — Sprint V4.2 / tedarikçi ve fiyat teklifleri

19.10.2026 · `feat/pusula-v030-neon-cloud` · başlangıç `f3e1baa` · **Codex commit/push yapmadı; Git teslimi Mimo'ya devredilecek.**

Tedarikçi kartları, mevcut MaterialVariant N:N eşleştirmesi, immutable teklif sürümleri, tarih/miktar/birim kontrollü karşılaştırma ve `/app` Tedarikçiler arayüzü geliştirildi. Sekiz yeni Permission anahtarı mevcut ALLOW/DENY/Master sistemine bağlanır; maliyet izni olmayan API yanıtında fiyat/snapshot yoktur. TRY yalnız tarihli TCMB kaynağıyla; EUR/GBP doğrulanmış kaynak yoksa hesaplanamaz. Manuel malzeme USD maliyeti ve eski quote/sale snapshot'larına yazılmaz.

Migration014 ve üç yeni tablo yalnız yeni yerel UUID PostgreSQL18.6 cluster'ında uygulandı:37 model, metadata dahil38 tablo,24 FORCE RLS. Mevcut Neon development/test/production'a migration veya bağlantı yok. Yerel DB aynı isimli olsa da mevcut Neon test DB değildir;127.0.0.1/port/UUID marker/SCRAM ile ayrılır. Auth test kimlikleri ve görseller ayrı Git dışı fixture dizininde; gerçek Master/MFA/env/demo verileri korunur.

Vitest297/297,25 dosya; TypeScript/lint/build PASS. DB/RLS11/11, Auth/API62/62, Cloud/DB11/11 ve V4.2 DB/API16/16 yerel fixture'da geçti. Desktop/mobil Auth+cloud+D7+V4.2 browser6/6, demo22/22; toplam28/28. Mobil PNG'de bulunan kart içi kırpılma düzeltilip güçlü kutu/focus/klavye ölçümleriyle tekrar doğrulandı; başarısız denemeler başarılı sayılmadı. MOQ24,9 hassasiyet sertleştirmesi sonrası Vitest ve odaklı DB/API16/16 tekrar geçti. Tüm geçici sunucular kendi PID/data kimliğiyle güvenli kapandı.

29 teslim dosyası ve23 production client JS dosyasında sır taraması PASS;16 trace'de .data girdisi0. Mevcut geniş .data build uyarısı sürer. Son tam yerel kabul v42-3ce925eb-61a1-4309-987d-d54a1330e26a; son odaklı tekrar v42-19a74f00-b401-4f2b-ad04-5c20ec754a7f. HEADf3e1baa korunur, index boştur;29 dosya Mimo'ya devredilecek çalışma ağacı değişikliğidir, yeni commit/push yoktur.

[Doğrulama ve Mimo dosya listesi](docs/validation/V04_SPRINT_V42_VERIFICATION.md) · [Teknik denetim/izinler/kabul kapıları](research/PUSULA_V04_SPRINT_V42_AUDIT.md).

Gerçek development migration'ı, yeni Permission/Master/grants uygulaması ve canlı kullanım ayrı açık onay bekler. R2/dump/kalıcı key veya production işlemi yapılmadı; Sprint E allowlist35/21 korunur ve yeni tablo/enum/function incelemesi gerekir. V4.3 satın alma/stok/sarf erkenden açılmadı.

---

# Önceki teslim: PUSULA v0.4 — Sprint V4.1 / veri modeli ve mimari tasarım

19.10.2026 · `feat/pusula-v030-neon-cloud` · **Yalnız analiz ve uygulanmamış taslak; yeni modül veya migration uygulanmadı.**

Uzak `39c6001` ROADMAP ve `3bcbe9e` ARCHITECTURE kararları fast-forward ile korundu. Kaynak denetiminde34 uygulama modeli, metadata dahil35 tablo ve21 FORCE RLS doğrulandı; canlı DB bağlantısı yapılmadı.22 domain modeli ve ledger tutarlılığı için2 yardımcı (StockPostingBatch/StockBalance) tasarlandı. Ayrı58 modellik Prisma taslağı yerel validate kontrolünden geçti; aktif şema/migration/app/package dosyaları değişmedi.

Supplier/PO/receipt/iade, tek fiziksel eksenli rulo/levha stok, atomik transfer/negatif stok/idempotency, sayım freeze, composite FK/RLS/explicit DENY ve maliyet DTO'ları tanımlandı. Reçete/makine/capability ve immutable tarifeler mevcut MaterialVariant/CloudProduct'a bağlanır; manuel USD maliyeti ve eski teklif/satış snapshot'ları korunur. Model tercihi özgül lot edinim maliyeti + FIFO aday sırası; gerçek sarf/fire v0.5, cari/ödeme v0.6. SQL guard/role/grant planı uygulanmadı; gerçek concurrency/RLS/Neon kalıcılık testleri için33 senaryolu kabul matrisi hazırlandı, çalıştırılmadı.

[Model](docs/architecture/V04_DATA_MODEL.md) · [Servisler/izinler](docs/architecture/V04_DOMAIN_SERVICES.md) · [UX akışları](docs/design/V04_UX_FLOWS.md) · [Migration planı](docs/architecture/drafts/V04_MIGRATION_PLAN.md) · [Denetim ve kabul kapıları](research/PUSULA_V04_SPRINT_V41_AUDIT.md).

Neon/test/production bağlantısı, tablo/rol/izin değişikliği, dump/restore/R2 veya kalıcı key işlemi yapılmadı. Sprint E'nin yeni tablo/function/enum incelemesi ve gerçek Neon backup sorunları production önkoşulu olarak açık; otomatik backup allowlist genişletmesi yok. Gerçek migration, tablo oluşturma ve uygulama geliştirmesi için ayrı açık onay gerekir. Aşağıdaki E2.3 test sonuçları önceki sprintin kaydıdır.

---

# Önceki teslim: PUSULA v0.3 — Sprint E2.3 / anahtar yönetimi ve gerçek fixture restore

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Gerçek yerel dump/decrypt/restore31/31 PASS; production kabulü yok.**

CSPRNG256 anahtar/benzersiz ID, redacted bellek nesnesi, passphrase ile şifreli taşınabilir vault, eski anahtarları koruyan rotasyon ve iki recovery zarfını yalnız RAM'de karşılaştırma kodu eklendi. Gerçek kalıcı key, C1/C2 kopyaları veya .env.local değişikliği yapılmadı; üretim ayrı onaylı ve aktif ID'yi değiştirmeyen komuttur.

Yeni local PostgreSQL18.6 cluster'ında gerçek pg_dump -Fc arşivi şifrelendi, doğrulanıp private dosyaya çözüldü, yeni boş template0 DB'ye pg_restore --single-transaction ile yüklendi. İki tenant, müşteri/malzeme/satış/USD geçmişi/snapshot ve sentetik Auth ilişkileri; tüm35 tablonun içerik hash/sayımları, RLS/ACL ve FK/immutable/sealing davranışı eşleşti. Yalnız kendi fixture süreçleri güvenle kapandı. İlk iki doğrulama denemesi ayrı FAIL olarak korundu; başarılı sayılmadı.

Vitest **258/258**, E2 alt kümesi154; TypeScript, lint ve build PASS. Mevcut geniş .data build pattern uyarısı sürer; operatör dosyalarının dağıtım trace dışlaması korunur. Gerçek key vault klasörü oluşmadı.

[Anahtar runbook'u](docs/operations/BACKUP_KEY_MANAGEMENT.md) · [Gerçek restore kanıtı ve kabul sınırları](docs/validation/SPRINT_E23_VERIFICATION.md). Neon rol/PUBLIC/large-object sorunları production önkoşulu olarak açık; Strict/Managed gerçek kaynak/upload güvenlik kontrolleri korunur. Gerçek Neon/test DB/production/Master/MFA/R2 işlemi yok.

## Önceki E2.2d teslimi

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Varsayılan Strict korundu; gerçek Neon Managed kullanımı kapalı.**

Managed aday yerel PostgreSQL18.6 fixture'da **43/43**, Strict gerçek dump/şifreleme regresyonu **14/14** geçti. Uygulama DML/kalıcı DDL, rol yükseltme ve drift'ler reddedildi. PUBLIC TEMP geçici DDL/DML'ye, CONNECT diğer DB oturumuna izin verdi; sonradan PUBLIC SELECT/kolon SELECT/SECURITY DEFINER ile veri sızıntısı ve builtin lo_create ile kalıcı sahiplik riski hayalî verilerle kanıtlandı. Aday Strict'e eşdeğer veya production için uygun kabul edilmedi.

Yeni politika adı manifest HMAC/AAD içinde korunur; eski manifestler legacy-unrecorded olarak doğrulanabilir. Gerçek diğer DB nesne hakları bilinmediğinden Managed remote preflight/upload engelli. Varsayılan strict-v1 artık template dahil diğer DB CONNECT haklarını da reddeder. Vitest222/222, TypeScript/lint/build PASS; geniş pattern build uyarısı sürer, .data dağıtım trace girdisi16 dosyada0 olarak doğrulandı. Bütün geçici sunucular kendi PID/data dizinleriyle güvenli kapandı.

[Ayrıntılı kanıt, sınırlar ve 10 kabul yanıtı](research/PUSULA_V030_SPRINT_E22D_RISK_ASSESSMENT.md). Gerçek Neon bağlantısı/rol/ACL değişikliği, kalıcı key, gerçek dump veya R2 işlemi yapılmadı. Bunlar için yeniden ayrı açık kullanıcı onayı gerekir.

## Önceki E2.2c araştırması

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Yalnız resmî belge araştırması; yeni Neon bağlantısı yok.**

Tek öneri: mevcut development branch'inde Neon destek teyitli seçici ACL ve doğrudan BYPASSRLS taşıyan dar SQL-created backup hesabı. Provider/internal TEMP ve postgres PUBLIC CONNECT değişikliklerinin bu özel ortamda destek durumu açık belgelerden kesinleşmedi; uygulama BLOCKED kalır. Yeni branch/proje varsayılan PUBLIC izinlerini kendiliğinden çözmez. Native restore/snapshot bağımsız E2/R2 arşivinin yerini tutmaz; geniş admin dump hedefe uymaz.

Maliyet/güvenlik/operasyon karşılaştırması ve sır içermeyen, **gönderilmemiş** destek talebi hazır. Template DB'ler önceki envanter dışında kaldığından tam bağlantı izolasyonu ayrıca denetlenmeli; diğer DB CONNECT guard'ı ayrı E2 kod işi gerektirir. [Seçenekler, tek öneri ve ayrı onaylar](research/PUSULA_V030_SPRINT_E22C_OPTIONS.md).

Rol/ACL/RLS/migration/dump/R2/production/test DB işlemi yapılmadı. Destek gönderimi ve gerçek SQL uygulaması için yeniden açık onay gerekir; bugünkü teslim uygulama izni değildir.

## Önceki E2.2b planı

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Yalnız salt okunur denetim ve plan; yetki değişikliği yok.**

Development katalogları yeniden doğrulandı: 24 rol/16 üyelik; 24 rolün tamamında efektif TEMP açık. Dört Pusula rolünün TEMP'ini açık grant ile koruyup PUBLIC TEMP'i kaldıracak SQL, önce/sonra matrisi, provider etki koşulları ve rollback taslağı hazırlandı; çalıştırılmadı.

**Uygulama kapısı BLOCKED:** neondb/postgres PUBLIC CONNECT nedeniyle yalnız development ACL değişikliğiyle backup LOGIN'i sadece development'a sınırlamak mümkün değil. Ayrıca provider/builtin TEMP etkisi karara bağlanmalı. Geniş admin fallback yok. SQL taslağı bunlar çözülmeden duracak şekilde planlandı. Rol/ACL/RLS/migration/dump/R2 işlemi, test DB veya production bağlantısı yapılmadı. Uygulama için yeni açık onay gerekir.

[Tam plan ve kabul/geri alma kapıları](research/PUSULA_V030_SPRINT_E22B_PLAN.md). 35 tablo ve 24 rol plan kapsamı statik doğrulandı; uygulama kodu değişmedi, regresyon suite'leri yeniden çalıştırılmadı.

## Önceki E2.2a hazırlığı

18.10.2026 · `feat/pusula-v030-neon-cloud` · **CA hazır; yeni preflight kontrolleri teslim edildi.**

Resmî ISRG Root X1 doğrulanıp Git dışı yerel CA/env yapılandırıldı. PostgreSQL 18.6 `psql` direct development bağlantısında `verify-full` ve READ ONLY geçti; dump alınmadı. Preflight efektif TEMP, bütün backup rol üyelikleri, sahiplik, column yazma/grant option, yeni şema/nesne ve fonksiyon tanım değişimlerini reddeder. Canlı doğrulama yalnız development kataloglarında yapıldı.

Vitest **195/195** (E2 91), TypeScript, lint ve build PASS. PUBLIC TEMP kaldırılmadı, rol oluşturulmadı/yetki değiştirilmedi. Seçici açık TEMP grant + PUBLIC revoke seçeneği ayrı onay bekler; bunun uygulanmasına kadar katı backup kabulü kapalıdır. Neon gerçek verileri, test DB, production, Master/MFA ve R2 korunur. [Kanıt, seçenek karşılaştırması ve sınırlar](docs/validation/SPRINT_E22A_VERIFICATION.md).

## Önceki E2.2 denetimi

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Denetim tamamlandı; gerçek backup hesabı oluşturulmadı.**

Yalnız development sistem katalogları READ ONLY incelendi: PostgreSQL 18.6, 35 tablo, 21 FORCE RLS, 43 policy/FK ve 11 trigger. Owner doğrudan BYPASSRLS ve CREATEROLE taşıyor; SQL ile dar backup rolü tasarımı sürüm belgelerine göre mümkün adaydır. Provider üzerinde CREATE/GRANT ve yeni rol ile okuma denenmedi; tam kabul verilmedi.

İki açık kapı: libpq `psql` verify-full denemesi kök sertifika dosyası eksikliğiyle engellendi; ayrıca PUBLIC TEMP yeni backup rolüne geçici DDL yetkisi miras bırakır. CA hazırlığı ve katı DDL yasağı için ayrı onaylı ACL/guard işi gerekir. Node istemcisinde TLSv1.3, sertifika ve hostname doğrulandı. Gerçek dump/Neon değişikliği/R2 işlemi yok. Test DB ve production'a bağlanılmadı. Gerçek key/KEY_ID/offline kopyalar E2.3'te ayrı hazırlıktır.

[Tam denetim, kaynaklar, alternatifler ve onay sınırları](research/PUSULA_V030_SPRINT_E22_AUDIT.md).

## Önceki E2.1b teslimi

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Yerel sentetik kabul: 14/14 PASS.**

PostgreSQL 18.6 taşınabilir sunucu yalnız 127.0.0.1:55432 üzerinde SCRAM ile çalıştırıldı. Gerçek `pg_dump -Fc`, `pg_restore --list`, 35 tablo satır sayımı, 43 FK/43 policy/11 trigger kapsamı ve E2 AES-256-GCM şifreleme/şifre çözme/SHA-256/manifest kontrolleri geçti. Yanlış anahtar, bozuk veri ve gerçek araç hata senaryoları reddedildi. PID 11944 ve yeni veri dizini doğrulanıp yalnız fixture süreci durduruldu.

Gerçek koşuda bulunan sequence yetki sorgusu hatası düzeltildi. E2 birim testleri 61/61; TypeScript ve lint geçti. Neon/R2 veya mevcut uygulama verilerine işlem yapılmadı. Gerçek backup hesabı/direct TLS URL, gerçek key ve ayrı gerçek dump/R2 onayı hâlâ gerekir. Restore/E3/E4 kabulü verilmedi. [Ayrıntılı kanıt ve deneme sınırları](docs/validation/SPRINT_E21B_VERIFICATION.md).

## Önceki Sprint E2 teslim kaydı

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Kod geliştirildi; E2 kabulü ve production kabulü açık.**

Web uygulamasından ayrı preflight/create/upload/verify/list CLI eklendi. Direct development/özel rol guard'ı, salt okunur export snapshot,35 tablo/21 FORCE RLS adı ve migration checksum denetimi, custom dump TOC kontrolü, akışla AES-256-GCM, authenticated manifest, conditional R2 PUT ve tam readback doğrulaması bulunur.4 GiB sınırı, özel ACL'li scratch, paralel iş kilidi ve gerçek işlemler için ayrı açık onay bayrakları vardır. Gerçek key üretilmedi; rol/grant/migration ve UI değiştirilmedi.

Son Vitest **165/165** (E2 **61**), build/TypeScript ve lint PASS. PostgreSQL/RLS **11/11**, Cloud/DB **11/11**, Auth/API **60/60**, demo Playwright **22/22**, auth/cloud/D7 **4/4** geçti; toplam browser **26/26**. R2 HeadBucket resmî SDK ile yeniden geçti. Preflight eksik kurulumu beklenen exit1 ile engeller. Son upload stream cleanup değişimi sonrası61 E2 testi ve TypeScript tekrar geçti.

**Gerçek PostgreSQL fixture dump/--list testi yapılamadı:** araçlar ve ayrı yerel fixture DB yok. Mevcut61 E2 testi sentetik byte/TOC, taklit PG bağlantısı ve bellek içi S3 kullanır; gerçek yedek/restore kanıtı değildir. Gerçek development dump, R2 PUT/DELETE, scheduler ve restore çalıştırılmadı. Production, gerçek Master/MFA, env ve localStorage korunur.

Eksikler: PostgreSQL18 araçları; provider tarafından desteklenen, yazma/DDL yetkisi olmayan ayrı BYPASSRLS backup rolü (`pusula_backup` mevcut değil); direct URL; onaylı key/KEY_ID/offline kurtarma kopyaları. Mevcut owner BYPASSRLS yanında CREATEDB/CREATEROLE taşıdığı için backup rolü olarak kabul edilmez. E3/E4 ayrı kalır.

Hesap sahibi panelden r2.dev Disabled, bağlı custom domain yok, Object Read & Write token yalnız doğru bucket bilgilerini doğruladı. Bu operatör beyanı olarak kaydedildi; bağımsız yönetim API denetimi değildir. Onay bayraklı salt okunur preflight bu incelemeyi kabul eder, kalan key/tool/source eksiklerini engeller. Kullanıcı gerçek dump/upload öncesi ayrı onay şartını korudu.

[Doğrulama](docs/validation/SPRINT_E2_VERIFICATION.md) · [Yetki denetimi ve ayrı gerçek işlem onay listesi](research/PUSULA_V030_SPRINT_E2_AUDIT.md) · [CLI/format/kurulum](docs/operations/BACKUP_ENGINE.md).

Kod teslimi `7081845`, `b50a1f2`, `22f14a1` mevcut feature dalına normal push ile gönderildi. Kod push'u sonrası upstream farkı0/0.16 teslim dosyası ve23 production client JS dosyasında yapılandırılmış yerel sır taraması PASS. Bu doğrulama raporu ayrı dokümantasyon commit'iyle aynı dala gönderilir. Main'e merge/force-push/hard reset uygulanmadı.

---

# Önceki teslim: PUSULA v0.3 — Sprint D7 / UI ve bildirim düzeltmeleri

> **18.10.2026 / Güncel durum: Sprint E, E1 kurulum kapısında.** Başlangıç `00cf549`; D7 rapor commit'i de teslim edilmiş. Fetch sonrası upstream0/0 ve çalışma ağacı temizdi. Neon development/test salt okunur doğrulandı: PostgreSQL18.6, her birinde35 tablo/21 FORCE RLS; auth ve işletme aynı development DB'sinde ayrı rollerle.
>
> R2 erişim/kimliği, özel backup bağlantısı ve ayrı boş onaylı restore hedefi yok; pg_dump/pg_restore PATH'te bulunmadı. Hesaptaki bucket'lar doğrulanamadı. Talimat gereği E2–E5'e geçilmedi; dump/şifreleme/upload/restore/scheduler/alarm testi yok. Production, gerçek veriler, Master/MFA, env ve localStorage değiştirilmedi. Yalnız belgeler ve env örneği güncellendi; tam regresyon tekrar çalıştırılmadı. Aşağıdaki D7 sonuçları önceki teslimdir.
>
> [E1 denetim/maliyet](research/PUSULA_V030_SPRINT_E_AUDIT.md) · [Gerekli kurulum](docs/operations/R2_BACKUP_SETUP.md) · [Restore](docs/operations/DISASTER_RECOVERY.md) · [Retention](docs/operations/BACKUP_RETENTION.md).

17.10.2026 · `feat/pusula-v030-neon-cloud` · Önceki D7 development teslimi. v0.3 production kabulü bu teslimde kapsam dışıdır.

## Sonuç

Bulut müşteri ve kullanıcı araması ortak `SearchField` ile tek dış çerçeve, solda Lucide ikon ve erişilebilir dış focus göstergesine kavuştu. Mobilde etiket bölünmesi ve dar input düzeni giderildi. Demo müşteri/ürün/üst aramada iç focus gölgesi kaldırılırken dış focus korundu; mevcut filtreler değişmedi.

Bildirilen çift border bu başlangıç sürümünde yeniden üretilemedi. Önceki gerçek ölçüm input border 0 / dış border 1 px gösteriyordu; focus göstergesi ise yoktu. Sorunun kesin tek nedeni diye çift border iddiası yapılmaz. Somut nedenler, müşteri aramasının ikon yerine inline metin kullanması ve parçalı `.cloud-search` CSS'inin input focus'unu dış karşılığı olmadan bastırmasıdır. Son durumda iç border/outline/shadow yok, dış border 1 px ve focus halkası tek kapsayıcıdadır.

Yeniden davet gönderirken önceki başarı bildiriminin görünür kalması düzeltildi. Bekleyen davet hatasına **Mevcut daveti yönet** bağlantısı eklendi; bilgiler korunur ve otomatik e-posta gönderilmez. Başarılı oluşturma drawer kapatma/liste yenileme, başarısızlıkta form koruma ve taşıyıcı kabulü/teslim ayrımı korunur. Mevcut TOTP/step-up UX doğru bulunduğu için auth mantığı değiştirilmedi.

## Doğrulama

Başlangıç Vitest 104/104; değişiklik öncesi arama görsel koşusu 2/2 geçti. Son doğrulama sonuçları aşağıdadır.

[Önce/sonra görseller ve ölçümler](docs/design/screenshots/d7/) · [Ayrıntılı kanıt](docs/validation/SPRINT_D7_UI.md) · [Akışlar](docs/design/UX_FLOWS.md).

## Korunan kapsam

Neon development iş kayıtları, gerçek Master/MFA, env dosyaları ve demo localStorage değiştirilmedi/temizlenmedi. Testler yalnız ayrı test DB ve hayalî hesapları kullanır. Production'a SQL/migration uygulanmadı, gerçek Resend gönderimi veya ücretli servis açılmadı. RLS, özel izinler, finansal Decimal motoru, USD/TCMB, tarihsel snapshot ve satış/müşteri işlevleri korunur. Sprint E ve önceki domain/operasyon sınırları [Sprint D raporunda](docs/history/PUSULA_V030_SPRINT_D_REPORT.md) sürer.

Değişen uygulama dosyaları: `src/components/ui/search-field.tsx`, `cloud-desk.tsx`, `user-administration.tsx`, `src/app/globals.css`, `premium.css`. Testler: mevcut `tests/auth-e2e/auth.spec.ts` ve yeni `d7.spec.ts`. Paket, migration veya ortam ayarı değişmedi.

## Git

Başlangıç `150861b`; fetch sonrası mevcut feature remote ile 0/0 aynıydı. Main `98caf4d` üzerinde korunur. Teslim aynı feature dalına normal commit/push ile yapılır; main merge, force-push ve hard reset kullanılmaz.

| Son kontrol | Sonuç |
| --- | --- |
| Build / TypeScript | Başarılı |
| Lint | 0 hata / 0 uyarı |
| Vitest | **104/104**, 17 dosya, 13.23 s |
| PostgreSQL/RLS | **11/11** |
| Cloud/DB | **11/11** |
| Auth/API | **60/60** |
| Auth + cloud + D7 Playwright | **4/4**, desktop/mobil, 6.8 dakika |
| Client secret taraması | 24 production dosyasında Resend anahtarı yok |

Normal/focus/dolu müşteri araması masaüstü ve mobilde PNG olarak alınıp incelendi; tek dış focus, ikon/metin hizası, filtreleme ve sayfa taşmaması doğrulandı. Beklenen negatif HTTP kayıtları dışında beklenmeyen browser konsol hatası yoktu. İlk browser koşusundaki test sıralama/locator hatası düzeltilip tam koşu tekrarlandı; başarısız deneme başarı sayılmadı. Önceden bilinen Next development stream, pg deprecation ve NO_COLOR uyarıları devam eder. Gerçek Safari/Firefox veya ekran okuyucu sertifikasyonu yapılmadı.

Demo Playwright: **22/22**, desktop/mobil, **1.7 dakika**; müşteri/satış taslakları, numeric giriş, maliyet, snapshot, responsive, klavye ve reduced-motion korundu. Son toplam browser sonucu 26/26'dır (22 demo + 4 auth/cloud/D7).

D7 uygulama/test/görsel teslimi **`549d4bd`**, GitHub `feat/pusula-v030-neon-cloud` dalına başarıyla push edildi. Push sonrası yerel/uzak farkı **0/0**, çalışma ağacı temizdi. 27 staged dosyanın yapılandırılmış yerel sırlara karşı taraması PASS verdi. Bu gerçekleşmiş push kaydı ayrı dokümantasyon commit'iyle aynı dala gönderilir; main değiştirilmedi.
