-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "activityId" UUID,
ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "activityId" UUID,
ADD COLUMN     "createdById" TEXT;

-- CreateTable
CREATE TABLE "TenantExchangeRate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorId" TEXT NOT NULL,
    "usdTry" DECIMAL(18,6) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "publishedAt" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantExchangeRate_tenantId_createdAt_idx" ON "TenantExchangeRate"("tenantId", "createdAt");
ALTER TABLE "Customer" ADD CONSTRAINT customer_activity_fk FOREIGN KEY ("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id);
ALTER TABLE "Material" ADD CONSTRAINT material_activity_fk FOREIGN KEY ("tenantId","legalEntityId","activityId") REFERENCES "Activity"("tenantId","legalEntityId",id);
CREATE FUNCTION pusula_can(action text, target_tenant uuid, target_entity uuid, target_activity uuid, target_owner text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 WITH grants AS (
  SELECT rp."permissionId" AS permission, 'ALLOW' AS effect, s.* FROM "Membership" m
  JOIN "RoleAssignment" r ON r."membershipId"=m.id AND r."tenantId"=m."tenantId"
  JOIN "RolePermission" rp ON rp."roleId"=r."roleId" JOIN "PermissionScope" s ON s.id=r."scopeId" AND s."tenantId"=m."tenantId"
  WHERE m."userId"=current_setting('app.user_id',true) AND m.status='ACTIVE' AND m."tenantId"=target_tenant
  UNION ALL
  SELECT o."permissionId",o.effect::text,s.* FROM "Membership" m
  JOIN "UserPermissionOverride" o ON o."membershipId"=m.id AND o."tenantId"=m."tenantId"
  JOIN "PermissionScope" s ON s.id=o."scopeId" AND s."tenantId"=m."tenantId"
  WHERE m."userId"=current_setting('app.user_id',true) AND m.status='ACTIVE' AND m."tenantId"=target_tenant
 ), matching AS (
  SELECT effect FROM grants g WHERE permission=action AND g."tenantId"=target_tenant
  AND (g."legalEntityId" IS NULL OR g."legalEntityId"=target_entity)
  AND (g.kind<>'ACTIVITY' OR g."activityId"=target_activity)
  AND (g.kind<>'OWN' OR target_owner=current_setting('app.user_id',true))
  AND (effect='DENY' OR (g.department IS NULL AND g."amountLimit" IS NULL AND NOT g."requiresApproval"))
 ) SELECT COALESCE(bool_or(effect='ALLOW'),false) AND NOT COALESCE(bool_or(effect='DENY'),false) FROM matching;
$$;
REVOKE ALL ON FUNCTION pusula_can(text,uuid,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pusula_can(text,uuid,uuid,uuid,text) TO pusula_runtime,pusula_test_runtime;
-- Existing company policies remain mandatory. Legacy internal DAL transactions
-- without a user context retain Sprint B behavior; every cloud request sets one.
DO $$ DECLARE tbl text; prefix text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['Customer','Material'] LOOP
  prefix:=CASE WHEN tbl='Customer' THEN 'customers' ELSE 'materials' END;
  EXECUTE format('CREATE POLICY resource_read ON %I AS RESTRICTIVE FOR SELECT USING (NULLIF(current_setting(''app.user_id'',true),'''') IS NULL OR pusula_can(%L,"tenantId","legalEntityId","activityId","createdById"))',tbl,prefix||'.view');
  EXECUTE format('CREATE POLICY resource_insert ON %I AS RESTRICTIVE FOR INSERT WITH CHECK (NULLIF(current_setting(''app.user_id'',true),'''') IS NULL OR pusula_can(%L,"tenantId","legalEntityId","activityId","createdById"))',tbl,prefix||'.create');
  EXECUTE format('CREATE POLICY resource_update ON %I AS RESTRICTIVE FOR UPDATE USING (NULLIF(current_setting(''app.user_id'',true),'''') IS NULL OR pusula_can(%L,"tenantId","legalEntityId","activityId","createdById")) WITH CHECK (NULLIF(current_setting(''app.user_id'',true),'''') IS NULL OR pusula_can(%L,"tenantId","legalEntityId","activityId","createdById"))',tbl,prefix||'.edit',prefix||'.edit');
 END LOOP;
END $$;
CREATE POLICY variant_read ON "MaterialVariant" AS RESTRICTIVE FOR SELECT USING
 (NULLIF(current_setting('app.user_id',true),'') IS NULL OR EXISTS(SELECT 1 FROM "Material" m WHERE m.id="materialId"));
CREATE POLICY variant_cost_update ON "MaterialVariant" AS RESTRICTIVE FOR UPDATE USING
 (NULLIF(current_setting('app.user_id',true),'') IS NULL OR EXISTS(SELECT 1 FROM "Material" m WHERE m.id="materialId" AND pusula_can('materials.costEdit',m."tenantId",m."legalEntityId",m."activityId",m."createdById"))) WITH CHECK
 (NULLIF(current_setting('app.user_id',true),'') IS NULL OR EXISTS(SELECT 1 FROM "Material" m WHERE m.id="materialId" AND pusula_can('materials.costEdit',m."tenantId",m."legalEntityId",m."activityId",m."createdById")));
CREATE POLICY history_read ON "MaterialPriceHistory" AS RESTRICTIVE FOR SELECT USING
 (NULLIF(current_setting('app.user_id',true),'') IS NULL OR EXISTS(SELECT 1 FROM "MaterialVariant" v JOIN "Material" m ON m.id=v."materialId" WHERE v.id="variantId" AND pusula_can('materials.costView',m."tenantId",m."legalEntityId",m."activityId",m."createdById") AND pusula_can('materials.history',m."tenantId",m."legalEntityId",m."activityId",m."createdById")));
CREATE POLICY history_insert ON "MaterialPriceHistory" AS RESTRICTIVE FOR INSERT WITH CHECK
 (NULLIF(current_setting('app.user_id',true),'') IS NULL OR EXISTS(SELECT 1 FROM "MaterialVariant" v JOIN "Material" m ON m.id=v."materialId" WHERE v.id="variantId" AND pusula_can('materials.costEdit',m."tenantId",m."legalEntityId",m."activityId",m."createdById")));
ALTER TABLE "TenantExchangeRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantExchangeRate" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_rate ON "TenantExchangeRate" USING ("tenantId"::text=current_setting('app.tenant_id',true) AND pusula_can('exchange.view',"tenantId",NULL,NULL,NULL)) WITH CHECK ("tenantId"::text=current_setting('app.tenant_id',true) AND "actorId"=current_setting('app.user_id',true) AND pusula_can('exchange.manual',"tenantId",NULL,NULL,NULL));
ALTER TABLE "TenantExchangeRate" ADD CONSTRAINT positive_manual_rate CHECK ("usdTry">0);
CREATE TRIGGER immutable_tenant_rate BEFORE UPDATE OR DELETE ON "TenantExchangeRate" FOR EACH ROW EXECUTE FUNCTION reject_audit_event_change();
GRANT SELECT,INSERT ON "TenantExchangeRate" TO pusula_runtime,pusula_test_runtime;
