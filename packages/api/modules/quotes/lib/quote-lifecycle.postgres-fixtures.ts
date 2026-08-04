import { randomUUID } from "node:crypto";

export function restoreDatabaseUrl(original: string | undefined) {
	if (original === undefined) {
		delete process.env.DATABASE_URL;
	} else {
		process.env.DATABASE_URL = original;
	}
}

export async function quoteOptionIdFor(quoteId: string) {
	const { db, eq, quoteOptions } = await import("@repo/database");
	const option = await db.query.quoteOptions.findFirst({
		where: eq(quoteOptions.quoteId, quoteId),
	});
	if (!option) {
		throw new Error("Missing quote option fixture");
	}
	return option.id;
}

export function quoteLifecycleCleanupSql(
	triggerName: string,
	functionName: string,
	revisionTriggerName: string,
	revisionFunctionName: string,
) {
	return `DROP TRIGGER IF EXISTS ${triggerName} ON quotes;
		DROP FUNCTION IF EXISTS ${functionName}();
		DROP TRIGGER IF EXISTS ${revisionTriggerName} ON quote_line_items;
		DROP FUNCTION IF EXISTS ${revisionFunctionName}();`;
}

export function createQuoteLifecycleFixture() {
	const suffix = `${process.pid}_${Date.now()}`;
	const organizationId = `quote_lifecycle_org_${suffix}`;
	const otherOrganizationId = `quote_other_org_${suffix}`;
	const userId = `quote_lifecycle_user_${suffix}`;
	const clientId = randomUUID();
	const otherClientId = randomUUID();
	const crewId = randomUUID();
	const triggerName = `quote_conversion_fail_trigger_${suffix}`;
	const functionName = `quote_conversion_fail_fn_${suffix}`;
	const revisionTriggerName = `quote_revision_fail_trigger_${suffix}`;
	const revisionFunctionName = `quote_revision_fail_fn_${suffix}`;
	const context = {
		organizationId,
		user: {
			id: userId,
			name: "Quote integration user",
			email: `quote-${suffix}@example.com`,
		},
		membership: {
			id: `quote_member_${suffix}`,
			role: "owner",
			organization: {
				id: organizationId,
				name: "Quote Concurrency Studio",
				slug: `quote-concurrency-${suffix}`,
				timezone: "UTC",
			},
		},
	};
	const blueprint = (name: string, failureMarker?: string) => ({
		schemaVersion: 1 as const,
		booking: {
			name,
			bookingDate: "2026-10-01",
			bookingType: "wedding",
			packageType: "premium",
			events: [
				{
					eventType: "ceremony",
					eventDate: "2026-10-01T10:00:00.000Z",
				},
			],
			contractAttachment: {
				name: "contract.pdf",
				size: 1024,
				type: "application/pdf",
				key: `orgs/${organizationId}/contracts/contract.pdf`,
				url: "https://example.com/contract.pdf",
			},
			shoots: [
				{
					name: "Ceremony coverage",
					shootType: "wedding",
					shootDate: "2026-10-01",
					status: "scheduled",
					crewAssignments: [
						{ crewId, role: "Photographer", isLead: true },
					],
				},
			],
			deliverables: [
				{
					name: "Album",
					quantity: 1,
					isPackageIncluded: true,
					crewAssignments: [{ crewId, isLead: true }],
				},
			],
			paymentSchedules: [
				{
					name: "Deposit",
					amount: "100.00",
					dueDate: "2026-09-01",
					notes: failureMarker,
					sortOrder: 0,
				},
			],
		},
	});
	const content = (
		name: string,
		participantId = clientId,
		failureMarker?: string,
	) => ({
		title: `${name} quote`,
		currency: "INR",
		participants: [
			{ clientId: participantId, role: "primary", isPrimary: true },
		],
		options: [
			{
				name: "Premium",
				discountAmount: "0.00",
				taxAmount: "0.00",
				bookingBlueprint: blueprint(name, failureMarker),
				isRecommended: true,
				lineItems: [
					{
						type: "service" as const,
						description: "Coverage",
						quantity: "1.00",
						unitPrice: "100.00",
					},
				],
			},
		],
	});

	return {
		blueprint,
		clientId,
		content,
		context,
		crewId,
		functionName,
		organizationId,
		otherClientId,
		otherOrganizationId,
		revisionFunctionName,
		revisionTriggerName,
		suffix,
		triggerName,
		userId,
	};
}

export function revisionFailureSql({
	functionName,
	triggerName,
	sourceQuoteId,
	failureMarker,
}: {
	functionName: string;
	triggerName: string;
	sourceQuoteId: string;
	failureMarker: string;
}) {
	return `CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
			IF EXISTS (SELECT 1 FROM quote_options qo JOIN quotes q ON q.id = qo.quote_id AND q.organization_id = qo.organization_id WHERE qo.id = NEW.quote_option_id AND q.supersedes_quote_id = '${sourceQuoteId}') THEN
				RAISE EXCEPTION '${failureMarker}';
			END IF;
			RETURN NEW;
		END;
		$$;
		CREATE CONSTRAINT TRIGGER ${triggerName} AFTER INSERT ON quote_line_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${functionName}();`;
}

export function conversionFailureSql({
	functionName,
	triggerName,
	quoteId,
	failureMarker,
}: {
	functionName: string;
	triggerName: string;
	quoteId: string;
	failureMarker: string;
}) {
	return `CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
			IF NEW.status = 'converted' AND NEW.id = '${quoteId}' THEN
				IF NOT EXISTS (SELECT 1 FROM bookings WHERE source_quote_id = NEW.id)
					OR NOT EXISTS (SELECT 1 FROM booking_participants bp JOIN bookings b ON b.id = bp.booking_id WHERE b.source_quote_id = NEW.id)
					OR NOT EXISTS (SELECT 1 FROM booking_events be JOIN bookings b ON b.id = be.booking_id WHERE b.source_quote_id = NEW.id)
					OR NOT EXISTS (SELECT 1 FROM shoots s JOIN bookings b ON b.id = s.booking_id WHERE b.source_quote_id = NEW.id)
					OR NOT EXISTS (SELECT 1 FROM deliverables d JOIN bookings b ON b.id = d.booking_id WHERE b.source_quote_id = NEW.id)
					OR NOT EXISTS (SELECT 1 FROM payment_schedules ps JOIN bookings b ON b.id = ps.booking_id WHERE b.source_quote_id = NEW.id) THEN
					RAISE EXCEPTION 'booking graph incomplete before quote transition';
				END IF;
				RAISE EXCEPTION '${failureMarker}';
			END IF;
			RETURN NEW;
		END;
		$$;
		CREATE TRIGGER ${triggerName} BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION ${functionName}();`;
}
