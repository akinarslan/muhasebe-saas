# PUSULA V4.3a.4 — CLOUD_BASELINE_ACCEPTED

20.10.2026 · **V4.3a — CLOUD_BASELINE_ACCEPTED** · HEAD `1c41d04d299bd49087ac36d04f88b91cf6cfbc0f`.

Kullanıcı gerçek /app üzerinde MASTER login,PurchaseAPI200,test malzeme152cm,metre link,PO-2026-9893 oluşturma,F5kalıcılığı,MFA ve ikinci tıklamada onayı manuel doğruladı. Bunlar Codex otomatik testi değildir.

Codex READ ONLY SQL:40tablo/26FORCE RLS/15başarılı migration,checksum/pinler uyumlu;MASTER6satın alma izni. Hedef PO APPROVED,1satır,2metre→3,04m²;bağımsız Decimal2×15,20=30,40USD ve snapshot eşit. Test ilişkileri tutarlı. Mevcut kapsam/aggregate kontrolleri stok/cari/ödeme hareketiyle ilişki olmadığını destekliyor;mal kabul testi değildir.

MFA sonrası dialog yalnız kapanıyor,approve otomatik yeniden gönderilmiyor;ikinci tıklama geçerli step-up ile uyumlu. İlk isteğin kesin hata kanıtı yok;bağlantı hatası denmedi. Yeniden Onayla yönlendirmesi UX takip maddesi.

Snapshot ve iki recovery branch'i korunuyor. Gerçek bulut iki tenant negatifleri,normal explicit DENY,tüm currency/offer sürümleri,R2backup/restore ve mal kabul açık. Kabul production-ready değildir. Kod/env/SQL/gerçek veri değişikliği,R2,restore/silme,commit/push/merge yok.

[Bulut kabul raporu](research/PUSULA_V04_V43A4_CLOUD_ACCEPTANCE.md) · [Doğrulama](docs/validation/V04_V43A4_VERIFICATION.md).

Mimo'ya kesin sprint teslimi:`research/PUSULA_V04_V43A4_CLOUD_ACCEPTANCE.md`,`docs/validation/V04_V43A4_VERIFICATION.md`,`LAST_REPORT.md`. Önceki raporlar korunur;`.data`teslim edilmez.

---

# PUSULA V4.3a.3 — Development migration015 uygulandı

20.10.2026 · **MIGRATION_PASS / CLOUD_ACCEPTANCE_PARTIAL** · HEAD `1c41d04d299bd49087ac36d04f88b91cf6cfbc0f`.

Açık development migration ve bakım teyidiyle güvenli runner tek kez çalıştı:APPLIED,exit0. Bağımsız postflight40tablo/26FORCE RLS/15başarılı migration,çözülmüş008=1,unresolved0;checksum/schema/ACL kontrolleri geçti. Yeni6satın alma izni yalnızMASTER'a bağlandı. Eski37tablonun içerik özetleri beklenen seed ekleri dışında korundu;AuthUser2/Membership2/Supplier1.

Gerçek pusula_runtime/Prisma READ ONLY liste ve olmayan detay sorgusu;API handler'ında oturumsuzGET401 geçti. Erişilebilir kullanıcı browser oturumu yok:oturumluAPI ve liste/detay ekranları YAPILMADI. PO/Line0;gerçek kayıt değiştirilmedi. Yazmalı kabul için somut sentetik senaryo raporda;henüz onaylanmadı/çalıştırılmadı. Bağımsız backup engeli açık.

Production/recovery/preview/snapshot ve endpoint bağlantıları korundu;env/kod/SQL değişikliği,R2,restore/finalize,ücret yükseltme,commit/push/merge yok. Bakım boyunca başka writer görülmedi;migration ve DB postflight tamamlandı.

[Migration raporu](research/PUSULA_V04_V43A3_NEON_MIGRATION_REPORT.md) · [Doğrulama ve açık kabul kapıları](docs/validation/V04_V43A3_NEON_MIGRATION_VERIFICATION.md).

Mimo'ya bu sprint teslimi:`research/PUSULA_V04_V43A3_NEON_MIGRATION_REPORT.md`,`docs/validation/V04_V43A3_NEON_MIGRATION_VERIFICATION.md`,`LAST_REPORT.md`. ÖncekiV4.3a.1/.2 dosyaları korunur;`.data` teslim edilmez.

---

# PUSULA V4.3a.2 — RECOVERY_BRANCH_PASS

20.10.2026 · HEAD `1c41d04d299bd49087ac36d04f88b91cf6cfbc0f`.

Açık kullanıcı onayıyla development'tan tek güncel data branch oluşturuldu: `pusula-v43a-pre-migration-015` / `br-broad-river-bavv5pey`; endpoint `ep-wispy-frog-ba755foo`,min/max0.25CU. Parent development,LSN `0/3638E80`,provider capture12:47:55UTC,create12:48:30UTC.

Gerçek TLS doğrulamalı READ ONLY SQL:PG18.6,38 tablo/24 FORCE RLS,14 başarılı migration,çözülmüş008=1,015 pending. Supplier1,AuthUser2,Membership2;MASTER Supplier izinleri8/8. Kaynak önce/son ve kopyada tüm38 tablo toplamları,şema/tablo-function ACL/rol fingerprint'leri eşleşti;invalid constraint/index0. Zaman farkları ve satır eşitliği sınırı raporda.

Development/production/eski preview endpoint bağlantıları ve snapshot korundu. Free branch4/10;ücret yükseltmesi yok. Toplam storage izlenmeli;compute tüketimi sürerken sayaç gecikmelidir.015 uygulanmadı;env/kod/SQL değiştirilmedi;Auth/login trafiği yönlendirilmedi;commit/push/merge yok.015 için ayrıca açık kullanıcı onayı beklenir.

[Recovery branch raporu](research/PUSULA_V04_V43A2_RECOVERY_BRANCH.md) · [SQL doğrulama kanıtı](docs/validation/V04_V43A2_RECOVERY_VERIFICATION.md).

Mimo'ya bu sprint teslimi: `research/PUSULA_V04_V43A2_RECOVERY_BRANCH.md`, `docs/validation/V04_V43A2_RECOVERY_VERIFICATION.md`, `LAST_REPORT.md`. Önceki V4.3a.1 dosyaları korunur;yerel `.data` teslim edilmez.

---

# PUSULA v0.4 — V4.3a.1 Neon recovery hazırlığı

20.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `1c41d04d299bd49087ac36d04f88b91cf6cfbc0f` · **RECOVERY_BLOCKED**.

Salt okunur canlı ön denetim **PREFLIGHT_PASS**: PG18.6,38 tablo/24 FORCE RLS,14 başarılı migration,1 çözülmüş008 rollback,015 pending; schema/runner privilege pinleri ve15 migration checksum'ı uyumlu. Supplier1, SupplierMaterial0, SupplierOfferVersion0, AuthUser2, Membership2.

Öneri: güncel development'tan veri içeren izole kurtarma branch'i; eski snapshot/preview korunur. Free branch3/10,snapshot1/1. Güncel toplam storage/kalan kapasite API'den doğrulanamadı (deprecated sıfırlar kullanılmadı; consumption v2 HTTP403); oturum açık erişilebilir Console yok. Console kapasite teyidi, ayrı branch/endpoint izni ve gerçek kurtarma testi gereklidir. Mevcut Sprint E kapsam/rol/ACL engelleri nedeniyle bağımsız yedek de hazır değildir.

Migration015 uygulanmadı; yeni branch/snapshot, dump/upload/restore veya kalıcı bulut değişikliği yapılmadı. Kod/SQL/env değişmedi; commit/push yok. Bu hazırlık migration izni oluşturmaz.

[Recovery planı](research/PUSULA_V04_V43A1_NEON_RECOVERY_PLAN.md) · [Readiness kanıtı](docs/validation/V04_V43A1_READINESS.md).

Mimo'ya kesin teslim: `research/PUSULA_V04_V43A1_NEON_RECOVERY_PLAN.md`, `docs/validation/V04_V43A1_READINESS.md`, `LAST_REPORT.md`. Yerel `.data/recovery-v43a1/` teslim edilmez.

---

# PUSULA v0.4 — V4.3a Codex F01–F10 düzeltme kabulü

20.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `2ab48ad` · **FIX_PASS — yerel kabul**.

Bağımsız denetimdeki F01–F10 düzeltildi: materyal maliyet DENY redaksiyonu, alış birimi fiyat hesabı, parent-row kilitleri ve boş onay engeli, SQL ilişki/snapshot doğrulaması, iki iptal yolu, onay step-up, create/edit ayrımı, güvenli gizli fiyat koruması ve editör para birimi, tam temsil edilemeyen miktar422 ve eksik manuel fiyat400. Tarihsel TRY teklifinin kendi TCMB snapshot'ı korunur. Normal kullanıcı OWN/ACTIVITY ve numara tahsisi kusuru, indeks uyumu, rol şablonu tutarlılığı ve yeni sipariş ayrıntı seçimi de ele alındı.

Yeni PostgreSQL18.6 fixture `v42-e20dd3a4-a688-4a06-a3b8-673bfb50d651`: gerçek Prisma migration safety18/18, DB/RLS11, Auth62, Cloud11, Supplier16, Purchases28, gerçek masaüstü/mobil Chrome2/2 PASS; 40 tablo/26 FORCE RLS/15 migration; serverStopped true. Son Vitest355/355 (29 dosya), TypeScript, ESLint0/0 ve production build PASS. Build'de mevcut rate-store dosya pattern'i için tek Turbopack warning var; başarısız ilk denemeler raporda korunur.

İlk14 migration değişmedi; 015 checksum ve yalnız dört post-schema hash'i gerçek fixture ölçümüne göre güncellendi. Eski denetim/GLM raporları ve mevcut çalışma ağacı korunur. Neon/R2/gerçek veri işlemi veya commit/push yok. Mevcut backup allowlist'i yeni PO şemasını kapsamaz; fail-closed kontrolü korunur. FIX_PASS, production/go-live veya Neon015 apply onayı değildir. GitHub teslimi Mimo'ya ayrı görev; gerçek Neon migration ayrıca kullanıcı onayı ister.

[Codex düzeltme raporu ve kesin28 dosya listesi](research/PUSULA_V04_V43A_CODEX_FIX_REPORT.md) · [Regresyon ve nihai kabul kanıtı](docs/validation/V04_V43A_CODEX_FIX_VERIFICATION.md).

---

# Önceki GLM V4.3a raporu — tarihsel kayıt

# PUSULA v0.4 — Sprint V4.3a / Satın Alma Siparişleri ilk çalışan modül

20.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `2ab48ad` (tüm değişiklikler commit'siz) · **V4.3a — LOCAL_ACCEPTANCE_PASS**

Yeni Satın Alma Siparişleri (PO) modülünün ilk çalışan sürümü tamamlandı: `PurchaseOrder`/`PurchaseOrderLine` şemaları, migration 015, tam PO servisi (idempotency/businessNo/draft versiyonlama/approve-cancel mühürleme/costView DENY sansürü), premium liste+detay+drawer UI ve izin kataloğu. PO akışı stok/cari/ödemeye dokunmaz; TRY yalnız açık TCMB snapshot'ıyla, EUR/GBP hiçbir zaman otomatik USD'ye çevrilmez; `MaterialVariant.usdCost` otomatik güncellenmez.

Migration `202610200015_purchase_orders` izole yerel PostgreSQL 18.6 fixture'ında gerçek Prisma yoluyla uygulandı ve kabul koşusu `v42-f8a7c083-db7f-480a-9a77-5baeebd82e9f` PASS: migration safety 18 kontrol PASS (baseline/schema checksum/column pin'ler, gerçek lock/statement/child timeout ve nontransactional partial enjeksiyonları, içerik koruması, ALREADY_APPLIED no-replay, fail-closed ACL: runtime PO SEL/INS/UPD + POLine SEL/INS/DEL varken test/auth ve TRUNCATE yok), `verify-c2` 9/9, suppliers 16/16, purchases 16/16 (kurumsal senaryolar: replay/409, Decimal matematik sabitliği, foreign tenant 404, inaktif tedarikçi, audit event'ler, concurrent idempotency çakışması), 40 tablo/26 FORCE RLS/15 migration. Post-015 `appliedSchema` 8 hash'i gerçek `post-schema.json`'dan `migration-baseline.json`'a pinlendi (iki fazlı bootstrap: ilk koşunun beklenen `APPLIED_SCHEMA_DRIFT` sonrası ikinci koşu birebir uyuştu). Vitest 344/344 (28 dosya, `purchase-pricing.test.ts` 15/15), `tsc --noEmit` temiz, ESLint 0/0.

Regresyon bakımı: `suppliers/verify.ts` yedek fail-closed sayımı 38→40 (PO yedekte hâlâ yok; `scripts/backup/postgres.ts` pinleri dokunulmadı, backup allowlist 35/21 kalır); fixture bootstrap artık Role satırlarını migration cross-join'lerinden önce ekliyor (production sırası); partial-schema kontrolleri 015 tablo sınıflandırmasına güncellendi. Neon (development/test/production), R2, restore/finalize işlemi yok; 014 ve öncesi checksum'lar korundu; `OLD`/`NEW` yalnız trigger'lerde. Kullanıcı teslimi: commit/push yapılmadı — Git teslimi Mimo'ya.

[V4.3a sprint raporu](research/PUSULA_V04_V43A_GLM_REPORT.md) · [Doğrulama kanıtı](docs/validation/V04_V43A_VERIFICATION.md)

---

# Önceki V4.2f / V4.2e kaydı — tarihsel durum (içerik aşağıda korunur)

19.10.2026 · `feat/pusula-v030-neon-cloud` · **V4.2 temel development bulut kabulü tamamlandı; ileri senaryolar açık.**

Güncel Codex READ ONLY doğrulaması18:05:51Z: PostgreSQL18.6,014 applied,38 tablo/24 FORCE RLS/14 başarılı migration; sekiz yeni Supplier izni ve sekiz MASTER ilişkisi, MASTER toplam66 izin. Post-schema/rol/ACL pinleri uyumlu, beklenmeyen drift yok.18:06:16Z yalnız ad parametreli sayımda PUSULA TEST TEDARİKÇİSİ için1 aktif eşleşme doğrulandı; SupplierMaterial/SupplierOfferVersion0. Hassas Auth/MFA/session veya finansal içerik okunmadı.

Kullanıcı MASTER giriş/TOTP,/app Tedarikçiler,Supplier API HTTP200,kayıt oluşturma,F5 kalıcılık ve ayrıntı ekranını başarılı bildirdi. Bunlar kullanıcı manuel kabulüdür; Codex'in bağımsız browser/HTTP testi değildir. Önceki gerçek runtime/Prisma smoke kanıtı tarihsel olarak korunur.

Canlı açık maddeler: SupplierMaterial eşleştirme,SupplierOfferVersion oluşturma/tarihsel sürümler,iki tenant izolasyonu,explicit DENY/maliyet gizliliği ve bağımsız R2 backup. Yerel fixture kanıtları bu kapıları kapatmaz. Snapshot ve preview branch/endpoint metadata'sı korunuyor. Bu sprint yeni migration,DML/kayıt oluşturma veya silme,production/test SQL,R2,restore/finalize yok.

[V4.2f kapanış raporu](research/PUSULA_V04_V42F_CLOUD_ACCEPTANCE.md) · [Güncellenmiş bulut kabulü](docs/validation/V04_V42E_CLOUD_ACCEPTANCE.md). Codex yalnız teknik doğrulama ve üç Markdown dosyasını hazırladı; önceki değişiklikler korundu, commit/push yapılmadı. Git teslimi Mimo'ya ait.

---

# Önceki V4.2e kaydı — manuel kabul öncesi tarihsel durum

# PUSULA v0.4 — Sprint V4.2e / gerçek migration014 uygulandı

19.10.2026 · `feat/pusula-v030-neon-cloud` · **V4.2e — MIGRATION_APPLIED / CLOUD_ACCEPTANCE_PENDING**

Kullanıcı bakım penceresini ve başka development yazıcısı bilmediğini teyit etti. Son provider metadata ve15:49:57Z bayraksız preflight PASS;15:50:22Z faaliyet/DDL/sayım kapıları geçti. Migration014 yalnız pusula_development üzerinde güvenli runner ile bir kez uygulandı; exit0/APPLIED. DB started_at15:50:30.346Z, finished_at15:50:30.780Z (İstanbul18:50:30.780).014 hash ve ilk13 checksum korundu; retry/resolve/manuelSQL/restore yok.

Bağımsız gerçek postflight:38 tablo/24 FORCE RLS/14 başarılı migration; eski1 resolved008 rollback korunur. Sekiz Supplier Permission ve sekiz MASTER ilişkisi eklendi; MASTER toplam66 izin. Üç Supplier tablosu mevcut ve0 kayıt. Post-schema/ACL pinleri ve test_runtime sınırı geçti. Eski35 tablonun32 toplamı aynı; yalnız Permission58→66,RolePermission92→100,history14→15 değişti. AuthUser2/Membership2 ve iş toplamları korundu; tam içerik eşitliği iddiası yok.

Gerçek pusula_runtime/Prisma ile READ ONLY üç Supplier sorgusu PASS; istemci TLS socket CA/hostname/encrypted/authorized doğrulandı. İlk smoke backend pg_stat_ssl ölçümü yüzünden durmuştu; gerçek istemci socket ölçümüyle ayrıştırıldı, korumalar kapatılmadı. Oturum açılmış MASTER UI/HTTP API kabulü ve canlı yazmalı testler yapılmadı; tam NEON_MIGRATION_PASS verilmez. Yeni Auth session veya sahte Supplier/sipariş oluşturulmadı.

Aynı sprintte yerel TypeScript/ESLint PASS,Vitest329/329,migration safety16/16,DB/RLS11/11,Auth/API62/62,Cloud/DB11/11,Supplier16/16 geçti; ayrı localhost fixture kapandı. Build/browser koşulmadı. Gerçek Neon test/production/preview SQL yok. Snapshot/preview/production ID ve endpoint bağları,ayarları korundu; R2/finalize/reset/delete/ücretli plan yok.

[Gerçek migration raporu](research/PUSULA_V04_V42E_NEON_MIGRATION_REPORT.md) · [Bulut kabul durumu](docs/validation/V04_V42E_CLOUD_ACCEPTANCE.md). Development şeması V4.3 için kurulu; önce kalan gerçek MASTER salt okunur UI/API kabulü tamamlanmalı. Sprint E production engelleri sürer. Codex commit/push yapmadı; Mimo'ya iki belge ve LAST_REPORT sonucu devredilir.

---

# Önceki V4.2e bakım kapısı kaydı — apply öncesi tarihsel durum

# PUSULA v0.4 — Sprint V4.2e / canlı preflight ve bakım kapısı

19.10.2026 · `feat/pusula-v030-neon-cloud` · **V4.2e — BLOCKED / NO_APPLY**

Migration uygulama onayı geçerli; eksik olan talimattaki zorunlu bakım penceresi ve development'a yazabilen uygulama/diğer kullanıcı/worker/scheduler işlemlerinin durdurulduğu teyididir. Bu bilgi soruldu; teyit gelmeden --apply kullanılmadı. Anlık başka istemci olmaması bakım teyidi yerine geçmez.

Operatör henüz tüm yazıcıları doğrulamadığını bildirdi. Yeni15:44:34–45Z READ ONLY üç örneklemde başka development session/transaction,diğer oturum kilidi ve prepared transaction yok. Yerelde Pusula Next.js veya eşleşen görünür scheduler bulunmadı; worker adı taşıyan Codex araçları ayrıştırıldı. Vite4207'nin Pusula ilişkisi doğrulanmadı,kapattırılmadı. Uzak deployment/başka cihaz ihtimali açık: Pusula sekmeleri ve varsa haricî yazıcılar bakım boyunca operatörce duraklatılıp teyit edilmeli. Süreç/servis/oturum sonlandırılmadı; migration uygulanmadı.

Gerçek bayraksız runner15:10:04.051Z: PREFLIGHT_PASS, applied=false, PostgreSQL18.6,35 tablo/21 FORCE RLS,13 başarılı migration,1 resolved008 rollback,014 pending. Şema/izin/checksum drift yok.15:11:15Z READ ONLY gözleminde diğer istemci,aktif transaction,çakışan DDL/bekleyen lock ve prepared transaction0. Eski35 tablo sayım referansı alındı: AuthUser2/Membership2; eski iş tabloları0. Supplier izinleri henüz0; gerçek014 uygulanmadı.

TypeScript ve ESLint PASS; Vitest329/329,27 dosya,23.43 saniye. Yeni localhost fixture'da migration güvenliği16/16,DB/RLS11/11,Auth/API62/62,Cloud/DB11/11,Supplier16/16 PASS; serverStopped=true. Bunlar gerçek Neon Supplier kabulü değildir. Canlı MASTER UI/API ve browser smoke uygulanmadı.

HEAD/uzak feature `a88fa0c`,fark0/0; önceki değişiklikler korunur.014 hash aynı. Provider metadata'da development/production/restore preview bağları ve snapshot korunuyor; yeni restore/branch/snapshot/finalize/delete yok. Production/Neon test SQL veya R2 işlemi yok.

[Migration raporu](research/PUSULA_V04_V42E_NEON_MIGRATION_REPORT.md) · [Bulut kabul durumu](docs/validation/V04_V42E_CLOUD_ACCEPTANCE.md). Bakım teyidinden sonra taze preflight/lock kontrolü, tek onaylı apply ve gerçek38/24/14 postflight gerekir. Codex commit/push yapmadı; Mimo'ya bu iki belge ve LAST_REPORT V42E özeti devredilir.

---

# Önceki V4.2d.4 kaydı

# PUSULA v0.4 — Sprint V4.2d.4 / restore PostgreSQL tanısı ve kabul

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `a88fa0c` korunur. **RESTORE_PASS — migration014 için ayrı kullanıcı onayı bekleniyor.**

Gerçek neden, Git dışı doğrulayıcının FK katalog sorgusundaki array_agg(attname) sonucuydu: PostgreSQL name[] OID1003 kurulu pg parser'ında string dönüyor, doğrulayıcı .map() ile TypeError üretiyordu. Aşama FK_VIOLATION_COUNTS; SQLSTATE yok. TLS/bağlantı/READ ONLY/migration/şema/sayımlar daha önce geçiyordu. Yalnız SELECT aggregate girdileri ::text yapıldı; text[] OID1009 parser deneyi ve düzeltilmiş gerçek hedef koşusu geçti. Guard, CA veya allowlist gevşetilmedi.

Mevcut `br-patient-block-bald8u59` / `ep-curly-base-ba5jc1c2` üzerinde14:16:33.676Z RESTORE_SQL_PASS: TLS encrypted/authorized/hostname PASS, PostgreSQL18.6,13 checksum uyumlu migration,1resolved008 rollback,014pending,35tablo/21FORCE RLS. Baseline schema/privilege hash'leri,82index,350constraint,43policy,11trigger ve5function eşleşti.43FK'de ihlal0. AuthUser2/Membership2; MASTER58/58izin ve üyelik/atama tutarsızlıkları0. İş/USD geçmişi/satış tabloları0; dolu finansal içerik eşitliği veya yazmalı davranış testi iddiası yok.

Önce/sonra provider karşılaştırmasında development/production branch ve endpoint bağları/ayarları,kaynak DB listesi,snapshot metadata eşit. Yeni restore/snapshot/finalize/reset/rename/silme veya kaynak/test/production SQL yok. Migration014 uygulanmadı; hash korundu. Hedef branch ready ve son endpoint active,0.25CU; silinmedi. Temizlik ayrı onay gerektirir. Uygulama/env/rol değişikliği veya R2 yok; gerçek Auth oturumları açılmadı.

[Tam tanı, doğrulama ve kanıt sınırları](research/PUSULA_V04_V42D4_RESTORE_SQL_DIAGNOSIS.md). Sonraki014 için taze guarded preflight ve ayrıca açık kullanıcı onayı gerekir. Mimo'ya bu yeni rapor ve LAST_REPORT D4 özeti devredilir; önceki değişiklikler korunur. Codex commit/push yapmadı.

---

# Önceki V4.2d.3 kaydı

# PUSULA v0.4 — Sprint V4.2d.3 / gerçek preview restore denemesi

19.10.2026 · `feat/pusula-v030-neon-cloud` · **BLOCKED — provider restore tamamlandı; PostgreSQL doğrulaması başarısız. RESTORE_PASS verilmez;014 uygulanmadı.**

Free aboneliği API'de free_v3,2/10branch ve5478CU-saniye olarak doğrulandı; snapshot/kaynak/hedef ad/operation kontrolleri geçti. Tek snapshot restore POST'u finalize_restore=false ile gönderildi, retry yapılmadı. Yeni branch `pusula-v42-restore-verification` / `br-patient-block-bald8u59`; provider otomatik endpoint `ep-curly-base-ba5jc1c2`, min=max0.25CU. Beş operation finished, hedef ready oldu.

Hedefe sabitlenmiş verify-full/CA yapılandırmalı salt okunur PostgreSQL denemesi13:59:52.300Z'de exit1/RESTORE_SQL_FAILED ile durdu. Geçici hata sınıflandırması asıl exception/SQLSTATE ve alt aşamayı korumadığı için kesin neden bilinmiyor. Başarılı TLS/PG18.6/35tablo/21FORCE RLS/13migration/Auth/sayım sonucu iddia edilmez. Talimattaki durma koşulu gereği SQL tekrarı, guard gevşetme veya otomatik kurtarma yapılmadı.

14:00:40.902Z son provider GET: development/production ID,ad,endpoint bağları,ayarları,kaynak DB envanteri ve snapshot korundu. Kaynak/prod endpoint idle; yeni endpoint active ve branch ready kaldı, silinmedi. Free bütçesi tüketimi sürebilir; temizlik ayrı onay gerektirir. Kaynak/test/production SQL, migration014, finalize/reset/rename, rol değişikliği,dump/R2 yok. Normal.env.local değişmedi; hedef yapılandırması kullanıcı+SYSTEM ACL'li Git dışı dizinde tutuldu; gerçek Auth oturumları uygulamaya açılmadı.

[Tam gerçek restore denemesi raporu](research/PUSULA_V04_V42D3_REAL_RESTORE_VERIFICATION.md). Önce mevcut preview hedefinde güvenli hata tanısı ve eksik salt okunur kabul kontrolleri gerekir; gerçek migration onayı henüz istenmez. Mimo'ya bu rapor ve LAST_REPORT D3 özeti devredilir. Önceki değişiklikler korundu; Codex commit/push/merge yapmadı.

---

# Önceki V4.2d.2 kaydı

# PUSULA v0.4 — Sprint V4.2d.2 / izole snapshot kurtarma planı

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `a88fa0c` korunur. **Plan hazır; uygulama kapısı BLOCKED: güncel storage/restore kapasitesi teyidi ve ardından ayrı açık onay gerekir. Gerçek restore yapılmadı.**

12:59:52.891Z salt okunur Neon GET/list: snapshot `snap-frosty-sky-bav0qeo6`, doğru development kaynak ID'si ve11:03:46Z zamanı eşleşti. İki branch/tek snapshot var; `pusula-v42-restore-verification` adı boş. Snapshot listesinde status/expiration yok; Never operatör beyanıdır. Snapshot varlığı başarılı kurtarma kanıtı değildir.

Standart Free10 branch/1 snapshot kotası açısından hedef3/10 olur. Proje GET compute5164 saniye gösterdi; storage alanları deprecated olduğundan dönen0 değerleri boş kota diye yorumlanmadı. Güncel storage ve ödeme gerektirmeyen restore kapasitesi Console teyidi bekler. Yeni kaynak/ücretli işlem yapılmadı.

[Tam plan, API sırası, Auth güvenliği ve kabul kapıları](research/PUSULA_V04_V42D2_RESTORE_PLAN.md). Restore API yeni branch döndürür; yeni ID yanıttan doğrulanacak. Explicit finalize_restore=false yanında ayrı endpoint/kimlik ve kaynak bağ kontrolleri gerekir. Finalize compute taşıma/rename yaptığı için tatbikatta yasak. Gerçek Auth oturumları uygulamaya açılmayacak; normal.env.local değişmez. Snapshot tüm branch kapsamındaki hassas veri kopyası sayılır; orijinal test DB'ye işlem yapılmaz.

D1 gerçek PREFLIGHT_PASS/applied=false ve014 hash korundu; bu tur yeni SQL/test suite koşulmadı. Kod/env/migration değişmedi; branch/restore/finalize/delete/dump/R2 yok. Codex commit/push yapmadı. Mimo'ya bu yeni rapor ve LAST_REPORT D2 özeti devredilir; önceki D1 değişiklikleri korunur. Kota doğrulanınca yalnız ayrı geçici branch/ona ait gerekirse compute ve gerçek kurtarma tatbikatı için onay istenecek; migration için ayrıca onay gerekir.

---

# Önceki V4.2d.1 kaydı

# PUSULA v0.4 — Sprint V4.2d.1 / env-loader düzeltmesi ve gerçek preflight

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `a88fa0c` korunur · **PREFLIGHT_PASS; migration014 uygulanmadı, ayrıca açık onay gerekir.**

Gerçek neden: @next/env16.4.1 CommonJS export'u __esModule=true ve named loadEnvConfig içeriyor, default export içermiyor. Runner'ın .ts/tsx default import'u gerçek-env yolunda TypeError veriyordu. Kurulu Next rehberindeki named API'ye geçildi. Fixture artık loader'ı atlamıyor; aynı API'yi yalnız özel UUID sentetik env dizininde kullanıyor. Gerçek .env.local değiştirilmedi; guard/TLS/CA/approval/timeout/pin kontrolleri korunur.

Vitest329/329,27 dosya;12 yeni gerçek env/CLI testi. TypeScript ve ESLint PASS. Yeni PG18.6 fixture'da env/migration/read-only referans16/16, DB/RLS11/11, Auth/API62/62, Cloud/DB11/11 ve Supplier16/16 PASS; kendi PID/data kimliğiyle kapandı. Lintte TLS test helper'ının use adı React Hook sayıldığı için yalnız yeniden adlandırıldı; kural kapatılmadı. Build/Playwright bu sprint çalıştırılmadı.

Yerel testlerden sonra tek gerçek development preflight: exit0/PREFLIGHT_PASS, applied=false.2026-10-19T11:52:12.917Z (İstanbul14:52:12.917) READ ONLY snapshot'ında PostgreSQL18.6,35 tablo/21 FORCE RLS,13 başarılı checksum,1 resolved008 rollback ve014 pending doğrulandı. İncelenen schema/privilege pinlerinde drift yok. Aynı snapshot'ta AuthUser2/Membership2; Customer,Material,MaterialVariant,MaterialPriceHistory,CloudProduct,CloudQuote,CloudSale,CloudSaleLine0 sayıldı. Gerçek satır/MFA/fiyat içeriği görüntülenmedi; bu sayılar içerik eşitliği veya tüm DB'nin boş olduğu anlamına gelmez.

014 hash değişmedi: `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`. Snapshot `snap-frosty-sky-bav0qeo6` üzerinde işlem yapılmadı; restore/delete/new branch/new snapshot, Neon test/production işlemi, gerçek dump/R2 yok. Snapshot'ın varlığı test edilmiş kurtarma kabiliyeti sayılmaz. Gerçek migration için kurtarma/bakım kabulü ve ayrıca açık kullanıcı onayı gerekir.

[Rapor, gerçek preflight ve Mimo listesi](research/PUSULA_V04_V42D1_PREFLIGHT_FIX.md). Codex stage/commit/push yapmadı; bu sprint8 dosya Mimo incelemesine hazır. Önceki V42D untracked raporu korundu. .data/env/test credentials teslim dışıdır.

---

# Önceki V4.2d kaydı

# PUSULA v0.4 — Sprint V4.2d / snapshot doğrulaması ve preflight

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `a88fa0c` Mimo teslimi korunur · **BLOCKED: snapshot mevcut, gerçek-env preflight TypeError ile durdu.**

Mevcut Neon CLI kimliğiyle yalnız GET/list metadata kullanılarak snapshot bağımsız doğrulandı: `pusula-v42-before-supplier-migration`, ID `snap-frosty-sky-bav0qeo6`, manual=true, oluşturulma2026-10-19T11:03:46Z (İstanbul14:03:46). Kaynak branch ID'si onaylı `development`/`br-rough-darkness-ba6ow9zo` ile aynı; proje `pusula-development`. Listede1 snapshot,2 branch; development API DB listesinde neondb/pusula_development/pusula_sprint_b_test var. History ayarı21600 saniye. Never operatör teyididir; liste JSON'u expiration alanı döndürmedi. Snapshot oluşturulması test edilmiş kurtarma değildir.

014 checksum `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da` eşleşti. Flagsiz guarded preflight exit1/MIGRATION_SAFETY_FAILED verdi; güvenli tanı TypeError'ın `nextEnv.loadEnvConfig` yolunda, DB bağlantısından önce oluştuğunu gösterdi. Bu env-loader yolu önceki local fixture testlerinde atlanmıştı. Kaynak kod değiştirilmedi, env alternatif yoldan yüklenip runner aşılmadı. Güncel SQL35/21/13-checksum/ACL ve eski10 tablo sayımı bu tur alınamadı; eski06:00 referansı snapshot veya bugünkü DB sonucu diye kullanılmaz.

[Snapshot kapsamı, maliyet ve38/24 kabul planı](research/PUSULA_V04_V42D_SNAPSHOT_READINESS.md). API belgeleri ayrı preview branch restore seçeneğini gösterir; gelecekte explicit finalize_restore=false ve ayrı kaynak/veri kopyası onayı gerekir. Yerinde restore aynı branch'teki test DB/Auth/MFA'yı etkileyebilir; bu görevde yasaktır. Yeni branch/snapshot/restore/delete/migration/grant/dump/R2 veya SQL veri işlemi yapılmadı. Free standart kotaları10 branch/1 snapshot; gerçek restore/erişim/fiilî kullanılabilirlik ve bağımsız R2 kabulü henüz kanıtlanmadı.

Sonraki adım dar env-loader düzeltmesi ve gerçek giriş yolu regresyonu; ardından yeni salt okunur SQL baseline'ı ve kurtarma kapısı. Bu engeller çözülmeden gerçek migration onayı istenmez. Codex commit/push yapmadı; Mimo'ya yalnız yeni V42D raporu ve bu dosya devredilir. Mevcut uygulama/migration/env dosyaları korundu.

---

# Önceki V4.2c.1 kaydı

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
