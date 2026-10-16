-- Company names may be enumerated only through an active user's granted scope.
-- Original strict company policy is retained for business writes.
CREATE POLICY granted_company_metadata ON "LegalEntity" FOR SELECT USING (
 "tenantId"::text=current_setting('app.tenant_id',true) AND EXISTS (
  SELECT 1 FROM "Membership" m JOIN "RoleAssignment" r ON r."membershipId"=m.id
  JOIN "PermissionScope" s ON s.id=r."scopeId" AND s."tenantId"=m."tenantId"
  WHERE m."userId"=current_setting('app.user_id',true) AND m.status='ACTIVE' AND m."tenantId"="LegalEntity"."tenantId"
  AND (s.kind='TENANT' OR s."legalEntityId"="LegalEntity".id)
 )
);
