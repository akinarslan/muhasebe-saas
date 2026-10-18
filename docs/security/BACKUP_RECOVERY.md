# v0.3 yedek ve kurtarma — tasarım / henüz çalışmıyor

18.10.2026 E2 güncellemesi: operatör CLI, Node/OpenSSL AES-256-GCM streaming, HKDF ile ayrı encryption/MAC anahtarları, authenticated manifest, snapshot/rol/kapsam guard'ları ve koşullu R2 upload/readback kodu eklendi. [CLI/format ve sınırlamalar](../operations/BACKUP_ENGINE.md), [E2 denetimi](../../research/PUSULA_V030_SPRINT_E2_AUDIT.md), [doğrulama](../validation/SPRINT_E2_VERIFICATION.md). R2 HeadBucket geçti. Gerçek development dump/upload ve gerçek PostgreSQL fixture dump kanıtı yok; E2 kabulü açık. Özel backup rolü/direct URL, PG18 araçları, key eksik. R2 public kapalı/domain yok/bucket-scope ayarları hesap sahibinin panel beyanıyla doğrulandı; bağımsız API kontrolü yapılmadı. Gerçek key üretilmedi. Scheduler/retention/alarm E3, restore E4 kapsamındadır. Aşağıdaki age/S3/günlük35 ifadeleri tarihsel tasarım; uygulanan format AES-GCM v1 ve hedef R2 Standard'dır. Saklama önerisi günlük30/haftalık12/aylık36 ay; silme yok.

18.10.2026 E1 tarihsel: [Denetim](../../research/PUSULA_V030_SPRINT_E_AUDIT.md), [R2 kurulumu](../operations/R2_BACKUP_SETUP.md), [restore](../operations/DISASTER_RECOVERY.md), [retention](../operations/BACKUP_RETENTION.md).

16.10.2026. Sprint B'de Neon development bağlantısı kuruldu; bağımsız bucket, scheduler veya restore kanıtı **yoktur**. Bu prosedürün varlığı yedek alınmış olduğu anlamına gelmez. Yedek/restore uygulaması Sprint E kapsamındadır.

Neon instant restore kısa geri dönüş içindir; uzun arşiv değildir. [Neon yedek stratejisi](https://neon.com/docs/postgres/backup-restore/backups) PostgreSQL dump/restore ve bağımsız saklamayı destekler. [Güncel Free fiyat tablosunda](https://neon.com/pricing) restore 6 saat/1GB değişim ile sınırlı gösterilir; farklı genel kılavuzlardaki daha uzun süre Free için garanti sayılmaz. Gerçek projenin Console ayarı kurulumda doğrulanacak.

## Bağımsız yedek tasarımı

Standart `pg_dump -Fc` direct bağlantı üzerinden; uyumlu PostgreSQL client sürümü, TLS sertifika doğrulaması, noninteractive credential injection. Dump local geçici klasörde kısıtlı ACL ile oluşur; loga URL/şifre/SQL veya kayıt içerikleri basılmaz. Çıktı **yüklemeden önce age public-key ile şifrelenir**; private key CI'da tutulmaz, işletme sahibinin güvenli/offline anahtar deposundadır. Manifest: schema/migration sürümü, UTC zaman, hedef etiketi, ciphertext SHA256, dosya boyutu ve işlem sonucu; PII içermez.

Hedef önerisi: Neon'dan ayrı hesapta özel S3 uyumlu bucket (örneğin AWS S3); public access kapalı, versioning ve destekleniyorsa Object Lock. Upload kimliği yalnız gerekli prefix'e yazabilir, restore/silme ayrı kimliktir. Aynı Neon projesinin Storage ürünü bağımsız yedek sayılmaz. Bölge, aktarım koşulları, retention ve ücretler kullanıcıyla seçilmeden bucket açılmaz. Depolama, request/egress ve bağımsız scheduler/CI ücreti ayrıca doğabilir; ücretsiz olduğu varsayılmaz ve bu aşamada ücretli hizmet başlatılmadı.

Günlük scheduler (öneri GitHub Actions protected environment veya işletmenin runner'ı), maksimum süre, tek koşu concurrency, son başarılı yedek >26 saat alarmı, dump/encrypt/upload/manifest hatasında nonzero exit. Alarm yalnız güvenli durum/id/UTC zaman içerir. Cron işinin varlığı başarı kanıtı değildir; upload doğrulaması ve periyodik restore gerekir. Repo GitHub'a veritabanı dump'ı, yedek veya secret konmaz.

Taslak retention: günlük35 gün, aylık36 ay. Üç yıllık arşiv hedefi günlük bütün kopyaları3 yıl tutmak anlamına gelmez; finansal belge saklama politikası ayrıca belirlenir. RPO hedefi günlük yedek için24 saat, RTO ilk tatbikatta ölçülerek hedefe bağlanır; şimdi bir SLA iddia edilmez.

## İzole restore tatbikatı

1. Production'dan farklı, açıkça restore-test olarak işaretli boş Neon test projesi/branch'i seç; hedef allowlist, ortam ve rol doğrulaması yap. Production URL eşleşirse işlem başlamaz.
2. Test verisini staging'e ekle: iki tenant, müşteri, fiyat geçmişi, USD material, satış/teklif/kur snapshot ve audit ilişkileri. Sayım ve normalize edilmiş Decimal/snapshot hash manifest'i al.
3. Dump al, şifrele, bağımsız hedefe yükle, SHA doğrula. Ayrı restore kimliğiyle indir; age private key yalnız izole ortamda çözülür.
4. `pg_restore` direct test bağlantısına uygulanır; production'da `--clean` çalıştırılmaz. Rol/owner/global grants dump dışında olabileceğinden migration ve rol runbook'u da tatbikatın parçasıdır.
5. Sayım, Decimal, FK/unique, immutable snapshot, audit, auth/session ve runtime RLS tenant testlerini karşılaştır. Aktif oturumları restore sonrası iptal et; restore güvenilir zamanda tekrar giriş gerektirir.
6. Kaynak/hedef ortam etiketleri, manifest SHA, migration sürümü, UTC başlangıç/bitiş, gerçek RPO/RTO ve hataları raporla. Parola/veri payload'ı ekleme. Başarısız tatbikatta canlı kullanım kapısı kapalı kalır.

Bu tatbikat için gerçek staging erişimi ve bağımsız yedek hedefi gerekir; henüz yürütülmedi. Sadece yerel dosya kopyalama testi bulut restore testi yerine sayılmayacak.
