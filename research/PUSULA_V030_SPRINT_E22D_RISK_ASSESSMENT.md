# Sprint E2.2d — kontrollü backup modeli ve gerçek fixture risk kanıtı

18.10.2026 · `feat/pusula-v030-neon-cloud` · başlangıç `097fef7`.

## Sonuç

**Alternatif B, hayalî veride tam dump/şifreleme açısından teknik olarak çalıştı; Strict ile eşdeğer veya gerçek Neon için güvenli kabul edilmedi.** Varsayılan Strict korundu. Managed aday yalnız ayrı seçimle yerel fixture'da çalışabilir. Gerçek Neon kullanımı, diğer DB nesne izinleri ve kabul edilmemiş riskler nedeniyle kodda **MANAGED_REMOTE_OBJECT_AUDIT_REQUIRED** ile bağlantıdan önce engellidir. Bir operatör bayrağı bu engeli kaldırmaz.

E2.2c dosyasında “B” etiketi yoktu; bu çalışmada kullanıcının yeni tanımı esas alındı: **PUBLIC TEMP/CONNECT değişmeden dar SELECT + doğrudan BYPASSRLS**. Önceki E2.2c önerisi tarihsel kaldı; bu teslim o önerinin SQL uygulaması değildir.

Son gerçek Managed fixture **43/43 PASS**; güçlendirilmiş Strict gerçek fixture regresyonu **14/14 PASS**. Bu 57 kontrolün içinde beklenen güvenlik açıklarının yeniden üretilmesi de PASS'tir; “57 test geçti, dolayısıyla sistem risksiz” sonucu çıkarılmaz. Neon hesabı, kalıcı şifreleme anahtarı, gerçek dump veya R2 onayı verilmedi/işlemi yapılmadı.

## Politikalar ve uygulanabilir durum

| Konu | strict-v1 (varsayılan) | managed-neon-candidate-v1 (aday) |
| --- | --- | --- |
| Efektif TEMP | Kapalı olmalı | Yalnız PUBLIC kaynağı gözlenmiş TEMP istisnası; doğrudan TEMP grant reddedilir |
| Diğer connectable DB'ler | CONNECT kapalı olmalı; template1 dahil | Yalnız PUBLIC CONNECT istisnası; ek doğrudan grant reddedilir |
| Rol/kimlik | İzinli development veya fixture backup login | Aynı; runtime/auth/owner/production yok |
| BYPASSRLS | Doğrudan zorunlu | Doğrudan zorunlu |
| Yönetici özellikleri, üyelik, sahiplik, uygulama yazma/DDL | Reddedilir | Aynı kontroller; istisna uygulanmaz |
| Nesne/fonksiyon kapsamı | Mevcut E2.2a fail-closed kontrolleri | Aynı; unknown/drift reddedilir |
| Diğer DB kullanıcı nesneleri | Bağlantı kapısı yeterli olmalı; anlık ACL kanıtı | Ayrı denetim zorunlu; source metadata tek başına yeterli değil |
| Gerçek Neon | Uygun hesap ve bütün kabul kapıları sonrasında mümkün | **Etkinleştirilmedi; remote gate kapalı** |

Strict adı bir PostgreSQL sandbox sertifikası değildir. Her iki modelde PUBLIC builtin fonksiyonların tüm yan etkilerini yasaklayan genel bir mekanizma yoktur. Large object kanıtı aşağıda bu sınırı gösterir. Kontroller mevcut yetki/nesne durumunu denetler; rolün gelecekte yapabileceği her işlem için mutlak güvence vermez.

## Risklerin gerçek sonuçlarla ayrımı

| İzin/yol | Gerçek fixture sonucu | Güvenlik anlamı |
| --- | --- | --- |
| SELECT + BYPASSRLS | FORCE RLS Tenant tablosundaki iki hayalî tenant okundu; 35 tablo kaynak/arşiv sayımı eşleşti | RLS hiçbir tenant/auth gizlilik sınırı sağlamaz; SELECT verilen bütün satırlar okunabilir |
| Tablo INSERT/UPDATE/DELETE | Her biri PostgreSQL 42501 ile reddedildi | Uygulama tabloları normal DML'den korunuyor; READ ONLY ayarına dayanılmadı |
| Public schema CREATE, mevcut tablo ALTER/DROP | Her biri 42501 ile reddedildi | Kalıcı uygulama DDL yetkisi yok |
| SET ROLE fixture_admin / GRANT admin / CREATE ROLE | 42501 ile reddedildi | Rolün kendiliğinden yöneticiye yükselmesi bu senaryolarda engellendi |
| Uygulama ownership | Public uygulama tablolarında sahiplik 0 | Yalnız uygulama nesneleri için anlık kanıt; bütün nesne türleri için mutlak iddia değil |
| Sequence nextval | 42501 ile reddedildi; sequence yalnız fixture admin'i tarafından oluşturulup kaldırıldı | SELECT kapsamı sequence USAGE/UPDATE içermez; gelecekte sequence eklenmesi ayrıca inceleme ister |
| PUBLIC TEMP | CREATE TEMP TABLE, INSERT, ALTER ve DROP başarılı | “Hiç DDL/DML yapamaz” sözü yanlıştır: kendi geçici nesnelerini yönetebilir, kaynak tüketebilir |
| PUBLIC CONNECT | Diğer hayalî DB'ye oturum açıldı | CONNECT, kullanıcı tablosuna SELECT değildir; katalog görünürlüğü ve oturum/kaynak kullanımı yine vardır |
| Diğer DB private tablo SELECT | 42501 ile reddedildi | BYPASSRLS, SELECT ACL'sini otomatik vermez |
| Diğer DB'de sonradan PUBLIC tablo SELECT | Hayalî secret satırı okunabildi; preflight drift'i reddetti | Gelecekte admin/default ACL değişimi credential'ın veri erişimini büyütebilir |
| Diğer DB'de PUBLIC kolon SELECT | Tablo SELECT grant'ı olmadan o kolon okunabildi; preflight reddetti | Sadece has_table_privilege incelemesi yetersiz; kolon ACL de gerekir |
| Public trigger fonksiyonu EXECUTE | EXECUTE açık; doğrudan çağrı 0A000 ile reddedildi | Trigger fonksiyonunun çağrı sınırı korundu; her PUBLIC fonksiyonun zararsız olduğu sonucu çıkarılmaz |
| pusula_can EXECUTE | Backup login için 42501 | RLS yardımcı fonksiyonuna runtime grant'ı backup'a taşınmadı |
| Diğer DB'de PUBLIC SECURITY DEFINER fonksiyonu | Admin'in eklediği fonksiyon private hayalî satırı backup'a sızdırdı; preflight reddetti | EXECUTE + definer sahipliği, tablo SELECT'i olmadan sızıntı yolu oluşturur |
| PUBLIC builtin lo_create | Backup kendi kalıcı large object'ini oluşturdu; ownership metadata'sı doğrulandı | TEMP/CONNECT dışındaki mevcut PUBLIC fonksiyonlar da yetenek kazandırabilir; sıfır kalıcı ownership hedefi mutlak olarak kanıtlanmadı |

Large object yalnız yeni fixture'da oluşturuldu; üretilen OID doğrulandı, aynı login `lo_unlink` ile yalnız o nesneyi kaldırdı. Nesne mevcutken preflight SOURCE_OBJECT_OWNER_REJECTED verdi. Bu **tespit** yeteneğidir; çalınmış credential'ın sonraki lo_create çağrısını önleyen server-side yetki değildir. PUBLIC builtin fonksiyon yetkileri Strict'in TEMP/CONNECT kısıtlarından da bağımsız incelenmelidir; Strict için bu builtin yeteneğinin kapalı olduğu iddia edilmez.

[PostgreSQL RLS](https://www.postgresql.org/docs/18/ddl-rowsecurity.html), BYPASSRLS'nin FORCE RLS'yi aşmasını açıklar; tablo/kolon ACL yine gereklidir. [GRANT](https://www.postgresql.org/docs/18/sql-grant.html), PUBLIC haklarının toplamsal olduğunu ve fonksiyon/sequence gibi farklı nesne izinlerini tanımlar. [Neon roller](https://neon.com/docs/manage/roles) genel SQL-created dar rol desteği sağlar; yerel superuser ile oluşturma Neon provider kabulünü kanıtlamaz.

## Ele geçirilmiş credential ve kalan riskler

Backup kimliği bütün development tenant/şirket/müşteri/fiyat/teklif/satış ve SELECT kapsamındaki Auth/MFA/session verilerini okuyabilir. Şifreli yedek formatı, canlı SQL credential'ı ele geçirilince yapılacak SELECT'i şifrelemez veya engellemez. Bu çok tenantlı veri sızıntısı etkisi, backup amacıyla bilinçli verilmiş geniş okuma yetkisidir. Gerçek anahtar ve DB credential ayrı saklanmalı; uygulama/browser runtime'ına verilmemelidir.

TEMP dosyası/disk/compute/katalog yükü, uzun sorgu/oturum tüketimi, geçici nesne sahipliği ve PUBLIC builtin yan etkileri kalır. CLI statement timeout/read-only/search_path savunmaları saldırganın başka istemciyle değiştiremeyeceği bir server kuralı değildir. Diğer DB'deki mevcut/gelecek PUBLIC SELECT, kolon ACL, definer fonksiyon veya schema CREATE erişimi riski büyütür. Şu anki katalog denetimi, dump sonrasında gelecek grant'leri önlemez; DB'ler arası denetimler tek bir atomik global snapshot oluşturmaz. Maintenance/concurrency, credential rotasyonu, fonksiyon/default ACL değişim yönetimi ve izleme ayrıca gerekir.

Neon'da diğer DB'lere bağlanmadan bunların pg_class/pg_attribute/pg_proc içeriklerini kaynak DB kataloğundan tam görmek mümkün değildir. Branch düzeyi CONNECT metadata'sı “objectAccess doğrulandı” diye etiketlenemez. Gerçek neondb/postgres/test/template DB'lerin nesne hakları bu sprintte okunmadı; **UNKNOWN, kabul edilmedi**. Bu nedenle üretim veya gerçek development Managed dump aktif değildir.

## Kod tasarımı ve denetlenebilir seçim

Yeni `policy.ts`: açık politika enum'u, varsayılan Strict, bilinmeyen değer reddi; hiçbir skipSecurityChecks bayrağı yok. Aday seçimi için **iki birlikte koşul** tasarlandı: `BACKUP_SECURITY_POLICY=managed-neon-candidate-v1` ve `--select-managed-neon-candidate`. Bunlar bir sonraki risk kabulü/gerçek kaynak onayının yerine geçmez. NODE_ENV=production ve izinli olmayan kaynak host/DB/rol her koşulda reddedilir.

`inspectSource` daha önce URL guard'ı çağıranın sorumluluğundayken artık kendisi de sourceTarget doğrular. Managed remote kaynak bağlantıdan önce reddedilir. Strict, `datallowconn=true` bütün DB'leri (template dahil) kontrol eder; diğer DB'de CONNECT varsa reddeder. Aday, PUBLIC/direkt CONNECT durumunu ayrı işler. Mevcut E2.2a rol/üyelik/ownership/column-write/schema/function drift kontrolleri korunur.

Yalnız izinli loopback fixture modu, aynı hayalî credential ile postgres/template1/pusula_backup_fixture_other kataloglarına READ ONLY bağlanıp schema CREATE, kullanıcı tablo/kolon hakları, callable kullanıcı fonksiyonları, sequence ve ownership denetler. Bilinmeyen DB adı veya gözlenen kullanıcı nesne erişimi reddedilir. Bu, yeni yerel cluster üzerinde kontrollü kanıttır; remote audit desteği olarak sunulmaz. Builtin fonksiyonların tamamı ve gelecekteki ACL değişimleri için kapsamlı sandbox analizi değildir.

Rapor `selectedSecurityPolicy` ile operatör seçimini, `securityPolicy` ile arşivin kayıtlı politikasını ayırır. DB erişim raporu CONNECT/PUBLIC/direkt grant ve nesne erişim durumunu ayrı taşır; yerel incelenen nesneler `fixture-catalog-audited-no-user-object-access`, kaynak `source-audited-separately`, bağlanılamayan DB `not-connectable-at-audit-time` olarak etiketlenir. Gelecek erişimsizlik garantisi verilmez.

Yeni manifestler `securityPolicy` içerir; alan manifest HMAC ve AES-GCM AAD içine girer. Politika etiketini değiştirmek doğrulamayı bozar. Önceki v1 manifestlerinde alan yoksa yeni okuyucu eski AAD/MAC ile doğrular, rapor **legacy-unrecorded** der; eski arşiv Strict diye yeniden etiketlenmez. Eski okuyucu yeni alanı tanımayabileceğinden restore/verify aracı bu sürümle eşleştirilmelidir. Fixture manifesti sourceEnvironment=fixture kalır; mevcut storage upload guard'ı bunu reddeder. Gerçek şifreleme anahtarı üretilmedi.

## Gerçek PostgreSQL fixture ortamı ve kanıt

Yalnız daha önce sabit SHA-256 ile doğrulanan resmî EDB PostgreSQL18.6 taşınabilir araçları kullanıldı. postgres/initdb/pg_ctl/pg_dump/pg_restore/psql **18.6**. Archive pin `e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2` her koşu öncesi doğrulandı; EXE Authenticode durumu önceki onaylı **NotSigned** istisnasını korur, imzalı denmedi. Yeni indirme/kurulum/Windows servisi/PATH değişikliği yok.

Yeni UUID data dizinleri `.data/fixtures` içinde, operatör/SYSTEM ACL ile sınırlı; 127.0.0.1:55432, SCRAM-SHA-256, rastgele geçici parolalar ve bellekte rastgele fixture anahtarı kullanıldı. Trust/dış ağ yok. Fixture runner `.env` yüklemez; Neon/R2 istemcisi çalıştırmaz. Admin ve fixture rolleri yalnız bu yeni cluster'da yaratıldı. İki hayalî tenant ve ilişkili müşteri/malzeme/satış; 13 migration, 35 tablo, 21 FORCE RLS; AuthUser hayalîdir, gerçek MFA/session yok. Başka DB yalnız aynı yeni yerel cluster içinde eklendi.

| Son koşu | Managed aday | Strict regresyon |
| --- | --- | --- |
| Fixture ID | e22d-9e5ead4d-2555-476f-8e78-b12a02c2d7f3 | e21b-86cc95f9-12f0-41dd-a01a-e7b85fde0d6e |
| Sonuç | **43/43 PASS**, exit0 | **14/14 PASS**, exit0 |
| PID / port | 13116 / 55432 | 12380 / 55432 |
| Gerçek pg_dump -Fc / pg_restore --list | PASS / PASS | PASS / PASS |
| Satır ve ilişkisel kapsam | 35 tablo satır sayısı; 43 FK, 43 policy, 11 trigger | Aynı |
| AES-GCM/SHA-256/HMAC | PASS | PASS |
| Yanlış key/değişmiş manifest/bozuk ciphertext | Reddedildi | Reddedildi |
| Yanlış parola/non-bypass dump/geçersiz arşiv | Sıfır olmayan araç çıkışı | Aynı |
| Güvenli kapanış | PID/path/executable/oluşturulma zamanı kontrolü; durdu | Aynı |

Managed ciphertext 144831 byte, SHA-256 `ccef84d8702c75e087270877d042367bcdc7049a827747594579839de8cee6ae`. Strict ciphertext 144947 byte, SHA-256 `0e36bd901ec72cb459c3ccff6fa219b9cda36702b4a870744ee1b38fd69b88db`. Test anahtarları RAM'de üretildi ve sonunda sıfırlandı; fixture dosyaları Git dışında bırakıldı, toplu silme yapılmadı. Dump plaintext yalnız ACL korumalı fixture dizinindedir. pg_restore --data-only --file yalnız arşiv COPY sayımı için SQL çıkardı, DB'ye restore yapılmadı; E4 kabulü yok.

İlk Managed koşu35/35, kapsam genişletilmiş koşu41/41, builtin/ownership kanıtı eklenen son koşu43/43 geçti; eski koşular son toplama eklenmedi. Üç Managed cluster da güvenli kapandı. Strict14 ayrıca geçti. Her koşu yalnız kendi PID/data dizinini durdurdu; başka PostgreSQL/uygulama süreci sonlandırılmadı. Son bağımsız kontrolde fixture executable yoluna ait süreç0 ve 55432 listener0 doğrulandı. İzinli yerel child-process koşuları kullanıldı, güvenlik kontrolleri kapatılmadı.

## Ek yerel dosya dağıtım koruması

Build sırasında mevcut rate-store `.data` erişiminin 13329 yerel dosyayı Next sunucu output trace'ine kattığı görüldü. Bunlar yalnız Git ignore ile korunmuş sayılmaz. Yerel Next16 output rehberi okunarak next.config.ts içinde bütün `.data/**/*` server trace'lerinden dışlandı. Son build'in **16 NFT trace'inde .data girdisi 0**. Rate-store uygulama mantığı/dosyaları değiştirilmedi; runtime rate cache hâlâ deployment'ın yazılabilir yerel alanındadır, yerel operatör cache/fixture'ları web paketi olarak taşınmaz.

Turbopack geniş `.data` pattern performans uyarısı hâlâ görülebilir; final trace dışlaması doğrulandı, sıfır build warning iddia edilmez. Bu, dağıtım yapıldığı anlamına gelmez; deploy yapılmadı. Client secret taraması ve Git dışı dosya kontrolü ayrıca teslim öncesi yapılır.

## Test sonuçları ve sınırları

| Kontrol | Sonuç |
| --- | --- |
| TypeScript | PASS |
| ESLint | PASS, 0 hata/uyarı |
| Vitest tam uygulama + E2 izole regresyonu | **222/222**, 20 dosya, 11.91 s; önceki195 +26 politika testi +1 Managed upload engeli |
| E2 alt kümesi | **118 test**; policy/source/crypto/storage izolasyonu |
| Gerçek yerel PostgreSQL | Son43 Managed +14 Strict PASS |
| Build | PASS, Next16.4.1; yukarıdaki pattern uyarısı mevcut |
| Web server dağıtım trace kontrolü | 16 trace, .data girdisi0 |
| Sır taraması | PASS; 16 teslim dosyası ve 23 production client JS dosyasında yapılandırılmış yerel sır eşleşmesi yok |

Unit testlerde gerçek PG bağlantısı mock/spy ile engellenir; politika/default/production/unknown-role/metadata/diğer DB CONNECT/TEMP/legacy-manifest/tamper senaryoları izoledir. Gerçek fixture, bu testlerin yerine geçen sahte TOC değildir; pg_dump/pg_restore gerçekten çalıştı. Gerçek Neon DB/API/Auth/browser suite'leri çalıştırılmadı; mevcut test DB ve Master'a dokunmamak için bunlar yeni PASS diye sunulmadı. Gerçek Safari/Firefox/ekran okuyucu veya production performans kabulü yok.

## Kabul sorularına yanıt ve sonraki kapılar

1. **Teknik uygulanabilirlik:** Hayalî ortamda evet, tam backup üretildi; gerçek Neon provider/nesne izinleri için henüz kabul yok.
2. **Strict'e göre risk:** TEMP ve diğer DB CONNECT açık; kaynak tüketimi, geçici DDL ve gelecek PUBLIC erişim yolları eklenir. Builtin large object riski ayrıca keşfedildi; bu iki istisnaya indirgenemez.
3. **Gerçekten yapılabilen:** SELECT verilen bütün tenant'lar, geçici nesne DDL/DML, diğer DB oturumu, PUBLIC kaynaklı veri/fonksiyon erişimi ve lo_create sahipliği bu fixture'da gösterildi.
4. **Engellenen:** Denenen uygulama DML/kalıcı DDL, SET/GRANT/CREATE ROLE, yetkisiz sequence ve private tablo okuması; preflight rol/üyelik/yazma/definer/kolon drift'leri. Bu sınır örnekleridir; bütün SQL komutlarının formel ispatı değildir.
5. **Diğer DB CONNECT:** PUBLIC/table/column EXECUTE/default ACL değişirse veri sızıntısı, başka durumda bile katalog/oturum/kaynak riski. Metadata tek başına tüm DB nesnelerini kanıtlamaz.
6. **BYPASSRLS okuma sınırı:** Nesne/kolon SELECT ACL'siyle; tenant RLS'siyle değil. Yeni SELECT grant/default ACL incelemesi şarttır. İzinli Auth/MFA verileri de yüksek hassasiyettedir.
7. **Motor değişikliği:** Politika seçimi/kimliği, authenticated manifest etiketi, Strict cross-DB CONNECT guard'ı, fixture-only managed nesne denetimi eklendi. Gerçek Neon için hâlâ ayrı yetkili cross-DB inceleme/kanıt/TTL/risk kabul protokolü, builtin yetenek ve concurrency/drift yönetimi tasarımı gerekir; uzaktan engel kaldırılmadı.
8. **Gerçek rol öncesi risk kabulü:** Bütün tenant/Auth okuması; TEMP kaynak tüketimi; diğer DB katalog/oturum ve gelecekteki PUBLIC grants; builtin persistent-ownership açığı; credential/anahtar izolasyonu. **Bilinmeyen diğer DB hakları kabul edilmiş sayılmadı.** Bunlar çözülmeden veya yeni açık ve gerekçeli risk kararı olmadan aday etkinleşmez. Public builtin ACL değiştirme bu sprintin onayı değildir.
9. **Strict'e geçiş:** Provider destekli TEMP/CONNECT/builtin planı ayrı onayla; bütün connectable DB'lerde kanıt; yeni metadata ve gerçek fixture regresyonu; BACKUP_SECURITY_POLICY=strict-v1 ve aday seçim bayrağının kaldırılması. Eski manifest politikası değiştirilmez, yeni arşivler Strict etiketi taşır. Geçiş otomatik ACL işi yapmaz.
10. **Production önerisi:** Hayır. Aday yalnız development araştırmasıdır; gerçek development için de şu anda kapalıdır. Production kaynakları source allowlist/NODE_ENV/manifest environment sınırlarını aşamaz. Gerçek production tasarımı bu sprintin dışında kalır.

**Ayrı kullanıcı onayı gerektiren sonraki işler:** yeni Neon backup hesabı/SELECT/BYPASSRLS kurulumu, başka gerçek DB'lere salt okunur nesne denetimi için kapsam, kalıcı key/KEY_ID/offline kopyalar, gerçek development dump, R2 upload/readback. Bunlar toplu tek onay gibi yorumlanmaz. Neon CREATE/ALTER/DROP ROLE, GRANT/REVOKE veya PUBLIC TEMP/CONNECT değişikliği bu çalışmada yapılmadı. Production, mevcut Neon test DB, Master/MFA ve gerçek iş kayıtlarına hiçbir işlem uygulanmadı.
