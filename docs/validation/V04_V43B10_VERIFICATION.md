# PUSULA V4.3b.10 doğrulama — CLOUD_PREFLIGHT_PARTIAL

22.10.2026. [Denetim ve A–D kararları](../../research/PUSULA_V04_V43B10_NEON_PREFLIGHT.md).

| Kontrol | Bu görevde gerçek sonuç |
| --- | --- |
| Git başlangıcı | Beklenen feature dalı; HEAD/yerel upstream d65ea89d915805dbf6b6e5afd111beb727cf7ef5; 0/0; temiz |
| Gerçek uzak ref | git ls-remote proxy bağlantı hatası; güncel uzak eşitliği iddia edilmez |
| Provider ilk GET | TLS/fetch yanıtı yok; güvenlik gevşetilmedi |
| Provider sistem CA GET | HTTP401; 2026-10-22T10:49:12.376Z; yenileme/login yapılmadı |
| Sonraki provider/consumption | çağrılmadı; envanter/plan/kota/operasyon güncel teyitsiz |
| Development TLS | Açık CA ve validity, hostname/servername, rejectUnauthorized=true, min TLS1.2, encrypted/authorized PASS |
| Hedef kimliği | Sabit allowlist host/DB/actor ve önceki başarılı provider kanıtı; güncel provider mapping teyitsiz |
| Startup/transaction | default_transaction_read_only=on; REPEATABLE READ READ ONLY; snapshot 2026-10-22T10:49:51.491Z |
| Versiyon / tablo / FORCE RLS / başarılı migration | 18.6 / 40 / 26 / 15 |
| Sekiz schema hash | Baseline ve önceki kaynakla 8/8 aynı |
| 015 checksum | 181a783a6b63b21016e789d4201781829063397d906b19ba7018a15735b1614a |
| 016 pending | History kaydı yok; dosya SHA7368c775ec5d9b2b126b4731d5985ec83d1cad077f2cd5904ff596a04f22b272 |
| Gerçek stockFiles + validateStockHistory | PASS; 15 başarılı, bir bilinen rollback008, unresolved/çift başarı0 |
| Resolved008 | finished=false/rolled_back=true; exact failed SHA35ca1ae8…ed1fd9; bir başarılı karşılık |
| Managed pre fingerprint | 59252aa93cf52f7d087e066bcf7ab0b469cd1bd5cd57a372642ce2f7bb07c009; yeniden ölçüldü, baseline değiştirilmedi |
| Rol/ACL karşılaştırma | Eski dört kategori, geniş ACL, tüm rol metadata ve managed identity/attributes/grantor-membership/capabilities/owners/functions/grantability/schema/language eşit |
| Executor/creator | İkisi de yok |
| PO-2026-9893 | APPROVED,1satır,2linear_meter,3.04square_meter,30.40USD; ilişkiler eşit |
| Bağlantı sonu | ROLLBACK, connectionClosed=true |
| Neon rol DDL başarısı | Denenmedi; NEEDS_EVIDENCE |
| Recovery | Yeni bağlantı yok; tarihsel sınırlar ve ROLE_DELTA_UNRESOLVED korundu |
| Pinler / cloud apply | pre tarihsel; post=null; applyEnabled=false; kapılar değişmedi |
| Yasak işlemler | Migration/DDL/DML/GRANT/provider mutation/R2/env değişikliği/commit/push/merge yok |

## çalıştırılan komutlar ve sınırlar

`node .data/v43b10/provider.mjs` ilk fetch hatası verdi. `node --use-system-ca .data/v43b10/provider.mjs` TLS doğrulaması açık şekilde HTTP401 döndürdü ve durdu. İlk deneme sonucu sonraki provider.json tarafından üzerine yazıldı; ilk hata tool çıktısı ve bu belge ile korunur. Hiçbir token veya HTTP body yazdırılmadı.

`node --use-system-ca --conditions=react-server --import tsx .data/v43b10/development.ts`: ilk sandbox koşusunda esbuild spawn EPERM nedeniyle SQL başlamadı. Aynı salt okunur yardımcı sandbox dışında otomatik inceleme onayıyla çalıştırıldı; exit0, READONLY_CATALOG_PASS. Güvenlik kontrolleri değiştirilmedi. Yardımcı yalnız stockFiles/validateStockHistory/stockSecurity SELECT işlevlerini kullanır; main/runStock/runPrisma/inspectStock çağrılmaz. önceki audit yardımcıları yeni `.data/v43b10` dizinine uyarlanıp incelendi; eski kanıt dosyaları değiştirilmedi.

Yerel kanıt: `.data/v43b10/provider.json`, `development.json`, `provider.mjs`, `development.ts`, `preservation.json`. JSON'da secret/ham Auth/session satırları yok; teslim dışıdır. Katalog tanımları ve business count/digest özetleri bulunur. Tam schema ve izin fingerprint'leri ana raporda kayıtlıdır.

Bu belge değişikliği için Vitest/TypeScript/ESLint/build ve yerel PG fixture yeniden çalıştırılmadı. Önceki395/395 veya managed14/runner20 sonuçları bu sprintin yeni test sonucu değildir. Kaynak değişikliği yok; gerçek yeni doğrulama canlı READ ONLY SQL'dir.

Son yerel kontrol: git diff --check, değişen dosya listesi, korunan SQL/kaynak/pin manifest'i ve .env.local/önceki raporların Git farkı; yalnız → istenen rapor dosyası kapsamda. LAST_REPORT eski baytları yeni özetin altında korunur. Kaynakların içeriği Git HEAD'e karşı da kontrol edildi; eski migration mixed/final-CRLF baytları normalize edilmedi.
