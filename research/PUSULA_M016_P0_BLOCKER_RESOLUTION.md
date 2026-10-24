# PUSULA M016 — Üç P0 engelinin kapatılma durumu

23 Ekim 2026 · Hedef: 29 Ekim 2026, ZY Reklam iç kullanım.
Dal: `feat/pusula-v030-neon-cloud`; HEAD: `edc03121737051d1eb180e621ccd91acfcc92743`.

**Sonuç: P0_PARTIAL.** Yerel düzeltmeler ve 494 kaydın bağımsız sözleşme karşılaştırması tamamlandı. Gerçek provider kimliği, provider yetki kabulü ve bağımsız gerçek kaynak backup/restore kanıtı eksik. **M016_BLOCKED devam eder; M016_READY_FOR_APPROVAL, P0_READY_FOR_APPROVAL ve GO_LIVE_PASS verilmedi.** Bu rapor uygulama onayı değildir.

İncelenen dayanaklar: V4.3b.10–12 araştırma/doğrulama belgeleri, K6, K5, M017 ve M016 raporları; mevcut managed sözleşme, cloud preflight ve backup kaynakları. Bu görevde yeni Neon isteği veya SQL bağlantısı açılmadı. Aşağıdaki gerçek kaynak ölçümleri **önceki görevde alınan 23 Ekim snapshot'ının çevrimdışı incelemesidir**, yeniden ölçüm değildir.

## 1. Provider HTTP401 — neden belirlendi, erişim henüz açılmadı

**Somut düzeltme:** `scripts/stock/provider-credential.ts` eklendi; `cloud-preflight.ts` mevcut GET öncesinde bu kontrolü çağırıyor. Süresi dolmuş veya 30 saniye içinde dolacak OAuth token, eksik/bozuk expiry ve desteklenmeyen credential türü ağ isteğinden önce reddedilir. Eski, `type` alanı bulunmayan OAuth formatı da denetlenir. Otomatik refresh/login/API-key fallback veya credential yazma yoktur.

Mevcut mekanizma `%USERPROFILE%/.config/neon/credentials.json` içindeki `access_token` değerini doğrudan Bearer olarak kullanıyor; refresh token'ı kullanmıyor. Dosyanın yerel metadata'sı `type=oauth`, `expires_in=3599`, `expires_at=1792598722893`: **21 Ekim 2026 16:05:22.893Z / 19:05:22.893 Türkiye**. Token hem 22 Ekim hem 23 Ekim HTTP401 isteğinden önce sona ermiş. Bu, mevcut erişimin çalışmaması için somut yeterli nedendir; sunucuda ayrıca revocation veya hesap yetkisi sorunu bulunmadığı iddia edilmez.

**Gerçek test kanıtı:** Yerel metadata kontrolü `NEON_CREDENTIAL_EXPIRED_OR_EXPIRING` verdi. Sentetik testler expired, expiry yok/NaN, eski format, desteklenmeyen tür ve geçerli süre durumlarını doğruladı. Bu görevde provider GET=0, refresh=0, credential değişikliği=0. Önceki son gerçek GET: **2026-10-23T10:46:05.514Z**, `/projects/icy-queen-44442204`, HTTP401; kanıt `.data/m016-cloud/current/provider.json`.

**Eksik koşul:** Geçerli mevcut hesap oturumu ve güncel project/branch/endpoint kimlik GET'leri. SQL erişimi bunun yerine geçmez. Beklenen eşleme: proje `icy-queen-44442204`, development branch `br-rough-darkness-ba6ow9zo`, direct endpoint host `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech`, DB `pusula_development`. Branch/endpoint eşlemesi hâlâ tarihsel kanıttır.

**Kullanıcıdan gereken tek işlem:** Mevcut kurulu Neon CLI için **`neon auth`** oturum açma akışını kullanıcı başlatsın; açılan tarayıcıda doğru Neon hesabıyla giriş yapıp CLI erişimini onaylasın. Console'a yalnız giriş yapmak yerel expired token'ı yenilemez. Console'da ilgili projeye erişebildiğini ve development branch'ini doğrulasın; proje görünmüyorsa proje/organizasyon yöneticisinden mevcut hesaba erişim istemeli. Yeni API key veya `init` gerekmez. Bu işlem credential yenileyeceği için bu görevde çalıştırılmadı; kullanıcı kontrollü erişim düzeltmesidir. Ardından ayrı salt okunur doğrulamada sabit hedef GET'leri tekrar alınmalı; ilk 401'de durulmalı.

CLI browser authorization davranışı için [Neon CLI resmi kaynak belgesi](https://github.com/neondatabase/neonctl#connect); OAuth credential formatında eski `type` alanının yokluğu kurulu `node_modules/@neon/env/dist/cli.js` içindeki credential açıklamasıyla da karşılaştırıldı. Belge, mevcut hesabın gerçekten yetkili olduğunun kanıtı sayılmadı.

**29 Ekim etkisi:** Erişim düzeltmesi bugün yapılabilecek ilk kullanıcı adımıdır. Güncel provider kimliği doğrulanmadan migration onay kapısı açılmaz; yerel PASS bu beklemeyi ortadan kaldırmaz.

## 2. 494 grantor — bağımsız karşılaştırma tamamlandı, provider kabulü açık

**Somut düzeltme:** `scripts/stock/grantor-review.ts` yeni ölçümü beklenti olarak kullanmaz. Önceden var olan `managed-contract.json.pre.security` içindeki nesne/grantee/privilege/grant-option envanterinden beklenen satırları üretir. Bu incelemenin açık grantor kuralı: tablo/fonksiyon owner'ı; database için sabit `<owner>`; public schema için `pg_database_owner`; default ACL için sözleşmedeki default owner. Owner'a eşit grantor politikası yeni, açık bir inceleme kuralıdır; eski sözleşmede grantor pin'i varmış gibi sunulmaz. Beklenmeyen column ACL varsa otomatik politika üretmek yerine durur. Tam satır multiset karşılaştırması duplicate, eksik ve fazladan kayıtları da yakalar.

Kaynak: `.data/m016-cloud/current/development-snapshot.json`; önceki READ ONLY transaction zamanı **2026-10-23T10:46:07.694Z**. Bu görev business/Auth/MFA/session verisi okumadı.

| Kategori | Kayıt | Bağımsız beklenen grantor | Sonuç |
| --- | ---: | --- | --- |
| Tablo | 450 | `<owner>` | 450 eşleşti |
| Fonksiyon | 21 | `<owner>` | 21 eşleşti |
| Public schema | 5 | `pg_database_owner` | 5 eşleşti |
| Kaynak database | 9 | `<owner>` | 9 eşleşti |
| Default ACL | 9 | `cloud_admin` | 9 eşleşti; provider incelemesi gerekli |
| Column ACL | 0 | Önceki sözleşmede boş; yeni hak kabul edilmez | 0 gözlendi |

**Gerçek test kanıtı:** Beklenen=494, eşleşen=494, eksik=0, beklenmeyen=0. Grantor/grantee/grant-option değişikliği, eksik satır, duplicate, eksik ölçüm ve yeni column grant sentetik negatifleri geçti. Çevrimdışı inceleme sonucu **`MATCH_REQUIRES_PROVIDER_REVIEW`**, `accepted=false`, `applyEnabled=false`.

Beklenen ve gözlenen için aynı sabit alan sırası `[kind,identity,owner,grantee,grantor,privilege_type,is_grantable]`, satırların sıralı JSON gösterimlerinin SHA-256'sı:
`23350f83871a1255c064c16b60a5a7ef306f825d6e8c2a6dcf48a9b3da5d3748`.
Bu yeni karşılaştırma digest'i, önceki ham grantor fingerprint'i `378e182781ee9cb740824ce50fc4b58de1175d629e1160478388272cda8d938a` ile farklı serileştirmeye sahiptir; eski hash değiştirilmedi.

**Beklenen fakat ayrıca değerlendirilmesi gereken haklar:**

- Default ACL'de `cloud_admin → neon_superuser`, `public:S` için SELECT/UPDATE/USAGE; `public:r` için DELETE/INSERT/MAINTAIN/SELECT/TRUNCATE/UPDATE: toplam **9 WITH GRANT OPTION**. Eski sözleşmede zaten vardır; yeni grantor ölçümü aynı owner'ı doğruladı. Provider tarafından yönetildiği ve uygulama/backup rolüne geçişli yetki vermediği güncel provider kanıtıyla teyit edilmedi.
- Database ACL'de PUBLIC TEMPORARY; owner ve neon_superuser CREATE/CONNECT/TEMPORARY; runtime/auth CONNECT bulunuyor. Bunlar eski pre envanterine göre drift değildir. Mevcut rol/üyelik ve diğer DB erişim bulguları, backup rolünün güvenli olduğu anlamına gelmez; cross-DB nesne kabulü eksiktir.
- PUBLIC EXECUTE olan **4 eski trigger fonksiyonu**: `reject_price_history_change`, `reject_auth_security_event_change`, `reject_audit_event_change`, `pusula_sale_child_same_transaction`. Bunlar beklenen pre envanterindedir; 016'nın yeni altı fonksiyonunda PUBLIC EXECUTE sıfır olma post koşuluyla karıştırılmadı. Bu görev herhangi bir REVOKE yapmadı.
- Tablo satırlarının 320'si owner hakları, 130'u runtime/auth/test-runtime haklarıdır. Tablo/fonksiyon/schema/database ACL'lerinde gözlenen `is_grantable=false`, owner'ın örtük grant yetkisini yok saymak için kullanılmadı. Test-runtime hakları da eski sözleşmede mevcut; yeni bir kullanıcı yetkisi olarak eklenmedi.

**Eksik koşul:** Yeni grantor politikasının bağımsız insan kabulü; provider kaynaklı default/grant-option ve rol zincirinin yetkili açıklaması; apply öncesi yeni READ ONLY ölçüm. **494 satırda beklenmeyen fark yoktur**, fakat provider güvenlik kabulü de yoktur. Eski `pre.grantors=null`, `postFingerprint=null`, `applyEnabled=false` korunmuştur. İlk görülen posttan fingerprint öğrenilmedi, otomatik enrollment yapılmadı.

**Kullanıcıdan gereken tekil işlem:** Yetkili Neon proje/DB sorumlusu bu tabloda belirtilen provider ACL/default haklarını ve grantor politikasını inceleyip, hedefe bağlı yazılı kabul veya gerekçeli düzeltme talebi versin. Bu kabul gerçek rol/ACL değişikliği onayı değildir; gerekiyorsa o işlem ayrıca yetkilendirilmelidir.

**29 Ekim etkisi:** 494 satırın incelenmemiş olması yerel olarak giderildi. Kalan bekleme yeni SQL geliştirmesi değil, provider haklarının yetkili kabulü ve güncel hedef kanıtıdır. Kabul olmadan güvenlik pin'i aktifleştirilmez.

## 3. Backup/restore — mevcut motor güçlendirildi, gerçek kaynak operasyonu BLOCKED

**Somut düzeltme:** Yeni backup motoru yapılmadı. Mevcut `scripts/backup/postgres.ts:validateToc` finans arşivi için **13 append-only/deferred atomicity trigger kaydını** zorunlu kılıyor. Sadece 56 tablo DATA ve herhangi bir trigger bulunması artık yeterli değil. FinanceJournal/Posting denge, sale atomic, operation atomic, allocation/fund immutable, intent delete yasağı ve expense immutable/atomic kayıtları eksikse `DUMP_FINANCE_TRIGGER_MISSING` verir. Bu kontrol TOC varlığını doğrular; trigger tanımı/etkinliği, tüm RLS/function/ACL ve restore davranışının yerine geçmez.

**Gerçek test kanıtı:** Tam sentetik 56-tablı TOC kabul edildi; 13 trigger'ın her birinin ayrı çıkarılması ve finans veri tablosunun eksiltilmesi reddedildi. Mevcut crypto/key/vault/storage/role/policy/restore-guard birim testleri geçti. Bunların storage ve restore bağımlılıkları mock/sentetiktir; gerçek R2 ve pg_restore çağrısı değildir. K5'in 56 tablolu gerçek yerel fixture restore'u **tarihsel kanıttır, bu görevde yeniden çalıştırılmadı**.

| Operasyonel engel | Somut eksik ve mevcut motor üzerindeki gerekli işlem | Kullanıcıdan gereken ayrı tekil işlem/onay | 29 Ekim etkisi |
| --- | --- | --- | --- |
| Kaynak rolü | Kaydedilmiş 24-rollü snapshot'ta `pusula_backup` yok. `sourceTarget` bu özel login'i gerektiriyor. Non-superuser, BYPASSRLS ile tam veri okuma; SUPERUSER/CREATEROLE/CREATEDB/replication/provider-admin=false, üyelik/ownership/DML/grant-option yok şartları provider üzerinde kanıtlanmadı. Schema USAGE/SELECT ve CONNECT ile sınırlı erişim, tehlikeli function EXECUTE ve cross-DB hakları incelenmeli. | **Rol provisioning/GRANT için ayrı açık yetki**; provider sorumlusu desteklenen rol modelini doğrulamalı. Bu görev rol oluşturmadı. | Güvenli tam kaynak export önkoşulu; runtime veya owner credential'ına sessiz geçiş yok. |
| Şema/veri kapsamı | Varsayılan `inspectSource` 35 tablo/21 FORCE RLS ve 5 invoker function pin'inde. Gerçek kaydedilmiş pre016 kaynak 40/26 ve 10 fonksiyon; post016 47/33, post017 56/42. `postgres.ts` source profile/history kabulü ve `source-security.ts` function envanteri kaynak sürümüne göre bağımsız incelenmeli. Mevcut history denetimi rolled-back 008 satırını ve yereldeki17 migration'a karşı gerçek15 geçmişini kabul etmeyecektir; eski resolved008 değiştirilmeden uygun tarihsel checksum doğrulaması gereklidir. Salt tablo listesini büyütmek kabul değildir. | **Tam gerçek kaynak verisinin okunması/export edilmesi için ayrı açık onay** ve sürüme bağlı güvenlik profilinin inceleyici kabulü. Auth/MFA/session dahil tam backup hassas veri içerir; bu görev içerik okumadı. | Pre016 gerçek40/26 kopya ve sonraki47/33,56/42 kapsamları karıştırılamaz. Mevcut fail-closed profil ile gerçek backup hazır değildir. |
| Anahtar | `.env.local` ad kontrolünde `BACKUP_SOURCE_DATABASE_URL`, `BACKUP_ENCRYPTION_KEY`, `BACKUP_KEY_ID`, `BACKUP_KEY_STORAGE` yok; `.data/backup-keys` yok. Başka operatör secret store'u olmadığı iddia edilmez. Ayrı anahtar sorumlusu, bağımsız saklama ve yeniden elde etme kanıtı yok. | **Mevcut AES-256-GCM/HMAC + encrypted-vault araçlarıyla bağımsız anahtar custody/recovery kurulumu için ayrı onay**. Yeni gerçek anahtar üretilmedi; anahtar rapora/argv'ye yazılmamalı. | Aynı makinedeki sentetik anahtar bağımsız recovery sağlamaz; export öncesi çözülmeli. |
| Offsite | `.env.local` içinde R2 account/access/secret/bucket ayar adları mevcut; değerleri yazdırılmadı ve geçerliliği denenmedi. CLOUDFLARE_API_TOKEN yok. Public-domain kapalı olma, bucket-scope, retention/silme yetkisi, bağımsız hesap ve ciphertext'in gerçekten saklandığı doğrulanmadı. Dashboard kabulü gerekir; yeni token zorunlu sayılmadı. | **Hedef bucket/retention ve dar yetki politikasının Console incelemesi**, sonrasında gerçek ciphertext **R2 upload için ayrıca açık onay**. | R2 config varlığı offsite kopya değildir; offsite kanıtı olmadan dönüş güvencesi yok. |
| Ayrı restore hedefi | Gerçek kaynaktan üretilmiş şifreli arşiv + bağımsız anahtarla, kaynaktan ayrılmış açıkça belirlenmiş hedefte restore/migration/schema/data/ACL/global-role kabulü yok. `pg_dump` global rolleri ve cluster/database erişim düzenini tek başına kurtarmaz. | **Kaynakları koruyan ayrı restore hedefinin seçimi ve restore işlemi için ayrı açık onay**; recovery/production/test hedefi bu görevden yetki almaz. | Restore kanıtı olmadan 29 Ekim gerçek verili kullanım güvenli kabul edilemez. |
| Recovery rol farkı | `token_roles / ROLE_DELTA_UNRESOLVED` sürüyor. Önceki recovery'nin şema/veri referansı tam recovery sertifikası değildir. | Recovery sorumlusu rol farkının kökeni ve beklenen erişim sözleşmesi için **ayrı inceleme/kabul** vermeli; gerçek düzeltme ayrıca yetki ister. | Kapanmadı; recovery'yi hazır alternatif sayarak takvim kısaltılamaz. |

`MANAGED_REMOTE_OBJECT_AUDIT_REQUIRED`, `MANAGED_REMOTE_UPLOAD_NOT_APPROVED`, `ACCOUNTING_CLOUD_REVIEW_REQUIRED` ve `STOCK_MANAGED_APPLY_DISABLED` korunur. Gerçek kaynak/backup rolü/provider ACL kanıtı bulunmadan source allowlist veya function güvenlik kontrolü genişletilmedi. AES-GCM/HMAC motoru, key vault ve R2 araçları yeniden kullanılıyor; yeni motor veya bulut aktivasyonu yok.

## Çalıştırılan kontroller ve kaynak koruması

| Kontrol | Bu görevde sonuç |
| --- | --- |
| Hedefli P0 + mevcut backup birim testleri | 7 dosya, **175/175 PASS**, exit0 |
| `npm.cmd test`, son çalışma | **43 dosya, 490/490 PASS**, exit0 |
| `npx.cmd tsc --noEmit`, son çalışma | PASS, exit0 |
| `npm.cmd run lint`, son çalışma | PASS, exit0 |
| `node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | **10 kontrol PASS**, exit0; yalnız izole Git artifact |
| `git diff --check` | PASS, exit0 |
| Gerçek PG fixture / build | Bu görevde çalıştırılmadı; eski sonuçlar yeni test gibi sunulmadı |

İlk tam testte eski `accounting-release` sentetik TOC'si finans trigger'ları içermediği için 489/490 sonucu alındı. Beklenti, bu eksik arşivin reddedilmesini gerektirecek şekilde güncellendi; sonraki tam çalışma 490/490 geçti. Önceki migration üretimi, checksum, COMMIT belirsizliği ve tablo eksikliği testleri korundu.

Bu görevin kesin kaynak kapsamı **7 dosya**:

- `scripts/stock/provider-credential.ts` — yeni, yerel expiry kapısı.
- `scripts/stock/cloud-preflight.ts` — mevcut GET öncesine tek guard entegrasyonu.
- `scripts/stock/grantor-review.ts` — yeni, salt çevrimdışı bağımsız karşılaştırma.
- `scripts/backup/postgres.ts` — mevcut TOC doğrulamasına finans trigger kontrolü.
- `tests/m016-p0.test.ts` — yeni, 21 sentetik/negatif test.
- `tests/accounting-release.test.ts` — tek beklenti finans trigger eksikliğini reddeder.
- `research/PUSULA_M016_P0_BLOCKER_RESOLUTION.md` — bu rapor.

Başlangıçtaki32 kirli dosya hash ile kaydedildi;30'u byte-identical korunur. Yukarıdaki `cloud-preflight.ts` ve `accounting-release.test.ts` yalnız belirtilen ek kontrol/test beklentisi nedeniyle değişti; önceki çalışma geri alınmadı. M017/M016 raporları, diğer kaynakları ve `LAST_REPORT.md` değişmedi. Migration001–017 değiştirilmedi;016 SHA-256 `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`,017 SHA-256 `9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`. Manifest ve eski K5 checksum kaydı korunur. HEAD/index, `.env.local` ve Neon credential dosyası değiştirilmedi.

Yerel özel kanıtlar `.data/m016-p0/` altında: `preservation.json`, `evaluation.json`, `tests.log`, `vitest-full.log` (ilk başarısız), `vitest-final.log`, `tsc-final.log`, `lint-final.log`, `checksum.log`. Bunlar Git teslim kapsamı değildir; ham grantor kaydı veya credential rapora kopyalanmadı. `.env.local` ad kontrolü, operatörün bütün secret kaynaklarının denetimi sayılmaz.

**29 Ekim için en kısa kalan yol:** Kullanıcı mevcut OAuth oturumunu düzeltsin; provider kimliği ve belirtilen ACL/default hakları yetkili olarak doğrulansın. Gerçek kaynak rol/profil, bağımsız anahtar, offsite ve ayrı hedef restore kabulü kendi açık yetkileriyle tamamlanmadan M016 onayı istenmesin. Önceki provider rol yaşam döngüsü ve managed uygulama kabul koşulları da yürürlüktedir; bu üç P0 incelemesi onları kapatmaz. İleride ayrı onay verilirse sıra016 → bağımsız016 kabulü → ayrıca onaylı017 olarak kalır. Altı günlük takvim için bitiş garantisi verilemez; bu kapılar kapanmadan gerçek verili iç kullanım açılmaz.

Gerçek migration apply, rol/ACL değişikliği, production/recovery/test SQL, dump, R2 upload, restore, branch/snapshot, Git commit/push/merge yapılmadı.
