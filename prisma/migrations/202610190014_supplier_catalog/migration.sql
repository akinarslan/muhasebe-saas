BEGIN;
-- CreateEnum
CREATE TYPE "SupplierUnit" AS ENUM ('square_meter', 'linear_meter', 'piece', 'sheet', 'kilogram', 'litre');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "activityId" UUID,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" UUID NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "tradeName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "taxOffice" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "district" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "defaultCurrency" VARCHAR(3) NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierMaterial" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "activityId" UUID,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" UUID NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "supplierId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "supplierSku" TEXT NOT NULL,
    "purchaseUnit" "SupplierUnit" NOT NULL,
    "minOrderQty" DECIMAL(24,9) NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SupplierMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOfferVersion" (
    "recordedById" TEXT NOT NULL,
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "activityId" UUID,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" UUID NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "supplierMaterialId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "tierKey" VARCHAR(100) NOT NULL,
    "originalCurrency" VARCHAR(3) NOT NULL,
    "originalUnitPrice" DECIMAL(24,9) NOT NULL,
    "purchaseUnit" "SupplierUnit" NOT NULL,
    "minQty" DECIMAL(24,9) NOT NULL,
    "maxQty" DECIMAL(24,9),
    "validFrom" DATE NOT NULL,
    "validUntil" DATE,
    "offeredOn" DATE NOT NULL,
    "normalizedUsdUnitPrice" DECIMAL(24,9),
    "fxSnapshot" JSONB NOT NULL,
    "conversionSnapshot" JSONB NOT NULL,
    "supplierReference" TEXT NOT NULL,
    "notes" TEXT NOT NULL,

    CONSTRAINT "SupplierOfferVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_tenantId_legalEntityId_name_idx" ON "Supplier"("tenantId", "legalEntityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_scope_key" ON "Supplier"("tenantId", "legalEntityId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_request_key" ON "Supplier"("tenantId", "legalEntityId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SupplierMaterial_tenantId_legalEntityId_variantId_idx" ON "SupplierMaterial"("tenantId", "legalEntityId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_material_scope_key" ON "SupplierMaterial"("tenantId", "legalEntityId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_variant_key" ON "SupplierMaterial"("tenantId", "legalEntityId", "supplierId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_material_request_key" ON "SupplierMaterial"("tenantId", "legalEntityId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SupplierOfferVersion_tenantId_legalEntityId_supplierMateria_idx" ON "SupplierOfferVersion"("tenantId", "legalEntityId", "supplierMaterialId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_offer_scope_key" ON "SupplierOfferVersion"("tenantId", "legalEntityId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_offer_revision_key" ON "SupplierOfferVersion"("tenantId", "legalEntityId", "supplierMaterialId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_offer_request_key" ON "SupplierOfferVersion"("tenantId", "legalEntityId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "SupplierMaterial" ADD CONSTRAINT "SupplierMaterial_tenantId_legalEntityId_supplierId_fkey" FOREIGN KEY ("tenantId", "legalEntityId", "supplierId") REFERENCES "Supplier"("tenantId", "legalEntityId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "SupplierOfferVersion" ADD CONSTRAINT "SupplierOfferVersion_tenantId_legalEntityId_supplierMateri_fkey" FOREIGN KEY ("tenantId", "legalEntityId", "supplierMaterialId") REFERENCES "SupplierMaterial"("tenantId", "legalEntityId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- V4.2 additive controls; apply only to an explicitly approved isolated target first.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['Supplier','SupplierMaterial','SupplierOfferVersion'] LOOP
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id) ON DELETE RESTRICT ON UPDATE RESTRICT',t,'v42_'||t||'_entity');
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id) ON DELETE RESTRICT ON UPDATE RESTRICT',t,'v42_'||t||'_activity');
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY v42_scope ON %I USING (NULLIF(current_setting(''app.user_id'',true),'''') IS NOT NULL AND "tenantId"::text=current_setting(''app.tenant_id'',true) AND "legalEntityId"::text=current_setting(''app.legal_entity_id'',true)) WITH CHECK (NULLIF(current_setting(''app.user_id'',true),'''') IS NOT NULL AND "tenantId"::text=current_setting(''app.tenant_id'',true) AND "legalEntityId"::text=current_setting(''app.legal_entity_id'',true))',t);
 END LOOP;
END $$;
ALTER TABLE "SupplierMaterial" ADD CONSTRAINT v42_variant_fk FOREIGN KEY ("tenantId","legalEntityId","variantId") REFERENCES "MaterialVariant"("tenantId","legalEntityId",id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Supplier" ADD CONSTRAINT v42_supplier_values CHECK (length(trim(name)) BETWEEN 2 AND 200 AND "leadTimeDays" BETWEEN 0 AND 3650 AND version>0 AND "defaultCurrency" IN ('USD','TRY','EUR','GBP'));
ALTER TABLE "SupplierMaterial" ADD CONSTRAINT v42_link_values CHECK ("minOrderQty">0 AND "minOrderQty"<1000000000000 AND "leadTimeDays" BETWEEN 0 AND 3650 AND version>0);
ALTER TABLE "SupplierOfferVersion" ADD CONSTRAINT v42_offer_values CHECK ("originalUnitPrice">0 AND "originalUnitPrice"<1000000000000 AND "minQty">0 AND "minQty"<1000000000000 AND ("maxQty" IS NULL OR ("maxQty">"minQty" AND "maxQty"<1000000000000)) AND revision>0 AND ("validUntil" IS NULL OR "validUntil">"validFrom") AND "offeredOn"<=(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date AND "originalCurrency" IN ('USD','TRY','EUR','GBP') AND ("normalizedUsdUnitPrice" IS NULL OR ("normalizedUsdUnitPrice">0 AND "normalizedUsdUnitPrice"<1000000000000)));

CREATE POLICY v42_supplier_read ON "Supplier" AS RESTRICTIVE FOR SELECT USING (pusula_can('suppliers.view',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY v42_supplier_insert ON "Supplier" AS RESTRICTIVE FOR INSERT WITH CHECK ("createdById"=current_setting('app.user_id',true) AND pusula_can('suppliers.create',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY v42_supplier_update ON "Supplier" AS RESTRICTIVE FOR UPDATE USING (pusula_can('suppliers.edit',"tenantId","legalEntityId","activityId","createdById")) WITH CHECK (pusula_can('suppliers.edit',"tenantId","legalEntityId","activityId","createdById"));

CREATE POLICY v42_link_read ON "SupplierMaterial" AS RESTRICTIVE FOR SELECT USING (EXISTS (SELECT 1 FROM "Supplier" s WHERE s.id="supplierId" AND s."tenantId"="SupplierMaterial"."tenantId" AND s."legalEntityId"="SupplierMaterial"."legalEntityId") AND EXISTS (SELECT 1 FROM "MaterialVariant" v WHERE v.id="variantId" AND v."tenantId"="SupplierMaterial"."tenantId" AND v."legalEntityId"="SupplierMaterial"."legalEntityId"));
CREATE POLICY v42_link_insert ON "SupplierMaterial" AS RESTRICTIVE FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM "Supplier" s WHERE s.id="supplierId" AND s.active AND s."activityId" IS NOT DISTINCT FROM "SupplierMaterial"."activityId" AND s."createdById"="SupplierMaterial"."createdById" AND pusula_can('supplierMaterials.manage',s."tenantId",s."legalEntityId",s."activityId",s."createdById")) AND EXISTS (SELECT 1 FROM "MaterialVariant" v JOIN "Material" m ON m.id=v."materialId" WHERE v.id="variantId" AND v.active AND m.active AND (m."activityId" IS NULL OR m."activityId" IS NOT DISTINCT FROM "SupplierMaterial"."activityId")));
CREATE POLICY v42_link_update ON "SupplierMaterial" AS RESTRICTIVE FOR UPDATE USING (pusula_can('supplierMaterials.manage',"tenantId","legalEntityId","activityId","createdById")) WITH CHECK (pusula_can('supplierMaterials.manage',"tenantId","legalEntityId","activityId","createdById"));
CREATE POLICY v42_offer_read ON "SupplierOfferVersion" AS RESTRICTIVE FOR SELECT USING (pusula_can('supplierOffers.view',"tenantId","legalEntityId","activityId","createdById") AND EXISTS(SELECT 1 FROM "SupplierMaterial" l WHERE l.id="supplierMaterialId"));
CREATE POLICY v42_offer_insert ON "SupplierOfferVersion" AS RESTRICTIVE FOR INSERT WITH CHECK ("recordedById"=current_setting('app.user_id',true) AND pusula_can('supplierOffers.create',"tenantId","legalEntityId","activityId","createdById") AND pusula_can('supplierOffers.costView',"tenantId","legalEntityId","activityId","createdById") AND EXISTS (SELECT 1 FROM "SupplierMaterial" l JOIN "Supplier" s ON s.id=l."supplierId" JOIN "MaterialVariant" v ON v.id=l."variantId" JOIN "Material" m ON m.id=v."materialId" WHERE l.id="supplierMaterialId" AND l.active AND s.active AND v.active AND m.active AND l."activityId" IS NOT DISTINCT FROM "SupplierOfferVersion"."activityId" AND l."createdById"="SupplierOfferVersion"."createdById" AND pusula_can('materials.costView',m."tenantId",m."legalEntityId",m."activityId",m."createdById")));

CREATE FUNCTION v42_reject_offer_mutation() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'Supplier offers are append-only' USING ERRCODE='23514'; END $$;
CREATE TRIGGER v42_offer_immutable BEFORE UPDATE OR DELETE ON "SupplierOfferVersion" FOR EACH ROW EXECUTE FUNCTION v42_reject_offer_mutation();
CREATE TRIGGER v42_offer_no_truncate BEFORE TRUNCATE ON "SupplierOfferVersion" FOR EACH STATEMENT EXECUTE FUNCTION v42_reject_offer_mutation();
CREATE FUNCTION v42_supplier_identity_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF ROW(NEW.id,NEW."tenantId",NEW."legalEntityId",NEW."activityId",NEW."createdById",NEW."createdAt",NEW."idempotencyKey",NEW."payloadHash") IS DISTINCT FROM ROW(OLD.id,OLD."tenantId",OLD."legalEntityId",OLD."activityId",OLD."createdById",OLD."createdAt",OLD."idempotencyKey",OLD."payloadHash") OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Immutable identity or stale version' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='SupplierMaterial' AND (to_jsonb(NEW)->>'supplierId' IS DISTINCT FROM to_jsonb(OLD)->>'supplierId' OR to_jsonb(NEW)->>'variantId' IS DISTINCT FROM to_jsonb(OLD)->>'variantId') THEN RAISE EXCEPTION 'Immutable supplier variant' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER v42_supplier_guard BEFORE UPDATE ON "Supplier" FOR EACH ROW EXECUTE FUNCTION v42_supplier_identity_guard();
CREATE TRIGGER v42_link_guard BEFORE UPDATE ON "SupplierMaterial" FOR EACH ROW EXECUTE FUNCTION v42_supplier_identity_guard();

REVOKE ALL ON "Supplier","SupplierMaterial","SupplierOfferVersion" FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON "Supplier","SupplierMaterial" TO pusula_runtime,pusula_test_runtime;
GRANT SELECT,INSERT ON "SupplierOfferVersion" TO pusula_runtime,pusula_test_runtime;
REVOKE ALL ON FUNCTION v42_reject_offer_mutation(),v42_supplier_identity_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION v42_reject_offer_mutation(),v42_supplier_identity_guard() TO pusula_runtime,pusula_test_runtime;
INSERT INTO "Permission"(id,label,module) VALUES
 ('suppliers.view','Tedarikçi görüntüle','suppliers'),('suppliers.create','Tedarikçi oluştur','suppliers'),('suppliers.edit','Tedarikçi düzenle/pasifleştir','suppliers'),
 ('supplierMaterials.manage','Tedarikçi malzeme eşleştirmesi','supplierMaterials'),
 ('supplierOffers.view','Teklif görüntüle','supplierOffers'),('supplierOffers.create','Teklif sürümü oluştur','supplierOffers'),('supplierOffers.history','Teklif geçmişi','supplierOffers'),('supplierOffers.costView','Tedarikçi fiyatını gör','supplierOffers')
 ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p WHERE r.id='MASTER' AND p.id IN ('suppliers.view','suppliers.create','suppliers.edit','supplierMaterials.manage','supplierOffers.view','supplierOffers.create','supplierOffers.history','supplierOffers.costView') ON CONFLICT DO NOTHING;
COMMIT;
