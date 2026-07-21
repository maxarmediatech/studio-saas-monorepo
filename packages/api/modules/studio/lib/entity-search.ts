import {
	bookingParticipants,
	bookings,
	clients,
	configurations,
	crews,
	deliverableAssignments,
	deliverables,
	eq,
	or,
	receivedAmounts,
	shootAssignments,
	shoots,
	sql,
} from "@repo/database";
import {
	buildCompactReferenceQuery,
	buildContainsPattern,
	parseExactMoneyQuery,
} from "./search-input";

/** Build literal, case-insensitive contains matching across text columns. */
export function buildLiteralTextSearchCondition(
	query: string,
	...fields: unknown[]
) {
	const pattern = buildContainsPattern(query);
	if (!pattern) {
		return undefined;
	}

	const validFields = fields.filter((field) => field != null);
	if (validFields.length === 0) {
		return undefined;
	}

	// PostgreSQL's explicit ESCAPE clause keeps %, _, and \ literal.
	const conditions = validFields.map(
		(field: any) => sql`${field} ILIKE ${pattern} ESCAPE '\\'`,
	);

	return conditions.length === 1 ? conditions[0] : or(...conditions);
}

type SqlCondition = Exclude<ReturnType<typeof or>, undefined>;

function buildCompactReferenceSearchCondition(
	query: string,
	field: unknown,
): SqlCondition | undefined {
	const compactReference = buildCompactReferenceQuery(query);
	return compactReference
		? sql`REGEXP_REPLACE(UPPER(${field}), '[^A-Z0-9]', '', 'g') LIKE ${`%${compactReference}%`}`
		: undefined;
}

function combineWithOr(
	...conditions: Array<SqlCondition | undefined>
): SqlCondition | undefined {
	const valid = conditions.filter(
		(condition): condition is SqlCondition => condition != null,
	);
	if (valid.length === 0) {
		return undefined;
	}
	if (valid.length === 1) {
		return valid[0];
	}

	return or(...valid);
}

interface RelatedSearchOptions {
	includeClientNames?: boolean;
	includePaymentAmounts?: boolean;
}

export function buildBookingSearchCondition(
	query: string,
	organizationId: string,
	options: RelatedSearchOptions = {},
) {
	const directMatch = buildLiteralTextSearchCondition(
		query,
		bookings.name,
		bookings.referenceNumber,
		bookings.bookingType,
		bookings.packageType,
	);
	const compactReferenceMatch = buildCompactReferenceSearchCondition(
		query,
		bookings.referenceNumber,
	);
	const configurationLabelMatch = buildLiteralTextSearchCondition(
		query,
		configurations.label,
	);
	const configurationMatch = configurationLabelMatch
		? sql`EXISTS (
			SELECT 1
			FROM ${configurations}
			WHERE ${configurations.organizationId} = ${organizationId}
				AND ${configurationLabelMatch}
				AND (
					(${configurations.type} = ${"booking_type"} AND ${configurations.key} = ${bookings.bookingType})
					OR (${configurations.type} = ${"package_type"} AND ${configurations.key} = ${bookings.packageType})
				)
		)`
		: undefined;
	const clientNameMatch = buildLiteralTextSearchCondition(
		query,
		clients.name,
	);
	const clientMatch = clientNameMatch
		? sql`EXISTS (
			SELECT 1
			FROM ${bookingParticipants}
			INNER JOIN ${clients}
				ON ${clients.id} = ${bookingParticipants.clientId}
			WHERE ${bookingParticipants.bookingId} = ${bookings.id}
				AND ${clients.organizationId} = ${organizationId}
				AND ${clients.deletedAt} IS NULL
				AND ${clientNameMatch}
		)`
		: undefined;
	const amount = parseExactMoneyQuery(query);
	const receivedPaymentMatch =
		amount && options.includePaymentAmounts
			? sql`EXISTS (
				SELECT 1
				FROM ${receivedAmounts}
				WHERE ${receivedAmounts.bookingId} = ${bookings.id}
					AND ${receivedAmounts.organizationId} = ${organizationId}
					AND ${receivedAmounts.deletedAt} IS NULL
					AND ${receivedAmounts.amount} = ${amount}
			)`
			: undefined;
	const amountMatch = amount
		? or(
				eq(bookings.packageCost, amount),
				eq(bookings.totalReceived, amount),
				sql`(${bookings.packageCost} - ${bookings.totalReceived}) = ${amount}`,
				receivedPaymentMatch,
			)
		: undefined;

	return combineWithOr(
		directMatch,
		compactReferenceMatch,
		configurationMatch,
		clientMatch,
		amountMatch,
	);
}

export function buildShootSearchCondition(
	query: string,
	organizationId: string,
	options: RelatedSearchOptions = {},
) {
	const directMatch = buildLiteralTextSearchCondition(
		query,
		shoots.name,
		shoots.shootType,
		shoots.venue,
		shoots.venueAddress,
	);
	const configurationLabelMatch = buildLiteralTextSearchCondition(
		query,
		configurations.label,
	);
	const configurationMatch = configurationLabelMatch
		? sql`EXISTS (
			SELECT 1
			FROM ${configurations}
			WHERE ${configurations.organizationId} = ${organizationId}
				AND ${configurations.type} = ${"event_type"}
				AND ${configurations.key} = ${shoots.shootType}
				AND ${configurationLabelMatch}
		)`
		: undefined;
	const bookingTextMatch = buildLiteralTextSearchCondition(
		query,
		bookings.name,
		bookings.referenceNumber,
	);
	const compactBookingReferenceMatch = buildCompactReferenceSearchCondition(
		query,
		bookings.referenceNumber,
	);
	const relatedBookingSearchMatch = combineWithOr(
		bookingTextMatch,
		compactBookingReferenceMatch,
	);
	const clientNameMatch = options.includeClientNames
		? buildLiteralTextSearchCondition(query, clients.name)
		: undefined;
	const relatedBookingMatch = relatedBookingSearchMatch
		? sql`EXISTS (
			SELECT 1
			FROM ${bookings}
			WHERE ${bookings.id} = ${shoots.bookingId}
				AND ${bookings.organizationId} = ${organizationId}
				AND ${bookings.deletedAt} IS NULL
				AND ${relatedBookingSearchMatch}
		)`
		: undefined;
	const relatedClientMatch = clientNameMatch
		? sql`EXISTS (
			SELECT 1
			FROM ${bookings}
			INNER JOIN ${bookingParticipants}
				ON ${bookingParticipants.bookingId} = ${bookings.id}
			INNER JOIN ${clients}
				ON ${clients.id} = ${bookingParticipants.clientId}
			WHERE ${bookings.id} = ${shoots.bookingId}
				AND ${bookings.organizationId} = ${organizationId}
				AND ${bookings.deletedAt} IS NULL
				AND ${clients.organizationId} = ${organizationId}
				AND ${clients.deletedAt} IS NULL
				AND ${clientNameMatch}
		)`
		: undefined;
	const crewNameMatch = buildLiteralTextSearchCondition(query, crews.name);
	const relatedCrewMatch = crewNameMatch
		? sql`EXISTS (
			SELECT 1
			FROM ${shootAssignments}
			INNER JOIN ${crews}
				ON ${crews.id} = ${shootAssignments.crewId}
			WHERE ${shootAssignments.shootId} = ${shoots.id}
				AND ${crews.organizationId} = ${organizationId}
				AND ${crews.deletedAt} IS NULL
				AND ${crewNameMatch}
		)`
		: undefined;

	return combineWithOr(
		directMatch,
		configurationMatch,
		relatedBookingMatch,
		relatedClientMatch,
		relatedCrewMatch,
	);
}

export function buildDeliverableSearchCondition(
	query: string,
	organizationId: string,
	options: RelatedSearchOptions = {},
) {
	const directMatch = buildLiteralTextSearchCondition(
		query,
		deliverables.name,
		deliverables.description,
	);
	const bookingTextMatch = buildLiteralTextSearchCondition(
		query,
		bookings.name,
		bookings.referenceNumber,
	);
	const compactBookingReferenceMatch = buildCompactReferenceSearchCondition(
		query,
		bookings.referenceNumber,
	);
	const relatedBookingSearchMatch = combineWithOr(
		bookingTextMatch,
		compactBookingReferenceMatch,
	);
	const clientNameMatch = options.includeClientNames
		? buildLiteralTextSearchCondition(query, clients.name)
		: undefined;
	const relatedBookingMatch = relatedBookingSearchMatch
		? sql`EXISTS (
			SELECT 1
			FROM ${bookings}
			WHERE ${bookings.id} = ${deliverables.bookingId}
				AND ${bookings.organizationId} = ${organizationId}
				AND ${bookings.deletedAt} IS NULL
				AND ${relatedBookingSearchMatch}
		)`
		: undefined;
	const relatedClientMatch = clientNameMatch
		? sql`EXISTS (
			SELECT 1
			FROM ${bookings}
			INNER JOIN ${bookingParticipants}
				ON ${bookingParticipants.bookingId} = ${bookings.id}
			INNER JOIN ${clients}
				ON ${clients.id} = ${bookingParticipants.clientId}
			WHERE ${bookings.id} = ${deliverables.bookingId}
				AND ${bookings.organizationId} = ${organizationId}
				AND ${bookings.deletedAt} IS NULL
				AND ${clients.organizationId} = ${organizationId}
				AND ${clients.deletedAt} IS NULL
				AND ${clientNameMatch}
		)`
		: undefined;
	const crewNameMatch = buildLiteralTextSearchCondition(query, crews.name);
	const relatedCrewMatch = crewNameMatch
		? sql`EXISTS (
			SELECT 1
			FROM ${deliverableAssignments}
			INNER JOIN ${crews}
				ON ${crews.id} = ${deliverableAssignments.crewId}
			WHERE ${deliverableAssignments.deliverableId} = ${deliverables.id}
				AND ${crews.organizationId} = ${organizationId}
				AND ${crews.deletedAt} IS NULL
				AND ${crewNameMatch}
		)`
		: undefined;
	const amount = parseExactMoneyQuery(query);
	const amountMatch = amount ? eq(deliverables.cost, amount) : undefined;

	return combineWithOr(
		directMatch,
		relatedBookingMatch,
		relatedClientMatch,
		relatedCrewMatch,
		amountMatch,
	);
}
