-- Runtime is provisioned separately, is not a table owner, and has no BYPASSRLS.
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON "Tenant"
USING (id::text = current_setting('app.tenant_id', true))
WITH CHECK (id::text = current_setting('app.tenant_id', true));

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['LegalEntity','Activity','Customer','Material','MaterialVariant','MaterialPriceHistory'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY company_scope ON %I USING ("tenantId"::text = current_setting(''app.tenant_id'', true) AND %s = current_setting(''app.legal_entity_id'', true)) WITH CHECK ("tenantId"::text = current_setting(''app.tenant_id'', true) AND %s = current_setting(''app.legal_entity_id'', true))',
      tbl, CASE WHEN tbl = 'LegalEntity' THEN 'id::text' ELSE '"legalEntityId"::text' END,
      CASE WHEN tbl = 'LegalEntity' THEN 'id::text' ELSE '"legalEntityId"::text' END);
  END LOOP;
END $$;

ALTER TABLE "MaterialVariant" ADD CONSTRAINT variant_cost_nonnegative CHECK ("usdCost" IS NULL OR "usdCost" >= 0);
ALTER TABLE "MaterialVariant" ADD CONSTRAINT variant_width_positive CHECK ("widthCm" > 0);
ALTER TABLE "MaterialVariant" ADD CONSTRAINT variant_length_positive CHECK ("lengthCm" IS NULL OR "lengthCm" > 0);
ALTER TABLE "MaterialPriceHistory" ADD CONSTRAINT history_cost_nonnegative CHECK ("nextUsd" >= 0 AND ("previousUsd" IS NULL OR "previousUsd" >= 0));

CREATE FUNCTION reject_price_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Price history is append-only' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER immutable_price_history BEFORE UPDATE OR DELETE ON "MaterialPriceHistory"
FOR EACH ROW EXECUTE FUNCTION reject_price_history_change();
