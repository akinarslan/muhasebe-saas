# PUSULA backup rolü — preapply doğrulaması

24 Ekim 2026 · **ROLE_DDL_READY_FOR_APPROVAL**, yalnız dormant NOLOGIN rolünün sınırlandırılmış SQL delta'sı için. Gerçek rol oluşturulmadı; gerçek backup veya go-live kabulü verilmedi.

[Uygulama runbook'u](../operations/PUSULA_BACKUP_ROLE_APPLY_RUNBOOK.md) ve [onay paketi](../../research/PUSULA_BACKUP_ROLE_APPROVAL_PACKET.md) birlikte değerlendirilir. Sonraki gerçek işlem ayrı açık onay, tekrar fresh preflight ve eşzamanlı DDL/ACL değişikliklerinin dışlanmasını gerektirir.

## Bu görevde gerçekten çalıştırılan kontroller

| Kontrol | Sonuç |
| --- | --- |
| `npm.cmd test` | PASS; 45 dosya, 510 test; exit 0 |
| `npx.cmd tsc --noEmit` | PASS; exit 0 |
| `npm.cmd run lint` | PASS; exit 0 |
| `node --import tsx scripts/db/verify-checksum-artifact.ts --verify-local-artifact` | PASS; 10 kontrol; exit 0 |
| PG18.6 pre016 risk-managed + exact rol SQL fixture | PASS; 66 kontrol; exit 0; serverStopped=true; failureCode=null |
| Provider kimliği | Üç explicit GET, HTTP 200; project/branch/direct endpoint eşleşti |
| Gerçek kaynak katalogları | READ ONLY snapshot; 40 tablo, 26 FORCE RLS, 001–015 başarılı + resolved008 |
| Cross-DB ve definition pinleri | Üç DB yeni katalog snapshot'ı; iki view/dört routine pin ve extension 1.12 eşleşti |

Bu görevde yeni build çalıştırılmadı. Yerel test/export/restore yalnız yeni sentetik fixture kapsamındadır; gerçek kaynak export veya restore yapılmadı.

## Yeni alınan gerçek READ ONLY kanıtı

Sabit hedef project `icy-queen-44442204`, branch `br-rough-darkness-ba6ow9zo`, DB `pusula_development`, host `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech:5432`, actor/session actor `neondb_owner`, PostgreSQL 18.6. Provider GET zamanları 2026-10-24T14:41:09.564–14:41:10.208Z. Kaynak snapshot 14:41:11.841Z; ek authority snapshot 14:42:13.355Z. SQL bağlantıları doğrulanmış TLS ve READ ONLY transaction kullanıldı; rollback ve close yapıldı.

Güncel pre fingerprint `7794ab78306b3e97b19400abb390fc5c5a9f8f560fd97cd61c1cf9e87c3f87eb`. Grantor karşılaştırması expected494/matched494/missing0/unexpected0; ham hash `378e182781ee9cb740824ce50fc4b58de1175d629e1160478388272cda8d938a`. Bu eşleşme accepted=false/provider review kapısını kaldırmaz. Eski snapshot aynı değeri taşısa da yeni ölçüm bağımsız alındı.

Actor SUPERUSER=false, CREATEROLE=true, BYPASSRLS=true; 40/40 SELECT grant authority, source CONNECT ve schema USAGE grant authority=true. pg_authid/rolpassword SELECT yetkisi katalogdan doğrulandı; parola/verifier okunmadı. `pusula_backup` yok. pg_signal_backend üyeliği=true; gerçek backup backend kapatma testi yapılmadı. O anda başka kaynak client session veya ilgili catalog/advisory lock görülmedi. Bu anlık gözlem gelecekte DDL olmayacağına ilişkin fence değildir.

Preflight aracının eski OAuth'u expired olduğundan kendi provider alanı NEEDS_EVIDENCE kalır. Mevcut User ortam API key'i yalnız bellekte üç explicit GET için kullanıldı; güncel kimlik ayrıca doğrulandı. OAuth veya credential dosyası değiştirilmedi; key/header raporlara yazılmadı.

Cross-DB katalog snapshot'ları: neondb 14:42:15.126Z, postgres 14:42:18.335Z, template1 14:42:21.150Z. Üçünde rollback/close; 24 rol/16 üyelik, backup yok. postgres definition-only snapshot 14:42:24.416Z: iki PUBLIC view ve dört PUBLIC routine hash'i [onay paketindeki](../../research/PUSULA_BACKUP_ROLE_APPROVAL_PACKET.md) pinlerle aynı. Provider rutinleri çalıştırılmadı ve view satırları okunmadı. C extension SQL tanımı binary yan etkileri kanıtlamaz; health routine gövdesi yazma içerir. PUBLIC CONNECT/TEMP/system/large-object hakları kaldırılmış değildir.

## Exact SQL ve negatif fixture

Komut:

```text
node --import tsx .data/backup-role-approval/verify-role-local.ts --approve-local-fixture --restore-fixture --source-profile=pre016 --risk-managed-fixture
```

Final fixture UUID `e23-258a07c2-a733-481e-b396-0d7080be9821`. Runbook B mutation body SHA-256 `8b082cfd7386c36825fcdaa4e2e3e00089d9f67168b237fe16eaafd0d9d42fe6`; exact 40 tablo listesi pre016 profiliyle eşit. Private harness mevcut fixture runner'ın kopyasıdır; orijinal kaynak değiştirilmedi. Yerel hedef/PID/UUID/SCRAM/checksum guard'ları korundu. Mevcut 59 kontrolün yanında yedi package senaryosu çalıştı:

| Senaryo | Beklenen ve gözlenen |
| --- | --- |
| Yanlış hedef | P0001, rollback, eski state aynı |
| İkinci bağlantıda busy advisory lock | P0001, rollback, eski state aynı |
| Normal rol/grant ve rollback | Flags/password NULL/connlimit0, üç setting, 40 SELECT, ownership0, exact creator ADMIN yönü; eski state aynı |
| Exact cleanup ve rollback | Sabit 40 REVOKE + source/schema grant cleanup + DROP ROLE; eski state aynı |
| Grant sonrasında geç hata | 22012; tam rollback, eski state aynı |
| Duplicate rol | 42710; tam rollback, eski state aynı |
| Eksik grant authority | 42501 ve iki 01007 uyarı; tam rollback, eski state aynı |

Mutation'da yalnız hedef DB adı fixture adına eşlendi. Identity gate/validator beklentileri yerel actor/DB'ye uyarlandı. Non-superuser CREATEROLE+BYPASSRLS aktörüne yalnız fixture provisioning'i ile gerekli delegated grant option verildi. Runbook unchanged-state ve postflight SELECT'leri yerelde çalıştı. Creator üyeliği parent=backup/member=creator/admin=true/inherit=false/set=false; grantor yerel bootstrap actor. Neon'da beklenen cloud_admin grantor ve pg_database_owner schema grantor gerçek CREATE sonrası henüz gözlenmedi. Yerel test provider hook/ACL davranışının canlı kabulü değildir; sapma COMMIT öncesi rollback gerektirir.

Private, Git dışında kanıtlar `.data/backup-role-approval/` altında: `fixture-accepted.log`, `role-plan-local-evidence.json`, `vitest.log`, `tsc.log`, `lint.log`, `checksum.log`, `provider.json`, `authority.json`, `development-snapshot.json`, cross-DB/definition JSON ve `pins.json`. Bunlar secret içeren ham environment dosyalarını teslim kapsamına almaz; .data stage edilmez.

## Koruma ve kalan kapılar

Başlangıç manifestindeki 480 dosyanın final raw-byte karşılaştırması PASS; HEAD/index aynı, kapsam yalnız üç yeni teslim belgesi. Secret taraması ve whitespace kontrolü PASS; private `preservation-final.json` sonuçları kaydeder. Mevcut kullanıcı kaynakları, risk-managed kodu, LAST_REPORT ve .env.local değişmedi. Migration016 SHA `27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567`; canonical017 SHA `9024e8fda804f7cddf74ae7fc2fd03a670604fd2a90995704738f80b1fb3587c`. Tarihsel K5 adayı ve 001–016 baytları korundu; LF/CRLF artifact kontrolü PASS. Git'in mevcut üç kullanıcı dosyası için LF→CRLF uyarısı bayt değişikliği yapılmadan raporlandı.

ACCOUNTING_CLOUD_REVIEW_REQUIRED, STOCK_MANAGED_APPLY_DISABLED, applyEnabled=false ve postFingerprint=null değişmedi. Backup adapter'ın gerçek remote yolu BLOCKED kalır. VALID UNTIL mevcut session'ı bitirmez; supervisor/host çökmesi, gerçek terminate/session0/re-login reddi, tüm tenant/Auth/MFA erişimi, TEMP/large-object, bağımsız offsite/key/restore kabulü açık kapılardır. NOLOGIN kurulumu bunları çözmüş sayılmaz.

Gerçek CREATE/ALTER ROLE, GRANT/REVOKE/PUBLIC ACL, LOGIN/credential aktivasyonu, dump/export, R2, restore, migration016/017 apply, production/recovery/test müdahalesi ve Git commit/push/merge yapılmadı. Uygulama sonrası 25 rol/17 üyelik/536 grantor satırı bu raporda gözlem değil, exact delta beklentisidir.
