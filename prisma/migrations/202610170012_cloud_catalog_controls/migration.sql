-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "payloadHash" TEXT;

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "payloadHash" TEXT;

-- AlterTable
ALTER TABLE "CloudProduct" ADD COLUMN     "payloadHash" TEXT;

-- AlterTable
ALTER TABLE "CloudExpenseType" ADD COLUMN     "payloadHash" TEXT,
ADD COLUMN     "sourceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CloudExpenseType_tenantId_legalEntityId_sourceId_key" ON "CloudExpenseType"("tenantId", "legalEntityId", "sourceId");
CREATE POLICY activity_d_create ON "Activity" AS RESTRICTIVE FOR INSERT WITH CHECK (pusula_can('activities.manage',"tenantId","legalEntityId",NULL,NULL));
GRANT INSERT ON "Activity" TO pusula_runtime,pusula_test_runtime;
INSERT INTO "Permission"(id,label,module) VALUES('activities.manage','Faaliyet tanımla','activities') ON CONFLICT(id) DO NOTHING;
INSERT INTO "RolePermission"("roleId","permissionId") SELECT id,'activities.manage' FROM "Role" WHERE id='MASTER' ON CONFLICT DO NOTHING;
