# PUSULA — Yedekleme çıkış yolu kararı

23 Ekim 2026 · Hedef 29 Ekim · **Karar: BOTH_BLOCKED.**

Bugünkü kanıtlarla ne mevcut projede bağımsız güvenli backup/restore ne de yeni Neon projesinde bu engeli ortadan kaldıran rol modeli kabul edilmiştir. **Yeni projeye taşıma kararı verilmez.** En az ek iş gerektiren aday A'dır; ancak aşağıdaki provider/erişim sınırı kanıtı olmadan `KEEP_CURRENT_PROJECT` veya READY kararı verilmez. Bu, Neon'da güvenli yedeklemenin evrensel olarak imkânsız olduğu iddiası değildir; mevcut PUSULA güvenlik sözleşmesi altında kanıtlanmış uygulanabilir yol henüz yoktur.

## Kararın dayanağı

[Cross-DB denetimi](PUSULA_NEON_CROSS_DB_AUDIT.md), [doğrulaması](../docs/validation/PUSULA_NEON_CROSS_DB_VERIFICATION.md), [rol kararı](PUSULA_NEON_BACKUP_ROLE_DECISION.md), [managed son karar](PUSULA_BACKUP_MANAGED_FINAL_DECISION.md) ve [backup yerel kabulü](PUSULA_BACKUP_LIVE_READINESS.md) esas alındı. Yeni Neon API/SQL veya genel güvenlik taraması yapılmadı; yalnız seçeneklerle ilgili resmi ürün belgeleri kontrol edildi.

Mevcut sabit development hedefi: `icy-queen-44442204` / `br-rough-darkness-ba6ow9zo` / `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech` / `pusula_development`. 23 Ekim kaynak kanıtı 40/26, 001–015 başarılı ve resolved008; 016 pending. Son cross-DB ölçümü 13:25:38–43 UTC: `postgres` üzerinde PUBLIC SELECT iki provider view ve schema USAGE ile birlikte PUBLIC EXECUTE dört rutin var. İçerik/yan etkiler okunmadı veya çalıştırılmadı; UNKNOWN kalır. Backup rolü henüz oluşturulmadı.

Dar SQL rolünün BYPASSRLS temel uygulanabilirliği önceki raporda desteklenmiştir; sorun yalnız rol yaratamamak değildir. PUBLIC hakları, kaynak dışı erişim, gerçek rol post kabulü ve bağımsız kurtarma zinciri eksiktir. 494 grantor sonucu tarihsel accepted=false; `ROLE_DELTA_UNRESOLVED` kapanmış değildir.

## A — Mevcut projeyi korumak

**Provider postgres PUBLIC haklarını değiştirmeden bugün doğrulanmış mekanizma: yok.** Mevcut `pg_dump` → AES-256-GCM/HMAC → bağımsız saklama → `pg_restore` motoru gerekli araçları sağlar; fakat güvenli kaynak credential ve gerçek kurtarma kabulünün yerine geçmez. Resmi Neon örneğinde de bağımsız S3 kopyası SQL bağlantısı ve pg_dump kullanır; bu örnek PUSULA'nın FORCE RLS/ACL/şifreleme kabulünü kanıtlamaz. [Neon harici yedekleme örneği](https://neon.com/blog/nightly-backups-for-multiple-neon-projects).

| Olası mekanizma | PUSULA için karar |
| --- | --- |
| Dar backup SQL rolü + mevcut primary | PUBLIC kaynak dışı haklarını role özel REVOKE ile engelleyemez. Mevcut managed sözleşmesi reddeder. Owner credential, neon_superuser üyeliği veya readonly varsayılanı çözüm sayılmaz. |
| Read replica üzerinden mevcut motor | Yazma iş yükünü ayırabilecek ürün özelliği; ayrı compute aynı branch depolamasını okur. Ancak replica yaratmak backup credential'ının primary'ye girişini veya diğer DB okumalarını engellediğini kanıtlamaz. Branch kapsamlı rol için primary erişim sınırı ayrıca ispatlanmalıdır. Replica tek başına bağımsız arşiv değildir; mevcut host/profile guard'ları da bunu onaylamıyor. [Replica mimarisi](https://neon.com/docs/introduction/read-replicas), [rol kapsamı](https://neon.com/docs/manage/roles). |
| Provider PITR / snapshot / yeni branch | Provider içi kurtarma imkânıdır; bağımsız anahtar ile dışarı alınmış, provider hesabı kaybında kurtarılabilir şifreli kopya kanıtı değildir. Kaydedilmiş planın restore penceresi6 saat. Snapshot/branch üretmek bu görevin dışında; bağımsız taşınabilir arşiv kabulü yok. [Neon snapshot modeli](https://neon.com/blog/three-ways-to-use-your-snapshots). |
| Provider destekli rol+database erişim sınırı veya denetlenmiş bağlantı aracısı | PUBLIC nesne ACL'lerini değiştirmeden bir çıkış yolu **olabilir**; fakat elde bu projeye uygulanmış, backup credential'ının doğrudan host/primary/başka DB kaçışını kapatan ürün/konfigürasyon kanıtı yok. Yalnız IP/host allowlist aynı host'taki DB ayrımını kanıtlamaz; CLI database seçimi de sınır değildir. Yeni proxy geliştirme önerilmiyor. Provider'ın desteklenen somut mekanizma ve kapsamını belirtmesi gerekir. |

Bu seçenek için eksik karar dar ve somuttur: **Provider, bu sabit development branch'te postgres PUBLIC haklarına dokunmadan backup hesabını yalnız kaynak DB'ye ve gerekli okuma yetkilerine gerçekten sınırlayan uygulanabilir bir mekanizma sunabiliyor mu?** Olumlu yanıt, uygulanabilir konfigürasyon/rol modeli ve bağımsız kabul kanıtı içermeli; yalnız “readonly role destekleniyor” yanıtı yeterli değildir. Böyle bir sınır desteklenmiyorsa A mevcut şartlarla BLOCKED kalır. UNKNOWN provider rutinlerini otomatik allowlist'e almak veya guard kaldırmak çıkış yolu değildir.

## B — Ayrı izole Neon projesi

Yeni proje mevcut proje verisine ait rol/credential etki alanını ayırabilir; **yeni projenin kendi cross-DB sorununu ortadan kaldırdığı kanıtlanmış değildir**. Neon'da her branch kendi database/rol/compute kaynaklarını içerir; SQL rolü ile Console/API/CLI rolü aynı yetki modeli değildir. Console/API/CLI rolü neon_superuser üyeliği alır, dar rol yine SQL ile kurulmalıdır. [Proje modeli](https://neon.com/docs/manage/projects), [resmi rol modeli](https://neon.com/docs/manage/roles).

Yeni projede postgres/template1 ve PUBLIC varsayılanlarının, provider view/rutinlerinin tekrar bulunması makul bir risktir; **bu projede gözlenmiş veya yokluğu garanti edilmiş sayılmaz**. Aynı provider başlangıç modeliyle yalnız proje adını değiştirmek çözüm değildir. Yeni proje oluşturulmadan önce farklı güvenlik sınırını sağlayan desteklenen konfigürasyon için provider kanıtı gerekir; aksi halde aynı engeli veri taşıma yüküyle birlikte tekrarlarız. Proje ayrıca mevcut kaynağın export engelini çözmez: gerçek kullanıcı verisini koruyarak taşıma da yetkili, tutarlı kaynak çıkarımı ister.

Yeni proje canlı uygulama hedefi olacaksa güvenli veri taşıma/cutover gerekir. Yalnız restore hedefi olacaksa mevcut kaynak hesabı ve export engeli aynen kalır. İkisi de tek başına B'yi uygulanabilir çözüm yapmaz. `ISOLATED_PROJECT_CANDIDATE` seçebilmek için gereken ayırt edici provider kanıtı şu an yoktur.

## Mevcut çalışmalara ve takvime etkisi

| Alan | A — Mevcut proje | B — Yeni proje |
| --- | --- | --- |
| K1–K5 / M017 kaynak kodu | Korunur; kaynak motoru ve yerel kabul yeniden kullanılır. Gerçek rol/host kabulü hâlâ gerekir. | İş mantığı yeniden yazılmaz; yeni hedef bağlantıları, rol adları/sahiplik ve güvenlik pinleri bağımsız incelenir. Eski endpoint kimliği yeni hedefe taşınmaz. |
| Migration001–017 / resolved008 | SQL/checksum değişmez. Mevcut15 başarılı + resolved008 korunur. Gerçek pre016 yedek kabulünden sonra ayrı onayla016 →017 sırası;47/33 ve56/42 bağımsız post kabulü gerekir. | Veri restore yolu ile boş DB'ye001–017 apply yolu karıştırılmaz: restore edilen geçmişin üstüne migration'lar yeniden uygulanmaz. Yeni boş şema kurmak mevcut kullanıcı verisini taşımaz. resolved008 ve gerçek migration kayıtları korunmalı; geçmiş sahte resolve/replay ile eşitlenmez. Owner/ACL silen blanket no-owner/no-acl yaklaşımı güvenlik kabulü değildir. |
| Auth / MFA | Mevcut kimlikler, scope/rol modeli ve secrets korunur. Tam yedek Auth/MFA/session verisini de içerdiğinden gerçek export ayrıca hassas veri onayı ister. | Uygulamanın Auth/MFA modeli korunur; Neon'un başka Auth ürününe geçiş yok. Kullanıcı ID/hash, MFA şifreli alanları ve gerekli bağımsız uygulama anahtarlarının kurtarılabilirliği doğrulanmalı. Session/token iptali veya korunması açık cutover kararı olmalı; sessiz MFA sıfırlama yapılamaz. |
| Kullanıcı / muhasebe verisi | Veri taşıma yok; gerçek export/restore bütünlüğü henüz kanıtlanmadı. | Tüm tenant/company/activity, journal/allocation/fund kayıtları ve audit geçmişi tutarlı taşınmalı; son yazı sınırı ve kontrollü cutover olmadan kayıp/çift işlem riski var. Kaynağı silmek veya boş veriyle başlamak çözüm sayılmaz. |
| Backup / recovery | Mevcut motor kullanılır; pre01640/26 → post01647/33 → post01756/42 kapsamı korunur. Anahtar custody, şifreli offsite ve ayrı gerçek restore kabulü eksik. | Aynı motor ve aynı kabul gereksinimleri; ayrıca yeni projenin rol/global ACL kurulumu ve yeni hedefte restore kanıtı gerekir. İkinci proje tek başına bağımsız offsite değildir. |
| Test / kabul | Tarihsel497 test ve yerel restore matrix'i destekleyici; gerçek rol effective ACL, kaynak şema/veri hash, ownership/RLS/function ACL, key/offsite/restore ve işletme kabulünün yerine geçmez. | A'nın kontrollerine ek yeni provider/host pinleri, migration geçmişi/ownership, Auth/MFA ve uçtan uca veri cutover regresyonları gerekir. Eski fixture başarıları yeni projeye READY vermez. |
| Maliyet / operasyon | Yeni proje/cutover maliyeti yok. Provider destek bedeli, olası ücretli izolasyon/replica, compute/transfer, R2 ve restore çalışması bütçelenmeli; teklif/kullanım bilinmiyor. | Ek kaynak/compute/storage/transfer, geçici çift çalışma ve işletim zamanı; free kota uygunluğu veya sıfır toplam maliyet varsayılmaz. Aynı provider engeli tekrarlanırsa ek maliyet çözüm üretmez. |
| 29 Ekim | En kısa aday; provider sınırı kararı + gerçek backup/restore kabulüne bağlı. Tamamlanma tarihi taahhüt edilemiyor. | Güvenlik engeline ek provisioning, veri taşıma ve cutover testleri var; altı günlük aralıkta daha uzun ve kanıtlanmamış yol. |

## Maliyet dayanağı ve kritik yol

23 Ekim resmi fiyat sayfası Free için1 GB/proje,100 CU-saat/proje/ay; Launch için **$0.106/CU-saat + $0.35/GB-ay** gösteriyor. Örneğin tek0.25 CU compute24×30 saat açık kalırsa compute yaklaşık **$19.08/ay** eder; bu yalnız Launch birim fiyatıyla hesap, teklif veya mevcut free_v3 faturası değildir. İkinci aktif compute aynı kullanımda ek tutar doğurur; storage/transfer/history/R2/vergiler dahil değildir. Hesabın boş proje kotası veya yeni ücretli özellik yetkisi ölçülmedi. Önceki API kanıtındaki mevcut0.25 CU, free_v3 ve6 saat retention değerleri güncel fiyat sayfasıyla değiştirilmedi. [Resmi fiyatlar](https://neon.com/pricing).

**23 →29 Ekim: altı takvim günü. Kritik yolu proje yaratma hızı değil, güvenli kaynak erişimi ve gerçek bağımsız kurtarma kabulü belirliyor.** Önce A için yukarıdaki tek provider/erişim sınırı kararı gerekir; olumsuz veya kanıtsız yanıtta sırf takvim için B'ye geçilmez. B ancak farklı ve uygulanabilir güvenlik sınırı önceden gösterilirse yeniden karar adayı olur.

Ardından ayrı açık yetkilerle dar NOLOGIN kurulum/post kabulü → LOGIN/credential kabulü → pre016 tam gerçek kaynak export + bağımsız anahtar → şifreli offsite ve ayrı gerçek restore kabulü gerekir. Bu zincir kapanmadan016/017 bulut uygulaması önerilmez; uygulama ayrıca ayrı onay ister. Sonrasında016 →017 bağımsız kabulü,56/42 kapsamlı yeni yedek ve ZY Reklam gerçek işletme kabulü gerekir. RPO/RTO ve sorumlu kişi kabulü olmadan backup varlığı canlı kullanım güvencesi sayılmaz. `ROLE_DELTA_UNRESOLVED` ayrıca açık kalır.

Bu görev yalnız bu raporu ekler. Yeni proje/branch/snapshot, SQL/rol/ACL/migration, veri export/kopyalama, R2/restore veya Git commit/push yapılmadı. API anahtarı okunmadı/yazılmadı; `.env.local`,001–017 SQL, mevcut kullanıcı değişiklikleri ve bütün guard'lar korundu. Test/build tekrar çalıştırılmadı; önceki sonuçlar tarihsel kabul olarak kullanıldı. **GO_LIVE_PASS verilmez.**
