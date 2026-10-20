# PUSULA V4.3a.3 — Neon development migration015

20.10.2026 · **MIGRATION_PASS / CLOUD_ACCEPTANCE_PARTIAL**

Migration `202610200015_purchase_orders`, açık kullanıcı migration onayı ve ayrı bakım teyidinden sonra yalnız development'a güvenli repository runner'ıyla **bir kez** uygulandı. Exit0, `APPLIED`,40 tablo/26 FORCE RLS. Gerçek kullanıcı oturumunda API ve liste/detay ekranı kabulü henüz yapılmadı; tam bulut kabulü iddiası yoktur.

## Yetki, bakım ve hedef

Kullanıcı production'ı açıkça kapsam dışında bıraktı; tüm development yazıcılarının durdurulduğunu ve migration/postflight boyunca kapalı tutulacağını teyit etti. `AGENTS.md`,LAST_REPORT,V4.3a.2 recovery raporu/doğrulaması ve Codex F01–F10 fix raporu okundu. `docs/operations/SAFE_MIGRATIONS.md` bakım/timeout/başarısızlık prosedürü uygulandı. Bu belge tarihsel014 sayıları içerdiğinden015'in incelenmiş güncel runner/baseline ve40/26 beklentileri esas alındı; kontroller gevşetilmedi.

Git dalı `feat/pusula-v030-neon-cloud`; HEAD `1c41d04d299bd49087ac36d04f88b91cf6cfbc0f`. Başlangıçta LAST_REPORT ve önceki V4.3a.1/.2 dört raporunun commit edilmemiş değişiklikleri vardı; korundu. İlk14 SQL ve015 checksum'ı güncel baseline ile eşleşti.015 SHA-256:

`181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a`

Provider GET ve SQL kimliği aynı development hedefini doğruladı:

| Kaynak | Kimlik / endpoint |
|---|---|
| Project |`icy-queen-44442204` / pusula-development |
| Migration hedefi |development `br-rough-darkness-ba6ow9zo` / `ep-blue-breeze-bavbjb7l` |
| SQL DB |`pusula_development`,PG18.6 |
| Korunan recovery |`br-broad-river-bavv5pey` / `ep-wispy-frog-ba755foo` |
| Production |`br-autumn-union-baaldt81` / `ep-soft-surf-baowiyco` |
| Eski preview |`br-patient-block-bald8u59` / `ep-curly-base-ba5jc1c2` |
| Snapshot |`snap-frosty-sky-bav0qeo6` |

Recovery migration hedefi değildir. Direct hedef allowlist'i,neondb_owner,TLS CA/hostname doğrulaması korundu. `.env.local`,kod,migration ve bağlantı sırları değiştirilmedi. Provider GET başlangıçta süresi dolmuş oturumdan401 döndü; standart CLI auth cache yenilemesi sonrası GET başarılı oldu. Bu migration retry veya DB credential rotasyonu değildir.

## Recovery ve taze preflight

Recovery capture `2026-10-20T12:47:55Z`,LSN `0/3638E80`; branch ready.15:20:40.482UTC development ve15:20:46.779UTC recovery READ ONLY SQL referansları:38/24,14 başarılı+çözülmüş008,pending015; tüm38 tablo toplamı,sekiz schema fingerprint,tablo/function ACL ve rol fingerprint'leri eşleşti. Bu karşılaştırma tam satır eşitliği ispatı değildir; capture sonrası aynı toplamlı güncellemeleri dışlamaz. Recovery yaklaşık2saat41dakika önceki capture noktasını korur; capture sonrası yazılar için sıfır kayıp garantisi verilmez. Bağımsız R2/backup engeli kapanmadı.

Bakım teyidinden sonra15:28:58.940UTC SQL kapısı:başka client0,prepared transaction0,çakışan/bekleyen lock0. Son preflight15:29:03.526UTC: `PREFLIGHT_PASS`,38/24,14 başarılı,çözülmüş rollback1,yalnız015 pending,schemaDrift=false,privilegeDrift=false.

## Tek apply ve postflight

Yalnız aşağıdaki runner bir kez apply kipinde çağrıldı:

```powershell
node --use-system-ca --import tsx scripts/db/migrate.ts --apply --approve-development --recovery-reviewed --confirm-master-permissions
```

Exit0:`{"status":"APPLIED","tables":40,"forced":26}`. Manuel migration SQL,resolve,otomatik retry,timeout artırma veya güvenlik bypass yok. Sonraki flagsiz runner yalnız postflight yaptı ve `ALREADY_APPLIED,applied=false` döndü; ikinci deploy değildir.

Bağımsız SQL postflight15:29:34.178UTC:

| Kontrol | Sonuç |
|---|---|
| Şema |40 tablo/26 FORCE RLS;sekiz post-schema pin eşleşti |
| History |15 başarılı;çözülmüş008=1;unresolved=0;pending yok |
| Checksum |15/15 dosya/baseline/başarılı history uyumlu |
| Permission / MASTER |6 yeni purchases izni,MASTER eşleştirmesi6;diğer rollere yeni atama0 |
| Mevcut Supplier izinleri |8/MASTER8;MASTER membership1 |
| FK/constraint/index |validate edilmemiş constraint0;invalid/not-ready index0;tanımlar pinle uyumlu |
| Tenant/legal entity/activity |1/1/0;entity/activity/membership orphan0 |
| Supplier/Material/Offer |1/0/0 |
| AuthUser/Membership |2/2 |
| PurchaseOrder/PurchaseOrderLine |0/0 |

Runner postflight ayrıca runtime Supplier/PO tablo grant'lerini,PUBLIC erişimsizliğini,auth/test erişimsizliğini ve post-schema pinlerini doğruladı. Mevcut role/membership/default/ACL pinleri flagsiz son kontrolde geçti. Normal kullanıcı rollerini genişletme yapılmadı;015'in onaylı MASTER permission ekleri dışında atama yok.

## Eski içerik korunması

Bakım öncesi/sonrası READ ONLY server-side özet:38 eski tablodan migration history hariç37 tablonun row-count ve sıralı satır MD5 özetleri karşılaştırıldı;**37/37 eşit**. Permission ve RolePermission'da yalnız yeni `purchases.%` ekleri karşılaştırmadan dışlandı;eski içerik korundu,yeni ekler ayrıca6/6/0 kontrolüyle doğrulandı. `_prisma_migrations` beklenen tek başarılı015 ekini içerir (14başarılı+1rollback→15başarılı+1rollback).

Özetler yalnız yerel ignored kanıtta tutuldu;ham Auth/MFA/parola/token/mali satırlar terminale veya rapora çıkarılmadı. MD5 operasyonel değişiklik tespiti içindir;kriptografik yedek veya bağımsız veri bütünlüğü sertifikası değildir. Auth/MFA dahil mevcut satır özetleri bu kontrollü pencerede değişmedi.15:29:39.395UTC sonrası diğer client/prepared/çakışan lock yine0.

## Gerçek runtime/API ve ekran kabulünün sınırı

15:30:31.612UTC gerçek `database()` factory,Prisma client ve **pusula_runtime** rolüyle `SET TRANSACTION READ ONLY` içinde mevcut scope kullanılarak PO liste sorgusu boş döndü;olmayan ID detay sorgusu null döndü. Prisma şema/kolon/ilişki erişimi gerçek DB üzerinde başarılıdır. Bu DAL kontrolünde kullanıcı session'ı taklit edilmedi;pozitif oturumlu API testi değildir.

Gerçek `cloudRequest` handler'ına oturumsuz satın alma GET isteği401 UNAUTHENTICATED döndürdü. HTTP server üzerinden authenticated200 veya detay404 kabulü sayılmadı. Computer Use envanteri `apps=[] / browsers=[]`;erişilebilir kullanıcı oturumu bulunamadı. Gerçek kullanıcı liste ekranı,detay ekranı,oturumlu API200/404 **YAPILMADI**. Yeni PO0 olduğundan mevcut başarılı detay kaydı da yok.

Yazmalı kabul yapılmadı. Ayrı onaya sunulacak somut senaryo:yeni ve açıkça sentetik supplier,material/variant,link ve bir satırlı DRAFT PO oluşturmak;liste/detayda doğrulamak ve yalnız sentetik PO üzerinde approve/cancel akışını sınamak. Mevcut gerçek Supplier veya diğer kayıtlar değiştirilmez. Bu senaryo yeni business/audit/idempotency kayıtları üretir veonay metadata'sı yazar;stok/mal kabul/ödeme testi değildir. Silme/temizleme kendiliğinden yapılmaz;ayrı plan gerekir. Bu öneri henüz yetkilendirilmiş veya çalıştırılmış değildir.

## Kaynak koruması ve teslim

Provider önce/sonra branch ID/ad/parent,endpoint ID/host/type/min-maxCU/timeout ve snapshot metadata aynı;pending operation yok. Branch4,snapshot1 korunuyor;recovery endpoint'ine uygulama/Auth/login trafiği bağlanmadı. Production/test/preview SQL veya yazı,R2,restore/finalize/reset,resource delete,ücretli plan yok. Salt okunur bağlantılar compute'u uyandırabilir;kopya storage tüketimi devam edebilir;kesin sprint tüketimi ölçülmedi.

Migration ve bağımsız postflight tamamlandı;bakım boyunca başka yazıcı görülmedi. Gerçek kullanıcı ekran kabulü ve ayrı izinli yazmalı kabul açık kalır. Bağımsız backup kapsamı/rol/PUBLIC TEMP-CONNECT engelleri değişmedi.

Mimo'ya bu sprint kesin dosya listesi:

1. `research/PUSULA_V04_V43A3_NEON_MIGRATION_REPORT.md`
2. `docs/validation/V04_V43A3_NEON_MIGRATION_VERIFICATION.md`
3. `LAST_REPORT.md`

Önceki V4.3a.1/.2 raporları korunur. `.data/recovery-v43a3/` yerel kanıt/yardımcı kodları ve private provider yanıtları teslim edilmez. Commit/push/merge yapılmadı.
