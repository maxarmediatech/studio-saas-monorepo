CREATE OR REPLACE FUNCTION enforce_received_amount_relationship_closure()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	linked_schedule_id varchar(255);
	linked_invoice_id varchar(255);
BEGIN
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
