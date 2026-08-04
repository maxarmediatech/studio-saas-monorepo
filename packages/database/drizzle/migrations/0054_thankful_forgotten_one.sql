CREATE TYPE "public"."client_lifecycle_stage" AS ENUM('lead', 'client');--> statement-breakpoint
CREATE TYPE "public"."event_side" AS ENUM('common', 'bride', 'groom', 'both', 'separateCommon');--> statement-breakpoint
ALTER TABLE "booking_events" ALTER COLUMN "event_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_schedules" ALTER COLUMN "due_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "side" "event_side" DEFAULT 'common' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "guest_count" text;--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "is_tentative" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "date_window" text;--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "coverage_notes" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "lifecycle_stage" "client_lifecycle_stage" DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD COLUMN "percentage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD COLUMN "timing" text;--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD COLUMN "document_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD COLUMN "document_sha256" varchar(64);--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD COLUMN "pdf_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "quote_options" ADD COLUMN "document_key" varchar(255);--> statement-breakpoint
ALTER TABLE "quote_participants" ADD COLUMN "document_key" varchar(255);--> statement-breakpoint
ALTER TABLE "quote_participants" ADD COLUMN "contact_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "document_version" integer;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "document" jsonb;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "document_sha256" varchar(64);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "document_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "branding_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "pdf_storage_key" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "pdf_sha256" varchar(64);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "pdf_rendered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "pdf_renderer_version" varchar(100);--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "pdf_page_count" integer;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "pdf_byte_size" integer;--> statement-breakpoint
CREATE INDEX "clients_org_lifecycle_created_idx" ON "clients" USING btree ("organization_id","lifecycle_stage","created_at");--> statement-breakpoint
CREATE INDEX "clients_org_lifecycle_name_idx" ON "clients" USING btree ("organization_id","lifecycle_stage",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "quote_options_document_key_unique_idx" ON "quote_options" USING btree ("quote_id","document_key") WHERE document_key IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_participants_document_key_unique_idx" ON "quote_participants" USING btree ("quote_id","document_key") WHERE document_key IS NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_timeline_shape" CHECK ((is_tentative = false AND event_date IS NOT NULL AND date_window IS NULL) OR (is_tentative = true AND event_date IS NULL AND nullif(btrim(date_window), '') IS NOT NULL));--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_percentage_range" CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100));--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_document_revision_non_negative" CHECK (document_revision >= 0);--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_document_fields_complete" CHECK (document_version IS NULL OR (document_version = 1 AND document IS NOT NULL AND document_sha256 IS NOT NULL));--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_pdf_fields_complete" CHECK ((pdf_storage_key IS NULL AND pdf_sha256 IS NULL AND pdf_rendered_at IS NULL AND pdf_renderer_version IS NULL AND pdf_page_count IS NULL AND pdf_byte_size IS NULL) OR (pdf_storage_key IS NOT NULL AND pdf_sha256 IS NOT NULL AND pdf_rendered_at IS NOT NULL AND pdf_renderer_version IS NOT NULL AND pdf_page_count > 0 AND pdf_byte_size > 0));--> statement-breakpoint
CREATE FUNCTION protect_immutable_quotation_document() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF OLD.status <> 'draft' AND ROW(
		OLD.document_version, OLD.document, OLD.document_sha256, OLD.document_revision,
		OLD.branding_snapshot, OLD.pdf_storage_key, OLD.pdf_sha256, OLD.pdf_rendered_at,
		OLD.pdf_renderer_version, OLD.pdf_page_count, OLD.pdf_byte_size
	) IS DISTINCT FROM ROW(
		NEW.document_version, NEW.document, NEW.document_sha256, NEW.document_revision,
		NEW.branding_snapshot, NEW.pdf_storage_key, NEW.pdf_sha256, NEW.pdf_rendered_at,
		NEW.pdf_renderer_version, NEW.pdf_page_count, NEW.pdf_byte_size
	) THEN
		RAISE EXCEPTION 'non-draft quotation document and PDF evidence are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'quotes_document_immutable';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quotes_protect_immutable_document
BEFORE UPDATE OF document_version, document, document_sha256, document_revision, branding_snapshot, pdf_storage_key, pdf_sha256, pdf_rendered_at, pdf_renderer_version, pdf_page_count, pdf_byte_size ON quotes
FOR EACH ROW EXECUTE FUNCTION protect_immutable_quotation_document();--> statement-breakpoint
CREATE FUNCTION protect_immutable_quotation_child() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
	old_quote_id varchar(255) := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.quote_id END;
	old_organization_id varchar(255) := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.organization_id END;
	new_quote_id varchar(255) := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.quote_id END;
	new_organization_id varchar(255) := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.organization_id END;
BEGIN
	IF EXISTS (
		SELECT 1 FROM quotes q
		WHERE q.document_version = 1 AND q.status <> 'draft' AND (
			(q.id = new_quote_id AND q.organization_id = new_organization_id)
			OR (q.id = old_quote_id AND q.organization_id = old_organization_id)
		)
	) THEN
		RAISE EXCEPTION 'non-draft quotation children are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'quotes_document_children_immutable';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quote_participants_protect_immutable_document
BEFORE INSERT OR UPDATE OR DELETE ON quote_participants
FOR EACH ROW EXECUTE FUNCTION protect_immutable_quotation_child();--> statement-breakpoint
CREATE TRIGGER quote_options_protect_immutable_document
BEFORE INSERT OR UPDATE OR DELETE ON quote_options
FOR EACH ROW EXECUTE FUNCTION protect_immutable_quotation_child();--> statement-breakpoint
CREATE FUNCTION protect_immutable_quotation_line_item() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
	old_organization_id varchar(255) := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.organization_id END;
	old_option_id varchar(255) := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.quote_option_id END;
	new_organization_id varchar(255) := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.organization_id END;
	new_option_id varchar(255) := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.quote_option_id END;
BEGIN
	IF EXISTS (
		SELECT 1
		FROM quote_options qo
		JOIN quotes q ON q.id = qo.quote_id AND q.organization_id = qo.organization_id
		WHERE q.document_version = 1 AND q.status <> 'draft' AND (
			(qo.id = new_option_id AND qo.organization_id = new_organization_id)
			OR (qo.id = old_option_id AND qo.organization_id = old_organization_id)
		)
	) THEN
		RAISE EXCEPTION 'non-draft quotation line items are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'quotes_document_line_items_immutable';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quote_line_items_protect_immutable_document
BEFORE INSERT OR UPDATE OR DELETE ON quote_line_items
FOR EACH ROW EXECUTE FUNCTION protect_immutable_quotation_line_item();--> statement-breakpoint
DROP TRIGGER quote_acceptances_protect_immutable_update ON quote_acceptances;--> statement-breakpoint
CREATE TRIGGER quote_acceptances_protect_immutable_update
BEFORE UPDATE OF quote_id, organization_id, quote_option_id, option_snapshot, document_snapshot, document_sha256, pdf_snapshot, accepted_at, accepted_by, created_at ON quote_acceptances
FOR EACH ROW
WHEN (OLD.quote_id IS DISTINCT FROM NEW.quote_id OR OLD.organization_id IS DISTINCT FROM NEW.organization_id OR OLD.quote_option_id IS DISTINCT FROM NEW.quote_option_id OR OLD.option_snapshot IS DISTINCT FROM NEW.option_snapshot OR OLD.document_snapshot IS DISTINCT FROM NEW.document_snapshot OR OLD.document_sha256 IS DISTINCT FROM NEW.document_sha256 OR OLD.pdf_snapshot IS DISTINCT FROM NEW.pdf_snapshot OR OLD.accepted_at IS DISTINCT FROM NEW.accepted_at OR OLD.accepted_by IS DISTINCT FROM NEW.accepted_by OR OLD.created_at IS DISTINCT FROM NEW.created_at)
EXECUTE FUNCTION protect_acceptance_evidence();
