# PUSULA — Neon cross-DB doğrulama kanıtı

23 Ekim 2026 · **CROSS_DB_BLOCKED** (güvenlik sözleşmesi); **katalog toplama son tur 3/3 PASS**. [Karar ve hakların değerlendirmesi](../../research/PUSULA_NEON_CROSS_DB_AUDIT.md).

## Gerçekte çalıştırılan işlem

Dal `feat/pusula-v030-neon-cloud`; HEAD `edc03121737051d1eb180e621ccd91acfcc92743`. Geçici özel script: `.data/neon-cross-db/audit.ts`; komut `npx.cmd tsx .data/neon-cross-db/audit.ts`, iki tur. Her turda yalnız `neondb`, `postgres`, `template1`, sırayla ve ayrı Client/transaction. Her hedefte kimlik/timeout SELECT'i + 21 sabit katalog sorgusu, BEGIN ve ROLLBACK; toplam 6 oturum. Son komut native exit code 0. Otomatik auth retry, rol oluşturma/SET ROLE veya backup oturumu yok.

İlk tur **13:25:03.596 / 13:25:06.403 / 13:25:09.087 UTC**: TLS/readonly ve katalog toplama başarılı, ROLLBACK/close başarılı; fakat sunucu `statement_timeout=0` bildirdi. Node Client `statement_timeout` seçeneği tek başına yeterli olmadı. Bu tur **tam güvenlik oturum kabulü değildir**; ham `CATALOG_COLLECTION_PASS` etiketi yalnız sorgu toplama başarısıdır. Kanıtlar `initial/` altında korunur. Client query timeout 15s ve transaction timeout 60s mevcuttu; buna rağmen 0 değeri kabul edilmedi.

Script'in startup options alanına açık `-c statement_timeout=10000` ve ölçülen dört timeout için fail-closed kontrol eklendi. Yeni tur bunun doğrulanması için yapıldı; uygulama/backup kaynak kodu değiştirilmedi.

| Son tur DB | Transaction zamanı UTC | Sürüm / actor | TLS | Timeout / isolation / kapanış |
| --- | --- | --- | --- | --- |
| neondb | 2026-10-23T13:25:38.296Z | 18.6 (fd34222) / neondb_owner | 1.3, encrypted/authorized | 3s / 10s / 60s / 15s; repeatable read readonly; rollback=true, closed=true |
| postgres | 2026-10-23T13:25:40.974Z | aynı | aynı | aynı; rollback=true, closed=true |
| template1 | 2026-10-23T13:25:43.604Z | aynı | aynı | aynı; rollback=true, closed=true |

Timeout sırası lock / statement / transaction / idle-in-transaction. Startup default_transaction_read_only=on ve transaction_read_only=on her hedefte ölçüldü. Connection timeout 10s, client query timeout 15s. CA geçerlilik tarihleri, hostname/SNI, rejectUnauthorized=true, TLS alt sınırı1.2 mevcut `planManagedTls` ile korundu; fiili bağlantılar TLS1.3 oldu. Sertifika kontrolü veya readonly hiçbir hedef için gevşetilmedi.

## Sorgu kapsamı ve yöntem

21 sorgu grubu: roles, members, database, databaseAcl, schemas, schemaAcl, relations, relationAcl, columnAcl, functions, functionAcl, extensions, languages, defaults, largeObjects, largeObjectAcl, foreignServers, foreignWrappers, eventTriggers, types, roleSettings.

Yalnız `pg_catalog` tablolarından kimlik/ACL/ownership/config metadata'sı ve standart katalog/ayar yardımcıları (`aclexplode`, `acldefault`, `current_setting`, `pg_get_function_identity_arguments` vb.) kullanıldı. `pg_authid`, `pg_largeobject` içeriği, uygulama tabloları, istatistik view içerikleri, `pg_stat_activity`, `pg_stat_statements` sonuçları ve foreign credential options okunmadı. Prosedür/fonksiyon gövdeleri veya provider C kodu incelenmedi; hedef/provider rutinleri çalıştırılmadı. Gerçek erişim saldırısı/negatif DML denemesi yapılmadı.

ACL=NULL için PostgreSQL katalog default ACL açılımı kullanıldı; bu, PUBLIC grant'lerinin gizlenmesini önler. Mevcut rol OID'leriyle grantor/grantee eşleştirildi; gelecekteki backup rolünün gerçek effective hakkı ölçülmüş gibi gösterilmedi. Üyeliksiz, sahipliksiz varsayımsal rolün mevcut PUBLIC erişimi çıkarıldı. `has_*` ile owner yetkisini backup yetkisi sayan ölçüm yapılmadı.

| Ölçülen envanter | neondb | postgres | template1 |
| --- | --- | --- | --- |
| Sistem dışı tablo / view / sequence | 0 / 0 / 0 | 3 / 11 / 1 | 0 / 0 / 0 |
| Partition / materialized view / foreign table | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Sistem dışı rutin | 0 | 41 (public5, neon36) | 0 |
| PUBLIC SELECT sistem dışı view | 0 | 2 | 0 |
| PUBLIC EXECUTE + schema USAGE sistem dışı rutin | 0 | 4 | 0 |
| PUBLIC EXECUTE olup schema USAGE olmayan neon rutini | 0 | 28 | 0 |
| SECURITY DEFINER (tüm rutinler) | 0 | 0 | 0 |
| Rutin toplamı / PUBLIC EXECUTE ACL | 3413 / 3347 | 3454 / 3379 | 3413 / 3347 |
| Large-object / foreign server / FDW / event trigger | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Explicit default ACL satırı | 9 | 0 | 0 |
| PUBLIC grant-option (incelenen ACL grupları) | 0 | 0 | 0 |
| Rol / üyelik tuple sayısı | 24 / 16 | 24 / 16 | 24 / 16 |

Sistem kataloglarının PUBLIC görünürlüğü sıfır değildir: her hedefte 191 sistem relation PUBLIC ACL satırı, `pg_subscription` 17 kolon SELECT grant'i; `pg_settings` PUBLIC UPDATE. Bunların kapsamı kaynak dışı iş tablosu yazma hakkı olarak raporlanmadı. Core/extension rutinlerinde iç privilege kontrolü ve yan etkiler **UNKNOWN**; ACL'ler işlevin başarıyla çalışacağını kanıtlamaz. Kaynak dışı provider view/rutin hakları ise metadata ile somut olarak doğrulandı ve mevcut sözleşmeyi reddetmek için yeterlidir.

## Kanıt dosyaları ve bütünlük

Ham dosyalar private `.data/neon-cross-db/` altında; Git teslimi değildir. Son tur SHA-256:

| Dosya | SHA-256 |
| --- | --- |
| audit.ts | `8d3b728f5393424ffb0c8fac6440c9e1c93ddb3c6cce32d5c3b27a85b7761d17` |
| neondb.json | `6e0ea0c9caf77bb5e2658125928cadfedf2d47d86cdb124dbfa965a936d9db56` |
| postgres.json | `c88ade3447c0dc5a58b39bbd5e54ed3a12d944efad9e9a72c01af19e39f13787` |
| template1.json | `53b9a0d89002ba193d3715c244f6b92f3529cb66e9ec56d0dbc31ab030c21dfb` |

Provider kimliği yeniden API'den sorgulanmadı: önceki `.data/neon-backup-role/provider.json` üç HTTP200 / 12:56 UTC eşlemesi kullanıldı. Yeni SQL kanıtı yalnız yukarıdaki üç hedefe aittir; kaynak40/26 veya tarihsel494 grantor yeniden ölçümü değildir. `NEON_API_KEY` okunmadı veya çıktılanmadı.

M017/M016/backup kodu ve migration001–017 değişmedi. Başlangıçta hashlenen 464 dosyadan yalnız izin verilen LAST_REPORT'a ekleme yapıldı; önceki içeriği byte olarak korundu. İki yeni teslim raporu eklendi. Guard'lar değişmedi; `.env.local` korundu. Bu görevde test/build/fixture çalıştırılmadı; önceki yerel sonuçlar tarihsel kalır. Son yerel kontrol hash karşılaştırması ve whitespace kontrolüdür; Git index/HEAD değişikliği, commit/push/merge yok.
