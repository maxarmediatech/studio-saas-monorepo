ALTER TABLE "quote_line_items" DROP CONSTRAINT "quote_line_items_shape";--> statement-breakpoint
ALTER TABLE "quote_participants" DROP CONSTRAINT "quote_participants_client_id_organization_id_clients_id_organization_id_fk";--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_supersedes_quote_id_organization_id_quotes_id_organization_id_fk";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_source_quote_id_organization_id_quotes_id_organization_id_fk";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_source_quote_option_id_organization_id_source_quote_id_quote_options_id_organization_id_quote_id_fk";--> statement-breakpoint
ALTER TABLE "quote_acceptances" DROP CONSTRAINT "quote_acceptances_quote_id_organization_id_quotes_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "quote_acceptances" DROP CONSTRAINT "quote_acceptances_quote_option_id_organization_id_quote_id_quote_options_id_organization_id_quote_id_fk";
--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD CONSTRAINT "quote_acceptances_quote_id_organization_id_quotes_id_organization_id_fk" FOREIGN KEY ("quote_id","organization_id") REFERENCES "public"."quotes"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD CONSTRAINT "quote_acceptances_quote_option_id_organization_id_quote_id_quote_options_id_organization_id_quote_id_fk" FOREIGN KEY ("quote_option_id","organization_id","quote_id") REFERENCES "public"."quote_options"("id","organization_id","quote_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_participants" ADD CONSTRAINT "quote_participants_client_id_organization_id_clients_id_organization_id_fk" FOREIGN KEY ("client_id","organization_id") REFERENCES "public"."clients"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_supersedes_quote_id_organization_id_quotes_id_organization_id_fk" FOREIGN KEY ("supersedes_quote_id","organization_id") REFERENCES "public"."quotes"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_source_quote_id_organization_id_quotes_id_organization_id_fk" FOREIGN KEY ("source_quote_id","organization_id") REFERENCES "public"."quotes"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_source_quote_option_id_organization_id_source_quote_id_quote_options_id_organization_id_quote_id_fk" FOREIGN KEY ("source_quote_option_id","organization_id","source_quote_id") REFERENCES "public"."quote_options"("id","organization_id","quote_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_shape" CHECK ((type IN ('item', 'service') AND quantity IS NOT NULL AND quantity > 0 AND unit_price IS NOT NULL AND unit_price >= 0 AND amount = round(quantity * unit_price, 2)) OR (type IN ('milestone', 'expense') AND quantity IS NULL AND unit_price IS NULL));--> statement-breakpoint
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_total_formula" CHECK (discount_amount <= subtotal AND total_amount = subtotal - discount_amount + tax_amount);--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_no_self_lineage" CHECK (supersedes_quote_id IS NULL OR supersedes_quote_id <> id);--> statement-breakpoint
CREATE FUNCTION validate_booking_quote_provenance() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
	canonical_snapshot_total_text text;
	canonical_snapshot_blueprint_version_text text;
	canonical_snapshot jsonb;
BEGIN
	IF TG_OP = 'UPDATE' AND OLD.source_quote_id IS NOT NULL AND ROW(
		OLD.source_quote_id,
		OLD.source_quote_option_id,
		OLD.source_quote_number,
		OLD.source_quote_version,
		OLD.source_booking_blueprint_version,
		OLD.package_cost
	) IS DISTINCT FROM ROW(
		NEW.source_quote_id,
		NEW.source_quote_option_id,
		NEW.source_quote_number,
		NEW.source_quote_version,
		NEW.source_booking_blueprint_version,
		NEW.package_cost
	) THEN
		RAISE EXCEPTION 'sourced booking provenance and package cost are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'bookings_source_quote_immutable';
	END IF;

	IF NEW.source_quote_id IS NULL THEN
		RETURN NEW;
	END IF;

	SELECT qa.option_snapshot
	INTO canonical_snapshot
	FROM quotes q
	JOIN quote_acceptances qa
		ON qa.quote_id = q.id
		AND qa.organization_id = q.organization_id
	JOIN quote_options qo
		ON qo.id = qa.quote_option_id
		AND qo.organization_id = q.organization_id
		AND qo.quote_id = q.id
	WHERE q.id = NEW.source_quote_id
		AND q.organization_id = NEW.organization_id
		AND qo.id = NEW.source_quote_option_id
	FOR UPDATE OF q, qa, qo;

	IF NOT FOUND THEN
		RAISE EXCEPTION 'booking quote provenance does not match accepted canonical evidence'
			USING ERRCODE = '23514', CONSTRAINT = 'bookings_source_quote_canonical';
	END IF;

	canonical_snapshot_total_text := canonical_snapshot #>> '{option,totalAmount}';
	canonical_snapshot_blueprint_version_text :=
		canonical_snapshot #>> '{option,bookingBlueprint,schemaVersion}';

	IF canonical_snapshot ->> 'quoteId' IS DISTINCT FROM NEW.source_quote_id
		OR canonical_snapshot ->> 'quoteOptionId' IS DISTINCT FROM NEW.source_quote_option_id
		OR canonical_snapshot ->> 'quoteNumber' IS DISTINCT FROM NEW.source_quote_number
		OR canonical_snapshot ->> 'quoteVersion' IS DISTINCT FROM NEW.source_quote_version::text
		OR canonical_snapshot_blueprint_version_text IS DISTINCT FROM NEW.source_booking_blueprint_version::text
		OR canonical_snapshot_total_text IS NULL
		OR canonical_snapshot_total_text !~ '^[0-9]{1,10}(\.[0-9]{1,2})?$'
		OR NEW.package_cost IS DISTINCT FROM canonical_snapshot_total_text::numeric THEN
		RAISE EXCEPTION 'booking quote provenance does not match accepted canonical evidence'
			USING ERRCODE = '23514', CONSTRAINT = 'bookings_source_quote_canonical';
	END IF;

	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER bookings_validate_quote_provenance
BEFORE INSERT OR UPDATE OF organization_id, source_quote_id, source_quote_option_id, source_quote_number, source_quote_version, source_booking_blueprint_version, package_cost
ON bookings
FOR EACH ROW EXECUTE FUNCTION validate_booking_quote_provenance();--> statement-breakpoint
CREATE FUNCTION protect_linked_quote_evidence() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF EXISTS (SELECT 1 FROM organizations o WHERE o.id = OLD.organization_id)
		AND EXISTS (
			SELECT 1 FROM bookings b
			WHERE b.organization_id = OLD.organization_id
				AND b.source_quote_id = OLD.id
		) THEN
		RAISE EXCEPTION 'linked quote identity evidence is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'bookings_source_quote_canonical';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quotes_protect_linked_evidence
BEFORE UPDATE OF id, organization_id, quote_number, version ON quotes
FOR EACH ROW
WHEN (OLD.id IS DISTINCT FROM NEW.id OR OLD.organization_id IS DISTINCT FROM NEW.organization_id OR OLD.quote_number IS DISTINCT FROM NEW.quote_number OR OLD.version IS DISTINCT FROM NEW.version)
EXECUTE FUNCTION protect_linked_quote_evidence();--> statement-breakpoint
CREATE FUNCTION protect_linked_option_evidence() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF EXISTS (SELECT 1 FROM organizations o WHERE o.id = OLD.organization_id)
		AND EXISTS (
			SELECT 1 FROM bookings b
			WHERE b.organization_id = OLD.organization_id
				AND b.source_quote_id = OLD.quote_id
				AND b.source_quote_option_id = OLD.id
		) THEN
		RAISE EXCEPTION 'linked option commercial evidence is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'bookings_source_quote_canonical';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quote_options_protect_linked_update
BEFORE UPDATE OF id, organization_id, quote_id, subtotal, discount_amount, tax_amount, total_amount, booking_blueprint_version, booking_blueprint ON quote_options
FOR EACH ROW
WHEN (OLD.id IS DISTINCT FROM NEW.id OR OLD.organization_id IS DISTINCT FROM NEW.organization_id OR OLD.quote_id IS DISTINCT FROM NEW.quote_id OR OLD.subtotal IS DISTINCT FROM NEW.subtotal OR OLD.discount_amount IS DISTINCT FROM NEW.discount_amount OR OLD.tax_amount IS DISTINCT FROM NEW.tax_amount OR OLD.total_amount IS DISTINCT FROM NEW.total_amount OR OLD.booking_blueprint_version IS DISTINCT FROM NEW.booking_blueprint_version OR OLD.booking_blueprint IS DISTINCT FROM NEW.booking_blueprint)
EXECUTE FUNCTION protect_linked_option_evidence();--> statement-breakpoint
CREATE TRIGGER quote_options_protect_linked_delete
BEFORE DELETE ON quote_options
FOR EACH ROW EXECUTE FUNCTION protect_linked_option_evidence();--> statement-breakpoint
CREATE FUNCTION protect_acceptance_evidence() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF EXISTS (SELECT 1 FROM organizations o WHERE o.id = OLD.organization_id) THEN
		RAISE EXCEPTION 'acceptance evidence is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'quote_acceptances_immutable';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quote_acceptances_protect_immutable_update
BEFORE UPDATE OF quote_id, organization_id, quote_option_id, option_snapshot, accepted_at, accepted_by, created_at ON quote_acceptances
FOR EACH ROW
WHEN (OLD.quote_id IS DISTINCT FROM NEW.quote_id OR OLD.organization_id IS DISTINCT FROM NEW.organization_id OR OLD.quote_option_id IS DISTINCT FROM NEW.quote_option_id OR OLD.option_snapshot IS DISTINCT FROM NEW.option_snapshot OR OLD.accepted_at IS DISTINCT FROM NEW.accepted_at OR OLD.accepted_by IS DISTINCT FROM NEW.accepted_by OR OLD.created_at IS DISTINCT FROM NEW.created_at)
EXECUTE FUNCTION protect_acceptance_evidence();--> statement-breakpoint
CREATE TRIGGER quote_acceptances_protect_immutable_delete
BEFORE DELETE ON quote_acceptances
FOR EACH ROW EXECUTE FUNCTION protect_acceptance_evidence();--> statement-breakpoint
CREATE FUNCTION guard_quote_line_item_evidence() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
	old_organization_id varchar(255) := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.organization_id END;
	old_option_id varchar(255) := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.quote_option_id END;
	new_organization_id varchar(255) := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.organization_id END;
	new_option_id varchar(255) := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.quote_option_id END;
BEGIN
	IF (old_organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = old_organization_id))
		OR (new_organization_id IS NOT NULL AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = new_organization_id)) THEN
		PERFORM 1
		FROM quote_options qo
		WHERE (qo.organization_id = old_organization_id AND qo.id = old_option_id)
			OR (qo.organization_id = new_organization_id AND qo.id = new_option_id)
		ORDER BY qo.id
		FOR UPDATE;

		IF EXISTS (
			SELECT 1
			FROM bookings b
			WHERE (b.organization_id = old_organization_id AND b.source_quote_option_id = old_option_id)
				OR (b.organization_id = new_organization_id AND b.source_quote_option_id = new_option_id)
		) THEN
			RAISE EXCEPTION 'linked option line item evidence is immutable'
				USING ERRCODE = '23514', CONSTRAINT = 'bookings_source_quote_canonical';
		END IF;
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quote_line_items_guard_evidence
BEFORE INSERT OR UPDATE OR DELETE ON quote_line_items
FOR EACH ROW EXECUTE FUNCTION guard_quote_line_item_evidence();--> statement-breakpoint
CREATE FUNCTION validate_quote_option_subtotal(option_organization_id varchar, option_id varchar) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
	canonical_subtotal numeric(12,2);
	line_total numeric;
BEGIN
	SELECT qo.subtotal INTO canonical_subtotal
	FROM quote_options qo
	WHERE qo.organization_id = option_organization_id AND qo.id = option_id;
	IF NOT FOUND THEN
		RETURN;
	END IF;
	SELECT COALESCE(sum(qli.amount), 0) INTO line_total
	FROM quote_line_items qli
	WHERE qli.organization_id = option_organization_id
		AND qli.quote_option_id = option_id;
	IF canonical_subtotal IS DISTINCT FROM line_total THEN
		RAISE EXCEPTION 'quote option subtotal must equal its line item sum'
			USING ERRCODE = '23514', CONSTRAINT = 'quote_options_subtotal_line_sum';
	END IF;
END;
$$;--> statement-breakpoint
CREATE FUNCTION enforce_quote_option_subtotal_from_option() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	PERFORM validate_quote_option_subtotal(NEW.organization_id, NEW.id);
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER quote_options_validate_subtotal
AFTER INSERT OR UPDATE ON quote_options
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_quote_option_subtotal_from_option();--> statement-breakpoint
CREATE FUNCTION enforce_quote_option_subtotal_from_line() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP <> 'INSERT' THEN
		PERFORM validate_quote_option_subtotal(OLD.organization_id, OLD.quote_option_id);
	END IF;
	IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR OLD.organization_id IS DISTINCT FROM NEW.organization_id OR OLD.quote_option_id IS DISTINCT FROM NEW.quote_option_id) THEN
		PERFORM validate_quote_option_subtotal(NEW.organization_id, NEW.quote_option_id);
	ELSIF TG_OP = 'UPDATE' THEN
		PERFORM validate_quote_option_subtotal(NEW.organization_id, NEW.quote_option_id);
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER quote_line_items_validate_subtotal
AFTER INSERT OR UPDATE OR DELETE ON quote_line_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_quote_option_subtotal_from_line();--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM quote_options qo
		LEFT JOIN quote_line_items qli
			ON qli.organization_id = qo.organization_id
			AND qli.quote_option_id = qo.id
		GROUP BY qo.organization_id, qo.id, qo.subtotal
		HAVING qo.subtotal IS DISTINCT FROM COALESCE(sum(qli.amount), 0)
	) THEN
		RAISE EXCEPTION 'existing quote option subtotal does not equal its line item sum'
			USING ERRCODE = '23514', CONSTRAINT = 'quote_options_subtotal_line_sum';
	END IF;
END;
$$;--> statement-breakpoint
CREATE FUNCTION protect_quote_participant_client_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF EXISTS (SELECT 1 FROM organizations o WHERE o.id = OLD.organization_id)
		AND EXISTS (
			SELECT 1 FROM quote_participants qp
			WHERE qp.organization_id = OLD.organization_id AND qp.client_id = OLD.id
		) THEN
		RAISE EXCEPTION 'client referenced by quote evidence cannot be hard deleted'
			USING ERRCODE = '23514', CONSTRAINT = 'quote_participants_client_delete_guard';
	END IF;
	RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER clients_protect_quote_participant_evidence
BEFORE DELETE ON clients
FOR EACH ROW EXECUTE FUNCTION protect_quote_participant_client_delete();--> statement-breakpoint
CREATE FUNCTION validate_quote_lineage() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
	parent_quote_number varchar(50);
	parent_version integer;
	has_cycle boolean;
BEGIN
	IF NEW.supersedes_quote_id IS NOT NULL THEN
		SELECT p.quote_number, p.version
		INTO parent_quote_number, parent_version
		FROM quotes p
		WHERE p.id = NEW.supersedes_quote_id
			AND p.organization_id = NEW.organization_id
		FOR UPDATE;
		IF NOT FOUND
			OR parent_quote_number IS DISTINCT FROM NEW.quote_number
			OR parent_version + 1 IS DISTINCT FROM NEW.version THEN
			RAISE EXCEPTION 'quote lineage must reference the previous version with the same quote number and tenant'
				USING ERRCODE = '23514', CONSTRAINT = 'quotes_valid_lineage';
		END IF;

		WITH RECURSIVE ancestors(id, supersedes_quote_id) AS (
			SELECT p.id, p.supersedes_quote_id
			FROM quotes p
			WHERE p.id = NEW.supersedes_quote_id AND p.organization_id = NEW.organization_id
			UNION
			SELECT p.id, p.supersedes_quote_id
			FROM quotes p
			JOIN ancestors a ON p.id = a.supersedes_quote_id
			WHERE p.organization_id = NEW.organization_id
		)
		SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = NEW.id) INTO has_cycle;
		IF has_cycle THEN
			RAISE EXCEPTION 'quote lineage cycle is forbidden'
				USING ERRCODE = '23514', CONSTRAINT = 'quotes_valid_lineage';
		END IF;
	END IF;

	IF TG_OP = 'UPDATE' AND EXISTS (
		SELECT 1 FROM quotes child
		WHERE child.organization_id = OLD.organization_id
			AND child.supersedes_quote_id = OLD.id
			AND (child.quote_number IS DISTINCT FROM NEW.quote_number OR child.version IS DISTINCT FROM NEW.version + 1)
	) THEN
		RAISE EXCEPTION 'quote identity change would invalidate child lineage'
			USING ERRCODE = '23514', CONSTRAINT = 'quotes_valid_lineage';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM quotes child
		LEFT JOIN quotes parent
			ON parent.id = child.supersedes_quote_id
			AND parent.organization_id = child.organization_id
		WHERE child.supersedes_quote_id IS NOT NULL
			AND (parent.id IS NULL OR parent.quote_number IS DISTINCT FROM child.quote_number OR parent.version + 1 IS DISTINCT FROM child.version)
	) THEN
		RAISE EXCEPTION 'existing quote lineage is invalid'
			USING ERRCODE = '23514', CONSTRAINT = 'quotes_valid_lineage';
	END IF;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quotes_validate_lineage
BEFORE INSERT OR UPDATE OF id, organization_id, quote_number, version, supersedes_quote_id ON quotes
FOR EACH ROW EXECUTE FUNCTION validate_quote_lineage();