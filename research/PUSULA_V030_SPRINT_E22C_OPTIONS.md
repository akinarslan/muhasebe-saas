# Sprint E2.2c — Neon yönetilen rol izolasyonu ve backup seçenekleri

18.10.2026 · `feat/pusula-v030-neon-cloud` · başlangıç `f77d41a`. Yalnız dokümantasyon; yeni Neon bağlantısı veya SQL/API işlemi yapılmadı.

## Tek öneri ve bugünkü karar

**Önerilen yöntem: mevcut development branch'inde, Neon desteğinin teyit ettiği seçici ACL düzeniyle, doğrudan BYPASSRLS taşıyan ayrı SQL-created pusula_backup hesabı.** Yeni branch/proje, veri kopyası veya geniş admin dump önerilmez. Bu yöntem mevcut E2 kaynak hedefine en az mimari değişiklik getirir ve yeni kaynak maliyeti yaratmaz; provider teyidi olmadan uygulanabilir kabul edilmez.

**Bugün uygulama BLOCKED.** Desteğin özellikle internal rollerin TEMP ihtiyacını ve provider-owned postgres DB'sinde yalnız development backup LOGIN'ini sınırlayacak desteklenen yöntemi açıklaması gerekir. Yanıt bu sınırları sağlayamıyorsa bu öneri uygulanmaz; hedefi gevşetmek veya başka modele otomatik geçmek yerine yeni tasarım/onay gerekir. “Şu an bütün koşulları doğrulanmış hazır bir çözüm var” iddiası yoktur.

Bu seçim bir destek başvurusu göndermek veya SQL uygulamak için izin değildir. Destek talebi aşağıda taslaktır; gönderilmedi. Gerçek rol oluşturma ve bütün SQL değişiklikleri için kullanıcıdan **yeniden açık onay alınmalıdır**.

## Dayanaklar ve kanıt türleri

- **Canlı tarihsel kanıt:** [E2.2b katalog envanteri](PUSULA_V030_SPRINT_E22B_PLAN.md), PostgreSQL18.6; 24 rol/16 üyelik, development'ta bütün roller TEMP E; public şema USAGE PUBLIC, CREATE değil. neondb/postgres PUBLIC CONNECT; postgres sahibi cloud_admin, development/neondb sahibi neondb_owner. pusula_backup yok. Bu bilgiler E2.2c'de yeniden sorgulanmadı; uygulama öncesi drift denetimi gerekir.
- **Yerel kod kanıtı:** E2 sourceTarget yalnız mevcut development direct host/DB/pusula_backup/verify-full kabul eder. source-security üyelik, TEMP, sahiplik, fonksiyon ve yeni nesne guard'ları içerir. Başka branch/proje hedefini kabul etmez. E2.2a CA doğrulaması ve 195 test tarihsel kanıttır; bugün yeniden çalıştırılmış sayılmaz.
- **Güncel resmî kaynak:** aşağıdaki belgeler 18.10.2026 araştırmasında okundu. Belge desteği, bu hesaptaki belirli DDL'nin fiilen başarılı olduğu anlamına gelmez. Eksik özel provider davranışı **belirsiz** olarak işaretlenmiştir.

## Desteklenen rol modeli ve sınırlar

[Neon database access](https://neon.com/docs/manage/database-access) dar rollerin SQL ile yaratılmasını ve seçici nesne izinlerini destekler. [Manage roles](https://neon.com/docs/manage/roles) Console/API/CLI rollerine otomatik neon_superuser üyeliğini, branch kapsamını ve internal rollerin kullanıcı tarafından kullanılmaması/değiştirilmemesini açıklar. Genel dokümandaki grup üyeliği örneği bizim daha katı sıfır-üyelik guard'ımıza aynen kopyalanmamalıdır; izinler doğrudan login'e verilir.

[PG18 CREATE ROLE](https://www.postgresql.org/docs/18/sql-createrole.html), CREATEROLE ve BYPASSRLS atama önkoşullarını tanımlar; BYPASSRLS sahibi rol bu niteliği atayabilir. Tarihsel owner bu iki niteliği doğrudan taşır. **Neon'un bu projede admin üyeliği olmadan yeni login'e BYPASSRLS atanmasını kabul edeceği henüz fiilen kanıtlanmadı**; resmî PostgreSQL önkoşulları ve genel Neon SQL-role desteği birlikte teknik aday oluşturur, kesin provider kabulü oluşturmaz.

Hedef: LOGIN + doğrudan BYPASSRLS; NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION; sıfır üyelik/ownership; development CONNECT; public USAGE; yalnız gerekli 35 tabloya SELECT; TEMP/CREATE/DML/TRUNCATE/grant option yok. Sequence şu an yok. Yeni nesne izinleri migration incelemesiyle seçici verilir. pg_read_all_data veya tablo ownership tek başına FORCE RLS tam okuma çözümü değildir; ownership ayrıca DDL gücü verir. [RLS davranışı](https://www.postgresql.org/docs/18/ddl-rowsecurity.html).

Provider'ın SQL-created rol desteği **belgeli**; bu özel BYPASSRLS/izolasyon bileşiminin bu proje üzerinde kabulü **doğrulanmamış**. neon_superuser üyeliği veya owner credential'ıyla bunu taklit etmek hedefi karşılamaz.

## PUBLIC TEMP: etkisi ve destek belirsizliği

[PostgreSQL GRANT](https://www.postgresql.org/docs/18/sql-grant.html) modelinde PUBLIC bütün mevcut/gelecek rolleri kapsar; rol bazlı revoke PUBLIC'ten gelen hak için DENY oluşturmaz. Development PUBLIC TEMP kaldırılırsa doğrudan/üyelik/superuser üzerinden TEMP almayan roller bu hakkı kaybeder. Açık grant ile dört mevcut Pusula rolünün efektif TEMP'i korunabilir; owner ve neon_superuser zaten explicit TEMP taşır; cloud_admin superuser'dır.

E2.2b minimal planında neon_service ve pg_* rollerinin rol bazlı TEMP sonucu değişir. LOGIN/CONNECT olmaması provider bakımının veya başka rol üyeliği üzerinden kullanımın hiç etkilenmeyeceğini kanıtlamaz. Internal rol credential'ına erişmek veya bu rolün nitelik/üyeliklerini değiştirmek desteklenen kullanıcı işlemi değildir. **Public belgelerde development PUBLIC TEMP kaldırılırken bütün provider işlevlerinin korunacağına dair bu özel senaryoyu kapsayan garanti bulunmadı.** Builtin/provider rollerine topluca explicit TEMP dağıtmak da en az yetki çözümü diye kabul edilmez.

Destek, hangi provider rollerinin bu DB'de TEMP'e ihtiyaç duyduğunu, bunu korumanın yetkili yolunu ve revoke'un compute restart/maintenance/autosuspend/restore üzerindeki etkisini teyit etmelidir. Bu yanıt yokken E2.2b SQL'i uygulanmaz. Test DB ACL'si ve production aynen bırakılır. Kod taramasında uygulamaya ait TEMP table kullanımı bulunmaması provider davranışının kanıtı değildir.

## neondb/postgres PUBLIC CONNECT: standart SQL ile provider desteğini ayırma

Kullanıcı tarafından yönetilen DB ACL'si standart PostgreSQL grant/revoke modeline tabidir; CONNECT bir DB nesne hakkıdır. Aynı branch'te başka bir DB'nin CONNECT ACL'sini düzenlemek için o DB'ye bağlanmak teknik olarak şart değildir; **bu yetki veya kullanıcı onayı olduğu anlamına gelmez**. Uygun sahip/grant option gerekir. [REVOKE](https://www.postgresql.org/docs/18/sql-revoke.html).

- **neondb:** katalogda neondb_owner sahibidir. Standart DB ACL düzenlemesi teknik olarak mümkün adaydır; Neon bakım/Console/araç kullanımında kimlerin explicit CONNECT alması gerektiği ve destek politikası teyit edilmelidir. “Sahibiyiz, dolayısıyla etkisiz ve desteklidir” sonucu çıkarılmaz.
- **postgres:** [Neon database belgesi](https://neon.com/docs/manage/databases) bu adı reserved olarak listeler. Katalog sahibi cloud_admin; mevcut kullanıcı NOSUPERUSER'dır. Eldeki ACL kanıtı owner login'inin postgres PUBLIC CONNECT'i değiştirebileceğini göstermiyor. Provider işlemi veya desteklenen başka izolasyon gerekebilir. Reserved ad olması her ACL işleminin yasak olduğunun kanıtı da değildir; **izin ve destek durumu belirsizdir**.
- Mevcut/public belgelerde bu iki özel DB için PUBLIC CONNECT revoke'un provider tarafından açıkça güvence altına alındığı bir prosedür bulunmadı. Belge yokluğu yasak olduğu anlamına gelmez. Denemek, provider rolü kullanmak veya izin genişletmek bu araştırmanın yolu değildir.

PUBLIC CONNECT kalırsa yeni backup credential'ı o DB'lerde oturum açabilir; uygulama tablolarına SELECT kazanması ayrı konudur. “İş verisine erişemez” ile “DB'ye bağlanamaz” aynı kriter değildir. Sadece source URL allowlist, pg_hba kuralıymış gibi sunulamaz. Müşteri Neon pg_hba/host işletim sistemini yönetmez; role ALTER DATABASE ayarı veya search_path da bağlantı yasağı değildir.

**Ek kanıt sınırı:** E2.2b'nin diğer-DB envanteri ve taslak kapısı template DB'leri dışlıyordu. Bu nedenle template1 gibi bağlantıya açık olabilecek şablon DB'ler için izolasyon kanıtı yoktur. “Yalnız development CONNECT” kabulü öncesi bütün `datallowconn=true` DB'ler, template bayrağına bakılmadan salt okunur katalogda değerlendirilmelidir. Hiçbirine bağlantı denemesi gerekmez. Bu sprint yeni sorgu yapılmadı; şablonların gerçek ACL'si varsayılmadı. E2.2b guard'ı bu haliyle tam izolasyon kanıtı sayılmaz ve uygulanmadan önce düzeltilmelidir.

## Seçenek karşılaştırması

Maliyetler aşağıdaki güncel tarife varsayımlarına dayanır; mevcut hesap planı/kota/fatura Console'dan açılmadı. Hiçbir kaynak oluşturulmadı. Güvenlik puanı, henüz gerçekleşmemiş provider teyidini olmuş kabul etmez.

| Model | Uygulanabilirlik ve izolasyon | Mevcut uygulama etkisi | Maliyet/operasyon | E2 uyumu ve karar |
| --- | --- | --- | --- | --- |
| **Mevcut development + destek teyitli seçici ACL + dar SQL login** | İki PUBLIC kapısı provider destekli çözülürse hedefi sağlar; şu an koşullu | Test/production ACL değişmez; development mevcut rol hakları korunmalı, provider etkisi teyit edilmeli | Yeni kaynak yok; bakım ve doğrulama işi düşük/orta | Aynı hedef/format korunur; ek DB CONNECT guard'ı gerekir. **Tek öneri** |
| Ayrı geçici child backup branch | Parent veri/ACL'sini değiştirmez; fakat bütün DB/roller kopyalanır, PUBLIC sorunları da taşınır | Canlı uygulama değişmez; auth/session dahil hassas kopya ve aynı credential riski doğar | Compute, eski veriyi tutan storage, kota/branch lifecycle yönetimi | Sabit hedef guard'ı reddeder; yeni allowlist/provenance, zaman etiketi, reset/secret/cleanup tasarımı gerekir. Kendiliğinden çözüm değil |
| Ayrı Neon projesi | Ayrı yönetim/credential alanı; fakat reserved postgres/PUBLIC varsayılanlarını otomatik çözmez | Canlı app değişmeden tutulabilir; veriyi taşıma/senkronizasyon için gerçek transfer onayı gerekir | Ek storage/compute/aktarımı ve işletim işi en yüksek | Hedef/şema/rol hazırlığı ve kaynak doğruluğu yeniden tasarlanır; bugünkü backup engelini ilk transfer için de çözmek gerekir |
| Neon Instant Restore / snapshot | Provider içinde hızlı kurtarma; dar SQL backup hesabı gerektirmeyen kontrol düzlemi | Restore işlemi uygulanırsa hedef veriyi etkiler; ayrı boş hedef/restore onayı gerekir | Kota/history/snapshot maliyeti; düşük günlük operasyon | E2 şifreli R2 arşivi üretmez; sağlayıcı dışı bağımsız yedek kabulü değildir. Yalnız tamamlayıcı |
| Ayrı kontrollü read replica | Aynı branch'in rol/ACL durumunu taşır; endpoint read-only olması credential'ın primary'de kullanımını engellemez | Okuma yükünü ayırabilir; mevcut rol izolasyonunu çözmez | Ek compute ve endpoint yönetimi | Hedef allowlist değişir; bypass/CONNECT sorunları kalır, tek başına uygun değil |
| Kontrollü operatör/admin dump | Onaylı kısa süreli prosedür teknik olarak export yapabilir; credential hâlâ geniş yazma/yönetim gücündedir | Canlı okuma yükü; operatör hatası ve credential riski yüksek | Yeni kalıcı kaynak yok; manuel iş ve denetim maliyeti yüksek | Mevcut E2 role guard'ı reddeder. Guard gevşeterek kullanılmaz; en az yetki hedefini sağlamaz ve önerilmez |

[Neon branching](https://neon.com/docs/manage/branches) child'ı parent'tan bağımsız copy-on-write veri kopyası olarak tanımlar. [DB kopyalanması](https://neon.com/docs/manage/databases) ve [rol kopyalanması](https://neon.com/docs/manage/roles) nedeniyle yeni branch yalnız hedef DB'yi otomatik seçmez. Parent'taki sonradan değişiklikler child'a sürekli replike edilmez; her dump'ın kaynak anı ve freshness'ı ayrıca tanımlanmalı. Branch reset eski ACL/credential durumunu geri getirebileceğinden tekrar doğrulama zorunludur. Yeni branch/proje, aynı provider/hesap altında kalırsa sağlayıcıdan bağımsız R2 kopyasının yerini tutmaz.

## Tahmini maliyet — 18.10.2026 fiyat kontrolü

[Güncel Neon fiyat sayfası](https://neon.com/pricing): Free için proje başına 100 CU-saat/ay ve 1 GB; Launch compute **$0.106/CU-saat**, storage **$0.35/GB-ay**. Launch'ta 10 branch dahil; aşım **$0.002/branch-saat**. History **$0.20/GB-ay**; snapshot **$0.09/GB-ay**. Free restore sınırı 6 saat veya 1 GB değişim; 1 snapshot. Bu genel tarife, mevcut hesabın hak/fatura garantisi değildir.

Kendi hesap örneğimiz: yalnız backup yüzünden ek 0.25 CU'nun günlük 10 dakika çalışması ayda yaklaşık 1.25 CU-saat, Launch'ta **$0.13 compute** yapar. Ayrı projede 1 GB ek depolama bunun üstüne yaklaşık **$0.35/ay** ekler. Dahil branch kotası aşılırsa 30 gün açık tek ek branch yaklaşık **$1.44/ay** branch bedeli doğurur; compute/storage/history/transfer ayrıca hesaplanır. Uyanma/boşta bekleme ve gerçek dump süresi dahil değildir; bunlar ölçüm değil varsayımdır.

Önerilen mevcut-branch rol/ACL modeli yeni kaynak için **$0 sabit ek kaynak** gerektirir; dump'ın compute/transferi ve ileride R2 istek/depolama ücretleri sıfır sayılmaz. Community destek kanalı bulunabilir; teknik destek SLA'sı veya ücretli plana geçiş gereksinimi hesap planına göre ayrıca doğrulanır. [Destek seçenekleri](https://neon.com/docs/introduction/support). Hiçbir upgrade veya ücretli destek satın alınmadı. E2.2c belge araştırması için Neon compute uyandırılmadı.

## Provider backup seçeneğinin sınırı

[Neon backup rehberi](https://neon.com/docs/postgres/backup-restore/backups) hızlı geri dönüş ve standart pg_dump iş akışlarını ayırır; [pg_dump rehberi](https://neon.com/docs/manage/backup-pg-dump) dış platform kopyası/uzun arşiv için direct bağlantılı export önerir. Native history/snapshot, E2'nin operatör anahtarıyla AES-GCM şifrelenmiş ve R2 readback ile doğrulanmış nesnesi değildir. Native özellik var diye bağımsız backup tamamlandı denmez; Console'daki gerçek restore window/snapshot erişimi de bu çalışmada doğrulanmadı. Kısa süreli restore ile çok yıllık dış arşiv ayrı ihtiyaçlardır.

## E2 motoruyla güvenli çalışma koşulları

Önerilen yöntemde mevcut development direct allowlist, PG18.6 araçları, verify-full/CA, pusula_backup adı, 35 tablo/21 FORCE RLS, function hash ve snapshot guard'ları korunur. Mevcut AES-GCM/manifest/R2 formatını değiştirmek gerekmez. Geniş owner/admin kabulü için role guard gevşetilmez; TEMP sorunu kodda istisna yapılarak aşılmaz.

**Açık motor eksikliği:** mevcut preflight TEMP/üyelik/sahiplik denetler, fakat diğer DB'lerde bu credential'ın efektif CONNECT hakkını ayrıca reddetmez. Dar hesap kurulmadan önce onaylı kod işiyle pg_database + has_database_privilege üzerinden current DB dışında connectable DB erişimini metadata aşamasında fail-closed kontrol etmek, izole testlerini eklemek gerekir. Provider'ın alternatif izolasyon modeli bunu katalog ACL'si dışında uyguluyorsa bu kanıt/denetim yolu ayrıca tasarlanmalı; varsayım ile PASS verilmemeli.

Branch/proje alternatifleri mevcut sourceTarget tarafından reddedilir. Rastgele env URL kabulü eklemek çözüm değildir; proje/branch/host/DB provenance ve izinli hedef modeli ayrıca incelenir. Read replica veya eski child snapshot'ta hangi tarihin yedeklendiği manifestte güvenilir biçimde temsil edilmelidir. Bu sprint E2 kodu değiştirilmedi.

## Neon desteğine gönderilebilecek kısa taslak — GÖNDERİLMEDİ

**Subject: Least-privilege BYPASSRLS backup login on Neon PostgreSQL 18 — TEMP and cross-database CONNECT**

We need a dedicated SQL-created backup login on a development branch. It must have direct BYPASSRLS and SELECT on the application tables (including FORCE RLS), but no superuser, CREATEDB, CREATEROLE, replication, ownership, memberships, write, CREATE or TEMP privileges. It must connect only to the application development database.

Our read-only catalog audit shows PUBLIC TEMP on the application database and PUBLIC CONNECT on neondb and postgres. The postgres database is owned by a provider-managed role. We have made no ACL or role changes.

Please confirm:

1. Is creating this direct-BYPASSRLS SQL login without neon_superuser membership supported on PostgreSQL 18? Which operator privileges are required?
2. Can PUBLIC TEMP safely be revoked on our application database while explicitly preserving application-role TEMP? Which internal/builtin roles require preservation, and by which supported mechanism?
3. Is restricting PUBLIC CONNECT on neondb and the provider-owned postgres database supported? Who can perform it, which internal access must remain, and could management, maintenance or restore operations be affected? Please also cover any connectable template database.
4. If those ACL changes are unsupported, is there a provider-enforced way to restrict this login to one database while retaining SELECT/BYPASSRLS? Please distinguish a connection restriction from absence of table privileges.
5. Please provide a supported validation/rollback procedure and any plan/cost requirements. Production and the existing test database must remain unchanged.

No passwords, connection strings, project/branch/host identifiers, data, user accounts, tokens, MFA material or dump files are included. We can provide identifiers privately through an authenticated support channel if required and separately authorized.

Bu taslak e-posta/API/Discord üzerinden gönderilmedi. Gönderim, kimlik bilgisi ekleme ve olası ücretli destek ayrı açık kullanıcı onayı ister.

## Ayrı onaylar ve kabul sırası

1. Destek taslağını yetkili kanaldan gönderme onayı; özel identifier paylaşımı gerekiyorsa ayrıca sınırlandırma. Provider yanıtı gelene kadar yeni rol/ACL yok.
2. Yanıta göre E2.2b planını revize etme: seçici TEMP koruması, yalnız mevcut development branch'indeki neondb/postgres CONNECT için desteklenen çözüm, grantor/rollback ve uygulama/provider etkileri. Test DB ACL/production değişikliği kapsam dışı kalır. Provider tüm koşulları desteklemiyorsa dur.
3. Bağlantı izolasyon guard'ı ve izole testleri için ayrı kod işi; hedef model/credentials/secret rotasyonu incelemesi. Gerçek key/KEY_ID/offline kopyalar E2.3 onayını korur.
4. **Yeni açık uygulama onayı:** adı belirtilmiş role CREATE/BYPASSRLS/CONNECT/USAGE/SELECT ve tam listeli ACL değişiklikleri. Destek yanıtı kullanıcı onayı yerine geçmez; E2.2b SQL'i kendiliğinden çalıştırılmaz.
5. Ayrı metadata/TLS hesap doğrulaması; sonra ayrı tam sayım/migration kapsamı; ayrı gerçek dump/yerel verify; ayrı R2 upload/readback; ayrı restore/E3/E4 kapıları.

Mevcut uygulama/runtime/auth hesapları yeni backup kimliği olarak kullanılmaz. Hiçbir Master/MFA/iş kaydı, rol, ACL, RLS, migration, branch/proje veya production/test DB değiştirilmedi. Yeni bağlantı, dump, upload veya delete yapılmadı. Teslim yalnız bu seçenek raporu ve durum dokümantasyonudur; uygulama testleri tekrar çalıştırılmadı.
