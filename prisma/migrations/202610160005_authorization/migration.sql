-- CreateEnum
CREATE TYPE "ScopeKind" AS ENUM ('OWN', 'ACTIVITY', 'LEGAL_ENTITY', 'TENANT');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isMaster" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "module" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "PermissionScope" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "kind" "ScopeKind" NOT NULL,
    "legalEntityId" UUID,
    "activityId" UUID,
    "department" TEXT,
    "amountLimit" DECIMAL(18,6),
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PermissionScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "roleId" TEXT NOT NULL,
    "scopeId" UUID NOT NULL,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "permissionId" TEXT NOT NULL,
    "scopeId" UUID NOT NULL,
    "effect" "PermissionEffect" NOT NULL,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "legalEntityId" UUID,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON "Membership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_id_key" ON "Membership"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionScope_tenantId_id_key" ON "PermissionScope"("tenantId", "id");

-- CreateIndex
CREATE INDEX "RoleAssignment_tenantId_membershipId_idx" ON "RoleAssignment"("tenantId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleAssignment_membershipId_roleId_scopeId_key" ON "RoleAssignment"("membershipId", "roleId", "scopeId");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_tenantId_membershipId_idx" ON "UserPermissionOverride"("tenantId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_membershipId_permissionId_scopeId_key" ON "UserPermissionOverride"("membershipId", "permissionId", "scopeId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_targetId_createdAt_idx" ON "AuditEvent"("tenantId", "targetId", "createdAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_tenantId_membershipId_fkey" FOREIGN KEY ("tenantId", "membershipId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_tenantId_scopeId_fkey" FOREIGN KEY ("tenantId", "scopeId") REFERENCES "PermissionScope"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_tenantId_membershipId_fkey" FOREIGN KEY ("tenantId", "membershipId") REFERENCES "Membership"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_tenantId_scopeId_fkey" FOREIGN KEY ("tenantId", "scopeId") REFERENCES "PermissionScope"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT membership_status CHECK (status IN ('INVITED','ACTIVE','INACTIVE','SUSPENDED'));
ALTER TABLE "PermissionScope" ADD CONSTRAINT scope_shape CHECK (
 (kind='TENANT' AND "legalEntityId" IS NULL AND "activityId" IS NULL) OR
 (kind IN ('OWN','LEGAL_ENTITY') AND "legalEntityId" IS NOT NULL AND "activityId" IS NULL) OR
 (kind='ACTIVITY' AND "legalEntityId" IS NOT NULL AND "activityId" IS NOT NULL));
ALTER TABLE "PermissionScope" ADD CONSTRAINT scope_company_fk FOREIGN KEY ("tenantId","legalEntityId") REFERENCES "LegalEntity" ("tenantId",id);
ALTER TABLE "PermissionScope" ADD CONSTRAINT scope_activity_fk FOREIGN KEY ("tenantId","legalEntityId","activityId") REFERENCES "Activity" ("tenantId","legalEntityId",id);
ALTER TABLE "PermissionScope" ADD CONSTRAINT scope_positive_limit CHECK ("amountLimit" IS NULL OR "amountLimit">=0);
ALTER TABLE "AuditEvent" ADD CONSTRAINT audit_tenant_fk FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id);
ALTER TABLE "AuditEvent" ADD CONSTRAINT audit_company_fk FOREIGN KEY ("tenantId","legalEntityId") REFERENCES "LegalEntity"("tenantId",id);
CREATE FUNCTION reject_audit_event_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit is append-only'; END $$;
CREATE TRIGGER audit_event_immutable BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION reject_audit_event_change();
DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['Membership','PermissionScope','RoleAssignment','UserPermissionOverride','AuditEvent'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tbl);
  EXECUTE format('CREATE POLICY tenant_scope ON %I USING ("tenantId"::text = current_setting(''app.tenant_id'',true)) WITH CHECK ("tenantId"::text = current_setting(''app.tenant_id'',true))',tbl);
 END LOOP;
END $$;
CREATE POLICY own_membership_lookup ON "Membership" FOR SELECT USING ("userId"=current_setting('app.user_id',true));
