# Sprint E2.2a — backup hesabı öncesi güvenlik hazırlığı

18.10.2026 · `feat/pusula-v030-neon-cloud` · başlangıç `c7cc22b`.

## Sonuç

Libpq CA engeli giderildi; gerçek PostgreSQL 18.6 `psql`, onaylı direct development bağlantısında **sslmode=verify-full / READ ONLY PASS** verdi. E2 preflight güvenlik kontrolleri genişletildi. **PUBLIC TEMP kaldırılmadı; yeni backup hesabı oluşturulmadı ve hazır kabul edilmedi.** Gerçek dump/R2/production işlemi yok.

## CA hazırlığı ve bağlantı kanıtı

[Neon resmî TLS rehberi](https://neon.com/docs/connect/connect-securely), ISRG Root X1 ve Let's Encrypt PEM kaynağını doğrudan gösterir. Sertifika yalnız `https://letsencrypt.org/certs/isrgrootx1.pem` adresinden TLS doğrulaması açıkken, yönlendirme kabul edilmeden indirildi. X.509 CA niteliği, kendi public key'iyle imzası, tarih aralığı ve sabit DER SHA-256 parmak izi doğrulandı:

`96:BC:EC:06:26:49:76:F3:74:60:77:9A:CF:28:C5:A7:CF:E8:A3:C0:AA:E1:1A:8F:FC:EE:05:C0:BD:DF:08:C6`

Geçerlilik sonu 04.06.2035. [CA sağlayıcısının zincir rehberi](https://letsencrypt.org/certificates/) esas alındı. Kök `.data/certificates/isrg-root-x1.pem` içinde; klasör yalnız operatör/SYSTEM ACL ile korundu. `.env.local` içine yalnız BACKUP_PG_SSLROOTCERT yerel mutlak yolu eklendi; diğer değişkenler değiştirilmedi. Dosya ve env Git dışındadır. Sistem CA deposu, PATH veya Windows servisleri değiştirilmedi. Intermediate/leaf sertifikalar trust anchor olarak kaydedilmedi; sunucunun sunduğu zincir bu kökle libpq tarafından doğrulandı. Provider CA değişiminde güvenilir resmî kaynağa göre yeniden inceleme gerekir.

E2'nin gerçek `pgEnvironment` ve `checkLibpqConnection` yolu kullanıldı: yalnız `SELECT current_setting('transaction_read_only')`, cevap **on**, araç exit **0**. pg_dump ve psql aynı libpq/PGSSLROOTCERT yapılandırmasını kullanır; **pg_dump çalıştırılmadı**, dump başarısı iddia edilmez. [Libpq verify-full](https://www.postgresql.org/docs/18/libpq-ssl.html) sertifika zinciri ve hostname denetimini korur. require/disable veya güvenilmeyen sertifika kabulü uygulanmadı. Ham stderr/URL/parola raporlanmadı.

## Preflight sertleştirmesi

`inspectSource` veri sayımı/snapshot aşamasından önce şu kontrolleri uygular:

- Efektif TEMP erişimi (PUBLIC veya doğrudan grant dahil) reddedilir; null/eksik metadata da reddedilir.
- Özel backup hesabının **bütün doğrudan rol üyelikleri** reddedilir. Böylece INHERIT, SET veya ADMIN üzerinden bir üst role geçişin ilk adımı yoktur. Zararsız üyelikler de kabul edilmez; dolaylı zincirleri tek tek güvenli saymaya çalışmaz.
- pg_shdepend sahiplik kayıtları reddedilir; tablo dışındaki sahiplik/DDL yolları da kapsanır. Bu kontrol aynı cluster'daki başka DB'ye ait sahiplik kaydında da katı davranır.
- Yeni kullanıcı şeması; public içindeki sequence/view/materialized view/foreign table/partition gibi incelenmemiş relation türleri; large object, plpgsql dışı extension, event trigger ve beklenmeyen kullanıcı type/domain/enum adı reddedilir. Bilinen üç enum adı izinlidir. Mevcut 35 tablo ve 21 FORCE RLS kontrolleri devam eder. Yeni index/policy/constraint adları için ayrı tam allowlist eklenmedi; bunlar otomatik “güvenlik incelemesi yapıldı” sayılmaz.
- Column seviyesinde INSERT/UPDATE/REFERENCES ve tablo SELECT grant option reddedilir; eski tablo yazma/DDL/sequence kontrolleri korunur.
- Public fonksiyonların beş imzası ve PG18 `pg_get_functiondef` SHA-256 değerleri sabittir; eksik/ek/değişmiş fonksiyon ve SECURITY DEFINER reddedilir. Kabul edilen gövdeler SECURITY INVOKER ve mevcut migration SQL'leriyle eşleşir. EXECUTE ACL genişlese bile yalnız bu incelenmiş tanımlar kabul edilir; yeni bir fonksiyon otomatik güvenli sayılmaz. Builtin PostgreSQL fonksiyonlarının tümü için genel sandbox iddiası yoktur.
- Denetim search_path sırası pg_catalog, public olarak sabitlenir. Yeni şema/fonksiyon kimlikleri otomatik öğrenilmez; değişiklikte kod incelemesi gerekir.

Gerçek development üzerinde yalnız READ ONLY katalog sorgularıyla yeni SQL çalıştırıldı: **SQL PASS**, beş fonksiyon hash kontrolü **PASS**. Mevcut owner için TEMP/üyelik/sahiplik/yazma/grant option true; güvenlik validator'ı beklenen SOURCE_TEMP_PRIVILEGE_REJECTED verdi. Bu, yeni backup hesabının testi değildir; production `inspectSource` bütünü çağrılmadı, işletme tablolarında count yapılmadı.

Yerel fixture runner'ın yalnız gelecekte yeni oluşturacağı `pusula_backup_fixture` DB hazırlığına PUBLIC TEMP kaldırma eklendi. Bu runner **bu sprintte çalıştırılmadı**; yerel veya Neon DB'de GRANT/REVOKE uygulanmadı. E2.1b'nin 14/14 sonucu önceki sürümün tarihsel kanıtıdır; yeni guard'larla gerçek dump kabulü yeniden iddia edilmez.

## PUBLIC TEMP seçenekleri — yalnız analiz

Development DB'sinde PUBLIC TEMP mevcut; rol bazında REVOKE, PUBLIC'ten gelen hakkı engellemez. [PostgreSQL GRANT](https://www.postgresql.org/docs/18/sql-grant.html) toplamsal yetki modelidir. Default READ ONLY/search_path, ele geçirilmiş credential sahibinin değiştiremeyeceği bir güvenlik sınırı değildir.

| Seçenek | Mevcut roller üzerindeki etki | Değerlendirme |
| --- | --- | --- |
| PUBLIC TEMP'i bırakmak | Haklar aynen kalır | Yeni guard backup hesabını engeller; katı DDL kriteri sağlanmaz |
| Yalnız backup rolünden TEMP revoke | PUBLIC mirası sürer | Sorunu çözmez |
| Mevcut gerekli rollere açık TEMP grant, ardından PUBLIC revoke | Etkin haklar seçici olarak korunabilir; gelecekteki roller otomatik TEMP almaz | Önerilen kontrollü seçenek; ayrı onay ve tam rol envanteri gerekir |
| Herkesten TEMP kaldırmak | Dış operatör araçları/migration işleri etkilenebilir | Ön inceleme olmadan uygun değil |
| Sadece READ ONLY varsayılanı/uygulama kuralı | Az uygulama etkisi | Katı yetki sınırının yerine geçmez |
| Ayrı replica/branch veya provider backup modeli | Yeni erişim/operasyon ve olası maliyet gerektirir | Yalnız ayrı tasarım/onayla; otomatik uygulanmadı |

Kod taramasında src/scripts/prisma içinde CREATE TEMP/TEMPORARY TABLE veya SELECT INTO TEMP kullanımı bulunmadı; yalnız pusula_can search_path'inde pg_temp geçiyor. Bu, dış SQL istemcileri/Prisma engine iç davranışı/gelecek migration'lar için tam dinamik kanıt değildir. Eski development katalog kanıtı runtime/auth rollerinin PUBLIC TEMP'e dayandığını gösterir; test DB'nin ACL'si değiştirilmemelidir.

Önerilen ilerideki işlem: yalnız development hedefinde tam rol/üyelik/etkin TEMP envanterini yeniden al; gerekli mevcut rollerin haklarını açık grant ile **aynı transaction içinde** koru; PUBLIC revoke uygula; backup hesabına TEMP verme; metadata ve ilgili uygulama regresyonunu karşılaştır. PUBLIC revoke bütün mevcut/future rolleri etkilediğinden bu sprintte yapılmadı. Kullanıcı yetkileri ve işletme verileri aynen bırakıldı. Owner'ın sahiplikten gelen hakları ayrıca hesaba katılmalı; yalnız dört uygulama rolünü varsayarak toplu değişiklik yapılmamalıdır.

## SQL-created BYPASSRLS önkoşulları

[Neon rol rehberi](https://neon.com/docs/manage/roles) sınırlı roller için SQL yolunu, Console/API/CLI için otomatik neon_superuser üyeliğini açıklar. [PG18 CREATE ROLE](https://www.postgresql.org/docs/18/sql-createrole.html) CREATEROLE ile rol yaratmayı ve BYPASSRLS niteliğini yalnız ilgili niteliğe sahip rol/superuser'ın atamasını tarif eder. [ALTER ROLE](https://www.postgresql.org/docs/18/sql-alterrole.html) da yönetim koşullarını sınırlar. E2.2 katalog kanıtında owner CREATEROLE ve doğrudan BYPASSRLS taşır; NOSUPERUSER olması tek başına modeli imkânsız kılmaz.

Bu belgeler provider üzerinde belirli CREATE/GRANT işleminin başarılı olacağına dair fiilî kanıt değildir. İlgili işlem yapılmadı; başarısız olursa durulmalı, geniş admin veya ownership fallback uygulanmamalı. Ayrı hesap, hiçbir üyelik/ownership/yazma/TEMP/DDL yetkisi olmadan doğrudan BYPASSRLS ve açık SELECT ile tasarlanır. FORCE RLS altında tam okuma yeni hesapla ayrıca doğrulanmadan kabul edilmez. Production/branch credential kopyalama izolasyonu E2.2'deki açık kapıyı korur.

## Doğrulama ve sonraki adım

| Kontrol | Sonuç |
| --- | --- |
| Gerçek psql 18.6 verify-full READ ONLY | PASS |
| Yeni SQL + fonksiyon hash, yalnız development katalogları | PASS; owner beklenen şekilde reddedildi |
| Vitest | **195/195**, 19 dosya, 12.05 s; önceki 165 + 30 yeni güvenlik testi |
| TypeScript | PASS |
| ESLint | PASS; 0 hata/uyarı |
| Production build | PASS; Next16.4.1 |
| Sır taraması | PASS; 10 teslim dosyası ve 23 production client JS dosyasında yapılandırılmış yerel sır eşleşmesi yok |

Unit testler DB bağlantısını taklit eder: TEMP/membership/ownership/yeni nesne/column/grant option için true ve eksik metadata reddi; fonksiyon ekleme/silme/SECURITY DEFINER/gövde/imza değişimi; CA env aktarımı, sır izolasyonu ve migration gövde eşleşmesi. E2 backup alt kümesi toplam 91 testtir. Bunlar Neon'da yeni rol veya yeni guard altında gerçek dump kanıtı değildir. DB/API/browser mutation regresyonları yeniden çalıştırılmadı. Şifreleme formatı ve uygulama/auth/RLS kodu değişmedi.

**Sonraki adım ayrı onaydır:** PUBLIC TEMP için seçici ACL planı ve etkiler; SQL-created özel hesabın oluşturulması ve minimum SELECT/BYPASSRLS yetkilendirmesi. Gerçek key/KEY_ID/offline kopyalar E2.3'te, gerçek dump ve R2 upload ayrı onay kapılarıdır. Bu sprint yeni hesap, rol/ACL/migration/RLS değişikliği, dump, R2, test DB/production bağlantısı veya Master/MFA işlemi yapmadı.
