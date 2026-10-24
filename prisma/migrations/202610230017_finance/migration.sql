-- 017 FINANCE. Canonical single-history artifact; cloud apply remains disabled.
-- Local-only acceptance requires a reviewed runner. Neon needs separate authorization.
BEGIN;
SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='120s'; SET LOCAL transaction_timeout='180s';
SET LOCAL search_path=public,pg_temp;
DO $$ BEGIN
 IF current_setting('pusula.finance_review',true) IS DISTINCT FROM 'APPROVED_017_CANDIDATE' THEN RAISE EXCEPTION 'FINANCE_OPERATOR_REVIEW_REQUIRED'; END IF;
 IF current_setting('server_version_num')<>'180006' OR to_regclass('public."FinanceAccount"') IS NOT NULL THEN RAISE EXCEPTION 'FINANCE_BASELINE_REJECTED'; END IF;
 IF (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>16 OR NOT EXISTS(SELECT 1 FROM public._prisma_migrations WHERE migration_name='202610210016_goods_receipts' AND checksum='27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567' AND finished_at IS NOT NULL AND rolled_back_at IS NULL) THEN RAISE EXCEPTION 'FINANCE_ACCEPTED_016_REQUIRED'; END IF;
 IF NOT has_schema_privilege(current_user,'public','CREATE WITH GRANT OPTION') OR NOT has_function_privilege(current_user,'public.pusula_can(text,uuid,uuid,uuid,text)','EXECUTE WITH GRANT OPTION') THEN RAISE EXCEPTION 'FINANCE_OWNER_GRANT_AUTHORITY_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pusula_runtime' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb) THEN RAISE EXCEPTION 'FINANCE_RUNTIME_ROLE_REJECTED'; END IF;
END $$;
-- Source local-schema.sql SHA256 c4cc80ce5bfadbdec880e74f670af7b5250fc086021ff3569d893d526171b63b
-- LOCAL PREPARATION ONLY; future 017 requires accepted/applied 016. No second migration history.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';

CREATE ROLE pusula_finance_role_creator NOLOGIN NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT pusula_finance_role_creator TO CURRENT_USER WITH INHERIT FALSE, SET TRUE;
SET LOCAL ROLE pusula_finance_role_creator;
CREATE ROLE pusula_finance_executor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT pusula_finance_executor TO SESSION_USER WITH INHERIT FALSE, SET TRUE;
RESET ROLE;
CREATE TABLE "FinanceAccount" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenantId" uuid NOT NULL, "legalEntityId" uuid NOT NULL, "activityId" uuid, "createdById" text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('CUSTOMER','SUPPLIER','EQUITY')), "customerId" uuid, "supplierId" uuid,
 currency text NOT NULL DEFAULT 'TRY' CHECK(currency='TRY'),
 CHECK((kind='CUSTOMER' AND "customerId" IS NOT NULL AND "supplierId" IS NULL) OR (kind='SUPPLIER' AND "supplierId" IS NOT NULL AND "customerId" IS NULL) OR (kind='EQUITY' AND "customerId" IS NULL AND "supplierId" IS NULL)),
 FOREIGN KEY("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id),
 FOREIGN KEY("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId","customerId") REFERENCES "Customer"("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId","supplierId") REFERENCES "Supplier"("tenantId","legalEntityId",id),
 UNIQUE NULLS NOT DISTINCT("tenantId","legalEntityId","activityId",kind,"customerId","supplierId"), UNIQUE("tenantId","legalEntityId",id)
);
CREATE TABLE "FinanceJournal" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenantId" uuid NOT NULL, "legalEntityId" uuid NOT NULL, "activityId" uuid, "createdById" text NOT NULL,
 "accountId" uuid NOT NULL, "sourceKey" text NOT NULL, "requestKey" uuid NOT NULL, "payloadHash" text NOT NULL,
 "reversesId" uuid UNIQUE REFERENCES "FinanceJournal"(id), "bookedOn" date NOT NULL, "dueOn" date,
 reason varchar(500) NOT NULL CHECK(length(trim(reason))>=3), "createdAt" timestamptz NOT NULL DEFAULT now(),
 CHECK("dueOn" IS NULL OR "dueOn">="bookedOn"),
 FOREIGN KEY("tenantId","legalEntityId","accountId") REFERENCES "FinanceAccount"("tenantId","legalEntityId",id),
 UNIQUE("tenantId","legalEntityId","sourceKey"), UNIQUE("tenantId","legalEntityId","requestKey"), UNIQUE("tenantId","legalEntityId",id)
);
CREATE TABLE "FinancePosting" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenantId" uuid NOT NULL, "legalEntityId" uuid NOT NULL, "activityId" uuid, "createdById" text NOT NULL,
 "journalId" uuid NOT NULL, "accountId" uuid NOT NULL, debit numeric(18,2) NOT NULL CHECK(debit>=0), credit numeric(18,2) NOT NULL CHECK(credit>=0), CHECK(debit=0 OR credit=0),
 FOREIGN KEY("tenantId","legalEntityId","journalId") REFERENCES "FinanceJournal"("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId","accountId") REFERENCES "FinanceAccount"("tenantId","legalEntityId",id), UNIQUE("journalId","accountId")
);
CREATE INDEX finance_statement ON "FinancePosting"("accountId","journalId");
CREATE FUNCTION k1_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN RAISE EXCEPTION 'FINANCE_IMMUTABLE'; END $$;
CREATE FUNCTION k1_balanced() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE jid uuid; n int; delta numeric;
BEGIN
 IF TG_TABLE_NAME='FinanceJournal' THEN jid=NEW.id; ELSE jid=NEW."journalId"; END IF;
 SELECT count(*),sum(debit-credit) INTO n,delta FROM public."FinancePosting" WHERE "journalId"=jid;
 IF n<>2 OR delta IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'FINANCE_UNBALANCED'; END IF;
 IF EXISTS(SELECT 1 FROM public."FinancePosting" p JOIN public."FinanceJournal" j ON j.id=p."journalId" JOIN public."FinanceAccount" a ON a.id=p."accountId" WHERE j.id=jid AND (p."activityId" IS DISTINCT FROM j."activityId" OR a."activityId" IS DISTINCT FROM j."activityId")) THEN RAISE EXCEPTION 'FINANCE_SCOPE_MISMATCH'; END IF;
 RETURN NULL;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['FinanceAccount','FinanceJournal','FinancePosting'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE TRIGGER finance_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION k1_immutable()',t);
 EXECUTE format('CREATE POLICY finance_scope ON %I USING ("tenantId"::text=current_setting(''app.tenant_id'',true) AND "legalEntityId"::text=current_setting(''app.legal_entity_id'',true) AND "activityId" IS NOT DISTINCT FROM nullif(current_setting(''app.activity_id'',true),'''')::uuid AND coalesce(current_setting(''app.user_id'',true),'''')<>'''')',t);
 EXECUTE format('CREATE POLICY finance_read ON %I AS RESTRICTIVE FOR SELECT USING (pusula_can(''finance.accounts'',"tenantId","legalEntityId","activityId","createdById"))',t);
 EXECUTE format('CREATE POLICY finance_insert ON %I AS RESTRICTIVE FOR INSERT WITH CHECK (current_user=''pusula_finance_executor'' AND "createdById"=current_setting(''app.user_id'',true) AND pusula_can(''finance.accounts'',"tenantId","legalEntityId","activityId","createdById") AND pusula_can(''finance.approve'',"tenantId","legalEntityId","activityId","createdById"))',t);
 END LOOP;
END $$;
CREATE CONSTRAINT TRIGGER finance_journal_balance AFTER INSERT ON "FinanceJournal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION k1_balanced();
CREATE CONSTRAINT TRIGGER finance_posting_balance AFTER INSERT ON "FinancePosting" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION k1_balanced();
CREATE FUNCTION k1_command(cmd text,p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t uuid:=nullif(current_setting('app.tenant_id',true),'')::uuid; e uuid:=nullif(current_setting('app.legal_entity_id',true),'')::uuid; a uuid:=nullif(current_setting('app.activity_id',true),'')::uuid; u text:=nullif(current_setting('app.user_id',true),'');
 account public."FinanceAccount"; old public."FinanceJournal"; original public."FinanceJournal";
 jid uuid; equity uuid; src text; h text; amount numeric; signed_amount numeric; d date; due date; k uuid;
BEGIN
 IF cmd NOT IN ('ACCOUNT','OPENING','REVERSE') OR u IS NULL OR t IS NULL OR e IS NULL OR NOT public.pusula_can('finance.accounts',t,e,a,u) OR NOT public.pusula_can('finance.approve',t,e,a,u) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||e::text,1701));
 IF cmd='ACCOUNT' THEN
  IF p->>'kind'='CUSTOMER' THEN
   IF NOT EXISTS(SELECT 1 FROM public."Customer" WHERE id=(p->>'partyId')::uuid AND "tenantId"=t AND "legalEntityId"=e AND "activityId" IS NOT DISTINCT FROM a AND active) THEN RAISE EXCEPTION 'FINANCE_PARTY_REJECTED'; END IF;
  ELSIF p->>'kind'='SUPPLIER' THEN
   IF NOT EXISTS(SELECT 1 FROM public."Supplier" WHERE id=(p->>'partyId')::uuid AND "tenantId"=t AND "legalEntityId"=e AND "activityId" IS NOT DISTINCT FROM a AND active) THEN RAISE EXCEPTION 'FINANCE_PARTY_REJECTED'; END IF;
  ELSE RAISE EXCEPTION 'FINANCE_PARTY_REJECTED'; END IF;
  SELECT id INTO jid FROM public."FinanceAccount" WHERE kind=p->>'kind' AND coalesce("customerId","supplierId")=(p->>'partyId')::uuid;
  IF jid IS NOT NULL THEN RETURN jid; END IF;
  INSERT INTO public."FinanceAccount"("tenantId","legalEntityId","activityId","createdById",kind,"customerId","supplierId") VALUES(t,e,a,u,p->>'kind',CASE WHEN p->>'kind'='CUSTOMER' THEN (p->>'partyId')::uuid END,CASE WHEN p->>'kind'='SUPPLIER' THEN (p->>'partyId')::uuid END) RETURNING id INTO jid;
 ELSE
  k:=(p->>'idempotencyKey')::uuid; d:=(p->>'bookedOn')::date;
  IF k IS NULL OR d IS NULL OR NOT isfinite(d) OR (p->>'bookedOn') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR p->>'reason' IS NULL THEN RAISE EXCEPTION 'FINANCE_INVALID'; END IF;
  h:=encode(sha256(convert_to(cmd||p::text,'UTF8')),'hex');
  SELECT * INTO old FROM public."FinanceJournal" WHERE "requestKey"=k;
  IF old.id IS NOT NULL THEN
   IF old."payloadHash"<>h THEN RAISE EXCEPTION 'FINANCE_IDEMPOTENCY_CONFLICT'; END IF; RETURN old.id;
  END IF;
  IF cmd='OPENING' THEN
   IF p->>'currency' IS DISTINCT FROM 'TRY' OR jsonb_typeof(p->'amount') IS DISTINCT FROM 'string' OR (p->>'amount') !~ '^-?(0|[1-9][0-9]{0,13})([.][0-9]{1,2})?$' THEN RAISE EXCEPTION 'FINANCE_AMOUNT_REJECTED'; END IF;
   amount:=(p->>'amount')::numeric; due:=(p->>'dueOn')::date;
   IF due IS NOT NULL AND (NOT isfinite(due) OR (p->>'dueOn') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') THEN RAISE EXCEPTION 'FINANCE_DATE_REJECTED'; END IF;
   SELECT * INTO account FROM public."FinanceAccount" WHERE id=(p->>'accountId')::uuid AND kind<>'EQUITY'; src:='OPENING:'||account.id;
  ELSE
   SELECT * INTO original FROM public."FinanceJournal" WHERE id=(p->>'journalId')::uuid AND "reversesId" IS NULL;
   IF original.id IS NULL OR d<original."bookedOn" THEN RAISE EXCEPTION 'FINANCE_REVERSAL_REJECTED'; END IF;
   SELECT * INTO account FROM public."FinanceAccount" WHERE id=original."accountId";
   SELECT -(debit-credit) INTO signed_amount FROM public."FinancePosting" WHERE "journalId"=original.id AND "accountId"=account.id;
   amount:=CASE WHEN account.kind='SUPPLIER' THEN -signed_amount ELSE signed_amount END; src:='REVERSE:'||original.id;
  END IF;
  IF account.id IS NULL OR NOT public.pusula_can('finance.approve',t,e,a,account."createdById") THEN RAISE EXCEPTION 'FINANCE_ACCOUNT_REJECTED'; END IF;
  IF EXISTS(SELECT 1 FROM public."FinanceJournal" WHERE "sourceKey"=src) THEN RAISE EXCEPTION 'FINANCE_DUPLICATE_SOURCE'; END IF;
  SELECT id INTO equity FROM public."FinanceAccount" WHERE kind='EQUITY';
  IF equity IS NULL THEN INSERT INTO public."FinanceAccount"("tenantId","legalEntityId","activityId","createdById",kind) VALUES(t,e,a,u,'EQUITY') RETURNING id INTO equity; END IF;
  signed_amount:=CASE WHEN account.kind='SUPPLIER' THEN -amount ELSE amount END;
  INSERT INTO public."FinanceJournal"("tenantId","legalEntityId","activityId","createdById","accountId","sourceKey","requestKey","payloadHash","reversesId","bookedOn","dueOn",reason) VALUES(t,e,a,u,account.id,src,k,h,CASE WHEN cmd='REVERSE' THEN original.id END,d,due,p->>'reason') RETURNING id INTO jid;
  INSERT INTO public."FinancePosting"("tenantId","legalEntityId","activityId","createdById","journalId","accountId",debit,credit) VALUES(t,e,a,u,jid,account.id,greatest(signed_amount,0),greatest(-signed_amount,0)),(t,e,a,u,jid,equity,greatest(-signed_amount,0),greatest(signed_amount,0));
 END IF;
 INSERT INTO public."AuditEvent"(id,"tenantId","legalEntityId","actorId",action,"targetId",summary) VALUES(gen_random_uuid(),t,e,u,'finance.'||lower(cmd),jid::text,'{"changed":true}'::jsonb);
 RETURN jid;
END $$;
REVOKE ALL ON FUNCTION k1_command(text,jsonb),k1_immutable(),k1_balanced() FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO pusula_finance_executor;
GRANT SELECT ON "Membership","RoleAssignment","RolePermission","PermissionScope","UserPermissionOverride","Customer","Supplier" TO pusula_finance_executor;
GRANT SELECT,INSERT ON "FinanceAccount","FinanceJournal","FinancePosting" TO pusula_finance_executor;
GRANT INSERT ON "AuditEvent" TO pusula_finance_executor;
GRANT EXECUTE ON FUNCTION pusula_can(text,uuid,uuid,uuid,text),k1_immutable(),k1_balanced() TO pusula_finance_executor;


REVOKE ALL ON FUNCTION k1_command(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION k1_command(text,jsonb) TO pusula_runtime;

GRANT SELECT ON "FinanceAccount","FinanceJournal","FinancePosting" TO pusula_runtime;

-- Source k2-local-schema.sql SHA256 46b5baa9a2578dcc846106aef65298649ea746b9861c846f615934db45a483ce
-- K2 LOCAL PREPARATION ONLY. Apply after local-schema.sql, never through cloud deploy.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';

ALTER TABLE "FinanceAccount" DROP CONSTRAINT "FinanceAccount_kind_check", DROP CONSTRAINT "FinanceAccount_check";
ALTER TABLE "FinanceAccount" ADD CHECK(kind IN ('CUSTOMER','SUPPLIER','EQUITY','REVENUE','VAT')),
 ADD CHECK((kind='CUSTOMER' AND "customerId" IS NOT NULL AND "supplierId" IS NULL) OR (kind='SUPPLIER' AND "supplierId" IS NOT NULL AND "customerId" IS NULL) OR (kind IN ('EQUITY','REVENUE','VAT') AND "customerId" IS NULL AND "supplierId" IS NULL));
ALTER TABLE "FinanceJournal" ADD "saleId" uuid UNIQUE, ADD "saleSourceKey" text,
 ADD "netTry" numeric(18,2), ADD "vatTry" numeric(18,2), ADD "grossTry" numeric(18,2),
 ADD FOREIGN KEY("tenantId","legalEntityId","saleId") REFERENCES "CloudSale"("tenantId","legalEntityId",id),
 ADD CHECK(("saleId" IS NULL AND "saleSourceKey" IS NULL AND "netTry" IS NULL AND "vatTry" IS NULL AND "grossTry" IS NULL) OR
 ("saleId" IS NOT NULL AND "saleSourceKey" IS NOT NULL AND "netTry" IS NOT NULL AND "vatTry" IS NOT NULL AND "grossTry" IS NOT NULL AND "netTry">0 AND "vatTry">=0 AND "grossTry"="netTry"+"vatTry"));
CREATE UNIQUE INDEX finance_sale_business_source ON "FinanceJournal"("tenantId","legalEntityId","saleSourceKey") WHERE "saleId" IS NOT NULL;
CREATE OR REPLACE FUNCTION k1_balanced() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE jid uuid; n int; delta numeric; expected int;
BEGIN
 IF TG_TABLE_NAME='FinanceJournal' THEN jid=NEW.id; ELSE jid=NEW."journalId"; END IF;
 SELECT CASE WHEN j."saleId" IS NOT NULL OR o."saleId" IS NOT NULL THEN 3 ELSE 2 END INTO expected
 FROM public."FinanceJournal" j LEFT JOIN public."FinanceJournal" o ON o.id=j."reversesId" WHERE j.id=jid;
 SELECT count(*),sum(debit-credit) INTO n,delta FROM public."FinancePosting" WHERE "journalId"=jid;
 IF n IS DISTINCT FROM expected OR delta IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'FINANCE_UNBALANCED'; END IF;
 IF EXISTS(SELECT 1 FROM public."FinancePosting" p JOIN public."FinanceJournal" j ON j.id=p."journalId" JOIN public."FinanceAccount" a ON a.id=p."accountId" WHERE j.id=jid AND (p."activityId" IS DISTINCT FROM j."activityId" OR a."activityId" IS DISTINCT FROM j."activityId")) THEN RAISE EXCEPTION 'FINANCE_SCOPE_MISMATCH'; END IF;
 RETURN NULL;
END $$;
GRANT SELECT ON "CloudSale","CloudSaleLine" TO pusula_finance_executor;
CREATE FUNCTION k2_post_sale(sid uuid, business_source text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t uuid:=nullif(current_setting('app.tenant_id',true),'')::uuid; e uuid:=nullif(current_setting('app.legal_entity_id',true),'')::uuid; a uuid:=nullif(current_setting('app.activity_id',true),'')::uuid; u text:=nullif(current_setting('app.user_id',true),'');
 s public."CloudSale"; jid uuid; ar uuid; revenue uuid; tax uuid; row_xid bigint;
BEGIN
 IF u IS NULL OR t IS NULL OR e IS NULL OR business_source IS NULL OR length(business_source) NOT BETWEEN 1 AND 264
 OR NOT public.pusula_can('finance.accounts',t,e,a,u) OR NOT public.pusula_can('finance.approve',t,e,a,u)
 OR NOT public.pusula_can('sales.create',t,e,a,u) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||e::text,1701));
 SELECT * INTO s FROM public."CloudSale" WHERE id=sid AND "tenantId"=t AND "legalEntityId"=e AND "activityId" IS NOT DISTINCT FROM a AND "createdById"=u;
 IF s.id IS NULL OR s."rateSnapshot"->>'historical'='true' THEN RAISE EXCEPTION 'FINANCE_SALE_REJECTED'; END IF;
 SELECT id INTO jid FROM public."FinanceJournal" WHERE "saleId"=s.id;
 IF jid IS NOT NULL THEN RAISE EXCEPTION 'FINANCE_DUPLICATE_SOURCE'; END IF;
 -- No legacy backfill: a new sale and its journal must originate in this transaction.
 SELECT xmin::text::bigint INTO row_xid FROM public."CloudSale" WHERE id=s.id;
 IF row_xid <> mod(pg_current_xact_id()::text::numeric,4294967296)::bigint THEN RAISE EXCEPTION 'FINANCE_LEGACY_SALE_REJECTED'; END IF;
 IF s.currency<>'TRY' OR s."totalTry"<>s."netTry"+s."vatTry" OR s."netTry"<=0 OR s."vatTry"<0 THEN RAISE EXCEPTION 'FINANCE_SALE_TOTAL_REJECTED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."CloudSaleLine" WHERE "saleId"=s.id)
 OR (SELECT sum("netTry") FROM public."CloudSaleLine" WHERE "saleId"=s.id)<>s."netTry"
 OR (SELECT sum("vatTry") FROM public."CloudSaleLine" WHERE "saleId"=s.id)<>s."vatTry"
 OR (SELECT sum("totalTry") FROM public."CloudSaleLine" WHERE "saleId"=s.id)<>s."totalTry" THEN RAISE EXCEPTION 'FINANCE_SALE_LINES_REJECTED'; END IF;
 ar:=public.k1_command('ACCOUNT',jsonb_build_object('kind','CUSTOMER','partyId',s."customerId"));
 IF NOT public.pusula_can('finance.approve',t,e,a,(SELECT "createdById" FROM public."FinanceAccount" WHERE id=ar)) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
 SELECT id INTO revenue FROM public."FinanceAccount" WHERE kind='REVENUE';
 IF revenue IS NULL THEN INSERT INTO public."FinanceAccount"("tenantId","legalEntityId","activityId","createdById",kind) VALUES(t,e,a,u,'REVENUE') RETURNING id INTO revenue; END IF;
 SELECT id INTO tax FROM public."FinanceAccount" WHERE kind='VAT';
 IF tax IS NULL THEN INSERT INTO public."FinanceAccount"("tenantId","legalEntityId","activityId","createdById",kind) VALUES(t,e,a,u,'VAT') RETURNING id INTO tax; END IF;
 INSERT INTO public."FinanceJournal"("tenantId","legalEntityId","activityId","createdById","accountId","sourceKey","requestKey","payloadHash","bookedOn","dueOn",reason,"saleId","saleSourceKey","netTry","vatTry","grossTry")
 VALUES(t,e,a,u,ar,'SALE:'||s.id,s.id,s."payloadHash",s.date,s."dueDate",'Sale receivable',s.id,business_source,s."netTry",s."vatTry",s."totalTry") RETURNING id INTO jid;
 INSERT INTO public."FinancePosting"("tenantId","legalEntityId","activityId","createdById","journalId","accountId",debit,credit)
 VALUES(t,e,a,u,jid,ar,s."totalTry",0),(t,e,a,u,jid,revenue,0,s."netTry"),(t,e,a,u,jid,tax,0,s."vatTry");
 INSERT INTO public."AuditEvent"(id,"tenantId","legalEntityId","actorId",action,"targetId",summary) VALUES(gen_random_uuid(),t,e,u,'finance.sale',jid::text,'{"changed":true}'::jsonb);
 RETURN jid;
END $$;
CREATE FUNCTION k2_sale_requires_journal() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 -- Existing reviewed historical import remains unposted; not a new live sale.
 IF NEW."rateSnapshot"->>'historical'='true' AND public.pusula_can('imports.confirm',NEW."tenantId",NEW."legalEntityId",NEW."activityId",NEW."createdById")
 AND EXISTS(SELECT 1 FROM public."CloudImportRecord" r JOIN public."CloudImportBatch" b ON b.id=r."batchId"
 WHERE r.kind='sale' AND r."targetId"=NEW.id AND r."tenantId"=NEW."tenantId" AND r."legalEntityId"=NEW."legalEntityId"
 AND r."activityId" IS NOT DISTINCT FROM NEW."activityId" AND b.status='CONFIRMED') THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."FinanceJournal" j WHERE j."saleId"=NEW.id AND j."tenantId"=NEW."tenantId" AND j."legalEntityId"=NEW."legalEntityId" AND j."activityId" IS NOT DISTINCT FROM NEW."activityId" AND j."netTry"=NEW."netTry" AND j."vatTry"=NEW."vatTry" AND j."grossTry"=NEW."totalTry") THEN RAISE EXCEPTION 'FINANCE_SALE_JOURNAL_REQUIRED'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER finance_sale_atomic AFTER INSERT ON "CloudSale" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION k2_sale_requires_journal();
REVOKE ALL ON FUNCTION k2_post_sale(uuid,text),k2_sale_requires_journal() FROM PUBLIC;


REVOKE ALL ON FUNCTION k2_post_sale(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION k2_post_sale(uuid,text) TO pusula_runtime;

CREATE OR REPLACE FUNCTION k1_command(cmd text,p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t uuid:=nullif(current_setting('app.tenant_id',true),'')::uuid; e uuid:=nullif(current_setting('app.legal_entity_id',true),'')::uuid; a uuid:=nullif(current_setting('app.activity_id',true),'')::uuid; u text:=nullif(current_setting('app.user_id',true),'');
 account public."FinanceAccount"; old public."FinanceJournal"; original public."FinanceJournal";
 jid uuid; equity uuid; src text; h text; amount numeric; signed_amount numeric; d date; due date; k uuid;
BEGIN
 IF cmd NOT IN ('ACCOUNT','OPENING','REVERSE') OR u IS NULL OR t IS NULL OR e IS NULL OR NOT public.pusula_can('finance.accounts',t,e,a,u) OR NOT public.pusula_can('finance.approve',t,e,a,u) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||e::text,1701));
 IF cmd='ACCOUNT' THEN
  IF p->>'kind'='CUSTOMER' THEN
   IF NOT EXISTS(SELECT 1 FROM public."Customer" WHERE id=(p->>'partyId')::uuid AND "tenantId"=t AND "legalEntityId"=e AND "activityId" IS NOT DISTINCT FROM a AND active) THEN RAISE EXCEPTION 'FINANCE_PARTY_REJECTED'; END IF;
  ELSIF p->>'kind'='SUPPLIER' THEN
   IF NOT EXISTS(SELECT 1 FROM public."Supplier" WHERE id=(p->>'partyId')::uuid AND "tenantId"=t AND "legalEntityId"=e AND "activityId" IS NOT DISTINCT FROM a AND active) THEN RAISE EXCEPTION 'FINANCE_PARTY_REJECTED'; END IF;
  ELSE RAISE EXCEPTION 'FINANCE_PARTY_REJECTED'; END IF;
  SELECT id INTO jid FROM public."FinanceAccount" WHERE kind=p->>'kind' AND coalesce("customerId","supplierId")=(p->>'partyId')::uuid;
  IF jid IS NOT NULL THEN RETURN jid; END IF;
  INSERT INTO public."FinanceAccount"("tenantId","legalEntityId","activityId","createdById",kind,"customerId","supplierId") VALUES(t,e,a,u,p->>'kind',CASE WHEN p->>'kind'='CUSTOMER' THEN (p->>'partyId')::uuid END,CASE WHEN p->>'kind'='SUPPLIER' THEN (p->>'partyId')::uuid END) RETURNING id INTO jid;
 ELSE
  k:=(p->>'idempotencyKey')::uuid; d:=(p->>'bookedOn')::date;
  IF k IS NULL OR d IS NULL OR NOT isfinite(d) OR (p->>'bookedOn') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR p->>'reason' IS NULL THEN RAISE EXCEPTION 'FINANCE_INVALID'; END IF;
  h:=encode(sha256(convert_to(cmd||p::text,'UTF8')),'hex');
  SELECT * INTO old FROM public."FinanceJournal" WHERE "requestKey"=k;
  IF old.id IS NOT NULL THEN
   IF old."payloadHash"<>h THEN RAISE EXCEPTION 'FINANCE_IDEMPOTENCY_CONFLICT'; END IF; RETURN old.id;
  END IF;
  IF cmd='OPENING' THEN
   IF p->>'currency' IS DISTINCT FROM 'TRY' OR jsonb_typeof(p->'amount') IS DISTINCT FROM 'string' OR (p->>'amount') !~ '^-?(0|[1-9][0-9]{0,13})([.][0-9]{1,2})?$' THEN RAISE EXCEPTION 'FINANCE_AMOUNT_REJECTED'; END IF;
   amount:=(p->>'amount')::numeric; due:=(p->>'dueOn')::date;
   IF due IS NOT NULL AND (NOT isfinite(due) OR (p->>'dueOn') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') THEN RAISE EXCEPTION 'FINANCE_DATE_REJECTED'; END IF;
   SELECT * INTO account FROM public."FinanceAccount" WHERE id=(p->>'accountId')::uuid AND kind IN ('CUSTOMER','SUPPLIER'); src:='OPENING:'||account.id;
  ELSE
   SELECT * INTO original FROM public."FinanceJournal" WHERE id=(p->>'journalId')::uuid AND "reversesId" IS NULL;
   IF original.id IS NULL OR d<original."bookedOn" THEN RAISE EXCEPTION 'FINANCE_REVERSAL_REJECTED'; END IF;
   IF original."saleId" IS NOT NULL AND NOT public.pusula_can('sales.cancel',t,e,a,original."createdById") THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
   SELECT * INTO account FROM public."FinanceAccount" WHERE id=original."accountId";
   SELECT -(debit-credit) INTO signed_amount FROM public."FinancePosting" WHERE "journalId"=original.id AND "accountId"=account.id;
   amount:=CASE WHEN account.kind='SUPPLIER' THEN -signed_amount ELSE signed_amount END; src:='REVERSE:'||original.id;
  END IF;
  IF account.id IS NULL OR NOT public.pusula_can('finance.approve',t,e,a,account."createdById") THEN RAISE EXCEPTION 'FINANCE_ACCOUNT_REJECTED'; END IF;
  IF EXISTS(SELECT 1 FROM public."FinanceJournal" WHERE "sourceKey"=src) THEN RAISE EXCEPTION 'FINANCE_DUPLICATE_SOURCE'; END IF;
  IF cmd='OPENING' THEN
  SELECT id INTO equity FROM public."FinanceAccount" WHERE kind='EQUITY';
  IF equity IS NULL THEN INSERT INTO public."FinanceAccount"("tenantId","legalEntityId","activityId","createdById",kind) VALUES(t,e,a,u,'EQUITY') RETURNING id INTO equity; END IF;
  END IF;
  signed_amount:=CASE WHEN account.kind='SUPPLIER' THEN -amount ELSE amount END;
  INSERT INTO public."FinanceJournal"("tenantId","legalEntityId","activityId","createdById","accountId","sourceKey","requestKey","payloadHash","reversesId","bookedOn","dueOn",reason) VALUES(t,e,a,u,account.id,src,k,h,CASE WHEN cmd='REVERSE' THEN original.id END,d,due,p->>'reason') RETURNING id INTO jid;
  IF cmd='REVERSE' THEN
   INSERT INTO public."FinancePosting"("tenantId","legalEntityId","activityId","createdById","journalId","accountId",debit,credit)
   SELECT t,e,a,u,jid,"accountId",credit,debit FROM public."FinancePosting" WHERE "journalId"=original.id;
  ELSE
  INSERT INTO public."FinancePosting"("tenantId","legalEntityId","activityId","createdById","journalId","accountId",debit,credit) VALUES(t,e,a,u,jid,account.id,greatest(signed_amount,0),greatest(-signed_amount,0)),(t,e,a,u,jid,equity,greatest(-signed_amount,0),greatest(signed_amount,0));
  END IF;
 END IF;
 INSERT INTO public."AuditEvent"(id,"tenantId","legalEntityId","actorId",action,"targetId",summary) VALUES(gen_random_uuid(),t,e,u,'finance.'||lower(cmd),jid::text,'{"changed":true}'::jsonb);
 RETURN jid;
END $$;

-- Source k3-local-schema.sql SHA256 3af3cc48b2aadb419a671703db425f62fc5328875f4f945a25aadda60d308bcd
-- K3 LOCAL ONLY; successor to K1/K2 preparation, never a cloud migration.
SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s';

ALTER TABLE "FinanceAccount" DROP CONSTRAINT "FinanceAccount_kind_check", DROP CONSTRAINT "FinanceAccount_check";
ALTER TABLE "FinanceAccount" ADD label varchar(100) NOT NULL DEFAULT '',
 ADD CHECK(kind IN ('CUSTOMER','SUPPLIER','EQUITY','REVENUE','VAT','CASH','BANK','POS','PURCHASE','COMMISSION')),
 ADD CHECK((kind='CUSTOMER' AND "customerId" IS NOT NULL AND "supplierId" IS NULL) OR (kind='SUPPLIER' AND "supplierId" IS NOT NULL AND "customerId" IS NULL) OR (kind NOT IN ('CUSTOMER','SUPPLIER') AND "customerId" IS NULL AND "supplierId" IS NULL));
ALTER TABLE "FinanceJournal" ADD "postingCount" int CHECK("postingCount" IN (2,3));
CREATE TABLE "FinanceIntent" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenantId" uuid NOT NULL, "legalEntityId" uuid NOT NULL, "activityId" uuid, "createdById" text NOT NULL,
 closed boolean NOT NULL DEFAULT false, kind text NOT NULL CHECK(kind IN ('SALE','OPEN','DEBT','COLLECT','PAY','SETTLE')), "clientKey" uuid NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id), FOREIGN KEY("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id),
 UNIQUE("tenantId","legalEntityId","createdById","clientKey"), UNIQUE("tenantId","legalEntityId",id)
);
CREATE TABLE "FinanceAccountAccess" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenantId" uuid NOT NULL, "legalEntityId" uuid NOT NULL, "activityId" uuid, "createdById" text NOT NULL,
 "accountId" uuid NOT NULL, "userId" text NOT NULL REFERENCES "AuthUser"(id),
 FOREIGN KEY("tenantId","legalEntityId","accountId") REFERENCES "FinanceAccount"("tenantId","legalEntityId",id), UNIQUE("accountId","userId")
);
CREATE TABLE "FinanceOperation" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenantId" uuid NOT NULL, "legalEntityId" uuid NOT NULL, "activityId" uuid, "createdById" text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('OPEN','DEBT','COLLECT','PAY','SETTLE','REVERSE')),
 "intentId" uuid UNIQUE, "requestKey" uuid NOT NULL, "payloadHash" text NOT NULL, "economicKey" text NOT NULL,
 "journalId" uuid NOT NULL UNIQUE, "accountId" uuid NOT NULL, "fundAccountId" uuid, "sourceJournalId" uuid,
 amount numeric(18,2) NOT NULL CHECK(amount>=0), fee numeric(18,2) NOT NULL CHECK(fee>=0),
 "externalRef" varchar(200) NOT NULL, method text CHECK(method IN ('CASH','BANK','CARD')), "terminalApproved" boolean NOT NULL,
 "bookedOn" date NOT NULL, "dueOn" date, reason varchar(500) NOT NULL, "reversesId" uuid UNIQUE REFERENCES "FinanceOperation"(id), "createdAt" timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY("tenantId","legalEntityId","intentId") REFERENCES "FinanceIntent"("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId","accountId") REFERENCES "FinanceAccount"("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId","fundAccountId") REFERENCES "FinanceAccount"("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId","journalId") REFERENCES "FinanceJournal"("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId","sourceJournalId") REFERENCES "FinanceJournal"("tenantId","legalEntityId",id),
 UNIQUE("tenantId","legalEntityId","economicKey"), UNIQUE("tenantId","legalEntityId","requestKey"), UNIQUE("tenantId","legalEntityId",id)
);
CREATE TABLE "FinanceAllocation" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenantId" uuid NOT NULL, "legalEntityId" uuid NOT NULL, "activityId" uuid, "createdById" text NOT NULL,
 "operationId" uuid NOT NULL UNIQUE, "sourceJournalId" uuid NOT NULL, amount numeric(18,2) NOT NULL CHECK(amount<>0),
 FOREIGN KEY("tenantId","legalEntityId","operationId") REFERENCES "FinanceOperation"("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId","sourceJournalId") REFERENCES "FinanceJournal"("tenantId","legalEntityId",id)
);
CREATE TABLE "FinanceFundMovement" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenantId" uuid NOT NULL, "legalEntityId" uuid NOT NULL, "activityId" uuid, "createdById" text NOT NULL,
 "operationId" uuid NOT NULL, "accountId" uuid NOT NULL, amount numeric(18,2) NOT NULL,
 FOREIGN KEY("tenantId","legalEntityId","operationId") REFERENCES "FinanceOperation"("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId","accountId") REFERENCES "FinanceAccount"("tenantId","legalEntityId",id), UNIQUE("operationId","accountId")
);
CREATE INDEX finance_allocation_source ON "FinanceAllocation"("sourceJournalId");
CREATE INDEX finance_fund_history ON "FinanceFundMovement"("accountId");
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['FinanceIntent','FinanceAccountAccess','FinanceOperation','FinanceAllocation','FinanceFundMovement'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY k3_scope ON %I USING ("tenantId"::text=current_setting(''app.tenant_id'',true) AND "legalEntityId"::text=current_setting(''app.legal_entity_id'',true) AND "activityId" IS NOT DISTINCT FROM nullif(current_setting(''app.activity_id'',true),'''')::uuid AND coalesce(current_setting(''app.user_id'',true),'''')<>'''')',t);
 EXECUTE format('CREATE POLICY k3_write ON %I AS RESTRICTIVE FOR INSERT WITH CHECK (current_user=''pusula_finance_executor'' AND "createdById"=current_setting(''app.user_id'',true) AND pusula_can(''finance.accounts'',"tenantId","legalEntityId","activityId","createdById"))',t);
 IF t NOT IN ('FinanceAccountAccess','FinanceIntent') THEN EXECUTE format('CREATE TRIGGER k3_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION k1_immutable()',t); END IF;
 END LOOP;
END $$;
CREATE POLICY k3_access_read ON "FinanceAccountAccess" AS RESTRICTIVE FOR SELECT USING ("userId"=current_setting('app.user_id',true) OR pusula_can('finance.approve',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY k3_access_delete ON "FinanceAccountAccess" AS RESTRICTIVE FOR DELETE USING (current_user='pusula_finance_executor' AND pusula_can('finance.approve',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY k3_intent_read ON "FinanceIntent" AS RESTRICTIVE FOR SELECT USING ("createdById"=current_setting('app.user_id',true) AND pusula_can('finance.accounts',"tenantId","legalEntityId","activityId","createdById"));
CREATE FUNCTION k3_can_fund(fid uuid,k text,t uuid,e uuid,a uuid,owner_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT public.pusula_can('finance.accounts',t,e,a,owner_id)
 AND public.pusula_can(CASE WHEN k='CASH' THEN 'finance.cash' ELSE 'finance.bank' END,t,e,a,owner_id)
 AND (public.pusula_can('finance.approve',t,e,a,owner_id) OR EXISTS(SELECT 1 FROM public."FinanceAccountAccess" x WHERE x."accountId"=fid AND x."userId"=current_setting('app.user_id',true)));
$$;
CREATE POLICY k3_fund_guard ON "FinanceAccount" AS RESTRICTIVE FOR SELECT USING (kind NOT IN ('CASH','BANK','POS') OR current_user='pusula_finance_executor' OR k3_can_fund(id,kind,"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY k3_post_fund_guard ON "FinancePosting" AS RESTRICTIVE FOR SELECT USING (EXISTS(SELECT 1 FROM "FinanceAccount" a WHERE a.id="accountId"));
CREATE POLICY k3_journal_fund_guard ON "FinanceJournal" AS RESTRICTIVE FOR SELECT USING (EXISTS(SELECT 1 FROM "FinanceAccount" a WHERE a.id="accountId"));
CREATE POLICY k3_operation_read ON "FinanceOperation" AS RESTRICTIVE FOR SELECT USING (current_user='pusula_finance_executor' OR (EXISTS(SELECT 1 FROM "FinanceAccount" a WHERE a.id="accountId") AND ("fundAccountId" IS NULL OR EXISTS(SELECT 1 FROM "FinanceAccount" a WHERE a.id="fundAccountId"))));
CREATE POLICY k3_allocation_read ON "FinanceAllocation" AS RESTRICTIVE FOR SELECT USING (current_user='pusula_finance_executor' OR EXISTS(SELECT 1 FROM "FinanceJournal" j WHERE j.id="sourceJournalId"));
CREATE POLICY k3_movement_read ON "FinanceFundMovement" AS RESTRICTIVE FOR SELECT USING (current_user='pusula_finance_executor' OR EXISTS(SELECT 1 FROM "FinanceAccount" a WHERE a.id="accountId" AND k3_can_fund(a.id,a.kind,a."tenantId",a."legalEntityId",a."activityId",a."createdById")));
GRANT SELECT ON "FinanceIntent","FinanceAccountAccess","FinanceOperation","FinanceAllocation","FinanceFundMovement" TO pusula_runtime;
GRANT SELECT,INSERT ON "FinanceIntent","FinanceAccountAccess","FinanceOperation","FinanceAllocation","FinanceFundMovement" TO pusula_finance_executor;
GRANT DELETE ON "FinanceAccountAccess" TO pusula_finance_executor;
GRANT UPDATE(closed) ON "FinanceIntent" TO pusula_finance_executor;
CREATE POLICY k3_intent_close ON "FinanceIntent" AS RESTRICTIVE FOR UPDATE USING(current_user='pusula_finance_executor' AND "createdById"=current_setting('app.user_id',true)) WITH CHECK(current_user='pusula_finance_executor' AND closed AND "createdById"=current_setting('app.user_id',true));
CREATE TRIGGER k3_intent_no_delete BEFORE DELETE ON "FinanceIntent" FOR EACH ROW EXECUTE FUNCTION k1_immutable();
REVOKE ALL ON FUNCTION k3_can_fund(uuid,text,uuid,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION k3_can_fund(uuid,text,uuid,uuid,uuid,text) TO pusula_runtime,pusula_finance_executor;
CREATE FUNCTION k3_due(source_id uuid) RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM public."FinanceJournal" r WHERE r."reversesId"=j.id) THEN 0::numeric
 ELSE abs((SELECT sum(p.debit-p.credit) FROM public."FinancePosting" p WHERE p."journalId"=j.id AND p."accountId"=j."accountId"))-coalesce((SELECT sum(x.amount) FROM public."FinanceAllocation" x WHERE x."sourceJournalId"=j.id),0) END
 FROM public."FinanceJournal" j WHERE j.id=source_id;
$$;
-- Balance validation retains K1/K2 exact counts, and includes K3 settlement/reversal counts.
CREATE OR REPLACE FUNCTION k1_balanced() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE jid uuid; n int; delta numeric; expected int;
BEGIN
 IF TG_TABLE_NAME='FinanceJournal' THEN jid=NEW.id; ELSE jid=NEW."journalId"; END IF;
 SELECT coalesce(j."postingCount",CASE WHEN j."saleId" IS NOT NULL OR o."saleId" IS NOT NULL THEN 3 ELSE 2 END) INTO expected FROM public."FinanceJournal" j LEFT JOIN public."FinanceJournal" o ON o.id=j."reversesId" WHERE j.id=jid;
 SELECT count(*),sum(debit-credit) INTO n,delta FROM public."FinancePosting" WHERE "journalId"=jid;
 IF n IS DISTINCT FROM expected OR delta IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'FINANCE_UNBALANCED'; END IF;
 IF EXISTS(SELECT 1 FROM public."FinancePosting" p JOIN public."FinanceJournal" j ON j.id=p."journalId" JOIN public."FinanceAccount" a ON a.id=p."accountId" WHERE j.id=jid AND (p."activityId" IS DISTINCT FROM j."activityId" OR a."activityId" IS DISTINCT FROM j."activityId")) THEN RAISE EXCEPTION 'FINANCE_SCOPE_MISMATCH'; END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION k3_command(cmd text,p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t uuid:=nullif(current_setting('app.tenant_id',true),'')::uuid; e uuid:=nullif(current_setting('app.legal_entity_id',true),'')::uuid; a uuid:=nullif(current_setting('app.activity_id',true),'')::uuid; u text:=nullif(current_setting('app.user_id',true),'');
 acct public."FinanceAccount"; fund public."FinanceAccount"; other_fund public."FinanceAccount"; intent public."FinanceIntent"; old public."FinanceOperation"; original public."FinanceOperation"; doc public."FinanceJournal";
 oid uuid:=gen_random_uuid(); jid uuid:=gen_random_uuid(); contra uuid; k uuid; h text; eco text; xref text; amt numeric; fee numeric; d date; due date; available numeric; permission text; mid text; n int; direction numeric;
BEGIN
 IF cmd NOT IN ('INTENT','CLOSE','FUND','ACCESS','OPEN','DEBT','COLLECT','PAY','SETTLE','REVERSE') OR u IS NULL OR t IS NULL OR e IS NULL OR NOT public.pusula_can('finance.accounts',t,e,a,u) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||e::text,1701));
 permission:=CASE cmd WHEN 'COLLECT' THEN 'finance.collect' WHEN 'PAY' THEN 'finance.pay' ELSE 'finance.approve' END;
 IF cmd NOT IN ('INTENT','CLOSE') AND NOT public.pusula_can(permission,t,e,a,u) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
 IF cmd='INTENT' THEN
  permission:=CASE p->>'kind' WHEN 'COLLECT' THEN 'finance.collect' WHEN 'PAY' THEN 'finance.pay' WHEN 'SALE' THEN 'sales.create' ELSE 'finance.approve' END;
  IF NOT public.pusula_can(permission,t,e,a,u) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
  SELECT * INTO intent FROM public."FinanceIntent" WHERE "clientKey"=(p->>'clientKey')::uuid AND "createdById"=u;
  IF intent.id IS NOT NULL THEN IF intent.kind IS DISTINCT FROM p->>'kind' THEN RAISE EXCEPTION 'FINANCE_INTENT_CONFLICT'; END IF; RETURN intent.id; END IF;
  INSERT INTO public."FinanceIntent"("tenantId","legalEntityId","activityId","createdById",kind,"clientKey") VALUES(t,e,a,u,p->>'kind',(p->>'clientKey')::uuid) RETURNING id INTO oid;
 ELSIF cmd='CLOSE' THEN
  SELECT * INTO intent FROM public."FinanceIntent" WHERE id=(p->>'intentId')::uuid AND "createdById"=u;
  IF intent.id IS NULL THEN RAISE EXCEPTION 'FINANCE_INTENT_REJECTED'; END IF;
  IF EXISTS(SELECT 1 FROM public."FinanceOperation" WHERE "intentId"=intent.id) OR EXISTS(SELECT 1 FROM public."FinanceJournal" WHERE "saleSourceKey"='ref:intent:'||intent.id) THEN RAISE EXCEPTION 'FINANCE_ALREADY_COMMITTED'; END IF;
  UPDATE public."FinanceIntent" SET closed=true WHERE id=intent.id; oid:=intent.id;
 ELSIF cmd='FUND' THEN
  IF p->>'kind' NOT IN ('CASH','BANK','POS') OR NOT public.pusula_can(CASE WHEN p->>'kind'='CASH' THEN 'finance.cash' ELSE 'finance.bank' END,t,e,a,u) THEN RAISE EXCEPTION 'FINANCE_FUND_REJECTED'; END IF;
  SELECT id INTO oid FROM public."FinanceAccount" WHERE kind=p->>'kind'; IF oid IS NOT NULL THEN RETURN oid; END IF;
  INSERT INTO public."FinanceAccount"("tenantId","legalEntityId","activityId","createdById",kind,label) VALUES(t,e,a,u,p->>'kind',p->>'label') RETURNING id INTO oid;
 ELSIF cmd='ACCESS' THEN
  SELECT * INTO fund FROM public."FinanceAccount" WHERE id=(p->>'fundAccountId')::uuid AND kind IN ('CASH','BANK','POS');
  IF fund.id IS NULL OR NOT EXISTS(SELECT 1 FROM public."Membership" WHERE "tenantId"=t AND "userId"=p->>'userId' AND status='ACTIVE') THEN RAISE EXCEPTION 'FINANCE_ACCESS_REJECTED'; END IF;
  IF NOT public.pusula_can('finance.approve',t,e,a,fund."createdById") THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
  IF (p->>'grant')::boolean THEN
   INSERT INTO public."FinanceAccountAccess"("tenantId","legalEntityId","activityId","createdById","accountId","userId") VALUES(t,e,a,u,fund.id,p->>'userId') ON CONFLICT("accountId","userId") DO NOTHING;
  ELSE DELETE FROM public."FinanceAccountAccess" WHERE "accountId"=fund.id AND "userId"=p->>'userId'; END IF; oid:=fund.id;
 ELSE
  k:=(p->>'idempotencyKey')::uuid; d:=(p->>'bookedOn')::date; due:=(p->>'dueOn')::date;
  IF k IS NULL OR d IS NULL OR NOT isfinite(d) OR length(trim(p->>'reason')) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'FINANCE_INPUT_REJECTED'; END IF;
  h:=encode(sha256(convert_to(cmd||(p-'idempotencyKey')::text,'UTF8')),'hex');
  IF cmd='REVERSE' THEN
   SELECT * INTO original FROM public."FinanceOperation" WHERE "journalId"=(p->>'journalId')::uuid AND kind<>'REVERSE';
   IF original.id IS NULL OR d<original."bookedOn" THEN RAISE EXCEPTION 'FINANCE_REVERSAL_REJECTED'; END IF;
   SELECT * INTO old FROM public."FinanceOperation" WHERE "reversesId"=original.id;
   IF old.id IS NOT NULL THEN IF NOT public.k3_replay_allowed(old.id) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF; IF old."requestKey"=k AND old."payloadHash"=h THEN RETURN old.id; END IF; RAISE EXCEPTION 'FINANCE_DUPLICATE_SOURCE'; END IF;
   IF coalesce((SELECT sum(amount) FROM public."FinanceAllocation" WHERE "sourceJournalId"=original."journalId"),0)>0 THEN RAISE EXCEPTION 'FINANCE_REVERSE_DEPENDENTS_FIRST'; END IF;
   permission:=CASE original.kind WHEN 'COLLECT' THEN 'finance.collect' WHEN 'PAY' THEN 'finance.pay' WHEN 'DEBT' THEN 'finance.payables' ELSE 'finance.approve' END;
   IF NOT public.pusula_can(permission,t,e,a,u) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
   SELECT * INTO acct FROM public."FinanceAccount" WHERE id=original."accountId";
   SELECT * INTO fund FROM public."FinanceAccount" WHERE id=original."fundAccountId";
   amt:=original.amount; fee:=original.fee; xref:=original."externalRef"; eco:='REVERSE:'||original.id;
  ELSE
   IF p->>'currency' IS DISTINCT FROM 'TRY' OR jsonb_typeof(p->'amount') IS DISTINCT FROM 'string' OR (p->>'amount') !~ '^(0|[1-9][0-9]{0,13})([.][0-9]{1,2})?$' OR jsonb_typeof(p->'fee') IS DISTINCT FROM 'string' OR (p->>'fee') !~ '^(0|[1-9][0-9]{0,13})([.][0-9]{1,2})?$' THEN RAISE EXCEPTION 'FINANCE_AMOUNT_REJECTED'; END IF;
   amt:=(p->>'amount')::numeric; fee:=(p->>'fee')::numeric; xref:=trim(coalesce(p->>'externalRef','')); mid:=p->>'method';
   IF (cmd<>'OPEN' AND amt<=0) OR (cmd<>'SETTLE' AND fee<>0) OR (cmd='SETTLE' AND fee>=amt) OR (due IS NOT NULL AND (NOT isfinite(due) OR due<d)) THEN RAISE EXCEPTION 'FINANCE_AMOUNT_REJECTED'; END IF;
   SELECT * INTO intent FROM public."FinanceIntent" WHERE id=(p->>'intentId')::uuid AND "createdById"=u AND kind=cmd AND NOT closed;
   IF intent.id IS NULL THEN RAISE EXCEPTION 'FINANCE_INTENT_REJECTED'; END IF;
   SELECT * INTO old FROM public."FinanceOperation" WHERE "intentId"=intent.id OR "requestKey"=k;
   IF old.id IS NOT NULL THEN IF NOT public.k3_replay_allowed(old.id) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF; IF old."intentId"=intent.id AND old."payloadHash"=h THEN RETURN old.id; END IF; RAISE EXCEPTION 'FINANCE_IDEMPOTENCY_CONFLICT'; END IF;
   eco:=CASE WHEN xref<>'' THEN cmd||':external:'||xref ELSE cmd||':intent:'||intent.id END;
   IF cmd IN ('OPEN','COLLECT','PAY','SETTLE') THEN SELECT * INTO fund FROM public."FinanceAccount" WHERE id=(p->>'fundAccountId')::uuid AND kind IN ('CASH','BANK','POS'); END IF;
   IF cmd='DEBT' THEN
    IF length(xref)<3 OR NOT public.pusula_can('finance.payables',t,e,a,u) THEN RAISE EXCEPTION 'FINANCE_DEBT_REFERENCE_REQUIRED'; END IF;
    SELECT * INTO acct FROM public."FinanceAccount" WHERE id=(p->>'accountId')::uuid AND kind='SUPPLIER';
    IF acct.id IS NULL THEN RAISE EXCEPTION 'FINANCE_SUPPLIER_REQUIRED'; END IF; eco:='DEBT:'||acct.id||':'||xref;
   ELSIF cmd='OPEN' THEN
    acct:=fund; eco:='OPEN:'||fund.id;
   ELSE
    SELECT * INTO doc FROM public."FinanceJournal" WHERE id=(p->>'sourceJournalId')::uuid AND "reversesId" IS NULL;
    IF doc.id IS NULL OR d<doc."bookedOn" THEN RAISE EXCEPTION 'FINANCE_SOURCE_REJECTED'; END IF;
    SELECT * INTO acct FROM public."FinanceAccount" WHERE id=doc."accountId";
    IF cmd IN ('COLLECT','PAY') AND nullif(p->>'accountId','')::uuid IS NOT NULL AND (p->>'accountId')::uuid<>acct.id THEN RAISE EXCEPTION 'FINANCE_PARTY_MISMATCH'; END IF;
    IF cmd='COLLECT' AND (acct.kind<>'CUSTOMER' OR doc."saleId" IS NULL) THEN RAISE EXCEPTION 'FINANCE_SALE_REQUIRED'; END IF;
    IF cmd='PAY' AND (acct.kind<>'SUPPLIER' OR NOT EXISTS(SELECT 1 FROM public."FinanceOperation" WHERE "journalId"=doc.id AND kind='DEBT') OR NOT public.pusula_can('finance.payables',t,e,a,acct."createdById")) THEN RAISE EXCEPTION 'FINANCE_APPROVED_DEBT_REQUIRED'; END IF;
    IF cmd='SETTLE' THEN
     SELECT * INTO original FROM public."FinanceOperation" WHERE "journalId"=doc.id AND kind='COLLECT' AND method='CARD';
     SELECT * INTO other_fund FROM public."FinanceAccount" WHERE id=original."fundAccountId" AND kind='POS';
     IF original.id IS NULL OR fund.kind<>'BANK' OR other_fund.id IS NULL THEN RAISE EXCEPTION 'FINANCE_POS_REQUIRED'; END IF;
     available:=original.amount-coalesce((SELECT sum(amount) FROM public."FinanceAllocation" WHERE "sourceJournalId"=doc.id),0);
     IF EXISTS(SELECT 1 FROM public."FinanceJournal" WHERE "reversesId"=doc.id) THEN available:=0; END IF;
     acct:=fund;
    ELSE available:=public.k3_due(doc.id); END IF;
    IF available IS NULL OR amt>available THEN RAISE EXCEPTION 'FINANCE_OVER_ALLOCATION'; END IF;
   END IF;
   IF (cmd='SETTLE' OR (cmd IN ('COLLECT','PAY') AND mid='BANK')) AND length(xref)<3 THEN RAISE EXCEPTION 'FINANCE_BANK_REFERENCE_REQUIRED'; END IF;
   IF cmd IN ('COLLECT','PAY') AND (mid IS NULL OR (mid='CASH' AND fund.kind<>'CASH') OR (mid='BANK' AND fund.kind<>'BANK') OR (mid='CARD' AND (cmd<>'COLLECT' OR fund.kind<>'POS' OR coalesce((p->>'terminalApproved')::boolean,false)=false OR length(xref)<3))) THEN RAISE EXCEPTION 'FINANCE_METHOD_REJECTED'; END IF;
  END IF;
  IF acct.id IS NULL OR NOT public.pusula_can('finance.accounts',t,e,a,acct."createdById") THEN RAISE EXCEPTION 'FINANCE_ACCOUNT_REJECTED'; END IF;
  IF NOT public.pusula_can(permission,t,e,a,acct."createdById") OR (doc.id IS NOT NULL AND NOT public.pusula_can(permission,t,e,a,doc."createdById")) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
  IF cmd='DEBT' AND NOT public.pusula_can('finance.payables',t,e,a,acct."createdById") THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
  IF cmd='REVERSE' AND (NOT public.pusula_can('finance.approve',t,e,a,acct."createdById") OR NOT public.pusula_can('finance.approve',t,e,a,original."createdById")) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
  IF (cmd NOT IN ('DEBT','REVERSE') OR (cmd='REVERSE' AND original."fundAccountId" IS NOT NULL)) AND (fund.id IS NULL OR NOT public.k3_can_fund(fund.id,fund.kind,t,e,a,fund."createdById")) THEN RAISE EXCEPTION 'FINANCE_FUND_FORBIDDEN'; END IF;
  IF cmd='SETTLE' AND NOT public.k3_can_fund(other_fund.id,other_fund.kind,t,e,a,other_fund."createdById") THEN RAISE EXCEPTION 'FINANCE_FUND_FORBIDDEN'; END IF;
  IF cmd='REVERSE' THEN
   -- Every affected fund must be assigned/authorized, not only the primary account.
   FOR contra IN SELECT m."accountId" FROM public."FinanceFundMovement" m WHERE m."operationId"=original.id LOOP
    SELECT * INTO other_fund FROM public."FinanceAccount" WHERE id=contra;
    IF NOT public.k3_can_fund(other_fund.id,other_fund.kind,t,e,a,other_fund."createdById") THEN RAISE EXCEPTION 'FINANCE_FUND_FORBIDDEN'; END IF;
   END LOOP;
  END IF;
  INSERT INTO public."FinanceJournal"(id,"tenantId","legalEntityId","activityId","createdById","accountId","sourceKey","requestKey","payloadHash","bookedOn","dueOn",reason,"reversesId","postingCount")
  VALUES(jid,t,e,a,u,acct.id,'K3:'||eco,k,h,d,due,p->>'reason',CASE WHEN cmd='REVERSE' THEN original."journalId" END,CASE WHEN cmd='SETTLE' THEN 3 WHEN cmd='REVERSE' THEN (SELECT count(*) FROM public."FinancePosting" WHERE "journalId"=original."journalId") ELSE 2 END);
  INSERT INTO public."FinanceOperation"(id,"tenantId","legalEntityId","activityId","createdById",kind,"intentId","requestKey","payloadHash","economicKey","journalId","accountId","fundAccountId","sourceJournalId",amount,fee,"externalRef",method,"terminalApproved","bookedOn","dueOn",reason,"reversesId")
  VALUES(oid,t,e,a,u,cmd,CASE WHEN cmd<>'REVERSE' THEN intent.id END,k,h,eco,jid,acct.id,fund.id,CASE WHEN cmd='REVERSE' THEN original."sourceJournalId" ELSE doc.id END,amt,fee,xref,CASE WHEN cmd='REVERSE' THEN original.method ELSE mid END,coalesce((p->>'terminalApproved')::boolean,false),d,due,p->>'reason',CASE WHEN cmd='REVERSE' THEN original.id END);
  IF cmd IN ('OPEN','DEBT','SETTLE') THEN
   SELECT id INTO contra FROM public."FinanceAccount" WHERE kind=CASE cmd WHEN 'OPEN' THEN 'EQUITY' WHEN 'DEBT' THEN 'PURCHASE' ELSE 'COMMISSION' END;
   IF contra IS NULL THEN INSERT INTO public."FinanceAccount"("tenantId","legalEntityId","activityId","createdById",kind) VALUES(t,e,a,u,CASE cmd WHEN 'OPEN' THEN 'EQUITY' WHEN 'DEBT' THEN 'PURCHASE' ELSE 'COMMISSION' END) RETURNING id INTO contra; END IF;
  END IF;
  IF cmd='REVERSE' THEN
   INSERT INTO public."FinancePosting"("tenantId","legalEntityId","activityId","createdById","journalId","accountId",debit,credit) SELECT t,e,a,u,jid,"accountId",credit,debit FROM public."FinancePosting" WHERE "journalId"=original."journalId";
   INSERT INTO public."FinanceFundMovement"("tenantId","legalEntityId","activityId","createdById","operationId","accountId",amount) SELECT t,e,a,u,oid,"accountId",-amount FROM public."FinanceFundMovement" WHERE "operationId"=original.id;
   INSERT INTO public."FinanceAllocation"("tenantId","legalEntityId","activityId","createdById","operationId","sourceJournalId",amount) SELECT t,e,a,u,oid,"sourceJournalId",-amount FROM public."FinanceAllocation" WHERE "operationId"=original.id;
  ELSIF cmd='SETTLE' THEN
   INSERT INTO public."FinancePosting"("tenantId","legalEntityId","activityId","createdById","journalId","accountId",debit,credit) VALUES(t,e,a,u,jid,fund.id,amt-fee,0),(t,e,a,u,jid,contra,fee,0),(t,e,a,u,jid,other_fund.id,0,amt);
   INSERT INTO public."FinanceFundMovement"("tenantId","legalEntityId","activityId","createdById","operationId","accountId",amount) VALUES(t,e,a,u,oid,fund.id,amt-fee),(t,e,a,u,oid,other_fund.id,-amt);
  ELSE
   direction:=CASE WHEN cmd='PAY' THEN -1 ELSE 1 END;
   INSERT INTO public."FinancePosting"("tenantId","legalEntityId","activityId","createdById","journalId","accountId",debit,credit)
   VALUES(t,e,a,u,jid,CASE WHEN cmd='DEBT' THEN contra ELSE fund.id END,CASE WHEN cmd='PAY' THEN 0 ELSE amt END,CASE WHEN cmd='PAY' THEN amt ELSE 0 END),
         (t,e,a,u,jid,CASE WHEN cmd='OPEN' THEN contra ELSE acct.id END,CASE WHEN cmd='PAY' THEN amt ELSE 0 END,CASE WHEN cmd='PAY' THEN 0 ELSE amt END);
   IF fund.id IS NOT NULL THEN INSERT INTO public."FinanceFundMovement"("tenantId","legalEntityId","activityId","createdById","operationId","accountId",amount) VALUES(t,e,a,u,oid,fund.id,direction*amt); END IF;
  END IF;
  IF cmd IN ('COLLECT','PAY','SETTLE') THEN INSERT INTO public."FinanceAllocation"("tenantId","legalEntityId","activityId","createdById","operationId","sourceJournalId",amount) VALUES(t,e,a,u,oid,doc.id,amt); END IF;
  IF EXISTS(SELECT 1 FROM (SELECT sum(m.amount) OVER(PARTITION BY m."accountId" ORDER BY o."bookedOn",o."createdAt",o.id) running FROM public."FinanceFundMovement" m JOIN public."FinanceOperation" o ON o.id=m."operationId" WHERE m."accountId" IN (SELECT "accountId" FROM public."FinanceFundMovement" WHERE "operationId"=oid)) x WHERE running<0) THEN RAISE EXCEPTION 'FINANCE_INSUFFICIENT_FUNDS'; END IF;
 END IF;
 INSERT INTO public."AuditEvent"(id,"tenantId","legalEntityId","actorId",action,"targetId",summary) VALUES(gen_random_uuid(),t,e,u,'finance.k3.'||lower(cmd),oid::text,'{"changed":true}'::jsonb);
 RETURN oid;
END $$;
CREATE FUNCTION k3_replay_allowed(op_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE o public."FinanceOperation"; f public."FinanceAccount"; fid uuid; action text;
BEGIN
 SELECT * INTO o FROM public."FinanceOperation" WHERE id=op_id;
 SELECT * INTO f FROM public."FinanceAccount" WHERE id=o."accountId";
 IF f.id IS NULL OR NOT public.pusula_can('finance.accounts',f."tenantId",f."legalEntityId",f."activityId",f."createdById") THEN RETURN false; END IF;
 action:=CASE o.kind WHEN 'COLLECT' THEN 'finance.collect' WHEN 'PAY' THEN 'finance.pay' ELSE 'finance.approve' END;
 IF NOT public.pusula_can(action,f."tenantId",f."legalEntityId",f."activityId",f."createdById") THEN RETURN false; END IF;
 IF o."sourceJournalId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public."FinanceJournal" j WHERE j.id=o."sourceJournalId" AND public.pusula_can(action,j."tenantId",j."legalEntityId",j."activityId",j."createdById")) THEN RETURN false; END IF;
 FOR fid IN SELECT m."accountId" FROM public."FinanceFundMovement" m WHERE m."operationId"=op_id LOOP
  SELECT * INTO f FROM public."FinanceAccount" WHERE id=fid;
  IF f.id IS NULL OR NOT public.k3_can_fund(f.id,f.kind,f."tenantId",f."legalEntityId",f."activityId",f."createdById") THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
CREATE FUNCTION k3_outcome(target uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE i public."FinanceIntent"; o public."FinanceOperation"; result jsonb;
BEGIN
 SELECT * INTO i FROM public."FinanceIntent" WHERE id=target AND "createdById"=current_setting('app.user_id',true);
 IF i.id IS NULL THEN RETURN NULL; END IF;
 IF i.closed THEN RETURN jsonb_build_object('state','CANCELLED','intentId',i.id); END IF;
 SELECT * INTO o FROM public."FinanceOperation" WHERE "intentId"=i.id;
 IF o.id IS NOT NULL THEN
  IF NOT public.k3_replay_allowed(o.id) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
  RETURN jsonb_build_object('state','SUCCEEDED','id',o.id,'journalId',o."journalId",'kind',o.kind);
 END IF;
 IF i.kind='SALE' THEN
  IF NOT public.pusula_can('sales.view',i."tenantId",i."legalEntityId",i."activityId",i."createdById") THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
  SELECT jsonb_build_object('state','SUCCEEDED','id',"saleId",'journalId',id,'kind','SALE') INTO result FROM public."FinanceJournal" WHERE "saleSourceKey"='ref:intent:'||i.id;
 END IF;
 RETURN coalesce(result,jsonb_build_object('state','NOT_COMMITTED','intentId',i.id));
END $$;
REVOKE ALL ON FUNCTION k3_replay_allowed(uuid),k3_outcome(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION k3_replay_allowed(uuid) TO pusula_finance_executor;


GRANT EXECUTE ON FUNCTION k3_outcome(uuid) TO pusula_runtime;

-- Definer entry points validate action/party/fund before any insertion. Runtime remains SELECT/EXECUTE only.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['FinanceAccount','FinanceJournal','FinancePosting'] LOOP
 EXECUTE format('DROP POLICY finance_insert ON %I',t);
 EXECUTE format('CREATE POLICY finance_insert ON %I AS RESTRICTIVE FOR INSERT WITH CHECK (current_user=''pusula_finance_executor'' AND "createdById"=current_setting(''app.user_id'',true) AND pusula_can(''finance.accounts'',"tenantId","legalEntityId","activityId","createdById") AND (pusula_can(''finance.approve'',"tenantId","legalEntityId","activityId","createdById") OR pusula_can(''finance.collect'',"tenantId","legalEntityId","activityId","createdById") OR pusula_can(''finance.pay'',"tenantId","legalEntityId","activityId","createdById")))',t);
 END LOOP;
END $$;
CREATE FUNCTION k3_integrity() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public."FinanceFundMovement" m JOIN public."FinanceAccount" a ON a.id=m."accountId" WHERE m."operationId"=NEW.id AND (m."activityId" IS DISTINCT FROM NEW."activityId" OR a."activityId" IS DISTINCT FROM NEW."activityId" OR m.amount IS DISTINCT FROM (SELECT sum(p.debit-p.credit) FROM public."FinancePosting" p WHERE p."journalId"=NEW."journalId" AND p."accountId"=m."accountId"))) THEN RAISE EXCEPTION 'FINANCE_MOVEMENT_MISMATCH'; END IF;
 IF EXISTS(SELECT 1 FROM public."FinancePosting" p JOIN public."FinanceAccount" a ON a.id=p."accountId" WHERE p."journalId"=NEW."journalId" AND a.kind IN ('CASH','BANK','POS') AND NOT EXISTS(SELECT 1 FROM public."FinanceFundMovement" m WHERE m."operationId"=NEW.id AND m."accountId"=a.id)) THEN RAISE EXCEPTION 'FINANCE_MOVEMENT_REQUIRED'; END IF;
 IF NEW.kind IN ('COLLECT','PAY','SETTLE') AND NOT EXISTS(SELECT 1 FROM public."FinanceAllocation" x WHERE x."operationId"=NEW.id AND x."sourceJournalId"=NEW."sourceJournalId" AND x.amount=NEW.amount AND x."activityId" IS NOT DISTINCT FROM NEW."activityId") THEN RAISE EXCEPTION 'FINANCE_ALLOCATION_REQUIRED'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER k3_atomic AFTER INSERT ON "FinanceOperation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION k3_integrity();
-- K1/K2 remain the implementations for their existing commands. Prevent bypass of K3 allocation/reversal guards.
ALTER FUNCTION k1_command(text,jsonb) RENAME TO k1_command_impl;
REVOKE ALL ON FUNCTION k1_command_impl(text,jsonb) FROM PUBLIC,pusula_runtime;
CREATE FUNCTION k1_command(cmd text,p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result uuid; t uuid:=nullif(current_setting('app.tenant_id',true),'')::uuid; e uuid:=nullif(current_setting('app.legal_entity_id',true),'')::uuid;
BEGIN
 IF cmd='REVERSE' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(t::text||e::text,1701));
  IF EXISTS(SELECT 1 FROM public."FinanceOperation" WHERE "journalId"=(p->>'journalId')::uuid) THEN
   result:=public.k3_command('REVERSE',p); RETURN (SELECT "journalId" FROM public."FinanceOperation" WHERE id=result);
  END IF;
  IF coalesce((SELECT sum(amount) FROM public."FinanceAllocation" WHERE "sourceJournalId"=(p->>'journalId')::uuid),0)>0 THEN RAISE EXCEPTION 'FINANCE_REVERSE_DEPENDENTS_FIRST'; END IF;
 END IF;
 RETURN public.k1_command_impl(cmd,p);
END $$;
-- Validate server-issued sales references without changing the K2 posting/pricing implementation.
ALTER FUNCTION k2_post_sale(uuid,text) RENAME TO k2_post_sale_impl;
REVOKE ALL ON FUNCTION k2_post_sale_impl(uuid,text) FROM PUBLIC,pusula_runtime;
CREATE FUNCTION k2_post_sale(sid uuid,source_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE iid uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(current_setting('app.tenant_id',true)||current_setting('app.legal_entity_id',true),1701));
 IF source_key LIKE 'ref:intent:%' THEN
  iid:=substring(source_key from 12)::uuid;
  IF NOT EXISTS(SELECT 1 FROM public."FinanceIntent" WHERE id=iid AND kind='SALE' AND NOT closed AND "createdById"=current_setting('app.user_id',true)) THEN RAISE EXCEPTION 'FINANCE_INTENT_REJECTED'; END IF;
 END IF;
 RETURN public.k2_post_sale_impl(sid,source_key);
END $$;
CREATE FUNCTION k3_read(view_name text, target uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb; t uuid:=nullif(current_setting('app.tenant_id',true),'')::uuid; e uuid:=nullif(current_setting('app.legal_entity_id',true),'')::uuid; a uuid:=nullif(current_setting('app.activity_id',true),'')::uuid; u text:=nullif(current_setting('app.user_id',true),'');
BEGIN
 IF NOT public.pusula_can('finance.accounts',t,e,a,u) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
 IF view_name='OUTCOME' THEN RETURN public.k3_outcome(target);
 ELSIF view_name='FUNDS' THEN
  SELECT coalesce(jsonb_agg(v ORDER BY v->>'kind'),'[]') INTO result FROM (
   SELECT jsonb_build_object('id',f.id,'kind',f.kind,'label',f.label,'currency',f.currency,'balance',coalesce((SELECT sum(m.amount) FROM public."FinanceFundMovement" m WHERE m."accountId"=f.id),0)::text,
    'movements',coalesce((SELECT jsonb_agg(z ORDER BY z->>'bookedOn',z->>'id') FROM (SELECT jsonb_build_object('id',m.id,'operationId',o.id,'journalId',o."journalId",'bookedOn',o."bookedOn"::text,'kind',o.kind,'amount',m.amount::text,'reference',o."externalRef") z FROM public."FinanceFundMovement" m JOIN public."FinanceOperation" o ON o.id=m."operationId" WHERE m."accountId"=f.id ORDER BY o."bookedOn" DESC,o.id LIMIT 200) q),'[]')) v
   FROM public."FinanceAccount" f WHERE f.kind IN ('CASH','BANK','POS') AND (target IS NULL OR f.id=target) AND public.k3_can_fund(f.id,f.kind,f."tenantId",f."legalEntityId",f."activityId",f."createdById")
  ) q; RETURN result;
 ELSIF view_name IN ('RECEIVABLES','PAYABLES') THEN
  IF view_name='PAYABLES' AND NOT public.pusula_can('finance.payables',t,e,a,u) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
  SELECT coalesce(jsonb_agg(v),'[]') INTO result FROM (
   SELECT jsonb_build_object('journalId',j.id,'saleId',j."saleId",'accountId',f.id,'partyId',coalesce(f."customerId",f."supplierId"),'kind',f.kind,'bookedOn',j."bookedOn"::text,'dueOn',j."dueOn"::text,
    'gross',abs((SELECT sum(p.debit-p.credit) FROM public."FinancePosting" p WHERE p."journalId"=j.id AND p."accountId"=f.id))::text,'outstanding',public.k3_due(j.id)::text) v
   FROM public."FinanceJournal" j JOIN public."FinanceAccount" f ON f.id=j."accountId"
   WHERE j."reversesId" IS NULL AND ((view_name='RECEIVABLES' AND f.kind='CUSTOMER' AND j."saleId" IS NOT NULL) OR (view_name='PAYABLES' AND f.kind='SUPPLIER' AND EXISTS(SELECT 1 FROM public."FinanceOperation" o WHERE o."journalId"=j.id AND o.kind='DEBT')))
   ORDER BY j."bookedOn",j.id LIMIT 201
  ) q;
  IF jsonb_array_length(result)>200 THEN RAISE EXCEPTION 'FINANCE_RESULT_LIMIT'; END IF; RETURN result;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION k3_command(text,jsonb),k3_read(text,uuid),k3_due(uuid),k3_integrity(),k1_command(text,jsonb),k2_post_sale(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION k3_due(uuid),k3_integrity() TO pusula_finance_executor;
GRANT EXECUTE ON FUNCTION k3_due(uuid) TO pusula_runtime;




REVOKE ALL ON FUNCTION k3_command(text,jsonb),k1_command(text,jsonb),k2_post_sale(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION k3_command(text,jsonb),k1_command(text,jsonb),k2_post_sale(uuid,text) TO pusula_runtime;

GRANT EXECUTE ON FUNCTION k3_read(text,uuid) TO pusula_runtime,pusula_finance_executor;

-- Source k4-local-schema.sql SHA256 1aff40b98951a6edb7946792547e04d6dfaa1013e051539d9ed671b4f99b651a
-- K4 LOCAL ONLY. Successor to 001-016 + K1/K2/K3 preparation; no migration history write.
SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s';

ALTER TABLE "FinanceAccount" DROP CONSTRAINT "FinanceAccount_kind_check";
ALTER TABLE "FinanceAccount" ADD CHECK(kind IN ('CUSTOMER','SUPPLIER','EQUITY','REVENUE','VAT','CASH','BANK','POS','PURCHASE','COMMISSION','EXPENSE','INPUT_VAT'));
ALTER TABLE "FinanceIntent" DROP CONSTRAINT "FinanceIntent_kind_check";
ALTER TABLE "FinanceIntent" ADD CHECK(kind IN ('SALE','OPEN','DEBT','COLLECT','PAY','SETTLE','EXPENSE'));
ALTER TABLE "FinanceOperation" DROP CONSTRAINT "FinanceOperation_kind_check";
ALTER TABLE "FinanceOperation" ADD CHECK(kind IN ('OPEN','DEBT','COLLECT','PAY','SETTLE','REVERSE','EXPENSE'));
CREATE TABLE "FinanceExpense" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "tenantId" uuid NOT NULL, "legalEntityId" uuid NOT NULL, "activityId" uuid, "createdById" text NOT NULL,
 "operationId" uuid NOT NULL UNIQUE, "journalId" uuid NOT NULL UNIQUE, "supplierId" uuid,
 category text NOT NULL CHECK(category IN ('RENT','ELECTRICITY','STAFF','TRANSPORT','MAINTENANCE','CONSUMABLES','INSTALLATION','OTHER')),
 description varchar(500) NOT NULL CHECK(length(trim(description))>=3), "documentRef" varchar(200) NOT NULL CHECK(length(trim("documentRef"))>=3),
 "bookedOn" date NOT NULL, "dueOn" date, net numeric(18,2) NOT NULL CHECK(net>0), vat numeric(18,2) NOT NULL CHECK(vat>=0),
 payment text NOT NULL CHECK(payment IN ('CASH','BANK','CREDIT')), "createdAt" timestamptz NOT NULL DEFAULT now(),
 CHECK("dueOn" IS NULL OR "dueOn">="bookedOn"), CHECK(payment<>'CREDIT' OR ("supplierId" IS NOT NULL AND "dueOn" IS NOT NULL)),
 FOREIGN KEY("tenantId","legalEntityId","operationId") REFERENCES "FinanceOperation"("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId","journalId") REFERENCES "FinanceJournal"("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId","supplierId") REFERENCES "Supplier"("tenantId","legalEntityId",id),
 UNIQUE NULLS NOT DISTINCT("tenantId","legalEntityId","supplierId","documentRef")
);
CREATE INDEX k4_expense_date ON "FinanceExpense"("tenantId","legalEntityId","activityId","bookedOn");
ALTER TABLE "FinanceExpense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinanceExpense" FORCE ROW LEVEL SECURITY;
CREATE POLICY k4_scope ON "FinanceExpense" USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND "activityId" IS NOT DISTINCT FROM nullif(current_setting('app.activity_id',true),'')::uuid AND coalesce(current_setting('app.user_id',true),'')<>'');
CREATE POLICY k4_read ON "FinanceExpense" AS RESTRICTIVE FOR SELECT USING(pusula_can('finance.accounts',"tenantId","legalEntityId","activityId","createdById") AND pusula_can('finance.payables',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY k4_insert ON "FinanceExpense" AS RESTRICTIVE FOR INSERT WITH CHECK(current_user='pusula_finance_executor' AND "createdById"=current_setting('app.user_id',true) AND pusula_can('finance.approve',"tenantId","legalEntityId","activityId","createdById") AND pusula_can('finance.payables',"tenantId","legalEntityId","activityId","createdById"));
CREATE TRIGGER k4_immutable BEFORE UPDATE OR DELETE ON "FinanceExpense" FOR EACH ROW EXECUTE FUNCTION k1_immutable();
GRANT SELECT ON "FinanceExpense" TO pusula_runtime;
GRANT SELECT,INSERT ON "FinanceExpense" TO pusula_finance_executor;
-- Extend only the accepted debt-source predicate; retain the entire K3 payment/locking engine.
DO $$ DECLARE body text; BEGIN
 body:=pg_get_functiondef('k3_command(text,jsonb)'::regprocedure);
 IF position('AND kind=''DEBT''' in body)=0 THEN RAISE EXCEPTION 'K4_K3_SOURCE_DRIFT'; END IF;
 body:=replace(body,'AND kind=''DEBT''','AND kind IN (''DEBT'',''EXPENSE'')');
 body:=replace(body,'WHEN ''DEBT'' THEN ''finance.payables''','WHEN ''EXPENSE'' THEN ''finance.payables'' WHEN ''DEBT'' THEN ''finance.payables''');
 body:=replace(body,'IF intent.id IS NULL THEN RAISE EXCEPTION ''FINANCE_INTENT_REJECTED''; END IF;',
   'IF intent.id IS NULL THEN RAISE EXCEPTION ''FINANCE_INTENT_REJECTED''; END IF; IF intent.kind=''EXPENSE'' AND NOT public.pusula_can(''finance.payables'',t,e,a,intent."createdById") THEN RAISE EXCEPTION ''FINANCE_FORBIDDEN''; END IF;');
 EXECUTE body;
 body:=pg_get_functiondef('k3_outcome(uuid)'::regprocedure);
 EXECUTE replace(body,'IF i.id IS NULL THEN RETURN NULL; END IF;',
   'IF i.id IS NULL THEN RETURN NULL; END IF; IF i.kind=''EXPENSE'' AND NOT public.pusula_can(''finance.payables'',i."tenantId",i."legalEntityId",i."activityId",i."createdById") THEN RAISE EXCEPTION ''FINANCE_FORBIDDEN''; END IF;');
 body:=pg_get_functiondef('k3_replay_allowed(uuid)'::regprocedure);
 EXECUTE replace(body,'WHEN ''PAY'' THEN ''finance.pay''','WHEN ''EXPENSE'' THEN ''finance.payables'' WHEN ''PAY'' THEN ''finance.pay''');
 body:=pg_get_functiondef('k3_read(text,uuid)'::regprocedure);
 IF position('AND o.kind=''DEBT''' in body)=0 THEN RAISE EXCEPTION 'K4_K3_READ_DRIFT'; END IF;
 EXECUTE replace(body,'AND o.kind=''DEBT''','AND o.kind IN (''DEBT'',''EXPENSE'')');
 -- The party opening endpoint must not bypass K3 fund movements or book revenue/expense.
 body:=pg_get_functiondef('k1_command(text,jsonb)'::regprocedure);
 EXECUTE replace(body,'IF cmd=''REVERSE'' THEN',
   'IF cmd=''OPENING'' AND NOT EXISTS(SELECT 1 FROM public."FinanceAccount" WHERE id=(p->>''accountId'')::uuid AND kind IN (''CUSTOMER'',''SUPPLIER'')) THEN RAISE EXCEPTION ''FINANCE_PARTY_OPENING_REQUIRED''; END IF; IF cmd=''REVERSE'' THEN');
END $$;
CREATE FUNCTION k4_expense(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t uuid:=nullif(current_setting('app.tenant_id',true),'')::uuid; e uuid:=nullif(current_setting('app.legal_entity_id',true),'')::uuid; a uuid:=nullif(current_setting('app.activity_id',true),'')::uuid; u text:=nullif(current_setting('app.user_id',true),'');
 i public."FinanceIntent"; old public."FinanceOperation"; acct public."FinanceAccount"; supplier public."Supplier"; expid uuid; vatid uuid; jid uuid:=gen_random_uuid(); oid uuid:=gen_random_uuid();
 h text; k uuid; d date; due date; n numeric; v numeric; gross numeric; sid uuid; mode text:=p->>'payment';
BEGIN
 IF u IS NULL OR t IS NULL OR e IS NULL OR NOT public.pusula_can('finance.accounts',t,e,a,u) OR NOT public.pusula_can('finance.approve',t,e,a,u) OR NOT public.pusula_can('finance.payables',t,e,a,u) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||e::text,1701));
 IF p->>'legalEntityId' IS DISTINCT FROM e::text OR nullif(p->>'activityId','')::uuid IS DISTINCT FROM a OR p->>'currency' IS DISTINCT FROM 'TRY' OR mode IS NULL OR mode NOT IN ('CASH','BANK','CREDIT') THEN RAISE EXCEPTION 'FINANCE_SCOPE_MISMATCH'; END IF;
 IF jsonb_typeof(p->'net') IS DISTINCT FROM 'string' OR (p->>'net') !~ '^(0|[1-9][0-9]{0,13})([.][0-9]{1,2})?$' OR jsonb_typeof(p->'vat') IS DISTINCT FROM 'string' OR (p->>'vat') !~ '^(0|[1-9][0-9]{0,13})([.][0-9]{1,2})?$' THEN RAISE EXCEPTION 'FINANCE_AMOUNT_REJECTED'; END IF;
 n:=(p->>'net')::numeric; v:=(p->>'vat')::numeric; gross:=n+v; k:=(p->>'idempotencyKey')::uuid; d:=(p->>'bookedOn')::date; due:=(p->>'dueOn')::date; sid:=(p->>'supplierId')::uuid;
 IF n<=0 OR gross>99999999999999.99 OR k IS NULL OR d IS NULL OR NOT isfinite(d) OR (p->>'bookedOn') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR (due IS NOT NULL AND (NOT isfinite(due) OR due<d)) THEN RAISE EXCEPTION 'FINANCE_INPUT_REJECTED'; END IF;
 SELECT * INTO i FROM public."FinanceIntent" WHERE id=(p->>'intentId')::uuid AND kind='EXPENSE' AND "createdById"=u AND NOT closed;
 IF i.id IS NULL THEN RAISE EXCEPTION 'FINANCE_INTENT_REJECTED'; END IF;
 h:=encode(sha256(convert_to((p-'idempotencyKey')::text,'UTF8')),'hex');
 SELECT * INTO old FROM public."FinanceOperation" WHERE "intentId"=i.id OR "requestKey"=k;
 IF old.id IS NOT NULL THEN
  IF NOT public.k3_replay_allowed(old.id) THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
  IF old."intentId"=i.id AND old."payloadHash"=h THEN RETURN old.id; END IF; RAISE EXCEPTION 'FINANCE_IDEMPOTENCY_CONFLICT';
 END IF;
 IF sid IS NOT NULL THEN
  SELECT * INTO supplier FROM public."Supplier" WHERE id=sid AND active AND "activityId" IS NOT DISTINCT FROM a;
  IF supplier.id IS NULL OR NOT public.pusula_can('finance.payables',t,e,a,supplier."createdById") THEN RAISE EXCEPTION 'FINANCE_PARTY_REJECTED'; END IF;
 END IF;
 IF mode='CREDIT' THEN
  IF sid IS NULL OR due IS NULL OR nullif(p->>'fundAccountId','') IS NOT NULL THEN RAISE EXCEPTION 'FINANCE_PARTY_REJECTED'; END IF;
  expid:=public.k1_command('ACCOUNT',jsonb_build_object('kind','SUPPLIER','partyId',sid));
  SELECT * INTO acct FROM public."FinanceAccount" WHERE id=expid;
 ELSE
  SELECT * INTO acct FROM public."FinanceAccount" WHERE id=(p->>'fundAccountId')::uuid AND kind=mode;
  IF acct.id IS NULL OR NOT public.pusula_can('finance.pay',t,e,a,u) OR NOT public.k3_can_fund(acct.id,acct.kind,t,e,a,acct."createdById") THEN RAISE EXCEPTION 'FINANCE_FUND_FORBIDDEN'; END IF;
 END IF;
 IF acct.id IS NULL OR NOT public.pusula_can('finance.approve',t,e,a,acct."createdById") OR NOT public.pusula_can('finance.payables',t,e,a,acct."createdById") THEN RAISE EXCEPTION 'FINANCE_FORBIDDEN'; END IF;
 SELECT id INTO expid FROM public."FinanceAccount" WHERE kind='EXPENSE';
 IF expid IS NULL THEN INSERT INTO public."FinanceAccount"("tenantId","legalEntityId","activityId","createdById",kind) VALUES(t,e,a,u,'EXPENSE') RETURNING id INTO expid; END IF;
 SELECT id INTO vatid FROM public."FinanceAccount" WHERE kind='INPUT_VAT';
 IF vatid IS NULL THEN INSERT INTO public."FinanceAccount"("tenantId","legalEntityId","activityId","createdById",kind) VALUES(t,e,a,u,'INPUT_VAT') RETURNING id INTO vatid; END IF;
 INSERT INTO public."FinanceJournal"(id,"tenantId","legalEntityId","activityId","createdById","accountId","sourceKey","requestKey","payloadHash","bookedOn","dueOn",reason,"postingCount") VALUES(jid,t,e,a,u,acct.id,'EXPENSE:'||i.id,k,h,d,due,p->>'description',3);
 INSERT INTO public."FinanceOperation"(id,"tenantId","legalEntityId","activityId","createdById",kind,"intentId","requestKey","payloadHash","economicKey","journalId","accountId","fundAccountId",amount,fee,"externalRef",method,"terminalApproved","bookedOn","dueOn",reason)
 VALUES(oid,t,e,a,u,'EXPENSE',i.id,k,h,'EXPENSE:'||i.id,jid,acct.id,CASE WHEN mode<>'CREDIT' THEN acct.id END,gross,0,p->>'documentRef',CASE WHEN mode<>'CREDIT' THEN mode END,false,d,due,p->>'description');
 INSERT INTO public."FinanceExpense"("tenantId","legalEntityId","activityId","createdById","operationId","journalId","supplierId",category,description,"documentRef","bookedOn","dueOn",net,vat,payment)
 VALUES(t,e,a,u,oid,jid,sid,p->>'category',p->>'description',trim(p->>'documentRef'),d,due,n,v,mode);
 INSERT INTO public."FinancePosting"("tenantId","legalEntityId","activityId","createdById","journalId","accountId",debit,credit) VALUES(t,e,a,u,jid,expid,n,0),(t,e,a,u,jid,vatid,v,0),(t,e,a,u,jid,acct.id,0,gross);
 IF mode<>'CREDIT' THEN
  INSERT INTO public."FinanceFundMovement"("tenantId","legalEntityId","activityId","createdById","operationId","accountId",amount) VALUES(t,e,a,u,oid,acct.id,-gross);
  IF EXISTS(SELECT 1 FROM (SELECT sum(m.amount) OVER(ORDER BY o."bookedOn",o."createdAt",o.id) running FROM public."FinanceFundMovement" m JOIN public."FinanceOperation" o ON o.id=m."operationId" WHERE m."accountId"=acct.id) x WHERE running<0) THEN RAISE EXCEPTION 'FINANCE_INSUFFICIENT_FUNDS'; END IF;
 END IF;
 INSERT INTO public."AuditEvent"(id,"tenantId","legalEntityId","actorId",action,"targetId",summary) VALUES(gen_random_uuid(),t,e,u,'finance.k4.expense',oid::text,'{"changed":true}'::jsonb);
 RETURN oid;
END $$;
-- Existing outcome/close and reversal commands see EXPENSE as a first-class operation.
-- Guard reads and reversals against payables DENY, including replay after permission changes.
CREATE POLICY k4_operation_guard ON "FinanceOperation" AS RESTRICTIVE FOR SELECT USING(kind<>'EXPENSE' OR pusula_can('finance.payables',"tenantId","legalEntityId","activityId","createdById"));
CREATE FUNCTION k4_integrity() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public."FinanceOperation" o JOIN public."FinanceJournal" j ON j.id=o."journalId" WHERE o.id=NEW."operationId" AND j.id=NEW."journalId" AND o.kind='EXPENSE' AND o.amount=NEW.net+NEW.vat AND j."activityId" IS NOT DISTINCT FROM NEW."activityId" AND o."activityId" IS NOT DISTINCT FROM NEW."activityId" AND j."bookedOn"=NEW."bookedOn") OR
 NOT EXISTS(SELECT 1 FROM public."FinancePosting" p JOIN public."FinanceAccount" a ON a.id=p."accountId" WHERE p."journalId"=NEW."journalId" AND a.kind='EXPENSE' AND p.debit=NEW.net AND p.credit=0) OR
 NOT EXISTS(SELECT 1 FROM public."FinancePosting" p JOIN public."FinanceAccount" a ON a.id=p."accountId" WHERE p."journalId"=NEW."journalId" AND a.kind='INPUT_VAT' AND p.debit=NEW.vat AND p.credit=0) THEN RAISE EXCEPTION 'FINANCE_EXPENSE_MISMATCH'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER k4_atomic AFTER INSERT ON "FinanceExpense" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION k4_integrity();
REVOKE ALL ON FUNCTION k4_expense(jsonb),k4_integrity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION k4_integrity() TO pusula_finance_executor;


REVOKE ALL ON FUNCTION k4_expense(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION k4_expense(jsonb) TO pusula_runtime;


-- All replacements/renames/triggers above run as the table/function creator.
-- Transfer only after final bodies exist; no REPLACE under a former owner.
GRANT CREATE ON SCHEMA public TO pusula_finance_executor;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure::text signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname ~ '^k[1-4]_' LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO pusula_finance_executor', f.signature);
 END LOOP;
END $$;
SET LOCAL ROLE pusula_finance_executor;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure::text signature,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname ~ '^k[1-4]_' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,pusula_runtime,pusula_auth', f.signature);
  IF f.proname IN ('k1_command','k2_post_sale','k3_command','k3_read','k3_due','k3_can_fund','k3_outcome','k4_expense') THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO pusula_runtime', f.signature);
  END IF;
 END LOOP;
END $$;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM pusula_finance_executor;
SET LOCAL ROLE pusula_finance_role_creator;
REVOKE pusula_finance_executor FROM SESSION_USER;
RESET ROLE;
DROP ROLE pusula_finance_role_creator;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['FinanceAccount','FinanceJournal','FinancePosting','FinanceIntent','FinanceAccountAccess','FinanceOperation','FinanceAllocation','FinanceFundMovement','FinanceExpense'] LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public."'||t||'"') AND relrowsecurity AND relforcerowsecurity) OR has_table_privilege('pusula_runtime',to_regclass('public."'||t||'"'),'INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'FINANCE_POST_ACL_REJECTED'; END IF;
 END LOOP;
 IF pg_has_role('pusula_runtime','pusula_finance_executor','MEMBER') THEN RAISE EXCEPTION 'FINANCE_EXECUTOR_MEMBERSHIP_REJECTED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='pusula_finance_executor'::regrole OR member='pusula_finance_executor'::regrole) OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='pusula_finance_role_creator') OR has_schema_privilege('pusula_finance_executor','public','CREATE') THEN RAISE EXCEPTION 'FINANCE_TEMP_AUTHORITY_REMAINS'; END IF;
 IF (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname ~ '^k[1-4]_')<>16 OR EXISTS(
 SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname ~ '^k[1-4]_' AND
 (p.proowner<>'pusula_finance_executor'::regrole OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public'] OR
 p.prosecdef IS DISTINCT FROM (p.proname IN ('k1_command','k1_command_impl','k2_post_sale','k2_post_sale_impl','k3_command','k3_outcome','k4_expense')) OR has_function_privilege('pusula_auth',p.oid,'EXECUTE'))
 ) THEN RAISE EXCEPTION 'FINANCE_FUNCTION_CONTRACT_REJECTED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.pronamespace='public'::regnamespace AND p.proname ~ '^k[1-4]_' AND
 (a.grantor<>'pusula_finance_executor'::regrole OR a.is_grantable OR a.grantee NOT IN ('pusula_finance_executor'::regrole,'pusula_runtime'::regrole) OR
 (a.grantee='pusula_runtime'::regrole AND p.proname NOT IN ('k1_command','k2_post_sale','k3_command','k3_read','k3_due','k3_can_fund','k3_outcome','k4_expense')))) THEN RAISE EXCEPTION 'FINANCE_EXECUTE_ACL_REJECTED'; END IF;

END $$;
COMMIT;
