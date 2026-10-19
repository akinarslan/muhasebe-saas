# V4.2e — Gerçek bulut kabul durumu

19.10.2026 · V4.2f güncellemesi · **V4.2 temel development bulut kabulü tamamlandı; ileri senaryolar açık.**

V4.2e'nin temel MASTER UI/HTTP kabul eksikliği, kullanıcının bildirdiği manuel tarayıcı kabulüyle kapatıldı. Kullanıcı MASTER girişini, TOTP'yi, /app Tedarikçiler ekranını, Supplier API HTTP200 sonucunu, PUSULA TEST TEDARİKÇİSİ oluşturmayı, F5 kalıcılığını ve ayrıntı ekranını başarılı bildirdi. Bunlar Codex browser automation veya bağımsız HTTP ölçümü değildir.

Codex'in yeni18:05:51Z salt okunur teknik doğrulaması: PostgreSQL18.6,014 ALREADY_APPLIED,38 tablo/24 FORCE RLS/14 başarılı migration; sekiz Supplier izni ve sekiz MASTER ilişkisi, MASTER toplam66 izin. İncelenen post-schema ve rol/ACL pinleri uyumlu; beklenmeyen drift yok.18:06:16Z parametreli sayımda verilen test tedarikçisi adına1 eşleşme ve1 aktif eşleşme doğrulandı. SupplierMaterial ve SupplierOfferVersion toplamları0.18:06Z provider metadata'sında snapshot,preview ve production endpoint bağları korundu.

**Canlı açık maddeler:** SupplierMaterial eşleştirme, SupplierOfferVersion oluşturma/tarihsel sürümler, iki tenant izolasyonu, explicit DENY/maliyet gizliliği ve bağımsız R2 backup. Yerel fixture sonuçları bunların canlı kabulü değildir. Bu sprintte Codex kayıt oluşturmadı, veri değiştirmedi, login/MFA/session işlemi yapmadı veya yeni migration çalıştırmadı.

[V4.2f kapanış raporu ve kanıt ayrımı](../../research/PUSULA_V04_V42F_CLOUD_ACCEPTANCE.md).

## V4.2e tarihsel uygulama referansı

Aşağıdaki zamanlar ve sayımlar migration uygulama anına aittir; yeni manuel test sonrası güncel toplam yerine kullanılmamalıdır.

Migration014 yalnız `pusula_development` üzerinde bir kez başarıyla uygulandı. Bakım penceresi kullanıcı tarafından teyit edildi; son preflight, writer/transaction/kilit ve veri toplamı kapıları geçti. Yeni snapshot/restore veya production/test işlemi yapılmadı.

| Kabul | Gerçek sonuç |
| --- | --- |
| Son canlı preflight |15:49:57.038Z; PREFLIGHT_PASS / applied=false;35/21/13, drift yok |
| Son bakım denetimi |15:50:22.195Z; diğer istemci/transaction, çakışan DDL/bekleyen lock, prepared transaction0; eski toplam farkı0 |
| Gerçek apply |Tek runner; exit0/APPLIED; DB finished_at15:50:30.780Z |
| Canlı postflight |38 tablo /24 FORCE RLS /14 başarılı migration; eski008 rollback korunuyor |
| MASTER izinleri |Sekiz yeni Supplier izni ve sekiz ilişki; MASTER toplam66 izin |
| Schema/ACL |Onaylı post-schema ve eski rol/üyelik/default ACL pinleri eşleşti; test_runtime erişim sınırı korundu |
| Eski kayıt toplamları |32 eski tabloda aynı; yalnız Permission+8,RolePermission+8,history+1 |
| Gerçek runtime/Prisma |pusula_runtime ve READ ONLY; üç Supplier modelinin sorguları PASS,0/0/0 |
| Runtime TLS |İstemci socket encrypted/authorized/hostnameVerified=true; CA doğrulaması açık |
| Gerçek MASTER UI/HTTP API |V4.2e'de otomatik çalıştırılmadı; V4.2f'de kullanıcı manuel kabulü bildirildi |
| Canlı tenant/DENY/maliyet davranışı |Canlı dolu veri testi yapılmadı; yerel sentetik kanıt ayrı |
| Canlı yazmalı Supplier testi |ÇALIŞTIRILMADI; ayrı onay gerekir |

Migration bitiminde AuthUser2/Membership2 ve önceki Auth/iş tablo toplamları korundu; üç yeni tablo o anda0 kayıttı. V4.2f'de Supplier1 bulundu. Sayım eşitliği tüm satır içeriği eşitliğini kanıtlamaz. Codex parola/MFA/session veya müşteri/finansal içeriklerini görüntülemedi ve login/session oluşturmadı. Demo / verisi Neon kanıtı sayılmadı. /app gerçek cloud workspace'e ve cloud API'ye bağlıdır; temel UI/HTTP kabulünün kaynağı kullanıcının manuel bildirimidir.

Runtime smoke'un ilk denemesi backend pg_stat_ssl=false nedeniyle durdu. Sonraki ölçüm gerçek istemci TLSSocket'inde CA/hostname doğrulamasıyla PASS verdi; backend false değeri gizlenmedi. Bu iki ölçüm farklı bağlantı katmanlarını gözler. Güvenlik kontrolleri kapatılmadı; başarısız denemeler başarı sayılmadı.

Aynı sprintin yerel sonuçları: TypeScript ve ESLint PASS; Vitest329/329,27 dosya,23.43 saniye; migration güvenliği16/16,DB/RLS11/11,Auth/API62/62,Cloud/DB11/11,Supplier16/16. Hepsi yeni localhost sentetik fixture'dadır; mevcut Neon test DB kullanılmadı. Fixture güvenli kapandı. Build/browser koşulmadı.

Snapshot `snap-frosty-sky-bav0qeo6`, preview `br-patient-block-bald8u59` ve production `br-autumn-union-baaldt81` korundu; endpoint bağları/ayarları aynı. Production/test/preview SQL bağlantısı, R2, reset/finalize/delete veya ücretli plan işlemi yok. Preview halen saklanıyor; temizlik ayrı onay gerektirir.

V4.3 için development şeması ve temel tedarikçi bulut akışı kabul edildi. Yukarıdaki ileri canlı senaryolar açık kalır; sonraki yazmalı bulut testleri ve migration'lar ayrıca kapsam/onay gerektirir. Sprint E gerçek backup rolü, yeni tablo allowlist/restore ve production engelleri sürer.

[Ayrıntılı migration raporu ve zaman kanıtları](../../research/PUSULA_V04_V42E_NEON_MIGRATION_REPORT.md). Codex commit/push yapmadı; Mimo üç teslim belgesini inceleyip gerçek Git sonucunu ayrıca raporlayacak.
