# V04 V4.3a.1 — Neon recovery readiness

20.10.2026 · **RECOVERY_BLOCKED** · Canlı preflight: **PREFLIGHT_PASS**.

Bu sprint salt okunur hazırlıktır. Migration015 uygulanmadı; yeni kurtarma kaynağı oluşturulmadı. Tam yöntem, sınırlar ve onay sırası: [Neon kurtarma planı](../../research/PUSULA_V04_V43A1_NEON_RECOVERY_PLAN.md).

## Kanıt matrisi

| Kontrol | Kanıt | Sonuç |
|---|---|---|
| Git başlangıcı | Doğru dal, temiz ağaç; HEAD ve ağ üzerinden uzak dal `1c41d04d299bd49087ac36d04f88b91cf6cfbc0f`; fark0/0 | PASS |
| Yerel migration dosyaları | İlk14 +015 SHA-256 baseline ile15/15 eşleşti | PASS |
| 015 SHA-256 | `181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a` | PASS |
| Flagsiz mevcut runner | `node --import tsx scripts/db/migrate.ts`, exit0; `applied=false` | PASS |
| Hedef / sürüm | development `br-rough-darkness-ba6ow9zo`, `pusula_development`, PG18.6 | PASS |
| Canlı katalog | 38 tablo /24 FORCE RLS; sekiz pre-schema hash eşleşti | PASS |
| History | 14 başarılı, çözülmüş008 rollback1, unresolved0, yalnız015 pending | PASS |
| Drift | schemaDrift=false; privilegeDrift=false, runner pin kapsamıyla sınırlı | PASS / kapsam sınırı |
| Referans toplamları | Supplier1 / SupplierMaterial0 / SupplierOfferVersion0 / AuthUser2 / Membership2 | PASS |
| Free envanter | free_v3; branch3/10; manuel snapshot1/1; eski preview mevcut | PASS |
| Compute | Project gecikmeli sayaç6,336 CU-saniye ≈1.76 CU-hour | Gözlendi; anlık garanti yok |
| Storage | Limit1GB; gerçek toplam/kalan doğrulanamadı; v2 consumption GET403; erişilebilir oturum açık Console yok | **BLOCKED** |
| Güncel kurtarma noktası | Eski snapshot014 ve Supplier kaydından önce; yeni capture yok | **YOK** |
| Gerçek kurtarma testi | Yeni branch/restore/disposable test yapılmadı | **YAPILMADI** |
| Sprint E yedek | 35/21 pinleri38/24 veya40/26 kapsamını karşılamıyor; backup rolü yok; PUBLIC TEMP/CONNECT engelleri | **BLOCKED** |
| Gerçek015 apply | Kullanıcı onayı yok; uygulanmadı | **KAPALI** |

Runner privilege hash'i Supplier/PO ACL'lerini dışlar; PASS yeni nesnelerin kapsamlı etkin izin kabulü değildir. Gelecekteki testte bunlar ayrıca ölçülmelidir. Ek katalog sorguları başka DB'lere bağlanmadan onaylı development üzerinde yapıldı.

## Yöntem ve kalan kapılar

Öneri B: Güncel development'tan `parent-data` branch; eski snapshot ve preview korunur. Bu yöntem capture noktasındaki tüm DB/schema/data/rol kapsamını alabilir. Uygulama dışı MFA anahtarları ve bağlantı sırlarının korunması ayrıca gereklidir. Sağlayıcı içi branch bağımsız yedek değildir. [Neon branch kapsamı](https://neon.com/blog/neon-object-hierarchy).

Free limitleri güncel olarak proje başına1GB, ayda100CU-hour,10branch ve1manuel snapshot'tır. Limit doğrulaması mevcut kullanım teyidi yerine geçmez. Storage0 dönen deprecated alanlar kullanılmadı. [Güncel Neon kotaları](https://neon.com/pricing).

Kullanıcı Console'da proje Storage kullanılan/limit/kalan, branch/history/snapshot katkıları, Compute kullanılan/kalan ve quota uyarılarını tarih/saatle doğrulamalı. Ardından ayrı açık onayla data branch ve gerekli minimum0.25CU doğrulama endpoint'i oluşturulabilir. Kaynak yazıları için capture/RPO penceresi belirlenmeli; branch dördüncü slotu, ayrıca disposable test branch'i beşinci slotu kullanır.

Gerçek kabulte capture ve disposable kurtarma hedefi karşılaştırılmalı: tüm DB/roller,38/24,14 başarılı+çözülmüş008,pending015, Supplier/Auth/Membership referansları, Auth/MFA/MASTER ve ACL/RLS. Yalnız kaynak branch'in varlığı veya eski snapshot restore geçmişi yeterli değildir. Güncel runner farklı hedefi reddeder; disposable migration provası için güvenlik kontrolünü aşmak yerine ayrı incelenmiş hedef desteği/onay gerekir. Prova sonrası40/26 ve15 başarılı migration ile Purchases fonksiyon/permission testleri ayrıca değerlendirilir. Gerçek development apply ancak kurtarma kabulü ve ayrı kullanıcı onayıyla açılır.

## Uygulama sınırları ve yerel kanıt

Kalıcı bulut veri/kaynak değişikliği yok. Salt okunur bağlantı compute'u uyandırabilir; preflight geçici advisory lock kullanır. CLI PowerShell wrapper execution policy nedeniyle doğrudan Node üzerinden çalıştırıldı; policy değiştirilmedi. İlk auth-cache yazma ve ek tsx çalıştırma sandbox kısıtları sonrası yalnız belirtilen işlemler yükseltilmiş izinle tamamlandı; DB credentials değiştirilmedi. İlk tsx `spawn EPERM` denemesinde SQL çalışmadı; sonraki read-only sorgu başarılıdır.

Kanıtlar Gitignored `.data/recovery-v43a1/` altında: `preflight-initial.log`, `checksums.json`, `provider-read.json`, `live-readonly.json`, `initial-hashes.json` ve son bütünlük kontrolü. Ham yerel proje yanıtı kişisel metadata içerebilir; bu klasör teslim/commit edilmez. Raporlarda satır içerikleri veya sırlar yoktur. Kod/SQL/env değişikliği, migration apply, branch/snapshot oluşturma/silme, dump/R2 upload, restore/finalize/reset, upgrade, commit/push yapılmadı. Bu dokümantasyon sprinti için uygulama testleri yeniden çalıştırılmadı; önceki FIX_PASS güncel bulut kurtarma kabulü sayılmadı.

## Mimo'ya kesin teslim listesi

1. `research/PUSULA_V04_V43A1_NEON_RECOVERY_PLAN.md`
2. `docs/validation/V04_V43A1_READINESS.md`
3. `LAST_REPORT.md`

Mimo ayrı gerçek `.md` teslim raporu oluşturur; bu görevde Codex commit/push yapmaz. Ana dala merge veya force-push yetkisi yoktur.
