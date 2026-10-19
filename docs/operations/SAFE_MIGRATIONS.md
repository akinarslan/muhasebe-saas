# Güvenli migration — V4.2c.1 operatör prosedürü

19.10.2026. Bu runner yalnız incelenmiş13 migration üzerine `202610190014_supplier_catalog` uygular. Genel bootstrap veya production runner değildir. **Gerçek development uygulaması kurtarma kapısı ve ayrı kullanıcı onayı bekler.**

## Hedef ve çalışma kipleri

`scripts/db/migrate.ts` varsayılan olarak yalnız preflight yapar. `--apply` olmadan Prisma deploy başlatılmaz. Production NODE_ENV, yanlış direct host/branch endpoint'i, pooler, yanlış DB/rol, URL fragment/ek seçenek ve doğrulanmamış TLS girdisi reddedilir. Development rolü yalnız neondb_owner'dır; runtime/auth kullanılamaz. Test modu yalnız UUID marker ile yeni127.0.0.1 fixture'ı kabul eder; mevcut Neon test DB reddedilir. Marker/dizin/port/rol guard'ları korunur.

Operatör URL'si `sslmode=verify-full` içermelidir. Node preflight mevcut CA ve hostname doğrulaması yapar. Prisma engine'in farklı URL sözlüğüne yalnız config içinde `sslmode=require` + `sslaccept=strict` + absolute server CA yolu ile çevrilir; bağlantı/TLS zorunluluğu ve hostname doğrulaması korunur. Operator env dosyası değiştirilmez. [Prisma engine TLS parametreleri](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql). Bu köprü gerçek yerel Prisma+TLS pozitif/negatif testine tabidir; gerçek Neon engine bağlantı kabulü ayrıca ölçülmelidir.

```powershell
# Read-only katalog preflight; migration yapmaz.
node --use-system-ca --import tsx scripts/db/migrate.ts
```

Bu sprintte yukarıdaki komut gerçek Neon üzerinde çalıştırılmadı. Preflight oturumu yalnız runner eşzamanlılık advisory lock'ı alır, metadata sorguları READ ONLY transaction içindedir; session sonlanınca advisory lock bırakılır. Runner dışındaki schema değişikliğine karşı bakım penceresi hâlâ gerekir.

```powershell
# YALNIZ gelecekte ayrı gerçek uygulama onayı ve kurtarma kapısı tamamlanınca:
node --use-system-ca --import tsx scripts/db/migrate.ts --apply --approve-development --recovery-reviewed --confirm-master-permissions
```

Bu bayraklar operatör beyanıdır; restore başarısını otomatik ispatlamaz. Bu belge veya kodun varlığı kullanıcı onayı yerine geçmez. Mevcut “db:migrate” alışkanlığı değişmiştir: flagsiz çağrı artık deploy yapmaz; `--test` mevcut Neon test DB'yi açmaz. Bu davranış kasıtlıdır.

## Checksum ve drift

`migration-baseline.json`14 SQL dosyasının byte hash'ini, PG18 yapısının önce/sonra fingerprint'lerini ve development rol/üyelik/default ACL/eski tablo efektif hak fingerprint'lerini taşır. Fingerprint'ler runtime'da otomatik yenilenmez. Yeni migration, eski checksum farkı, unresolved failure, duplicate successful history, beklenmeyen nesne/kolon/default/index/FK/policy/trigger/function/enum veya uzak izin farkı işlemi durdurur. Postflight yeni Supplier grant'leri ve PUBLIC erişimsizliği ayrıca kontrol edilir.

Migration008'in eski rolled-back denemesi korunur; başarılı tek uygulama hash'i esas alınır. Yeni unresolved hata sessizce geçilmez. Bu runner'ın history yorumunun Sprint E backup guard'ını değiştirmediğine dikkat edin.

014 son SHA-256: `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`. Yeni canlı denetim ve gelecekteki uygulama onayı **bu yeni hash'i** kullanmalı. `.gitattributes` SQL'i LF sabitler; ilk13 SQL içerikleri değiştirilmedi. Baseline dosyasına rastgele yeni checksum yazmak güvenlik incelemesi değildir.

## Timeout ve transaction sınırları

014 explicit BEGIN/COMMIT içinde server-side `SET LOCAL lock_timeout='3s'`, `statement_timeout='30s'`, `transaction_timeout='60s'` uygular. Ayarlar parent Node/PGOPTIONS varsayımıyla taşınmaz; Prisma'nın migration backend'inde SQL olarak yürür. Child toplam90s ile sınırlıdır. Normal fixture uygulaması yaklaşık1.5s olduğundan30s statement payı yeni boş tablo/index/FK işlemleri için geniştir; parent lock beklemesi3s'de kesilir.60s transaction limiti çoklu statement toplamını;90s child limiti engine açılışı/advisory bekleme ve server limiti sonrasını sınırlar. Bunlar development014 içindir; büyük backfill'e taşınmaz, timeout sonrası otomatik artırılmaz.

Prisma her migration'ı kendiliğinden tek transaction'a sarıyor varsayılmaz. İlk13 eski SQL değiştirilmedi. 014'ün DDL ve Permission/Master INSERT'leri kendi transaction'ındadır; Prisma metadata başlangıç/başarı/hata kayıtları aynı atomic sınırda sayılmaz. Testte transaction dışı CREATE+division-by-zero fiziksel nesne bırakırken explicit014 lock/statement hatasında üç yeni tablo kalmadığı gözlendi.

Child stdout/stderr son16KiB RAM kuyruğunda yalnız sabit hata sınıflaması için tutulur; terminale/dosyaya/raw error nesnesine aktarılmaz. Prisma ilk SQL hatasını “transaction aborted” ile maskeleyebilir; genel PRISMA_CHILD_FAILED bir başarı veya belirli timeout nedeni diye yorumlanmaz. Yerel timeout kanıtı yalnız sentetik PG server logundan boolean olarak doğrulanır.

Timeout'ta kendi Node child'ı durdurulur; benzersiz application_name+current DB+current user ile yalnız bu çağrının backend PID'leri sonlandırılır. Kapanış en fazla5s gözlenir; kalan backend varsa hata. Başka postgres/uygulama süreçleri hedeflenmez. PostgreSQL backend sonlandırma yalnız açıkça onaylı migration çağrısının kendi oturumları içindir; preflight yalnız okuma kipinde çağrılmaz.

## Uygulamadan önce

1. Mimo teslim diff/sır kontrolü, branch ve son dosya hash'ini doğrula. Gerçek kullanıcının migration014/Master genişlemesi/grants için ayrı onayı olmalı.
2. Kurtarma yolunu somutlaştır: exact UTC ve İstanbul pre-migration noktası, gerçekten seçilebilir history/LSN, branch topology, diğer DB etkisi, yetkili operatör ve sınanmış/uygulanabilir geri dönüş yöntemi. Onaylı olmayan branch/snapshot/restore oluşturma.
3. İş yazmalarını kontrollü bakım penceresinde durdur; eski10 tablo sayım/metadata referansını yeniden al. Eski referansı güncel iş verisi olarak kullanma. Ham Auth/MFA/finans içeriklerini raporlama.
4. Preflight ve pinler eşleşmeli;13 başarılı migration+014 pending ve test_runtime development CONNECT=false kalmalı. Doğru TLS zinciri olmadan çalıştırma.
5. R2 bağımsız yedeğinin yokluğu açık kalır. Boş iş tablosu sayımları Auth/MFA ve diğer tabloların önemsiz olduğu anlamına gelmez. Kurtarma kanıtı eksikse **BLOCKED**.

## Başarısızlık, kısmi uygulama ve tekrar deneme

- Timeout, nonzero child veya bağlantı belirsizliğinde başarı yazılmaz. Güvenli hata kodu ve gerçek tablo/Supplier nesne/unresolved metadata sayısı raporlanır; payload/log/URL yazılmaz.
- Yeni process aynı unresolved kaydı görünce durur. Otomatik migrate resolve, metadata silme, DROP, retry veya restore yoktur.
- Sonucu belirsiz COMMIT'te önce read-only katalog ve checksum denetlenir. Başarılı14/38/24 ve exact post-pin doğrulanırsa ALREADY_APPLIED döner; tekrar deploy edilmez.
- Kısmi kalıcı nesne varsa önce etki/bağımlılık/metadata incelenir; ayrı onayla forward fix/kurtarma planı hazırlanır. Yeni tablolarda veri oluştuktan sonra DROP bir geri alma yöntemi sayılmaz.
- Fixture negatif senaryoları arasındaki failed-row DELETE ve synthetic_partial_migration DROP yalnız o yeni hayalî cluster'ın açık test reset'idir. Gerçek operatör prosedürü değildir; resolved-success işareti atılmaz. Gerçek008 geçmişi değiştirilmez.

## Yetki etkisi

Sekiz anahtar: suppliers.view/create/edit; supplierMaterials.manage; supplierOffers.view/create/history/costView. Permission oluşturma katalog olayıdır; MASTER RolePermission bağlantısı mevcut Master yetkisini genişleten ayrı atama olayıdır.014 aynı transaction içinde her ikisini yapar ve operatörden açık Master onayı istenir. Normal rol şablonları, Membership, tenant kapsamı, override ve MFA güncellenmez. Master rolünü paylaşan kullanıcılar bu yetkileri alır; explicit DENY değerlendirmesi ve tenant/entity/activity scope korunur.

Development014 yalnız pusula_runtime'a Supplier/Link SELECT+INSERT+UPDATE, Offer SELECT+INSERT ve iki invoker function EXECUTE verir. Test rolü grant'leri kaldırıldı; fixture bunları yalnız kendi yeni cluster'ında açıkça kurar. Test rolüne development CONNECT açılmaz. Auth Supplier erişimi almaz. PUBLIC tablo ve function EXECUTE hakları COMMIT'ten önce kaldırılır.

Maliyet gizliliği server DTO ve suppliers/materials cost izinleriyle korunur; RLS sütun maskelemez. Shared DB credential kompromisine karşı column DLP iddiası yoktur. Ayrı normal-role izin atama operasyonu gelecekte tasarlanabilir; bu sprint otomatik Master ekini kaldırmadı, etkisini açık onay kapısına aldı.

## Neon Free kurtarma sınırı

Operatör Console gözlemi: Free, development, Restore from history kullanılabilir,6 saat; en eski tarih19.10.2026, kesin en eski saat bilinmiyor; snapshot/otomatik snapshot yok. Bu gerçek restore kanıtı değildir. [Neon fiyat sayfası](https://neon.com/pricing) history için6 saat/1GB değişim sınırı ve bir snapshot listeler; kullanım/maliyet/kota Console'da tekrar doğrulanmalıdır. Yeni kaynak açılmadı.

[Neon restore belgesi](https://neon.com/docs/postgres/backup-restore/branch-restore) root branch şartını, tüm branch DB'lerine etkiyi ve tarihsel durumun mevcut verinin yerini aldığını açıklar. Pusula Better Auth tabloları da PostgreSQL verisidir; sonradan oluşturulmuş kullanıcı/MFA/şifre/oturum değişiklikleri kaybolabilir. İlgili tüm kayıt/rol/RLS mutabakatı ve yetkili kontrollü giriş kontrolü gerekir; session iptali/hesap değişikliği ayrıca onaylı olmalıdır.

Pencere aşılırsa bu teyitli history seçeneği kullanılamaz; doğrulanmış snapshot/izole kopya/bağımsız arşiv yoksa elde garanti bir kurtarma yolu kalmaz. Bu yüzden otomatik restore yapılmaz. İzin verilecekse izole kopya veya snapshot seçenekleri ancak ayrı onay, quota/ücret ve hassas veri kapsamı denetimiyle oluşturulabilir. Şu an hiçbirisi oluşturulmuş veya ücretsiz garanti edilmiş değildir.

## Sonraki kabul

38/24 exact post-schema+014 checksum; eski10 tablo sayım/içerik mutabakatı; Auth/MFA kayıt koruma; Supplier CRUD/history, iki tenant/company/activity, revoke sonrası403/cost redaksiyonu; eski fiyat/sale snapshot değişmezliği. Önce yeni sentetik fixture kullanılır; development'a hayalî test kaydı ekleme ayrıca onay ister. Sprint E38/24/enum/function/TOC/restore incelemesi ayrı kalır; backup guard'ları otomatik genişletilmez. [Kanıt ve açık kapılar](../validation/V04_V42C1_VERIFICATION.md).
