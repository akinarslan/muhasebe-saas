-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "city" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "contact" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "district" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "segment" TEXT NOT NULL DEFAULT 'Mağaza-İşyeri',
ADD COLUMN     "taxId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "taxOffice" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "term" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "brand" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "category" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "margins" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "sku" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "supplierReference" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vat" DECIMAL(8,4) NOT NULL DEFAULT 20,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "MaterialVariant" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "priceVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "CloudProduct" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "activityId" UUID,
    "createdById" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CloudProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudExpenseType" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "activityId" UUID,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "usdAmount" DECIMAL(18,6) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CloudExpenseType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudQuote" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "activityId" UUID,
    "createdById" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "netUsd" DECIMAL(18,6) NOT NULL,
    "costUsd" DECIMAL(18,6) NOT NULL,
    "netTry" DECIMAL(18,2) NOT NULL,
    "vatTry" DECIMAL(18,2) NOT NULL,
    "totalTry" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudSale" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "activityId" UUID,
    "createdById" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "rateSnapshot" JSONB NOT NULL,
    "costUsd" DECIMAL(18,6) NOT NULL,
    "netUsd" DECIMAL(18,6) NOT NULL,
    "netTry" DECIMAL(18,2) NOT NULL,
    "vatTry" DECIMAL(18,2) NOT NULL,
    "totalTry" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudSaleLine" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "widthCm" DECIMAL(12,4) NOT NULL,
    "heightCm" DECIMAL(12,4) NOT NULL,
    "discount" DECIMAL(8,4) NOT NULL,
    "vat" DECIMAL(8,4) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "costUsd" DECIMAL(18,6) NOT NULL,
    "netUsd" DECIMAL(18,6) NOT NULL,
    "netTry" DECIMAL(18,2) NOT NULL,
    "vatTry" DECIMAL(18,2) NOT NULL,
    "totalTry" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "CloudSaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudPaymentPlan" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "dueDate" DATE NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "CloudPaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudImportBatch" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "activityId" UUID,
    "createdById" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "preview" JSONB NOT NULL,
    "reconciliation" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudImportRecord" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "activityId" UUID,
    "createdById" TEXT NOT NULL,
    "batchId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" UUID NOT NULL,

    CONSTRAINT "CloudImportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CloudProduct_tenantId_legalEntityId_id_key" ON "CloudProduct"("tenantId", "legalEntityId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CloudProduct_tenantId_legalEntityId_sourceId_key" ON "CloudProduct"("tenantId", "legalEntityId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CloudExpenseType_tenantId_legalEntityId_id_key" ON "CloudExpenseType"("tenantId", "legalEntityId", "id");

-- CreateIndex
CREATE INDEX "CloudQuote_tenantId_legalEntityId_createdAt_idx" ON "CloudQuote"("tenantId", "legalEntityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CloudQuote_tenantId_legalEntityId_id_key" ON "CloudQuote"("tenantId", "legalEntityId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CloudQuote_tenantId_legalEntityId_groupId_revision_key" ON "CloudQuote"("tenantId", "legalEntityId", "groupId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "CloudQuote_tenantId_legalEntityId_idempotencyKey_key" ON "CloudQuote"("tenantId", "legalEntityId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CloudSale_tenantId_legalEntityId_date_idx" ON "CloudSale"("tenantId", "legalEntityId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CloudSale_tenantId_legalEntityId_id_key" ON "CloudSale"("tenantId", "legalEntityId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CloudSale_tenantId_legalEntityId_idempotencyKey_key" ON "CloudSale"("tenantId", "legalEntityId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CloudSaleLine_tenantId_legalEntityId_saleId_idx" ON "CloudSaleLine"("tenantId", "legalEntityId", "saleId");

-- CreateIndex
CREATE INDEX "CloudPaymentPlan_tenantId_legalEntityId_saleId_idx" ON "CloudPaymentPlan"("tenantId", "legalEntityId", "saleId");

-- CreateIndex
CREATE UNIQUE INDEX "CloudImportBatch_tenantId_legalEntityId_fileHash_key" ON "CloudImportBatch"("tenantId", "legalEntityId", "fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "CloudImportBatch_tenantId_legalEntityId_id_key" ON "CloudImportBatch"("tenantId", "legalEntityId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CloudImportRecord_tenantId_legalEntityId_kind_sourceId_key" ON "CloudImportRecord"("tenantId", "legalEntityId", "kind", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_tenantId_legalEntityId_id_key" ON "Customer"("tenantId", "legalEntityId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Material_tenantId_legalEntityId_sourceId_key" ON "Material"("tenantId", "legalEntityId", "sourceId");

-- AddForeignKey
ALTER TABLE "CloudSaleLine" ADD CONSTRAINT "CloudSaleLine_tenantId_legalEntityId_saleId_fkey" FOREIGN KEY ("tenantId", "legalEntityId", "saleId") REFERENCES "CloudSale"("tenantId", "legalEntityId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudPaymentPlan" ADD CONSTRAINT "CloudPaymentPlan_tenantId_legalEntityId_saleId_fkey" FOREIGN KEY ("tenantId", "legalEntityId", "saleId") REFERENCES "CloudSale"("tenantId", "legalEntityId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sprint D composite scope, action RLS, immutable financial records.
ALTER TABLE "CloudProduct" ADD CONSTRAINT "CloudProduct_entity_fk" FOREIGN KEY ("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id);
ALTER TABLE "CloudProduct" ADD CONSTRAINT "CloudProduct_activity_fk" FOREIGN KEY ("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id);
ALTER TABLE "CloudProduct" ENABLE ROW LEVEL SECURITY; ALTER TABLE "CloudProduct" FORCE ROW LEVEL SECURITY;
CREATE POLICY d_read ON "CloudProduct" FOR SELECT USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND pusula_can('products.view',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY d_insert ON "CloudProduct" FOR INSERT WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND "createdById"=current_setting('app.user_id',true) AND pusula_can('products.create',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY d_update ON "CloudProduct" FOR UPDATE USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND pusula_can('products.edit',"tenantId","legalEntityId","activityId","createdById")) WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND pusula_can('products.edit',"tenantId","legalEntityId","activityId","createdById"));
GRANT SELECT,INSERT,UPDATE ON "CloudProduct" TO pusula_runtime,pusula_test_runtime;
ALTER TABLE "CloudExpenseType" ADD CONSTRAINT "CloudExpenseType_entity_fk" FOREIGN KEY ("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id);
ALTER TABLE "CloudExpenseType" ADD CONSTRAINT "CloudExpenseType_activity_fk" FOREIGN KEY ("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id);
ALTER TABLE "CloudExpenseType" ENABLE ROW LEVEL SECURITY; ALTER TABLE "CloudExpenseType" FORCE ROW LEVEL SECURITY;
CREATE POLICY d_read ON "CloudExpenseType" FOR SELECT USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND pusula_can('expenses.view',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY d_insert ON "CloudExpenseType" FOR INSERT WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND "createdById"=current_setting('app.user_id',true) AND pusula_can('expenses.create',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY d_update ON "CloudExpenseType" FOR UPDATE USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND pusula_can('expenses.edit',"tenantId","legalEntityId","activityId","createdById")) WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND pusula_can('expenses.edit',"tenantId","legalEntityId","activityId","createdById"));
GRANT SELECT,INSERT,UPDATE ON "CloudExpenseType" TO pusula_runtime,pusula_test_runtime;
ALTER TABLE "CloudQuote" ADD CONSTRAINT "CloudQuote_entity_fk" FOREIGN KEY ("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id);
ALTER TABLE "CloudQuote" ADD CONSTRAINT "CloudQuote_activity_fk" FOREIGN KEY ("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id);
ALTER TABLE "CloudQuote" ENABLE ROW LEVEL SECURITY; ALTER TABLE "CloudQuote" FORCE ROW LEVEL SECURITY;
CREATE POLICY d_read ON "CloudQuote" FOR SELECT USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND pusula_can('quotes.view',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY d_insert ON "CloudQuote" FOR INSERT WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND "createdById"=current_setting('app.user_id',true) AND pusula_can('quotes.create',"tenantId","legalEntityId","activityId","createdById"));
GRANT SELECT,INSERT ON "CloudQuote" TO pusula_runtime,pusula_test_runtime;
CREATE TRIGGER d_immutable BEFORE UPDATE OR DELETE ON "CloudQuote" FOR EACH ROW EXECUTE FUNCTION reject_audit_event_change();
ALTER TABLE "CloudSale" ADD CONSTRAINT "CloudSale_entity_fk" FOREIGN KEY ("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id);
ALTER TABLE "CloudSale" ADD CONSTRAINT "CloudSale_activity_fk" FOREIGN KEY ("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id);
ALTER TABLE "CloudSale" ENABLE ROW LEVEL SECURITY; ALTER TABLE "CloudSale" FORCE ROW LEVEL SECURITY;
CREATE POLICY d_read ON "CloudSale" FOR SELECT USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND pusula_can('sales.view',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY d_insert ON "CloudSale" FOR INSERT WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND "createdById"=current_setting('app.user_id',true) AND pusula_can('sales.create',"tenantId","legalEntityId","activityId","createdById"));
GRANT SELECT,INSERT ON "CloudSale" TO pusula_runtime,pusula_test_runtime;
CREATE TRIGGER d_immutable BEFORE UPDATE OR DELETE ON "CloudSale" FOR EACH ROW EXECUTE FUNCTION reject_audit_event_change();
ALTER TABLE "CloudImportBatch" ADD CONSTRAINT "CloudImportBatch_entity_fk" FOREIGN KEY ("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id);
ALTER TABLE "CloudImportBatch" ADD CONSTRAINT "CloudImportBatch_activity_fk" FOREIGN KEY ("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id);
ALTER TABLE "CloudImportBatch" ENABLE ROW LEVEL SECURITY; ALTER TABLE "CloudImportBatch" FORCE ROW LEVEL SECURITY;
CREATE POLICY d_read ON "CloudImportBatch" FOR SELECT USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND pusula_can('imports.view',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY d_insert ON "CloudImportBatch" FOR INSERT WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND "createdById"=current_setting('app.user_id',true) AND pusula_can('imports.create',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY d_update ON "CloudImportBatch" FOR UPDATE USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND pusula_can('imports.confirm',"tenantId","legalEntityId","activityId","createdById")) WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND pusula_can('imports.confirm',"tenantId","legalEntityId","activityId","createdById"));
GRANT SELECT,INSERT,UPDATE ON "CloudImportBatch" TO pusula_runtime,pusula_test_runtime;
ALTER TABLE "CloudImportRecord" ADD CONSTRAINT "CloudImportRecord_entity_fk" FOREIGN KEY ("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id);
ALTER TABLE "CloudImportRecord" ADD CONSTRAINT "CloudImportRecord_activity_fk" FOREIGN KEY ("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id);
ALTER TABLE "CloudImportRecord" ENABLE ROW LEVEL SECURITY; ALTER TABLE "CloudImportRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY d_read ON "CloudImportRecord" FOR SELECT USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND pusula_can('imports.view',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY d_insert ON "CloudImportRecord" FOR INSERT WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND "createdById"=current_setting('app.user_id',true) AND pusula_can('imports.create',"tenantId","legalEntityId","activityId","createdById"));
GRANT SELECT,INSERT ON "CloudImportRecord" TO pusula_runtime,pusula_test_runtime;
CREATE TRIGGER d_immutable BEFORE UPDATE OR DELETE ON "CloudImportRecord" FOR EACH ROW EXECUTE FUNCTION reject_audit_event_change();
ALTER TABLE "CloudSaleLine" ENABLE ROW LEVEL SECURITY; ALTER TABLE "CloudSaleLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY d_parent ON "CloudSaleLine" USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND EXISTS(SELECT 1 FROM "CloudSale" s WHERE s.id="saleId" AND pusula_can('sales.view',s."tenantId",s."legalEntityId",s."activityId",s."createdById"))) WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND EXISTS(SELECT 1 FROM "CloudSale" s WHERE s.id="saleId" AND pusula_can('sales.create',s."tenantId",s."legalEntityId",s."activityId",s."createdById")));
GRANT SELECT,INSERT ON "CloudSaleLine" TO pusula_runtime,pusula_test_runtime;
CREATE TRIGGER d_immutable BEFORE UPDATE OR DELETE ON "CloudSaleLine" FOR EACH ROW EXECUTE FUNCTION reject_audit_event_change();
ALTER TABLE "CloudPaymentPlan" ENABLE ROW LEVEL SECURITY; ALTER TABLE "CloudPaymentPlan" FORCE ROW LEVEL SECURITY;
CREATE POLICY d_parent ON "CloudPaymentPlan" USING ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND EXISTS(SELECT 1 FROM "CloudSale" s WHERE s.id="saleId" AND pusula_can('sales.view',s."tenantId",s."legalEntityId",s."activityId",s."createdById"))) WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "legalEntityId"::text=current_setting('app.legal_entity_id',true) AND EXISTS(SELECT 1 FROM "CloudSale" s WHERE s.id="saleId" AND pusula_can('sales.create',s."tenantId",s."legalEntityId",s."activityId",s."createdById")));
GRANT SELECT,INSERT ON "CloudPaymentPlan" TO pusula_runtime,pusula_test_runtime;
CREATE TRIGGER d_immutable BEFORE UPDATE OR DELETE ON "CloudPaymentPlan" FOR EACH ROW EXECUTE FUNCTION reject_audit_event_change();
ALTER TABLE "CloudSale" ADD CONSTRAINT "CloudSale_customer_fk" FOREIGN KEY ("tenantId","legalEntityId","customerId") REFERENCES "Customer"("tenantId","legalEntityId",id);
ALTER TABLE "CloudQuote" ADD CONSTRAINT "CloudQuote_customer_fk" FOREIGN KEY ("tenantId","legalEntityId","customerId") REFERENCES "Customer"("tenantId","legalEntityId",id);
ALTER TABLE "CloudSaleLine" ADD CONSTRAINT d_product_fk FOREIGN KEY ("tenantId","legalEntityId","productId") REFERENCES "CloudProduct"("tenantId","legalEntityId",id);
ALTER TABLE "CloudImportRecord" ADD CONSTRAINT d_batch_fk FOREIGN KEY ("tenantId","legalEntityId","batchId") REFERENCES "CloudImportBatch"("tenantId","legalEntityId",id);
ALTER TABLE "CloudSaleLine" ADD CONSTRAINT d_line_numbers CHECK(quantity>0 AND "widthCm">=0 AND "heightCm">=0 AND discount>=0 AND discount<=100 AND vat>=0 AND vat<=100);
ALTER TABLE "CloudPaymentPlan" ADD CONSTRAINT d_plan_amount CHECK(amount>0);
ALTER TABLE "CloudExpenseType" ADD CONSTRAINT d_expense_amount CHECK("usdAmount">=0);
INSERT INTO "Permission"(id,label,module) VALUES('products.view','view','products') ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT id,'products.view' FROM "Role" WHERE id='MASTER' ON CONFLICT DO NOTHING;
INSERT INTO "Permission"(id,label,module) VALUES('products.create','create','products') ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT id,'products.create' FROM "Role" WHERE id='MASTER' ON CONFLICT DO NOTHING;
INSERT INTO "Permission"(id,label,module) VALUES('products.edit','edit','products') ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT id,'products.edit' FROM "Role" WHERE id='MASTER' ON CONFLICT DO NOTHING;
INSERT INTO "Permission"(id,label,module) VALUES('expenses.view','view','expenses') ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT id,'expenses.view' FROM "Role" WHERE id='MASTER' ON CONFLICT DO NOTHING;
INSERT INTO "Permission"(id,label,module) VALUES('expenses.create','create','expenses') ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT id,'expenses.create' FROM "Role" WHERE id='MASTER' ON CONFLICT DO NOTHING;
INSERT INTO "Permission"(id,label,module) VALUES('expenses.edit','edit','expenses') ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT id,'expenses.edit' FROM "Role" WHERE id='MASTER' ON CONFLICT DO NOTHING;
INSERT INTO "Permission"(id,label,module) VALUES('quotes.view','view','quotes') ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT id,'quotes.view' FROM "Role" WHERE id='MASTER' ON CONFLICT DO NOTHING;
INSERT INTO "Permission"(id,label,module) VALUES('quotes.create','create','quotes') ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT id,'quotes.create' FROM "Role" WHERE id='MASTER' ON CONFLICT DO NOTHING;
INSERT INTO "Permission"(id,label,module) VALUES('quotes.approve','approve','quotes') ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT id,'quotes.approve' FROM "Role" WHERE id='MASTER' ON CONFLICT DO NOTHING;
INSERT INTO "Permission"(id,label,module) VALUES('imports.view','view','imports') ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT id,'imports.view' FROM "Role" WHERE id='MASTER' ON CONFLICT DO NOTHING;
INSERT INTO "Permission"(id,label,module) VALUES('imports.create','create','imports') ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT id,'imports.create' FROM "Role" WHERE id='MASTER' ON CONFLICT DO NOTHING;
INSERT INTO "Permission"(id,label,module) VALUES('imports.confirm','confirm','imports') ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT id,'imports.confirm' FROM "Role" WHERE id='MASTER' ON CONFLICT DO NOTHING;
INSERT INTO "Permission"(id,label,module) VALUES('materials.edit','edit','materials') ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT id,'materials.edit' FROM "Role" WHERE id='MASTER' ON CONFLICT DO NOTHING;
