-- LOCAL PREPARATION ONLY; future 017 requires accepted/applied 016. No second migration history.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_user<>'fixture_admin' OR current_database()<>'pusula_sprint_b_test' OR current_setting('server_version_num')<>'180006' OR inet_server_addr()<>'127.0.0.1'::inet THEN RAISE EXCEPTION 'ACCOUNTING_LOCAL_ONLY'; END IF;
 IF (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)<>16 OR NOT EXISTS(SELECT 1 FROM _prisma_migrations WHERE migration_name='202610210016_goods_receipts' AND checksum='27b2c82d9a2915ca1c32d516e578662f2b778b4d088cf9cf08f39ecfd886a567' AND finished_at IS NOT NULL) THEN RAISE EXCEPTION 'ACCOUNTING_REQUIRES_016'; END IF;
END $$;
CREATE ROLE pusula_finance_executor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
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
ALTER FUNCTION k1_command(text,jsonb) OWNER TO pusula_finance_executor;
SET LOCAL ROLE pusula_finance_executor;
REVOKE ALL ON FUNCTION k1_command(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION k1_command(text,jsonb) TO pusula_test_runtime;
RESET ROLE;
GRANT SELECT ON "FinanceAccount","FinanceJournal","FinancePosting" TO pusula_test_runtime;
COMMIT;
