# V4.2c.1 — gerçek yerel migration güvenliği kanıtı

19.10.2026 · feature dalı · HEAD225cd7a korunur · **yerel kabul PASS; gerçek Neon migration BLOCKED**.

## Sonuçlar

| Kontrol | Sonuç |
| --- | --- |
| TypeScript | PASS |
| ESLint | PASS,0 hata/uyarı |
| Build | PASS, Next16.4.1; mevcut geniş .data rate-store pattern uyarısı sürer |
| Vitest | **317/317**,26 dosya,17.44s; önceki297 +20 migration history/target testi |
| Gerçek Prisma migration güvenliği | **14/14** yerel senaryo, tam fixture |
| DB/RLS | **11/11**, yeni yerel cluster |
| Auth/API | **62/62** (7+9+8+11+8+6+13), sentetik hesap/yerel mail taşıyıcısı |
| Cloud/DB | **11/11**, yeni yerel cluster |
| Supplier DB/API | **16/16**, iki tenant/activity, cost DENY ve izin iptali dahil |
| Gerçek Prisma TLS | Doğru CA PASS, yanlış CA/hostname ret PASS; ayrı yerel sentetik sertifikalar |
| Playwright | Bu sprint yeniden çalıştırılmadı; UI değişmedi. Önceki28/28 tarihsel kanıttır. |
| Gerçek Neon SQL/dump/R2/restore | **YOK** |

Tam son fixture **v42-6b2d004f-d7c9-4456-b5d5-4788fd6924a3**,127.0.0.1:55432, PostgreSQL server/initdb/pg_ctl18.6, PID33188, statusPASS/serverStopped=true. Kanıt: Git dışı aynı dizindeki `verification.json`, `migration-safety.json`, `post-schema.json`, `partial-failure.json` ve test logları. Normal014 süresi1.482s; son SQL hash `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`.

TLS tamamlayıcı **v42-71ca8465-c333-45f1-86b0-56130145c285**, statusPASS/serverStopped=true. OpenSSL3.5.7; yeni private test cert/key dosyaları. Gerçek Prisma doğru CA ile bağlandı; yanlış CA ve doğru CA'ya rağmen hostname uyuşmazlığı reddedildi. Normal migration/old-content/no-replay/permissions ve AuthC2 9/9+Supplier16/16 bu fixture'da da geçti. Bu hızlı tamamlayıcı lock/statement negatiflerini tekrar koşmadı; onları tam fixture kanıtlar.

## Gerçek14 senaryo

1. PG18 exact35/21 baseline ve katalog pinleri.
2. Yanlış uygulanmış checksum reddi.
3. Beklenmeyen Customer kolon drift reddi.
4. Gerçek runner→Prisma child altında parent lock timeout; FAILED raporu35 tablo/Supplier0/unresolved1.
5. Aynı unresolved history ile retry reddi.
6. Gerçek child SQL'ine enjekte edilmiş pg_sleep31 için30s statement timeout; üç yeni tablo kalmadı.
7.4s toplam child timeout,4.031s; yalnız kendi tag'li backend'i sonlandırıldı, aktif oturum kalmadı.
8. Transaction dışı CREATE+division-by-zero; fiziksel kısmi tablo gerçekten kaldı.
9. Kısmi uygulama sonrası retry reddi; gerçek schema durumu dosyaya raporlandı.
10. Asıl014'ün gerçek Prisma deploy ile başarılı uygulanması.
11. Negatifler öncesindeki iki tenant'ın10 eski Auth/iş tablosunun tüm sentetik içerik hash'leri aynı.
12. Başarılı014'e ALREADY_APPLIED; yeniden deploy yok.
13. Yeni Supplier nesnelerinde auth/test role grant'i yok; runtime DELETE/TRUNCATE ve PUBLIC hakları yok.
14. MASTER için sekiz yeni bağlantının ayrı gözlemi.

Unit20, yanlış development/test/production/host/pooler/role/TLS/query/fragment ve history durumlarını ağsız kontrol eder. Rol/grant/TLS testleri backup kontrollerinin yerine geçmez.

## Başarısız denemeler ve kanıt sınırı

İlk baseline üretimi sandbox esbuild spawnEPERM nedeniyle başlamadı; izinli yerel çalıştırmayla tamamlandı. İlk fixture denemelerinde Prisma'nın transaction-aborted mesajı asıl timeout'u maskeledi; `_prisma_migrations.logs` üzerinden beklenen timeout metni bulunmadı. Bu denemeler PASS sayılmadı. Sonrasında PG server logu yalnız boolean timeout kanıtı olarak kullanıldı; raw stderr dışarı verilmedi.

İlk negatifler sonrası sentetik LegalEntity seed kolon hatası düzeltildi. Fixture içinde main çağrısında gerçek env yüklenmesini önlemek için local marker varsa env yükleme kapatıldı. Kilit ilk aşamada preflight metadata sorgusunu da beklettiği için fixture hook'uyla preflight sonrasında alınacak şekilde düzeltildi; bu hook yalnız local test hedefinde kabul edilir. Bunlar gerçek Neon hataları değildir. Bütün başarısız fixture'ların kendi serverStopped=true kayıtları tutuldu; hiçbiri başarılı toplam içine alınmadı.

Timeout failure'ında014 DDL transaction'ı rollback oldu; Prisma failed-history satırı ayrı kaldı. Testler arasında failed014 satırları ve synthetic_partial_migration yalnız bu yeni test cluster'ında açık reset ile kaldırıldı; migrate resolve kullanılmadı. Gerçek geçmişe/008'e işlem yapılmadı.60s transaction-timeout negatifinde60 saniye beklenmedi; komut başarılı014'te yürütüldü. Child90s mekanizması4s test limitiyle kanıtlandı. Büyük DB/üretim performansı ölçülmedi.

Post-schema pinleri PG18'in gerçek yerel kataloglarından üretildi ve baseline manifest'ine incelenmiş hash'ler olarak eklendi; runtime otomatik enroll yoktur. Remote privilege pinleri önceki onaylı development metadata snapshot'ından gelir. Bu sprint yeni Neon bağlantısı açmadığı için güncel uzak izin/TLS/topology kabulü iddia edilmez.

UI kaynakları değişmedi. Build geniş .data uyarısı, pg/NO_COLOR ve beklenen negatif Auth HTTP test kayıtları var; sıfır sunucu log hatası iddiası yoktur. Browser/Safari/Firefox/ekran okuyucu sertifikasyonu yapılmadı.

## Uygulama ve kurtarma kapıları

Gerçek development14 pending kabulü, yeni dosya hash'i ve güncel kayıt/ACL baseline'ı yeniden read-only doğrulanmalı. Console operatörünün Free6 saat bilgisi gerçek restore kanıtı değildir. Kesin tarih-saat/LSN, root/child, diğer DB etkileri, Auth/MFA koruma mutabakatı ve kullanılabilir kurtarma yolu açık kalır. Bağımsız R2, dar backup rolü ve production kabulü yok. [Teknik karar](../../research/PUSULA_V04_V42C1_MIGRATION_SAFETY.md) · [Komut ve kurtarma prosedürü](../operations/SAFE_MIGRATIONS.md).

Codex stage/commit/push yapmadı. Git dışı fixture'lar, private TLS keys, ortam/bağlantı sırları Mimo teslim listesine girmez. Son sır/diff/işlem kimliği kontrolleri teslimde ayrıca doğrulanır.

Son teslim kontrolü:14 ilgili dosyada yapılandırılmış yerel sırlar ve URL parola bileşenlerine karşı tarama PASS;5 yerel belge bağlantısı ve14 migration manifest hash'i PASS. Git diff whitespace kontrolü PASS, index boş, HEAD225cd7a ve feature dalı değişmedi. Bağımsız son CIM/port sayımı: fixture postgres0, schema-engine0,55432 listener0. Yeni helper/TLS dosyaları dahil son Next build de PASS; geniş .data uyarısı sürer. Src/schema/package/backup kaynaklarında bu sprint diff'i yoktur; ilk13 SQL hash'i korunur.
