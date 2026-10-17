-- A saved sale's child set is immutable, including later INSERTs.
-- xmin is compared with the current transaction ID; the modulo handles xid wrap.
CREATE FUNCTION pusula_sale_child_same_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM "CloudSale" s
  WHERE s.id=NEW."saleId" AND s."tenantId"=NEW."tenantId"
    AND s."legalEntityId"=NEW."legalEntityId"
    AND s.xmin::text::bigint=mod(pg_current_xact_id()::text::numeric,4294967296)::bigint
 ) THEN
  RAISE EXCEPTION 'Sale child set is sealed' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER d_seal_sale_line BEFORE INSERT ON "CloudSaleLine"
 FOR EACH ROW EXECUTE FUNCTION pusula_sale_child_same_transaction();
CREATE TRIGGER d_seal_payment_plan BEFORE INSERT ON "CloudPaymentPlan"
 FOR EACH ROW EXECUTE FUNCTION pusula_sale_child_same_transaction();