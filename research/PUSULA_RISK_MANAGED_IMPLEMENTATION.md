# PUSULA — Risk-managed backup uygulama hazırlığı

24 Ekim 2026 · Neon Free, mevcut proje. Yeni proje/ücretli destek/yeni backup motoru yok. Başlangıç HEAD `46372244f96d4623f625377579afdeec7aa06008`; önceki commit edilmemiş çalışmalar korundu.

## Son kararlar

| Alan | Sonuç |
| --- | --- |
| Yerel profil/adapter kabulü | **RISK_MANAGED_POLICY_PASS — yalnız izole fixture sözleşmesi** |
| Credential mekanizması | **CREDENTIAL_LIFECYCLE_PASS — yerel worker başarı/hata/timeout/crash ve bağımsız kapanış kabulü** |
| Gerçek provider profili | **RISK_MANAGED_POLICY_BLOCKED** |
| Gerçek backup hazırlığı | **BACKUP_REMOTE_BLOCKED**; BACKUP_REMOTE_READY_FOR_APPROVAL verilmedi |

Kapanış kanıtı kaybolan negatif senaryo bilerek `CREDENTIAL_LIFECYCLE_BLOCKED` üretir. Worker işi başarılı görünse de `closed=false` olduğunda kabul yok. Deadline senaryosunda iş sonucu `DEADLINE_EXCEEDED`; kapanışın başarılı olması işi başarılıya çevirmez.

## Yazılan somut kod

| Dosya | İşlev |
| --- | --- |
| `scripts/backup/risk-managed.ts` | Mevcut selector'a eklenmeyen ayrı `risk-managed-v1`; enabled=false. Sabit project/branch/direct host/DB, PG180006, yalnız pre01640/26; iki view/dört routine tanım hash'i ve extension1.12 pinleri. Target/faz/sayım/tanım/extension farkını reddeder. Uzak READY için caller'ın vereceği bir boolean bypass yok; onaylanmış remote adapter henüz bulunmadığından sonuç BLOCKED. |
| `scripts/backup/risk-managed-lease.ts` | UUID/loopback/data-directory/server/actor/port kimliğini doğrulamadan mutasyon yok. Önceden NOLOGIN/PASSWORD NULL, doğru flags, üyelik0, aktif oturum0 şartı. Tek işe rastgele256-bit credential; LOGIN/expiry/connection-limit. Ayrı worker'dan bağımsız parent denetleyici; kapanışta önce NOLOGIN/PASSWORD NULL, sonra **yalnız backup role OID** backend'lerini sonlandırır. Başka DB'deki aynı rol oturumları da kapsanır. Ayrı yönetici bağlantısı rol flags/aktif0 ve eski credential ile giriş reddini doğrular. |
| `scripts/backup/risk-managed-worker.ts` | Credential yalnız özel parent-child IPC'den gelir; argv/env/log dosyasında değildir. Gerçek alt process success/error,30 saniye uyuyan aktif DB session ve exit23 crash modları. |
| `scripts/backup/risk-managed-fixture.ts` | DML/role/GRANT/SET/DDL/EXECUTE retleri; iki tenant tam SELECT; bütün DB erişim envanteri; PUBLIC metadata/gerçek pg_stat_statements C görünürlüğü; invoker health yazma reddi; TEMP/large-object sınıflandırması; lifecycle ve postflight. Lease içinde mevcut dump/crypto/decrypt/restore motorunu çalıştıran adapter. |
| `scripts/backup/verify-local.ts` | Yalnız `--risk-managed-fixture` + açık local onay + seçili release/restore ile helper çağrısı. Yanlış mod birleşimi reddedilir. Bu modda pinned DLL preload edilir; diğer modların konfigürasyonu değişmez. |
| `tests/backup-risk-managed.test.ts` | Default disabled, explicit seçim, hedef/faz/sayım drift, exact provider object/hash/extension drift ve ek nesne reddi; mevcut policy selector ve manifest şemasının risk-managed etiketini kabul etmediği negatifleri. |

Strict/managed policy, source contract, crypto/manifest ve uzak upload/export kodları değiştirilmedi. Yeni local adapter, kaynak ACL/history/function/trigger/RLS doğrulamasında mevcut **daha katı STRICT fixture kontrolünü** yeniden kullanır; gerçek Neon PUBLIC istisnası uygulamaz. PUBLIC riskleri ayrı yeni yerel DB'de sınıflandırılır; o DB dump öncesinde test tarafından kaldırılır. Bu nedenle yerel PASS, canlı cross-DB istisna adapter'ının veya gerçek provider davranışının kabulü değildir.

Arşivin iç manifest'i mevcut `strict-v1` + sourceEnvironment=fixture formatında kalır. `risk-managed-envelope.json`, ayrı yerel rehearsal/lease/release bağlamını kaydeden kanıt sidecar'ıdır; bir bulut yetki belgesi veya yeni upload manifest'i değildir. Uzak upload guard'ı genişletilmedi. Şifreleme motoru yeniden yazılmadı.

## Provider tanımlarında kapanan belirsizlik

**Yeni gerçek katalog okuması:**24 Ekim **13:53:40.074Z /16:53:40 Türkiye**. Yalnız sabit development branch host'unda `postgres`; actor neondb_owner; PG18.6; TLS CA/hostname doğrulama; REPEATABLE READ READ ONLY; kısa timeout; ROLLBACK/close. Dört `pg_proc`/iki view tanımı ve extension bağları okundu. View satırı, iş/Auth/MFA verisi veya provider routine çağrısı yok. Salt katalog tanımı almak, hedef rutini çalıştırmak değildir.

| Tam nesne | Gerçek tanım / sınıflandırma |
| --- | --- |
| `public.pg_stat_statements` | Owner cloud_admin; view `public.pg_stat_statements(true)` sonuçlarını yansıtır. Operational aggregate metadata ve kendi SQL metni görünürlüğü; başka kullanıcı metni/queryid standardında erişim kontrolü vardır. Tanım pin'i `a7d302f946532331aba5555ba48b125d4aa4fb08b36a2deabf851424b09a8804`. |
| `public.pg_stat_statements_info` | Owner cloud_admin; `pg_stat_statements_info()` dealloc/stats_reset sonucu. Pin `c8c7ea423e30064b1d95b0c3be96f3ab6349825885ae7518cdef0089ae48836d`. |
| `public.pg_stat_statements(boolean)` | C, extension pg_stat_statements1.12, INVOKER; SQL tanımı C symbol/library bağını gösterir, binary iç etkisini tek başına ispatlamaz. Definition pin `2244205b20fed9bfb599420ec6968be92a95dbe795bf7879e7d7f4817da23869`. |
| `public.pg_stat_statements_info()` | C, aynı extension1.12/INVOKER. Pin `043eb974c4d96e4a5f1487346983acf7721c1bf8847b2271a42f3cfaa864ff33`. |
| `public.health_check_write_succeeds()` | **PL/pgSQL, INVOKER, extension bağı yok**. Gerçek gövde `public.health_check` üzerinde id1 INSERT/ON CONFLICT UPDATE ve now() yapar; hata halinde P0001 exception'a SQLSTATE/SQLERRM ekler. Bir okuma rutini değildir. Pin `740eacee62e44cb5a19012a8738761e86479fc99d5ce19100cbf4ce10ba5d70d`. PUBLIC EXECUTE, tablo DML hakkını kendiliğinden sağlamaz. Yerel aynı yazma yolunda dar rol42501 ile reddedilir ve provider tablo taklidinde satır0 kalır. Gerçek backup rolü henüz olmadığından gerçek effective hak sonucu ölçülmedi. |
| `public.get_compute_primary_memory_bytes()` | **PL/pgSQL, INVOKER, extension bağı yok**. pg_is_in_recovery false ise NULL; flag kapalıysa NULL; aksi halde `public.lakebase_attributes` name=primary_memory değerini bigint okur, bütün hatalarda NULL. Gövdede DML yok; replica/table erişimi ve yan etkisizliği hedef semantiğiyle ayrıca kabul edilir. Pin `dc47998e1bbb6500f92acf9c774e84936d0d55683131c601ef5ab0d4bbca1275`. Bu rutin canlıda veya fixture'da çağrılmadı. |

Önceki rapordaki iki provider rutini için salt isim kaynaklı belirsizlik artık gövde düzeyinde daraltıldı; raporlar tarihsel bırakıldı. Proconfig NULL ve INVOKER, bütün C kodunun veya bütün erişim yollarının zararsız olduğu garantisi değildir. Gerçek rol doğrudan/dolaylı provider tablo DML, PUBLIC/column ACL veya admin/monitoring üyeliği alırsa profil engellenir.

Yerel test için mevcut hash-pinned PG18.6 ZIP'ten yalnız pg_stat_statements.dll eklendi: DLL SHA `dc06a2ded89ae2b60a23019b4ad5107bd20e0b6e6571102f9f26e6ca13d24e1c`. Yeni indirme yok. Local extension1.12 gerçekten çalıştırıldı: başka rol sorgu metni/queryid gizli, kendi metni görünür, info metadata okunur. Bu upstream Windows binary testidir; Neon patched binary attestation değildir. Standart görünürlük sözleşmesi [PG18 resmi belgesinde](https://www.postgresql.org/docs/18/pgstatstatements.html) açıklanır. Genel araştırma tekrarlanmadı.

## Credential kabulünün kesin sınırı

Aktivasyon SQL'ine kullanılabilir parola yerine istemcide üretilmiş salted SCRAM-SHA-256 verifier gönderilir; sunucuda SCRAM saklandığı doğrulanır. Böylece yeni lease parolası SQL statement/istatistik metninde tutulmaz. Verifier yine hassastır ve rapor/loga yazılmaz; kullanılabilir credential yalnız private IPC ve ilgili libpq child ortamında yaşar. Üç faz gerçek SCRAM authentication ile yeniden geçti. Nihai sonuçlar: PG59/59/61, Vitest510, TypeScript/ESLint exit0 ve checksum10 PASS.

Her iş için bağımsız rastgele parola; verifier yönetici PID'si değişmeden canlı kaldı. Başarı/hata/crash sonrası yeni bağlantı reddi, rolün NOLOGIN/PASSWORD NULL hali ve aktif0 doğrulandı. Timeout testinde gerçekten yaşayan backend sonlandırıldı; iptal PID'leri ve cleanup süreleri kaydedildi. VALID UNTIL tek başına yeterli sayılmadı. PostgreSQL'de parola süresi bitmesi var olan oturumu bitirmez; bu yüzden server-side kapatma ve bağımsız probe gerekir. [PG18 CREATE ROLE](https://www.postgresql.org/docs/18/sql-createrole.html).

Deadline, işi başarısız yapan abort tetikleyicisidir; sıfır gecikmeli backend ölümü garantisi değildir. Cleanup süreleri fixture raporlarında ölçülür. Kapanış sürerken iş başarılı sayılmaz; aktif bağlantı kalırsa veya bağımsız kanıt yoksa lifecycle BLOCKED. Denetleyici process'in kendisinin/host'un çökmesi, DDL kilidi veya yönetici bağlantı kaybında garanti sağlayan gerçek dış supervisor bu yerel mekanizmanın kabulü değildir. Worker crash, ayrı gerçek child process ile test edildi; supervisor/host crash test edilmedi. Bu eksik sınır uzak hazır kararını engeller.

## Kapatılanlar / açık kritik engeller

**Kapatılan yerel engeller:** worker'dan bağımsız credential kapanışı; eski credential reddi; deadline ve crash sınıflandırması; postflight rol/ACL/ownership/bağlantı kontrolü; bilinen PUBLIC metadata ve TEMP/kendi large-object etkilerinin gerçek PG üzerinde ayrılması; üç release'in lease içindeki şifreli backup/restore'u. BYPASSRLS iki tenant'ı tam okur; rol iş/Auth/Finance DML veya SET ROLE yapamaz.

**Açık kritikler:** gerçek pusula_backup rolü/NOLOGIN kabulü yok; gerçek creator/grantor/etkin haklar ve yalnız o rolün backend'lerini kapatacak live yetki doğrulanmadı. Neon C implementation kabulü ve kesin PUBLIC istisna sözleşmesi/DDL kontrolü yok. Modern kaynak profilinin creator=neondb_owner eşlemesiyle gerçek remote object adapter'ı aktive edilmedi. Anahtar custody, bağımsız offsite/R2 yetki-public-retention ve yeni boş hedefte gerçek restore hâlâ kabul edilmedi. Kendi kalıcı large-object yazma ve kaynak tüketimi için hard quota garantisi yok; source dışı yeni PUBLIC iş verisi erişimi veya yetki yükseltme kabul edilemez.

## Gerçek backup için sonraki dar işlem ve ayrı onaylar

Önce bu altı nesnenin hash/sürüm ve izin sınırı ile artık metadata/TEMP/large-object riskleri operatör/veri sorumlusunca incelenmeli; ücretsiz ürün/kod kanıtı kullanılır. Ardından **yalnız sabit development/pre01640/26 hedefinde NOLOGIN SQL rol + exact SELECT/USAGE/CONNECT ve bağımsız post katalog kabulü** için ayrı açık onay hazırlanabilir. Bu rol oluşturma/login/export onayı değildir; bu görevde istenmedi veya kullanılmadı.

NOLOGIN kabulü sonrası gerçek role hedefli cross-DB effective hak/ownership/membership ve kapanış aktörü kontrolü gerekir. Ayrı kısa LOGIN yaşam döngüsü denemesi, yalnız role ait bağlantının kapatılması ve fail-closed dış denetleyici kabulü ayrıca yetkilendirilir. Kontrol kanıtları tamamlanmadan remote adapter açılmaz. Sonra ayrı gerçek anahtar/export/R2/restore onayları; gerçek restore mutabakatı geçmeden yedek kabulü/migration güvence noktası yok.016/017 apply ve accounting API açılışı bu izinlerin hiçbirine dahil değildir.

Kesin bu-görev kapsamı8 dosya: dört `risk-managed*.ts`, `scripts/backup/verify-local.ts`, `tests/backup-risk-managed.test.ts`, bu rapor ve [doğrulama](../docs/validation/PUSULA_RISK_MANAGED_VERIFICATION.md). LAST_REPORT ve önceki kullanıcı dosyaları bu görevde değiştirilmedi.001–017 SQL/checksum, `.env.local`, strict/managed/remote guard'lar, Git index/HEAD korundu. Gerçek Neon DDL/DML/GRANT/role/migration/export, provider rutin çağrısı, R2 upload, gerçek restore, production/recovery/test müdahalesi veya Git commit/push/merge yapılmadı.
