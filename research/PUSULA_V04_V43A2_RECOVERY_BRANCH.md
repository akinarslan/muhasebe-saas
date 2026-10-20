# PUSULA V4.3a.2 — Güncel Neon recovery branch

20.10.2026 · **RECOVERY_BRANCH_PASS**

Kullanıcının bu sprintte verdiği açık izinle, yalnız development kaynaklı bir data branch ve ona bağlı minimum compute oluşturuldu. Yeni branch üzerinde gerçek TLS doğrulamalı READ ONLY SQL erişimiyle migration015 öncesi şema/history ve belirtilen kayıt/izin ilişkileri doğrulandı. Migration015 uygulanmadı. PASS bu kopyanın erişim/katalog/veri toplamı doğrulamasıdır; uygulama trafiği geçişi, uçtan uca MFA login veya migration sonrası geri dönüş provası değildir.

## Oluşturulan kaynak

| Alan | Değer |
|---|---|
| Project | `icy-queen-44442204` / pusula-development |
| Yeni ad | `pusula-v43a-pre-migration-015` |
| Branch ID | `br-broad-river-bavv5pey` |
| Parent | `br-rough-darkness-ba6ow9zo` — development |
| Capture LSN | `0/3638E80` |
| Provider parent_timestamp | `2026-10-20T12:47:55Z` |
| Created | `2026-10-20T12:48:30Z` / 15:48:30 İstanbul |
| Endpoint | `ep-wispy-frog-ba755foo` |
| Direct host | `ep-wispy-frog-ba755foo.c-8.eu-central-1.aws.neon.tech` |
| DB | `pusula_development` — yeni branch içindeki kopya |
| Compute | read_write endpoint; min=max0.25CU; timeout0 (plan varsayılanı) |
| Son durum | Branch ready; endpoint active; bekleyen operation yok |

`POST /projects/{project_id}/branches` bir kez çağrıldı: `branch.name` yukarıdaki ad, `parent_id` açık development ID, `init_source=parent-data`; endpoint aynı istekte min/max0.25CU. parent_timestamp/LSN verilmedi; eski bir noktayı seçmek yerine API'nin güncel parent fork davranışı kullanıldı. Yanıt başarılı alındı; yeniden POST/retry yapılmadı. Şema-only, production veya eski preview kaynak seçilmedi. [Güncel resmî create sözleşmesi](https://api-docs.neon.tech/reference/createprojectbranch), [OpenAPI](https://neon.com/api_spec/release/v2.json).

## Ön kontroller ve zaman sınırı

Git dalı `feat/pusula-v030-neon-cloud`, HEAD `1c41d04d299bd49087ac36d04f88b91cf6cfbc0f`. Başlangıçta önceki V4.3a.1 sprintinin iki yeni raporu ve LAST_REPORT değişikliği vardı; korundu. Kod/SQL/env değişikliği yoktu.15 migration dosyasının SHA-256 değeri baseline ile yeniden eşleşti;015 `181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a`.

12:47:32 UTC GET envanteri: Free `free_v3`,3/10 branch; yeni ad yok; development/production/preview ID'leri ve snapshot doğru; dönen son operasyonlarda pending yok. Create öncesi aynı güvenlik koşulları yeniden GET ile kontrol edildi. Bekleyen sağlayıcı işlemi nedeniyle kör ilerlenmedi.

Kaynak SQL referansı12:48:11.979 UTC, recovery SQL12:48:37.399 UTC, kaynak son SQL12:48:53.284 UTC. Provider capture timestamp12:47:55 UTC'dir; create zamanından35 saniye, ana kaynak referansından16.979 saniye öncedir. LSN ve provider timestamp kaydedildi; oluşturma anı ile capture anı eşit sayılmadı. Kaynak/recovery sorguları arasında25.420 saniye, recovery/son kaynak arasında15.885 saniye fark vardır. Tüm38 tablo toplamı önce/recovery/son ölçümlerde eşleşti. Bu eşleşme arada aynı toplamı koruyan satır güncellemelerini dışlamaz; kaynak yazıları durdurulmadı ve tam satır/veri digest'i alınmadı. Kopya capture sonrasındaki yazıları kapsamaz.

## Gerçek SQL doğrulaması

Yeni host allowlist/branch-parent kimliği kontrol edildi; mevcut development credential'ı yalnız bellekte kullanıldı. `.env.local` veya connection secret değiştirilmedi. CA, hostname/SNI ve `rejectUnauthorized=true` ile PostgreSQL TLS bağlantısı kuruldu; istemci socket `encrypted=true`, `authorized=true`. Transaction `REPEATABLE READ READ ONLY`, statement timeout15s, sonunda ROLLBACK/connection close.

Neon proxy arkasındaki backend `pg_stat_ssl.ssl=false` döndürdü; bu değer istemci-proxy bağlantısının açık metin olduğunu göstermez. İstemci transport sertifika doğrulaması ayrıca kontrol edildi ve başarılıdır. Hiçbir TLS kontrolü gevşetilmedi.

| Kontrol | Sonuç |
|---|---|
| PostgreSQL |18.6 (653b019) |
| Tablo / FORCE RLS |38 /24 |
| History |14 başarılı, çözülmüş008 rollback1, unresolved0 |
|015 |pending; uygulanmadı |
| Schema |Sekiz fingerprint baseline ve kaynakla eşleşti |
| Tablo ACL / function ACL / roller |Kaynak önce/son fingerprint eşleşti; Supplier tabloları da dahil |
| Supplier / SupplierMaterial / SupplierOfferVersion |1 /0 /0 |
| AuthUser / Membership |2 /2 |
| MASTER membership |1 |
| Supplier izin kataloğu / MASTER ilişkisi |8 /8 (`suppliers`, `supplierMaterials`, `supplierOffers` kapsamı) |
| Tenant / LegalEntity / Activity |1 /1 /0 |
| Orphan entity / activity / membership |0 /0 /0 |
| Geçersiz veya hazır olmayan indeks |0 |
| Validate edilmemiş constraint |0 |

Tüm FK tanımları ve composite scope ilişkileri schema fingerprint içindedir; FK'ler valid, indeksler valid/ready. Tenant/legal entity/activity için anti-join orphan toplamları kontrol edildi; Activity boş olduğu için dolu activity senaryosu canlıda sınanmış sayılmaz. MASTER izin ilişkileri katalog/aggregate seviyesinde doğrulandı; gerçek kullanıcı login veya yazı testi yapılmadı. Auth/MFA tablo toplamları kopyayla eşleşti; sırlar, kullanıcı kimlikleri veya finansal tutarlar görüntülenmedi. Full satır içerik eşitliği iddiası yoktur.

## Korunan kaynaklar

Önce/sonra GET karşılaştırması:

| Kaynak | Branch ID | Endpoint ID | Sonuç |
|---|---|---|---|
| development |`br-rough-darkness-ba6ow9zo`|`ep-blue-breeze-bavbjb7l`|ID/host/type/CU/timeout aynı |
| production |`br-autumn-union-baaldt81`|`ep-soft-surf-baowiyco`|ID/host/type/CU/timeout aynı |
| eski restore preview |`br-patient-block-bald8u59`|`ep-curly-base-ba5jc1c2`|ID/host/type/CU/timeout aynı |
| snapshot |`snap-frosty-sky-bav0qeo6`|—|ID/ad/source/time/full_size aynı |

Kaynak branch reset/restore/finalize edilmedi. Production ve test DB'ye SQL bağlantısı/yazı yapılmadı; eski preview'a bağlanılmadı. Development yalnız referans READ ONLY sorgularıyla okundu; bu bağlantılar compute'u uyandırdı. Uygulama Auth/login veya kullanıcı trafiği yeni endpoint'e yönlendirilmedi. Son envanter yalnız bir yeni branch ve bir yeni endpoint içeriyor; yeni branch yaratma operasyonları tamamlandı.

## Free kullanım ve kalan kapılar

Kullanıcının Console teyidi: Free,development54.73MB,compute1.75CU-hour,branch3/10,storage sınırı1GB/proje. API yeniden teyidi: Free,development54,730,752byte,branch limiti10,storage limit alanı1,073,741,824byte,gecikmeli project compute6,576CU-saniye≈1.827CU-hour. Son durumda branch4/10; eski snapshot1/1 korunuyor. Ücretli plan veya ücretli özellik talep edilmedi; API create Free kapsamında başarılı oldu.

Toplam proje storage/kalan kapasite bu API alanlarından çıkarılamaz; development logical size toplam kullanım değildir. Önceki deprecated sıfır alanlar kullanılmadı. Free toplam storage ve compute Console'da izlenmelidir; bu sprintte sınırlı branch oluşturma kullanıcı kota teyidi ve açık iznine dayanır. [Free limitleri](https://neon.com/pricing).

Yeni endpoint max0.25CU: bir aktif saat yaklaşık0.25CU-hour; kaynak referans bağlantıları da CU tüketir. Sayaç gecikmesi nedeniyle bu kısa işlemin kesin tüketim farkı ölçülemedi. Endpoint en son active; bağlantılar kapandı, timeout0 plan varsayılanıdır. Ek suspend/delete mutasyonu yapılmadı; normal idle autosuspend beklenir. Kopya ayrıştıkça/history penceresi dışında tutuldukça storage artabilir. Ücret yükseltmesi gerekecek bir durum görülürse ayrı onaysız işlem yapılmamalıdır.

Migration015 öncesi: capture sonrası development yazıları ve bu noktanın yaşı yeniden değerlendirilmeli; güncel preflight tekrarlanmalı; gerçek015 apply için **ayrı açık kullanıcı onayı** alınmalı. Uygulama/MFA dış anahtarları korunmalı. Bu branch sağlayıcı içi kopyadır; off-provider yedek değildir. Sprint E'nin35/21 kapsamı canlı38/24 ve015 sonrası40/26 için hâlâ eksik; backup rolü/PUBLIC TEMP/CONNECT engelleri bu görevde değiştirilmedi. Branch'ten ayrıca restore/cutover veya migration provası yapılmadı; bunlar bugünkü SQL doğrulamasının ötesinde ayrı yetki gerektirir.

## Teslim

Mimo'nun bu sprint için teslim edeceği dosyalar:

1. `research/PUSULA_V04_V43A2_RECOVERY_BRANCH.md`
2. `docs/validation/V04_V43A2_RECOVERY_VERIFICATION.md`
3. `LAST_REPORT.md`

V4.3a.1 dosyaları çalışma ağacında korunmuştur; ayrıca önceki sprint teslim kapsamındadır. Yerel `.data/recovery-v43a2/` yardımcı dosyaları/JSON kanıtları Gitignored; teslim edilmez. Kod,migration,env değişikliği;015 apply; mevcut kaynak silme;restore/finalize/reset;R2;upgrade;commit/push/merge yapılmadı.
