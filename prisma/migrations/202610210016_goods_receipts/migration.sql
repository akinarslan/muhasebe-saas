BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SET LOCAL transaction_timeout='60s';
-- A disposable creator prevents a permanent bootstrap ADMIN membership on executor.
-- Both roles and all grants are transactional; no application role is a member.
CREATE ROLE pusula_stock_role_creator NOLOGIN NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT pusula_stock_role_creator TO CURRENT_USER WITH INHERIT FALSE, SET TRUE;
SET LOCAL ROLE pusula_stock_role_creator;
CREATE ROLE pusula_stock_executor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT pusula_stock_executor TO SESSION_USER WITH INHERIT FALSE, SET TRUE;
RESET ROLE;
GRANT USAGE ON SCHEMA public TO pusula_stock_executor;
GRANT EXECUTE ON FUNCTION pusula_can(text,uuid,uuid,uuid,text) TO pusula_stock_executor;
CREATE TABLE "StockLocation" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "tenantId" uuid NOT NULL,
 "legalEntityId" uuid NOT NULL,
 "activityId" uuid,
 "createdById" text NOT NULL,
 "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
 "code" text NOT NULL,
 "name" text NOT NULL,
 "active" boolean NOT NULL DEFAULT true,
 UNIQUE("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id) ON UPDATE RESTRICT ON DELETE RESTRICT,
 FOREIGN KEY("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX "StockLocation_scope_date" ON "StockLocation"("tenantId","legalEntityId","createdAt");
CREATE TABLE "GoodsReceipt" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "tenantId" uuid NOT NULL,
 "legalEntityId" uuid NOT NULL,
 "activityId" uuid,
 "createdById" text NOT NULL,
 "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
 "orderId" uuid NOT NULL,
 "locationId" uuid NOT NULL,
 "receivedAt" date NOT NULL,
 "sourceRef" text NOT NULL DEFAULT '',
 "status" text NOT NULL DEFAULT 'DRAFT',
 "idempotencyKey" uuid NOT NULL,
 "payloadHash" text NOT NULL,
 "version" integer NOT NULL DEFAULT 1,
 "postedAt" timestamptz(3),
 "cancelReason" text,
 UNIQUE("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id) ON UPDATE RESTRICT ON DELETE RESTRICT,
 FOREIGN KEY("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX "GoodsReceipt_scope_date" ON "GoodsReceipt"("tenantId","legalEntityId","createdAt");
CREATE TABLE "GoodsReceiptLine" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "tenantId" uuid NOT NULL,
 "legalEntityId" uuid NOT NULL,
 "activityId" uuid,
 "createdById" text NOT NULL,
 "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
 "receiptId" uuid NOT NULL,
 "orderLineId" uuid NOT NULL,
 "lineNo" integer NOT NULL,
 "receivedQty" numeric(24,9) NOT NULL,
 "rejectedQty" numeric(24,9) NOT NULL DEFAULT 0,
 "rejectionReason" text NOT NULL DEFAULT '',
 UNIQUE("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id) ON UPDATE RESTRICT ON DELETE RESTRICT,
 FOREIGN KEY("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX "GoodsReceiptLine_scope_date" ON "GoodsReceiptLine"("tenantId","legalEntityId","createdAt");
CREATE TABLE "StockLot" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "tenantId" uuid NOT NULL,
 "legalEntityId" uuid NOT NULL,
 "activityId" uuid,
 "createdById" text NOT NULL,
 "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
 "originReceiptLineId" uuid NOT NULL,
 "variantId" uuid NOT NULL,
 "lotCode" text NOT NULL,
 "packageOrdinal" integer NOT NULL DEFAULT 1,
 "form" text NOT NULL,
 "baseUnit" text NOT NULL,
 "initialBaseQty" numeric(24,9) NOT NULL,
 "widthCm" numeric(12,4),
 "initialLengthM" numeric(24,9),
 "sheetHeightCm" numeric(12,4),
 "conversionSnapshot" jsonb NOT NULL,
 "acquisitionSnapshot" jsonb NOT NULL,
 UNIQUE("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id) ON UPDATE RESTRICT ON DELETE RESTRICT,
 FOREIGN KEY("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX "StockLot_scope_date" ON "StockLot"("tenantId","legalEntityId","createdAt");
CREATE TABLE "StockPostingBatch" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "tenantId" uuid NOT NULL,
 "legalEntityId" uuid NOT NULL,
 "activityId" uuid,
 "createdById" text NOT NULL,
 "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
 "receiptId" uuid NOT NULL,
 "kind" text NOT NULL,
 "reversalOfBatchId" uuid,
 "reason" text NOT NULL DEFAULT '',
 UNIQUE("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id) ON UPDATE RESTRICT ON DELETE RESTRICT,
 FOREIGN KEY("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX "StockPostingBatch_scope_date" ON "StockPostingBatch"("tenantId","legalEntityId","createdAt");
CREATE TABLE "StockMovement" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "tenantId" uuid NOT NULL,
 "legalEntityId" uuid NOT NULL,
 "activityId" uuid,
 "createdById" text NOT NULL,
 "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
 "batchId" uuid NOT NULL,
 "receiptLineId" uuid NOT NULL,
 "lotId" uuid NOT NULL,
 "locationId" uuid NOT NULL,
 "variantId" uuid NOT NULL,
 "lineOrdinal" integer NOT NULL,
 "quantityDeltaBase" numeric(24,9) NOT NULL,
 "baseUnit" text NOT NULL,
 "reversesMovementId" uuid,
 UNIQUE("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id) ON UPDATE RESTRICT ON DELETE RESTRICT,
 FOREIGN KEY("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX "StockMovement_scope_date" ON "StockMovement"("tenantId","legalEntityId","createdAt");
CREATE TABLE "StockBalance" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "tenantId" uuid NOT NULL,
 "legalEntityId" uuid NOT NULL,
 "activityId" uuid,
 "createdById" text NOT NULL,
 "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
 "lotId" uuid NOT NULL,
 "locationId" uuid NOT NULL,
 "quantityBase" numeric(24,9) NOT NULL,
 "version" integer NOT NULL DEFAULT 1,
 UNIQUE("tenantId","legalEntityId",id),
 FOREIGN KEY("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id) ON UPDATE RESTRICT ON DELETE RESTRICT,
 FOREIGN KEY("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX "StockBalance_scope_date" ON "StockBalance"("tenantId","legalEntityId","createdAt");
ALTER TABLE "GoodsReceipt" ADD FOREIGN KEY("tenantId","legalEntityId","orderId") REFERENCES "PurchaseOrder"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "GoodsReceipt_orderId_scope" ON "GoodsReceipt"("tenantId","legalEntityId","orderId");
ALTER TABLE "GoodsReceipt" ADD FOREIGN KEY("tenantId","legalEntityId","locationId") REFERENCES "StockLocation"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "GoodsReceipt_locationId_scope" ON "GoodsReceipt"("tenantId","legalEntityId","locationId");
ALTER TABLE "GoodsReceiptLine" ADD FOREIGN KEY("tenantId","legalEntityId","receiptId") REFERENCES "GoodsReceipt"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "GoodsReceiptLine_receiptId_scope" ON "GoodsReceiptLine"("tenantId","legalEntityId","receiptId");
ALTER TABLE "GoodsReceiptLine" ADD FOREIGN KEY("tenantId","legalEntityId","orderLineId") REFERENCES "PurchaseOrderLine"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "GoodsReceiptLine_orderLineId_scope" ON "GoodsReceiptLine"("tenantId","legalEntityId","orderLineId");
ALTER TABLE "StockLot" ADD FOREIGN KEY("tenantId","legalEntityId","originReceiptLineId") REFERENCES "GoodsReceiptLine"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "StockLot_originReceiptLineId_scope" ON "StockLot"("tenantId","legalEntityId","originReceiptLineId");
ALTER TABLE "StockLot" ADD FOREIGN KEY("tenantId","legalEntityId","variantId") REFERENCES "MaterialVariant"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "StockLot_variantId_scope" ON "StockLot"("tenantId","legalEntityId","variantId");
ALTER TABLE "StockPostingBatch" ADD FOREIGN KEY("tenantId","legalEntityId","receiptId") REFERENCES "GoodsReceipt"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "StockPostingBatch_receiptId_scope" ON "StockPostingBatch"("tenantId","legalEntityId","receiptId");
ALTER TABLE "StockPostingBatch" ADD FOREIGN KEY("tenantId","legalEntityId","reversalOfBatchId") REFERENCES "StockPostingBatch"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "StockPostingBatch_reversalOfBatchId_scope" ON "StockPostingBatch"("tenantId","legalEntityId","reversalOfBatchId");
ALTER TABLE "StockMovement" ADD FOREIGN KEY("tenantId","legalEntityId","batchId") REFERENCES "StockPostingBatch"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "StockMovement_batchId_scope" ON "StockMovement"("tenantId","legalEntityId","batchId");
ALTER TABLE "StockMovement" ADD FOREIGN KEY("tenantId","legalEntityId","receiptLineId") REFERENCES "GoodsReceiptLine"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "StockMovement_receiptLineId_scope" ON "StockMovement"("tenantId","legalEntityId","receiptLineId");
ALTER TABLE "StockMovement" ADD FOREIGN KEY("tenantId","legalEntityId","lotId") REFERENCES "StockLot"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "StockMovement_lotId_scope" ON "StockMovement"("tenantId","legalEntityId","lotId");
ALTER TABLE "StockMovement" ADD FOREIGN KEY("tenantId","legalEntityId","locationId") REFERENCES "StockLocation"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "StockMovement_locationId_scope" ON "StockMovement"("tenantId","legalEntityId","locationId");
ALTER TABLE "StockMovement" ADD FOREIGN KEY("tenantId","legalEntityId","variantId") REFERENCES "MaterialVariant"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "StockMovement_variantId_scope" ON "StockMovement"("tenantId","legalEntityId","variantId");
ALTER TABLE "StockMovement" ADD FOREIGN KEY("tenantId","legalEntityId","reversesMovementId") REFERENCES "StockMovement"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "StockMovement_reversesMovementId_scope" ON "StockMovement"("tenantId","legalEntityId","reversesMovementId");
ALTER TABLE "StockBalance" ADD FOREIGN KEY("tenantId","legalEntityId","lotId") REFERENCES "StockLot"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "StockBalance_lotId_scope" ON "StockBalance"("tenantId","legalEntityId","lotId");
ALTER TABLE "StockBalance" ADD FOREIGN KEY("tenantId","legalEntityId","locationId") REFERENCES "StockLocation"("tenantId","legalEntityId",id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX "StockBalance_locationId_scope" ON "StockBalance"("tenantId","legalEntityId","locationId");
CREATE UNIQUE INDEX v43b_location_code ON "StockLocation"("tenantId","legalEntityId",code);
CREATE UNIQUE INDEX v43b_receipt_request ON "GoodsReceipt"("tenantId","legalEntityId","idempotencyKey");
CREATE UNIQUE INDEX v43b_receipt_ordinal ON "GoodsReceiptLine"("receiptId","lineNo");
CREATE UNIQUE INDEX v43b_receipt_line ON "GoodsReceiptLine"("receiptId","orderLineId");
CREATE UNIQUE INDEX v43b_lot_origin ON "StockLot"("originReceiptLineId","packageOrdinal");
CREATE UNIQUE INDEX v43b_lot_code ON "StockLot"("tenantId","legalEntityId","lotCode");
CREATE UNIQUE INDEX v43b_receipt_post ON "StockPostingBatch"("receiptId") WHERE kind='RECEIPT';
CREATE UNIQUE INDEX v43b_batch_reverse ON "StockPostingBatch"("reversalOfBatchId") WHERE "reversalOfBatchId" IS NOT NULL;
CREATE UNIQUE INDEX v43b_movement_ordinal ON "StockMovement"("batchId","lineOrdinal");
CREATE UNIQUE INDEX v43b_balance ON "StockBalance"("lotId","locationId");
ALTER TABLE "GoodsReceipt" ADD CHECK(status IN ('DRAFT','POSTED','CANCELLED') AND version>0 AND (status<>'POSTED' OR "postedAt" IS NOT NULL));
ALTER TABLE "GoodsReceiptLine" ADD CHECK("lineNo">0 AND "receivedQty">0 AND "receivedQty"<>'NaN'::numeric AND "rejectedQty">=0 AND "rejectedQty"<="receivedQty" AND "rejectedQty"<>'NaN'::numeric AND ("rejectedQty"=0 OR length(trim("rejectionReason"))>=3));
ALTER TABLE "StockPostingBatch" ADD CHECK((kind='RECEIPT' AND "reversalOfBatchId" IS NULL) OR (kind='REVERSAL' AND "reversalOfBatchId" IS NOT NULL AND length(trim(reason))>=3));
ALTER TABLE "StockLot" ADD CHECK("initialBaseQty">0 AND "initialBaseQty"<>'NaN'::numeric AND "packageOrdinal"=1 AND ((form='ROLL' AND "baseUnit"='linear_meter' AND "widthCm">0 AND "initialLengthM"="initialBaseQty") OR (form='SHEET' AND "baseUnit"='sheet' AND "initialBaseQty"=trunc("initialBaseQty") AND "widthCm">0 AND "sheetHeightCm">0) OR (form='PIECE' AND "baseUnit"='piece' AND "initialBaseQty"=trunc("initialBaseQty")) OR (form='BULK' AND "baseUnit" IN ('square_meter','kilogram','litre'))));
ALTER TABLE "StockMovement" ADD CHECK("quantityDeltaBase"<>0 AND "quantityDeltaBase"<>'NaN'::numeric);
ALTER TABLE "StockBalance" ADD CHECK("quantityBase">=0 AND "quantityBase"<>'NaN'::numeric AND version>0);
ALTER TABLE "StockLocation" ENABLE ROW LEVEL SECURITY;ALTER TABLE "StockLocation" FORCE ROW LEVEL SECURITY;
CREATE POLICY v43b_scope ON "StockLocation" USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND coalesce(current_setting('app.user_id',true),'')<>'') WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND coalesce(current_setting('app.user_id',true),'')<>'');
CREATE POLICY v43b_read ON "StockLocation" AS RESTRICTIVE FOR SELECT USING (pusula_can('stock.view',"tenantId","legalEntityId","activityId","createdById") OR (current_user='pusula_stock_executor' AND (pusula_can('receipts.create',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.edit',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.post',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.reverse',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.cancel',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('stock.locationsManage',"tenantId","legalEntityId","activityId","createdById"))));
CREATE POLICY v43b_write ON "StockLocation" AS RESTRICTIVE FOR ALL USING (current_user='pusula_stock_executor' OR pusula_can('stock.view',"tenantId","legalEntityId","activityId","createdById")) WITH CHECK (current_user='pusula_stock_executor');
GRANT SELECT ON "StockLocation" TO pusula_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON "StockLocation" TO pusula_stock_executor;
ALTER TABLE "GoodsReceipt" ENABLE ROW LEVEL SECURITY;ALTER TABLE "GoodsReceipt" FORCE ROW LEVEL SECURITY;
CREATE POLICY v43b_scope ON "GoodsReceipt" USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND coalesce(current_setting('app.user_id',true),'')<>'') WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND coalesce(current_setting('app.user_id',true),'')<>'');
CREATE POLICY v43b_read ON "GoodsReceipt" AS RESTRICTIVE FOR SELECT USING ((current_user='pusula_stock_executor' AND "orderId"::text=current_setting('app.stock_order_id',true)) OR pusula_can('receipts.view',"tenantId","legalEntityId","activityId","createdById") OR (current_user='pusula_stock_executor' AND (pusula_can('receipts.create',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.edit',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.post',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.reverse',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.cancel',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('stock.locationsManage',"tenantId","legalEntityId","activityId","createdById"))));
CREATE POLICY v43b_write ON "GoodsReceipt" AS RESTRICTIVE FOR ALL USING (current_user='pusula_stock_executor' OR pusula_can('receipts.view',"tenantId","legalEntityId","activityId","createdById")) WITH CHECK (current_user='pusula_stock_executor');
GRANT SELECT ON "GoodsReceipt" TO pusula_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON "GoodsReceipt" TO pusula_stock_executor;
ALTER TABLE "GoodsReceiptLine" ENABLE ROW LEVEL SECURITY;ALTER TABLE "GoodsReceiptLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY v43b_scope ON "GoodsReceiptLine" USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND coalesce(current_setting('app.user_id',true),'')<>'') WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND coalesce(current_setting('app.user_id',true),'')<>'');
CREATE POLICY v43b_read ON "GoodsReceiptLine" AS RESTRICTIVE FOR SELECT USING ((current_user='pusula_stock_executor' AND EXISTS(SELECT 1 FROM public."GoodsReceipt" h WHERE h.id="receiptId" AND h."orderId"::text=current_setting('app.stock_order_id',true))) OR pusula_can('receipts.view',"tenantId","legalEntityId","activityId","createdById") OR (current_user='pusula_stock_executor' AND (pusula_can('receipts.create',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.edit',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.post',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.reverse',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.cancel',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('stock.locationsManage',"tenantId","legalEntityId","activityId","createdById"))));
CREATE POLICY v43b_write ON "GoodsReceiptLine" AS RESTRICTIVE FOR ALL USING (current_user='pusula_stock_executor' OR pusula_can('receipts.view',"tenantId","legalEntityId","activityId","createdById")) WITH CHECK (current_user='pusula_stock_executor');
GRANT SELECT ON "GoodsReceiptLine" TO pusula_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON "GoodsReceiptLine" TO pusula_stock_executor;
ALTER TABLE "StockLot" ENABLE ROW LEVEL SECURITY;ALTER TABLE "StockLot" FORCE ROW LEVEL SECURITY;
CREATE POLICY v43b_scope ON "StockLot" USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND coalesce(current_setting('app.user_id',true),'')<>'') WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND coalesce(current_setting('app.user_id',true),'')<>'');
CREATE POLICY v43b_read ON "StockLot" AS RESTRICTIVE FOR SELECT USING ((current_user='pusula_stock_executor' AND "variantId"::text=current_setting('app.stock_variant_id',true)) OR pusula_can('stock.view',"tenantId","legalEntityId","activityId","createdById") OR (current_user='pusula_stock_executor' AND (pusula_can('receipts.create',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.edit',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.post',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.reverse',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.cancel',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('stock.locationsManage',"tenantId","legalEntityId","activityId","createdById"))));
CREATE POLICY v43b_write ON "StockLot" AS RESTRICTIVE FOR ALL USING (current_user='pusula_stock_executor' OR pusula_can('stock.view',"tenantId","legalEntityId","activityId","createdById")) WITH CHECK (current_user='pusula_stock_executor');
GRANT SELECT ON "StockLot" TO pusula_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON "StockLot" TO pusula_stock_executor;
ALTER TABLE "StockPostingBatch" ENABLE ROW LEVEL SECURITY;ALTER TABLE "StockPostingBatch" FORCE ROW LEVEL SECURITY;
CREATE POLICY v43b_scope ON "StockPostingBatch" USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND coalesce(current_setting('app.user_id',true),'')<>'') WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND coalesce(current_setting('app.user_id',true),'')<>'');
CREATE POLICY v43b_read ON "StockPostingBatch" AS RESTRICTIVE FOR SELECT USING ((current_user='pusula_stock_executor' AND EXISTS(SELECT 1 FROM public."GoodsReceipt" h WHERE h.id="receiptId" AND h."orderId"::text=current_setting('app.stock_order_id',true))) OR pusula_can('stock.movementsView',"tenantId","legalEntityId","activityId","createdById") OR (current_user='pusula_stock_executor' AND (pusula_can('receipts.create',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.edit',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.post',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.reverse',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.cancel',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('stock.locationsManage',"tenantId","legalEntityId","activityId","createdById"))));
CREATE POLICY v43b_write ON "StockPostingBatch" AS RESTRICTIVE FOR ALL USING (current_user='pusula_stock_executor' OR pusula_can('stock.movementsView',"tenantId","legalEntityId","activityId","createdById")) WITH CHECK (current_user='pusula_stock_executor');
GRANT SELECT ON "StockPostingBatch" TO pusula_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON "StockPostingBatch" TO pusula_stock_executor;
ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;ALTER TABLE "StockMovement" FORCE ROW LEVEL SECURITY;
CREATE POLICY v43b_scope ON "StockMovement" USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND coalesce(current_setting('app.user_id',true),'')<>'') WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND coalesce(current_setting('app.user_id',true),'')<>'');
CREATE POLICY v43b_read ON "StockMovement" AS RESTRICTIVE FOR SELECT USING (pusula_can('stock.movementsView',"tenantId","legalEntityId","activityId","createdById") OR (current_user='pusula_stock_executor' AND (pusula_can('receipts.create',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.edit',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.post',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.reverse',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.cancel',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('stock.locationsManage',"tenantId","legalEntityId","activityId","createdById"))));
CREATE POLICY v43b_write ON "StockMovement" AS RESTRICTIVE FOR ALL USING (current_user='pusula_stock_executor' OR pusula_can('stock.movementsView',"tenantId","legalEntityId","activityId","createdById")) WITH CHECK (current_user='pusula_stock_executor');
GRANT SELECT ON "StockMovement" TO pusula_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON "StockMovement" TO pusula_stock_executor;
ALTER TABLE "StockBalance" ENABLE ROW LEVEL SECURITY;ALTER TABLE "StockBalance" FORCE ROW LEVEL SECURITY;
CREATE POLICY v43b_scope ON "StockBalance" USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND coalesce(current_setting('app.user_id',true),'')<>'') WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND coalesce(current_setting('app.user_id',true),'')<>'');
CREATE POLICY v43b_read ON "StockBalance" AS RESTRICTIVE FOR SELECT USING (pusula_can('stock.view',"tenantId","legalEntityId","activityId","createdById") OR (current_user='pusula_stock_executor' AND (pusula_can('receipts.create',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.edit',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.post',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.reverse',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('receipts.cancel',"tenantId","legalEntityId","activityId","createdById") OR pusula_can('stock.locationsManage',"tenantId","legalEntityId","activityId","createdById"))));
CREATE POLICY v43b_write ON "StockBalance" AS RESTRICTIVE FOR ALL USING (current_user='pusula_stock_executor' OR pusula_can('stock.view',"tenantId","legalEntityId","activityId","createdById")) WITH CHECK (current_user='pusula_stock_executor');
GRANT SELECT ON "StockBalance" TO pusula_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON "StockBalance" TO pusula_stock_executor;
GRANT SELECT ON "Tenant","LegalEntity","Activity","Material","MaterialVariant","Supplier","SupplierMaterial","SupplierOfferVersion","Permission","Role","RolePermission","Membership","RoleAssignment","PermissionScope","UserPermissionOverride" TO pusula_stock_executor;
GRANT SELECT,UPDATE ON "PurchaseOrder","PurchaseOrderLine" TO pusula_stock_executor;
GRANT SELECT,INSERT ON "AuditEvent" TO pusula_stock_executor;
-- No runtime direct DML on receipt/ledger objects and no executor membership.
CREATE FUNCTION v43b_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF current_user<>'pusula_stock_executor' THEN RAISE EXCEPTION 'STOCK_WRITE_GATE' USING ERRCODE='42501'; END IF;
 IF TG_OP='TRUNCATE' OR (TG_TABLE_NAME IN ('StockLot','StockMovement','StockPostingBatch') AND TG_OP<>'INSERT') THEN RAISE EXCEPTION 'STOCK_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='GoodsReceipt' AND TG_OP<>'INSERT' AND (to_jsonb(OLD)->>'status')<>'DRAFT' THEN RAISE EXCEPTION 'RECEIPT_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='GoodsReceiptLine' AND EXISTS(SELECT 1 FROM public."GoodsReceipt" WHERE id=CASE WHEN TG_OP='DELETE' THEN (to_jsonb(OLD)->>'receiptId')::uuid ELSE (to_jsonb(NEW)->>'receiptId')::uuid END AND status<>'DRAFT') THEN RAISE EXCEPTION 'RECEIPT_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
-- Shared net purchase quantity: a full ledger reversal releases the order quantity.
-- Invoker-only helper; execution is private to the stock executor and FORCE RLS applies.
CREATE FUNCTION v43b_net_received(oid uuid) RETURNS TABLE("orderLineId" uuid,accepted numeric) LANGUAGE sql SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT l."orderLineId",sum(l."receivedQty"-l."rejectedQty")
 FROM public."GoodsReceiptLine" l JOIN public."GoodsReceipt" h ON h.id=l."receiptId"
 WHERE h."orderId"=oid AND h.status='POSTED'
 AND NOT EXISTS(SELECT 1 FROM public."StockPostingBatch" b JOIN public."StockPostingBatch" rev ON rev."reversalOfBatchId"=b.id WHERE b."receiptId"=h.id AND b.kind='RECEIPT' AND rev.kind='REVERSAL')
 GROUP BY l."orderLineId"
$$;
REVOKE ALL ON FUNCTION v43b_net_received(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION v43b_net_received(uuid) TO pusula_stock_executor;
CREATE FUNCTION v43b_command(op text, body jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
 t uuid:=nullif(current_setting('app.tenant_id',true),'')::uuid;
 e uuid:=nullif(current_setting('app.legal_entity_id',true),'')::uuid;
 actor text:=nullif(current_setting('app.user_id',true),'');
 a uuid:=nullif(body->>'activityId','')::uuid;
 r public."GoodsReceipt"; p public."PurchaseOrder"; pl public."PurchaseOrderLine"; loc public."StockLocation";
 x jsonb; oldhash text; rid uuid; lid uuid; bid uuid; mid uuid; v public."MaterialVariant"; mat public."Material";
 accepted numeric; total numeric; physical numeric; factor numeric; width numeric; height numeric; base text; physical_form text; cost jsonb; original public."StockPostingBatch"; m public."StockMovement";
BEGIN
 IF actor IS NULL OR t IS NULL OR e IS NULL OR NOT EXISTS(SELECT 1 FROM public."Membership" WHERE "tenantId"=t AND "userId"=actor AND status='ACTIVE') THEN RAISE EXCEPTION 'CONTEXT_REQUIRED' USING ERRCODE='42501'; END IF;
 IF op='location' THEN
  IF NOT public.pusula_can('stock.locationsManage',t,e,a,actor) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF length(trim(body->>'code')) NOT BETWEEN 1 AND 30 OR length(trim(body->>'name')) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'INVALID_LOCATION' USING ERRCODE='23514'; END IF;
  INSERT INTO public."StockLocation"("tenantId","legalEntityId","activityId","createdById",code,name) VALUES(t,e,a,actor,body->>'code',body->>'name') RETURNING id INTO rid;RETURN rid;
 END IF;
 IF op='create' THEN
  body:=jsonb_set(body,'{payloadHash}',to_jsonb(encode(sha256(convert_to((body-'payloadHash')::text,'UTF8')),'hex')));
  IF NOT public.pusula_can('receipts.create',t,e,a,actor) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(t::text||e::text||(body->>'idempotencyKey'),7316));
  SELECT * INTO r FROM public."GoodsReceipt" WHERE "tenantId"=t AND "legalEntityId"=e AND "idempotencyKey"=(body->>'idempotencyKey')::uuid;
  IF FOUND THEN
   IF r."payloadHash"<>body->>'payloadHash' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='23514'; END IF;
   IF NOT public.pusula_can('receipts.view',t,e,r."activityId",r."createdById") THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;RETURN r.id;
  END IF;
  SELECT * INTO p FROM public."PurchaseOrder" WHERE id=(body->>'orderId')::uuid AND "tenantId"=t AND "legalEntityId"=e FOR UPDATE;
  IF NOT FOUND OR p.status<>'APPROVED' OR p."activityId" IS DISTINCT FROM a THEN RAISE EXCEPTION 'APPROVED_ORDER_REQUIRED' USING ERRCODE='23514'; END IF;
  IF NOT public.pusula_can('purchases.view',t,e,p."activityId",p."createdById") THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO loc FROM public."StockLocation" WHERE id=(body->>'locationId')::uuid AND "tenantId"=t AND "legalEntityId"=e AND active AND ("activityId" IS NULL OR "activityId" IS NOT DISTINCT FROM a) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_REQUIRED' USING ERRCODE='23514'; END IF;
  IF NOT public.pusula_can('stock.view',t,e,loc."activityId",loc."createdById") THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  INSERT INTO public."GoodsReceipt"("tenantId","legalEntityId","activityId","createdById","orderId","locationId","receivedAt","sourceRef","idempotencyKey","payloadHash") VALUES(t,e,a,actor,p.id,loc.id,(body->>'receivedAt')::date,coalesce(body->>'sourceRef',''),(body->>'idempotencyKey')::uuid,body->>'payloadHash') RETURNING id INTO rid;
 ELSIF op='edit' THEN
  SELECT * INTO r FROM public."GoodsReceipt" WHERE id=(body->>'id')::uuid AND "tenantId"=t AND "legalEntityId"=e FOR UPDATE;
  IF NOT FOUND OR r.status<>'DRAFT' OR r.version IS DISTINCT FROM (body->>'version')::int THEN RAISE EXCEPTION 'RECEIPT_STATE_CONFLICT' USING ERRCODE='23514'; END IF;
  IF NOT public.pusula_can('receipts.edit',t,e,r."activityId",r."createdById") THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF a IS DISTINCT FROM r."activityId" THEN RAISE EXCEPTION 'ACTIVITY_REJECTED' USING ERRCODE='23514'; END IF;
  SELECT * INTO p FROM public."PurchaseOrder" WHERE id=r."orderId" FOR UPDATE;
   PERFORM set_config('app.stock_order_id',p.id::text,true);
  IF p.status<>'APPROVED' THEN RAISE EXCEPTION 'APPROVED_ORDER_REQUIRED' USING ERRCODE='23514'; END IF;
  rid:=r.id;DELETE FROM public."GoodsReceiptLine" WHERE "receiptId"=rid;
  UPDATE public."GoodsReceipt" SET version=version+1,"sourceRef"=coalesce(body->>'sourceRef',''),"receivedAt"=(body->>'receivedAt')::date WHERE id=rid;
 ELSIF op IN ('post','cancel','reverse') THEN
  SELECT * INTO r FROM public."GoodsReceipt" WHERE id=(body->>'id')::uuid AND "tenantId"=t AND "legalEntityId"=e FOR UPDATE;
  IF NOT FOUND OR a IS DISTINCT FROM r."activityId" THEN RAISE EXCEPTION 'RECEIPT_NOT_FOUND' USING ERRCODE='23514'; END IF;
  IF NOT public.pusula_can(CASE op WHEN 'post' THEN 'receipts.post' WHEN 'cancel' THEN 'receipts.cancel' ELSE 'receipts.reverse' END,t,e,r."activityId",r."createdById") THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  rid:=r.id;
  IF op='post' AND r.status='POSTED' THEN RETURN rid; END IF;
  IF op='cancel' AND r.status='CANCELLED' THEN RETURN rid; END IF;
  IF op='cancel' THEN
   IF r.status<>'DRAFT' OR r.version IS DISTINCT FROM (body->>'version')::int OR coalesce(length(trim(body->>'reason')),0)<3 THEN RAISE EXCEPTION 'CANCEL_REJECTED' USING ERRCODE='23514'; END IF;
   UPDATE public."GoodsReceipt" SET status='CANCELLED',"cancelReason"=body->>'reason',version=version+1 WHERE id=rid;
  ELSE
   -- Existing receipt first, then PO, location, order lines, variant locks, lots/balances.
   -- Create has no existing receipt; its PO -> location order is identical.
   SELECT * INTO p FROM public."PurchaseOrder" WHERE id=r."orderId" FOR UPDATE;
   PERFORM 1 FROM public."StockLocation" WHERE id=r."locationId" AND active FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_REQUIRED' USING ERRCODE='23514'; END IF;
   PERFORM set_config('app.stock_order_id',p.id::text,true);
   IF op='reverse' THEN
    IF r.status<>'POSTED' OR coalesce(length(trim(body->>'reason')),0)<3 THEN RAISE EXCEPTION 'REVERSAL_REJECTED' USING ERRCODE='23514'; END IF;
    SELECT * INTO original FROM public."StockPostingBatch" WHERE "receiptId"=rid AND kind='RECEIPT';
    IF EXISTS(SELECT 1 FROM public."StockPostingBatch" WHERE "reversalOfBatchId"=original.id) THEN RAISE EXCEPTION 'ALREADY_REVERSED' USING ERRCODE='23514'; END IF;
    INSERT INTO public."StockPostingBatch"("tenantId","legalEntityId","activityId","createdById","receiptId",kind,"reversalOfBatchId",reason) VALUES(t,e,r."activityId",r."createdById",rid,'REVERSAL',original.id,body->>'reason') RETURNING id INTO bid;
    FOR m IN SELECT * FROM public."StockMovement" WHERE "batchId"=original.id ORDER BY "lotId","locationId",id LOOP
     PERFORM 1 FROM public."StockLot" WHERE id=m."lotId" FOR UPDATE;
     UPDATE public."StockBalance" SET "quantityBase"="quantityBase"-m."quantityDeltaBase",version=version+1 WHERE "lotId"=m."lotId" AND "locationId"=m."locationId" AND "quantityBase">=m."quantityDeltaBase";
     IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE='23514'; END IF;
     INSERT INTO public."StockMovement"("tenantId","legalEntityId","activityId","createdById","batchId","receiptLineId","lotId","locationId","variantId","lineOrdinal","quantityDeltaBase","baseUnit","reversesMovementId") VALUES(t,e,r."activityId",r."createdById",bid,m."receiptLineId",m."lotId",m."locationId",m."variantId",m."lineOrdinal",-m."quantityDeltaBase",m."baseUnit",m.id);
    END LOOP;
   ELSE
    IF r.status<>'DRAFT' OR r.version IS DISTINCT FROM (body->>'version')::int OR p.status<>'APPROVED' THEN RAISE EXCEPTION 'RECEIPT_STATE_CONFLICT' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public."GoodsReceiptLine" WHERE "receiptId"=rid) THEN RAISE EXCEPTION 'RECEIPT_EMPTY' USING ERRCODE='23514'; END IF;
    INSERT INTO public."StockPostingBatch"("tenantId","legalEntityId","activityId","createdById","receiptId",kind) VALUES(t,e,r."activityId",r."createdById",rid,'RECEIPT') RETURNING id INTO bid;
    -- Acquire all shared variant advisory locks in global UUID order, even across POs.
    FOR pl IN SELECT pol.* FROM public."PurchaseOrderLine" pol JOIN public."GoodsReceiptLine" rl ON rl."orderLineId"=pol.id WHERE rl."receiptId"=rid ORDER BY pol.id FOR UPDATE OF pol LOOP
     NULL;
    END LOOP;
    FOR x IN SELECT DISTINCT to_jsonb(pol."variantId") FROM public."PurchaseOrderLine" pol JOIN public."GoodsReceiptLine" rl ON rl."orderLineId"=pol.id WHERE rl."receiptId"=rid ORDER BY to_jsonb(pol."variantId") LOOP
     PERFORM pg_advisory_xact_lock(hashtextextended((x #>> '{}'),7317));
    END LOOP;
    FOR x IN SELECT to_jsonb(l) FROM public."GoodsReceiptLine" l WHERE l."receiptId"=rid ORDER BY l."orderLineId" LOOP
     SELECT * INTO pl FROM public."PurchaseOrderLine" WHERE id=(x->>'orderLineId')::uuid AND "orderId"=p.id FOR UPDATE;
     accepted:=(x->>'receivedQty')::numeric-(x->>'rejectedQty')::numeric;
     IF accepted=0 THEN CONTINUE; END IF;
     SELECT coalesce((SELECT n.accepted FROM public.v43b_net_received(p.id) n WHERE n."orderLineId"=pl.id),0) INTO total;
     IF total+accepted>pl."orderedQty" THEN RAISE EXCEPTION 'OVER_RECEIPT' USING ERRCODE='23514'; END IF;
     SELECT * INTO v FROM public."MaterialVariant" WHERE id=pl."variantId" AND active;
     SELECT * INTO mat FROM public."Material" WHERE id=v."materialId" AND active;
     IF mat.id IS NULL OR NOT EXISTS(SELECT 1 FROM public."Supplier" WHERE id=p."supplierId" AND active) THEN RAISE EXCEPTION 'INACTIVE_SOURCE' USING ERRCODE='23514'; END IF;
     factor:=(pl."conversionSnapshot"->>'factor')::numeric;
     width:=v."widthCm";height:=v."lengthCm";
     IF mat.roll THEN
      physical_form:='ROLL';base:='linear_meter';
      IF pl."purchaseUnit"='linear_meter' THEN physical:=accepted;width:=factor*100;
      ELSIF pl."purchaseUnit"='square_meter' THEN RAISE EXCEPTION 'UNSUPPORTED_CONVERSION' USING ERRCODE='23514';
      ELSE RAISE EXCEPTION 'UNSUPPORTED_CONVERSION' USING ERRCODE='23514'; END IF;
     ELSIF pl."purchaseUnit"='sheet' AND mat.unit='square_meter' THEN
      physical_form:='SHEET';base:='sheet';physical:=accepted;
      IF width<=0 OR height<=0 OR width*height/10000<>factor THEN RAISE EXCEPTION 'GEOMETRY_CHANGED' USING ERRCODE='23514'; END IF;
     ELSIF pl."purchaseUnit"='piece' AND mat.unit='piece' THEN physical_form:='PIECE';base:='piece';physical:=accepted;
     ELSIF pl."purchaseUnit"::text=pl."baseUnit"::text AND pl."baseUnit"='square_meter' AND NOT mat.roll THEN physical_form:='BULK';base:='square_meter';physical:=accepted;
     ELSE RAISE EXCEPTION 'UNSUPPORTED_CONVERSION' USING ERRCODE='23514'; END IF;
     IF physical<>trunc(physical,9) OR physical<=0 OR ((physical_form='SHEET' OR physical_form='PIECE') AND physical<>trunc(physical)) THEN RAISE EXCEPTION 'QUANTITY_PRECISION' USING ERRCODE='23514'; END IF;
     PERFORM pg_advisory_xact_lock(hashtextextended(pl."variantId"::text,7317));
     PERFORM set_config('app.stock_variant_id',pl."variantId"::text,true);
     IF EXISTS(SELECT 1 FROM public."StockLot" l WHERE l."variantId"=pl."variantId" AND (l.form<>physical_form OR l."baseUnit"<>base)) THEN RAISE EXCEPTION 'STOCK_PROFILE_IMMUTABLE' USING ERRCODE='23514'; END IF;
     cost:=pl."priceSnapshot"-'variantUsdCost'-'recordedById';
     cost:=cost||jsonb_build_object('receiptCostPolicy','CUMULATIVE_HALF_UP_9_V1','stockNormalizationVersion',1,'stockBaseUnit',base,'purchaseOrderBaseUnit',pl."baseUnit"::text,'usdStockUnitPrice',CASE WHEN cost->>'usdPurchaseUnitPrice' IS NULL THEN NULL ELSE round(accepted*(cost->>'usdPurchaseUnitPrice')::numeric/physical,9)::text END,'receivedPurchaseQty',accepted::text,'originalTotal',(round((total+accepted)*(cost->>'originalUnitPrice')::numeric,9)-round(total*(cost->>'originalUnitPrice')::numeric,9))::text,'lineTotalUsd',CASE WHEN cost->>'usdPurchaseUnitPrice' IS NULL THEN NULL ELSE (round((total+accepted)*(cost->>'usdPurchaseUnitPrice')::numeric,9)-round(total*(cost->>'usdPurchaseUnitPrice')::numeric,9))::text END,'taxTreatment','EXCLUDES_VAT_AND_LANDED_EXTRAS');
     INSERT INTO public."StockLot"("tenantId","legalEntityId","activityId","createdById","originReceiptLineId","variantId","lotCode",form,"baseUnit","initialBaseQty","widthCm","initialLengthM","sheetHeightCm","conversionSnapshot","acquisitionSnapshot") VALUES(t,e,r."activityId",r."createdById",(x->>'id')::uuid,pl."variantId",'LOT-'||(x->>'id'),physical_form,base,physical,CASE WHEN physical_form IN ('ROLL','SHEET') THEN width END,CASE WHEN physical_form='ROLL' THEN physical END,CASE WHEN physical_form='SHEET' THEN height END,pl."conversionSnapshot"-'variantUsdCost'-'supplierName',cost) RETURNING id INTO lid;
     INSERT INTO public."StockMovement"("tenantId","legalEntityId","activityId","createdById","batchId","receiptLineId","lotId","locationId","variantId","lineOrdinal","quantityDeltaBase","baseUnit") VALUES(t,e,r."activityId",r."createdById",bid,(x->>'id')::uuid,lid,r."locationId",pl."variantId",(x->>'lineNo')::int,physical,base);
     INSERT INTO public."StockBalance"("tenantId","legalEntityId","activityId","createdById","lotId","locationId","quantityBase") VALUES(t,e,r."activityId",r."createdById",lid,r."locationId",physical);
    END LOOP;
    UPDATE public."GoodsReceipt" SET status='POSTED',"postedAt"=clock_timestamp(),version=version+1 WHERE id=rid;
   END IF;
  END IF;
 ELSE RAISE EXCEPTION 'INVALID_COMMAND' USING ERRCODE='23514';
 END IF;
 IF op IN ('create','edit') THEN
  IF coalesce(jsonb_typeof(body->'lines'),'')<>'array' OR jsonb_array_length(body->'lines') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'INVALID_LINES' USING ERRCODE='23514'; END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(body->'lines') LOOP
   IF x->>'singlePackage' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'SINGLE_PACKAGE_REQUIRED' USING ERRCODE='23514'; END IF;
   SELECT * INTO pl FROM public."PurchaseOrderLine" WHERE id=(x->>'orderLineId')::uuid AND "orderId"=p.id;
   IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_LINE_REQUIRED' USING ERRCODE='23514'; END IF;
   IF (x->>'receivedQty')::numeric<>trunc((x->>'receivedQty')::numeric,9) OR (x->>'rejectedQty')::numeric<>trunc((x->>'rejectedQty')::numeric,9) THEN RAISE EXCEPTION 'QUANTITY_PRECISION' USING ERRCODE='23514'; END IF;
   INSERT INTO public."GoodsReceiptLine"("tenantId","legalEntityId","activityId","createdById","receiptId","orderLineId","lineNo","receivedQty","rejectedQty","rejectionReason") VALUES(t,e,a,coalesce(r."createdById",actor),rid,pl.id,(x->>'lineNo')::int,(x->>'receivedQty')::numeric,coalesce((x->>'rejectedQty')::numeric,0),coalesce(x->>'rejectionReason',''));
  END LOOP;
 END IF;
 INSERT INTO public."AuditEvent"(id,"tenantId","legalEntityId","actorId",action,"targetId",summary) VALUES(gen_random_uuid(),t,e,actor,'RECEIPT_'||upper(op),rid::text,jsonb_build_object('version',1));
 RETURN rid;
END $$;
GRANT CREATE ON SCHEMA public TO pusula_stock_executor;
ALTER FUNCTION v43b_command(text,jsonb) OWNER TO pusula_stock_executor;
REVOKE ALL ON FUNCTION v43b_immutable() FROM PUBLIC;
-- SET membership permits ownership transfer but does not inherit owner ACL rights.
SET LOCAL ROLE pusula_stock_executor;
REVOKE ALL ON FUNCTION v43b_command(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION v43b_command(text,jsonb) TO pusula_runtime;
RESET ROLE;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['StockLocation','GoodsReceipt','GoodsReceiptLine','StockLot','StockPostingBatch','StockMovement','StockBalance'] LOOP
  EXECUTE format('CREATE TRIGGER v43b_write_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION v43b_immutable()',tab);
  EXECUTE format('CREATE TRIGGER v43b_truncate_guard BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION v43b_immutable()',tab);
 END LOOP;
END $$;
-- The batch/header cannot commit without a complete ledger and reconciled cache.
CREATE FUNCTION v43b_complete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE h public."GoodsReceipt"; b public."StockPostingBatch";
BEGIN
 IF EXISTS(SELECT 1 FROM public."StockBalance" sb WHERE sb."tenantId"::text=current_setting('app.tenant_id',true) AND (public.pusula_can('receipts.post',sb."tenantId",sb."legalEntityId",sb."activityId",sb."createdById") OR public.pusula_can('receipts.reverse',sb."tenantId",sb."legalEntityId",sb."activityId",sb."createdById")) AND sb."quantityBase"<>(SELECT coalesce(sum(m."quantityDeltaBase"),0) FROM public."StockMovement" m WHERE m."lotId"=sb."lotId" AND m."locationId"=sb."locationId")) THEN RAISE EXCEPTION 'LEDGER_BALANCE_MISMATCH' USING ERRCODE='23514'; END IF;
 FOR h IN SELECT * FROM public."GoodsReceipt" g WHERE status='POSTED' AND (public.pusula_can('receipts.post',g."tenantId",g."legalEntityId",g."activityId",g."createdById") OR public.pusula_can('receipts.reverse',g."tenantId",g."legalEntityId",g."activityId",g."createdById")) LOOP
  SELECT * INTO b FROM public."StockPostingBatch" WHERE "receiptId"=h.id AND kind='RECEIPT';
  IF b.id IS NULL OR (SELECT count(*) FROM public."GoodsReceiptLine" WHERE "receiptId"=h.id AND "receivedQty">"rejectedQty")<>(SELECT count(*) FROM public."StockMovement" WHERE "batchId"=b.id) OR EXISTS(SELECT 1 FROM public."StockMovement" m JOIN public."StockLot" l ON l.id=m."lotId" WHERE m."batchId"=b.id AND (l."originReceiptLineId"<>m."receiptLineId" OR l."variantId"<>m."variantId" OR l."initialBaseQty"<>m."quantityDeltaBase" OR l."baseUnit"<>m."baseUnit" OR m."locationId"<>h."locationId")) THEN RAISE EXCEPTION 'INCOMPLETE_POSTING' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NULL;
END $$;
-- Install triggers while the table owner still owns the trigger function.
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['GoodsReceipt','GoodsReceiptLine','StockLot','StockPostingBatch','StockMovement','StockBalance'] LOOP
  EXECUTE format('CREATE CONSTRAINT TRIGGER v43b_complete AFTER INSERT OR UPDATE OR DELETE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION v43b_complete()',tab);
 END LOOP;
END $$;
ALTER FUNCTION v43b_complete() OWNER TO pusula_stock_executor;
REVOKE CREATE ON SCHEMA public FROM pusula_stock_executor;
SET LOCAL ROLE pusula_stock_executor;
REVOKE ALL ON FUNCTION v43b_complete() FROM PUBLIC;
RESET ROLE;
INSERT INTO "Permission"(id,label,module) VALUES
 ('receipts.view','Mal kabul görüntüle','receipts'),('receipts.create','Mal kabul taslağı oluştur','receipts'),('receipts.edit','Mal kabul taslağı düzenle','receipts'),('receipts.post','Mal kabul kesinleştir','receipts'),('receipts.cancel','Mal kabul taslağı iptal','receipts'),('receipts.reverse','Mal kabul ters kayıt','receipts'),('receipts.costView','Lot edinim maliyetini gör','receipts'),('stock.locationsManage','Depo tanımla','stock'),('stock.movementsView','Stok hareketi görüntüle','stock');
INSERT INTO "RolePermission"("roleId","permissionId") SELECT 'MASTER',id FROM "Permission" WHERE id LIKE 'receipts.%' OR id IN ('stock.locationsManage','stock.movementsView');

CREATE FUNCTION v43b_order_received(oid uuid) RETURNS TABLE("orderLineId" uuid,accepted text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p public."PurchaseOrder";
BEGIN
 SELECT * INTO p FROM public."PurchaseOrder" WHERE id=oid AND "tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true);
 IF NOT FOUND OR NOT public.pusula_can('purchases.view',p."tenantId",p."legalEntityId",p."activityId",p."createdById") THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM set_config('app.stock_order_id',p.id::text,true);
 RETURN QUERY SELECT n."orderLineId",n.accepted::text FROM public.v43b_net_received(p.id) n;
END $$;
GRANT CREATE ON SCHEMA public TO pusula_stock_executor;
ALTER FUNCTION v43b_order_received(uuid) OWNER TO pusula_stock_executor;
REVOKE CREATE ON SCHEMA public FROM pusula_stock_executor;
SET LOCAL ROLE pusula_stock_executor;
REVOKE ALL ON FUNCTION v43b_order_received(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION v43b_order_received(uuid) TO pusula_runtime;
RESET ROLE;
-- Logically read-only reconciliation. SHARE waits for an in-flight command's header lock.
-- This is intentionally not a READ ONLY transaction: PostgreSQL row locks need UPDATE rights.
CREATE FUNCTION v43b_receipt_outcome(rid uuid, action text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r public."GoodsReceipt"; reversed boolean;
BEGIN
 IF action NOT IN ('post','reverse') THEN RAISE EXCEPTION 'INVALID_COMMAND' USING ERRCODE='23514'; END IF;
 SELECT * INTO r FROM public."GoodsReceipt" WHERE id=rid AND "tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) FOR SHARE;
 IF NOT FOUND OR NOT public.pusula_can('receipts.view',r."tenantId",r."legalEntityId",r."activityId",r."createdById") OR NOT public.pusula_can('receipts.'||action,r."tenantId",r."legalEntityId",r."activityId",r."createdById") THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT EXISTS(SELECT 1 FROM public."StockPostingBatch" b JOIN public."StockPostingBatch" rev ON rev."reversalOfBatchId"=b.id WHERE b."receiptId"=r.id AND b.kind='RECEIPT' AND rev.kind='REVERSAL') INTO reversed;
 IF (action='post' AND r.status='POSTED') OR (action='reverse' AND reversed) THEN RETURN 'SUCCEEDED'; END IF;
 RETURN 'NOT_COMMITTED';
END $$;
GRANT CREATE ON SCHEMA public TO pusula_stock_executor;
ALTER FUNCTION v43b_receipt_outcome(uuid,text) OWNER TO pusula_stock_executor;
REVOKE CREATE ON SCHEMA public FROM pusula_stock_executor;
SET LOCAL ROLE pusula_stock_executor;
REVOKE ALL ON FUNCTION v43b_receipt_outcome(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION v43b_receipt_outcome(uuid,text) TO pusula_runtime;
RESET ROLE;
-- The creator revokes its grant; dropping it removes its bootstrap ADMIN row.
SET LOCAL ROLE pusula_stock_role_creator;
REVOKE pusula_stock_executor FROM SESSION_USER;
RESET ROLE;
DROP ROLE pusula_stock_role_creator;
COMMIT;
