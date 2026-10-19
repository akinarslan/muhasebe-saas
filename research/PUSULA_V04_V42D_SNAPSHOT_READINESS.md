# PUSULA v0.4 — V4.2d snapshot doğrulaması ve son hazırlık

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `a88fa0c` (Mimo V4.2c.1 teslimi).

## Karar: BLOCKED — snapshot mevcut, güncel SQL preflight başarısız

**Snapshot'ın varlığı, adı, tarihi ve doğru development kaynak branch'i bağımsız CLI/API metadata'sıyla doğrulandı.** Snapshot restore edilmedi; test edilmiş kurtarma kabiliyeti iddiası yoktur. Migration runner gerçek env yükleme yolunda TypeError verdiği için yeni SQL baseline'ı alınamadı. Migration014 uygulanmamalı; bu aşamada gerçek migration onayı istenmez.

Başlangıç çalışma ağacı temizdi. Mimo'nun `a88fa0c` commit'i ve önceki teslim belgeleri korundu. Codex source/migration/runner/env dosyası değiştirmedi; yalnız bu rapor ve LAST_REPORT teslim edilir. Fetch/stage/commit/push/merge/force/hard reset yapılmadı.

## 1. Snapshot'ın bağımsız doğrulaması

Mevcut Neon CLI'nin kayıtlı kimliği kullanıldı; yeni credential oluşturulmadı. Yalnız approved proje/branch için snapshot/branch/project/database **GET/list/get metadata** çağrıları yapıldı. Bağlantı URI'si veya role password alınmadı. CLI Node sistem CA deposuyla TLS doğrulamasını korudu; analytics kapalı listeleme kullanıldı.

| Alan | Kanıt ve sonuç |
| --- | --- |
| Proje | `pusula-development` / `icy-queen-44442204`, API eşleşti |
| Branch | `development` / `br-rough-darkness-ba6ow9zo`, API eşleşti; aynı ID uygulamanın onaylı hedef sabitinde var |
| Branch durumu | API `current_state=ready`; bu, migration preflight sonucu değildir |
| Snapshot adı | `pusula-v42-before-supplier-migration`, listede tek eşleşme |
| Snapshot ID | `snap-frosty-sky-bav0qeo6` |
| Kaynak branch | `source_branch_id=br-rough-darkness-ba6ow9zo` |
| Oluşturulma | `2026-10-19T11:03:46Z` =19.10.2026 **14:03:46 Europe/Istanbul** |
| Manuel | API `manual=true` |
| Full size metadata |54,370,304 byte, yaklaşık51.85MiB; faturalanan fiziksel boyut/gerçek restore veri tamlığı kanıtı değildir |
| Snapshot sayısı | Bu proje listesinde **1** |
| Expiration | Operatör: **Never**. CLI JSON listesi expires_at/expiration alanını döndürmedi; API ile Never ayrıca doğrulanmış sayılmaz |
| Asıl gözlem zamanı | Snapshot son liste kontrolü `2026-10-19T11:35:54.534Z`; branch/proje envanteri `11:35:02.814Z` |

Git dışı kanıt: `.data/v42d-snapshot-list.json`, `.data/v42d-provider-audit.json`. Bunlar yalnız filtrelenmiş metadata içerir. Snapshot ID/branch adı eşleştirmesi snapshot içeriğinin okunabildiğini veya restore işleminin başarılı olacağını kanıtlamaz. Güncel listede ayrıca readiness/restore success alanı yoktur; listeye düşmüş olmayı test edilmiş kurtarma gibi etiketlemiyoruz.

Windows native UI helper pipe kullanılamadı; alternatif browser envanteri de boştu. Bu nedenle UI'da görünmüş gibi raporlanmadı. Mevcut CLI kimliğiyle read-only API listesi bağımsız doğrulamayı sağladı. İlk CLI denemesi başarısız oldu; Node sistem CA kullanımıyla sonraki listeleme geçti. Sertifika doğrulaması veya OS koruması kapatılmadı.

## 2. Kapsam: database, roller ve uygulama Auth verisi

[Neon Create snapshot API](https://api-docs.neon.tech/reference/createsnapshot) işlemi belirli branch üzerinde tanımlar. [Snapshot açıklaması](https://neon.com/blog/announcing-neon-snapshots-a-smoother-path-to-recovery) branch durumunun noktasal kopyasını anlatır. Bu, yalnız Supplier veya pusula_development tablolarına özel mantıksal dump değildir.

Development branch'inin **güncel API database listesi**:

| Database | API owner |
| --- | --- |
| neondb | neondb_owner |
| pusula_development | neondb_owner |
| pusula_sprint_b_test | neondb_owner |

Bu liste SQL bağlantısı açmadan alındı; hiçbir test DB'ye bağlanılmadı. API listesi sistem/template DB'lerin tam PostgreSQL envanteri değildir. Liste güncel durumu gösterir; üç DB'nin snapshot zamanında birebir bulunduğu ve içerikleri restore edilmeden bağımsız doğrulanamaz.

[Neon role belgesi](https://neon.com/docs/manage/roles) PostgreSQL rollerinin branch kapsamını ve tarihsel branch kopyasında o tarihteki rollerin önemini açıklar. Buradan SQL role/üyelik/grant/RLS/owner durumunun kurtarma kabulünde branch verisiyle beraber denetlenmesi gerektiği sonucu çıkar. **Snapshot restore API'si her provider/builtin rol niteliğinin veya parolanın birebir korunmasına dair ayrıntılı garanti vermez**; rol kapsamını başarılı restore kanıtı diye sunmuyoruz. Restore sonrası gerçek katalog/LOGIN/efektif hak denetimi gerekir; yeni veya geniş admin rolü yaratmak çözüm sayılmaz.

Neon hesap/organizasyon IAM izinleri, API tokenları, uygulama `.env.local`/AUTH_SECRET, R2 key'leri ve dış servis durumları PostgreSQL snapshot'ıyla geri döndü varsayılmaz. Pusula'nın Better Auth tabloları ile Membership/RoleAssignment/Permission/RolePermission kayıtları ise DB verisidir: snapshot noktasına dönen kopyada tarihsel durumu beklenir. AuthUser/session/account/MFA, parola değişikliği ve Master üyeliği için ilişkisel ve yetki mutabakatı ayrı gereklidir. Gerçek içerikleri bu görevde okunmadı.

## 3. Development'ı değiştirmeden ayrı preview branch

Güncel [Restore snapshot API](https://api-docs.neon.tech/reference/restoresnapshot) yeni branch'e restore ve isteğe bağlı finalize ayrımı yapar. **Gelecekteki plan**, açık `finalize_restore=false` ile ayrı restore/preview branch oluşturup kaynağa compute/endpoint taşıma veya finalize yapmamaktır. Varsayılan davranışa/CLI sürümüne güvenerek restore komutu kopyalanmamalı; source/target ID ve false seçimi önceden incelenmelidir. Bu görevde POST restore veya finalize çağrısı yapılmadı.

Bu yaklaşım development ve aynı branch'teki test DB'yi yerinde geri sarmadan kopya incelemesine imkân veren **belgelenmiş seçenek**tir. Bu hesapta restore yetkisi, geçerli branch/compute kotası ve gerçek başarı denenmedi; şu anda kullanılabilirliği test edilmiş sayılmaz. Oluşturulan kopyanın gerçek Auth/MFA/iş verilerini çoğaltacağı unutulmamalı; yalnız yetkili operatör erişimi, ayrı açık hedef allowlist ve ağ/uygulama izolasyonu gerekir. Gerçek e-posta, scheduler, ödeme veya R2 işlerini yeni kopyada başlatma.

Preview'da yalnız kaynak snapshot zamanına ait data/roles/RLS mutabakatı yapılır; mevcut production endpoint'i veya `.env.local` ona yönlendirilmez. Kaynak Master/MFA değiştirilmez. Kopyada test için session iptali/kimlik güncellemesi bile ayrı yazma onayına tabidir. Böyle bir tatbikat istenirse yeni branch + snapshot restore + hassas gerçek veri kopyası + kaynak sınırları açıkça ayrıca onaylanmalıdır; bu görev bunları onaylamaz.

[Neon Instant restore](https://neon.com/docs/postgres/backup-restore/branch-restore) branch çapında overwrite ve tüm DB etkisini açıklar. Development üzerinde yerinde restore/finalize aynı branch'teki mevcut test DB'yi de etkileyebilir; bugünkü “test DB'yi değiştirme” sınırı altında uygulanamaz. Projede API listesinde ayrı `production` branch'i de vardır; onun DB'lerine bağlanılmadı ve kaynak/target olarak seçilmedi. Snapshot preview/finalize ile history restore aynı operasyonmuş gibi ele alınmaz.

## 4. Free kotaları ve olası maliyet

Operatörün Free plan beyanı esas alınır; proje GET yanıtının filtrelenen alanlarında plan adı dönmedi. API `history_retention_seconds=21600` ile **6 saat** ayarını bağımsız doğruladı. Snapshot'ın saklanma beyanı bu kayan history penceresiyle aynı değildir; Never bilgisi sınırsız dayanıklılık/garantili erişim SLA'sı sayılmaz.

[19.10.2026 Neon fiyat sayfası](https://neon.com/pricing): Free10 branch/proje,1 snapshot,100 CU-hour/proje/ay,1GB storage; history en fazla6 saat veya1GB değişim. Güncel API listesi **2 branch ve1 snapshot** gösterdi. Standart quota varsayımıyla branch tarafında teorik8 yer vardır; gerçek özel proje limitleri, aktif işlemler ve kalan compute/storage kullanılabilirliği kontrol edilmeden kaynak açılabilir garantisi verilmez. Snapshot kontenjanı standart planda doludur; başka snapshot oluşturulmadı veya mevcut snapshot silinmedi.

Ayrı preview compute/storage/transfer tüketebilir. Kalan aylık bütçe ve faturalanacak kullanım bu görevde ölçülmedi. Free dahilinde ek abonelik öngörmeden değerlendirmek mümkün olsa da “kesin sıfır maliyet” veya sınırsız kopya iddiası yoktur. Limit aşımı/plan yükseltme ayrı onay ister. Yeni branch/snapshot/compute/ücretli servis oluşturulmadı.

## 5. Güncel migration checksum ve preflight engeli

014 dosyası, baseline manifest'i ve kullanıcı beklenen hash'i eşleşti:

`0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`

Yalnız aşağıdaki preflight çağrıldı; apply/Master/recovery bayrağı veya Prisma deploy yoktu:

```powershell
node --use-system-ca --import tsx scripts/db/migrate.ts
```

Sonuç: exit1, güvenli dış hata **MIGRATION_SAFETY_FAILED**. Git dışı tanı, **TypeError ve env loader hatası** olduğunu gösterdi. Hata `scripts/db/migrate.ts` içindeki gerçek-env `nextEnv.loadEnvConfig(...)` yolunda, target/CA/client bağlantısı kurulmadan oluştu. Bu bir Neon SQL/TLS reddi veya onay servisi engeli değildir; TypeError'dır. CA yapılandırması “eksik” diye teşhis edilmedi: env yüklenmediği için süreçte görünmemesi gerçek env içeriğinin yokluğunu kanıtlamaz.

**Önceki yerel fixture testleri bu gerçek-env yükleme yolunu atlamıştı; bu eksik test kapsamı önceki yerel PASS'ten canlı preflight PASS sonucu çıkarılmaması gerektiğini somutlaştırır.** Hata bu sprintte uygulama kodu değiştirilerek düzeltilmedi; beklenmeyen engelde BLOCKED tutuldu. Env'i başka yoldan yükleyip runner'ı atlayarak SQL bağlanılmadı. Güvenlik/allowlist/TLS/approval kapıları kapatılmadı. Runtime import/env-loader uyumluluğunun ayrı dar düzeltme ve gerçek-env giriş yolunu ağsız sınayan regresyon testi gerekir.

## 6. Güncel veri ve şema referansının durumu

| Kontrol | V4.2d sonucu |
| --- | --- |
| API branch/database metadata | Yeni referans alındı; yukarıdaki ID/liste/zamanlar |
| PostgreSQL server version | Yeni SQL ölçümü **yapılamadı** |
|35 tablo/21 FORCE RLS tam isimleri | Yeni SQL ölçümü **yapılamadı** |
| Başarılı13 checksum /008 rollback geçmişi /014 pending | Yeni SQL doğrulaması **yapılamadı** |
| PG rol/üyelik/default ACL/efektif haklar | Yeni SQL doğrulaması **yapılamadı** |
| AuthUser/Membership ve eski8 iş tablosu toplamları | Yeni sayım **alınamadı** |
| Eski kayıtların içerik korunması | Bu görev hiçbir gerçek satırı okumadı/yazmadı; migration da uygulanmadı. Önce/sonra içerik karşılaştırması yok |

Önceki V42C referansı2026-10-19T06:00:41.611Z, snapshot zamanı11:03:46Z ve bu raporun API gözlemi birbirinden farklıdır. Önceki35/21,13 checksum veya Auth2/iş0 sayıları **bugünkü snapshot/preflight sonucu olarak tekrar kullanılmaz**. Snapshot içeriği ile güncel DB'nin aynı olduğu varsayılmadı. [Önceki kanıt sınırları](PUSULA_V04_V42C_MIGRATION_READINESS.md).

Env-loader düzeltmesi sonrası gerçek read-only preflight13 başarılı uygulama/çözümlenmiş008 geçmişi,014 pending,35/21 exact pin ve rol/ACL eşleşmesini yeniden sağlamalı. Aynı repeatable-read read-only snapshot'ta AuthUser, Membership, Customer, Material, MaterialVariant, MaterialPriceHistory, CloudProduct, CloudQuote, CloudSale, CloudSaleLine sayımları ve metadata referansı alınmalı; gerçek payload/finans/MFA içeriği loglanmamalı. Bu yapılmadan son migration GO verilmez.

## 7. Uygulama sonrası38/24 kabul planı

Bu plan uygulanmadı; yalnız gelecekte açık onaylı014 sonrası içindir:

1. Exact tablo isim listesi **38**, ENABLE+FORCE isim listesi **24**; bu sprintte bunların gerçekleştiği iddia edilmez.
2.014 tek başarılı uygulama, yukarıdaki son SHA256; eski13 başarılı checksum eşleşmesi;008 eski rollback satırı korunur; unresolved0.
3. Yeni3 PK,9 composite FK,3 CHECK,14 indeks valid/ready; SupplierUnit6 değer,11 yeni policy,4 trigger,2 invoker function. Toplam policy54/trigger15/function7; approved post-schema pinleri eşleşir.
4. Runtime için Supplier/Link SELECT+INSERT+UPDATE, Offer SELECT+INSERT; DELETE/TRUNCATE ve Offer UPDATE yok. Auth ve test_runtime Supplier erişimi yok, test_runtime development CONNECT=false. PUBLIC tablo/iki function EXECUTE yok; eski ACL/owner/RLS kapsamı korunur.
5. Permission'a8 katalog kaydı ve MASTER şablonuna8 bağlantı **beklenen açık yetki genişlemesidir**. Diğer şablon/override/tenant scope/Membership/MFA değişmez. Payload gizliliği RLS sütun maskelemesi değil server cost DTO kontrolüdür.
6. Bakım penceresindeki yeni preflight referansına göre eski10 tablo sayım/metadata mutabakatı. Sayı eşitliği tek başına içerik eşitliği değildir; içerik göstermeyen onaylı bütünlük kontrolü ayrıca belirlenmeli.
7. Yeni sentetik fixture'da Supplier CRUD/link/history, iki tenant/company/activity, maliyet DENY ve revoke sonrası ret; eski USD/fiyat/sale snapshot ve Auth/RLS regresyonu. Gerçek development'a test satırı yazma veya gerçek Master/MFA testi bu görev tarafından onaylanmaz.
8. Timeout/child/hata/kısmi schema durumunda otomatik resolve/retry/restore yok; unsafe commit belirsizliği önce salt okunur incelenir. [Runner prosedürü](../docs/operations/SAFE_MIGRATIONS.md) geçerlidir; bugün env-loader engeli çözülmeden komut PASS sayılmaz.

## 8. Son onaylar ve açık engeller

Şu an migration hazır değildir. Önce runner env-loader uyumluluğu dar düzeltme+regresyonla giderilmeli ve yeni canlı read-only baseline alınmalı. Snapshot'ın listelenmiş olması, bağımsız R2 yedeği veya başarılı restore tatbikatı yerine geçmez. Expiration Never UI beyanı API'de ayrıca gösterilemedi. Snapshot'tan ayrı preview branch'e kurtarma belgelenmiş seçenektir; hesabın restore yetkisi/fiilî başarısı henüz denenmedi.

Sonraki ayrı onay kapsamları:

- Gerekiyorsa snapshot'tan **yeni izole preview branch restore**: hassas gerçek veri kopyası, quota/compute/storage ve erişim sınırlarıyla; finalize/compute taşıma yok. Bugünkü görev bu işleme izin vermez.
- Başarılı güncel preflight ve kabul edilmiş kurtarma yönteminden sonra gerçek014: source branch/DB ID, son hash, Permission+MASTER genişlemesi, yalnız runtime grant'i, bakım penceresi ve timeout/prosedür için açık onay.
- Yerinde restore/finalize, mevcut test DB veya Auth/MFA/session değişikliği, gerçek backup/R2/kalıcı key ayrı onay ister. Production hiçbirinin zımnî hedefi değildir.

Sprint E dar backup rolü/TEMP/CONNECT/builtin ownership ve35/21→38/24 allowlist/enum/function/TOC/restore incelemesi açıktır; guard'lar değiştirilmedi. Snapshot Never beyanı production backup işletimini veya bağımsız kurtarma kopyalarını tamamlamaz.

## 9. Teslim ve doğrulama

Yalnız bu yeni rapor ve LAST_REPORT.md değiştirildi; runner,014 ve diğer uygulama kaynakları korunur. TypeScript/lint/build/Vitest/fixture/browser suite'leri bu belge sprintinde yeniden çalıştırılmadı. Önceki317/317 ve yerel14/14 sonuçları tarihsel kanıttır; gerçek-env giriş hatasını kapsamadığı açıklandı. İlk CLI denemesi ve başarısız preflight başarılı sayılmadı. Yeni snapshot/branch/restore/delete/grant/migration/SQL DML/dump/R2 yoktur.

Mimo inceleme listesi:

1. `research/PUSULA_V04_V42D_SNAPSHOT_READINESS.md`
2. `LAST_REPORT.md`

Codex commit/push yapmadı. Git dışı CLI kimlikleri, `.data` yardımcıları/kanıtları ve env dosyaları eklenmez. Mimo sır/diff kontrolünden sonra yalnız belgeleri normal commit/push yapar ve ayrı `.md` gerçekleşmiş teslim raporu oluşturur; bu rapor Mimo işlemi gerçekleşmiş gibi yazılmaz.
