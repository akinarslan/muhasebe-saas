# PUSULA v0.4 — V4.3a.1 Neon kurtarma planı

20.10.2026 · **RECOVERY_BLOCKED** · Salt okunur hazırlık tamamlandı; migration uygulama izni değildir.

Güncel development'tan veri içeren izole kurtarma branch'i (B) önerilir. Branch kotası uygundur; toplam proje depolaması ve yeni kopyanın yeterli kapasiteyle tutulabileceği doğrulanamadığından uygulanabilirlik kabulü verilmedi. Canlı migration ön denetimi **PREFLIGHT_PASS**; beklenmeyen şema/history uyumsuzluğu bulunmadı. Yeni kurtarma noktası oluşturulmadı veya sınanmadı.

## 1. Kimlik ve bütünlük

- Repo: `akinarslan/muhasebe-saas`; dal: `feat/pusula-v030-neon-cloud`.
- HEAD ve `git ls-remote` sonucu: `1c41d04d299bd49087ac36d04f88b91cf6cfbc0f`; yerel/uzak fark `0/0`; başlangıç çalışma ağacı temiz.
- İlk 14 SQL dosyasının SHA-256 değeri `scripts/db/migration-baseline.json` ile 14/14 eşleşti. Canlı 14 başarılı history kaydı da aynı checksum'larla kabul edildi.
- Pending: `202610200015_purchase_orders`; SHA-256: `181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a`; dosya/baseline/kullanıcı beklentisi eşleşti.
- Mevcut runner'ın sekiz pre-schema fingerprint'i eşleşti. Post-015 fingerprint'leri baseline'da mevcut; bu görevde canlıya uygulanarak doğrulanmadı.
- Çözülmüş 008 kaydı: eski deneme `finished=false / rolled_back=true`; ardından güncel checksum'lı başarılı 008 mevcut. Bu eski checksum başarılı migration gibi değerlendirilmez; runner çözülmüş rollback'i kabul eder. Çözümlenmemiş history kaydı yok.

## 2. Canlı development ön denetimi

Flagsiz `node --import tsx scripts/db/migrate.ts` çalıştırıldı: 20.10.2026 12:04:39 UTC / 15:04:39 İstanbul. Sonuç `PREFLIGHT_PASS`, `applied=false`, PostgreSQL `18.6 (653b019)`, DB `pusula_development`, 38 tablo / 24 FORCE RLS, 14 başarılı migration / 1 çözülmüş rollback, yalnız 015 pending, `schemaDrift=false`, `privilegeDrift=false`.

Runner hedef/rol/TLS CA kontrolü yapar; Prisma deploy yalnız apply bayrakları ve ek kapılarla çağrılır. Flagsiz yol salt okunur transaction'larla katalog/history inceler ve geçici session advisory lock alır. Kilit kalıcı veri değişikliği değildir. Bağlantı compute'u uyandırabilir; salt okunur kontrol sıfır CU tüketimi anlamına gelmez.

Ek toplam sorguları ayrı `REPEATABLE READ READ ONLY` transaction içinde 12:09:34 UTC'de alındı:

| Tablo | Toplam |
|---|---:|
| Supplier | 1 |
| SupplierMaterial | 0 |
| SupplierOfferVersion | 0 |
| AuthUser | 2 |
| Membership | 2 |

Satır içerikleri, kimlikler, parolalar, TOTP, token veya mali tutarlar alınmadı/raporlanmadı. Bu iki ölçüm ayrı transaction'lardır; gelecekteki kurtarma noktası için eşzamanlı referans yerine geçmez.

Privilege sonucu mevcut runner'ın pin kapsamındadır: roles/memberships/defaults ve eski ACL kapsamı eşleşir; Supplier/PO tabloları ACL hash'inden dışlanır. Bu nedenle sonuç yeni Supplier nesnelerinin tüm etkin izinlerinin bağımsız denetimi veya backup rolü kabulü olarak yorumlanamaz. Yeni kapsamın ACL/RLS ve uygulama yetki testleri gerçek bulut kabulünde ayrıca gereklidir.

## 3. Neon kaynakları ve kapasite

API GET/list gözlemi: 20.10.2026 12:06:37 UTC / 15:06:37 İstanbul. Project `icy-queen-44442204` / `pusula-development`; org `org-wild-forest-12594477`; region `aws-eu-central-1`; plan API değeri `free_v3`.

| Branch | Kimlik | Durum | Logical size (byte) |
|---|---|---|---:|
| development | `br-rough-darkness-ba6ow9zo` | ready | 54,730,752 |
| production | `br-autumn-union-baaldt81` | ready | 31,686,656 |
| pusula-v42-restore-verification | `br-patient-block-bald8u59` | ready | 54,411,264 |

Branch listesi 3 kayıt, sonraki cursor yok; limit API'de 10. Dördüncü branch sonrasında 6 boş slot kalır. Ayrı disposable doğrulama branch'i de tutulursa toplam 5 / kalan 5 olur. Kaynakların hiçbiri bu görevde değiştirilmedi.

Development endpoint `ep-blue-breeze-bavbjb7l`: active, min/max 0.25 CU. Preview endpoint `ep-curly-base-ba5jc1c2`: idle, min/max 0.25 CU. Production endpoint `ep-soft-surf-baowiyco`: idle, min 0.25 / max 2 CU. API'deki suspend timeout 0 değeri Free'de sınırsız açık kalma garantisi değildir.

Snapshot listesi 1: `snap-frosty-sky-bav0qeo6`, `pusula-v42-before-supplier-migration`, development kaynaklı, oluşturma `2026-10-19T11:03:46Z`, full_size 54,370,304 byte. Full size toplam proje storage kullanımı değildir. Güncel Free sınırı 1 manuel snapshot, 10 branch, proje başına 1 GB storage ve aylık 100 CU-hour; restore geçmişi 6 saat veya 1 GB değişiklik sınırındadır. Eski 0.5 GB bilgisi kullanılmadı. [Güncel fiyat/kota](https://neon.com/pricing), [2 Ekim 2026 storage değişikliği](https://neon.com/blog/neon-free-plan-1-gb-per-project).

Project GET compute sayacı 6,336 CU-saniye = **1.76 CU-hour**; dönem `2026-10-16T10:34:55Z`–`2026-11-01T00:00:00Z`. Bu gecikmeli sayaçtan yaklaşık 98.24 CU-hour fark hesaplanabilir; anlık kalan kapasite taahhüdü değildir. `active_time_seconds` CU ağırlıklı compute sayacı yerine kullanılmadı. Yeni doğrulama endpoint'i 0.25 CU ve aktif kaldığı süreyle tüketir; örneğin toplam bir saat aktif minimum compute yaklaşık 0.25 CU-hour'dır. Süre, autosuspend, branch/history büyümesi nedeniyle kesin maliyet önceden sabitlenemez; ücretli plana geçiş önerilmedi.

**Storage kapısı açık:** `branch_logical_size_limit_bytes=1073741824` limit bilgisidir. Deprecated `synthetic_storage_size=0` ve `data_storage_bytes_hour=0` boş kullanım değildir. Branch logical size toplam proje faturalanan storage/history/snapshot kullanımını vermez. Consumption history v2 GET HTTP403 döndü; Free bu API kapsamına dahil değil. Mevcut bilgisayar/browser envanterinde erişilebilir oturum açık Console bulunmadı. [Consumption metrics erişimi](https://neon.com/docs/guides/consumption-metrics), [API alan tanımları](https://neon.com/api_spec/release/v2.json).

Kullanıcı Neon Console'da **bu proje** için güncel plan, Storage kullanılan/limit/kalan kapasite, tüm branch/history/snapshot katkıları, aylık Compute kullanılan/kalan CU-hour ve quota uyarılarını tarih/saatle doğrulamalı. Yeni branch'in ilk ortak verisi copy-on-write ile düşük ek yer kaplayabilir; ayrışma ve geçmiş penceresi dışındaki retention ek storage doğurur. Mantıksal boyutları toplayıp kesin kalan GB sonucu üretmedik. Kapasite doğrulanana kadar kaynak oluşturma kabulü yok.

Son 100 operasyon isteği 86 kayıt döndürdü; dönenlerin tamamı `finished`, bekleyen/çalışan görülmedi. Pagination eski kayıt cursor'u içerdiğinden tüm tarih için eksiksizlik iddiası yok. Kaynakların current ready durumları da gözlendi; bu, gelecekteki kota/operasyon engeli olmayacağını garanti etmez.

## 4. Kurtarma seçenekleri

| Seçenek | Koruma / maliyet | Karar |
|---|---|---|
| A — Yeni snapshot ile eskiyi değiştirme | Free snapshot 1/1. Eski pre-014 noktası silinirse tarihsel dayanak kaybolur. | Öncelikli değil; silme/yeni snapshot ayrı açık onay ister. |
| B — Güncel development'tan data branch | Mevcut snapshot korunur; kaynak değişmez; 1 ek branch, doğrulamada sınırlı compute/storage. | **Koşullu öneri; storage ve gerçek kurtarma testi bekliyor.** |
| C — Şifreli bağımsız yedek | Sağlayıcıdan bağımsız kopya mümkün; mevcut güvenlik/kapsam kapıları kapalı. | Bugün uygulanabilir kabul edilmedi. |

### A — Snapshot yenileme

Resmî OpenAPI'de snapshot create ayrı POST, mevcut snapshot güncelleme PATCH alanları yalnız `name` ve `expires_at`; mevcut noktayı yeniden yakalayan timestamp/LSN alanı veya atomik replacement endpoint'i bulunmadı. Free 1/1 doluyken ikinci manuel snapshot kabulü beklenemez; bunu test etmek için POST yapılmadı. Eski snapshot silme → yeni capture sırası korumasız aralık ve başarısız capture riski doğurur. [API sözleşmesi](https://neon.com/api_spec/release/v2.json).

Eski snapshot 014 ve güncel Supplier=1 kaydından önceki durumdur. Preview'un önceki restore varlığı da bugünkü 38 tablo/014/Supplier kaydını içerdiğini kanıtlamaz. Eski noktaya dönüş, güncel veriyi koruyan 015 öncesi geri dönüş değildir. Mevcut ikisi korunmalıdır. Snapshot'tan ayrı branch'e geri yükleme kaynak branch'i koruyabilir; bu görevde restore denenmedi. [Snapshot kurtarma davranışı](https://neon.com/blog/announcing-neon-snapshots-a-smoother-path-to-recovery).

### B — Güncel veri branch'i

Development kaynaklı `parent-data` kopyası, capture noktasındaki tüm DB'leri, şemayı, veriyi ve rolleri kapsar; schema-only kopya uygun değildir. Bu, mevcut Supplier=1 ile Auth/MFA/MASTER kapsamını koruyabilecek yöntemdir. Kaynak olarak eski preview veya production seçilmemelidir. Branch sağlayıcı içinde izole ve yazılabilir bir kopyadır; bağımsız/off-provider yedek değildir. [Nesne kapsamı](https://neon.com/blog/neon-object-hierarchy), [Branch davranışı](https://neon.com/docs/manage/branches).

DB'deki şifreli MFA materyalinin kopyalanması tek başına çalışır MFA garantisi vermez: uygulamanın mevcut dış anahtarları/secrets ve doğru hedef bağlantıları da korunmalıdır. Bunlar rapora veya branch adına taşınmaz; bağlantı sırları otomatik güvenilir/kopyalanmış sayılmaz. Gerçek kullanıcı oturumu/MFA kabul testi ayrıca yetkilendirilmelidir.

Başlangıçta compute'suz bir kurtarma branch'i, ardından yalnız test süresince minimum 0.25 CU endpoint önerilir; gerçek create sözleşmesi/endpoint ihtiyacı uygulama öncesi tekrar gözden geçirilmelidir. Free sınırlarında kalmak hedeflenir; doğrulanmamış storage ile maliyet/kota garantisi verilmez. Branch güncel geçmiş penceresinden sonra da tutulacaksa ek storage büyümesi bütçelenmelidir. [Copy-on-write ve izolasyon](https://neon.com/blog/practical-guide-to-database-branching), [Storage hesabı](https://neon.com/pricing).

### C — Sprint E bağımsız yedek

Kodda pg_dump custom format, pg_restore TOC doğrulaması, AES-256-GCM şifreleme ve manifest doğrulama; şifreli anahtar kasası ve R2 güvenlik kontrolleri bulunur. Bu özellikler çalışır, güncel yedek elde edildiği anlamına gelmez. Dump, R2 erişimi/upload veya restore yapılmadı.

- Mevcut pinler **35 tablo / 21 FORCE RLS**; canlı **38/24**, 015 sonrası **40/26**. Supplier ve PurchaseOrder kapsamı eksik; allowlist genişletme ve restore kabulü ayrı geliştirmedir.
- History kontrolü de mevcut 14 + çözülmüş 008 / pending015 durumuyla uyumlu olacak biçimde ayrıca incelenmelidir; migration güvenlik runner'ının rollback kabulü backup'a otomatik aktarılmaz. Yeni enum/function kapsamı da eski allowlist dışındadır.
- Canlı katalogda `pusula_backup` rolü yok. `neondb_owner`, runtime/auth rolü veya geniş yönetici credential'ı yedek rolü yerine kullanılamaz.
- Onaylı development'taki katalog SELECT'i PUBLIC TEMP'i doğruladı. `postgres` ve `neondb` için PUBLIC CONNECT/TEMP görülür; başka DB'ye bağlanılmadı veya ACL değiştirilmedi. Role REVOKE, PUBLIC'ten gelen yetkiyi ortadan kaldırmaz. Login/rol kapsamı branch içindeki diğer DB'ler yönünden de incelenmelidir.
- Dedicated backup rolü doğrudan BYPASSRLS gerektirir; superuser/createdb/createrole/replication, sahiplik ve üyelikler reddedilir. Veri bütünlüğü için RLS ile sessiz filtrelenmiş dump kabul edilmez. BYPASSRLS credential'ı ayrıca güçlü güven sınırıdır.
- Managed candidate istisnası uzak ortamda `MANAGED_REMOTE_OBJECT_AUDIT_REQUIRED` ile blokludur; local fixture kabulü gerçek Neon izni değildir. PUBLIC TEMP/CONNECT, nesne/function audit'i veya kapsam kontrolleri gevşetilmemelidir.

Kaynaklar: `scripts/backup/postgres.ts`, `source-security.ts`, `policy.ts`, `cli.ts` ve önceki Sprint E risk raporları. Bu bulgular backup yolunun bugün kullanılabilir olmadığını gösterir; güvenli migration preflight sonucunu geçersiz kılmaz.

## 5. Ayrı onaydan sonra uygulanacak plan

Bu bölüm gelecekteki işlemleri tarif eder; bugün yürütülmedi.

1. Console storage/compute kapasitesini doğrula; kaynak operasyonlarını ve preflight'ı yeniden ölç. Yazıları durdurulmuş bir pencere veya açık RPO belirle. Capture sonrası yazılar kopyada bulunmaz; yazılar devam ederken sıfır veri kaybı sözü verilemez.
2. Kullanıcıdan yalnız güncel development'tan `parent-data` kurtarma branch'i (`pusula-v43a-pre015-recovery-<UTC>`) oluşturma ve en düşük gerekli doğrulama endpoint'i için açık izin al. Kaynak ID, capture timestamp/LSN, kapsam, beklenen slot/compute/storage ve saklama süresi bu izinde yer alsın. Eski snapshot/preview korunacak.
3. Capture anındaki referans toplamları/katalog/history ve tüm DB/rol kapsamını kaydet; recovery branch'te 38/24, 14 başarılı + çözülmüş008, pending015 ve Supplier/Auth/Membership referanslarını doğrula. MFA sırlarını veya kişisel satırları rapora çıkarma. Branch bağlantısının uygulamayı yanlışlıkla canlı kaynağa yöneltmediğini kanıtla.
4. Gerçek kurtarma kabulü için ayrıca izinli disposable child/restore hedefi ve geçici endpoint kullan. Kurtarma branch'ini kaynak alarak yeniden kullanılabildiğini, beklenen capture verisine ve güvenlik yapısına erişilebildiğini kanıtla. Sadece branch listesinde görünmek veya eski snapshot'ın geçmişte restore edilmiş olması PASS değildir.
5. Migration provası yeni disposable hedefte yapılacaksa mevcut runner'ın hardcoded development hedef kontrolünü env değiştirerek aşma. Ayrı incelenmiş hedef doğrulama/adaptasyon ve açık yetki gerekir. Gerçek 015/prova yazısı bu görevin kapsamında değildir. Test hesabıyla Auth/MFA/MASTER, Supplier ve PurchaseOrder/RLS/permission testleri; 40/26 ve 15 başarılı migration sonucu için ayrı kabul planı uygula.
6. Test başarısızsa kaynağı değiştirme; kurtarma kabulünü kapalı tut. Test başarılıysa elde edilen kanıt ve kapasiteyle RECOVERY_PLAN_READY değerlendirmesi yap; **gerçek development015 apply için yeniden ayrı kullanıcı onayı** al.
7. Apply başarısızlığında önce yazıları durdur, migration transaction/history/katalog durumunu salt okunur incele. Commit sonrası sorunda sağlam kurtarma noktasından ayrı hedefe recovery ve kontrollü bağlantı geçişi planını uygula; source overwrite/reset/finalize, env değişikliği ve veri uzlaştırma ayrıca onay ister. Capture sonrası yazıların kaybı/uzlaştırılması RPO kapsamında açıkça ele alınır.

Gereken onaylar birleştirilmez: (i) kapasite doğrulaması, (ii) branch/endpoint ve gerçek kurtarma testi kapsamı, (iii) gerekirse izole migration provası, (iv) recovery kabulünden sonra gerçek development migration015. Bu rapor bunların hiçbirine otomatik izin sağlamaz.

## 6. Kalan kapılar ve teslim

| Kapı | Sonuç |
|---|---|
| Git, checksum, canlı şema/history | PASS |
| Mevcut roller/izinler — runner pin kapsamı | PASS; Supplier ACL kapsam sınırı yukarıda |
| Free plan, branch/snapshot envanteri | PASS |
| Toplam proje storage / yeterli kalan kapasite | **BLOCKED — Console teyidi gerekli** |
| Güncel capture ve gerçek kurtarma testi | YAPILMADI — ayrı açık onay gerekli |
| Güncel bağımsız yedek | BLOCKED — kapsam/rol/ACL audit'i gerekli |
| Gerçek migration015 izni | YOK |

Yalnız bu üç dosya Mimo'ya teslim edilecek:

1. `research/PUSULA_V04_V43A1_NEON_RECOVERY_PLAN.md`
2. `docs/validation/V04_V43A1_READINESS.md`
3. `LAST_REPORT.md`

Yerel ölçüm ve yardımcı sorgu dosyaları Gitignored `.data/recovery-v43a1/` altındadır; teslim veya commit kapsamına alınmaz. CLI standart oturum önbelleği yenilemesi dışında gerçek bağlantı sırrı/DB parolası değişikliği yapılmadı. Kod, migration, env, production ve test DB verileri değiştirilmedi; branch/snapshot oluşturma/silme, dump/upload, restore/finalize/reset, ücretli plan, commit/push yapılmadı.
