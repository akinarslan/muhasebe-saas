# Sprint V4.2d.3 — Gerçek snapshot preview restore denemesi

19.10.2026 · `feat/pusula-v030-neon-cloud` · **BLOCKED — provider restore tamamlandı; PostgreSQL doğrulaması başarısız.**

## Sonuç ve kanıt sınırı

Onaylanan snapshot'tan gerçekten yeni bir preview branch oluşturuldu. Neon'un döndürdüğü beş operation tamamlandı, hedef ready oldu. Ardından yalnız bu hedefe sabitlenen salt okunur doğrulama denemesi `RESTORE_SQL_FAILED` ile durdu. **RESTORE_PASS verilmez.** Başarılı provider işlemi, PostgreSQL şema/Auth/veri bütünlüğü kabulü değildir.

Durma talimatı uygulandı: SQL tekrarlanmadı, yeni restore isteği gönderilmedi, finalize/reset/rename veya otomatik düzeltme yapılmadı. Hedef otomatik silinmedi. Sonraki işlemler için bu başarısızlığın güvenli tanısı gerekir.

## 1. Ön kontrol ve Free kapasitesi

13:57:17.493Z / İstanbul16:57:17.493 salt okunur GET/list:

| Kontrol | Sonuç |
| --- | --- |
| Proje | `pusula-development`, `icy-queen-44442204` |
| Abonelik | API owner.subscription_type=`free_v3`; branches_limit=10; ADMIN metadata erişimi |
| Kaynak | `development`, `br-rough-darkness-ba6ow9zo`, ready |
| Production | `br-autumn-union-baaldt81`, ready; yalnız provider metadata, SQL bağlantısı yok |
| Hedef adı | `pusula-v42-restore-verification` önceden yok |
| Branch / snapshot | 2/10 branch,1 snapshot; doğru snapshot ID/kaynak/zaman eşleşti |
| Operation | Dönen64 kaydın tamamı finished; listelenen bekleyen/çakışan işlem yok |
| Compute |5478 CU-saniye, yaklaşık1.522 CU-saat;100 aylık Free sınırının altında |
| Storage | Kaynak logical_size54,370,304 byte; production31,686,656 byte; snapshot full_size54,370,304 byte. Proje branch logical limit1,073,741,824 byte. Bunlar toplam faturalama storage ölçümü değildir. |

Operatörün Console teyidi: Free$0,1GB limit,54.37MB storage,1.74MB history,1.41/100CU-hour,2/10branch ve1/1snapshot. Güncel API planı, mantıksal boyutları ve compute miktarı bu düşük kullanım değerlendirmesiyle uyumlu bulundu; eksik storage metriklerinden0 kullanım sonucu çıkarılmadı. Yeni snapshot alınmadı. [Free fiyatlandırma](https://neon.com/pricing) ile desteklenen mevcut plan içinde tek preview restore yapıldı; upgrade/ödeme isteği veya ücretli plan açılması olmadı. Sonradan tüketim artışı gecikmeli raporlanabileceğinden maliyet/tüketim için sıfır artış garantisi verilmez.

## 2. Gerçek restore isteği ve operation sonucu

[Güncel resmî REST sözleşmesi](https://api-docs.neon.tech/reference/restoresnapshot) incelendi. Tek POST13:58:07Z civarında gönderildi; otomatik retry yok. Gönderilmeden önce Git dışı exclusive attempt kaydı oluşturuldu; aynı script ikinci kez çalıştırılırsa yerel kayıt engeller.

```http
POST /api/v2/projects/icy-queen-44442204/snapshots/snap-frosty-sky-bav0qeo6/restore
Content-Type: application/json

{"name":"pusula-v42-restore-verification","target_branch_id":"br-rough-darkness-ba6ow9zo","finalize_restore":false}
```

Yeni branch ID API yanıtından alındı; kaynak/production/önceden mevcut bütün ID'lerden farklı ve adı istenen adla aynı. `target_branch_id` restore bağlamıdır; yeni preview ID'si yanıttadır. Provider yeni endpoint'i de kendisi oluşturdu; ayrıca endpoint CREATE yapılmadı. Finalize çağrısı yapılmadı.

| Nesne / işlem | Gerçek sonuç |
| --- | --- |
| Yeni branch | `br-patient-block-bald8u59` |
| Ad | `pusula-v42-restore-verification` |
| Yeni endpoint | `ep-curly-base-ba5jc1c2`, yalnız yeni branch'e bağlı |
| create_branch | `0f53d86a-6c4f-4572-9c2f-b9ea4bc2c3b1`, finished13:58:08Z |
| start_compute | `b7ede91f-193a-4e33-98f5-b87785fc273f`, finished13:58:09Z |
| timeline_unarchive | `fd1d070f-51a9-46cc-b415-80de79689dbd`, finished13:58:08Z; provider snapshot iç timeline'ı `br-lingering-tree-babm4cks` üzerinde |
| epc_sync | `c4fa2454-d1c4-4267-baf1-89f83fbc6b75` ve `13c443a0-349a-4eab-98a9-81bfd3b470c3`, finished13:58:09Z |

13:58:19Z GET hedef ready, yeni endpoint active gösterdi. Provider operation başarısı doğrulandı; SQL erişilebilirliği ayrıca başarısız kabul kapısıdır. Unarchive işlemi yeni kullanıcı branch'i diye sayılmadı; kaynak development veya production ID'si değildir.

## 3. PostgreSQL doğrulama denemesi ve hata

Hedef metadata'sı yeni ID/ad/ready ile, endpoint de yeni branch ID ve0.25CU üst sınırıyla doğrulandı. CLI'den yalnız bu branch/DB/rol için bağlantı alındı; çıktı terminale aktarılmadı. URL host'u provider endpoint host'una, direct bağlantıya, `pusula_development` DB ve `neondb_owner` rolüne sabitlendi. Hedef URL verify-full talep ediyor; node-postgres ayrıca güvenilir mevcut CA, rejectUnauthorized=true ve hedef hostname/servername kullanacak şekilde kuruldu. Kaynak URL allowlist'i değiştirilmedi, migration runner çalıştırılmadı.

Geçici hedef yapılandırması `.data/v42d3-private/target.json` içinde Git dışındadır. Yazılmadan önce üst dizine yalnız mevcut kullanıcı ve SYSTEM için explicit FullControl, inheritance kapalı ACL uygulandı. İlk sandbox ACL denemesi başarısızdı; yetkili yerel çağrıda ACL başarıyla uygulanıp doğrulandı. TLS veya Windows koruması kaldırılmadı. Normal `.env.local` yalnız mevcut CA yolunu almak için belleğe okundu, içeriği değiştirilmedi; kaynak URL ile DB bağlantısı kurulmadı.

13:59:52.300Z doğrulama süreci exit1 verdi:

```json
{"status":"BLOCKED","code":"RESTORE_SQL_FAILED","branch":"br-patient-block-bald8u59"}
```

**Tanı sınırı:** Geçici doğrulayıcının hata sınıflandırması asıl exception/SQLSTATE ve başarısız alt aşamayı güvenli kayda korumadı. Bu tanı eksikliğidir; kesin TLS, parola, permission, provider veya schema hatası iddia edilemez. Yapılandırma dosyasının oluştuğu biliniyor; başarılı SQL sonuç dosyası oluşmadı. Doğrulayıcıya TLS/ACL/şema kontrollerini geçersiz kılacak değişiklik yapılmadı. Talimata uygun olarak başarısız denemeden sonra SQL tekrarı veya otomatik kurtarma yapılmadı. Sonraki adım, aynı hedefte ayrı onayla güvenli aşama/SQLSTATE tanısıdır; yeni branch veya restore gerektirdiği henüz bilinmiyor.

Doğrulayıcı yalnız READ ONLY transaction, katalog, migration metadata, toplu sayım ve FK ihlal sayısı sorguları içerir. Parola/hash/TOTP/recovery/session/customer/finansal tutar kolonlarını seçmez. Gerçek web uygulaması, Auth login, e-posta, webhook veya scheduler hedefe bağlanmadı.

## 4. Başarılı / başarısız / tamamlanmamış kabul tablosu

| Kontrol | Durum |
| --- | --- |
| Tek gerçek snapshot restore ve yeni farklı branch ID | PASS, provider API |
| Beş operation finished, hedef ready | PASS, provider API |
| Minimum uygun compute | PASS, provider otomatik endpoint min=max0.25CU; yeni ücretli plan yok |
| TLS verify-full yapılandırması | Hazırlandı; başarılı TLS handshake kanıtı yok, PASS sayılmaz |
| PostgreSQL salt okunur doğrulama koşusu | FAIL/BLOCKED, RESTORE_SQL_FAILED |
| Restore edilmiş gerçek PG sürümü | Doğrulanamadı; proje major18 ve önceki kaynak18.6 hedef sunucu kanıtı değildir |
|13 başarılı checksum / resolved008 /014pending | Hedef için tamamlandığı kanıtlanmadı |
|35 tablo/21FORCE RLS | Hedef için tamamlandığı kanıtlanmadı |
| FK/composite/index/constraint/trigger/function/policy/ACL | Hedef doğrulaması tamamlanmadı |
| AuthUser/Membership/Master ve iş tablo sayımları | Hedef sonucu yok; kaynak sayıları hedef sonucu diye kopyalanmadı |
| Tenant/legal entity/activity, USD/history/immutable snapshot ilişkileri | Tamamlanmadı; içerik eşitliği veya tam restore başarısı iddiası yok |
| Supplier migration014 uygulanması | ÇALIŞTIRILMADI; bu sprint yasak |
| Test suite/build/lint | Uygulama kodu değiştirilmedi, yeniden çalıştırılmadı; D1 sonuçları tarihsel kalır |

D1 kaynak referansı11:52:12.917Z, snapshot11:03:46Z'den sonradır. Gelecekteki hedef sayımlarının birebir eşleşmesi varsayılmaz. Snapshot anı kayıt içeriği bu sprint okunmadı.

## 5. Kaynak koruması ve son durum

14:00:40.902Z / İstanbul17:00:40.902 son GET:

| Korunan kaynak | Önce / sonra |
| --- | --- |
| Development | `br-rough-darkness-ba6ow9zo` / aynı; adı development ve ready |
| Development endpoint bağı | `ep-blue-breeze-bavbjb7l` → development / aynı; idle, min=max0.25CU ayarı aynı |
| Production | `br-autumn-union-baaldt81` / aynı; adı production ve ready |
| Production endpoint bağı | `ep-soft-surf-baowiyco` → production / aynı; idle, min0.25/max2CU ayarı aynı |
| Kaynak DB envanteri | neondb / pusula_development / pusula_sprint_b_test, owner adları aynı |
| Snapshot | Aynı ID/ad/kaynak/zaman/full_size; listede korunuyor |
| Operation |64→69; beş yeni restore ilişkili operation finished, listelenen unfinished yok; source/prod move/rename/finalize işlemi gözlenmedi |

Bu provider metadata'sı kaynak branch/endpoint kimlik ve bağlarının korunduğunu kanıtlar; tüm kaynak satırlarının içerik eşitliğini kanıtlamaz. Kaynak/test/production SQL bağlantısı açılmadı; DML/DDL/rol/migration/restore/reset/finalize veya R2 işlemi yapılmadı. Master/MFA değiştirilmedi.

**Yeni branch kalıyor:** `br-patient-block-bald8u59`, ready. Endpoint `ep-curly-base-ba5jc1c2` son gözlemde active, min=max0.25CU, suspend_timeout_seconds=0 (provider varsayılanı; ayar değiştirilmedi). Otomatik suspend politikası değiştirilmedi; fiilî idle/suspend geçişi bu son gözlemde henüz görülmedi. Branch ve veri kopyası storage, aktif compute aylık Free bütçesi tüketebilir. Son API compute5478 sayısı gecikmeli olabilir; tatbikat ek tüketimi diye sıfır raporlanmaz. Silme/durdurma/reset işlemi otomatik yapılmadı; temizlik ayrı açık onay ister.

## 6. V4.2e için kalan engeller ve teslim

Önce mevcut yeni hedefte başarısız salt okunur doğrulamanın güvenli neden tanısı ve ardından şema/migration/RLS/Auth/ilişki kontrollerinin başarılı tamamlanması gerekir. Gerçek restore kabulü yokken014 uygulama onayı istenmez. Sonrasında taze kaynak preflight, bakım/kilit/rollback ve ayrıca açık migration onayı gerekir. SprintE gerçek backup rolü/izin ve yeni tablo allowlist/restore kabul engelleri production önkoşulu olarak sürer.

014 dosyası tekrar hash kontrolünden geçti: `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`. Uygulama kodu ve migration dosyası bu sprint değiştirilmedi. Git dışı kanıtlar: `.data/v42d3-restore-attempt.json`, `v42d3-restore-result.json`, `v42d3-final-provider.json`, `v42d3-sql-result.json`. Geçici script ve bağlantı dosyaları Git teslimine dahil edilmez.

Mimo'ya değişiklik listesi: bu rapor ve LAST_REPORT.md D3 özeti. İki teslim belgesinde yapılandırılmış yerel sırlar ve hedef URL/parolasına karşı bellek içi tarama PASS, eşleşme0; Git diff whitespace kontrolü geçti, index boş. Hedef dosya ACL'sinde yalnız kullanıcı/SYSTEM erişimi ayrıca doğrulandı. İlk yerel tarama ESM/CJS import hatası verdi; yalnız tarama script'i createRequire ile düzeltilip tekrar PASS alındı, başarısız ilk deneme başarılı sayılmadı. Önceden kalan D1/D2 değişiklikleri korunur, ayrı incelenmelidir. Codex commit/push/merge yapmadı. Mimo sır/istenmeyen dosya taramasından sonra ilgili belgeleri feature dalına teslim eder; gerçek commit/push sonucuyla `reports/PUSULA_V04_V42D3_MIMO_DELIVERY.md` dosyasını kendisi hazırlar. Henüz gerçekleşmemiş Mimo teslimi başarılı diye yazılmadı.
