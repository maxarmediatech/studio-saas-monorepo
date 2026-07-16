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
		RAISE EXCEPTION 'Migration blocked: multiple active invoices exist for payment_schedule_id %. Run pnpm financial:migration-preflight and resolve this issuance-history mismatch before migration 0039.', duplicate_schedule_id;
	END IF;

	IF duplicate_payment_id IS NOT NULL THEN
		RAISE EXCEPTION 'Migration blocked: multiple active receipts exist for received_amount_id %. Run pnpm financial:migration-preflight and resolve this issuance-history mismatch before migration 0039.', duplicate_payment_id;
	END IF;
END $$;--> statement-breakpoint

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
		RAISE EXCEPTION 'Migration blocked: invalid financial relationship % on record %. Run pnpm financial:migration-preflight, then apply only reviewed safe/manual repairs before migration 0039.', mismatch.relationship, mismatch.record_id;
	END IF;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX "invoices_active_payment_schedule_idx" ON "invoices" USING btree ("payment_schedule_id") WHERE payment_schedule_id IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_active_received_amount_idx" ON "receipts" USING btree ("received_amount_id") WHERE received_amount_id IS NOT NULL AND deleted_at IS NULL;

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

CREATE OR REPLACE FUNCTION enforce_received_amount_relationship_closure()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	linked_schedule_id varchar(255);
	linked_invoice_id varchar(255);
BEGIN
	IF NEW.deleted_at IS NOT NULL THEN
		RETURN NEW;
	END IF;

	IF NEW.invoice_id IS NOT NULL THEN
		SELECT i.payment_schedule_id INTO linked_schedule_id
		FROM invoices i
		WHERE i.id = NEW.invoice_id
			AND i.deleted_at IS NULL;

		IF linked_schedule_id IS NOT NULL
				AND NEW.payment_schedule_id IS DISTINCT FROM linked_schedule_id THEN
			RAISE EXCEPTION USING
				ERRCODE = '23514',
				MESSAGE = 'Received payment must include the schedule linked to its invoice';
		END IF;
	END IF;

	IF NEW.payment_schedule_id IS NOT NULL THEN
		SELECT i.id INTO linked_invoice_id
		FROM invoices i
		WHERE i.payment_schedule_id = NEW.payment_schedule_id
			AND i.deleted_at IS NULL;

		IF linked_invoice_id IS NOT NULL
				AND NEW.invoice_id IS DISTINCT FROM linked_invoice_id THEN
			RAISE EXCEPTION USING
				ERRCODE = '23514',
				MESSAGE = 'Received payment must include the invoice linked to its schedule';
		END IF;
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_invoice_payment_relationship_closure()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW.deleted_at IS NOT NULL THEN
		RETURN NEW;
	END IF;

	IF EXISTS (
		SELECT 1
		FROM received_amounts ra
		WHERE ra.invoice_id = NEW.id
			AND ra.payment_schedule_id IS DISTINCT FROM NEW.payment_schedule_id
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'Invoice schedule cannot diverge from linked payment relationships';
	END IF;

	IF NEW.payment_schedule_id IS NOT NULL AND EXISTS (
		SELECT 1
		FROM received_amounts ra
		WHERE ra.payment_schedule_id = NEW.payment_schedule_id
			AND ra.invoice_id IS DISTINCT FROM NEW.id
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '23514',
			MESSAGE = 'Invoice cannot claim a schedule with divergent linked payments';
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER received_amounts_relationship_closure_guard
BEFORE INSERT OR UPDATE OF organization_id, booking_id, payment_schedule_id, invoice_id
ON received_amounts
FOR EACH ROW EXECUTE FUNCTION enforce_received_amount_relationship_closure();--> statement-breakpoint

CREATE TRIGGER invoices_payment_relationship_closure_guard
BEFORE INSERT OR UPDATE OF organization_id, booking_id, payment_schedule_id
ON invoices
FOR EACH ROW EXECUTE FUNCTION enforce_invoice_payment_relationship_closure();
