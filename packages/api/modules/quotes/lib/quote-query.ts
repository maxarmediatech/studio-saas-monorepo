import { ORPCError } from "@orpc/server";
import {
	and,
	asc,
	bookings,
	clients,
	count,
	db,
	desc,
	eq,
	ilike,
	inArray,
	isNull,
	ne,
	or,
	quoteAcceptances,
	quoteOptions,
	quoteParticipants,
	quotes,
	sql,
} from "@repo/database";
import {
	quotationBrandingSnapshotV1Schema,
	quotationDocumentV1Schema,
} from "../../studio/schemas/quotation-document";
import {
	acceptedQuoteOptionSnapshotSchema,
	bookingBlueprintSchema,
	type QuoteStatus,
} from "../../studio/schemas/quote";
import { buildQuotationPdfSnapshot } from "./quotation-pdf-snapshot";

function iso(value: Date | null): string | null {
	return value?.toISOString() ?? null;
}

export async function listOrganizationQuotes(input: {
	organizationId: string;
	search?: string;
	statuses?: QuoteStatus[];
	documentVersion?: 1;
	clientId?: string;
	includeDeleted: boolean;
	sortBy:
		| "createdAt"
		| "updatedAt"
		| "quoteNumber"
		| "title"
		| "status"
		| "expiresAt";
	sortDirection: "asc" | "desc";
	page: number;
	limit: number;
}) {
	const conditions = [eq(quotes.organizationId, input.organizationId)];
	if (!input.includeDeleted) {
		conditions.push(isNull(quotes.deletedAt));
	}
	if (input.statuses?.length) {
		conditions.push(inArray(quotes.status, input.statuses));
	} else {
		conditions.push(ne(quotes.status, "draft"));
	}
	if (input.documentVersion) {
		conditions.push(eq(quotes.documentVersion, input.documentVersion));
	}
	if (input.search) {
		const pattern = `%${input.search}%`;
		const searchCondition = or(
			ilike(quotes.title, pattern),
			ilike(quotes.quoteNumber, pattern),
			sql`exists (
				select 1
				from quote_participants qp
				join clients c
					on c.id = qp.client_id
					and c.organization_id = ${input.organizationId}
				where qp.quote_id = ${quotes.id}
					and qp.organization_id = ${input.organizationId}
					and c.name ilike ${pattern}
			)`,
		);
		if (searchCondition) {
			conditions.push(searchCondition);
		}
	}
	if (input.clientId) {
		conditions.push(sql`exists (
			select 1 from ${quoteParticipants} qp
			where qp.quote_id = ${quotes.id}
				and qp.organization_id = ${input.organizationId}
				and qp.client_id = ${input.clientId}
		)`);
	}
	const where = and(...conditions);
	const [totalRow] = await db
		.select({ value: count().mapWith(Number) })
		.from(quotes)
		.where(where);
	const orderColumn = quotes[input.sortBy];
	const rows = await db
		.select()
		.from(quotes)
		.where(where)
		.orderBy(
			input.sortDirection === "asc"
				? asc(orderColumn)
				: desc(orderColumn),
			desc(quotes.id),
		)
		.limit(input.limit)
		.offset((input.page - 1) * input.limit);
	const ids = rows.map((row) => row.id);
	const participants = ids.length
		? await db
				.select({
					quoteId: quoteParticipants.quoteId,
					isPrimary: quoteParticipants.isPrimary,
					clientId: clients.id,
					clientName: clients.name,
				})
				.from(quoteParticipants)
				.innerJoin(
					clients,
					and(
						eq(clients.id, quoteParticipants.clientId),
						eq(clients.organizationId, input.organizationId),
					),
				)
				.where(
					and(
						eq(
							quoteParticipants.organizationId,
							input.organizationId,
						),
						inArray(quoteParticipants.quoteId, ids),
					),
				)
		: [];
	const options = ids.length
		? await db
				.select({
					quoteId: quoteOptions.quoteId,
					totalAmount: quoteOptions.totalAmount,
				})
				.from(quoteOptions)
				.where(
					and(
						eq(quoteOptions.organizationId, input.organizationId),
						inArray(quoteOptions.quoteId, ids),
					),
				)
		: [];
	return {
		data: rows.map((quote) => {
			const quoteOptionsRows = options.filter(
				(item) => item.quoteId === quote.id,
			);
			const totals = quoteOptionsRows
				.map((item) => item.totalAmount)
				.sort((a, b) => Number(a) - Number(b));
			const primary =
				participants.find(
					(item) => item.quoteId === quote.id && item.isPrimary,
				) ?? participants.find((item) => item.quoteId === quote.id);
			return {
				id: quote.id,
				quoteNumber: quote.quoteNumber,
				version: quote.version,
				status: quote.status,
				title: quote.title,
				currency: quote.currency,
				expiresAt: iso(quote.expiresAt),
				createdAt: quote.createdAt.toISOString(),
				updatedAt: quote.updatedAt.toISOString(),
				deletedAt: iso(quote.deletedAt),
				primaryClient: primary
					? { id: primary.clientId, name: primary.clientName }
					: null,
				optionCount: quoteOptionsRows.length,
				minTotalAmount: totals[0] ?? null,
				maxTotalAmount: totals[totals.length - 1] ?? null,
			};
		}),
		total: totalRow?.value ?? 0,
	};
}

export async function getOrganizationQuote(
	organizationId: string,
	quoteId: string,
) {
	const quote = await db.query.quotes.findFirst({
		where: and(
			eq(quotes.id, quoteId),
			eq(quotes.organizationId, organizationId),
		),
	});
	if (!quote) {
		throw new ORPCError("NOT_FOUND", { message: "Quote not found" });
	}
	const participantRows = await db
		.select({
			id: quoteParticipants.id,
			clientId: quoteParticipants.clientId,
			role: quoteParticipants.role,
			side: quoteParticipants.side,
			isPrimary: quoteParticipants.isPrimary,
			sortOrder: quoteParticipants.sortOrder,
			clientName: clients.name,
			clientEmail: clients.email,
			clientPhoneNumber: clients.phoneNumber,
		})
		.from(quoteParticipants)
		.innerJoin(
			clients,
			and(
				eq(clients.id, quoteParticipants.clientId),
				eq(clients.organizationId, organizationId),
			),
		)
		.where(
			and(
				eq(quoteParticipants.quoteId, quote.id),
				eq(quoteParticipants.organizationId, organizationId),
			),
		)
		.orderBy(asc(quoteParticipants.sortOrder));
	const optionRows = await db.query.quoteOptions.findMany({
		where: and(
			eq(quoteOptions.quoteId, quote.id),
			eq(quoteOptions.organizationId, organizationId),
		),
		orderBy: (table, { asc }) => [asc(table.sortOrder)],
		with: {
			lineItems: { orderBy: (table, { asc }) => [asc(table.sortOrder)] },
		},
	});
	const acceptance = await db.query.quoteAcceptances.findFirst({
		where: and(
			eq(quoteAcceptances.quoteId, quote.id),
			eq(quoteAcceptances.organizationId, organizationId),
		),
	});
	const convertedBooking = await db.query.bookings.findFirst({
		where: and(
			eq(bookings.organizationId, organizationId),
			eq(bookings.sourceQuoteId, quote.id),
		),
		columns: {
			id: true,
			referenceNumber: true,
			status: true,
			deletedAt: true,
		},
	});
	const totals = optionRows
		.map((item) => item.totalAmount)
		.sort((a, b) => Number(a) - Number(b));
	const primary =
		participantRows.find((item) => item.isPrimary) ?? participantRows[0];
	return {
		id: quote.id,
		quoteNumber: quote.quoteNumber,
		version: quote.version,
		status: quote.status,
		title: quote.title,
		currency: quote.currency,
		expiresAt: iso(quote.expiresAt),
		createdAt: quote.createdAt.toISOString(),
		updatedAt: quote.updatedAt.toISOString(),
		deletedAt: iso(quote.deletedAt),
		primaryClient: primary
			? { id: primary.clientId, name: primary.clientName }
			: null,
		optionCount: optionRows.length,
		minTotalAmount: totals[0] ?? null,
		maxTotalAmount: totals[totals.length - 1] ?? null,
		supersedesQuoteId: quote.supersedesQuoteId,
		terms: (quote.terms as string[] | null) ?? null,
		clientMessage: quote.clientMessage,
		internalNotes: quote.internalNotes,
		documentVersion: quote.documentVersion,
		document: quote.document
			? quotationDocumentV1Schema.parse(quote.document)
			: null,
		documentSha256: quote.documentSha256,
		documentRevision: quote.documentRevision,
		brandingSnapshot: quote.brandingSnapshot
			? quotationBrandingSnapshotV1Schema.parse(quote.brandingSnapshot)
			: null,
		pdfSnapshot: buildQuotationPdfSnapshot(quote),
		sentAt: iso(quote.sentAt),
		convertedAt: iso(quote.convertedAt),
		declinedAt: iso(quote.declinedAt),
		expiredAt: iso(quote.expiredAt),
		supersededAt: iso(quote.supersededAt),
		participants: participantRows.map((item) => ({
			id: item.id,
			clientId: item.clientId,
			role: item.role,
			side: item.side,
			isPrimary: item.isPrimary,
			sortOrder: item.sortOrder,
			client: {
				id: item.clientId,
				name: item.clientName,
				email: item.clientEmail,
				phoneNumber: item.clientPhoneNumber,
			},
		})),
		options: optionRows.map((option) => ({
			id: option.id,
			name: option.name,
			description: option.description ?? undefined,
			subtotal: option.subtotal,
			discountAmount: option.discountAmount,
			taxAmount: option.taxAmount,
			totalAmount: option.totalAmount,
			bookingBlueprint: bookingBlueprintSchema.parse(
				option.bookingBlueprint,
			),
			isRecommended: option.isRecommended,
			sortOrder: option.sortOrder,
			lineItems: option.lineItems.map((item) => ({
				type: item.type,
				description: item.description,
				quantity: item.quantity ?? undefined,
				unitPrice: item.unitPrice ?? undefined,
				amount: item.amount,
				sortOrder: item.sortOrder,
			})),
		})),
		acceptance: acceptance
			? {
					quoteOptionId: acceptance.quoteOptionId,
					acceptedAt: acceptance.acceptedAt.toISOString(),
					acceptedBy: acceptance.acceptedBy,
					optionSnapshot: acceptedQuoteOptionSnapshotSchema.parse(
						acceptance.optionSnapshot,
					),
				}
			: null,
		convertedBooking: convertedBooking
			? {
					...convertedBooking,
					deletedAt: iso(convertedBooking.deletedAt),
				}
			: null,
	};
}
