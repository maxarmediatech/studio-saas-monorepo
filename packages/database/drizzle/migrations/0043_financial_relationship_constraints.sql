DO $$
DECLARE
	mismatch record;
BEGIN
	SELECT * INTO mismatch
	FROM (
		SELECT 'invoice_schedule' AS relationship, i.id AS record_id
		FROM invoices i
		JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
		WHERE i.payment_schedule_id IS NOT NULL
			AND (i.organization_id <> ps.organization_id OR i.booking_id <> ps.booking_id)
		UNION ALL
		SELECT 'payment_schedule', ra.id
		FROM received_amounts ra
		JOIN payment_schedules ps ON ps.id = ra.payment_schedule_id
		WHERE ra.payment_schedule_id IS NOT NULL
			AND (ra.organization_id <> ps.organization_id OR ra.booking_id <> ps.booking_id)
		UNION ALL
		SELECT 'payment_invoice', ra.id
		FROM received_amounts ra
		JOIN invoices i ON i.id = ra.invoice_id
		WHERE ra.invoice_id IS NOT NULL
			AND (ra.organization_id <> i.organization_id OR ra.booking_id <> i.booking_id)
		UNION ALL
		SELECT 'payment_invoice_schedule', ra.id
		FROM received_amounts ra
		JOIN invoices i ON i.id = ra.invoice_id
		WHERE ra.payment_schedule_id IS NOT NULL
			AND i.payment_schedule_id IS NOT NULL
			AND ra.payment_schedule_id <> i.payment_schedule_id
		UNION ALL
		SELECT 'receipt_invoice', r.id
		FROM receipts r
		JOIN invoices i ON i.id = r.invoice_id
		WHERE r.invoice_id IS NOT NULL
			AND (r.organization_id <> i.organization_id OR r.booking_id <> i.booking_id)
		UNION ALL
		SELECT 'receipt_payment', r.id
		FROM receipts r
		JOIN received_amounts ra ON ra.id = r.received_amount_id
		WHERE r.received_amount_id IS NOT NULL
			AND (r.organization_id <> ra.organization_id OR r.booking_id <> ra.booking_id)
		UNION ALL
		SELECT 'receipt_payment_invoice', r.id
		FROM receipts r
		JOIN received_amounts ra ON ra.id = r.received_amount_id
		WHERE r.invoice_id IS NOT NULL
			AND ra.invoice_id IS NOT NULL
			AND r.invoice_id <> ra.invoice_id
	) mismatches
	LIMIT 1;

	IF mismatch.record_id IS NOT NULL THEN
		RAISE EXCEPTION 'Migration blocked: invalid financial relationship % on record %. Resolve it with the financial mismatch workflow before retrying migration 0043.', mismatch.relationship, mismatch.record_id;
	END IF;
END $$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_invoice_relationship_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW.payment_schedule_id IS NOT NULL THEN
		IF NOT EXISTS (
			SELECT 1 FROM payment_schedules ps
			WHERE ps.id = NEW.payment_schedule_id
				AND ps.organization_id = NEW.organization_id
				AND ps.booking_id = NEW.booking_id
		) THEN
			RAISE EXCEPTION USING
				ERRCODE = '23514',
				MESSAGE = 'Invoice payment schedule must belong to the same organization and booking';
		END IF;
	END IF;

	IF EXISTS (
		SELECT 1 FROM received_amounts ra
		WHERE ra.invoice_id = NEW.id
			AND (ra.organization_id <> NEW.organization_id OR ra.booking_id <> NEW.booking_id)
	) OR EXISTS (
		SELECT 1 FROM receipts r
		WHERE r.invoice_id = NEW.id
			AND (r.organization_id <> NEW.organization_id OR r.booking_id <> NEW.booking_id)
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'Invoice organization and booking cannot diverge from linked payments or receipts';
	END IF;

	IF NEW.payment_schedule_id IS NOT NULL AND EXISTS (
		SELECT 1 FROM received_amounts ra
		WHERE ra.invoice_id = NEW.id
			AND ra.payment_schedule_id IS NOT NULL
			AND ra.payment_schedule_id <> NEW.payment_schedule_id
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'Invoice schedule cannot diverge from linked payments';
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_received_amount_relationship_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW.payment_schedule_id IS NOT NULL AND NOT EXISTS (
			SELECT 1 FROM payment_schedules ps
			WHERE ps.id = NEW.payment_schedule_id
				AND ps.organization_id = NEW.organization_id
				AND ps.booking_id = NEW.booking_id
		) THEN
			RAISE EXCEPTION USING
				ERRCODE = '23514',
				MESSAGE = 'Received payment schedule must belong to the same organization and booking';
	END IF;

	IF NEW.invoice_id IS NOT NULL AND NOT EXISTS (
			SELECT 1 FROM invoices i
			WHERE i.id = NEW.invoice_id
				AND i.organization_id = NEW.organization_id
				AND i.booking_id = NEW.booking_id
		) THEN
			RAISE EXCEPTION USING
				ERRCODE = '23514',
				MESSAGE = 'Received payment invoice must belong to the same organization and booking';
	END IF;

	IF NEW.payment_schedule_id IS NOT NULL AND NEW.invoice_id IS NOT NULL
			AND EXISTS (
				SELECT 1 FROM invoices i
				WHERE i.id = NEW.invoice_id
					AND i.payment_schedule_id IS NOT NULL
					AND i.payment_schedule_id <> NEW.payment_schedule_id
			) THEN
			RAISE EXCEPTION USING
				ERRCODE = '23514',
				MESSAGE = 'Received payment invoice and schedule do not describe the same financial obligation';
	END IF;

	IF EXISTS (
		SELECT 1 FROM receipts r
		WHERE r.received_amount_id = NEW.id
			AND (r.organization_id <> NEW.organization_id OR r.booking_id <> NEW.booking_id)
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'Received payment organization and booking cannot diverge from linked receipts';
	END IF;

	IF NEW.invoice_id IS NOT NULL AND EXISTS (
		SELECT 1 FROM receipts r
		WHERE r.received_amount_id = NEW.id
			AND r.invoice_id IS NOT NULL
			AND r.invoice_id <> NEW.invoice_id
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'Received payment invoice cannot diverge from linked receipts';
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_receipt_relationship_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW.invoice_id IS NOT NULL AND NOT EXISTS (
			SELECT 1 FROM invoices i
			WHERE i.id = NEW.invoice_id
				AND i.organization_id = NEW.organization_id
				AND i.booking_id = NEW.booking_id
		) THEN
			RAISE EXCEPTION USING
				ERRCODE = '23514',
				MESSAGE = 'Receipt invoice must belong to the same organization and booking';
	END IF;

	IF NEW.received_amount_id IS NOT NULL AND NOT EXISTS (
			SELECT 1 FROM received_amounts ra
			WHERE ra.id = NEW.received_amount_id
				AND ra.organization_id = NEW.organization_id
				AND ra.booking_id = NEW.booking_id
		) THEN
			RAISE EXCEPTION USING
				ERRCODE = '23514',
				MESSAGE = 'Receipt payment must belong to the same organization and booking';
	END IF;

	IF NEW.invoice_id IS NOT NULL AND NEW.received_amount_id IS NOT NULL
			AND EXISTS (
				SELECT 1 FROM received_amounts ra
				WHERE ra.id = NEW.received_amount_id
					AND ra.invoice_id IS NOT NULL
					AND ra.invoice_id <> NEW.invoice_id
			) THEN
			RAISE EXCEPTION USING
				ERRCODE = '23514',
				MESSAGE = 'Receipt invoice must match its received payment invoice';
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_payment_schedule_relationship_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM invoices i
		WHERE i.payment_schedule_id = NEW.id
			AND (i.organization_id <> NEW.organization_id OR i.booking_id <> NEW.booking_id)
	) OR EXISTS (
		SELECT 1 FROM received_amounts ra
		WHERE ra.payment_schedule_id = NEW.id
			AND (ra.organization_id <> NEW.organization_id OR ra.booking_id <> NEW.booking_id)
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'Payment schedule organization and booking cannot diverge from linked invoices or payments';
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER payment_schedules_financial_relationship_guard
BEFORE UPDATE OF organization_id, booking_id
ON payment_schedules
FOR EACH ROW EXECUTE FUNCTION enforce_payment_schedule_relationship_consistency();--> statement-breakpoint

CREATE TRIGGER invoices_financial_relationship_guard
BEFORE INSERT OR UPDATE OF organization_id, booking_id, payment_schedule_id
ON invoices
FOR EACH ROW EXECUTE FUNCTION enforce_invoice_relationship_consistency();--> statement-breakpoint

CREATE TRIGGER received_amounts_financial_relationship_guard
BEFORE INSERT OR UPDATE OF organization_id, booking_id, payment_schedule_id, invoice_id
ON received_amounts
FOR EACH ROW EXECUTE FUNCTION enforce_received_amount_relationship_consistency();--> statement-breakpoint

CREATE TRIGGER receipts_financial_relationship_guard
BEFORE INSERT OR UPDATE OF organization_id, booking_id, invoice_id, received_amount_id
ON receipts
FOR EACH ROW EXECUTE FUNCTION enforce_receipt_relationship_consistency();
