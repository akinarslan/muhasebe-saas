# PUSULA — 29 Ekim uygulama emri hazırlığı

24 Ekim 2026. Sabit kaynak: `icy-queen-44442204` / `br-rough-darkness-ba6ow9zo` / `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech:5432` / `pusula_development`. Aktör `neondb_owner`. Production/recovery/test hedefleri kapsam dışı.

**Gerçek şirket verisiyle kullanım kapalı.** Bu belge uygulama onayı değildir. En kısa yol mevcut proje üzerinde provider erişim engelini çözmek; yeni proje veya yeni backup motoru yok.

| Konu | Önceki engel | Yapılan somut düzeltme | Gerçek test kanıtı | Kalan işlem / ayrı onay |
| --- | --- | --- | --- | --- |
| Backup erişimi | postgres PUBLIC2 view/4 rutin; sistem/large-object etkileri belirsiz | Güncel üç DB katalog denetimi; A/B/C karar paketi; allowlist genişletilmedi |24 Ekim READ ONLY3/3; engel hâlâ mevcut | Provider'ın A izolasyon konfigürasyonu veya B owner ACL düzeltmesi ve etkisizlik kanıtı; C için bütün yan etki sınırı kanıtı |
| NOLOGIN rol | Creator ADMIN yönü ve gerçek negatiflerin kapsamı eksikti | Non-superuser creator/NOLOGIN/PASSWORD NULL ve dar SELECT/temizlik fixture'ı; INSERT/DELETE/executor SET retleri eklendi | Yerel profil matrix'i doğrulama belgesinde | **BACKUP_ROLE_DDL_APPROVAL_REQUIRED**; erişim engeli çözülmeden kurulum önerilmez; NOLOGIN onayı LOGIN/export değildir |
| Gerçek kurtarma | Anahtar/offsite/bağımsız restore kabulü yok | Mevcut crypto/storage/restore sözleşmesi ve operasyon sorumlulukları ayrıştırıldı | Sentetik matrix; gerçek R2 yalnız metadata denemesi | Anahtar custody, dar token/public/retention, bağımsız boş restore hedefi ve her gerçek işlem için ayrı onay |
|016 | Provider lifecycle, grantor kabulü, gerçek recovery eksik | Güncel40/26 preflight; yerel dedicated-connection runner ve belirsiz COMMIT prova paketi | Yerel fixture; güncel494 grantor karşılaştırması | Provider lifecycle + bağımsız backup/restore + hedef/checksum/pre fingerprint'e bağlı ayrı016 onayı |
|017 | Gerçek016 kabulü ve provider finance ACL eksik | Teslim edilmiş canonical017 + Prisma9 model + owner/permission/runtime yerel kabulü yeniden çalıştırıldı |56/42,17 history;235 API/SQL; desktop/mobile2 test | Önce bağımsız gerçek016 kabulü; sonra ayrı017 onayı ve provider post kabulü |
| İşletme pilotu | Gerçek personel/finans kesimi/offsite kabulü yok | Sentetik TRY10m² iş akışı ve bağlantı kaybı/reopen tekrarlandı | K1–K5 / iki Chromium viewport'u | ZY yetkilisinin gerçek MFA, iki personel, explicit DENY, açılış/kesim ve kasa/banka/POS mutabakatı; gerçek restore PASS |

## Sıradaki somut karar

Provider/DB yetkilisine [A/B/C karar paketindeki](../../research/PUSULA_LIVE_BLOCKER_RESOLUTION.md) yalnız mevcut development hedefi için desteklenen erişim sınırı sorusu iletilmeli. Bu görev mesaj göndermedi. `cloud_admin` yetkisi varsayılmayacak; haklar rol bazında REVOKE edilerek PUBLIC etkisi kapatılmış sayılmayacak. Provider yanıtı olmadan genel yöneticiyle export kestirmesi yok.

Erişim sınırı kabulünden sonra [mevcut NOLOGIN SQL adayı](../../research/PUSULA_NEON_BACKUP_ROLE_DECISION.md) **40/26 pre016** listesiyle yeniden incelenir. Güncel snapshot fingerprint `7794ab78306b3e97b19400abb390fc5c5a9f8f560fd97cd61c1cf9e87c3f87eb` yalnız24 Ekim10:42:33Z ölçümüdür; gelecekteki uygulama için yeniden ölçülür. Şu an gerçek rol yok. Kurulum rol flags, üyelik/grantor, ownership, explicit SELECT40, function API reddi ve tüm DB effective hakları için COMMIT öncesi bağımsız kabul gerektirir. LOGIN/parola ve export ayrı aşamalardır.

Geri alma: COMMIT öncesi ROLLBACK; sonuç belirsizse otomatik tekrar yok, bağımsız katalog incelemesi. Kurulum COMMIT edilmişse yalnız yeni role verilen exact CONNECT/USAGE/SELECT grant'leri kendi grantor'ıyla kaldırılır; ownership/member/global dependency sıfır doğrulanınca yetkili creator ADMIN ile DROP ROLE. DROP OWNED/CASCADE, mevcut kullanıcı grant'leri ve migration geçmişiyle toplu temizlik yapılmaz. Aynı işlem yerelde prova edilir; provider hook sonucu ayrıca kabul edilir.

## Backup, anahtar ve restore için operatör dolduracak alanlar

- Sorumlu ZY işletme yetkilisi, DB operatörü, anahtar sorumlusu ve yedek sorumlu: **ATANMADI**. Ayrı erişim denetimi ve iki kişiyle anahtar kurtarma denemesi gerekiyor.
- Gerçek anahtar ID/custody: **ATANMADI**. Mevcut AES-256-GCM/HMAC ve encrypted-vault kullanılır; gerçek32-byte anahtar yalnız ayrı onayla üretilir. Ciphertext/R2 ile aynı saklama alanına konmaz. Vault passphrase'i TTY/FD; argv/env/log/rapora secret yazılmaz. Rotasyon kaydı ID/oluşturma/aktifleştirme/emekli tarihi/sorumlu içerir; eski arşivler doğrulanıp retention bitmeden eski anahtar silinmez. Kayıpta yazılar durdurulur, bağımsız custody kopyasıyla doğrulanmış kurtarma yapılır; kurtarılamayan anahtarın arşivi açılmaz.
- R2: `pusula-backups-development`. Config eşleşmesi bucket varlığı veya güvenlik kabulü değildir. Bucket HEAD henüz başarılı değil; control token yok, public managed/custom domain ve lifecycle/retention bilinmiyor. Yetkili dashboard incelemesiyle hesap/bucket, yalnız gereken prefix ve eylemler, silme yetkisinin ayrılması ve retention süresi karara bağlanmalı. Şifreli `archive.gcm` ve authenticated manifest dışında plaintext/key yüklenmez. Mevcut conditional-create ve geri indirme/hash/GCM doğrulaması korunur. Upload ayrı onaylıdır.
- Bağımsız boş restore hedefi/owner/TLS kimliği: **SEÇİLMEDİ**. Kaynak/production/mevcut recovery/test üzerine restore yok. Mevcut recovery `token_roles / ROLE_DELTA_UNRESOLVED` açık. Yeni hedef provisioning'i de ayrı yetki ister.
- RPO/RTO hedefi ve saklama süresi: **İŞLETME TARAFINDAN BELİRLENMEDİ**. Provider6 saat history retention bağımsız yedek değildir. Kabulde backup snapshot→son dayanıklı işlem farkı RPO, temiz hedefe erişimden uygulama smoke testinin bitişine kadar süre RTO olarak ölçülür; yerel fixture süresi gerçek RTO değildir.

Restore kabulü: pre01640/26/15 → post01647/33/16 → post01756/42/17; resolved008 korunur. Tüm tablo data hash/count; global rol flags/üyelik/grantor ve DB/schema/default/column ACL; RLS/policy; SECURITY DEFINER owner/search_path/body/EXECUTE; constraint/index/trigger; immutable journal; posting/allocation/fund/gider mutabakatı; Auth/MFA hash/şifreli alanlar ve bağımsız uygulama secret'ları; session invalidasyonu kararı; gerçek MFA ile app smoke ve RPO/RTO birlikte geçmelidir. Dump global rol veya uygulama anahtarını kendiliğinden kurtarmaz.

## Uygulama sırası ve durma koşulları

1. Provider destekli A veya kontrollü B çözümü; C ancak eksiksiz kanıtla. Yeni/bilinmeyen ACL, rutin veya veri erişiminde dur.
2. Ayrı NOLOGIN DDL onayı → rol post kabulü → ayrı LOGIN/credential kabulü. Auth/runtime/executor/neon_superuser üyeliği yok; BYPASSRLS yalnız SELECT kapsamını aşmaz.
3. Ayrı gerçek anahtar/export/R2/boş hedef restore onayları → bağımsız recovery PASS. Profil ve uzak export/upload guard'ları için ayrıca incelenmiş adapter gerekir; mevcut modern profiller yalnız loopback'tir.
4. Güncel provider GET ve TLS READ ONLY preflight;494 grantor'ın insan/provider kabulü; bakım penceresi/yazar dışlama/geri dönüş sorumlusu; ayrı016 onayı. Dedicated connection/advisory lock;47/33/history16, PUBLIC stock EXECUTE0/runtime3 ve geçici rol/üyelik/CREATE kalıntısı0 bağımsız kabul edilir.
5. Yalnız016 kabulünden sonra ayrı017 onayı; checksum `9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`;56/42/history17, dokuz Finance tablo, owner/ACL/Prisma/runtime/RLS/DENY/MFA kabulü.016 checksum `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567` değişmez.
6. Final56/42 bağımsız yedek/restore, ayrı API açılış incelemesi ve gerçek işletme imzası. TRY pilot: müşteri/tedarikçi/satış/cari/tahsilat/ödeme/kasa/banka/POS/gider/günlük rapor. E-fatura/yasal defter/otomatik banka entegrasyonu kabul edilmiş sayılmaz.

`COMMIT_OUTCOME_UNKNOWN`, rollback belirsizliği veya postflight farkında yazıları durdur, aynı SQL'i tekrar gönderme; ayrı bağlantıyla history+schema+ACL+economic-event tekilliğini incele. Restore/cutover otomatik değildir ve ayrıca onay ister. `applyEnabled=false`, `postFingerprint=null`, `STOCK_MANAGED_APPLY_DISABLED`, `ACCOUNTING_CLOUD_REVIEW_REQUIRED` korunur.

Güncel sonuçlar ve komutlar: [doğrulama](../validation/PUSULA_LIVE_READINESS_VERIFICATION.md).29 Ekim'e beş takvim günü var; provider erişim kararı, anahtar/offsite/gerçek restore ve işletme imzası kapanmadan tarih taahhüdü veya GO_LIVE_PASS yok.
