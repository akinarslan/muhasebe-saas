# Sprint V4.2d.4 — Restore PostgreSQL hata tanısı ve kabul

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `a88fa0c` korunur.

**RESTORE_PASS — migration 014 için ayrı kullanıcı onayı bekleniyor**

Mevcut preview branch üzerinde gerçek TLS doğrulamalı, salt okunur PostgreSQL erişimi ve aşağıdaki katalog/sayım/ilişki kontrolleri tamamlandı. Yeni snapshot/branch/restore/finalize işlemi yapılmadı. Bu kabul, snapshot'tan geri gelen mevcut kayıt ve yapılar içindir; production kabulü veya migration uygulama izni değildir.

## Gerçek hata ve sınırlı düzeltme

Önceki `.data/v42d3-verify.ts` ve hata/metadata kayıtları incelendi. Aynı hedefte aşama kaydı eklenmiş tanı 2026-10-19T14:16:00.469Z'de hatayı yeniden üretti:

| Alan | Kanıt |
| --- | --- |
| Aşama | `FK_VIOLATION_COUNTS` |
| Exception | JavaScript `TypeError`, `ARRAY_MAP_TYPE_ERROR` |
| SQLSTATE | Yok; PostgreSQL hata yanıtı değildir |
| Önce tamamlananlar | Hedef/endpoint doğrulaması, bağlantı yapılandırması, CA yükleme, PostgreSQL/TLS bağlantısı, minimum READ ONLY, rol/ACL kataloğu, migration/şema incelemesi, tablo toplamları ve FK metadata sorgusu |

FK sorgusu `array_agg(ca.attname)` / `array_agg(pa.attname)` döndürüyordu. Katalog `attname` alanının türü `name`; sonuç `name[]` olur. Kurulu node-postgres parser'ı `name[]` OID1003'ü string olarak döndürüyor; doğrulayıcı bunu JavaScript array sanıp `.map()` çağırıyordu. Yerel gerçek pg parser deneyi OID1003 için isArray=false/type=string; `text[]` OID1009 için isArray=true verdi. [PostgreSQL18 belgesi](https://www.postgresql.org/docs/18/datatype-character.html) `name` türünün katalog tanımlayıcı türü olduğunu açıklar.

Dolayısıyla önceki genel `RESTORE_SQL_FAILED`, bağlantı/TLS veya bozuk restore kanıtı değildi. Önceki hata sınıflandırması TypeError ayrıntısını ve aşamasını korumamıştı; D4 bunu güvenli enum/aşama/SQLSTATE alanlarıyla ayırdı. Ham exception mesajı/stack, URL veya secret raporlanmadı.

Yalnız Git dışı doğrulama sorgusunda iki dönüşüm yapıldı:

```sql
array_agg(ca.attname::text ORDER BY k.ord) AS child_columns,
array_agg(pa.attname::text ORDER BY k.ord) AS parent_columns
```

Bu salt okunur SELECT sonucunun türünü `text[]` yapar; kolon, constraint, veri, rol veya sürücü genel parser ayarı değişmez. TLS/CA/RLS/ACL/checksum guard'ları kaldırılmadı. Kaynak migration runner/allowlist ve gerçek `.env.local` değişmedi. Düzeltme sonrası aynı hedefte tam koşu exit0/RESTORE_SQL_PASS verdi. İlk başarısız tanı başarı sayılmadı.

## Hedef ve bağlantı güvenliği

Yalnız `icy-queen-44442204` projesindeki `pusula-v42-restore-verification` / `br-patient-block-bald8u59`, endpoint `ep-curly-base-ba5jc1c2` kullanıldı. Provider GET ile endpoint→branch bağı ve ready durumu; bağlantı host'u ile provider host eşitliği, direct hedef, DB ve rol denetlendi. Kaynak/test/production DB'ye SQL bağlantısı açılmadı.

Bağlantı verify-full, güvenilir mevcut CA, rejectUnauthorized=true ve hostname/servername doğrulamasıyla yapıldı; socket encrypted=true ve authorized=true gözlendi. Minimum kontrolde `SELECT current_database()` beklenen `pusula_development`, `SHOW transaction_read_only` on verdi. İşlemler READ ONLY transaction içinde, bitişte ROLLBACK ve bağlantı kapatma ile çalıştı. Rol/ACL, şema/sayım ve ek ilişki kontrolleri ayrı salt okunur transaction'lardır; tek ortak atomik snapshot iddiası yok.

Hedef yapılandırması önceden oluşturulan kullanıcı+SYSTEM erişimli `.data/v42d3-private/target.json` içinde Git dışındadır; URL/parola rapora yazılmadı. Normal uygulama, Auth login, e-posta, webhook veya scheduler hedefe bağlanmadı. Gerçek Auth/MFA/session kolon içerikleri okunmadı.

## Gerçek restore bütünlüğü

Tam koşu14:16:33.676Z / İstanbul17:16:33.676 tamamlandı. İlişki transaction zamanı14:16:28.586Z; şema/sınırlı referans transaction zamanı14:16:26.936Z.

| Kontrol | Gerçek sonuç |
| --- | --- |
| Sunucu | PostgreSQL `18.6 (653b019)` |
| Migration |13 başarılı migration'ın checksum'ı yerel pinned SQL ile uyumlu;1 çözümlenmiş008 rollback korunmuş; toplam14 history satırı |
|014 | Pending; Supplier/SupplierMaterial/SupplierOfferVersion yok; migration uygulanmadı |
| Tablo/RLS |35 tablo;21 enable+FORCE RLS; beklenen ad listeleri eşleşti |
| Schema fingerprint | Tablolar,308kolon,350constraint,82index,43policy,11trigger,5function,10enum değeri satırı baseline hash'leriyle eşleşti; enum satır sayısı enum türü sayısı değildir |
| Constraint/index | İncelenen constraint'ler validated; index'ler valid ve ready |
| FK |43 FK'nin tamamında orphan ihlal sayısı0; composite tenant/entity ilişkileri dahil |
| Rol/ACL | Rol özellikleri, üyelik, default ACL ve runtime tablo yetki fingerprint'leri eşleşti; test_runtime development CONNECT kapalı |
| Auth | AuthUser2, Membership2; yalnız toplamlar |
| Tenant kapsamı | Tenant1, LegalEntity1, Activity0; mevcut FK ilişkileri tutarlı |
| Master | MASTER rol1; toplam Permission58, MASTER'a bağlı58 izin; isMaster Membership1 ve MASTER assignment1 |
| Ek Master ilişkileri | Tutarsız master assignment0; ataması eksik isMaster üyelik0; MASTER izni eksik Permission0; READ ONLY ek probe geçti |

Restore edilen iş toplamları: Customer0, Material0, MaterialVariant0, MaterialPriceHistory0, CloudProduct0, CloudQuote0, CloudSale0, CloudSaleLine0, CloudPaymentPlan0, TenantExchangeRate0. Diğer tablolar da yalnız count(*) ile sayıldı; hassas Auth/MFA/session/audit içerikleri seçilmedi. Tam35 tablo toplamı Git dışı güvenli sonuç dosyasındadır.

**Finansal kanıt sınırı:** USD fiyat geçmişi ve satış snapshot tabloları boştur. İlgili FK, constraint, immutable/sealing trigger ve function tanımları baseline ile eşleşti; mevcut kayıtlarda ilişki ihlali yok. Dolu finansal verilerde tutar/snapshot içerik eşitliği veya davranış testi yapıldığı iddia edilmez. Canlı veri yazan negatif RLS/trigger testi bu kapsamda yapılmadı; RLS/tenant kabulü katalog/ACL ve mevcut ilişki kontrolleridir.

Snapshot zamanı11:03:46Z; sonraki D1 development referansı11:52:12.917Z'dir. AuthUser/Membership2/2 ve yukarıdaki eski iş tablolarının0 toplamları bu sınırlı referansla aynı çıktı. Zamansal fark korunur; tüm DB satır içeriklerinin veya snapshot-anı kaydın birebir eşitliği iddia edilmez.

## Kaynakların korunması ve kalan kaynak

Önce14:15:41.246Z, sonra14:17:06.713Z provider GET/list karşılaştırması:

| Kaynak | Sonuç |
| --- | --- |
| development `br-rough-darkness-ba6ow9zo` | ID/ad/ready/logical_size aynı; endpoint `ep-blue-breeze-bavbjb7l` bağı ve ayarları aynı, idle |
| production `br-autumn-union-baaldt81` | ID/ad/ready/logical_size aynı; endpoint `ep-soft-surf-baowiyco` bağı ve ayarları aynı, idle |
| Development DB envanteri | neondb/pusula_development/pusula_sprint_b_test ve owner metadata aynı |
| Snapshot | `snap-frosty-sky-bav0qeo6` metadata aynı ve korunuyor |
| Provider operation |70→71; listelenen unfinished yok; yeni operation hedef compute'un yeniden başlaması, kaynak finalize/reset/rename yok |

Programlı karşılaştırma branchesEqual/endpointsEqual/databasesEqual/snapshotsEqual=true verdi. Yalnız gözlenen metadata alanlarının eşitliğidir; kaynak tüm satır içerik hash'i alınmadı. Production/test/kaynak SQL, DML/DDL/GRANT/REVOKE, migration, dump veya R2 işlemi yok.

Hedef branch halen ready. D4 öncesi endpoint idle görüldü; salt okunur kontroller onu uyandırdı, son gözlem active. Min=max0.25CU ve provider suspend ayarı0 değişmedi. Hedef logical_size54,411,264 byte; kaynak54,370,304 byte ile fiziksel/mantıksal boyut eşitliği restore kriteri değildir. API planı free_v3 ve3/10branch; mevcut snapshot1. Compute kullanım alanı5478CU-saniye dönüyor, gecikmeli olabilir. Yeni ücretli kaynak açılmadı; mevcut geçici branch storage/compute bütçesi tüketebilir. Silme veya zorla suspend yapılmadı; temizlik ayrı açık onay gerektirir.

## Kabul, sonraki kapı ve Mimo teslimi

V4.2d.3 provider restore kanıtı ve D4 gerçek PostgreSQL/TLS/şema/migration/ACL/sayım/ilişki kanıtları birlikte **RESTORE_PASS** sağlar. Önceki D3 BLOCKED kaydı tarihsel olarak korunur; ilk koşu başarılıymış gibi değiştirilmez.

**Migration014 için ayrıca açık kullanıcı onayı bekleniyor.** Uygulamadan hemen önce taze guarded development preflight, checksum/drift kontrolü, bakım/kilit/rollback kabulü gerekir. Bu çalışma migration uygulamadı.014SHA-256 tekrar eşleşti: `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`. SprintE backup rolü/izin sorunları, yeni tablolar için backup allowlist/restore kabulü ve production önkoşulları sürer; snapshot tatbikatı bunları kaldırmaz.

Git dışı kanıtlar: `.data/v42d4-diagnosis-initial.json`, `v42d4-sql-result.json`, `v42d4-master-result.json`, `v42d4-before.json`, `v42d4-after.json`, `v42d4-source-comparison.json`; düzeltilmiş geçici doğrulayıcı `.data/v42d4-verify.ts`. Bunlar ve bağlantı dosyası Git teslimine alınmaz. Uygulama kodu değişmediği için build/lint/tam Vitest yeniden koşulmadı; gerçek pg parser deneyi ve canlı salt okunur doğrulama bu düzeltmenin kanıtıdır.

Mimo değişiklik listesi: bu yeni rapor ve LAST_REPORT.md D4 özeti. İki belgede yapılandırılmış yerel sırlar ve hedef URL/parolasına karşı tarama PASS, eşleşme0; Git diff whitespace kontrolü geçti, index boş. Önceki D1/D2/D3 değişiklikleri korunur, ayrı incelenmelidir. Codex stage/commit/push/merge yapmadı; Mimo sır/istenmeyen dosya kontrolü, feature dalına normal teslim ve gerçek commit/push bilgilerini içeren ayrı `.md` raporundan sorumludur.
