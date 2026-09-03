CREATE TYPE "public"."quotation_pdf_render_intent_status" AS ENUM('pending', 'rendering', 'failed', 'returned_to_draft', 'completed');--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'preparing' BEFORE 'sent';--> statement-breakpoint
CREATE TABLE "quotation_pdf_render_intents" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"quote_id" varchar(255) NOT NULL,
	"quote_version" integer NOT NULL,
	"document_revision" integer NOT NULL,
	"selection_version" integer NOT NULL,
	"source_document" jsonb NOT NULL,
	"source_fingerprint" varchar(64) NOT NULL,
	"branding_snapshot" jsonb NOT NULL,
	"branding_fingerprint" varchar(64) NOT NULL,
	"template_id" varchar(100) NOT NULL,
	"template_version" integer NOT NULL,
	"copy_profile_version" integer NOT NULL,
	"composer_version" integer NOT NULL,
	"renderer_version" varchar(100) NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "quotation_pdf_render_intent_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"task_id" varchar(255),
	"last_error_code" varchar(100),
	"last_error_message" text,
	"last_attempt_at" timestamp with time zone,
	"artifact_storage_key" text,
	"artifact_sha256" varchar(64),
	"artifact_rendered_at" timestamp with time zone,
	"artifact_page_count" integer,
	"artifact_byte_size" integer,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotation_pdf_render_intents_id_org_quote_version_unique" UNIQUE("id","organization_id","quote_id","quote_version"),
	CONSTRAINT "quotation_pdf_render_intents_idempotency_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "quotation_pdf_render_intents_versions_positive" CHECK (quote_version > 0 AND document_revision >= 0 AND selection_version > 0 AND template_version > 0 AND copy_profile_version > 0 AND composer_version > 0),
	CONSTRAINT "quotation_pdf_render_intents_attempt_count_non_negative" CHECK (attempt_count >= 0),
	CONSTRAINT "quotation_pdf_render_intents_idempotency_identity" CHECK (idempotency_key = quote_id || ':' || document_revision::text || ':' || selection_version::text),
	CONSTRAINT "quotation_pdf_render_intents_artifact_fields_complete" CHECK ((artifact_storage_key IS NULL AND artifact_sha256 IS NULL AND artifact_rendered_at IS NULL AND artifact_page_count IS NULL AND artifact_byte_size IS NULL AND completed_at IS NULL) OR (artifact_storage_key IS NOT NULL AND artifact_sha256 IS NOT NULL AND artifact_rendered_at IS NOT NULL AND artifact_page_count > 0 AND artifact_byte_size > 0 AND completed_at IS NOT NULL)),
	CONSTRAINT "quotation_pdf_render_intents_completed_artifact_required" CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "quotation_presentations" (
	"quote_id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"template_id" varchar(100) NOT NULL,
	"template_version" integer NOT NULL,
	"selection_version" integer DEFAULT 1 NOT NULL,
	"selected_by" varchar(255) NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotation_presentations_template_version_positive" CHECK (template_version > 0),
	CONSTRAINT "quotation_presentations_selection_version_positive" CHECK (selection_version > 0)
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "pdf_render_intent_id" varchar(255);--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_id_org_version_unique" UNIQUE("id","organization_id","version");--> statement-breakpoint
ALTER TABLE "quotation_pdf_render_intents" ADD CONSTRAINT "quotation_pdf_render_intents_quote_id_organization_id_quote_version_quotes_id_organization_id_version_fk" FOREIGN KEY ("quote_id","organization_id","quote_version") REFERENCES "public"."quotes"("id","organization_id","version") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_presentations" ADD CONSTRAINT "quotation_presentations_selected_by_users_id_fk" FOREIGN KEY ("selected_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_presentations" ADD CONSTRAINT "quotation_presentations_quote_id_organization_id_quotes_id_organization_id_fk" FOREIGN KEY ("quote_id","organization_id") REFERENCES "public"."quotes"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quotation_pdf_render_intents_completed_quote_version_unique" ON "quotation_pdf_render_intents" USING btree ("quote_id","quote_version") WHERE status = 'completed';--> statement-breakpoint
CREATE INDEX "quotation_pdf_render_intents_recovery_idx" ON "quotation_pdf_render_intents" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "quotation_presentations_org_template_idx" ON "quotation_presentations" USING btree ("organization_id","template_id","template_version");--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_pdf_render_intent_id_quotation_pdf_render_intents_id_fk" FOREIGN KEY ("pdf_render_intent_id") REFERENCES "public"."quotation_pdf_render_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE FUNCTION protect_quotation_presentation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
	locked_status quote_status;
BEGIN
	SELECT status INTO locked_status
	FROM quotes
	WHERE status IN ('preparing', 'sent') AND (
		(TG_OP <> 'INSERT' AND id = OLD.quote_id AND organization_id = OLD.organization_id)
		OR (TG_OP <> 'DELETE' AND id = NEW.quote_id AND organization_id = NEW.organization_id)
	)
	FOR UPDATE;

	IF FOUND THEN
		RAISE EXCEPTION 'quotation presentation is locked while quotation is %', locked_status
			USING ERRCODE = '23514', CONSTRAINT = 'quotation_presentations_lifecycle_locked';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quotation_presentations_protect_lifecycle
BEFORE INSERT OR UPDATE OR DELETE ON quotation_presentations
FOR EACH ROW EXECUTE FUNCTION protect_quotation_presentation();--> statement-breakpoint
CREATE FUNCTION protect_frozen_quotation_pdf_render_intent() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF OLD.status = 'completed' AND EXISTS (
			SELECT 1 FROM organizations o WHERE o.id = OLD.organization_id
		) THEN
			RAISE EXCEPTION 'completed quotation PDF provenance cannot be deleted'
				USING ERRCODE = '23514', CONSTRAINT = 'quotation_pdf_render_intents_completed_immutable';
		END IF;
		RETURN OLD;
	END IF;

	IF ROW(
		OLD.id, OLD.organization_id, OLD.quote_id, OLD.quote_version,
		OLD.document_revision, OLD.selection_version, OLD.source_document,
		OLD.source_fingerprint, OLD.branding_snapshot, OLD.branding_fingerprint,
		OLD.template_id, OLD.template_version, OLD.copy_profile_version,
		OLD.composer_version, OLD.renderer_version, OLD.idempotency_key, OLD.created_at
	) IS DISTINCT FROM ROW(
		NEW.id, NEW.organization_id, NEW.quote_id, NEW.quote_version,
		NEW.document_revision, NEW.selection_version, NEW.source_document,
		NEW.source_fingerprint, NEW.branding_snapshot, NEW.branding_fingerprint,
		NEW.template_id, NEW.template_version, NEW.copy_profile_version,
		NEW.composer_version, NEW.renderer_version, NEW.idempotency_key, NEW.created_at
	) THEN
		RAISE EXCEPTION 'frozen quotation PDF render-intent input is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'quotation_pdf_render_intents_frozen_input_immutable';
	END IF;

	IF OLD.status = 'completed' AND OLD IS DISTINCT FROM NEW THEN
		RAISE EXCEPTION 'completed quotation PDF provenance is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'quotation_pdf_render_intents_completed_immutable';
	END IF;

	IF OLD.artifact_storage_key IS NOT NULL AND ROW(
		OLD.artifact_storage_key, OLD.artifact_sha256, OLD.artifact_rendered_at,
		OLD.artifact_page_count, OLD.artifact_byte_size, OLD.completed_at
	) IS DISTINCT FROM ROW(
		NEW.artifact_storage_key, NEW.artifact_sha256, NEW.artifact_rendered_at,
		NEW.artifact_page_count, NEW.artifact_byte_size, NEW.completed_at
	) THEN
		RAISE EXCEPTION 'attached quotation PDF artifact is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'quotation_pdf_render_intents_artifact_immutable';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quotation_pdf_render_intents_protect_frozen_input
BEFORE UPDATE OR DELETE ON quotation_pdf_render_intents
FOR EACH ROW EXECUTE FUNCTION protect_frozen_quotation_pdf_render_intent();--> statement-breakpoint
CREATE FUNCTION validate_quotation_pdf_provenance_attachment() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
	intent quotation_pdf_render_intents%ROWTYPE;
BEGIN
	IF NEW.pdf_render_intent_id IS NULL THEN
		RETURN NEW;
	END IF;
	IF OLD.pdf_render_intent_id IS NOT NULL AND OLD.pdf_render_intent_id IS DISTINCT FROM NEW.pdf_render_intent_id THEN
		RAISE EXCEPTION 'attached quotation PDF provenance is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'quotes_pdf_provenance_immutable';
	END IF;

	SELECT * INTO intent
	FROM quotation_pdf_render_intents
	WHERE id = NEW.pdf_render_intent_id
	FOR KEY SHARE;
	IF NOT FOUND
		OR intent.organization_id <> NEW.organization_id
		OR intent.quote_id <> NEW.id
		OR intent.quote_version <> NEW.version
		OR intent.status <> 'completed'
		OR intent.artifact_storage_key IS DISTINCT FROM NEW.pdf_storage_key
		OR intent.artifact_sha256 IS DISTINCT FROM NEW.pdf_sha256
		OR intent.artifact_rendered_at IS DISTINCT FROM NEW.pdf_rendered_at
		OR intent.renderer_version IS DISTINCT FROM NEW.pdf_renderer_version
		OR intent.artifact_page_count IS DISTINCT FROM NEW.pdf_page_count
		OR intent.artifact_byte_size IS DISTINCT FROM NEW.pdf_byte_size
		OR NEW.status IN ('draft', 'preparing')
	THEN
		RAISE EXCEPTION 'quotation PDF provenance does not match completed artifact evidence'
			USING ERRCODE = '23514', CONSTRAINT = 'quotes_pdf_provenance_matches_intent';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quotes_validate_pdf_provenance_attachment
BEFORE INSERT OR UPDATE OF pdf_render_intent_id, pdf_storage_key, pdf_sha256, pdf_rendered_at, pdf_renderer_version, pdf_page_count, pdf_byte_size, status ON quotes
FOR EACH ROW EXECUTE FUNCTION validate_quotation_pdf_provenance_attachment();--> statement-breakpoint
CREATE FUNCTION require_completed_quotation_pdf_attachment() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.status = 'completed' AND NOT EXISTS (
		SELECT 1
		FROM quotes q
		WHERE q.id = NEW.quote_id
			AND q.organization_id = NEW.organization_id
			AND q.version = NEW.quote_version
			AND q.status = 'sent'
			AND q.pdf_render_intent_id = NEW.id
			AND q.pdf_storage_key IS NOT DISTINCT FROM NEW.artifact_storage_key
			AND q.pdf_sha256 IS NOT DISTINCT FROM NEW.artifact_sha256
			AND q.pdf_rendered_at IS NOT DISTINCT FROM NEW.artifact_rendered_at
			AND q.pdf_renderer_version IS NOT DISTINCT FROM NEW.renderer_version
			AND q.pdf_page_count IS NOT DISTINCT FROM NEW.artifact_page_count
			AND q.pdf_byte_size IS NOT DISTINCT FROM NEW.artifact_byte_size
	) THEN
		RAISE EXCEPTION 'completed quotation PDF intent must be attached to matching quotation evidence'
			USING ERRCODE = '23514', CONSTRAINT = 'quotation_pdf_render_intents_completed_attached';
	END IF;
	RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER quotation_pdf_render_intents_require_completed_attachment
AFTER INSERT OR UPDATE ON quotation_pdf_render_intents
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION require_completed_quotation_pdf_attachment();--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_immutable_quotation_document() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF OLD.status NOT IN ('draft', 'preparing') AND ROW(
		OLD.document_version, OLD.document, OLD.document_sha256, OLD.document_revision,
		OLD.branding_snapshot, OLD.pdf_storage_key, OLD.pdf_sha256, OLD.pdf_rendered_at,
		OLD.pdf_renderer_version, OLD.pdf_page_count, OLD.pdf_byte_size, OLD.pdf_render_intent_id
	) IS DISTINCT FROM ROW(
		NEW.document_version, NEW.document, NEW.document_sha256, NEW.document_revision,
		NEW.branding_snapshot, NEW.pdf_storage_key, NEW.pdf_sha256, NEW.pdf_rendered_at,
		NEW.pdf_renderer_version, NEW.pdf_page_count, NEW.pdf_byte_size, NEW.pdf_render_intent_id
	) THEN
		RAISE EXCEPTION 'non-draft quotation document and PDF evidence are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'quotes_document_immutable';
	END IF;
	IF OLD.status = 'preparing' AND (
		ROW(
			OLD.document_version, OLD.document, OLD.document_sha256, OLD.document_revision
		) IS DISTINCT FROM ROW(
			NEW.document_version, NEW.document, NEW.document_sha256, NEW.document_revision
		)
		OR (
			NEW.status <> 'sent' AND ROW(
				OLD.branding_snapshot, OLD.pdf_storage_key, OLD.pdf_sha256,
				OLD.pdf_rendered_at, OLD.pdf_renderer_version, OLD.pdf_page_count,
				OLD.pdf_byte_size, OLD.pdf_render_intent_id
			) IS DISTINCT FROM ROW(
				NEW.branding_snapshot, NEW.pdf_storage_key, NEW.pdf_sha256,
				NEW.pdf_rendered_at, NEW.pdf_renderer_version, NEW.pdf_page_count,
				NEW.pdf_byte_size, NEW.pdf_render_intent_id
			)
		)
	) THEN
		RAISE EXCEPTION 'preparing quotation source and PDF evidence are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'quotes_preparing_document_immutable';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER quotes_protect_immutable_document ON quotes;--> statement-breakpoint
CREATE TRIGGER quotes_protect_immutable_document
BEFORE UPDATE OF document_version, document, document_sha256, document_revision, branding_snapshot, pdf_storage_key, pdf_sha256, pdf_rendered_at, pdf_renderer_version, pdf_page_count, pdf_byte_size, pdf_render_intent_id ON quotes
FOR EACH ROW EXECUTE FUNCTION protect_immutable_quotation_document();