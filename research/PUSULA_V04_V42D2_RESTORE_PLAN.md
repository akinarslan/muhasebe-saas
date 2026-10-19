# Sprint V4.2d.2 — Snapshot izole kurtarma planı

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `a88fa0c` korunur.

## Karar

**Plan hazır; gerçek kurtarma yapılmadı. Branch sayısı açısından yer var. Fiilî storage/restore kapasitesi doğrulanamadığından uygulama kapısı BLOCKED.** Snapshot'ın listelenmesi, içeriğinin okunabildiği veya başarılı restore yapılabildiği anlamına gelmez. Ücretli kaynak açılmayacak. Kota eksikliği giderilmeden kaynak oluşturma onayı istenmez.

## 1. Bağımsız provider metadata kanıtı

Mevcut Neon CLI kimliğiyle yalnız GET/list kullanıldı; TLS sistem CA doğrulaması korundu, analytics kapatıldı. Yeni SQL bağlantısı açılmadı. 2026-10-19T12:59:52.891Z (İstanbul 15:59:52.891) gözlemi:

| Konu | Gözlem / sınır |
| --- | --- |
| Proje | `pusula-development` / `icy-queen-44442204`, AWS eu-central-1 |
| Kaynak | `development` / `br-rough-darkness-ba6ow9zo`, current_state=ready |
| Snapshot | `snap-frosty-sky-bav0qeo6`, `pusula-v42-before-supplier-migration` |
| Snapshot kaynak ID | Onaylı development ID ile aynı |
| Oluşturulma | `2026-10-19T11:03:46Z`, İstanbul 14:03:46 |
| Expiration / kullanılabilirlik | Listede expires_at/status/state alanı yok. Never operatör beyanıdır; API ile bağımsız doğrulanmadı. Kaynak ready olması snapshot restore-readiness kanıtı değildir. |
| Branch sayısı | 2: development ve `production` / `br-autumn-union-baaldt81` |
| Hedef ad çakışması | `pusula-v42-restore-verification` mevcut listede yok |
| Snapshot sayısı | 1 |
| Kaynak DB envanteri | Provider listesi: neondb, pusula_development, pusula_sprint_b_test. Bu snapshot-anı içerik listesi değildir; sistem DB'leri için eksiksiz envanter iddiası yok. |
| History | 21600 saniye; snapshot expiration ile aynı kavram değildir |

Git dışı kanıt: `.data/v42d-provider-audit.json`, `.data/v42d2-quota.json`. Önceki 11:35:54Z listesinde manual=true ve full_size=54,370,304 byte vardı; yaklaşık 51.85 MiB. Bu tarihsel değer güncel toplam proje storage/kalan kota değildir.

Snapshot branch kapsamlı veri kurtarma mekanizmasıdır. Kaynak branch'teki veritabanları ve içlerindeki Pusula Auth/Master/MFA kayıtları hassas kopya olarak değerlendirilmelidir. Snapshot zamanında hangi kayıtların bulunduğu metadata ile doğrulanamaz. Rol kataloğu/üyelik/owner ve login kullanılabilirliği hedefte ayrıca doğrulanacak; provider builtin rolleri veya kimlik bilgileri için birebir eşitlik varsayılmaz. Git, uygulama env, R2 ve haricî servis ayarları bu PostgreSQL kurtarmasının parçası sayılmaz. [Snapshot API](https://api-docs.neon.tech/reference/restoresnapshot), [branch ve rol kapsamı](https://neon.com/docs/manage/roles).

## 2. Kota, kapasite ve maliyet

[Resmî fiyatlandırma](https://neon.com/pricing) Free için 10 branch/proje, 1 snapshot, 100 CU-hour/ay ve 1 GB/proje bildiriyor. Free plan mevcut operatör panel teyididir; bu GET yanıtı plan adını göstermedi. İki branch sonrası bir yeni hedef 3/10 olur; snapshot çoğaltılmayacağı için 1/1 kalır. Branch kotası teorik olarak yeterlidir; tenant/hesap özel limitinin uygulanabilirliği restore çağrısı yapılmadan kesin kabul edilmez.

13:00:18.966Z proje GET: PG major18; dönem 16.10.2026T10:34:55Z–01.11.2026T00:00:00Z; compute_time_seconds=5164 (yaklaşık1.434 CU-hour), active_time_seconds=20520. Active time CU-hour değildir. Settings içinde quota alanı dönmedi. synthetic_storage_size ve data_storage_bytes_hour sıfır geldi; [güncel OpenAPI](https://neon.com/api_spec/release/v2.json) bu eski storage metriklerinin deprecated ve daima0 olduğunu belirtir. **Sıfır storage/kesin boş kota sonucu çıkarılmaz.** Güncel toplam storage, restore için gereken ek alan ve hesaba özel kalan kapasite kanıtlanmış değildir.

Yeni hedefin compute'u proje bütçesini tüketir; storage kopyası/snapshot materyalizasyonu ek alan gerektirebilir. Snapshot full_size tek başına bunun hesaplaması değildir. Free içinde kalırsa beklenen fatura $0; garanti verilmez. Plan yükseltme/ödeme/limit aşımı uyarısında durulacak. Ortak proje kotasının tükenmesi mevcut compute'ların çalışmasını etkileyebilir; branch izolasyonu kaynak tüketimini izole etmez. Bu nedenle mevcut compute miktarı düşük görünse de storage kapısı atlanmaz. Kısa çalışma, mümkün olan en küçük uygun compute, otomatik suspend ve süre sınırı gelecek onay kapsamına alınmalı; kaynak endpoint ayarı değiştirilmeyecek.

**Eksik:** Console Usage/Limits üzerinden bu projenin halen Free olduğu, güncel kullanılan/kalan storage ve restore/ek compute için ödeme gerekmediğinin sır içermeyen teyidi. Gerekirse sağlayıcı desteğiyle snapshot preview branch kotası doğrulanmalı. Bu görevde upgrade veya kaynak oluşturma yapılmadı.

## 3. Desteklenen API sırası ve izolasyon

[Restore API](https://api-docs.neon.tech/reference/restoresnapshot) snapshot'tan yeni branch döndürür. `target_branch_id` mevcut restore bağlamını belirtir ve varsayılanı snapshot kaynağıdır; henüz oluşturulmamış yeni hedef ID'si değildir. Yeni kopyanın ID'si yanıttan alınır. Önce boş branch oluşturup üstüne restore yapılacağı varsayılmayacak.

[Finalize API](https://api-docs.neon.tech/reference/finalizerestorebranch) compute'ları taşır/restart eder ve eski/yeni branch adlarını değiştirir. **Bu tatbikatta finalize yoktur.** false yalnız preview aşamasını seçer; tek başına hedef doğrulaması, kaynak endpoint koruması veya kapasite izolasyonu sağlamaz.

Yalnız gelecek açık onaydan sonra uygulanacak sıra:

1. GET ile proje/plan/kota, snapshot, tüm branch adları, kaynak endpoint kimlikleri ve bekleyen operation durumlarını tekrar kontrol et. Hedef adı varsa veya kaynak/snapshot/limit değişmişse dur. Production'a DB bağlantısı açma.
2. Kaynak branch/endpoint kimliklerini değişmez referans olarak güvenli yerelde kaydet. Snapshot source ID eşleşmesini zorunlu kıl. Belirsiz API sözleşmesinde sağlayıcı teyidi olmadan çağrı yapma.
3. Aşağıdaki **planlanan, çalıştırılmamış** istek yalnız bir kez gönderilir; CLI restore varsayılanlarına güvenilmez:

```http
POST /api/v2/projects/icy-queen-44442204/snapshots/snap-frosty-sky-bav0qeo6/restore
Content-Type: application/json

{"name":"pusula-v42-restore-verification","target_branch_id":"br-rough-darkness-ba6ow9zo","finalize_restore":false}
```

4. Dönen yeni branch ID'sinin kaynak ve production dahil önceki bütün ID'lerden farklı olduğunu ve istenen adı taşıdığını doğrula. Operation ID'lerini GET ile başarıya kadar izle. Timeout/yanıt kaybında otomatik POST retry yok; önce GET envanteriyle uzlaştır, belirsizlikte dur. Yeni branch ID doğrulanmadan hiçbir SQL açma.
5. Kaynak branch/endpoint ID ve bağlarını tekrar GET ile karşılaştır. Move/rename/finalize/reset/compute reattach yasak. Kaynak, production ve kaynak içindeki mevcut test DB üzerinde değişiklik yapılmaz. Snapshot'ın test DB kopyası hedefte bulunabilir; bu orijinal test DB'nin değişmesi değildir.
6. Yeni branch'te endpoint yoksa yalnız yeni ID'ye bağlı geçici compute oluşturulması da gelecek onayda açıkça kapsanmalı. Yeni endpoint ID/host/branch bağını doğrula; kaynak compute'u kullanma. Provider preview branch'te SQL erişimini finalize şartına bağlarsa dur; finalize ile devam etme.
7. Ayrı, Git dışı ve sınırlı erişimli restore hedef yapılandırması kullan. Normal `.env.local` değişmez. Direct hedef, proje/branch/endpoint/DB kimliği ve TLS verify-full/CA doğrulanır. Mevcut migration runner'ın kaynak host allowlist'i gevşetilmez; hedefe özel salt okunur kontrol gerekir.
8. Doğrulama sonunda yeni hedefin durumu raporlanır. Mevcut görevde silme yoktur; gelecekte temizlik gerekiyorsa yalnız kaydedilen yeni ID için ayrıca açık kapsam/onay gerekir. Snapshot ve eski branch'ler korunur. Ücret/kapasite veya kimlik belirsizliğinde dur; düzeltmek için kaynağa yazma.

Bu model kaynak SQL verilerini yerinde geri almaz. Ancak provider davranışı ve veri okunabilirliği gerçek tatbikatla kanıtlanana kadar kaynak korunması tasarım güvencesidir, gerçekleşmiş sonuç değildir. Snapshot restore ve history/PITR farklı işlemlerdir; [Instant restore belgesi](https://neon.com/docs/postgres/backup-restore/branch-restore) root-branch kısıtlarını açıklar. Preview hedef için sonraki PITR desteği varsayılmayacak.

## 4. Gelecekte gerçek restore sonrası kabul

Provider operation success, yeni branch ready ve yalnız yeni endpoint üzerinden READ ONLY transaction doğrulanmalı. PG18.6 istemci uyumluluğu ve gerçek sunucu sürümü kaydedilmeli. Aşağıdaki kontroller henüz çalıştırılmadı:

| Kontrol | Kabul / kanıt sınırı |
| --- | --- |
| Migration geçmişi | 13 başarılı checksum; resolved008 rollback kaydı korunur;014 pending ve Supplier tabloları yok. Snapshot daha eskiyse fark araştırılır, migration uygulanarak düzeltilmez. |
| Şema | Beklenen35 tablo/21 FORCE RLS; FK, index, trigger, function, policy ve ACL katalog fingerprint'leri baseline ile karşılaştırılır. Eksik/başka nesnede dur. |
| İlişkiler | Tenant/legal entity/activity ve FK orphan kontrolleri yalnız toplu ihlal sayısı; satır içerikleri yok. |
| İş/Auth kapsamı | Müşteri, malzeme, fiyat geçmişi, teklif, satış, AuthUser/Membership dahil tablo sayımları; yetki/owner/üyelik ve Master rol-permission yapısı, scoped DENY korunması katalog/toplu sonuçlarla kontrol edilir. |
| Finansal bütünlük | USD fiyat geçmişi, satış snapshot referansları, immutable trigger yapısı ve tutarlılık ihlal sayıları; fiyat veya müşteri içeriği raporlanmaz. Sıfır kayıtta davranış testi geçti denmez. |
| RLS / erişim | FORCE RLS bayrakları, policy tanımları ve runtime efektif izinleri. Gerçek tenant/session tokenıyla uygulama açılmaz; veri değiştiren canlı negatif test yapılmaz. |
| Kaynak koruması | Önce/sonra kaynak branch/endpoint bağı ve provider işlemleri; kaynak veride eşitlik iddiası yalnız metadata ile kurulmaz. |

D1 gerçek preflight referansı **11:52:12.917Z**: PG18.6,35/21,13 başarılı,014pending; AuthUser2/Membership2 ve Customer/Material/MaterialVariant/MaterialPriceHistory/CloudProduct/CloudQuote/CloudSale/CloudSaleLine0. Bu snapshot zamanı11:03:46Z'den sonradır; snapshot-anı veri eşitliği kanıtı değildir. Fark varsa sonraki meşru değişiklik ile kayıp ayrı araştırılır; otomatik düzeltme yok. İçerik/SHA kanıtı alınmamışsa sonradan tam içerik eşitliği iddia edilmez.

Auth/MFA verisi hedefte de gerçek hassas veridir. Web uygulaması, Auth endpoint'i, e-posta, scheduler, webhook veya normal kullanıcı oturumları hedefe bağlanmayacak. Parola/hash/TOTP/recovery/session token kolonları seçilmeyecek, secret env/CLI argümanı/log/rapor/Git'e konmayacak. Haricî Better Auth/Neon Auth servis yapılandırması otomatik kurtarıldı sayılmaz. Hedefe özgü kısa ömürlü erişim ayrı tutulur; login sorunu varsa kaynak rol parolası değiştirilmez.

## 5. On kabul sorusuna açık yanıt

1. **Snapshot doğru/erişilebilir mi?** Metadata GET ile ID, ad, proje, kaynak ve zaman eşleşti. Veri okunabilirliği/status/expiry bağımsız kanıtlanmadı.
2. **Hedef oluşturulabilir mi?** API destekliyor; isim boş ve standart branch kotasında yer var. Başarılı oluşturma ve fiilî kapasite henüz kanıtlanmadı.
3. **Kaynak korunabilir mi?** Ayrı preview ID/endpoint, finalize yasağı ve önce/sonra bağ kontrolüyle planlandı; henüz tatbikat sonucu yok.
4. **Free yeterli mi?** Branch/snapshot sayısı açısından evet; storage ve hesap özel restore kapasitesi açık kapı. Tam hazır sonucu verilmez.
5. **Ek maliyet?** Free sınırında beklenen$0; compute/storage ortak bütçe tüketir. Ödeme/yükseltmede durulur; maliyet garantisi yok.
6. **API sırası?** GET önkontrol → açık false ile snapshot restore → dönen yeni ID/operation GET → yalnız yeni endpoint → salt okunur SQL → kaynak bağlarını tekrar kontrol. Finalize yok.
7. **Auth güvenliği?** Gerçek hassas kopya kabulü, ayrı secret/endpoint, verify-full, uygulama/session erişimi yok, içeriksiz katalog/sayım.
8. **Son testler?** Yukarıdaki PG/migration/35-21/ACL/FK/RLS/tenant/Auth/USD/snapshot kontrolleri. Henüz yapılmadı.
9. **Gereken onay?** Önce güncel storage/Free kapasite teyidi. Sonra yalnız mevcut snapshot'tan yeni ayrı `pusula-v42-restore-verification` branch'i, gerekiyorsa ona ait minimum geçici compute ve bu hedefte gerçek salt okunur kurtarma tatbikatı için açık onay. Finalize, kaynak değişikliği, migration ve silme bu onay dışında kalır.
10. **014 engelleri?** Gerçek kurtarma kabulü, taze guarded preflight, bakım/kilit/rollback kabulü ve ayrıca açık migration onayı. SprintE gerçek backup rolü PUBLIC TEMP/başka DB CONNECT engelleri ve35/21 backup allowlist güncelleme/restore testleri production önkoşulu olmaya devam eder; guard gevşetilmez.

## 6. Teslim ve doğrulama

014 SHA-256 bu tur tekrar eşleşti: `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`. D1 PREFLIGHT_PASS/applied=false sonucu korunur, yeni SQL koşusu gibi sunulmaz. Bu tur uygulama kodu değişmedi; test suite'leri yeniden çalıştırılmadı. Yeni branch/restore/finalize/delete/migration/GRANT/REVOKE/dump/R2 veya DB içerik okuma yapılmadı.

Mimo değişiklik listesi: yalnız bu yeni rapor ve `LAST_REPORT.md` içindeki D2 özeti. Önceden kalan D1 kod/test/rapor değişiklikleri ayrı inceleme kapsamıdır; kaybolmadı. `.data` ve `.env.local` gitignore kontrolü geçti. Codex stage/commit/push yapmadı. Mimo inceleme ve sır taramasından sonra feature dalına teslim eder; main değişmez.
