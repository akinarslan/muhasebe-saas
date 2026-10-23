-- K2 LOCAL PREPARATION ONLY. Apply after local-schema.sql, never through cloud deploy.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_user<>'fixture_admin' OR current_database()<>'pusula_sprint_b_test' OR current_setting('server_version_num')<>'180006' OR inet_server_addr()<>'127.0.0.1'::inet THEN RAISE EXCEPTION 'ACCOUNTING_LOCAL_ONLY'; END IF;
 IF (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>16 THEN RAISE EXCEPTION 'ACCOUNTING_REQUIRES_016'; END IF;
END $$;
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
ALTER FUNCTION k2_post_sale(uuid,text) OWNER TO pusula_finance_executor;
SET LOCAL ROLE pusula_finance_executor;
REVOKE ALL ON FUNCTION k2_post_sale(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION k2_post_sale(uuid,text) TO pusula_test_runtime;
RESET ROLE;
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
COMMIT;
