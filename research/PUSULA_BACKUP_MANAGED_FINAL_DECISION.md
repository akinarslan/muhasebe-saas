# PUSULA — Backup managed son güvenlik kararı

Tarih: 23 Ekim 2026. **Sonuç: ROLE_BLOCKED — mevcut managed aday gerçek Neon backup kullanımına hazır değildir.** Dar NOLOGIN rol teknik olarak mümkün olmakla birlikte, PUBLIC kaynaklı erişimin güvenlik kabulü ve gerçek cross-database kanıtı eksiktir. Guard'lar değiştirilmeyecek.

## Yeniden kullanılan kanıt

- [Rol kararı](PUSULA_NEON_BACKUP_ROLE_DECISION.md), [backup kabulü](PUSULA_BACKUP_LIVE_READINESS.md), [yerel doğrulama](../docs/validation/PUSULA_BACKUP_LIVE_VERIFICATION.md) ve `scripts/backup/{policy,source-security,postgres,storage}.ts` incelendi.
- Önceki provider GET'leri: **23 Ekim 12:56 UTC**, proje `icy-queen-44442204`, development branch `br-rough-darkness-ba6ow9zo`, endpoint `ep-blue-breeze-bavbjb7l`. Kaynak katalogları **12:57:39 UTC**, database grant authority ölçümü **12:59:36 UTC**; PostgreSQL 18.6, kaynak 40 tablo / 26 FORCE RLS, `pusula_backup` henüz yok. Bu görevde yeni GET/SQL veya başka DB bağlantısı yapılmadı.
- Kaynak `pusula_development` üzerinde PUBLIC TEMP var. Üyeliksiz aday, PUBLIC CONNECT nedeniyle **`neondb`, `postgres`, `template1`** veritabanlarına da girebilir; ilk ikisinde PUBLIC TEMP de var. `template0` bağlantıya kapalı; test DB'sindeki TEMP tek başına CONNECT sağlamıyor. Başka DB'lerin nesne güvenliği kaynak kataloglarından görülemez.
- Mevcut aktör `neondb_owner`, kaynak rol/SELECT kurulumunu destekleyen CREATEROLE ve BYPASSRLS yetkilerine sahip. Ancak `cloud_admin` sahipliğindeki `postgres` / `template1` için ölçülen CONNECT/TEMP/CREATE grant authority yok. Bu, managed istisnanın güvenli olduğuna kanıt değildir.
- **494 grantor** incelemesi eski **10:46:07 UTC** snapshot'ına aittir: 494 eşleşme, eksik/beklenmeyen 0; sonuç `MATCH_REQUIRES_PROVIDER_REVIEW`, accepted=false. Yeniden ölçülmedi veya yeni role kabul sayılmadı. `ROLE_DELTA_UNRESOLVED` korunur.

## PUBLIC kaldırılmadan kabul edilebilecek sınır

Koşullu managed yol ancak **kalıcı iş verisine yetkisiz okuma/yazma ve kalıcı DDL olmaması** sözleşmesiyle değerlendirilebilir. “Hiçbir yazma yapamaz” veya “yalnız kaynak DB'ye bağlanabilir” garantisi verilemez: PUBLIC TEMP geçici nesne/veri yazmaya, PUBLIC CONNECT diğer DB'lere girişe izin verir. Role özel REVOKE ve NOINHERIT PUBLIC haklarını kaldırmaz; `default_transaction_read_only=on` değiştirilebilen varsayılandır, güvenlik sınırı değildir.

Bu yol için açık kabul gereken artık riskler: geçici nesneler, kaynak tüketimi, geçici nesne üzerinden isim gölgeleme ve izinlerin sonradan değişmesi. Ayrı backup oturumu, güvenli search_path/fonksiyon sözleşmesi, bağlantı/işlem sınırları ve export süresince yönetici/DDL/ACL değişikliklerinin kontrolü gerekir. Bunlar TEMP veya başka DB bağlantısını ortadan kaldırmaz. Sıfır TEMP / yalnız kaynak bağlantısı şartsa PUBLIC izinleri korunarak bu aday kabul edilemez; provider/sahip müdahalesi gerekir.

## Eksik kanıt ve ayrı inceleme yetkisi

**Şu an diğer DB'lere bağlantı yetkisi verilmiş sayılmıyor.** İstenen ayrı kapsam: yalnız aynı development branch'in doğrudan TLS doğrulamalı `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech:5432` hedefinde `neondb`, `postgres`, `template1` için mevcut yetkili aktörle **READ ONLY katalog incelemesi**; iş/Auth/MFA/session satırları, fonksiyon çalıştırma ve DDL/DML hariç. Production, recovery ve test hedefleri kapsam dışı.

Her DB'de bağımsız beklenen sözleşmeye göre aşağıdaki kanıt gerekir; gözlenen ilk sonuç beklenen sözleşme olarak öğrenilmez:

| Kanıt | Kabul / doğrulama yöntemi |
| --- | --- |
| Gerçek rolün effective hakları | NOLOGIN rol kurulduktan sonra owner oturumundan `has_*_privilege` sorgularında açıkça `pusula_backup` rolünü hedefle; owner'ın kendi haklarını ölçme. PUBLIC, doğrudan ACL, grantor, grant option, INHERIT/SET/ADMIN üyelik zincirlerini birlikte incele. LOGIN gerektirmez. |
| Schema / database / ownership | Database CREATE, schema CREATE, nesne sahipliği ve yetki yükseltme yolu olmamalı. TEMP ayrı kabul edilen istisna olarak raporlanmalı; schema USAGE tek başına veri hakkı sayılmamalı. |
| Diğer DB nesneleri | Tablo, partition, view, materialized view, foreign table ve kolonlarda effective SELECT/DML/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN; sequence SELECT/USAGE/UPDATE ve large-object erişimi incelenmeli. Kaynak dışı kullanıcı nesnelerine veri erişimi kabul edilmez. |
| Fonksiyonlar / uzantılar | Kullanıcı rutinlerinde EXECUTE olmamalı; SECURITY DEFINER sahipliği/search_path, erişim sağlayan view ve uzantılar incelenmeli. `pg_catalog` ve provider/extension rutinleri yalnız schema adıyla güvenli sayılmamalı; gerekli sistem çağrıları ile veri/yan etki sağlayan çağrılar ayrılmalı. Belirsiz ayrıcalıklı çağrı BLOCKED kalır. |
| Gelecek değişiklikler | Default ACL, PUBLIC yeni-rutin EXECUTE, yeni DB/nesne ve rol değişiklikleri değerlendirilip onaylı kontrata bağlanmalı; export öncesi drift reddi ve değişiklik kontrolü gerekir. |

Mevcut `auditManagedFixtureDatabases` yalnız fixture içindir; gerçek hedeflere uygulanabilir bir kabul değildir. Kullanıcı schema'larına odaklı boolean kontrolleri, bütün sistem/uzantı rutinlerinin güvenliğini kanıtlamaz. `BYPASSRLS` cluster kapsamlı olduğundan diğer DB veri erişiminin yokluğu özellikle önemlidir.

**Katalog incelemesinin sınırı:** statik ACL snapshot'ı fonksiyon/uzantıların bütün çalışma zamanı yan etkilerini, provider davranışını, sonraki ACL değişikliklerini veya farklı DB'ler arasında tek atomik güvenlik snapshot'ını kanıtlamaz. Belirsiz kod/provider yetkisi için bağımsız kod/provider kanıtı gerekir; gerçek DB üzerinde deneme amaçlı DML veya fonksiyon çalıştırma bu yetkiye dahil değildir. Tam export, anahtar erişilebilirliği, offsite kopya ve ayrı restore başarısı da kataloglardan doğrulanamaz; eski fixture kabulü gerçek kaynak kabulü değildir.

## Birbirinden ayrı onay kapıları

| Aşama | Somut işlem ve beklenen açık onay |
| --- | --- |
| 1 — NOLOGIN | Önceki rol kararındaki SQL'in yalnız `pusula_development` için NOLOGIN/PASSWORD NULL dar rol + 40 tablo SELECT/USAGE/CONNECT delta'sı. Admin üyeliği backup'a verilmez. Ters yöndeki creator ADMIN kaydı ve grantor ayrıca kabul edilmeli; M016 pre rol/ACL delta'sı uygulamadan önce bağımsız türetilmeli. Bu rapor kurulum onayı değildir. |
| 2 — Metadata kabulü | Yukarıdaki üç DB için ayrı bağlantı/katalog onayı; gerçek NOLOGIN rolün effective hakları, kaynak ve diğer DB sözleşmesi karşılaştırılır. Uygunsuz sonuçta LOGIN açılmaz. PUBLIC istisnalarının açık politika kabulü ayrıca gerekir. |
| 3 — LOGIN | Yalnız güvenlik kabulünden sonra ayrı credential/LOGIN onayı ve gerçek backup hesabıyla TLS/READ ONLY metadata bağlantı kabulü. Parola rapora/argv'ye yazılmaz. Bu aşama veri export yetkisi değildir. |
| 4 — Export ve kurtarma | Sabit development kaynak için `pre016` tam 40/26 kapsamı ve resolved008 geçmişini içeren gerçek veri export'u, bağımsız şifreleme anahtarı/custody ayrı onaylanmalı. R2 hedefi/offsite ve ayrı restore hedefi/işlemi kendi açık onaylarını gerektirir. |

Gerçek managed adapter/kabul kodu ve bağımsız sözleşme henüz yok: `MANAGED_REMOTE_OBJECT_AUDIT_REQUIRED`, `BACKUP_RELEASE_REMOTE_NOT_APPROVED`, `MANAGED_REMOTE_UPLOAD_NOT_APPROVED` kapıları korunur. İnceleme veya rol oluşturma tek başına bu kapıları açmaz. `ACCOUNTING_CLOUD_REVIEW_REQUIRED` ve `STOCK_MANAGED_APPLY_DISABLED` da korunur.

## Takvim ve görev sınırı

29 Ekim'e altı gün var. En kısa sonraki işlem, **NOLOGIN kurulum kapsamı ile üç DB'nin katalog inceleme kapsamının ayrı açık onaylarıdır**; ardından somut sonuç üzerinden managed politika kararı verilebilir. Bu inceleme kabul edilmez veya sistem/nesne erişimi güvenle sınırlandırılamazsa provider destekli strict izolasyon gerekir; geniş yönetici hesabıyla export kestirmesi kabul edilmez. Gerçek şifreli offsite/restore kabulü olmadan canlı kullanım hazır değildir.

Bu görev yalnız bu raporu ekler. Yeni test/fixture çalıştırılmadı; önceki testler tarihsel kanıttır. Kod, migration 001–017, önceki çalışma ağacı, LAST_REPORT, guard, `.env.local` ve API anahtarı değiştirilmedi. Gerçek rol/LOGIN/ACL, dump/R2/restore/migration veya Git commit/push işlemi yapılmadı.
