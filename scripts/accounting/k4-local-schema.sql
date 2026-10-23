-- K4 LOCAL ONLY. Successor to 001-016 + K1/K2/K3 preparation; no migration history write.
BEGIN;
SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_user<>'fixture_admin' OR current_database()<>'pusula_sprint_b_test' OR current_setting('server_version_num')<>'180006' OR inet_server_addr()<>'127.0.0.1'::inet OR to_regprocedure('k3_command(text,jsonb)') IS NULL THEN RAISE EXCEPTION 'ACCOUNTING_LOCAL_ONLY'; END IF;
 IF (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>16 OR NOT EXISTS(SELECT 1 FROM _prisma_migrations WHERE migration_name='202610210016_goods_receipts' AND checksum='27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567' AND finished_at IS NOT NULL) THEN RAISE EXCEPTION 'ACCOUNTING_REQUIRES_016'; END IF;
END $$;
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
GRANT SELECT ON "FinanceExpense" TO pusula_test_runtime;
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
ALTER FUNCTION k4_expense(jsonb) OWNER TO pusula_finance_executor;
SET LOCAL ROLE pusula_finance_executor;
REVOKE ALL ON FUNCTION k4_expense(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION k4_expense(jsonb) TO pusula_test_runtime;
RESET ROLE;
COMMIT;
