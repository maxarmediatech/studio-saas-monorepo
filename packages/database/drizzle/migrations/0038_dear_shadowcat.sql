DO $$
DECLARE
	duplicate_schedule_id text;
	duplicate_payment_id text;
BEGIN
	SELECT payment_schedule_id
	INTO duplicate_schedule_id
	FROM invoices
	WHERE payment_schedule_id IS NOT NULL AND deleted_at IS NULL
	GROUP BY payment_schedule_id
	HAVING count(*) > 1
	LIMIT 1;

	SELECT received_amount_id
	INTO duplicate_payment_id
	FROM receipts
	WHERE received_amount_id IS NOT NULL AND deleted_at IS NULL
	GROUP BY received_amount_id
	HAVING count(*) > 1
	LIMIT 1;

	IF duplicate_schedule_id IS NOT NULL THEN
		RAISE EXCEPTION 'Migration blocked: multiple active invoices exist for payment_schedule_id %. Run the documented financial-reconciliation --report command for every organization and resolve this issuance-history mismatch before migration 0038.', duplicate_schedule_id;
	END IF;

	IF duplicate_payment_id IS NOT NULL THEN
		RAISE EXCEPTION 'Migration blocked: multiple active receipts exist for received_amount_id %. Run the documented financial-reconciliation --report command for every organization and resolve this issuance-history mismatch before migration 0038.', duplicate_payment_id;
	END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_active_payment_schedule_idx" ON "invoices" USING btree ("payment_schedule_id") WHERE payment_schedule_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_active_received_amount_idx" ON "receipts" USING btree ("received_amount_id") WHERE received_amount_id IS NOT NULL AND deleted_at IS NULL;
