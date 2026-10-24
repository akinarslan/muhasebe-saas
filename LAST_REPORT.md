# PUSULA — M016 provider reauth / PROVIDER_REAUTH_PASS

**23 Ekim 2026 · 14:51 Türkiye · PROVIDER_REAUTH_PASS.** Kullanıcının erişilebilir kıldığı mevcut NEON_API_KEY ile yalnız üç Neon API GET yapıldı; proje, development branch ve endpoint HTTP200 ile sabit kimliklere bire bir eşleşti. Proje `pusula-development`, branch `br-rough-darkness-ba6ow9zo`, host `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech`. Plan `free_v3`; mevcut endpoint0,25–0,25 CU, retention6 saat, branch logical limit1 GiB ve logical size55.148.544 byte. Proje varsayılan üst sınırı2 CU, mevcut endpoint kapasitesi sayılmadı. Anahtar kaydedilmedi; SQL veya provider değişikliği yok.

[Güncel provider raporu](research/PUSULA_M016_PROVIDER_REAUTH.md). İlk ortam erişimi BLOCKED kaydı aşağıda tarihsel olarak korunur; mevcut API-key yolu için erişim ve kimlik kapısı kapanmıştır. 494 grantor incelemesi önceki zaman damgasıyla korunur; yeniden ölçülmedi. M016_BLOCKED sürer: provider ACL/rol lifecycle, bağımsız gerçek kaynak backup/key/offsite/restore, ROLE_DELTA_UNRESOLVED ve ayrı016 uygulama onayı açık. Cloud guard'lar ve001–017 SQL değişmedi; M016_READY_FOR_APPROVAL veya GO_LIVE_PASS verilmedi.

---


# PUSULA — M016 provider reauth / BLOCKED

**23 Ekim 2026 · ENVIRONMENT_HANDOFF_REQUIRED.** Kullanıcı kendi PowerShell oturumunda NEON_API_KEY ile doğru proje GET başarısını bildirdi. Codex komut sürecinde ve User/Machine ortamında bu değişken bulunmadı; bu görevde Neon API GET=0, SQL=0. Branch/endpoint/plan/kapasite bağımsız olarak yeniden doğrulanamadı; yeni HTTP401 veya geçersiz anahtar iddiası yoktur. OAuth fallback kullanılmadı, credential değeri kaydedilmedi.

[Provider reauth raporu](research/PUSULA_M016_PROVIDER_REAUTH.md). Önceki 494 grantor incelemesi tarihsel haliyle korundu; yeniden ölçülmedi. M016_BLOCKED, backup/restore ve ROLE_DELTA_UNRESOLVED engelleri sürer. M017/M016/P0 kaynakları ve 001–017 SQL korundu. Gerçek migration apply/onay, rol/ACL değişikliği, R2/restore/snapshot veya Git teslimi yok. Bu özetin altındaki rapor geçmişi aynen korunur.

---


# PUSULA — M016 cloud hazırlığı / M016_BLOCKED

**23 Ekim 2026 · M016_BLOCKED; gerçek apply onayı yok.** Yeni provider GET yine HTTP401. Sabit development host'unda TLS doğrulamalı READ ONLY PG18.6 snapshot'ı:40 tablo/26 FORCE RLS,001–015 başarılı15, resolved008 korunmuş,016 pending; eski şema/rol/ACL kategorileri eşit.494 grantor pre kaydı toplandı, bağımsız review bekliyor; otomatik enrollment yok.

016 source-derived cloud review paketi ve yalnız UUID/loopback fixture'da çalışan transaction çekirdeği hazırlandı. Üç yeni PG18.6 cluster'da normal/COMMIT_OUTCOME_UNKNOWN/post-COMMIT drift, rollback/yetki/ACL warning ve PUBLIC/creator kalıntısı senaryoları geçti; retry/resolve/restore yok.469 Vitest, TypeScript, ESLint ve Git artifact10 kontrolü PASS. Gerçek provider rol lifecycle, bağımsız gerçek kaynak backup/offsite/key/restore, ROLE_DELTA_UNRESOLVED ve operasyon/apply onayı açık; cloud gate false/null kalır.

[Readiness](research/PUSULA_M016_CLOUD_READINESS.md) · [Gerçek preflight ve yerel doğrulama](docs/validation/PUSULA_M016_CLOUD_PREFLIGHT.md).001–017 SQL ve M017'nin23 dosyalık çalışması (bu dosyanın eski içeriği dahil) korundu. Neon'da yalnız salt okunur metadata; gerçek apply/DDL/DML/GRANT, R2/dump/restore/snapshot, recovery/production/test DB/env düzenleme veya Git stage/commit/push yok.

---

# PUSULA — Finans017 / M017_LOCAL_PASS

**23 Ekim 2026 · M017_LOCAL_PASS · Neon/GO_LIVE: BLOCKED.** Canonical `202610230017_finance`, geçici creator/SET/schema CREATE ve doğru owner altında ACL kapatma ile PostgreSQL18.6 non-superuser üzerinde gerçek Prisma deploy kabulünden geçti.17 başarılı migration,56 tablo/42 FORCE RLS; resolved008 ve ilk16 SQL korundu. Yeni017 SHA256 `9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`; önceki K5 adayı ayrı tarihsel artifact'ta korunur.

Dokuz finans Prisma modeli/ilişkisi ve partial index temsil edildi; gerçek model diff'i Finance DDL önermiyor. Tam katalog, owner/definer/search_path, gerçek ACL/grantor, global üyelik ve geçici yetki temizliği; gerçek Prisma hata/rollback, tekrar deploy, runtime36 DML/TRUNCATE ret ve belirsiz COMMIT sınıflandırması kabul edildi.235 API/SQL regresyonu, Vitest463, TypeScript, ESLint, build ve Git artifact10 kontrolü geçti. Restore/tarayıcı bu görevde yeniden çalıştırılmadı.

[Hazırlık raporu](research/PUSULA_ACCOUNTING_017_READINESS.md) · [Gerçek doğrulama](docs/validation/PUSULA_ACCOUNTING_017_VERIFICATION.md).016 gerçek Neon kabulü, provider017 rol/ACL/pre/post, bağımsız şifreli backup/restore, ROLE_DELTA_UNRESOLVED ve işletme kabulü açık. Cloud guard'lar korunur; gerçek Neon/R2/restore/env düzenleme veya Git stage/commit/push/merge yoktur.

---

# PUSULA — K5 entegre işletme kabulü ve buluta hazırlık

**23 Ekim 2026 · K5_LOCAL_PASS · CLOUD_READY_FOR_APPROVAL: BLOCKED · GO_LIVE_PASS verilmedi (BLOCKED).** K1–K4 tek sistem olarak gerçek izole PostgreSQL18.6 fixture'da kabul edildi. Yeni işletme özelliği yok; yalnız gerçek offline→online kabulünde bulunan eski hata mesajı temizleme hatası düzeltildi.

10m² vinil net4.000 + KDV800 = brüt4.800; iki ayrı gerçek MFA'lı personel,2.000/2.800 tahsilat,500 peşin gider,1.200 vadeli bakım/300 kısmi ödeme ve ödeme ters kaydı doğrulandı. Gün sonu müşteri0, tedarikçi900 ve kasa artışı4.000; bütün journal/posting/allocation toplamlarıyla mutabık. Fiziksel stok tüketimi yazılmadı. Eşzamanlı fazla tahsilat engeli, mükerrer istek, süresi dolan MFA ve finanssız personel negatifleri geçti.

Tarayıcıda commit sonrası HTTP yanıtı kesildi; reload + sonuç sorgusuyla tek tahsilat korundu. Offline→online kurtarma ve sekme kapatıp yeniden açınca DB kayıtlarının korunması Desktop Chrome + mobil Chromium/iPhone13 profilinde2/2 PASS. Fiziksel telefon veya gerçek Neon kesintisi kabulü değildir.

Değişmemiş K1–K4 SQL'lerinden çevrimdışı, `pusula_runtime` rolüne uygun tek017 SQL adayı + hash manifest'i üretildi ve yerelde byte-identical uygulandı. Canonical dizine terfi/Prisma017 registration yok; migration geçmişi16 ve ilk16 checksum aynı. Review marker olmadan rollback, FORCE RLS, runtime DML yasağı ve bütün K1–K4 regresyonları geçti. Cloud finance kapısı kaldırılmadı.

Mevcut backup motoruyla56 tablo export → AES-GCM/HMAC → ayrı private yerel kopya → decrypt → yeni boş yerel DB restore; tüm veri hash'leri, katalog/default ACL ve finans dengeleri eşleşti. İki eski CHECK'in PG parser eşdeğerliği ve gerçek CHECK(true) zayıflatma negatif testi geçti. Aynı cluster'daki roller önceden vardır; kopya aynı bilgisayardadır. Gerçek offsite, global rol/DB ACL kurtarma ve gerçek kaynak restore kabulü değildir; uzak35/21 kaynak kapıları korunur.

Nihai fixture `v42-fe3c040b-4649-48c3-88a4-8b22fb1fa385`:235 API/SQL kontrolü + backup/restore + browser PASS, serverStopped=true. Vitest462, TypeScript, ESLint, production build ve checksum artifact9 PASS. `.env.local`, K1–K4 rapor/test/local SQL ve kullanıcı değişiklikleri korundu. Gerçek Neon/R2/restore/recovery/snapshot/production veya Git commit/push/merge yoktur.

Managed016 `applyEnabled=false / postFingerprint=null`, provider rol/ACL yaşam döngüsü,017 canonical/schema terfisi, bağımsız offsite/anahtar/gerçek restore ve işletme kabulü eksikleri nedeniyle bulut/live kararları BLOCKED. Ayrı operatör onayları ve teknik sıra canlıya geçiş belgesindedir.

[K5 raporu](research/PUSULA_ACCOUNTING_K5_REPORT.md) · [Doğrulama](docs/validation/PUSULA_ACCOUNTING_K5_VERIFICATION.md) · [Canlıya geçiş kapıları](docs/operations/PUSULA_INTERNAL_MVP_GO_LIVE.md)

---

# PUSULA — K4 işletme giderleri ve günlük finans paneli

**23 Ekim 2026 · K4_LOCAL_PASS · Bulut ve gerçek verili pilot BLOCKED.** Ayrı gerçek gider belgesi/kategorileri, net/KDV ayrımı, isteğe bağlı tedarikçi ve belge referansı eklendi. Peşin gider fon çıkışıyla atomic; vadeli gider tedarikçi borcuyla atomic. K3 ödeme/allocation motoruyla 5.000 → 3.000 → 0 borç kapanır; ödeme ikinci gider oluşturmaz.

`/app` → Cari ve Finans içinde gider formu/listesi, tarih filtreleri, günlük/aylık gider ve gerçek PostgreSQL finans özeti bulunur. Net/KDV/brüt satış, tahsilat/ödeme, kasa/banka/POS, alacak/borç/vade, nakit hareketi ve tahmini iş kârı ayrıdır. Açılışlar gelir sayılmaz; ters kayıtlar kendi dönemine yansır. KDV ve tüketilmiş gider sınıflandırması açık; stok alımı ve maliyet tarifeleri otomatik giderleştirilmez.

K1–K3 izolasyon, FORCE RLS, explicit DENY, MFA, immutable ledger, idempotency/intent, negatif fon bakiyesi ve settlement korumaları sürer. Gider DENY'ında outcome/close kesinleşmiş kaydı gizleyip kapatamaz; maliyet DENY'ı kâr üzerinden aşılamaz. Runtime finans DML kapalıdır. Cari açılış yalnız party hesaplarına izin verir; fon açılışı K3 yolunda kalır.

Nihai PG18.6 fixture `v42-c553c928-daa1-479f-82d1-f0124806b9ab`: PASS, serverStopped=true. K4 12 + K1/K2/K3 ve mevcut regresyonlar toplam 227 API/SQL kontrolü; desktop/mobile 2/2 PASS. Vitest 460, TypeScript, ESLint, build ve checksum artifact 9 PASS. Yerel şema 56 tablo/42 FORCE RLS; migration geçmişi 16. İlk 16 SQL/checksum, K1–K3 hazırlık SQL/raporları ve kullanıcı değişiklikleri korundu.

K4 SQL yalnız yerel hazırlık ardılıdır. `ACCOUNTING_CLOUD_REVIEW_REQUIRED`, managed 016/post kabulü, `applyEnabled=false`, backup/restore ve recovery engelleri sürer. Gerçek Neon/R2/restore/snapshot/production ve Git commit/push/merge yapılmadı.

[K4 raporu](research/PUSULA_ACCOUNTING_K4_REPORT.md) · [Gerçek doğrulama](docs/validation/PUSULA_ACCOUNTING_K4_VERIFICATION.md)

---

# PUSULA — K3 tahsilat, ödeme, kasa, banka ve POS

**22 Ekim 2026 · K3_LOCAL_PASS · Bulut ve gerçek verili pilot BLOCKED.** Mevcut deftere kaynak belge tahsisli kısmi/tam nakit/EFT/kart tahsilatı, onaylı tedarikçi borcu/ödeme, ayrı TRY kasa/banka/POS bakiyeleri, açılış ve komisyonlu settlement eklendi. Eşzamanlı fazla tahsilat ve tarih sıralı eksi bakiye reddi; yetkili ters hareket, immutable kayıt ve atomic rollback korundu. PO onayı borç sayılmaz.

/app içinde Cari ve Finans: gerçek DB cari ekstre/kalan, satıştan tahsilat, tedarikçi ödemesi, hesap bakiyesi/hareketi ve settlement. Satış referansı sunucu intent'inden otomatik üretilir; belirsiz sonuç kör POST yerine referans sorgusu/güvenli kapatmayla çözülür. Normal personelde gerçek MFA, atanmış hesap, action/OWN ve explicit DENY negatifleri geçti.

Nihai PG18.6 fixture v42-177760ab-f691-467c-a700-cde81ec00234 PASS ve serverStopped=true: K3 16, K1 20, K2 15, DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36; gerçek masaüstü+mobil UI 2/2 PASS. Vitest444, TypeScript, ESLint, build, Git LF artifact9 PASS. Ölçülen yerel şema55 tablo/41 FORCE RLS; migration geçmişi16.

[Rapor ve K3'ün18 dosyalık listesi](research/PUSULA_ACCOUNTING_K3_REPORT.md) · [Gerçek test kanıtı ve başarısız denemeler](docs/validation/PUSULA_ACCOUNTING_K3_VERIFICATION.md). İlk15/016, K1/K2 rapor/SQL/testleri ve üç kullanıcı plan dosyası korundu. Gerçek cloud016/finans deployment, managed post pin, bağımsız backup/restore ve ROLE_DELTA_UNRESOLVED engelleri sürer. Neon/R2/restore/snapshot, .env.local değişikliği veya Git stage/commit/push yoktur. Aşağıdaki tüm önceki içerik aynen korunmuştur.

---

# PUSULA — K2 satış → cari alacak

**22 Ekim 2026 · K2_LOCAL_PASS · Bulut ve gerçek verili pilot BLOCKED.** Mevcut CloudSale/satır transaction'ına TRY cari journal/posting bağlandı: brüt müşteri borcu, ayrı net satış ve KDV karşı kayıtları. Request replay ve iş kaynağı tekilliği korunur; finans hatasında satış/satır/hesap/audit birlikte rollback olur. Eski/onaylı tarihsel satışlar otomatik aktarılmaz. Satış bağlantısı ve cari bakiyesi `finance/sales/{saleId}` API'sinden yetkili erişime açıldı; gerçek bulut kapısı kapalıdır.

Nihai izole PostgreSQL18.6 fixture: K2 15, K1 20, DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36 PASS; sunucu kapatıldı. Vitest430, TypeScript, ESLint, build ve Git LF artifact9 PASS. 10m² örneği: net4000 + KDV800 = brüt4800TRY alacak. Kaynak satış/maliyet/kur snapshot'ları korundu; satışa bağlı ters kayıt üç satırı tersler ve sales.cancel DENY'ı uygular. Tahsilat/ödeme/kasa/banka/POS K3'e bırakıldı.

[Rapor ve K2'nin 15 dosyalık kesin listesi](research/PUSULA_ACCOUNTING_K2_REPORT.md) · [Gerçek doğrulama](docs/validation/PUSULA_ACCOUNTING_K2_VERIFICATION.md). İlk15/016, K1 raporları/SQL/testleri ve üç kullanıcı plan dosyası korundu. Cloud016/gelecek017, managed post pin ve bağımsız backup/restore kabulü BLOCKED; ROLE_DELTA_UNRESOLVED sürer. Neon/R2/restore, `.env.local` değişikliği veya Git stage/commit/push yoktur. Aşağıdaki K1 ve önceki raporlar aynen korunmuştur.

---

# PUSULA — K1 cari hesap ve finans defteri

**22 Ekim 2026 · K1_LOCAL_PASS · Bulut ve gerçek verili pilot BLOCKED.** Customer/Supplier bağlantılı TRY açılışı, dengeli ve değişmez journal/posting, tarih/vade/ekstre, idempotency ve yetkili ters kayıt altyapısı yalnız izole PostgreSQL18.6 üzerinde hazırlandı. Runtime DML reddi, FORCE RLS ve MASTER dahil explicit DENY korundu. Finans UI ve satış/tahsilat entegrasyonu bu pakette değildir.

428 Vitest, TypeScript, ESLint, build, Git LF artifact9; nihai K1 fixture20 ve ayrı mevcut modül DB/Auth/Cloud/Supplier/Purchase/Stock regresyonları geçti. Fixture sunucuları kapatıldı. İlk 15 ve 016 SQL değişmedi; yerel hazırlık `scripts/accounting/local-schema.sql` canonical migration zincirinin dışında, yalnız 016 sonrasında test edilir; ikinci migration geçmişi yoktur. Gerçek 016/gelecek017 ve backup/restore kabulü BLOCKED; managed post pin null, apply kapalı, recovery ROLE_DELTA_UNRESOLVED sürer.

[Rapor](research/PUSULA_ACCOUNTING_K1_REPORT.md) · [Gerçek test kanıtı](docs/validation/PUSULA_ACCOUNTING_K1_VERIFICATION.md). Neon/R2/restore, `.env.local` değişikliği, Git stage/commit/push yapılmadı. Aşağıdaki önceki rapor ve kullanıcı planı korunmuştur.

---

# PUSULA — 7 günlük acil ön muhasebe MVP / MVP_PLAN_READY

22.10.2026 · Hedef 29.10.2026; yalnız GAP, bağımlılık, ilk kodlama paketi ve kabul dokümantasyonu hazırlandı. Mevcut müşteri/satış/maliyet ve RBAC/MFA yeniden kullanılacak. Gerçek cari ledger/açılış, tahsilat/ödeme/allocation, kasa-banka-POS, gider belgesi ve günlük finans raporları eksik. Ödeme planı tahsilat, gider tarifesi gerçekleşmiş gider değildir; demo bakiye gerçek muhasebe kabulü sayılmaz.

Kritik yol: pending016 ile güvenli finans migration hattı kararı → ledger/açılış → satış AR/tedarikçi AP → kısmi tahsilat/ödeme → gider/rapor → izin/mutabakat → bağımsız şifreli backup ve gerçek restore → ayrı onaylı pilot. Backup D1'de paralel başlar. TRY finans kesiti önerildi; USD maliyet/kur snapshot'ları korunur, para birimleri doğrulanmamış kurla birleştirilmez. 10m² vinil örneği:152cm rulo/2cm kenar payı/100×200cm×5 → tahmini10,20m/15,504m²; net4000+KDV800=4800TRY, tahsilat2000→AR2800, ayrı nakit gider500→cash1500. Bu belge aritmetiğidir; yeni API/PG/E2E başarı iddiası değildir, stok düşmez.

Dört dosya hazır: [7 günlük plan ve GAP](docs/planning/PUSULA_7_DAY_ACCOUNTING_MVP.md), [planlanan kabul senaryoları](docs/validation/PUSULA_ACCOUNTING_MVP_ACCEPTANCE.md), ROADMAP güncel öncelik bölümü ve bu özet. Kod/migration/env değişikliği, gerçek Neon/DB/R2/restore veya Git commit/push yok. Başlangıç HEAD fc6d41bb4380baa1839064f9f7bfd4bfe317d6b9; ağaç temizdi. Önceki planlama talimatı iptal edildi; onun dört dosyası oluşturulmadı.

V4.3b.12 ACL_FIX_PASS ve GitHub teslimi korunur;016 gerçek Neon'a uygulanmadı, SHA27b2c82d…886a567 ve cloud apply kapısı değişmedi. ROLE_DELTA_UNRESOLVED ve bağımsız R2 backup/restore engeli açık. Kabul edilmiş gerçek-kaynak alternatif yedek yok; şifreli bağımsız kopya ve gerçek restore olmadan GO_LIVE_PASS verilmez. 29 Ekim yetişme taahhüdü değil; migration/backup/POS/finans mutabakatı eksikse gerçek veri pilotu BLOCKED kalır.

---

# PUSULA V4.3b.12 — ACL_FIX_PASS

22.10.2026 · Non-superuser PG18.6 üzerinde dört SECURITY DEFINER fonksiyonun ACL kusuru giderildi. Sahiplik sonrası REVOKE/GRANT artık SET LOCAL ROLE executor altında; her blok RESET ROLE ile kapanır. Complete trigger'ları actor hâlâ fonksiyon sahibi iken kurulur. Yeni SQL test-only ACL düzeltmesi olmadan PUBLIC0/runtime-direct3/auth0 postflight'ını geçer. Bağımsız minimal deney INHERIT FALSE/SET TRUE ayrımını ve eski01006/01007 etkisiz ACL komutlarını doğruladı; tamamen rollback oldu.

016 yeni SHA `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`; eski7368c775…b272. Checksum referansları güncel. Yerel managed post ACL3ab72328…f4a38; pre ve normal fixture pinleri ile sekiz schema hash'i aynı. İlk15SQL, tarihsel checksum uyumluluğu, altı fonksiyon gövdesi, b10/b11raporları ve env korundu. Sözleşme gevşetilmedi; cloud postFingerprint=null/post=null/applyEnabled=false ve STOCK_MANAGED_APPLY_DISABLED korunur.

Yeni testler: managed15 + contract13 + bağımsızACL2 + GitLFartifact9; normal Prisma runner20, DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36 PASS. Orta executor-aktif ve geç aşama hata enjeksiyonlarında tam schema/security/history/rol rollback PASS; creator/üyelik/schemaCREATE kalıntısı yok. Vitest417/417, TypeScript/ESLint/production build native exit0. Üç yeni cluster kapandı; test-only pozitif düzeltme yok.

Bu sprint11dosya, önceki korunan7dosyayla birleşik GitHub kapsamı18dosya. Gerçek Neon/API/SQL/provider/recovery/R2/restore/snapshot, gerçek Auth/MFA/session içeriği, env değişikliği veya commit/push/merge yok. HEAD/yerel upstream d65ea89d915805dbf6b6e5afd111beb727cf7ef5. ROLE_DELTA_UNRESOLVED, provider/post/grantor kanıtı ve bağımsız backup engelleri açık. GitHub teslimi ve gerçek migration ayrı yetkili görevlerdir.

[ACL düzeltmesi ve kesin dosya listesi](research/PUSULA_V04_V43B12_ACL_FIX.md) · [Yeni doğrulama kanıtları](docs/validation/V04_V43B12_VERIFICATION.md).

---

# PUSULA V4.3b.11 — FIX_REQUIRED

22.10.2026 · Managed offline audit CLI, tarihsel Neon pre sözleşmesi, deklaratif post delta ve grantor dahil SELECT collector hazırlandı. Apply daima STOCK_MANAGED_APPLY_DISABLED; mevcut applyEnabled=false/post=null ve SQL016 SHA7368c775…b272 değişmedi. Yeni ölçüm veya otomatik pin enrollment yok.

Kritik yeni yerel PG18.6 kanıtı: non-superuser aday COMMIT sonrası dört executor-owned SECURITY DEFINER fonksiyonunda PUBLIC EXECUTE kalıyor; üç doğrudan runtime grant'i oluşmuyor. INHERIT FALSE/SET TRUE sahiplik devrine yetiyor, sonraki actor GRANT/REVOKE işlemlerine otomatik sahip yetkisi vermiyor. Yeni doğrulayıcı adayı reddediyor. Eski yerel PASS bu ACL invariant'ını kapsamıyordu; MANAGED_RUNNER_LOCAL_READY verilmedi. Sabit SHA sessiz değiştirilmedi; ayrı SQL/sahiplik sırası düzeltmesi gerekiyor.

Nihai yeni testler: Vitest417/417, TypeScript/ESLint/build native exit0. Managed14 + yeni contract14 + GitLF artifact9; normal Prisma runner20; DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36 PASS. Pozitif delta testi yalnız fixture içinde açık test-only ACL düzeltmesiyle yürütüldü; sonunda özgün aday durumu geri doğrulandı. Test PASS adayın güvenli olduğunu söylemez. Nihai cluster'lar kapandı; başarısız ilk denemeler raporda korunur.

Gerçek Neon/API/SQL, recovery/production/test bulut DB, R2/restore, env değişikliği veya commit/push/merge yok. token_roles ROLE_DELTA_UNRESOLVED ve bağımsız backup engeli açık. Bu sprint9dosya; önceki2V4.3b.10raporu korunur. HEAD/yerel upstream d65ea89d915805dbf6b6e5afd111beb727cf7ef5.

[Runner sözleşmesi ve kritik bulgu](research/PUSULA_V04_V43B11_MANAGED_RUNNER.md) · [Yeni test kanıtları](docs/validation/V04_V43B11_VERIFICATION.md).

---

# PUSULA V4.3b.10 — CLOUD_PREFLIGHT_PARTIAL

22.10.2026 13:49:51 Türkiye saati: development CA/hostname TLS ve startup READ ONLY + RR READ ONLY denetimi PASS. PG18.6,40tablo/26FORCERLS/15başarılı migration; 016pending; ilk15checksum, bilinen rollback008,8schemahash,rol/ACL fingerprint ve PO-2026-9893 eşleşti. Executor/creator yok. Yeni managed pre ölçümü tarihsel59252aa9…7c009 ile aynı; pin dosyaları değişmedi, post=null/applyEnabled=false.

Provider sistem CA GET401; token/oturum yenilenmedi. Güncel proje/org/branch/endpoint/recovery/snapshot/operasyon/Free plan ve kapasite teyitsiz. SQL hedefi önceki başarılı provider kanıtı ve sabit development allowlist'iyle doğrulandı; güncel provider mapping yerine geçmez. Managed rol çözümünün katalog ön koşulları mevcut; Neon'a özgü CREATE/SET/GRANT/REVOKE/DROP başarısı NEEDS_EVIDENCE. A önkoşullar sınırlı, B uygulama kabulü yok, C recovery tarihsel veri/şema sınırıyla, D kapalı runner geliştirmesi mümkün. ROLE_DELTA_UNRESOLVED ve bağımsız backup/restore engeli açık.

Yalnız → rapor belgesi; eski geçmiş korunur. Migration/kaynak/pin/env değişikliği, DDL/DML/GRANT, provider mutation, production/test/recovery SQL, R2/restore veya commit/push/merge yok. HEAD/yerel upstream d65ea89d915805dbf6b6e5afd111beb727cf7ef5; uzak ref sorgusu proxy hatasıyla teyitsiz. Test/build yeniden koşulmadı.

[Preflight ve uygulanabilir sonraki adımlar](research/PUSULA_V04_V43B10_NEON_PREFLIGHT.md) — [Gerçek doğrulama kayıtları](docs/validation/V04_V43B10_VERIFICATION.md).

---

# PUSULA V4.3b.9a — DELIVERY_PASS

Yetkili feature dalında tam30dosya, commit `9d5fb2d12799b4dcc42547ab054036f28e8d55d7` ile teslim edildi. Normal push exit0; push sonrası HEAD/upstream/gerçek uzak ref aynı SHA, ahead/behind0/0 ve çalışma ağacı temiz doğrulandı. Bu gözlem yalnız rapor ve LAST_REPORT takip dokümantasyon commit'ine kaydedilir; nihai takip SHA'sı son mesajda bildirilir.

Bu teslimde Vitest395/395, TypeScript, ESLint, native build ve gerçek Git LF artifact9/9 yeniden geçti. Staged sır taraması, diff check ve staged SQL016 SHA7368c775ec5d9b2b126b4731d5985ec83d1cad077f2cd5904ff596a04f22b272 doğrulandı. PostgreSQL fixture sonuçları önceki hazırlık kanıtıdır; yeniden çalıştırılmadı. İlk15SQL/eski baseline ve sınırlı checksum çiftleri korundu; cloud apply kapalı. Gerçek Neon/DB/provider/R2/env işlemi, main merge, force-push veya hard reset yok. token_roles ve managed cloud/bağımsız backup engelleri açık.

[Nihai teslim raporu](reports/PUSULA_V04_V43B9A_CODEX_DELIVERY.md).

---

# PUSULA V4.3b.9a — CHECKSUM_FIX_PASS

Beş tarihsel migration'ın gerçek PostgreSQL READ ONLY history kayıtları, baseline ve çalışma ağacıyla eşleşiyor. Git LF blob'larından fark her dosyada yalnız son LF önündeki tek CR; tüm dosyanın CRLF olması değil. Başarılı history checksum'ları değiştirilmeden, beş tam ad/sabit hash çiftiyle dar karşılaştırma uyumluluğu eklendi. Bilinmeyen byte biçimi, içerik değişikliği, yanlış ad, eksik dosya ve bilinmeyen checksum reddediliyor. Gerçek eski resolved 008 checksum'u 35ca1ae8…ed1fd9 yalnız rollback kaydında kabul edilir; başarılı SQL olarak kabul edilmez.

İlk 16 SQL, eski baseline'lar, managed pinler, Git attributes ve .env.local değişmedi. 016 SHA 7368c775ec5d9b2b126b4731d5985ec83d1cad077f2cd5904ff596a04f22b272 korunuyor. Cloud apply hâlâ kapalı. Gerçek Neon SQL/API, DB history mutation, provider/R2/env işlemi veya Git commit/push/merge yok.

Yeni izole PG18.6: managed14 + artifact9, Git LF history ile normal Prisma runner20; DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36 PASS. İki fixture sunucusu kapandı. Vitest395/395, TypeScript, ESLint ve production build native exit0. Önceki başarısız denemeler raporda korunur. Eski DELIVERY_BLOCKED sonucu tarihsel kayıttır; checksum engeli yerelde giderildi, GitHub teslimi henüz yapılmadı. token_roles ve managed cloud/R2 denetim sınırları açık.

[Checksum düzeltmesi ve kesin 29 dosyalık teslim listesi](research/PUSULA_V04_V43B9A_CHECKSUM_FIX.md) · [Doğrulama](docs/validation/V04_V43B9A_VERIFICATION.md).

---

# PUSULA V4.3b.5–V4.3b.9 — DELIVERY_BLOCKED

21.10.2026 · GitHub tesliminde HEAD/upstream/gerçek uzak ref f56caed5eadb64e76304777f83477f1677c19d19 ve ahead/behind 0/0 doğrulandı. V4.3b.9'un 13 dosyası ile uzakta eksik yedi V4.3b.5–8 raporu kapsamda; beklenmeyen dosya yok. Dört istenen kontrol yeniden çalıştı: Vitest389/389, npx tsc, ESLint ve native build exit0. Önceki PostgreSQL fixture testleri bu teslimde yeniden çalıştırılmadı.

Kritik engel: değişmemiş 004/005/007/008/012 migration çalışma kopyaları CRLF checksum baseline'ına uyarken, mevcut Git commit'indeki LF blob'ları aynı baseline'a uymuyor. Git artifact'larının izole kopyasında gerçek stockFiles kontrolü STOCK_LEGACY_CHECKSUM_REJECTED verdi; DB bağlantısı yok. Bu önceden mevcut sorunu kontrol gevşeterek veya ilk 15 SQL/baseline'ı değiştirerek geçirme yapılmadı. Kullanıcının kritik hatada dur koşulu gereği stage/commit/push yapılmadı. 016 SHA 7368c775ec5d9b2b126b4731d5985ec83d1cad077f2cd5904ff596a04f22b272 ve yeni pinler doğru; cloud apply kapalı. Gerçek Neon/R2/env ve provider kaynak mutation yok.

[Teslim raporu, hash kanıtları ve açık engel](reports/PUSULA_V04_V43B9_CODEX_DELIVERY.md). Önceki yerel kabul aşağıda tarihsel olarak korunur.

---

# PUSULA V4.3b.9 — MANAGED_ACL_LOCAL_PASS

21.10.2026 · PostgreSQL 18.6 üzerinde ayrı non-superuser LOGIN actor ile 016 sahiplik sorunu çözüldü. Tek-aktör yaklaşımının silemediği bootstrap ADMIN üyeliği, transaction içinde geçici pusula_stock_role_creator kullanılıp sonunda DROP edilerek kaldırılıyor. Commit sonrası executor üyelikleri, actor SET/INHERIT ve executor schema CREATE yok; runtime'a executor veya doğrudan stok DML yetkisi verilmedi. pg_temp yeni fonksiyonların search_path sonunda açıkça yer alıyor.

Resolved 008 kaydı exact checksum ve tek başarılı karşılığıyla korunur; başarılı migration sayısı ayrı hesaplanır. Unresolved, bilinmeyen checksum, çift başarı ve kısmi durumlar fail-closed. Yeni 016 SHA `7368c775ec5d9b2b126b4731d5985ec83d1cad077f2cd5904ff596a04f22b272`; önceki SHA `80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18`. İlk 15 SQL ve eski DB baseline değişmedi. Ayrı managed fixture pinleri ölçüldü; Neon profili tarihsel pre ile sınırlı, post=null/applyEnabled=false. Cloud apply açılmadı.

Nihai gerçek fixture: normal runner 20/20, managed 12/12; 47 tablo/33 FORCE RLS/16 başarı. Normal fixture DB11/Auth62/Cloud11/Supplier16/Purchase28/Stock36; managed AuthC2 9/Supplier16/Purchase28/Stock36 PASS. İki fixture sunucusu kapandı. Vitest389/389, TypeScript, ESLint ve native production build exit0. Mevcut .data tracing uyarısı sürüyor. İlk pin/üyelik/kodlama ve build çıkış kaydı sorunları raporda açıklandı ve nihai adayla tekrar doğrulandı.

Gerçek Neon/API/DDL/DML/GRANT, recovery/production/test bulut DB, provider kaynak mutation, gerçek Auth/MFA/R2/env değişikliği veya Git commit/push/merge yok. Önceki V4.3b.5–8 raporlar korundu. token_roles ROLE_DELTA_UNRESOLVED ve bağımsız backup engeli açık. Gerçek bulut uygulaması için ayrı denetim ve açık kullanıcı onayı gerekir.

[Düzeltme raporu](research/PUSULA_V04_V43B9_MANAGED_ACL_FIX.md) · [Doğrulama](docs/validation/V04_V43B9_VERIFICATION.md).

---

# PUSULA V4.3b.8 ? NEON_COMPATIBILITY_BLOCKED

21.10.2026 ? development TLS do?rulamal? RR READ ONLY SQL: PG18.6, 40 tablo/26 FORCE RLS, 15 ba?ar?l? migration, 015 checksum ve sekiz ?ema kategorisi e?it; 016 pending. ?nceki kapsanan business/?ema/history/rol/ACL kan?tlar?yla e?le?me korundu. Ger?ek actor neondb_owner; CREATEROLE/CREATE/grant haklar? var fakat SUPERUSER=false ve createrole_self_grant bo?. De?i?memi? 016 yeni executor'a SET ROLE yolu kurmadan ALTER FUNCTION OWNER kullan?yor; standart PG18 ile sahiplik devri engeli beklenir, Neon istisnas? veya DDL ba?ar?s? kan?tlanmad?. Yerel runner cloud'a kapal?; fixture ACL pin'i managed profile e?it de?il ve ger?ek resolved 008 kayd? kat? stock history kontrol?ne uyumsuz.

A managed ACL: BLOCKED. B recovery: PASS_WITH_LIMITATIONS, yaln?z kapsanan tarihsel veri/?ema kan?t?. C cloud runner haz?rl???: PASS_WITH_LIMITATIONS, engelleri ??zmek i?in ayr? haz?rl?k yap?labilir; apply yetkisi yok. Recovery token_roles fark? ROLE_DELTA_UNRESOLVED korunur; recovery SQL yok. Provider GET sistem CA ile HTTP401: g?ncel kaynak envanteri teyit edilemedi. R2 ba??ms?z backup/restore operasyonel de?il; 35/21 allowlist 47/33 kabul? sa?lamaz.

Yaln?z iki yeni rapor ve bu dosyan?n ba??na ?zet eklendi; ?nceki raporlar korundu. Migration/source/env de?i?ikli?i, rol/ACL DDL-DML-GRANT, branch/endpoint/snapshot mutation, test/production/recovery SQL, restore/R2, test/build veya Git commit/push/merge yok. HEAD f56caed5eadb64e76304777f83477f1677c19d19.

[Uyumluluk raporu](research/PUSULA_V04_V43B8_NEON_COMPATIBILITY.md) ? [Do?rulama](docs/validation/V04_V43B8_VERIFICATION.md).

---

# PUSULA V4.3b.7 — RECOVERY_BRANCH_PARTIAL (güncellenmiş onay)

21.10.2026 18:54 Türkiye saati. Free plan + Console kapasite kanıtına ve tüketim API'si 403 olsa da devam edilmesine verilen yeni açık onaya dayanarak tek recovery oluşturuldu: br-late-river-baeipun8 / pusula-v43b6-pre-migration-016-20261021. Parent br-rough-darkness-ba6ow9zo; provider capture 2026-10-21T15:51:53Z, LSN 0/38201C8; oluşturulma 15:52:18Z. Yeni endpoint ep-aged-flower-bauhc0to, min=max0.25CU, suspend_timeout_seconds=0 (Free varsayılanı5dk; 0 kapalı anlamına gelmez). Her iki POST tek deneme HTTP201; eski kaynaklar korundu.

Kaynak/recovery TLS CA+hostname ve RR READ ONLY kontrolleri geçti. PG18.6,40tablo,26FORCERLS,15başarılımigration,015SHA,016pending,8schemahash,üyelik/default/tableACL,7businesscount/digest ve Supplier/Material/Variant/PO ilişkileri eşit. PO-2026-9893 APPROVED,1satır,2m→3.04m²,30.40USD. Capture öncesi ve sonrası kaynak business/schema/izin referansları aynı; tamDBRPO0 iddiası yok.

PARTIAL gerekçesi: ilk recovery kontrolü PRIVILEGE_DRIFT ile durdu. Salt okunur tanılama tek ek rol token_roles olduğunu gösterdi (NOLOGIN, super/createdb/createrole/bypassrls=false); kaynak rollerinin ölçülen özellikleri eşit. Ek rolün kökeni doğrulanmadı, tam rol fingerprint'i PASS sayılmadı. Düzeltme/normalization/silme/restore/yeniden oluşturma yapılmadı. Son GET:5/10branch,5endpoint,1snapshot,118operasyon,pending/failed0. TüketimAPI403; artımlı tüketim/kalan kota API ile ölçülemedi.

Migration016, production/test SQL, R2, Auth/MFA/session içerik erişimi, .env.local değişikliği, test/build veya Git commit/push/merge yapılmadı. HEAD f56caed5eadb64e76304777f83477f1677c19d19. [Oluşturma raporu](research/PUSULA_V04_V43B7_RECOVERY_CREATION.md) · [Doğrulama](docs/validation/V04_V43B7_RECOVERY_VERIFICATION.md).

---

# PUSULA V4.3b.7 — RECOVERY_BRANCH_BLOCKED

21.10.2026 18:40 Türkiye saati. Güncel GET ile proje/source/endpoint kimlikleri, Free plan, 4/10 branch, mevcut 4 endpoint ve 1 snapshot doğrulandı; önerilen recovery adı mevcut değil. Cursor ile provider geçmişinin son boş sayfasına kadar 112 kayıt tarandı; pending/failed 0.

Tüketim GET yeniden HTTP 403 döndürdü. Kullanıcının önceki Console kullanım kanıtı korundu; güncel API ölçümü veya kesin kalan kota sayılmadı. V4.3b.7 talimatındaki kapasite belirsizliğinde oluşturma öncesinde durma koşulu nedeniyle yeni branch/endpoint POST'u gönderilmedi. Yeni SQL kaynak kontrolü, yazıcı kontrolü, source referansı ve recovery karşılaştırması çalıştırılmadı; V4.3b.6 sonuçları yeni koşulmuş gibi sunulmadı. Yeni branch/endpoint ID ve capture LSN yoktur.

Yalnız GET ve yerel raporlama yapıldı. Mevcut kaynaklar, önceki değişiklikler ve .env.local korundu. Migration, R2, restore/finalize, SQL bağlantısı, Auth/MFA/session içeriği erişimi, test/build veya Git commit/push/merge yok. HEAD f56caed5eadb64e76304777f83477f1677c19d19 olarak kaldı.

[Oluşturma raporu](research/PUSULA_V04_V43B7_RECOVERY_CREATION.md) · [Gerçek doğrulama sonuçları](docs/validation/V04_V43B7_RECOVERY_VERIFICATION.md).

---

# PUSULA V4.3b.5 — RECOVERY_PREFLIGHT_PARTIAL

21.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `f56caed5eadb64e76304777f83477f1677c19d19`. İlk koşuda ağacı temizdi;devam koşusunda yalnız önceki üç rapor değişikliği vardı ve korundu. Commit/push/merge yapılmadı.

Son devam talimatında kullanıcıConsoleekran görüntüsü kanıtı verdi:Free,storage31,69MB,compute0,02CU-saat,4branch,6saatretention. Bu değerler kullanıcıkanıtı olarak ayrıldı;APIölçümü veya kalan kota gibi sunulmadı.21Ekim18:11Türkiye saati yeniGET200ile onaylıproje/development/endpoint doğrulandı;APIfree_v3,4/10branch ve21600sretentiondöndü.

YalnızonaylıdevelopmentDB'de CA/hostnameTLS,startupread-only veREPEATABLE READ READ ONLY denetimiPASS:PG18.6,40tablo/26FORCERLS,15başarılımigration,015SHAeşit,016pending.8schemahash ve4mevcutprivilegehash eşit;unresolved0,bilinen008resolvedrollback1,stokexecutorrolüyok. PO-2026-9893APPROVED,1satır,30,40USD;2m→3,04m²dönüşümeşit. Supplier/PO/Material/Variant toplamları1'er. Transactionrollbackilekapandı ve bağlantısonlandırıldı;Auth/MFA/sessioniçeriği okunmadı.

GenelsonuçPARTIAL:ConsumptionAPI403,kalanstorage/CUkotası,snapshotlimiti ve yeni recovery/endpointmaliyet teyidi eksik;ücretsizoluşturma veya tamkapasitePASSiddiası yok. Önceki401veSQLçalıştırılmayan koşular raporda tarihsel olarak korundu. MevcutACLpinlerinin kapsam sınırlaması raporda belirtildi;bu016manageduyumluluk onayı değildir.

Yerel ilk15migration SHA15/15 ve016SHA `80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18` korundu. Yalnız üç rapor belgesi değişti. NeonPOST/PATCH/DELETE,branch/endpoint/snapshotoluşturma,restore/finalize,R2,veri/rol/ACLve.env.localdeğişikliği veya test/build işlemi yoktur. RPO/capture ve kalanquota/maliyet teyidi sonra tamamlanmalıdır. Henüz brancholuşturma veya016apply izni yoktur.

[Recovery preflight raporu](research/PUSULA_V04_V43B5_RECOVERY_PREFLIGHT.md) · [Gerçek kontroller ve eksik kanıtlar](docs/validation/V04_V43B5_VERIFICATION.md).

---

# PUSULA V4.3b.4 — DELIVERY_PASS (önceki teslim)

21.10.2026 · Kullanıcı bu görevde yalnız `feat/pusula-v030-neon-cloud` dalında commit/normal push yetkisi verdi. Başlangıç HEAD ve gerçek uzak ref `cd4ffcfeb576cef64b553c875e59617716ed1383`, ahead/behind0/0; değişiklikler beklenen9dosyaydı.

Bu teslim görevinde `npm.cmd test`379/379, `npx.cmd tsc --noEmit`, `npm.cmd run lint` ve `npm.cmd run build` native exit0 ile geçti. Runner20/20 ve Stock36/36 önceki hazırlık kanıtıdır; bu görevde PostgreSQL veya migration çalıştırılmadı. Migration001–016 içerikleri/checksum'ları ve cloudguard korunur;Neon/R2/Auth/MFA/.env.local işlemi yoktur.

Kod commit'i `364944090b93c7372b695d599f7001a053a25aa8`, istenen `chore(v0.4): prepare isolated V4.3b.4 migration 016 runner` mesajıyla oluşturuldu. Yalnız `origin/feat/pusula-v030-neon-cloud` dalına normal push exit0. Push sonrası HEAD/upstream ve gerçek uzak ref aynıSHA,ahead/behind0/0,çalışma ağacı temiz olarak doğrulandı. Bu gözlem yalnız iki teslim belgesine takip dokümantasyon commit'iyle kaydedilir;nihai rapor commit SHA'sı kullanıcıya ayrıca bildirilir. [GitHub teslim raporu](reports/PUSULA_V04_V43B4_CODEX_DELIVERY.md).

---

# PUSULA V4.3b.4 — LOCAL_RUNNER_READY (hazırlık aşaması)

21.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD ve upstream `cd4ffcfeb576cef64b553c875e59617716ed1383`; başlangıç çalışma ağacı temizdi. Commit/push yapılmadı.

Migration 016 için ayrı, yalnız yerel fixture kabul eden runner hazırlandı. Preflight 40 tablo/26 FORCE RLS/15 migration, postflight 47/33/16; SQL/şema ve ayrı ACL/rol/izin pin'leri doğrulanır. Gerçek Prisma apply, ALREADY_APPLIED, kısmi şema/ACL/RLS drift, preflight ve apply lock timeout/rollback testleri geçti. Boş/bozuk ACL pinleri de reddedilir. Eski cloud guard kaldırılmadı; yeni kapı Neon'a bağlantıdan önce durur. 016 SHA `80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18` ve ilk15 SQL aynen korunur.

Son tam yerel PG18.6 koşusunda runner20 kontrol, DB/RLS11, Auth62, Cloud11, Supplier16, Purchase28 ve Stock36 PASS. Vitest379/379; TypeScript/ESLint ve production build native exit0. Tüm fixture sunucuları kapatıldı. İlk başarısızlıklar ve düzeltmeler raporda korunur.

Pre-016 recovery planı hazır; eski pre-015 branch güncel PO ve015 için yeterli değildir. Güncel kota, parent ID/TLS, managed ACL ve capture RPO teyidi sonraki ayrı onaylı aşamadır. Bağımsız R2 backup/restore engeli ve35/21 allowlist korundu. Gerçek Neon/API/SQL, test/production, Auth/MFA, R2, branch/snapshot/restore veya .env.local işlemi yapılmadı. Bu sonuç gerçek Neon migration uygulama izni değildir.

[Hazırlık/kurtarma planı ve kesin9dosyalık Mimo listesi](research/PUSULA_V04_V43B4_CLOUD_READINESS.md) · [Test kanıtları](docs/validation/V04_V43B4_VERIFICATION.md).

---

# PUSULA V4.3b.3 — FIX_PASS (önceki teslim)

21.10.2026 · `feat/pusula-v030-neon-cloud` · başlangıç `1287e82fd1df1357b128fb55f0966cd1789db5c4`. Başlangıç çalışma ağacı temizdi;commit/push yapılmadı.

F1:ortak PO→depo kilit sırası,sıralı PO satırı/varyant ve lot/bakiye kilitleri. F2:tam reversal sipariş net kabulünü azaltır;2m→2m→reverse→yeniden2m artık mümkün,eski POSTED belge ve immutable ledger korunur. F6:yetkili salt okunur outcome sorgusu,ağ/5xx uzlaştırması,kesin4xx ayrımı ve doğrulanamayan sonuç mesajı;otomatik mutation retry yoktur. Runtime lock3s/statement10s;Prisma8s maxWait/15s timeout değişmedi.

Gerçek izole PostgreSQL18.6:son Stock36/36,Supplier16/16,Purchase28/28;ayrı tam koşudaDB/RLS11/11,Auth62/62,Cloud11/11. Gerçek Chrome desktop/mobile4/4,Vitest373/373,TypeScript/ESLint PASS,production build native exit0. Migration late-failure rollback ve yeni checksum/fingerprint ile sıfırdan pinli gerçek Prisma deploy PASS;47tablo/33FORCE RLS. Tüm fixture sunucuları kapatıldı. İlk başarısızlıklar raporda korunur;tam koşunun test enjeksiyonunda durması başarılı son candidate'larla karıştırılmaz.

016eskiSHA `4dc07f6a16c5d423b3dbafd06c377775212d728f701c5b3390a5dbb7cbbe5a89`;yeniSHA `80229d594126e1fda30bd975aa4af76b4a47eda920d2a7d52a556e237f4bbe18`. Mimo teslimiyle yeni resmî referans değişmektedir. İlk15migration checksum'u15/15aynı. Gerçek Neon,PO-2026-9893,.env.local,gerçek Auth/MFA,R2,recovery branch'leri ve cloud migration guard korunur. Cloud/production/backup kabulü iddia edilmez. Build'de mevcut .data tracing uyarısı vardır;son koşuda native çıkış0doğrulandı.

[Düzeltme raporu ve kesin14dosyalık Mimo listesi](research/PUSULA_V04_V43B3_FIX_REPORT.md) · [Test kanıtı ve ilk başarısızlıklar](docs/validation/V04_V43B3_VERIFICATION.md) · [Güncel stok sözleşmesi](docs/architecture/V43B_INVENTORY_CONTRACT.md).

---

# PUSULA V4.3b — LOCAL_ACCEPTANCE_PASS (önceki teslim)

20.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `295c29879b4c0fc7c24de6f5cecd5b5ddaf40697`.

Mal Kabul → lot → immutable ledger/cache akışı geliştirildi. GoodsReceipt/Line,StockLocation,StockLot,StockPostingBatch,StockMovement,StockBalance:izole PG18.6'da47tablo/33FORCE RLS/16migration. Kısmi/tam/ret teslim,aynı-key replay,post idempotency,parent-lock aşım kontrolü,atomik rollback,versioned draft/cancel veayrı tam reversal var.2m×152cm=3.04m²türetilmiş;tek otoritatif stok2metredir. MaterialVariant.usdCost değişmez;edinim/FX snapshot ayrı veizinli DTO'dur.

Gerçek non-owner fixture API/SQL Stock27/27;tamDB11/Auth62/Cloud11/Supplier16/Purchase28PASS. Son candidateAPI27vegerçekdesktop/mobilebrowser4/4PASS;MFA,400sonrası taslak koruma,focus,F5ve3.04m²gösterimi doğrulandı. Vitest368/368,TypeScript,ESLint0/0veproductionbuildPASS. Eski .data tracing uyarısı korunur. İlk başarısız koşular veadversarial OWN toplam/picker kusurlarının düzeltmeleri raporda saklandı;başarısız koşular PASS sayılmadı.

016SHA-256:`4dc07f6a16c5d423b3dbafd06c377775212d728f701c5b3390a5dbb7cbbe5a89`. İlk15SQL/eskibaseline değişmedi. GerçekNeon'a bağlanılmadı veya016uygulanmadı;cloud runner bağlantıdan önce ayrı inceleme/onay kapısıyla durur. PO-2026-9893,gerçekAuth/MFA,env,production/testNeon,snapshot/recovery veR2korundu. Bağımsız backup/E2engeli açık;transfer,sayım,sarf/remnant,V4.3c/V4.5ayrı kapsamdır. Fixture'lar kapandı;commit/push/merge yok.

[Codex raporu ve kesin25dosyalık Mimo listesi](research/PUSULA_V04_V43B_CODEX_REPORT.md) · [Gerçek test kanıtları veilk başarısızlıklar](docs/validation/V04_V43B_VERIFICATION.md) · [Stok domain sözleşmesi](docs/architecture/V43B_INVENTORY_CONTRACT.md).

`.data`,fixture/env/sırlar,generated/build/browser artifact'ları Git teslimine alınmaz. GitHub teslimini Mimo yapacak;bu yerel kabul gerçekNeon016veproduction onayı değildir.

---

# PUSULA V4.3a.4 — CLOUD_BASELINE_ACCEPTED

20.10.2026 · **V4.3a — CLOUD_BASELINE_ACCEPTED** · HEAD `1c41d04d299bd49087ac36d04f88b91cf6cfbc0f`.

Kullanıcı gerçek /app üzerinde MASTER login,PurchaseAPI200,test malzeme152cm,metre link,PO-2026-9893 oluşturma,F5kalıcılığı,MFA ve ikinci tıklamada onayı manuel doğruladı. Bunlar Codex otomatik testi değildir.

Codex READ ONLY SQL:40tablo/26FORCE RLS/15başarılı migration,checksum/pinler uyumlu;MASTER6satın alma izni. Hedef PO APPROVED,1satır,2metre→3,04m²;bağımsız Decimal2×15,20=30,40USD ve snapshot eşit. Test ilişkileri tutarlı. Mevcut kapsam/aggregate kontrolleri stok/cari/ödeme hareketiyle ilişki olmadığını destekliyor;mal kabul testi değildir.

MFA sonrası dialog yalnız kapanıyor,approve otomatik yeniden gönderilmiyor;ikinci tıklama geçerli step-up ile uyumlu. İlk isteğin kesin hata kanıtı yok;bağlantı hatası denmedi. Yeniden Onayla yönlendirmesi UX takip maddesi.

Snapshot ve iki recovery branch'i korunuyor. Gerçek bulut iki tenant negatifleri,normal explicit DENY,tüm currency/offer sürümleri,R2backup/restore ve mal kabul açık. Kabul production-ready değildir. Kod/env/SQL/gerçek veri değişikliği,R2,restore/silme,commit/push/merge yok.

[Bulut kabul raporu](research/PUSULA_V04_V43A4_CLOUD_ACCEPTANCE.md) · [Doğrulama](docs/validation/V04_V43A4_VERIFICATION.md).

Mimo'ya kesin sprint teslimi:`research/PUSULA_V04_V43A4_CLOUD_ACCEPTANCE.md`,`docs/validation/V04_V43A4_VERIFICATION.md`,`LAST_REPORT.md`. Önceki raporlar korunur;`.data`teslim edilmez.

---

# PUSULA V4.3a.3 — Development migration015 uygulandı

20.10.2026 · **MIGRATION_PASS / CLOUD_ACCEPTANCE_PARTIAL** · HEAD `1c41d04d299bd49087ac36d04f88b91cf6cfbc0f`.

Açık development migration ve bakım teyidiyle güvenli runner tek kez çalıştı:APPLIED,exit0. Bağımsız postflight40tablo/26FORCE RLS/15başarılı migration,çözülmüş008=1,unresolved0;checksum/schema/ACL kontrolleri geçti. Yeni6satın alma izni yalnızMASTER'a bağlandı. Eski37tablonun içerik özetleri beklenen seed ekleri dışında korundu;AuthUser2/Membership2/Supplier1.

Gerçek pusula_runtime/Prisma READ ONLY liste ve olmayan detay sorgusu;API handler'ında oturumsuzGET401 geçti. Erişilebilir kullanıcı browser oturumu yok:oturumluAPI ve liste/detay ekranları YAPILMADI. PO/Line0;gerçek kayıt değiştirilmedi. Yazmalı kabul için somut sentetik senaryo raporda;henüz onaylanmadı/çalıştırılmadı. Bağımsız backup engeli açık.

Production/recovery/preview/snapshot ve endpoint bağlantıları korundu;env/kod/SQL değişikliği,R2,restore/finalize,ücret yükseltme,commit/push/merge yok. Bakım boyunca başka writer görülmedi;migration ve DB postflight tamamlandı.

[Migration raporu](research/PUSULA_V04_V43A3_NEON_MIGRATION_REPORT.md) · [Doğrulama ve açık kabul kapıları](docs/validation/V04_V43A3_NEON_MIGRATION_VERIFICATION.md).

Mimo'ya bu sprint teslimi:`research/PUSULA_V04_V43A3_NEON_MIGRATION_REPORT.md`,`docs/validation/V04_V43A3_NEON_MIGRATION_VERIFICATION.md`,`LAST_REPORT.md`. ÖncekiV4.3a.1/.2 dosyaları korunur;`.data` teslim edilmez.

---

# PUSULA V4.3a.2 — RECOVERY_BRANCH_PASS

20.10.2026 · HEAD `1c41d04d299bd49087ac36d04f88b91cf6cfbc0f`.

Açık kullanıcı onayıyla development'tan tek güncel data branch oluşturuldu: `pusula-v43a-pre-migration-015` / `br-broad-river-bavv5pey`; endpoint `ep-wispy-frog-ba755foo`,min/max0.25CU. Parent development,LSN `0/3638E80`,provider capture12:47:55UTC,create12:48:30UTC.

Gerçek TLS doğrulamalı READ ONLY SQL:PG18.6,38 tablo/24 FORCE RLS,14 başarılı migration,çözülmüş008=1,015 pending. Supplier1,AuthUser2,Membership2;MASTER Supplier izinleri8/8. Kaynak önce/son ve kopyada tüm38 tablo toplamları,şema/tablo-function ACL/rol fingerprint'leri eşleşti;invalid constraint/index0. Zaman farkları ve satır eşitliği sınırı raporda.

Development/production/eski preview endpoint bağlantıları ve snapshot korundu. Free branch4/10;ücret yükseltmesi yok. Toplam storage izlenmeli;compute tüketimi sürerken sayaç gecikmelidir.015 uygulanmadı;env/kod/SQL değiştirilmedi;Auth/login trafiği yönlendirilmedi;commit/push/merge yok.015 için ayrıca açık kullanıcı onayı beklenir.

[Recovery branch raporu](research/PUSULA_V04_V43A2_RECOVERY_BRANCH.md) · [SQL doğrulama kanıtı](docs/validation/V04_V43A2_RECOVERY_VERIFICATION.md).

Mimo'ya bu sprint teslimi: `research/PUSULA_V04_V43A2_RECOVERY_BRANCH.md`, `docs/validation/V04_V43A2_RECOVERY_VERIFICATION.md`, `LAST_REPORT.md`. Önceki V4.3a.1 dosyaları korunur;yerel `.data` teslim edilmez.

---

# PUSULA v0.4 — V4.3a.1 Neon recovery hazırlığı

20.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `1c41d04d299bd49087ac36d04f88b91cf6cfbc0f` · **RECOVERY_BLOCKED**.

Salt okunur canlı ön denetim **PREFLIGHT_PASS**: PG18.6,38 tablo/24 FORCE RLS,14 başarılı migration,1 çözülmüş008 rollback,015 pending; schema/runner privilege pinleri ve15 migration checksum'ı uyumlu. Supplier1, SupplierMaterial0, SupplierOfferVersion0, AuthUser2, Membership2.

Öneri: güncel development'tan veri içeren izole kurtarma branch'i; eski snapshot/preview korunur. Free branch3/10,snapshot1/1. Güncel toplam storage/kalan kapasite API'den doğrulanamadı (deprecated sıfırlar kullanılmadı; consumption v2 HTTP403); oturum açık erişilebilir Console yok. Console kapasite teyidi, ayrı branch/endpoint izni ve gerçek kurtarma testi gereklidir. Mevcut Sprint E kapsam/rol/ACL engelleri nedeniyle bağımsız yedek de hazır değildir.

Migration015 uygulanmadı; yeni branch/snapshot, dump/upload/restore veya kalıcı bulut değişikliği yapılmadı. Kod/SQL/env değişmedi; commit/push yok. Bu hazırlık migration izni oluşturmaz.

[Recovery planı](research/PUSULA_V04_V43A1_NEON_RECOVERY_PLAN.md) · [Readiness kanıtı](docs/validation/V04_V43A1_READINESS.md).

Mimo'ya kesin teslim: `research/PUSULA_V04_V43A1_NEON_RECOVERY_PLAN.md`, `docs/validation/V04_V43A1_READINESS.md`, `LAST_REPORT.md`. Yerel `.data/recovery-v43a1/` teslim edilmez.

---

# PUSULA v0.4 — V4.3a Codex F01–F10 düzeltme kabulü

20.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `2ab48ad` · **FIX_PASS — yerel kabul**.

Bağımsız denetimdeki F01–F10 düzeltildi: materyal maliyet DENY redaksiyonu, alış birimi fiyat hesabı, parent-row kilitleri ve boş onay engeli, SQL ilişki/snapshot doğrulaması, iki iptal yolu, onay step-up, create/edit ayrımı, güvenli gizli fiyat koruması ve editör para birimi, tam temsil edilemeyen miktar422 ve eksik manuel fiyat400. Tarihsel TRY teklifinin kendi TCMB snapshot'ı korunur. Normal kullanıcı OWN/ACTIVITY ve numara tahsisi kusuru, indeks uyumu, rol şablonu tutarlılığı ve yeni sipariş ayrıntı seçimi de ele alındı.

Yeni PostgreSQL18.6 fixture `v42-e20dd3a4-a688-4a06-a3b8-673bfb50d651`: gerçek Prisma migration safety18/18, DB/RLS11, Auth62, Cloud11, Supplier16, Purchases28, gerçek masaüstü/mobil Chrome2/2 PASS; 40 tablo/26 FORCE RLS/15 migration; serverStopped true. Son Vitest355/355 (29 dosya), TypeScript, ESLint0/0 ve production build PASS. Build'de mevcut rate-store dosya pattern'i için tek Turbopack warning var; başarısız ilk denemeler raporda korunur.

İlk14 migration değişmedi; 015 checksum ve yalnız dört post-schema hash'i gerçek fixture ölçümüne göre güncellendi. Eski denetim/GLM raporları ve mevcut çalışma ağacı korunur. Neon/R2/gerçek veri işlemi veya commit/push yok. Mevcut backup allowlist'i yeni PO şemasını kapsamaz; fail-closed kontrolü korunur. FIX_PASS, production/go-live veya Neon015 apply onayı değildir. GitHub teslimi Mimo'ya ayrı görev; gerçek Neon migration ayrıca kullanıcı onayı ister.

[Codex düzeltme raporu ve kesin28 dosya listesi](research/PUSULA_V04_V43A_CODEX_FIX_REPORT.md) · [Regresyon ve nihai kabul kanıtı](docs/validation/V04_V43A_CODEX_FIX_VERIFICATION.md).

---

# Önceki GLM V4.3a raporu — tarihsel kayıt

# PUSULA v0.4 — Sprint V4.3a / Satın Alma Siparişleri ilk çalışan modül

20.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `2ab48ad` (tüm değişiklikler commit'siz) · **V4.3a — LOCAL_ACCEPTANCE_PASS**

Yeni Satın Alma Siparişleri (PO) modülünün ilk çalışan sürümü tamamlandı: `PurchaseOrder`/`PurchaseOrderLine` şemaları, migration 015, tam PO servisi (idempotency/businessNo/draft versiyonlama/approve-cancel mühürleme/costView DENY sansürü), premium liste+detay+drawer UI ve izin kataloğu. PO akışı stok/cari/ödemeye dokunmaz; TRY yalnız açık TCMB snapshot'ıyla, EUR/GBP hiçbir zaman otomatik USD'ye çevrilmez; `MaterialVariant.usdCost` otomatik güncellenmez.

Migration `202610200015_purchase_orders` izole yerel PostgreSQL 18.6 fixture'ında gerçek Prisma yoluyla uygulandı ve kabul koşusu `v42-f8a7c083-db7f-480a-9a77-5baeebd82e9f` PASS: migration safety 18 kontrol PASS (baseline/schema checksum/column pin'ler, gerçek lock/statement/child timeout ve nontransactional partial enjeksiyonları, içerik koruması, ALREADY_APPLIED no-replay, fail-closed ACL: runtime PO SEL/INS/UPD + POLine SEL/INS/DEL varken test/auth ve TRUNCATE yok), `verify-c2` 9/9, suppliers 16/16, purchases 16/16 (kurumsal senaryolar: replay/409, Decimal matematik sabitliği, foreign tenant 404, inaktif tedarikçi, audit event'ler, concurrent idempotency çakışması), 40 tablo/26 FORCE RLS/15 migration. Post-015 `appliedSchema` 8 hash'i gerçek `post-schema.json`'dan `migration-baseline.json`'a pinlendi (iki fazlı bootstrap: ilk koşunun beklenen `APPLIED_SCHEMA_DRIFT` sonrası ikinci koşu birebir uyuştu). Vitest 344/344 (28 dosya, `purchase-pricing.test.ts` 15/15), `tsc --noEmit` temiz, ESLint 0/0.

Regresyon bakımı: `suppliers/verify.ts` yedek fail-closed sayımı 38→40 (PO yedekte hâlâ yok; `scripts/backup/postgres.ts` pinleri dokunulmadı, backup allowlist 35/21 kalır); fixture bootstrap artık Role satırlarını migration cross-join'lerinden önce ekliyor (production sırası); partial-schema kontrolleri 015 tablo sınıflandırmasına güncellendi. Neon (development/test/production), R2, restore/finalize işlemi yok; 014 ve öncesi checksum'lar korundu; `OLD`/`NEW` yalnız trigger'lerde. Kullanıcı teslimi: commit/push yapılmadı — Git teslimi Mimo'ya.

[V4.3a sprint raporu](research/PUSULA_V04_V43A_GLM_REPORT.md) · [Doğrulama kanıtı](docs/validation/V04_V43A_VERIFICATION.md)

---

# Önceki V4.2f / V4.2e kaydı — tarihsel durum (içerik aşağıda korunur)

19.10.2026 · `feat/pusula-v030-neon-cloud` · **V4.2 temel development bulut kabulü tamamlandı; ileri senaryolar açık.**

Güncel Codex READ ONLY doğrulaması18:05:51Z: PostgreSQL18.6,014 applied,38 tablo/24 FORCE RLS/14 başarılı migration; sekiz yeni Supplier izni ve sekiz MASTER ilişkisi, MASTER toplam66 izin. Post-schema/rol/ACL pinleri uyumlu, beklenmeyen drift yok.18:06:16Z yalnız ad parametreli sayımda PUSULA TEST TEDARİKÇİSİ için1 aktif eşleşme doğrulandı; SupplierMaterial/SupplierOfferVersion0. Hassas Auth/MFA/session veya finansal içerik okunmadı.

Kullanıcı MASTER giriş/TOTP,/app Tedarikçiler,Supplier API HTTP200,kayıt oluşturma,F5 kalıcılık ve ayrıntı ekranını başarılı bildirdi. Bunlar kullanıcı manuel kabulüdür; Codex'in bağımsız browser/HTTP testi değildir. Önceki gerçek runtime/Prisma smoke kanıtı tarihsel olarak korunur.

Canlı açık maddeler: SupplierMaterial eşleştirme,SupplierOfferVersion oluşturma/tarihsel sürümler,iki tenant izolasyonu,explicit DENY/maliyet gizliliği ve bağımsız R2 backup. Yerel fixture kanıtları bu kapıları kapatmaz. Snapshot ve preview branch/endpoint metadata'sı korunuyor. Bu sprint yeni migration,DML/kayıt oluşturma veya silme,production/test SQL,R2,restore/finalize yok.

[V4.2f kapanış raporu](research/PUSULA_V04_V42F_CLOUD_ACCEPTANCE.md) · [Güncellenmiş bulut kabulü](docs/validation/V04_V42E_CLOUD_ACCEPTANCE.md). Codex yalnız teknik doğrulama ve üç Markdown dosyasını hazırladı; önceki değişiklikler korundu, commit/push yapılmadı. Git teslimi Mimo'ya ait.

---

# Önceki V4.2e kaydı — manuel kabul öncesi tarihsel durum

# PUSULA v0.4 — Sprint V4.2e / gerçek migration014 uygulandı

19.10.2026 · `feat/pusula-v030-neon-cloud` · **V4.2e — MIGRATION_APPLIED / CLOUD_ACCEPTANCE_PENDING**

Kullanıcı bakım penceresini ve başka development yazıcısı bilmediğini teyit etti. Son provider metadata ve15:49:57Z bayraksız preflight PASS;15:50:22Z faaliyet/DDL/sayım kapıları geçti. Migration014 yalnız pusula_development üzerinde güvenli runner ile bir kez uygulandı; exit0/APPLIED. DB started_at15:50:30.346Z, finished_at15:50:30.780Z (İstanbul18:50:30.780).014 hash ve ilk13 checksum korundu; retry/resolve/manuelSQL/restore yok.

Bağımsız gerçek postflight:38 tablo/24 FORCE RLS/14 başarılı migration; eski1 resolved008 rollback korunur. Sekiz Supplier Permission ve sekiz MASTER ilişkisi eklendi; MASTER toplam66 izin. Üç Supplier tablosu mevcut ve0 kayıt. Post-schema/ACL pinleri ve test_runtime sınırı geçti. Eski35 tablonun32 toplamı aynı; yalnız Permission58→66,RolePermission92→100,history14→15 değişti. AuthUser2/Membership2 ve iş toplamları korundu; tam içerik eşitliği iddiası yok.

Gerçek pusula_runtime/Prisma ile READ ONLY üç Supplier sorgusu PASS; istemci TLS socket CA/hostname/encrypted/authorized doğrulandı. İlk smoke backend pg_stat_ssl ölçümü yüzünden durmuştu; gerçek istemci socket ölçümüyle ayrıştırıldı, korumalar kapatılmadı. Oturum açılmış MASTER UI/HTTP API kabulü ve canlı yazmalı testler yapılmadı; tam NEON_MIGRATION_PASS verilmez. Yeni Auth session veya sahte Supplier/sipariş oluşturulmadı.

Aynı sprintte yerel TypeScript/ESLint PASS,Vitest329/329,migration safety16/16,DB/RLS11/11,Auth/API62/62,Cloud/DB11/11,Supplier16/16 geçti; ayrı localhost fixture kapandı. Build/browser koşulmadı. Gerçek Neon test/production/preview SQL yok. Snapshot/preview/production ID ve endpoint bağları,ayarları korundu; R2/finalize/reset/delete/ücretli plan yok.

[Gerçek migration raporu](research/PUSULA_V04_V42E_NEON_MIGRATION_REPORT.md) · [Bulut kabul durumu](docs/validation/V04_V42E_CLOUD_ACCEPTANCE.md). Development şeması V4.3 için kurulu; önce kalan gerçek MASTER salt okunur UI/API kabulü tamamlanmalı. Sprint E production engelleri sürer. Codex commit/push yapmadı; Mimo'ya iki belge ve LAST_REPORT sonucu devredilir.

---

# Önceki V4.2e bakım kapısı kaydı — apply öncesi tarihsel durum

# PUSULA v0.4 — Sprint V4.2e / canlı preflight ve bakım kapısı

19.10.2026 · `feat/pusula-v030-neon-cloud` · **V4.2e — BLOCKED / NO_APPLY**

Migration uygulama onayı geçerli; eksik olan talimattaki zorunlu bakım penceresi ve development'a yazabilen uygulama/diğer kullanıcı/worker/scheduler işlemlerinin durdurulduğu teyididir. Bu bilgi soruldu; teyit gelmeden --apply kullanılmadı. Anlık başka istemci olmaması bakım teyidi yerine geçmez.

Operatör henüz tüm yazıcıları doğrulamadığını bildirdi. Yeni15:44:34–45Z READ ONLY üç örneklemde başka development session/transaction,diğer oturum kilidi ve prepared transaction yok. Yerelde Pusula Next.js veya eşleşen görünür scheduler bulunmadı; worker adı taşıyan Codex araçları ayrıştırıldı. Vite4207'nin Pusula ilişkisi doğrulanmadı,kapattırılmadı. Uzak deployment/başka cihaz ihtimali açık: Pusula sekmeleri ve varsa haricî yazıcılar bakım boyunca operatörce duraklatılıp teyit edilmeli. Süreç/servis/oturum sonlandırılmadı; migration uygulanmadı.

Gerçek bayraksız runner15:10:04.051Z: PREFLIGHT_PASS, applied=false, PostgreSQL18.6,35 tablo/21 FORCE RLS,13 başarılı migration,1 resolved008 rollback,014 pending. Şema/izin/checksum drift yok.15:11:15Z READ ONLY gözleminde diğer istemci,aktif transaction,çakışan DDL/bekleyen lock ve prepared transaction0. Eski35 tablo sayım referansı alındı: AuthUser2/Membership2; eski iş tabloları0. Supplier izinleri henüz0; gerçek014 uygulanmadı.

TypeScript ve ESLint PASS; Vitest329/329,27 dosya,23.43 saniye. Yeni localhost fixture'da migration güvenliği16/16,DB/RLS11/11,Auth/API62/62,Cloud/DB11/11,Supplier16/16 PASS; serverStopped=true. Bunlar gerçek Neon Supplier kabulü değildir. Canlı MASTER UI/API ve browser smoke uygulanmadı.

HEAD/uzak feature `a88fa0c`,fark0/0; önceki değişiklikler korunur.014 hash aynı. Provider metadata'da development/production/restore preview bağları ve snapshot korunuyor; yeni restore/branch/snapshot/finalize/delete yok. Production/Neon test SQL veya R2 işlemi yok.

[Migration raporu](research/PUSULA_V04_V42E_NEON_MIGRATION_REPORT.md) · [Bulut kabul durumu](docs/validation/V04_V42E_CLOUD_ACCEPTANCE.md). Bakım teyidinden sonra taze preflight/lock kontrolü, tek onaylı apply ve gerçek38/24/14 postflight gerekir. Codex commit/push yapmadı; Mimo'ya bu iki belge ve LAST_REPORT V42E özeti devredilir.

---

# Önceki V4.2d.4 kaydı

# PUSULA v0.4 — Sprint V4.2d.4 / restore PostgreSQL tanısı ve kabul

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `a88fa0c` korunur. **RESTORE_PASS — migration014 için ayrı kullanıcı onayı bekleniyor.**

Gerçek neden, Git dışı doğrulayıcının FK katalog sorgusundaki array_agg(attname) sonucuydu: PostgreSQL name[] OID1003 kurulu pg parser'ında string dönüyor, doğrulayıcı .map() ile TypeError üretiyordu. Aşama FK_VIOLATION_COUNTS; SQLSTATE yok. TLS/bağlantı/READ ONLY/migration/şema/sayımlar daha önce geçiyordu. Yalnız SELECT aggregate girdileri ::text yapıldı; text[] OID1009 parser deneyi ve düzeltilmiş gerçek hedef koşusu geçti. Guard, CA veya allowlist gevşetilmedi.

Mevcut `br-patient-block-bald8u59` / `ep-curly-base-ba5jc1c2` üzerinde14:16:33.676Z RESTORE_SQL_PASS: TLS encrypted/authorized/hostname PASS, PostgreSQL18.6,13 checksum uyumlu migration,1resolved008 rollback,014pending,35tablo/21FORCE RLS. Baseline schema/privilege hash'leri,82index,350constraint,43policy,11trigger ve5function eşleşti.43FK'de ihlal0. AuthUser2/Membership2; MASTER58/58izin ve üyelik/atama tutarsızlıkları0. İş/USD geçmişi/satış tabloları0; dolu finansal içerik eşitliği veya yazmalı davranış testi iddiası yok.

Önce/sonra provider karşılaştırmasında development/production branch ve endpoint bağları/ayarları,kaynak DB listesi,snapshot metadata eşit. Yeni restore/snapshot/finalize/reset/rename/silme veya kaynak/test/production SQL yok. Migration014 uygulanmadı; hash korundu. Hedef branch ready ve son endpoint active,0.25CU; silinmedi. Temizlik ayrı onay gerektirir. Uygulama/env/rol değişikliği veya R2 yok; gerçek Auth oturumları açılmadı.

[Tam tanı, doğrulama ve kanıt sınırları](research/PUSULA_V04_V42D4_RESTORE_SQL_DIAGNOSIS.md). Sonraki014 için taze guarded preflight ve ayrıca açık kullanıcı onayı gerekir. Mimo'ya bu yeni rapor ve LAST_REPORT D4 özeti devredilir; önceki değişiklikler korunur. Codex commit/push yapmadı.

---

# Önceki V4.2d.3 kaydı

# PUSULA v0.4 — Sprint V4.2d.3 / gerçek preview restore denemesi

19.10.2026 · `feat/pusula-v030-neon-cloud` · **BLOCKED — provider restore tamamlandı; PostgreSQL doğrulaması başarısız. RESTORE_PASS verilmez;014 uygulanmadı.**

Free aboneliği API'de free_v3,2/10branch ve5478CU-saniye olarak doğrulandı; snapshot/kaynak/hedef ad/operation kontrolleri geçti. Tek snapshot restore POST'u finalize_restore=false ile gönderildi, retry yapılmadı. Yeni branch `pusula-v42-restore-verification` / `br-patient-block-bald8u59`; provider otomatik endpoint `ep-curly-base-ba5jc1c2`, min=max0.25CU. Beş operation finished, hedef ready oldu.

Hedefe sabitlenmiş verify-full/CA yapılandırmalı salt okunur PostgreSQL denemesi13:59:52.300Z'de exit1/RESTORE_SQL_FAILED ile durdu. Geçici hata sınıflandırması asıl exception/SQLSTATE ve alt aşamayı korumadığı için kesin neden bilinmiyor. Başarılı TLS/PG18.6/35tablo/21FORCE RLS/13migration/Auth/sayım sonucu iddia edilmez. Talimattaki durma koşulu gereği SQL tekrarı, guard gevşetme veya otomatik kurtarma yapılmadı.

14:00:40.902Z son provider GET: development/production ID,ad,endpoint bağları,ayarları,kaynak DB envanteri ve snapshot korundu. Kaynak/prod endpoint idle; yeni endpoint active ve branch ready kaldı, silinmedi. Free bütçesi tüketimi sürebilir; temizlik ayrı onay gerektirir. Kaynak/test/production SQL, migration014, finalize/reset/rename, rol değişikliği,dump/R2 yok. Normal.env.local değişmedi; hedef yapılandırması kullanıcı+SYSTEM ACL'li Git dışı dizinde tutuldu; gerçek Auth oturumları uygulamaya açılmadı.

[Tam gerçek restore denemesi raporu](research/PUSULA_V04_V42D3_REAL_RESTORE_VERIFICATION.md). Önce mevcut preview hedefinde güvenli hata tanısı ve eksik salt okunur kabul kontrolleri gerekir; gerçek migration onayı henüz istenmez. Mimo'ya bu rapor ve LAST_REPORT D3 özeti devredilir. Önceki değişiklikler korundu; Codex commit/push/merge yapmadı.

---

# Önceki V4.2d.2 kaydı

# PUSULA v0.4 — Sprint V4.2d.2 / izole snapshot kurtarma planı

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `a88fa0c` korunur. **Plan hazır; uygulama kapısı BLOCKED: güncel storage/restore kapasitesi teyidi ve ardından ayrı açık onay gerekir. Gerçek restore yapılmadı.**

12:59:52.891Z salt okunur Neon GET/list: snapshot `snap-frosty-sky-bav0qeo6`, doğru development kaynak ID'si ve11:03:46Z zamanı eşleşti. İki branch/tek snapshot var; `pusula-v42-restore-verification` adı boş. Snapshot listesinde status/expiration yok; Never operatör beyanıdır. Snapshot varlığı başarılı kurtarma kanıtı değildir.

Standart Free10 branch/1 snapshot kotası açısından hedef3/10 olur. Proje GET compute5164 saniye gösterdi; storage alanları deprecated olduğundan dönen0 değerleri boş kota diye yorumlanmadı. Güncel storage ve ödeme gerektirmeyen restore kapasitesi Console teyidi bekler. Yeni kaynak/ücretli işlem yapılmadı.

[Tam plan, API sırası, Auth güvenliği ve kabul kapıları](research/PUSULA_V04_V42D2_RESTORE_PLAN.md). Restore API yeni branch döndürür; yeni ID yanıttan doğrulanacak. Explicit finalize_restore=false yanında ayrı endpoint/kimlik ve kaynak bağ kontrolleri gerekir. Finalize compute taşıma/rename yaptığı için tatbikatta yasak. Gerçek Auth oturumları uygulamaya açılmayacak; normal.env.local değişmez. Snapshot tüm branch kapsamındaki hassas veri kopyası sayılır; orijinal test DB'ye işlem yapılmaz.

D1 gerçek PREFLIGHT_PASS/applied=false ve014 hash korundu; bu tur yeni SQL/test suite koşulmadı. Kod/env/migration değişmedi; branch/restore/finalize/delete/dump/R2 yok. Codex commit/push yapmadı. Mimo'ya bu yeni rapor ve LAST_REPORT D2 özeti devredilir; önceki D1 değişiklikleri korunur. Kota doğrulanınca yalnız ayrı geçici branch/ona ait gerekirse compute ve gerçek kurtarma tatbikatı için onay istenecek; migration için ayrıca onay gerekir.

---

# Önceki V4.2d.1 kaydı

# PUSULA v0.4 — Sprint V4.2d.1 / env-loader düzeltmesi ve gerçek preflight

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `a88fa0c` korunur · **PREFLIGHT_PASS; migration014 uygulanmadı, ayrıca açık onay gerekir.**

Gerçek neden: @next/env16.4.1 CommonJS export'u __esModule=true ve named loadEnvConfig içeriyor, default export içermiyor. Runner'ın .ts/tsx default import'u gerçek-env yolunda TypeError veriyordu. Kurulu Next rehberindeki named API'ye geçildi. Fixture artık loader'ı atlamıyor; aynı API'yi yalnız özel UUID sentetik env dizininde kullanıyor. Gerçek .env.local değiştirilmedi; guard/TLS/CA/approval/timeout/pin kontrolleri korunur.

Vitest329/329,27 dosya;12 yeni gerçek env/CLI testi. TypeScript ve ESLint PASS. Yeni PG18.6 fixture'da env/migration/read-only referans16/16, DB/RLS11/11, Auth/API62/62, Cloud/DB11/11 ve Supplier16/16 PASS; kendi PID/data kimliğiyle kapandı. Lintte TLS test helper'ının use adı React Hook sayıldığı için yalnız yeniden adlandırıldı; kural kapatılmadı. Build/Playwright bu sprint çalıştırılmadı.

Yerel testlerden sonra tek gerçek development preflight: exit0/PREFLIGHT_PASS, applied=false.2026-10-19T11:52:12.917Z (İstanbul14:52:12.917) READ ONLY snapshot'ında PostgreSQL18.6,35 tablo/21 FORCE RLS,13 başarılı checksum,1 resolved008 rollback ve014 pending doğrulandı. İncelenen schema/privilege pinlerinde drift yok. Aynı snapshot'ta AuthUser2/Membership2; Customer,Material,MaterialVariant,MaterialPriceHistory,CloudProduct,CloudQuote,CloudSale,CloudSaleLine0 sayıldı. Gerçek satır/MFA/fiyat içeriği görüntülenmedi; bu sayılar içerik eşitliği veya tüm DB'nin boş olduğu anlamına gelmez.

014 hash değişmedi: `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`. Snapshot `snap-frosty-sky-bav0qeo6` üzerinde işlem yapılmadı; restore/delete/new branch/new snapshot, Neon test/production işlemi, gerçek dump/R2 yok. Snapshot'ın varlığı test edilmiş kurtarma kabiliyeti sayılmaz. Gerçek migration için kurtarma/bakım kabulü ve ayrıca açık kullanıcı onayı gerekir.

[Rapor, gerçek preflight ve Mimo listesi](research/PUSULA_V04_V42D1_PREFLIGHT_FIX.md). Codex stage/commit/push yapmadı; bu sprint8 dosya Mimo incelemesine hazır. Önceki V42D untracked raporu korundu. .data/env/test credentials teslim dışıdır.

---

# Önceki V4.2d kaydı

# PUSULA v0.4 — Sprint V4.2d / snapshot doğrulaması ve preflight

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `a88fa0c` Mimo teslimi korunur · **BLOCKED: snapshot mevcut, gerçek-env preflight TypeError ile durdu.**

Mevcut Neon CLI kimliğiyle yalnız GET/list metadata kullanılarak snapshot bağımsız doğrulandı: `pusula-v42-before-supplier-migration`, ID `snap-frosty-sky-bav0qeo6`, manual=true, oluşturulma2026-10-19T11:03:46Z (İstanbul14:03:46). Kaynak branch ID'si onaylı `development`/`br-rough-darkness-ba6ow9zo` ile aynı; proje `pusula-development`. Listede1 snapshot,2 branch; development API DB listesinde neondb/pusula_development/pusula_sprint_b_test var. History ayarı21600 saniye. Never operatör teyididir; liste JSON'u expiration alanı döndürmedi. Snapshot oluşturulması test edilmiş kurtarma değildir.

014 checksum `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da` eşleşti. Flagsiz guarded preflight exit1/MIGRATION_SAFETY_FAILED verdi; güvenli tanı TypeError'ın `nextEnv.loadEnvConfig` yolunda, DB bağlantısından önce oluştuğunu gösterdi. Bu env-loader yolu önceki local fixture testlerinde atlanmıştı. Kaynak kod değiştirilmedi, env alternatif yoldan yüklenip runner aşılmadı. Güncel SQL35/21/13-checksum/ACL ve eski10 tablo sayımı bu tur alınamadı; eski06:00 referansı snapshot veya bugünkü DB sonucu diye kullanılmaz.

[Snapshot kapsamı, maliyet ve38/24 kabul planı](research/PUSULA_V04_V42D_SNAPSHOT_READINESS.md). API belgeleri ayrı preview branch restore seçeneğini gösterir; gelecekte explicit finalize_restore=false ve ayrı kaynak/veri kopyası onayı gerekir. Yerinde restore aynı branch'teki test DB/Auth/MFA'yı etkileyebilir; bu görevde yasaktır. Yeni branch/snapshot/restore/delete/migration/grant/dump/R2 veya SQL veri işlemi yapılmadı. Free standart kotaları10 branch/1 snapshot; gerçek restore/erişim/fiilî kullanılabilirlik ve bağımsız R2 kabulü henüz kanıtlanmadı.

Sonraki adım dar env-loader düzeltmesi ve gerçek giriş yolu regresyonu; ardından yeni salt okunur SQL baseline'ı ve kurtarma kapısı. Bu engeller çözülmeden gerçek migration onayı istenmez. Codex commit/push yapmadı; Mimo'ya yalnız yeni V42D raporu ve bu dosya devredilir. Mevcut uygulama/migration/env dosyaları korundu.

---

# Önceki V4.2c.1 kaydı

# PUSULA v0.4 — Sprint V4.2c.1 / güvenli migration runner

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `225cd7a` korunur · **Yerel geliştirme/kabul PASS; gerçek Neon migration BLOCKED ve onaysız.**

Runner varsayılan preflight, explicit apply/Master/recovery kapıları, direct hedef/rol/TLS koruması, exact checksum ve önce/sonra katalog/uzak izin pinleri kazandı. Gerçek Prisma session'ında014 SET LOCAL ile3s lock/30s statement/60s transaction limiti;90s child ve yalnız kendi tag'li backend cleanup'ı uygulanır. Başarısızlıkta gerçek kısmi schema raporu ve unresolved retry reddi var; otomatik resolve/restore yok.008'in eski rolled-back geçmişi korunur; backup guard'ı değiştirilmedi.

014'ten test_runtime grant'leri çıkarıldı; test grant'leri yalnız yeni yerel fixture'da verilir. MASTER'a sekiz izin ekleme aynı SQL transaction'ında sürer ve ayrı açık onay bayrağı gerektirir; normal roller/override/tenant/MFA değişmez. SQL LF sabitlendi. Yeni014 SHA-256: `0950d8de6cc51930492491a91b1756c7cafb65c6ff05c4ee9310fd99cdfde1da`; sonraki canlı denetim bu hash'i kullanmalı. Eski13 migration değişmedi.

Vitest317/317,26 dosya; TypeScript/lint/build PASS. Tam yeni PG18.6 fixture'da migration güvenliği14/14, DB/RLS11/11, Auth/API62/62, Cloud/DB11/11 ve Supplier16/16 PASS. İki tenant'ın10 eski Auth/iş tablosu içerik hash'leri negatif senaryolar ve gerçek Prisma deploy sonrasında aynı. Ayrı gerçek Prisma TLS fixture'ı doğru CA'yı kabul, yanlış CA/hostname'i ret etti. Her sunucu kendi PID/data kimliğiyle kapatıldı. Başarısız ilk denemeler başarı sayılmadı; ayrıntılar doğrulama raporunda. UI değişmedi; Playwright bu sprint yeniden çalıştırılmadı.

[Karar ve Mimo listesi](research/PUSULA_V04_V42C1_MIGRATION_SAFETY.md) · [Gerçek test kanıtları](docs/validation/V04_V42C1_VERIFICATION.md) · [Güvenli komut/kurtarma](docs/operations/SAFE_MIGRATIONS.md).

Bu sprint gerçek Neon'a bağlantı, migration, rol/grant, Master/MFA/veri/env değişikliği, dump/R2/restore veya ücretli kaynak yoktur. Operatörün Free6 saat/Restore UI teyidi gerçek kurtarma başarısı değildir; kesin geri dönüş noktası, topology ve diğer DB'leri koruyan kurtarma yöntemi hâlâ açık. Bu nedenle gerçek uygulama onayı istenerek engel atlanmaz; kapılar kapandıktan sonra ayrıca açık onay gerekir. Codex commit/push yapmadı. Mimo bu sprint14 dosyayı inceler; önceki V42B/V42C belgelerini korur. .data/env/TLS private key/generated/build teslim dışıdır.

---

# Önceki V4.2c kaydı

# PUSULA v0.4 — Sprint V4.2c / son migration ve kurtarma hazırlığı

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `225cd7a` · **BLOCKED: Console kurtarma seçeneği operatörce teyit edildi; kesin kurtarma noktası/kapsamı ve runner kapıları açık.**

Development direct bağlantısında mevcut CA/hostname doğrulamalı TLS1.3 ve read-only snapshot ile35 tablo/21 FORCE RLS,13/13 başarılı migration checksum,014 pending ve Supplier nesnelerinin yokluğu yeniden doğrulandı.008'in eski rolled-back kaydı korundu; unresolved failure0. Önceki katalog/izin metadata'sına göre beklenmeyen fark yok;300 scalar kolon adı/türü/nullability eşleşti. Default-expression semantik eşdeğerliği veya tam bağımsız drift sertifikası iddia edilmez.

19.10.2026 06:00:41.611Z güvenli referansı: AuthUser2, Membership2; Customer/Material/MaterialVariant/MaterialPriceHistory/CloudProduct/CloudQuote/CloudSale/CloudSaleLine0. Yalnız toplamlar okundu; gerçek satır/PII/finans/Auth/MFA içeriği okunmadı. Bu, diğer tabloların boş olduğu veya yedeğe ihtiyaç olmadığı anlamına gelmez. Snapshot anı migration öncesi bakım penceresinde yeniden alınmalıdır.

Migration eski iş/Auth tablolarını değiştirmez; Permission/RolePermission INSERT'i MASTER yetkisini genişletir. Test_runtime development CONNECT=false kalmalı; yeni SQL'deki dormant grant tercihi ayrı karardır. Mevcut runner açık lock/statement timeout uygulamıyor. Operatör Console teyidi: pusula-development/development, Free, Restore from history kullanılabilir,6 saat history, Europe/Istanbul; en eski tarih19.10.2026, kesin en eski saat bilinmiyor. Snapshot ve otomatik snapshot planı yok. Gerçek restore test edilmedi; root/child ve diğer DB etkileri kesinleşmedi. Bu bilgi bağımsız API/restore kanıtı değildir. Branch restore diğer DB'leri de etkileyebilir. Bağımsız R2 yedeği ve dar backup rolü hazır değil; production engelleri sürer.

[Son güvenlik, sayım referansı ve kurtarma/yürütme planı](research/PUSULA_V04_V42C_MIGRATION_READINESS.md). Migration/DDL/DML/grant, başka DB bağlantısı, restore/dump/R2 veya commit/push yapılmadı; env ve migration hash'i korundu. Uygulama değişmediğinden test suite'leri yeniden çalıştırılmadı. Mimo'ya bu tur yalnız yeni V42C raporu ve LAST_REPORT devredilir; önceki untracked V42B raporu korunur. Kurtarma ve runner kapıları kapanmadan hazır kabul edilmez; gerçek migration ayrıca açık onay bekler.

---

# Önceki V4.2b.1 kaydı

# PUSULA v0.4 — Sprint V4.2b.1 / canlı salt okunur denetim tamamlandı

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `225cd7a` · **Migration uygulanmadı; ayrı onay bekleniyor.**

Onaylı pusula_development direct bağlantısı mevcut CA/hostname doğrulaması ve TLS1.3 ile açıldı; read-only transaction sonunda ROLLBACK ve bağlantı kapatma yapıldı. PostgreSQL18.6;35 tablo,21 FORCE RLS,43 policy,11 trigger,5 invoker function doğrulandı. Supplier tabloları/enum/v42 function çakışması yok;014 pending. Mevcut parent composite unique indeksleri valid/ready, invalid constraint/index yok. Hedef38/24 henüz uygulanmadı.

Başarılı13 migration'ın checksum'ları13/13 eşleşir; unresolved başarısız kayıt0.008'in ayrıca eski rolled-back denemesi vardır: ilk script bu satırı seçip yanlış MISMATCH verdi; ham metadata incelenip başarılı kayıt bazında düzeltildi. Geçmiş silinmedi. Mevcut Sprint E guard'ı rollback geçmişini de reddedebilir; yeni tablo/enum/function ve14/13 migration inventory engelleri ayrıca sürer.

Runtime/auth non-superuser/NOBYPASSRLS; test rollerinin development CONNECT=false durumu doğrulandı. Test_runtime'a yeni grant kapsamı, timeout ve kurtarma planı ayrı kabul kapısıdır. Tam kolon/tüm nesne türü drift sertifikası verilmedi. Gerçek kullanıcı/müşteri/finans/Auth içeriği okunmadı; migration, yetki/veri değişikliği, test/production bağlantısı, dump/R2 veya commit/push yapılmadı.

[Güncel canlı kanıt ve sınırlar](research/PUSULA_V04_V42B_NEON_MIGRATION_AUDIT.md). Mimo teslimi yalnız bu dosya ve denetim raporu; Git dışı yardımcı/kanıt teslim edilmez. Önceki BLOCKED metinleri tarihsel kayıttır; bağlantı engeli bu tur kalktı. Gerçek migration için kullanıcı onayı beklenir.

---

# Önceki V4.2b ilk deneme kaydı

# PUSULA v0.4 — Sprint V4.2b / Neon migration ön denetimi

19.10.2026 · `feat/pusula-v030-neon-cloud` · HEAD `225cd7acb66257e800b2e09b2bbf8a0412cc31e1` · **BLOCKED: canlı katalog denetimi tamamlanmadı.**

Mimo'nun V4.2 teslimi tam commit hash'iyle doğrulandı. Başlangıç çalışma ağacı temiz; origin fetch sonrası yerel/uzak farkı0/0. Codex stage/commit/push yapmadı.

Migration014 kaynak incelemesi üç yeni tablo, SupplierUnit, dokuz composite FK, üç CHECK,11 policy, dört trigger ve iki invoker function gösterir.35/21 baseline doğruysa hedef38/24'tür; **bugünkü Neon sayımı ve checksum/drift kontrolü yapılmadı**. Salt okunur bağlantı komutu otomatik onay incelemesinin kapasite hatası nedeniyle çalıştırılmadı; koruma aşılmadı. Önceki katalog ve yerel fixture sonuçları güncel canlı kanıt olarak kullanılmadı.

Eski işletme/fiyat/snapshot tablolarına DML yok; fakat sekiz Permission ve MASTER bağlantısı eklenir, mevcut parent tablolara FK bağımlılığı doğar. Development üzerinde test_runtime rolüne de grant verilmesi, güncel default ACL/CONNECT durumu, runner timeout ve kurtarma planı ayrıca kabul kapısıdır. Sprint E35/21 guard'ları değişmedi; yeni enum/function/table kapsamı fail-closed reddedilir. Gerçek Neon backup hesabı ve production kurtarma engelleri açıktır.

[Denetim, rollback ve ayrı kabul kapıları](research/PUSULA_V04_V42B_NEON_MIGRATION_AUDIT.md). Migration/yetki değişikliği, gerçek veri okuma veya sayımı, dump/R2, test/production bağlantısı yapılmadı. Uygulama kodu değişmediğinden test suite'leri yeniden çalıştırılmadı; önceki V4.2 sonuçları tarihsel kanıttır.

Mimo'ya devir: yalnız bu dosya ve `research/PUSULA_V04_V42B_NEON_MIGRATION_AUDIT.md`. Git dışı audit yardımcısı teslim kapsamı değildir. Önce canlı salt okunur denetim tamamlanmalı; gerçek migration için ayrıca açık kullanıcı onayı gerekir. Mimo commit/push ve ayrı teslim raporu henüz yapılmadı.

---

# Önceki V4.2 çalışma raporu (Mimo tesliminden önceki kayıt)

# PUSULA v0.4 — Sprint V4.2 / tedarikçi ve fiyat teklifleri

19.10.2026 · `feat/pusula-v030-neon-cloud` · başlangıç `f3e1baa` · **Codex commit/push yapmadı; Git teslimi Mimo'ya devredilecek.**

Tedarikçi kartları, mevcut MaterialVariant N:N eşleştirmesi, immutable teklif sürümleri, tarih/miktar/birim kontrollü karşılaştırma ve `/app` Tedarikçiler arayüzü geliştirildi. Sekiz yeni Permission anahtarı mevcut ALLOW/DENY/Master sistemine bağlanır; maliyet izni olmayan API yanıtında fiyat/snapshot yoktur. TRY yalnız tarihli TCMB kaynağıyla; EUR/GBP doğrulanmış kaynak yoksa hesaplanamaz. Manuel malzeme USD maliyeti ve eski quote/sale snapshot'larına yazılmaz.

Migration014 ve üç yeni tablo yalnız yeni yerel UUID PostgreSQL18.6 cluster'ında uygulandı:37 model, metadata dahil38 tablo,24 FORCE RLS. Mevcut Neon development/test/production'a migration veya bağlantı yok. Yerel DB aynı isimli olsa da mevcut Neon test DB değildir;127.0.0.1/port/UUID marker/SCRAM ile ayrılır. Auth test kimlikleri ve görseller ayrı Git dışı fixture dizininde; gerçek Master/MFA/env/demo verileri korunur.

Vitest297/297,25 dosya; TypeScript/lint/build PASS. DB/RLS11/11, Auth/API62/62, Cloud/DB11/11 ve V4.2 DB/API16/16 yerel fixture'da geçti. Desktop/mobil Auth+cloud+D7+V4.2 browser6/6, demo22/22; toplam28/28. Mobil PNG'de bulunan kart içi kırpılma düzeltilip güçlü kutu/focus/klavye ölçümleriyle tekrar doğrulandı; başarısız denemeler başarılı sayılmadı. MOQ24,9 hassasiyet sertleştirmesi sonrası Vitest ve odaklı DB/API16/16 tekrar geçti. Tüm geçici sunucular kendi PID/data kimliğiyle güvenli kapandı.

29 teslim dosyası ve23 production client JS dosyasında sır taraması PASS;16 trace'de .data girdisi0. Mevcut geniş .data build uyarısı sürer. Son tam yerel kabul v42-3ce925eb-61a1-4309-987d-d54a1330e26a; son odaklı tekrar v42-19a74f00-b401-4f2b-ad04-5c20ec754a7f. HEADf3e1baa korunur, index boştur;29 dosya Mimo'ya devredilecek çalışma ağacı değişikliğidir, yeni commit/push yoktur.

[Doğrulama ve Mimo dosya listesi](docs/validation/V04_SPRINT_V42_VERIFICATION.md) · [Teknik denetim/izinler/kabul kapıları](research/PUSULA_V04_SPRINT_V42_AUDIT.md).

Gerçek development migration'ı, yeni Permission/Master/grants uygulaması ve canlı kullanım ayrı açık onay bekler. R2/dump/kalıcı key veya production işlemi yapılmadı; Sprint E allowlist35/21 korunur ve yeni tablo/enum/function incelemesi gerekir. V4.3 satın alma/stok/sarf erkenden açılmadı.

---

# Önceki teslim: PUSULA v0.4 — Sprint V4.1 / veri modeli ve mimari tasarım

19.10.2026 · `feat/pusula-v030-neon-cloud` · **Yalnız analiz ve uygulanmamış taslak; yeni modül veya migration uygulanmadı.**

Uzak `39c6001` ROADMAP ve `3bcbe9e` ARCHITECTURE kararları fast-forward ile korundu. Kaynak denetiminde34 uygulama modeli, metadata dahil35 tablo ve21 FORCE RLS doğrulandı; canlı DB bağlantısı yapılmadı.22 domain modeli ve ledger tutarlılığı için2 yardımcı (StockPostingBatch/StockBalance) tasarlandı. Ayrı58 modellik Prisma taslağı yerel validate kontrolünden geçti; aktif şema/migration/app/package dosyaları değişmedi.

Supplier/PO/receipt/iade, tek fiziksel eksenli rulo/levha stok, atomik transfer/negatif stok/idempotency, sayım freeze, composite FK/RLS/explicit DENY ve maliyet DTO'ları tanımlandı. Reçete/makine/capability ve immutable tarifeler mevcut MaterialVariant/CloudProduct'a bağlanır; manuel USD maliyeti ve eski teklif/satış snapshot'ları korunur. Model tercihi özgül lot edinim maliyeti + FIFO aday sırası; gerçek sarf/fire v0.5, cari/ödeme v0.6. SQL guard/role/grant planı uygulanmadı; gerçek concurrency/RLS/Neon kalıcılık testleri için33 senaryolu kabul matrisi hazırlandı, çalıştırılmadı.

[Model](docs/architecture/V04_DATA_MODEL.md) · [Servisler/izinler](docs/architecture/V04_DOMAIN_SERVICES.md) · [UX akışları](docs/design/V04_UX_FLOWS.md) · [Migration planı](docs/architecture/drafts/V04_MIGRATION_PLAN.md) · [Denetim ve kabul kapıları](research/PUSULA_V04_SPRINT_V41_AUDIT.md).

Neon/test/production bağlantısı, tablo/rol/izin değişikliği, dump/restore/R2 veya kalıcı key işlemi yapılmadı. Sprint E'nin yeni tablo/function/enum incelemesi ve gerçek Neon backup sorunları production önkoşulu olarak açık; otomatik backup allowlist genişletmesi yok. Gerçek migration, tablo oluşturma ve uygulama geliştirmesi için ayrı açık onay gerekir. Aşağıdaki E2.3 test sonuçları önceki sprintin kaydıdır.

---

# Önceki teslim: PUSULA v0.3 — Sprint E2.3 / anahtar yönetimi ve gerçek fixture restore

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Gerçek yerel dump/decrypt/restore31/31 PASS; production kabulü yok.**

CSPRNG256 anahtar/benzersiz ID, redacted bellek nesnesi, passphrase ile şifreli taşınabilir vault, eski anahtarları koruyan rotasyon ve iki recovery zarfını yalnız RAM'de karşılaştırma kodu eklendi. Gerçek kalıcı key, C1/C2 kopyaları veya .env.local değişikliği yapılmadı; üretim ayrı onaylı ve aktif ID'yi değiştirmeyen komuttur.

Yeni local PostgreSQL18.6 cluster'ında gerçek pg_dump -Fc arşivi şifrelendi, doğrulanıp private dosyaya çözüldü, yeni boş template0 DB'ye pg_restore --single-transaction ile yüklendi. İki tenant, müşteri/malzeme/satış/USD geçmişi/snapshot ve sentetik Auth ilişkileri; tüm35 tablonun içerik hash/sayımları, RLS/ACL ve FK/immutable/sealing davranışı eşleşti. Yalnız kendi fixture süreçleri güvenle kapandı. İlk iki doğrulama denemesi ayrı FAIL olarak korundu; başarılı sayılmadı.

Vitest **258/258**, E2 alt kümesi154; TypeScript, lint ve build PASS. Mevcut geniş .data build pattern uyarısı sürer; operatör dosyalarının dağıtım trace dışlaması korunur. Gerçek key vault klasörü oluşmadı.

[Anahtar runbook'u](docs/operations/BACKUP_KEY_MANAGEMENT.md) · [Gerçek restore kanıtı ve kabul sınırları](docs/validation/SPRINT_E23_VERIFICATION.md). Neon rol/PUBLIC/large-object sorunları production önkoşulu olarak açık; Strict/Managed gerçek kaynak/upload güvenlik kontrolleri korunur. Gerçek Neon/test DB/production/Master/MFA/R2 işlemi yok.

## Önceki E2.2d teslimi

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Varsayılan Strict korundu; gerçek Neon Managed kullanımı kapalı.**

Managed aday yerel PostgreSQL18.6 fixture'da **43/43**, Strict gerçek dump/şifreleme regresyonu **14/14** geçti. Uygulama DML/kalıcı DDL, rol yükseltme ve drift'ler reddedildi. PUBLIC TEMP geçici DDL/DML'ye, CONNECT diğer DB oturumuna izin verdi; sonradan PUBLIC SELECT/kolon SELECT/SECURITY DEFINER ile veri sızıntısı ve builtin lo_create ile kalıcı sahiplik riski hayalî verilerle kanıtlandı. Aday Strict'e eşdeğer veya production için uygun kabul edilmedi.

Yeni politika adı manifest HMAC/AAD içinde korunur; eski manifestler legacy-unrecorded olarak doğrulanabilir. Gerçek diğer DB nesne hakları bilinmediğinden Managed remote preflight/upload engelli. Varsayılan strict-v1 artık template dahil diğer DB CONNECT haklarını da reddeder. Vitest222/222, TypeScript/lint/build PASS; geniş pattern build uyarısı sürer, .data dağıtım trace girdisi16 dosyada0 olarak doğrulandı. Bütün geçici sunucular kendi PID/data dizinleriyle güvenli kapandı.

[Ayrıntılı kanıt, sınırlar ve 10 kabul yanıtı](research/PUSULA_V030_SPRINT_E22D_RISK_ASSESSMENT.md). Gerçek Neon bağlantısı/rol/ACL değişikliği, kalıcı key, gerçek dump veya R2 işlemi yapılmadı. Bunlar için yeniden ayrı açık kullanıcı onayı gerekir.

## Önceki E2.2c araştırması

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Yalnız resmî belge araştırması; yeni Neon bağlantısı yok.**

Tek öneri: mevcut development branch'inde Neon destek teyitli seçici ACL ve doğrudan BYPASSRLS taşıyan dar SQL-created backup hesabı. Provider/internal TEMP ve postgres PUBLIC CONNECT değişikliklerinin bu özel ortamda destek durumu açık belgelerden kesinleşmedi; uygulama BLOCKED kalır. Yeni branch/proje varsayılan PUBLIC izinlerini kendiliğinden çözmez. Native restore/snapshot bağımsız E2/R2 arşivinin yerini tutmaz; geniş admin dump hedefe uymaz.

Maliyet/güvenlik/operasyon karşılaştırması ve sır içermeyen, **gönderilmemiş** destek talebi hazır. Template DB'ler önceki envanter dışında kaldığından tam bağlantı izolasyonu ayrıca denetlenmeli; diğer DB CONNECT guard'ı ayrı E2 kod işi gerektirir. [Seçenekler, tek öneri ve ayrı onaylar](research/PUSULA_V030_SPRINT_E22C_OPTIONS.md).

Rol/ACL/RLS/migration/dump/R2/production/test DB işlemi yapılmadı. Destek gönderimi ve gerçek SQL uygulaması için yeniden açık onay gerekir; bugünkü teslim uygulama izni değildir.

## Önceki E2.2b planı

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Yalnız salt okunur denetim ve plan; yetki değişikliği yok.**

Development katalogları yeniden doğrulandı: 24 rol/16 üyelik; 24 rolün tamamında efektif TEMP açık. Dört Pusula rolünün TEMP'ini açık grant ile koruyup PUBLIC TEMP'i kaldıracak SQL, önce/sonra matrisi, provider etki koşulları ve rollback taslağı hazırlandı; çalıştırılmadı.

**Uygulama kapısı BLOCKED:** neondb/postgres PUBLIC CONNECT nedeniyle yalnız development ACL değişikliğiyle backup LOGIN'i sadece development'a sınırlamak mümkün değil. Ayrıca provider/builtin TEMP etkisi karara bağlanmalı. Geniş admin fallback yok. SQL taslağı bunlar çözülmeden duracak şekilde planlandı. Rol/ACL/RLS/migration/dump/R2 işlemi, test DB veya production bağlantısı yapılmadı. Uygulama için yeni açık onay gerekir.

[Tam plan ve kabul/geri alma kapıları](research/PUSULA_V030_SPRINT_E22B_PLAN.md). 35 tablo ve 24 rol plan kapsamı statik doğrulandı; uygulama kodu değişmedi, regresyon suite'leri yeniden çalıştırılmadı.

## Önceki E2.2a hazırlığı

18.10.2026 · `feat/pusula-v030-neon-cloud` · **CA hazır; yeni preflight kontrolleri teslim edildi.**

Resmî ISRG Root X1 doğrulanıp Git dışı yerel CA/env yapılandırıldı. PostgreSQL 18.6 `psql` direct development bağlantısında `verify-full` ve READ ONLY geçti; dump alınmadı. Preflight efektif TEMP, bütün backup rol üyelikleri, sahiplik, column yazma/grant option, yeni şema/nesne ve fonksiyon tanım değişimlerini reddeder. Canlı doğrulama yalnız development kataloglarında yapıldı.

Vitest **195/195** (E2 91), TypeScript, lint ve build PASS. PUBLIC TEMP kaldırılmadı, rol oluşturulmadı/yetki değiştirilmedi. Seçici açık TEMP grant + PUBLIC revoke seçeneği ayrı onay bekler; bunun uygulanmasına kadar katı backup kabulü kapalıdır. Neon gerçek verileri, test DB, production, Master/MFA ve R2 korunur. [Kanıt, seçenek karşılaştırması ve sınırlar](docs/validation/SPRINT_E22A_VERIFICATION.md).

## Önceki E2.2 denetimi

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Denetim tamamlandı; gerçek backup hesabı oluşturulmadı.**

Yalnız development sistem katalogları READ ONLY incelendi: PostgreSQL 18.6, 35 tablo, 21 FORCE RLS, 43 policy/FK ve 11 trigger. Owner doğrudan BYPASSRLS ve CREATEROLE taşıyor; SQL ile dar backup rolü tasarımı sürüm belgelerine göre mümkün adaydır. Provider üzerinde CREATE/GRANT ve yeni rol ile okuma denenmedi; tam kabul verilmedi.

İki açık kapı: libpq `psql` verify-full denemesi kök sertifika dosyası eksikliğiyle engellendi; ayrıca PUBLIC TEMP yeni backup rolüne geçici DDL yetkisi miras bırakır. CA hazırlığı ve katı DDL yasağı için ayrı onaylı ACL/guard işi gerekir. Node istemcisinde TLSv1.3, sertifika ve hostname doğrulandı. Gerçek dump/Neon değişikliği/R2 işlemi yok. Test DB ve production'a bağlanılmadı. Gerçek key/KEY_ID/offline kopyalar E2.3'te ayrı hazırlıktır.

[Tam denetim, kaynaklar, alternatifler ve onay sınırları](research/PUSULA_V030_SPRINT_E22_AUDIT.md).

## Önceki E2.1b teslimi

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Yerel sentetik kabul: 14/14 PASS.**

PostgreSQL 18.6 taşınabilir sunucu yalnız 127.0.0.1:55432 üzerinde SCRAM ile çalıştırıldı. Gerçek `pg_dump -Fc`, `pg_restore --list`, 35 tablo satır sayımı, 43 FK/43 policy/11 trigger kapsamı ve E2 AES-256-GCM şifreleme/şifre çözme/SHA-256/manifest kontrolleri geçti. Yanlış anahtar, bozuk veri ve gerçek araç hata senaryoları reddedildi. PID 11944 ve yeni veri dizini doğrulanıp yalnız fixture süreci durduruldu.

Gerçek koşuda bulunan sequence yetki sorgusu hatası düzeltildi. E2 birim testleri 61/61; TypeScript ve lint geçti. Neon/R2 veya mevcut uygulama verilerine işlem yapılmadı. Gerçek backup hesabı/direct TLS URL, gerçek key ve ayrı gerçek dump/R2 onayı hâlâ gerekir. Restore/E3/E4 kabulü verilmedi. [Ayrıntılı kanıt ve deneme sınırları](docs/validation/SPRINT_E21B_VERIFICATION.md).

## Önceki Sprint E2 teslim kaydı

18.10.2026 · `feat/pusula-v030-neon-cloud` · **Kod geliştirildi; E2 kabulü ve production kabulü açık.**

Web uygulamasından ayrı preflight/create/upload/verify/list CLI eklendi. Direct development/özel rol guard'ı, salt okunur export snapshot,35 tablo/21 FORCE RLS adı ve migration checksum denetimi, custom dump TOC kontrolü, akışla AES-256-GCM, authenticated manifest, conditional R2 PUT ve tam readback doğrulaması bulunur.4 GiB sınırı, özel ACL'li scratch, paralel iş kilidi ve gerçek işlemler için ayrı açık onay bayrakları vardır. Gerçek key üretilmedi; rol/grant/migration ve UI değiştirilmedi.

Son Vitest **165/165** (E2 **61**), build/TypeScript ve lint PASS. PostgreSQL/RLS **11/11**, Cloud/DB **11/11**, Auth/API **60/60**, demo Playwright **22/22**, auth/cloud/D7 **4/4** geçti; toplam browser **26/26**. R2 HeadBucket resmî SDK ile yeniden geçti. Preflight eksik kurulumu beklenen exit1 ile engeller. Son upload stream cleanup değişimi sonrası61 E2 testi ve TypeScript tekrar geçti.

**Gerçek PostgreSQL fixture dump/--list testi yapılamadı:** araçlar ve ayrı yerel fixture DB yok. Mevcut61 E2 testi sentetik byte/TOC, taklit PG bağlantısı ve bellek içi S3 kullanır; gerçek yedek/restore kanıtı değildir. Gerçek development dump, R2 PUT/DELETE, scheduler ve restore çalıştırılmadı. Production, gerçek Master/MFA, env ve localStorage korunur.

Eksikler: PostgreSQL18 araçları; provider tarafından desteklenen, yazma/DDL yetkisi olmayan ayrı BYPASSRLS backup rolü (`pusula_backup` mevcut değil); direct URL; onaylı key/KEY_ID/offline kurtarma kopyaları. Mevcut owner BYPASSRLS yanında CREATEDB/CREATEROLE taşıdığı için backup rolü olarak kabul edilmez. E3/E4 ayrı kalır.

Hesap sahibi panelden r2.dev Disabled, bağlı custom domain yok, Object Read & Write token yalnız doğru bucket bilgilerini doğruladı. Bu operatör beyanı olarak kaydedildi; bağımsız yönetim API denetimi değildir. Onay bayraklı salt okunur preflight bu incelemeyi kabul eder, kalan key/tool/source eksiklerini engeller. Kullanıcı gerçek dump/upload öncesi ayrı onay şartını korudu.

[Doğrulama](docs/validation/SPRINT_E2_VERIFICATION.md) · [Yetki denetimi ve ayrı gerçek işlem onay listesi](research/PUSULA_V030_SPRINT_E2_AUDIT.md) · [CLI/format/kurulum](docs/operations/BACKUP_ENGINE.md).

Kod teslimi `7081845`, `b50a1f2`, `22f14a1` mevcut feature dalına normal push ile gönderildi. Kod push'u sonrası upstream farkı0/0.16 teslim dosyası ve23 production client JS dosyasında yapılandırılmış yerel sır taraması PASS. Bu doğrulama raporu ayrı dokümantasyon commit'iyle aynı dala gönderilir. Main'e merge/force-push/hard reset uygulanmadı.

---

# Önceki teslim: PUSULA v0.3 — Sprint D7 / UI ve bildirim düzeltmeleri

> **18.10.2026 / Güncel durum: Sprint E, E1 kurulum kapısında.** Başlangıç `00cf549`; D7 rapor commit'i de teslim edilmiş. Fetch sonrası upstream0/0 ve çalışma ağacı temizdi. Neon development/test salt okunur doğrulandı: PostgreSQL18.6, her birinde35 tablo/21 FORCE RLS; auth ve işletme aynı development DB'sinde ayrı rollerle.
>
> R2 erişim/kimliği, özel backup bağlantısı ve ayrı boş onaylı restore hedefi yok; pg_dump/pg_restore PATH'te bulunmadı. Hesaptaki bucket'lar doğrulanamadı. Talimat gereği E2–E5'e geçilmedi; dump/şifreleme/upload/restore/scheduler/alarm testi yok. Production, gerçek veriler, Master/MFA, env ve localStorage değiştirilmedi. Yalnız belgeler ve env örneği güncellendi; tam regresyon tekrar çalıştırılmadı. Aşağıdaki D7 sonuçları önceki teslimdir.
>
> [E1 denetim/maliyet](research/PUSULA_V030_SPRINT_E_AUDIT.md) · [Gerekli kurulum](docs/operations/R2_BACKUP_SETUP.md) · [Restore](docs/operations/DISASTER_RECOVERY.md) · [Retention](docs/operations/BACKUP_RETENTION.md).

17.10.2026 · `feat/pusula-v030-neon-cloud` · Önceki D7 development teslimi. v0.3 production kabulü bu teslimde kapsam dışıdır.

## Sonuç

Bulut müşteri ve kullanıcı araması ortak `SearchField` ile tek dış çerçeve, solda Lucide ikon ve erişilebilir dış focus göstergesine kavuştu. Mobilde etiket bölünmesi ve dar input düzeni giderildi. Demo müşteri/ürün/üst aramada iç focus gölgesi kaldırılırken dış focus korundu; mevcut filtreler değişmedi.

Bildirilen çift border bu başlangıç sürümünde yeniden üretilemedi. Önceki gerçek ölçüm input border 0 / dış border 1 px gösteriyordu; focus göstergesi ise yoktu. Sorunun kesin tek nedeni diye çift border iddiası yapılmaz. Somut nedenler, müşteri aramasının ikon yerine inline metin kullanması ve parçalı `.cloud-search` CSS'inin input focus'unu dış karşılığı olmadan bastırmasıdır. Son durumda iç border/outline/shadow yok, dış border 1 px ve focus halkası tek kapsayıcıdadır.

Yeniden davet gönderirken önceki başarı bildiriminin görünür kalması düzeltildi. Bekleyen davet hatasına **Mevcut daveti yönet** bağlantısı eklendi; bilgiler korunur ve otomatik e-posta gönderilmez. Başarılı oluşturma drawer kapatma/liste yenileme, başarısızlıkta form koruma ve taşıyıcı kabulü/teslim ayrımı korunur. Mevcut TOTP/step-up UX doğru bulunduğu için auth mantığı değiştirilmedi.

## Doğrulama

Başlangıç Vitest 104/104; değişiklik öncesi arama görsel koşusu 2/2 geçti. Son doğrulama sonuçları aşağıdadır.

[Önce/sonra görseller ve ölçümler](docs/design/screenshots/d7/) · [Ayrıntılı kanıt](docs/validation/SPRINT_D7_UI.md) · [Akışlar](docs/design/UX_FLOWS.md).

## Korunan kapsam

Neon development iş kayıtları, gerçek Master/MFA, env dosyaları ve demo localStorage değiştirilmedi/temizlenmedi. Testler yalnız ayrı test DB ve hayalî hesapları kullanır. Production'a SQL/migration uygulanmadı, gerçek Resend gönderimi veya ücretli servis açılmadı. RLS, özel izinler, finansal Decimal motoru, USD/TCMB, tarihsel snapshot ve satış/müşteri işlevleri korunur. Sprint E ve önceki domain/operasyon sınırları [Sprint D raporunda](docs/history/PUSULA_V030_SPRINT_D_REPORT.md) sürer.

Değişen uygulama dosyaları: `src/components/ui/search-field.tsx`, `cloud-desk.tsx`, `user-administration.tsx`, `src/app/globals.css`, `premium.css`. Testler: mevcut `tests/auth-e2e/auth.spec.ts` ve yeni `d7.spec.ts`. Paket, migration veya ortam ayarı değişmedi.

## Git

Başlangıç `150861b`; fetch sonrası mevcut feature remote ile 0/0 aynıydı. Main `98caf4d` üzerinde korunur. Teslim aynı feature dalına normal commit/push ile yapılır; main merge, force-push ve hard reset kullanılmaz.

| Son kontrol | Sonuç |
| --- | --- |
| Build / TypeScript | Başarılı |
| Lint | 0 hata / 0 uyarı |
| Vitest | **104/104**, 17 dosya, 13.23 s |
| PostgreSQL/RLS | **11/11** |
| Cloud/DB | **11/11** |
| Auth/API | **60/60** |
| Auth + cloud + D7 Playwright | **4/4**, desktop/mobil, 6.8 dakika |
| Client secret taraması | 24 production dosyasında Resend anahtarı yok |

Normal/focus/dolu müşteri araması masaüstü ve mobilde PNG olarak alınıp incelendi; tek dış focus, ikon/metin hizası, filtreleme ve sayfa taşmaması doğrulandı. Beklenen negatif HTTP kayıtları dışında beklenmeyen browser konsol hatası yoktu. İlk browser koşusundaki test sıralama/locator hatası düzeltilip tam koşu tekrarlandı; başarısız deneme başarı sayılmadı. Önceden bilinen Next development stream, pg deprecation ve NO_COLOR uyarıları devam eder. Gerçek Safari/Firefox veya ekran okuyucu sertifikasyonu yapılmadı.

Demo Playwright: **22/22**, desktop/mobil, **1.7 dakika**; müşteri/satış taslakları, numeric giriş, maliyet, snapshot, responsive, klavye ve reduced-motion korundu. Son toplam browser sonucu 26/26'dır (22 demo + 4 auth/cloud/D7).

D7 uygulama/test/görsel teslimi **`549d4bd`**, GitHub `feat/pusula-v030-neon-cloud` dalına başarıyla push edildi. Push sonrası yerel/uzak farkı **0/0**, çalışma ağacı temizdi. 27 staged dosyanın yapılandırılmış yerel sırlara karşı taraması PASS verdi. Bu gerçekleşmiş push kaydı ayrı dokümantasyon commit'iyle aynı dala gönderilir; main değiştirilmedi.

---

# PUSULA — Neon cross-DB / CROSS_DB_BLOCKED

23 Ekim 2026: Kullanıcı onaylı neondb, postgres, template1 katalogları bağımsız TLS1.3, REPEATABLE READ READ ONLY oturumlarında incelendi. Son tur 16:25:38–16:25:43 Türkiye; kısa timeout, ROLLBACK ve close 3/3 başarılı. İlk tur statement_timeout=0 kabul edilmedi; kanıt korunup açık startup 10s ile doğrulandı. postgres üzerinde PUBLIC SELECT iki provider view ve PUBLIC EXECUTE + schema USAGE dört rutin bulundu; mevcut managed sözleşmesi BLOCKED. İçerik/rutin çalıştırılmadı; çalışma zamanı etkileri UNKNOWN. Backup rolü yok; LOGIN/BYPASSRLS/export kabulü verilmedi. Provider/owner erişim çözümü, ayrı NOLOGIN ve gerçek backup/offsite/restore onayları bekliyor. Guard'lar ve ROLE_DELTA_UNRESOLVED korunur; eski494 grantor yeniden ölçülmedi.

[Denetim](research/PUSULA_NEON_CROSS_DB_AUDIT.md) · [Doğrulama](docs/validation/PUSULA_NEON_CROSS_DB_VERIFICATION.md). Yalnız üç onaylı DB'de sistem katalogları okundu. Rol/ACL/iş verisi/migration/dump/R2/restore/production/recovery/test/env/Git değişikliği yok; önceki rapor geçmişi korunur.

---

# PUSULA — 29 Ekim operasyon hazırlığı / canlı BLOCKED

24 Ekim 2026: Başlangıç HEAD `46372244f96d4623f625377579afdeec7aa06008` korundu; Git stage/commit/push yok. Güncel provider GET3/3 HTTP200, kaynak READ ONLY40/26/15+resolved008 ve494/494 grantor eşleşmesi (accepted=false); üç DB katalog audit'i postgres PUBLIC2 view/4 rutin engelini yeniden doğruladı. BACKUP_ACCESS_DECISION=BACKUP_ACCESS_BLOCKED. Yeni allowlist/proje/motor veya gerçek rol oluşturulmadı.

Yalnız yerel backup fixture'ına NOLOGIN non-superuser creator/ADMIN yönü/SELECT/temizlik, INSERT/DELETE ve stock/finance executor SET retleri eklendi. Üç backup fazı39/39/40 ve managed risk43 kontrol PASS; aynı-cluster sentetik şifreli restore gerçek bağımsız offsite değildir. Canonical017+K1–K5:235 API/SQL ve desktop/mobile Chromium2 test PASS.016 rehearsal normal/unknown/post-drift3×9 senaryo PASS; belirsiz COMMIT otomatik retry yok. Vitest497, TypeScript, ESLint ve checksum10 PASS; build yeniden çalıştırılmadı.

BACKUP_ROLE_READINESS=BACKUP_ROLE_DDL_APPROVAL_REQUIRED (erişim çözümü de bekliyor); REAL_BACKUP_RESTORE_READINESS=BLOCKED; M016_READINESS=M016_BLOCKED; M017_READINESS=M017_BLOCKED; GO_LIVE_READINESS=BLOCKED. R2 config pin geçerli fakat HEAD başarısız; public/token/retention ve gerçek anahtar custody kanıtsız. Önce provider A izolasyonu/B kontrollü owner ACL çözümü veya eksiksiz C kanıtı; sonra ayrı NOLOGIN, LOGIN, export/anahtar/R2/restore,016 ve017 onayları gerekir. Güvenlik kapıları ve001–017 checksum'ları korunur; `.env.local` değişmedi. Gerçek Neon DDL/DML/GRANT/export, R2 upload/restore veya production/recovery/test değişikliği yok.

[Operasyon emri](docs/operations/PUSULA_29_OCT_GO_LIVE_EXECUTION.md) · [Engel çözüm kararı](research/PUSULA_LIVE_BLOCKER_RESOLUTION.md) · [Güncel doğrulama](docs/validation/PUSULA_LIVE_READINESS_VERIFICATION.md).

---

## 24 Ekim — GitHub teslimi ve Neon operatör bağlantısı

GITHUB_DELIVERY_PASS: kabul edilmiş backup/NOLOGIN kaynakları `79eb5e5`, dar API-key preflight düzeltmesi ve doğrulama `9bf20b4` ile yalnız feature dalına normal push edildi; iki push exit0 ve bağımsız ls-remote eşleşti, kaynak teslimi sonrası ahead/behind0/0 ve ağaç temiz. Final Vitest519, TypeScript/ESLint/build/checksum PASS; exact NOLOGIN+risk-managed PG18.6 fixture66 PASS. Build'in mevcut .data over-bundling uyarısı açık.

NEON_API_AUTH_PASS / NEON_DATABASE_READONLY_PASS / NEON_OPERATOR_CONNECTION_READY: Windows User API key'i bellekte, node --use-system-ca; exact project/branch/endpoint üç HTTP200; development READ ONLY40/26/001–015+resolved008/494 eşleşmesi. BACKUP_ROLE_REAL_APPLY_APPROVAL_REQUIRED; BACKUP_REMOTE_BLOCKED. Gerçek rol/ACL/LOGIN/dump/R2/restore/migration veya production/recovery/test işlemi yapılmadı. Canonical checksum'lar ve guard'lar korundu. [Teslim raporu](reports/PUSULA_GITHUB_NEON_OPERATOR_DELIVERY.md) · [Bağlantı doğrulaması](docs/validation/PUSULA_NEON_OPERATOR_CONNECTION_VERIFICATION.md).
