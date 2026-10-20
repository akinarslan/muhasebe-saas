BEGIN;
-- Server-side limits execute in the Prisma migration session, not its parent.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
SET LOCAL transaction_timeout = '60s';
-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "activityId" UUID,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" UUID NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "supplierId" UUID NOT NULL,
    "businessNo" VARCHAR(30) NOT NULL,
    "revision" INTEGER NOT NULL,
    "revisesOrderId" UUID,
    "status" TEXT NOT NULL,
    "approvedAt" TIMESTAMPTZ(3),
    "approvedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "activityId" UUID,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" UUID NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "supplierMaterialId" UUID NOT NULL,
    "offerVersionId" UUID,
    "variantId" UUID NOT NULL,
    "orderedQty" DECIMAL(24,9) NOT NULL,
    "purchaseUnit" "SupplierUnit" NOT NULL,
    "orderedBaseQty" DECIMAL(24,9) NOT NULL,
    "baseUnit" "SupplierUnit" NOT NULL,
    "conversionSnapshot" JSONB NOT NULL,
    "priceSnapshot" JSONB NOT NULL,
    "expectedDate" DATE,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_scope_key" ON "PurchaseOrder"("tenantId", "legalEntityId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_revision_key" ON "PurchaseOrder"("tenantId", "legalEntityId", "businessNo", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_request_key" ON "PurchaseOrder"("tenantId", "legalEntityId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_line_scope_key" ON "PurchaseOrderLine"("tenantId", "legalEntityId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_line_order_key" ON "PurchaseOrderLine"("tenantId", "legalEntityId", "orderId", "lineNo");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_legalEntityId_supplierId_fkey" FOREIGN KEY ("tenantId", "legalEntityId", "supplierId") REFERENCES "Supplier"("tenantId", "legalEntityId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_legalEntityId_revisesOrde_fkey" FOREIGN KEY ("tenantId", "legalEntityId", "revisesOrderId") REFERENCES "PurchaseOrder"("tenantId", "legalEntityId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_tenantId_legalEntityId_orderId_fkey" FOREIGN KEY ("tenantId", "legalEntityId", "orderId") REFERENCES "PurchaseOrder"("tenantId", "legalEntityId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- V4.3a additive controls; apply only to an explicitly approved isolated target first.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['PurchaseOrder','PurchaseOrderLine'] LOOP
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id) ON DELETE RESTRICT ON UPDATE RESTRICT',t,'v43a_'||t||'_entity');
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id) ON DELETE RESTRICT ON UPDATE RESTRICT',t,'v43a_'||t||'_activity');
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY v43a_scope ON %I USING (NULLIF(current_setting(''app.user_id'',true),'''') IS NOT NULL AND "tenantId"::text=current_setting(''app.tenant_id'',true) AND "legalEntityId"::text=current_setting(''app.legal_entity_id'',true)) WITH CHECK (NULLIF(current_setting(''app.user_id'',true),'''') IS NOT NULL AND "tenantId"::text=current_setting(''app.tenant_id'',true) AND "legalEntityId"::text=current_setting(''app.legal_entity_id'',true))',t);
 END LOOP;
END $$;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT v43a_variant_fk FOREIGN KEY ("tenantId","legalEntityId","variantId") REFERENCES "MaterialVariant"("tenantId","legalEntityId",id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT v43a_link_fk FOREIGN KEY ("tenantId","legalEntityId","supplierMaterialId") REFERENCES "SupplierMaterial"("tenantId","legalEntityId",id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT v43a_offer_fk FOREIGN KEY ("tenantId","legalEntityId","offerVersionId") REFERENCES "SupplierOfferVersion"("tenantId","legalEntityId",id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT v43a_order_values CHECK (
 "status" IN ('DRAFT','APPROVED','CANCELLED','CLOSED') AND revision>0 AND revision<1000000000 AND version>0
 AND ("businessNo" ~ '^PO-[0-9]{4}-[0-9]{4}$')
 AND ("approvedAt" IS NULL OR "approvedById" IS NOT NULL)
 AND (status NOT IN ('APPROVED','CLOSED') OR "approvedAt" IS NOT NULL)
);
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT v43a_line_values CHECK ("lineNo">0 AND "lineNo"<1000000000 AND "orderedQty">0 AND "orderedQty"<1000000000000 AND "orderedBaseQty">0 AND "orderedBaseQty"<1000000000000 AND ("expectedDate" IS NULL OR "expectedDate">=CURRENT_DATE));
CREATE POLICY v43a_order_read ON "PurchaseOrder" AS RESTRICTIVE FOR SELECT USING (pusula_can('purchases.view',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY v43a_order_insert ON "PurchaseOrder" AS RESTRICTIVE FOR INSERT WITH CHECK ("createdById"=current_setting('app.user_id',true) AND status='DRAFT' AND version=1 AND revision=1 AND "revisesOrderId" IS NULL AND "approvedAt" IS NULL AND "approvedById" IS NULL AND pusula_can('purchases.create',"tenantId","legalEntityId","activityId","createdById") AND EXISTS (SELECT 1 FROM "Supplier" s WHERE s.id="supplierId" AND s."tenantId"="PurchaseOrder"."tenantId" AND s."legalEntityId"="PurchaseOrder"."legalEntityId" AND s.active AND pusula_can('suppliers.view',s."tenantId",s."legalEntityId",s."activityId",s."createdById")));
CREATE POLICY v43a_order_update ON "PurchaseOrder" AS RESTRICTIVE FOR UPDATE
 USING (pusula_can('purchases.view',"tenantId","legalEntityId","activityId","createdById"))
 WITH CHECK (pusula_can('purchases.view',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY v43a_line_read ON "PurchaseOrderLine" AS RESTRICTIVE FOR SELECT USING (pusula_can('purchases.view',"tenantId","legalEntityId","activityId","createdById") AND EXISTS(SELECT 1 FROM "PurchaseOrder" o WHERE o.id="orderId" AND o."tenantId"="PurchaseOrderLine"."tenantId" AND o."legalEntityId"="PurchaseOrderLine"."legalEntityId"));
CREATE POLICY v43a_line_insert ON "PurchaseOrderLine" AS RESTRICTIVE FOR INSERT WITH CHECK (
 EXISTS (
  SELECT 1 FROM "PurchaseOrder" o JOIN "Supplier" s ON s.id=o."supplierId" AND s."tenantId"=o."tenantId" AND s."legalEntityId"=o."legalEntityId"
  JOIN "SupplierMaterial" l ON l.id="PurchaseOrderLine"."supplierMaterialId" AND l."tenantId"=o."tenantId" AND l."legalEntityId"=o."legalEntityId"
  JOIN "MaterialVariant" v ON v.id="PurchaseOrderLine"."variantId"
  JOIN "Material" m ON m.id=v."materialId" AND m."tenantId"=v."tenantId" AND m."legalEntityId"=v."legalEntityId"
  WHERE o.id="PurchaseOrderLine"."orderId" AND o."tenantId"="PurchaseOrderLine"."tenantId" AND o."legalEntityId"="PurchaseOrderLine"."legalEntityId"
   AND o."activityId" IS NOT DISTINCT FROM "PurchaseOrderLine"."activityId"
   AND o."createdById"="PurchaseOrderLine"."createdById" AND o.status='DRAFT'
   AND s.active AND l.active AND o."supplierId"=l."supplierId" AND v.active AND m.active
   AND (l."activityId" IS NULL OR l."activityId" IS NOT DISTINCT FROM o."activityId")
   AND (pusula_can('purchases.edit',o."tenantId",o."legalEntityId",o."activityId",o."createdById")
     OR (o.xmin::text=pg_current_xact_id()::text AND o.version=1 AND o."createdById"=current_setting('app.user_id',true)
         AND pusula_can('purchases.create',o."tenantId",o."legalEntityId",o."activityId",o."createdById")))
 )
);
CREATE POLICY v43a_line_delete ON "PurchaseOrderLine" AS RESTRICTIVE FOR DELETE USING (EXISTS (SELECT 1 FROM "PurchaseOrder" o WHERE o.id="orderId" AND o."tenantId"="PurchaseOrderLine"."tenantId" AND o."legalEntityId"="PurchaseOrderLine"."legalEntityId" AND o.status='DRAFT' AND o."createdById"="PurchaseOrderLine"."createdById" AND pusula_can('purchases.edit',o."tenantId",o."legalEntityId",o."activityId",o."createdById")));

CREATE FUNCTION v43a_reject_po_mutation() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$ BEGIN RAISE EXCEPTION 'Purchase orders reject destructive mutation' USING ERRCODE='23514'; END $$;
CREATE TRIGGER v43a_order_no_truncate BEFORE TRUNCATE ON "PurchaseOrder" FOR EACH STATEMENT EXECUTE FUNCTION v43a_reject_po_mutation();
CREATE TRIGGER v43a_line_no_truncate BEFORE TRUNCATE ON "PurchaseOrderLine" FOR EACH STATEMENT EXECUTE FUNCTION v43a_reject_po_mutation();

CREATE FUNCTION v43a_order_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE u text := NULLIF(current_setting('app.user_id',true),'');
BEGIN
 IF ROW(NEW.id,NEW."tenantId",NEW."legalEntityId",NEW."activityId",NEW."createdById",NEW."createdAt",NEW."idempotencyKey",NEW."payloadHash",NEW."supplierId",NEW."businessNo",NEW.revision,NEW."revisesOrderId") IS DISTINCT FROM ROW(OLD.id,OLD."tenantId",OLD."legalEntityId",OLD."activityId",OLD."createdById",OLD."createdAt",OLD."idempotencyKey",OLD."payloadHash",OLD."supplierId",OLD."businessNo",OLD.revision,OLD."revisesOrderId") THEN RAISE EXCEPTION 'Immutable purchase order identity' USING ERRCODE='23514'; END IF;
 IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Immutable identity or stale version' USING ERRCODE='23514'; END IF;
 IF (NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt" OR NEW."approvedById" IS DISTINCT FROM OLD."approvedById") AND NOT (OLD.status='DRAFT' AND NEW.status='APPROVED' AND NEW."approvedAt" IS NOT NULL AND u IS NOT NULL AND NEW."approvedById"=u AND NEW."approvedAt"<=clock_timestamp()) THEN RAISE EXCEPTION 'Immutable approval stamp' USING ERRCODE='23514'; END IF;
 IF NEW.status<>OLD.status AND NOT (
  (OLD.status='DRAFT' AND NEW.status='APPROVED' AND NEW."approvedAt" IS NOT NULL AND u IS NOT NULL AND NEW."approvedById"=u)
  OR (OLD.status='DRAFT' AND NEW.status='CANCELLED' AND NEW."approvedAt" IS NULL AND NEW."approvedById" IS NULL)
  OR (OLD.status='APPROVED' AND NEW.status='CANCELLED')
 ) THEN RAISE EXCEPTION 'Purchase order status transition rejected' USING ERRCODE='23514'; END IF;
 -- Opaque-permission mapping: RLS policies cannot read OLD, so the invoker
 -- trigger enforces that the mapped action is authorized by pusula_can.
 IF OLD.status='DRAFT' AND NEW.status='APPROVED' AND NOT EXISTS (
  SELECT 1 FROM "PurchaseOrderLine" WHERE "orderId"=OLD.id AND "tenantId"=OLD."tenantId" AND "legalEntityId"=OLD."legalEntityId"
 ) THEN RAISE EXCEPTION 'Empty order' USING ERRCODE='23514'; END IF;
 IF NEW.status=OLD.status THEN
  IF OLD.status<>'DRAFT' THEN RAISE EXCEPTION 'Sealed order' USING ERRCODE='23514'; END IF;
  IF NOT pusula_can('purchases.edit',OLD."tenantId",OLD."legalEntityId",OLD."activityId",OLD."createdById") THEN RAISE EXCEPTION 'Purchase order edit rejected' USING ERRCODE='23514'; END IF;
 ELSIF OLD.status='DRAFT' AND NEW.status='APPROVED' THEN
  IF NOT pusula_can('purchases.approve',OLD."tenantId",OLD."legalEntityId",OLD."activityId",OLD."createdById") THEN RAISE EXCEPTION 'Purchase order approval rejected' USING ERRCODE='23514'; END IF;
 ELSIF NEW.status='CANCELLED' AND OLD.status IN ('DRAFT','APPROVED') THEN
  IF NOT pusula_can('purchases.cancel',OLD."tenantId",OLD."legalEntityId",OLD."activityId",OLD."createdById") THEN RAISE EXCEPTION 'Purchase order cancellation rejected' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER v43a_order_guard BEFORE UPDATE ON "PurchaseOrder" FOR EACH ROW EXECUTE FUNCTION v43a_order_guard();

CREATE FUNCTION v43a_line_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE o "PurchaseOrder"%ROWTYPE; l "SupplierMaterial"%ROWTYPE; v "MaterialVariant"%ROWTYPE;
 m "Material"%ROWTYPE; offer "SupplierOfferVersion"%ROWTYPE;
 conv jsonb; p jsonb; fx jsonb; factor numeric; usd numeric; expected_factor numeric;
BEGIN
 IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Immutable lines' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN
  SELECT * INTO o FROM "PurchaseOrder" WHERE id=OLD."orderId" AND "tenantId"=OLD."tenantId" AND "legalEntityId"=OLD."legalEntityId" FOR UPDATE;
  IF NOT FOUND OR o.status<>'DRAFT' THEN RAISE EXCEPTION 'Sealed lines' USING ERRCODE='23514'; END IF;
  RETURN OLD;
 END IF;
 SELECT * INTO o FROM "PurchaseOrder" WHERE id=NEW."orderId" AND "tenantId"=NEW."tenantId" AND "legalEntityId"=NEW."legalEntityId" FOR UPDATE;
 IF NOT FOUND OR o.status<>'DRAFT' OR o."createdById" IS DISTINCT FROM NEW."createdById" OR o."activityId" IS DISTINCT FROM NEW."activityId" THEN
  RAISE EXCEPTION 'Invalid parent' USING ERRCODE='23514'; END IF;
 SELECT * INTO l FROM "SupplierMaterial" WHERE id=NEW."supplierMaterialId" AND "tenantId"=NEW."tenantId" AND "legalEntityId"=NEW."legalEntityId";
 IF NOT FOUND OR l."variantId"<>NEW."variantId" OR l."supplierId"<>o."supplierId" OR (l."activityId" IS NOT NULL AND l."activityId" IS DISTINCT FROM o."activityId") THEN
  RAISE EXCEPTION 'Invalid supplier material' USING ERRCODE='23514'; END IF;
 SELECT * INTO v FROM "MaterialVariant" WHERE id=NEW."variantId" AND "tenantId"=NEW."tenantId" AND "legalEntityId"=NEW."legalEntityId";
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid variant' USING ERRCODE='23514'; END IF;
 SELECT * INTO m FROM "Material" WHERE id=v."materialId" AND "tenantId"=NEW."tenantId" AND "legalEntityId"=NEW."legalEntityId";
 IF NOT FOUND OR NEW."baseUnit"::text<>m.unit::text THEN RAISE EXCEPTION 'Invalid base unit' USING ERRCODE='23514'; END IF;
 conv:=NEW."conversionSnapshot"; p:=NEW."priceSnapshot"; fx:=p->'fxSnapshot';
 IF (jsonb_typeof(conv)='object' AND jsonb_typeof(p)='object' AND conv->>'version'='1' AND p->>'version'='1'
  AND p->>'roundingVersion'='HALF_UP_9' AND conv->>'baseUnit'=NEW."baseUnit"::text
  AND conv->>'supplierId'=o."supplierId"::text AND p->>'purchaseUnit'=NEW."purchaseUnit"::text
  AND jsonb_typeof(conv->'factor')='string' AND conv->>'factor' ~ '^[0-9]+(\.[0-9]{1,9})?$'
  AND p->>'factor'=conv->>'factor' AND jsonb_typeof(p->'originalUnitPrice')='string'
  AND p->>'originalUnitPrice' ~ '^[0-9]+(\.[0-9]{1,9})?$'
  AND p->>'originalCurrency' IN ('USD','TRY','EUR','GBP') AND jsonb_typeof(fx)='object') IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'Invalid snapshot shape' USING ERRCODE='23514'; END IF;
 factor:=(conv->>'factor')::numeric;
 IF factor<=0 OR factor>=1000000000000 OR (p->>'originalUnitPrice')::numeric<=0 OR (p->>'originalUnitPrice')::numeric>=1000000000000
  OR NEW."orderedQty"*factor<>NEW."orderedBaseQty" THEN RAISE EXCEPTION 'Invalid quantity conversion' USING ERRCODE='23514'; END IF;
 IF NEW."offerVersionId" IS NOT NULL THEN
  SELECT * INTO offer FROM "SupplierOfferVersion" WHERE id=NEW."offerVersionId" AND "tenantId"=NEW."tenantId" AND "legalEntityId"=NEW."legalEntityId";
  IF NOT FOUND OR offer."supplierMaterialId"<>l.id OR offer."purchaseUnit"<>NEW."purchaseUnit"
   OR offer."originalCurrency"<>p->>'originalCurrency' OR offer."originalUnitPrice"<>(p->>'originalUnitPrice')::numeric
   OR NEW."orderedQty"<offer."minQty" OR (offer."maxQty" IS NOT NULL AND NEW."orderedQty">=offer."maxQty")
   OR p->>'source'<>'OFFER' OR p->>'offerRevision' IS DISTINCT FROM offer.revision::text
   OR fx IS DISTINCT FROM offer."fxSnapshot" THEN RAISE EXCEPTION 'Invalid offer' USING ERRCODE='23514'; END IF;
  expected_factor:=(offer."conversionSnapshot"->>'factor')::numeric;
 ELSE
  IF p->>'source' IS DISTINCT FROM 'MANUAL' OR p->'offerRevision' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Invalid manual source' USING ERRCODE='23514'; END IF;
  IF NEW."purchaseUnit"::text=m.unit::text THEN expected_factor:=1;
  ELSIF m.roll AND NEW."purchaseUnit"='linear_meter' AND m.unit::text='square_meter' THEN expected_factor:=v."widthCm"/100;
  ELSIF m.roll AND NEW."purchaseUnit"='square_meter' AND m.unit::text='linear_meter' THEN expected_factor:=100/v."widthCm";
  ELSIF NOT m.roll AND NEW."purchaseUnit"='sheet' AND m.unit::text='square_meter' THEN expected_factor:=v."widthCm"*v."lengthCm"/10000;
  ELSE RAISE EXCEPTION 'Invalid conversion unit' USING ERRCODE='23514'; END IF;
 END IF;
 IF expected_factor IS NULL OR factor<>expected_factor THEN RAISE EXCEPTION 'Invalid conversion factor' USING ERRCODE='23514'; END IF;
 IF p->>'originalCurrency'='USD' THEN
  IF fx->>'status' IS DISTINCT FROM 'verified' OR fx->>'source' IS DISTINCT FROM 'identity' THEN RAISE EXCEPTION 'Invalid USD FX' USING ERRCODE='23514'; END IF;
  usd:=(p->>'originalUnitPrice')::numeric;
 ELSIF p->>'originalCurrency'='TRY' AND fx->>'status'='verified' THEN
  IF (fx->>'source'='tcmb' AND fx->>'rateType'='ForexSelling' AND jsonb_typeof(fx->'usdTry')='string'
   AND fx->>'usdTry' ~ '^[0-9]+(\.[0-9]{1,6})?$') IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'Invalid TRY FX' USING ERRCODE='23514'; END IF;
  IF (fx->>'usdTry')::numeric<=0 THEN RAISE EXCEPTION 'Invalid TRY rate' USING ERRCODE='23514'; END IF;
  usd:=round((p->>'originalUnitPrice')::numeric/(fx->>'usdTry')::numeric,9);
 ELSE
  IF fx->>'status' IS DISTINCT FROM 'unavailable' THEN RAISE EXCEPTION 'Unverified currency' USING ERRCODE='23514'; END IF;
  usd:=NULL;
 END IF;
 IF usd IS NULL THEN
  IF NOT (p ?& ARRAY['usdPurchaseUnitPrice','normalizedUsdUnitPrice','lineTotalUsd']) OR
   p->'usdPurchaseUnitPrice'<>'null'::jsonb OR p->'normalizedUsdUnitPrice'<>'null'::jsonb OR p->'lineTotalUsd'<>'null'::jsonb THEN
   RAISE EXCEPTION 'Unverified USD value' USING ERRCODE='23514'; END IF;
 ELSE
  IF (jsonb_typeof(p->'usdPurchaseUnitPrice')='string' AND p->>'usdPurchaseUnitPrice' ~ '^[0-9]+(\.[0-9]{1,9})?$'
   AND jsonb_typeof(p->'normalizedUsdUnitPrice')='string' AND p->>'normalizedUsdUnitPrice' ~ '^[0-9]+(\.[0-9]{1,9})?$'
   AND jsonb_typeof(p->'lineTotalUsd')='string' AND p->>'lineTotalUsd' ~ '^[0-9]+(\.[0-9]{1,9})?$') IS DISTINCT FROM TRUE THEN
   RAISE EXCEPTION 'Invalid money shape' USING ERRCODE='23514'; END IF;
  IF usd<=0 OR usd<>(p->>'usdPurchaseUnitPrice')::numeric OR round(usd/factor,9)<>(p->>'normalizedUsdUnitPrice')::numeric
   OR round(NEW."orderedQty"*usd,9)<>(p->>'lineTotalUsd')::numeric OR round(NEW."orderedQty"*usd,9)>=1000000000000 THEN
   RAISE EXCEPTION 'Invalid money equality' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER v43a_line_guard BEFORE INSERT OR UPDATE OR DELETE ON "PurchaseOrderLine" FOR EACH ROW EXECUTE FUNCTION v43a_line_guard();

REVOKE ALL ON "PurchaseOrder","PurchaseOrderLine" FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON "PurchaseOrder" TO pusula_runtime;
GRANT SELECT,INSERT,DELETE ON "PurchaseOrderLine" TO pusula_runtime;
REVOKE ALL ON FUNCTION v43a_reject_po_mutation(),v43a_order_guard(),v43a_line_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION v43a_reject_po_mutation(),v43a_order_guard(),v43a_line_guard() TO pusula_runtime;
INSERT INTO "Permission"(id,label,module) VALUES
 ('purchases.view','Satın alma siparişi görüntüle','purchases'),('purchases.create','Satın alma siparişi oluştur','purchases'),
 ('purchases.edit','Satın alma taslağını düzenle','purchases'),('purchases.approve','Satın alma siparişini onayla','purchases'),
 ('purchases.cancel','Satın alma siparişini iptal et','purchases'),('purchases.costView','Satın alma maliyetini gör','purchases')
 ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p WHERE r.id='MASTER' AND p.id IN ('purchases.view','purchases.create','purchases.edit','purchases.approve','purchases.cancel','purchases.costView') ON CONFLICT DO NOTHING;
CREATE INDEX "PurchaseOrder_tenantId_legalEntityId_createdAt_idx" ON "PurchaseOrder"("tenantId","legalEntityId","createdAt");
CREATE INDEX "PurchaseOrderLine_tenantId_legalEntityId_variantId_idx" ON "PurchaseOrderLine"("tenantId","legalEntityId","variantId");
COMMIT;
