INSERT INTO "configurations" (
	"id",
	"organization_id",
	"type",
	"key",
	"label",
	"description",
	"sort_order",
	"is_default",
	"is_system",
	"is_active",
	"metadata"
)
SELECT
	gen_random_uuid()::text,
	"organizations"."id",
	'quotation_terms'::"config_type",
	'standard_payment_terms',
	'Standard payment terms',
	'Neutral 40/50/10 payment schedule. Add studio-approved timelines and clauses before use.',
	0,
	true,
	false,
	true,
	'{"schemaVersion":1,"deliveryTimelines":[],"paymentMilestones":[{"key":"advance","label":"Advance","percentage":"40","timing":"Booking confirmation and team allotment"},{"key":"raw-data","label":"Second installment","percentage":"50","timing":"At the time of raw data transfer"},{"key":"delivery","label":"Final installment","percentage":"10","timing":"At the time of delivery"}],"fixedTerms":[]}'::jsonb
FROM "organizations"
WHERE NOT EXISTS (
	SELECT 1
	FROM "configurations"
	WHERE "configurations"."organization_id" = "organizations"."id"
		AND "configurations"."type" = 'quotation_terms'::"config_type"
);
