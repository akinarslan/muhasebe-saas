# PUSULA v0.4 — V4.2f / temel bulut kabulü ve kapanış

19.10.2026 · `feat/pusula-v030-neon-cloud`

**V4.2 temel development bulut kabulü tamamlandı. İleri senaryolar ve bağımsız yedekleme kabulü açık.**

Karar, Codex'in gerçek Neon salt okunur teknik kanıtı ile kullanıcının bildirdiği manuel tarayıcı kabulünün birlikte değerlendirilmesidir. Kullanıcı tarayıcı işlemleri Codex'in otomatik testi değildir. Bu kapanış production kabulü veya bütün V4.2 senaryolarının tamamlandığı iddiası değildir.

## 1. Codex'in güncel bağımsız teknik doğrulaması

Yalnız onaylı `pusula_development` direct bağlantısı, mevcut CA ve hostname doğrulamasıyla kullanıldı. Gerçek PostgreSQL bağlantısı TLS encrypted/authorized kontrolünden geçti; katalog ve sayım sorguları READ ONLY transaction içinde çalıştı. İşlem sonunda ROLLBACK ve bağlantı kapatma yapıldı. Migration runner'ın apply yolu çağrılmadı.

| Kontrol | Güncel gerçek sonuç |
| --- | --- |
| Şema inceleme zamanı |2026-10-19T18:05:51.030Z; İstanbul21:05:51.030 |
| PostgreSQL |18.6 (653b019) |
| Migration014 |ALREADY_APPLIED; bitiş2026-10-19T15:50:30.780Z; rolled_back_at=null; applied_steps_count=1 |
|014 checksum |`0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`; yerel dosya ve gerçek history eşleşti |
| Başarılı migration |14; önceki resolved008 rollback kaydı ayrıca korunuyor; history toplam15 satır |
| Tablolar / FORCE RLS |38 /24 |
| Supplier |Mevcut; toplam1 |
| SupplierMaterial |Mevcut; toplam0 |
| SupplierOfferVersion |Mevcut; toplam0 |
| Yeni Supplier izinleri |Sekiz Permission ve sekiz MASTER ilişkisi |
| MASTER tüm izinleri |66 |
| Şema drift |Onaylı applied tablo/kolon/constraint/index/policy/trigger/function/enum fingerprint'leri eşleşti |
| Yetki drift |İncelenen eski rol/üyelik/default ACL/runtime pinleri ve yeni Supplier ACL sınırları eşleşti; beklenmeyen drift saptanmadı |
| Test runtime sınırı |Development CONNECT ve yeni Supplier erişim sınırları korundu |

Hedefli ikinci READ ONLY doğrulama18:06:16.526Z'de tamamlandı. Kullanıcının verdiği `PUSULA TEST TEDARİKÇİSİ` adı parametre olarak kullanıldı; yalnız eşleşme ve aktif eşleşme toplamı alındı: **1 kayıt /1 aktif kayıt**. Başka tedarikçi alanları, ID, iletişim, vergi veya finansal bilgi seçilmedi. Bu bulgu kaydın şu an DB'de bulunduğunu kanıtlar; önceki HTTP200 veya F5 hareketinin bağımsız browser kaydı değildir.

AuthUser/Membership toplamları2/2 olarak kaldı. Bazı Auth/session/audit toplu sayaçları V4.2e uygulama anından farklıdır; bu referans kullanıcı manuel testinden sonra alınmıştır. Tek tek kayıtların içeriği veya değişiklik nedeni incelenmedi; bütün farklar belirli bir kullanıcı eylemine atfedilmedi. Bu toplu veri farkları şema/izin drift'i diye sunulmaz. Eski iş/finans tabloları bu gözlemde0; dolu finansal içerik eşitliği iddia edilmez.

## 2. Kullanıcının bildirdiği manuel kabul

Aşağıdakiler **kullanıcı beyanıyla manuel kabul** olarak kaydedilmiştir. Codex bu aşamada browser automation çalıştırmadı, oturum açmadı veya bu hareketleri bağımsız yeniden üretmedi. Kesin browser test saati ve ham network kaydı bu görevde alınmadı.

| Kullanıcı kontrolü | Bildirilen sonuç | Kanıt türü |
| --- | --- | --- |
| MASTER hesabıyla giriş |Başarılı |Kullanıcı manuel kabulü |
| TOTP doğrulaması |Başarılı |Kullanıcı manuel kabulü |
| /app Tedarikçiler ekranı |Açıldı |Kullanıcı manuel kabulü |
| Supplier API |HTTP200 görüldü |Kullanıcı manuel kabulü; Codex bağımsız HTTP ölçümü değil |
| PUSULA TEST TEDARİKÇİSİ oluşturma |Başarılı |Kullanıcı manuel kabulü; Codex yeni kayıt oluşturmadı |
| F5 sonrası kalıcılık |Kayıt korundu |Kullanıcı manuel kabulü; güncel DB varlığı ayrıca Codex tarafından doğrulandı |
| Tedarikçi ayrıntıları |Açıldı |Kullanıcı manuel kabulü |

Bu sonuçlar, V4.2e'deki temel MASTER UI/HTTP kabul eksikliğini kullanıcı manuel kanıtı düzeyinde kapatır. Gerçek uygulama yolu `/app` ve gerçek development DB'dir; demo `/` verisi kabul kanıtı sayılmadı.

## 3. Önceki bağımsız ve yerel kanıtın ayrımı

V4.2e'de gerçek migration bir kez uygulanmış;38/24/14, sekiz yeni izin, önce/sonra eski toplamlar ve gerçek pusula_runtime/Prisma READ ONLY üç Supplier model sorgusu geçmişti. Bu tarihsel runtime smoke, o anda0/0/0 sonuçla çalışmıştı; bugün Supplier1 olduğu için önceki sonuç bugünkü sayım diye tekrarlanmaz. [Gerçek migration raporu](PUSULA_V04_V42E_NEON_MIGRATION_REPORT.md).

Aynı sprintin ayrı localhost sentetik fixture sonuçları: TypeScript/ESLint PASS, Vitest329/329; migration güvenliği16/16, DB/RLS11/11, Auth/API62/62, Cloud/DB11/11 ve Supplier DB/API16/16. Bunlar canlı bulut testi değildir. Yerel CRUD, teklif geçmişi, iki tenant, explicit DENY ve maliyet gizliliği kanıtı, aşağıdaki canlı açık maddeleri kapatmaz. Bu dokümantasyon sprintinde suite/build/browser yeniden çalıştırılmadı; uygulama kodu değiştirilmedi.

## 4. Canlı kabulü açık kalan senaryolar

| Senaryo | Durum ve gerekli sonraki kanıt |
| --- | --- |
| SupplierMaterial eşleştirme |Canlı kabul açık; tablo var ama0 kayıt. Ayrı kapsam/onayla gerçek akış doğrulanmalı. |
| SupplierOfferVersion ve tarihsel sürümler |Canlı kabul açık; tablo var ama0 kayıt. Oluşturma, geçmiş ve değişmezlik davranışı henüz canlı kanıtlanmadı. |
| İki tenant izolasyonu |Katalog/RLS ve yerel fixture kanıtı var; iki gerçek bulut tenant'ı üzerinden davranış kabulü açık. |
| Explicit DENY ve maliyet gizliliği |Yerel fixture kanıtı var; canlı yetkili/yetkisiz oturum karşılaştırması açık. MASTER ekranının çalışması bu kontrolün yerine geçmez. |
| Bağımsız R2 yedeği |Gerçek bağımsız şifreli yedek/upload/restore kabulü açık. Neon snapshot buna eşdeğer değildir. |

Canlı yazmalı ileri testler bu görevde yapılmadı. Yeni kayıt, tenant, teklif veya test kullanıcısı oluşturulmadı. İleri test planı gerçek hesap/iş kayıtlarını etkilemeden ayrıca belirlenmelidir. Sprint E backup rolü/PUBLIC TEMP/diğer DB CONNECT sorunları, backup35/21 allowlist'inin38/24 kapsamına alınması ve restore testleri production önkoşulu olarak sürer; guard'lar gevşetilmedi.

## 5. Snapshot, preview ve diğer kaynaklar

18:06:00.081Z provider GET/list:

- Proje `icy-queen-44442204`, abonelik free_v3;3 branch mevcut.
- Development `br-rough-darkness-ba6ow9zo` ready, mevcut endpoint'i kendi branch'ine bağlı.
- Snapshot `snap-frosty-sky-bav0qeo6`, adı `pusula-v42-before-supplier-migration`, kaynak development ve11:03:46Z zamanı ile listede korunuyor.
- Kurtarma preview `br-patient-block-bald8u59` ready; endpoint `ep-curly-base-ba5jc1c2` ona bağlı ve idle.
- Production `br-autumn-union-baaldt81` ready; endpoint `ep-soft-surf-baowiyco` ona bağlı ve idle.

Metadata kaynak varlığı/bağlarını doğrular; tüm satırların değişmezliği kanıtı değildir. Snapshot migration ve yeni test tedarikçisinden eskidir; mevcut yeni kaydın bu eski snapshot'ta bulunduğu iddia edilmez. Snapshot/preview silinmedi veya restore edilmedi. Production, mevcut Neon test DB ve preview üzerinde SQL bağlantısı açılmadı; yalnız provider metadata listelendi. R2/ücretli kaynak işlemi yapılmadı.

## 6. Kapanış ve teslim

**Temel V4.2 development bulut kabulü tamamlandı:** gerçek şema/runtime kanıtı, kullanıcı MASTER/TOTP/UI/API/kayıt/kalıcılık/ayrıntı kabulü ve güncel test kaydı varlığı birlikte kaydedildi. İleri senaryolar açık kalır; production-ready, tam güvenlik sertifikasyonu veya bağımsız backup hazır iddiası yoktur. V4.3 planlama/geliştirmesi bu doğrulanmış development tabanı üzerinden ilerleyebilir; açık maddeler takip edilmeli, sonraki migration veya canlı yazmalı testler bu kapanışla otomatik onaylanmış sayılmamalıdır.

Codex yalnız salt okunur teknik doğrulama ve üç Markdown dosyasını hazırladı. Bu sprintte migration/DML/DDL/GRANT/REVOKE, Auth/MFA/session işlemi, yeni test kaydı veya silme yapılmadı. Önceki çalışma ağacı değişiklikleri korundu; commit/push/merge yok.

Mimo değişiklik listesi:

- `research/PUSULA_V04_V42F_CLOUD_ACCEPTANCE.md`
- `docs/validation/V04_V42E_CLOUD_ACCEPTANCE.md`
- `LAST_REPORT.md` V4.2f özeti

Git dışı kanıt: `.data/v42f-schema-audit.json`, `.data/v42f-targeted.json`, `.data/v42f-provider.json`. Üç teslim belgesinde yapılandırılmış yerel sır taraması PASS, eşleşme0; whitespace kontrolü geçti ve Git index boş. Gerçek env/sırlar, geçici script ve DB çıktıları Git teslimine alınmaz. Mimo belgeleri/sır taramasını inceleyip gerçek Git teslimini ayrıca raporlar; henüz gerçekleşmemiş commit/push sonucu iddia edilmez.
