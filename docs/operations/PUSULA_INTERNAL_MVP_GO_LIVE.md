# PUSULA — ZY Reklam iç kullanım MVP canlıya geçiş kapıları

23 Ekim 2026. Hedef 29 Ekim 2026. Bu dosya bir canlı uygulama onayı veya çalışma emri değildir.

| Karar | Durum |
| --- | --- |
| Entegre yerel muhasebe | **K5_LOCAL_PASS** — tam fixture + şifreli restore + desktop/mobile kabulü |
| CLOUD_READY_FOR_APPROVAL | BLOCKED — aşağıdaki canlı güvenlik/operasyon kanıtları eksik |
| GO_LIVE_PASS | BLOCKED — bu görevde canlı işlemler yasak; verilmedi |

## Hazır teknik paket

K1–K4 muhasebe kodu, değişmemiş yerel hazırlık SQL'leri ve tek 001–016 canonical migration geçmişi korunur. `scripts/accounting/prepare-migration.ts`, bu dört SQL'in hash'lerini kaydederek `migration-candidate/017-finance.sql` ve `manifest.json` üretir. Bu çevrimdışı bir dosya üreticisidir; DB bağlantısı veya apply içermez. Tekrarlanabilirlik testi checked-in adayın kaynaklarla eşleşmesini zorunlu kılar.

Aday tek transaction'da K1–K4 son şemasını kurar. Fixture kimliği yerine açık review işareti, PostgreSQL 18.6, 16 başarılı migration/016 checksum, henüz finance şeması bulunmaması ve sınırlı `pusula_runtime` rolü ön koşuldur. Runtime adı artık fixture rolü değildir; executor NOLOGIN/NOBYPASSRLS, immutable/deferred kontroller, FORCE RLS ve kapalı PUBLIC EXECUTE korunur. Yerel harness gerçek `pusula_runtime` rolüne verilen yetkileri fixture runtime'a üyelikle kullandırır; executor üyeliği verilmez.

**Bu aday canonical dizine kayıtlı değildir ve otomatik migration runner tarafından tüketilemez.** Fixture'da 017 DDL byte-identical uygulanır, fakat K1–K4 kabul sözleşmesini korumak için `_prisma_migrations` satırı eklenmez; başarılı geçmiş 16 kalır. Bu, Prisma017 registration/provider dağıtım kabulü değildir. K5 ayrı/ikinci migration tablosu yaratmaz. Adayı bugün `db:migrate` veya gerçek Neon bağlantısıyla çalıştırmayın.

## Sıra ve operatör kararları

1. **Kaynak/kimlik:** Güncel provider GET kimlik ve kapasite, doğru proje/branch/host/DB, direct TLS verify-full, doğru migration/runtime/auth aktörleri ve bakım penceresi bağımsız incelenmeli. Tarihsel kayıt güncel kanıt sayılamaz. Önceki provider HTTP401 sorunu çözülmeli.
2. **Bağımsız geri dönüş:** Gerçek kaynak için dar backup rolü; tam 56 tablo/42 FORCE RLS, schema/kolon/default ACL, fonksiyon/trigger/ownership, database CONNECT/TEMP ve diğer DB nesne yetkileri audit'i; erişimi ayrı yönetilen offsite şifreli kopya; ayrı anahtar kurtarma; yeni boş hedefe gerçek restore ve finans mutabakatı gerekir. Üretim kaynağı bugün 56 değilse mevcut kaynak için audit/export ve migration sonrası genişletilmiş audit ayrı tutulmalı. Restore hedefi, oturum invalidasyonu ve rollback/cutover sorumlusu operatörce belirlenmeli.
3. **016 managed kapısı:** `scripts/stock/managed-contract.json` içindeki `applyEnabled=false`, `postFingerprint=null` ve `STOCK_MANAGED_APPLY_DISABLED` korunuyor. Önce provider CREATE/SET/GRANT/REVOKE/DROP rol yaşam döngüsü ve mevcut grantor/ACL pre kanıtı tamamlanmalı; 016 için ayrı gerçek apply onayı alınmalı. Başarılı apply sonrasında bağımsız incelenmiş managed post fingerprint ve canonical history16 kabul edilmeli. Yerel pre/post bunu karşılamaz.
4. **Finans017 hazırlığının terfisi:** 016 kabulünden sonra adayın SHA256 ve rol eşlemesi bağımsız incelenmeli. Değişiklik gerekiyorsa yeni aday + tekrar fixture/regresyon şarttır. Tek mevcut `prisma/migrations` zincirine yalnız bir 017 ardılı, checksum/baseline/pre/post runner sözleşmesi ve Prisma migration metadata kabulü eklenmeli. Typed raw SQL ile kullanılan dokuz finans tablosunun Prisma schema/diff sahipliği de netleştirilmeli; ilerideki migration'ın bu tabloları yanlışlıkla kaldırmayacağı doğrulanmalı. Manuel resolve, ikinci geçmiş, checksum yeniden yazımı veya atlama yapılmamalı. Bu kayıt/runner/schema terfisi K5'te yapılmadı; bir sonraki onaylı dağıtım değişikliğidir.
5. **Provider finans rol/ACL:** Migration aktörünün sınırlı executor yaratma, nesne sahipliği devretme, SET ROLE ve GRANT/REVOKE yeteneği; runtime'ın executor üyesi olmaması ve direkt finance DML yapamaması gerçek provider'da kanıtlanmalı. RLS, explicit DENY, finance/cost izinleri ve MFA'nın gerçek deployment oturumlarında pozitif/negatifleri ölçülmeli. Yerel fixture_admin superuser davranışı provider kanıtı değildir.
6. **Ayrı finans017 apply onayı:** İncelenmiş artifact hash'i, pre fingerprint, hedef kimliği, bakım penceresi ve geri dönüş planı somut olarak onaylanmadan gerçek SQL yoktur. 016 onayı, 017 veya API açılışı için örtük onay değildir. Adayın review GUC'si tek başına kullanıcı onayının yerine geçmez.
7. **Bulut API açılış değişikliği:** `ACCOUNTING_CLOUD_REVIEW_REQUIRED` kaldırılmadı. Kabul edilmiş live017 + provider pre/post + backup/restore + işletme kabulü sonrası ayrı gözden geçirilmiş runtime değişikliği gerekir. Fixture marker veya test URL'leri bulut için kullanılmaz. `.env.local` bu görevde değişmez.
8. **İşletme pilotu ve son karar:** ZY Reklam yetkilisi gerçek belge kesimi/açılış bakiyesi, müşteri/tedarikçi mutabakatı, kasa sayımı, banka/POS ekstresi, aynı gün satış/tahsilat/ödeme/gider ve kullanıcı erişim matrisini imzalamalı. Gerçek personel masaüstü/mobil ve bağlantı kaybı kurtarmasını denemeli. Geri dönüş sorumlusu, geri dönüş tetikleri ve destek kanalı belirlenmeli. Ancak tüm canlı kanıtlar tamamlanınca GO_LIVE_PASS düşünülebilir.

## Kalan somut engeller

- Güncel provider kimlik/kapasite ve rol yaşam döngüsü: **BLOCKED / canlı ölçüm yok**.
- 016 managed post fingerprint ve apply kapısı: **BLOCKED / null + disabled**.
- 017 canonical registration ve provider pre/post runner kabulü: **BLOCKED / aday var, terfi yok**.
- Gerçek backup rolü/56 tablo kapsamı, global rol/DB ACL kurtarma ve güvenilir bağımsız offsite: **BLOCKED**.
- Gerçek anahtar kurtarma + yeni boş provider hedefinde restore/finans mutabakatı: **BLOCKED**.
- Recovery `br-late-river-baeipun8`, `token_roles / ROLE_DELTA_UNRESOLVED`: **BLOCKED**, değiştirilmedi.
- Gerçek personel/işletme kabulü, canlı MFA/explicit DENY ve cutover yetkisi: **BLOCKED**.

## Yerel kanıtın doğru sınırı

K5 yedeği yalnız sentetik loopback fixture'dan, dar SELECT + BYPASSRLS backup rolüyle alınır. Mevcut pg_dump/TOC, AES-GCM/HMAC, doğrulanmış private decrypt ve pg_restore araçları kullanılır. Ayrı yerel klasöre şifreli kopya, yeni template0 DB'ye restore, 56 tablo içeriği ve katalog/finans karşılaştırması test edilir. Kopya aynı bilgisayardadır; bağımsız offsite değildir. Anahtar sentetiktir ve operatör-private fixture kopyasında tutulur; production key custody kabulü değildir.

Restore DB aynı yeni fixture kümesindedir. Global roller önceden vardır; pg_dump'ın global rol/parola veya veritabanı ACL'si kurtardığı iddia edilmez. Restore edilmiş sentetik Auth/MFA verileriyle canlı giriş yapılmaz. Runtime/backup definer yetkileri ve role bayrakları yerelde ölçülür; builtin nesne üretimi, diğer DB erişimi ve gerçek kaynak riskleri için mevcut managed audit engelleri sürer. Varsayılan uzak backup allowlist'i 35/21 kalır; genişletilmiş fixture profili gerçek CLI güvenlik kapısını gevşetmez.

Yalnız yerel yeniden kabul komutu:

```powershell
node --import tsx scripts/accounting/prepare-migration.ts
node --conditions=react-server --import tsx scripts/stock/verify-local.ts --approve-local-fixture --k5 --k5-browser
```

Bu komutlar `.env.local` yüklemez; uzak SQL/R2/production işlemi yapmaz. Gerçek hedefte uygulanacak komutlar henüz onaylanmış değildir.
