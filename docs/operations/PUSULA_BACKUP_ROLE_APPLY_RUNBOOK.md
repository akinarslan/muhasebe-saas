# PUSULA — NOLOGIN backup rolü uygulama runbook'u

24 Ekim 2026. **Yalnız onay paketi; bu görevde hiçbir uygulama satırı çalıştırılmaz.** Son karar ve güncel kanıt [approval packet](../../research/PUSULA_BACKUP_ROLE_APPROVAL_PACKET.md) ve [preapply verification](../validation/PUSULA_BACKUP_ROLE_PREAPPLY_VERIFICATION.md) içindedir. Yetki yalnız ileride ayrıca onaylanacak NOLOGIN rol ve42 explicit grant deltasıyla sınırlıdır; LOGIN/credential/export/restore/migration değildir.

## Hedef ve uygulamaya giriş

Sabit project `icy-queen-44442204`, branch `br-rough-darkness-ba6ow9zo`, endpoint `ep-blue-breeze-bavbjb7l.c-8.eu-central-1.aws.neon.tech:5432`, DB `pusula_development`, session_user=current_user=`neondb_owner`, PG180006, pre01640 tablo/26 FORCE RLS/15 başarılı migration+resolved008. Yalnız direct TLS CA+hostname doğrulamalı bağlantı; URL/şifre rapora veya argv'ye yazılmaz. Production/recovery/test hedefleri reddedilir.

1. İki sorumlu atanır: uygulayıcı ve bağımsız doğrulayıcı. Onay; bu belge SQL hash'i, exact hedef, fresh pre fingerprint,42 grant ve creator ADMIN kenarı, maintenance penceresi ve rollback yetkisini kapsamalı. Şu an onay yok.
2. Aynı açık onay kapsamıyla güncel provider project/branch/host GET'leri ve bağımsız TLS REPEATABLE READ READ ONLY preflight alınır. Kaynak sözleşmesinin bütün schema/security/history/cluster alanları karşılaştırılır;494 grantor bağımsız multiset karşılaştırması ve cross-DB altı nesne pinleri yeniden yapılır. `accepted=false` kendiliğinden true yapılmaz.
3. Aşağıdaki snapshot sorgusuyla başlangıç rol/üyelik/ACL durumu dışarıda özel metadata dosyasına kaydedilir. Kaynak şema/current fingerprint ve kullanıcı/permission rol verileri mevcut `collectManagedSnapshot` sözleşmesiyle ayrıca korunur. İş/Auth/MFA satırları okunmaz.
4. Uygulama süresince diğer yönetici DDL/ACL/rol işlemlerini dışlayan bakım kontrolü sorumlularca sağlanır. Anlık `pg_locks`/`pg_stat_activity` boşluğu bir fence değildir. Aynı2142042 advisory anahtarı kullanan runner'lar kooperatif olarak dışlanır; başka psql oturumu bu kilide uymayabilir. Dışlama sağlanamıyorsa **uygulama başlamaz**.
5. Paket A/B/C aynı dedicated application session'da yürütülür. Warning01 sınıfı, ek grant veya herhangi bir farkta ROLLBACK. Psql kullanılıyorsa ON_ERROR_STOP=on ve autocommit dışındaki transaction korunur. Validator hatası hiçbir zaman COMMIT'e çevrilmez.

## Bağımsız başlangıç / eski hakları koruma snapshot'ı

Bu sorgu rol yokken ve rol sonrası aynı biçimde çalışır. Rol adı yalnız kontrollü paket sabitidir. Sonuçlar JSON olarak canonical sıralanıp byte/hash karşılaştırılır. Mevcut rollerin parolaları okunmaz; rol bayrakları/ayarları metadata'dır. Bu sorgu mutation yapmaz.

```sql
WITH b AS (SELECT to_regrole('pusula_backup')::oid AS oid),
acl AS (
 SELECT 'database' kind,d.datname identity,pg_get_userbyid(d.datdba) owner,
        a.grantor,a.grantee,a.privilege_type,a.is_grantable
 FROM pg_database d CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a
 UNION ALL
 SELECT 'schema',n.nspname,pg_get_userbyid(n.nspowner),a.grantor,a.grantee,a.privilege_type,a.is_grantable
 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
 UNION ALL
 SELECT 'relation',c.oid::regclass::text,pg_get_userbyid(c.relowner),a.grantor,a.grantee,a.privilege_type,a.is_grantable
 FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,c.relowner))) a
 WHERE c.relkind IN ('r','p','v','m','f','S')
 UNION ALL
 SELECT 'column',c.oid::regclass::text||'.'||x.attname,pg_get_userbyid(c.relowner),a.grantor,a.grantee,a.privilege_type,a.is_grantable
 FROM pg_attribute x JOIN pg_class c ON c.oid=x.attrelid CROSS JOIN LATERAL aclexplode(x.attacl) a
 UNION ALL
 SELECT 'function',p.oid::regprocedure::text,pg_get_userbyid(p.proowner),a.grantor,a.grantee,a.privilege_type,a.is_grantable
 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 UNION ALL
 SELECT 'default',d.defaclnamespace::text||':'||d.defaclobjtype::text,pg_get_userbyid(d.defaclrole),a.grantor,a.grantee,a.privilege_type,a.is_grantable
 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
)
SELECT jsonb_build_object(
 'existingRoles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.oid) FROM pg_roles r,b WHERE b.oid IS NULL OR r.oid<>b.oid),
 'existingMemberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) FROM pg_auth_members m,b WHERE b.oid IS NULL OR (m.roleid<>b.oid AND m.member<>b.oid)),
 'existingRoleSettings',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.setdatabase,s.setrole) FROM pg_db_role_setting s,b WHERE b.oid IS NULL OR s.setrole<>b.oid),
 'existingAcl',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.kind,a.identity,a.owner,a.grantor,a.grantee,a.privilege_type,a.is_grantable) FROM acl a,b WHERE b.oid IS NULL OR (a.grantee<>b.oid AND a.grantor<>b.oid))
) AS unchanged_state;
```

Önce/sonra `unchanged_state` **aynı olmalı**. Backup'a ait çıkarılan satırların kendisi aşağıdaki C sorgularıyla exact delta olarak ayrıca denetlenir; filtre yeni/yanlış grant'i gizlemek için kullanılamaz. Snapshot source DB'nin bütün ilgili ACL'sini ve shared database/role metadata'sını kapsar; başka DB içindeki relation/function ACL'si için ayrı READ ONLY katalog audit'i gerekir. Bu rol işlemi başka DB nesnesi ACL'sini değiştirmez; postflight cross-DB yine karşılaştırılır.

## A — Transaction ve son kapılar (gelecekteki ayrı onay için)

```sql
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
SET LOCAL transaction_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='15s';
SET LOCAL search_path=pg_catalog,public;
SET LOCAL createrole_self_grant='';
DO $gate$
BEGIN
 IF current_user<>'neondb_owner' OR session_user<>current_user
    OR current_database()<>'pusula_development'
    OR current_setting('server_version_num')<>'180006'
 THEN RAISE EXCEPTION 'BACKUP_ROLE_TARGET_REJECTED'; END IF;
 IF to_regrole('pusula_backup') IS NOT NULL THEN RAISE EXCEPTION 'BACKUP_ROLE_ALREADY_EXISTS_REVIEW'; END IF;
 IF NOT pg_try_advisory_xact_lock(2142042) THEN RAISE EXCEPTION 'BACKUP_ROLE_BUSY'; END IF;
 IF (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r')<>40
    OR (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relrowsecurity AND relforcerowsecurity)<>26
    OR (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>15
    OR EXISTS(SELECT 1 FROM public._prisma_migrations WHERE migration_name IN ('202610210016_goods_receipts','202610230017_finance'))
 THEN RAISE EXCEPTION 'BACKUP_ROLE_PRE016_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolcreaterole AND rolbypassrls)
    OR NOT has_schema_privilege(current_user,'public','USAGE WITH GRANT OPTION')
    OR NOT has_database_privilege(current_user,current_database(),'CONNECT WITH GRANT OPTION')
    OR NOT has_column_privilege(current_user,'pg_catalog.pg_authid','rolpassword','SELECT')
 THEN RAISE EXCEPTION 'BACKUP_ROLE_AUTHORITY_REQUIRED'; END IF;
END;
$gate$;
```

A'nın sayımları tam schema/history/checksum kontrolünün yerine geçmez. Bunlar bağımsız fresh preflight'a **ek** son kapılardır. Tüm40 tablo listesi/kolon/function/permission/default/rol/grantor ve resolved008 checksum sözleşmesi karşılaştırılmadan yalnız bu sayımla B'ye geçilmez. SQL'den project/branch kimliği çıkarıldığı varsayılmaz.

## B — Tam mutation deltası

<!-- ROLE-DDL-BEGIN -->
```sql
CREATE ROLE pusula_backup
 NOLOGIN PASSWORD NULL NOSUPERUSER NOCREATEDB NOCREATEROLE
 NOINHERIT NOREPLICATION BYPASSRLS CONNECTION LIMIT 0;
ALTER ROLE pusula_backup SET default_transaction_read_only=on;
ALTER ROLE pusula_backup SET row_security=off;
ALTER ROLE pusula_backup SET search_path=pg_catalog,public,pg_temp;
GRANT CONNECT ON DATABASE pusula_development TO pusula_backup;
GRANT USAGE ON SCHEMA public TO pusula_backup;
GRANT SELECT ON TABLE
 public."Activity",public."AuditEvent",public."AuthAccount",
 public."AuthBootstrap",public."AuthInvitation",public."AuthMailDelivery",
 public."AuthRateLimit",public."AuthSecurityEvent",public."AuthSession",
 public."AuthTwoFactor",public."AuthUser",public."AuthVerification",
 public."CloudExpenseType",public."CloudImportBatch",public."CloudImportRecord",
 public."CloudPaymentPlan",public."CloudProduct",public."CloudQuote",
 public."CloudSale",public."CloudSaleLine",public."Customer",
 public."LegalEntity",public."Material",public."MaterialPriceHistory",
 public."MaterialVariant",public."Membership",public."Permission",
 public."PermissionScope",public."PurchaseOrder",public."PurchaseOrderLine",
 public."Role",public."RoleAssignment",public."RolePermission",
 public."Supplier",public."SupplierMaterial",public."SupplierOfferVersion",
 public."Tenant",public."TenantExchangeRate",public."UserPermissionOverride",
 public."_prisma_migrations"
TO pusula_backup;
```
<!-- ROLE-DDL-END -->

İdempotent IF NOT EXISTS/ALTER-existing yolu yoktur. Var olan rol başka amaçla kullanılıyor olabilir; duplicate halinde durulur. PUBLIC REVOKE, default privilege değişikliği, LOGIN, parola, nesne CREATE veya business DML yok. CONNECTION LIMIT0 bilinçli ek savunmadır; gelecekte LOGIN için ayrıca yeni incelenmiş aktivasyon gerekir. Readonly/search_path ayarları ACL yerine geçen güvenlik sınırı değildir.

## C — COMMIT öncesi bağımsız sözleşme kontrolü

**Aynı apply transaction'ında**, B'den ayrı validator adımıdır. Başka bağlantı uncommitted rolü göremez; COMMIT öncesi ayrı bağlantının yeni rolü doğruladığı iddia edilmez. Validator aşağıdaki sonuçları başlangıç+izinli delta ile karşılaştırır ve tek bir yanlış sonuçta ROLLBACK seçer. Her kaynak tablo SELECT satırının adı B listesiyle birebir aynı olmalı; count40 tek başına yeterli değildir.

```sql
SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,
       rolreplication,rolbypassrls,rolconnlimit,rolpassword IS NULL AS password_null
FROM pg_authid WHERE rolname='pusula_backup';
-- Tek satır: false/false/false/false/false/false/true, limit0, password_null=true.

SELECT parent.rolname parent,member.rolname member,grantor.rolname grantor,
       m.admin_option,m.inherit_option,m.set_option
FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid
JOIN pg_roles member ON member.oid=m.member JOIN pg_roles grantor ON grantor.oid=m.grantor
WHERE m.roleid=to_regrole('pusula_backup') OR m.member=to_regrole('pusula_backup');
-- Tek satır: parent=pusula_backup, member=neondb_owner, grantor=cloud_admin,
-- ADMIN=true, INHERIT=false, SET=false. Backup'ın üst role üyeliği0.

SELECT setdatabase,setrole::regrole::text role,setconfig
FROM pg_db_role_setting WHERE setrole=to_regrole('pusula_backup');
-- Tek global(setdatabase0) satır, tam3 ayar: default_transaction_read_only=on,
-- row_security=off, search_path=pg_catalog, public, pg_temp. Dizi sırası semantik sıralanır.

SELECT 'table' kind,c.oid::regclass::text identity,pg_get_userbyid(a.grantor) grantor,a.privilege_type,a.is_grantable
FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE a.grantee=to_regrole('pusula_backup')
UNION ALL
SELECT 'schema',n.nspname,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable
FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE a.grantee=to_regrole('pusula_backup')
UNION ALL
SELECT 'database',d.datname,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable
FROM pg_database d CROSS JOIN LATERAL aclexplode(d.datacl) a WHERE a.grantee=to_regrole('pusula_backup')
ORDER BY 1,2,3,4;
-- Tam42 satır: B'deki40 public table SELECT/grantor neondb_owner;
-- public USAGE/grantor pg_database_owner; pusula_development CONNECT/grantor neondb_owner.
-- Her grant-option=false. Sequence/view/diğer schema/diğer DB satırı yok.

SELECT
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND has_table_privilege('pusula_backup',c.oid,'SELECT')) AS readable_tables,
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND has_table_privilege('pusula_backup',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN,SELECT WITH GRANT OPTION')) AS writable_tables,
 has_schema_privilege('pusula_backup','public','CREATE') AS schema_create,
 has_database_privilege('pusula_backup',current_database(),'CREATE') AS database_create,
 (SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prorettype<>'trigger'::regtype AND has_function_privilege('pusula_backup',p.oid,'EXECUTE')) AS callable_application_api,
 (SELECT count(*) FROM pg_shdepend WHERE refclassid='pg_authid'::regclass AND refobjid=to_regrole('pusula_backup') AND deptype='o') AS owned_objects,
 (SELECT count(*) FROM pg_stat_activity WHERE usesysid=to_regrole('pusula_backup')) AS sessions;
-- readable_tables40; kalan sayılar0 ve CREATE flag'leri false.

SELECT
 (SELECT count(*) FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE a.grantee=to_regrole('pusula_backup')) AS direct_function_acl,
 (SELECT count(*) FROM pg_attribute x CROSS JOIN LATERAL aclexplode(x.attacl) a WHERE a.grantee=to_regrole('pusula_backup')) AS direct_column_acl,
 (SELECT count(*) FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE a.grantee=to_regrole('pusula_backup') OR a.grantor=to_regrole('pusula_backup') OR d.defaclrole=to_regrole('pusula_backup')) AS default_acl;
-- Üçü de0. Kaynak dışı PUBLIC nesne hakları bu sorguyla kaldırılmış sayılmaz.
```

Bu kontrollerin yanında başlangıçtaki unchanged_state ve full managed schema/security/history/permission sözleşmesi, yalnız beklenen yeni rol/42 grant/tek creator kenarı/3 ayar çıkarıldıktan sonra eşit olmalı. Baseline fingerprint'i ilk görülen posttan öğrenmek yok. Başka DB'de role doğrudan grant/ownership/member/provider-hook farkı olursa dur; C'yi geçirmek için beklenen değer değiştirilmez.

## D — Terminal işlem ve bağımsız postflight

Bu belgenin varsayılan terminali **ROLLBACK**'tir. Onay verilmeden COMMIT satırı uygulanmaz. Gerçek uygulamada önceden verilmiş hedef/SQL/fingerprint'e bağlı açık onay ve bütün validator sonuçları PASS ise dedicated bağlantıda yalnız bir `COMMIT;` gönderilir. Aksi halde `ROLLBACK;`. Transaction/idle timeout gerçekleşirse yeniden bağlanıp sonucu incele; otomatik tekrar yok.

COMMIT ACK alındığında ayrı TLS READ ONLY/REPEATABLE READ bağlantısı açılır. C sorguları ve unchanged_state, current full source fingerprint, rol flags/role settings/grantor/ownership/active0, diğer DB direct ve PUBLIC erişim envanteri tekrar karşılaştırılır; ROLLBACK+close. Postflight'ın role dahil toplam direct grant'i42, source grantor satır sayısı536(494+42), yeni rol sayısı1/creator kenarı1 olmalıdır; önceden var olan494 satır birebir korunur. Sayım eşitliği tuple multiset eşitliğinin yerine geçmez.

COMMIT sonucu bağlantı kopmasıyla bilinmiyorsa **COMMIT_OUTCOME_UNKNOWN**: rolü tekrar CREATE etme, GRANT replay etme veya otomatik DROP yapma. Ayrı bağlantıyla rol+42 ACL+creator+3 ayar+eski haklar snapshot'ı okunur. Rol yok/başlangıç tam aynı ise ancak bağımsız karar ile NOT_APPLIED; rol tam beklenen delta ise APPLIED_NEEDS_POST_ACCEPTANCE; kısmi/beklenmeyen durum MANUAL_REVIEW. Başka kontrolsüz aktörün aynı adlı rol oluşturması ihtimali göz ardı edilmez.

## Hata kodları ve güvenli geri dönüş

| Kod / durum | Eylem |
| --- | --- |
|42501 /01xxx ACL warning | Yetki/grantor sonucu beklentiden farklı; transaction ROLLBACK; geniş rol/owner fallback yok |
|42710 / BACKUP_ROLE_ALREADY_EXISTS_REVIEW | Var olan rolü değiştirme; rolün kökenini bağımsız incele |
|55P03 /57014 /40P01 /40001 / transaction timeout | Lock/statement/deadlock/serialization/transaction durması; rollback kanıtı ve fresh preflight; kör retry yok |
|080xx /57P01 / COMMIT ACK kaybı | Sonuç belirsizliği; ayrı bağlantı postflight, otomatik tekrar yok |
|P0001 gate /42P01 / schema-history-fingerprint farkı | Yanlış hedef/faz/şema veya eksik tablo; ROLLBACK, baseline güncelleme yok |

COMMIT öncesi yalnız ROLLBACK yeterli ve tercih edilir. Başarılı COMMIT sonrası cleanup **ayrı onaylıdır**; rolün hâlâ bu işlemin NOLOGIN/PASSWORD NULL/active0 nesnesi olduğu ve başka kullanım/dependency eklenmediği kanıtlanır. Yalnız B'deki exact40 SELECT, source CONNECT ve public USAGE kendi grantor'larıyla geri alınır. `neondb_owner` tablo/DB grant'ini kaldırır; schema grantor'ı pg_database_owner ise owner olarak doğru grantor kimliği ayrıca doğrulanır. Creator'ın otomatik ADMIN hakkı, nesne grant'leri kalktıktan sonra rolü yönetmek/DROP için korunur; kör ADMIN REVOKE/CASCADE yok.

```sql
-- SADECE AYRI ONAYLI, EXACT DELTA CLEANUP PLANI; bu görevde çalıştırılmaz.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $cleanup_gate$
BEGIN
 IF current_user<>'neondb_owner' OR session_user<>current_user OR current_database()<>'pusula_development'
    OR current_setting('server_version_num')<>'180006' THEN RAISE EXCEPTION 'BACKUP_CLEANUP_TARGET_REJECTED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_authid WHERE rolname='pusula_backup' AND NOT rolcanlogin AND rolpassword IS NULL
  AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND rolbypassrls AND rolconnlimit=0)
  OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE usesysid=to_regrole('pusula_backup'))
  OR EXISTS(SELECT 1 FROM pg_shdepend WHERE refclassid='pg_authid'::regclass AND refobjid=to_regrole('pusula_backup') AND deptype='o')
 THEN RAISE EXCEPTION 'BACKUP_CLEANUP_STATE_CHANGED'; END IF;
END;
$cleanup_gate$;
-- Bu satırdan önce C'nin exact42-grant/tek creator/3-settings kontrolü de tekrar PASS olmalı.
REVOKE SELECT ON TABLE
 public."Activity",public."AuditEvent",public."AuthAccount",
 public."AuthBootstrap",public."AuthInvitation",public."AuthMailDelivery",
 public."AuthRateLimit",public."AuthSecurityEvent",public."AuthSession",
 public."AuthTwoFactor",public."AuthUser",public."AuthVerification",
 public."CloudExpenseType",public."CloudImportBatch",public."CloudImportRecord",
 public."CloudPaymentPlan",public."CloudProduct",public."CloudQuote",
 public."CloudSale",public."CloudSaleLine",public."Customer",
 public."LegalEntity",public."Material",public."MaterialPriceHistory",
 public."MaterialVariant",public."Membership",public."Permission",
 public."PermissionScope",public."PurchaseOrder",public."PurchaseOrderLine",
 public."Role",public."RoleAssignment",public."RolePermission",
 public."Supplier",public."SupplierMaterial",public."SupplierOfferVersion",
 public."Tenant",public."TenantExchangeRate",public."UserPermissionOverride",
 public."_prisma_migrations"
FROM pusula_backup;
REVOKE CONNECT ON DATABASE pusula_development FROM pusula_backup;
REVOKE USAGE ON SCHEMA public FROM pusula_backup;
-- Bağımsız dependency/ACL/grantor/role settings/active0 kontrolü sonrasında:
DROP ROLE pusula_backup;
ROLLBACK;
```

DROP RESTRICT(varsayılan) bağımlılık varsa2BP01 ile durmalı; DROP OWNED, CASCADE, PUBLIC REVOKE, mevcut rol veya kullanıcı haklarına toplu dokunma yok. Cleanup için de önceki42 exact grant ve güvenli grantor kimliği kabulü gerekir; farklı owner/grantor durumunda bu SQL genişletilmez. Bu runbook LOGIN/credential etkinleştirme veya mevcut kullanıcı backend'lerini sonlandırma emri içermez.
