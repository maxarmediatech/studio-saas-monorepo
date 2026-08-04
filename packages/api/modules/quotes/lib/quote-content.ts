import { ORPCError } from "@orpc/server";
import {
	and,
	clients,
	eq,
	inArray,
	isNull,
	quoteLineItems,
	quoteOptions,
	quoteParticipants,
} from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import {
	bookingBlueprintSchema,
	type QuoteDraftContentInput,
	quoteDraftContentInputSchema,
} from "../../studio/schemas/quote";
import {
	findInvalidParticipantClients,
	normalizeQuoteContent,
} from "./quote-normalization";

export async function validateQuoteParticipants(
	tx: TransactionClient,
	organizationId: string,
	participants: QuoteDraftContentInput["participants"],
): Promise<void> {
	const uniqueIds = [...new Set(participants.map((item) => item.clientId))];
	const rows = await tx
		.select({ id: clients.id })
		.from(clients)
		.where(
			and(
				eq(clients.organizationId, organizationId),
				isNull(clients.deletedAt),
				inArray(clients.id, uniqueIds),
			),
		);
	const invalid = findInvalidParticipantClients(
		participants,
		rows.map((row) => row.id),
	);
	if (invalid.length > 0) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Active organization client(s) not found: ${invalid.join(", ")}`,
		});
	}
	const keys = participants.map((item) => `${item.clientId}\0${item.role}`);
	if (new Set(keys).size !== keys.length) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Duplicate participant client and role",
		});
	}
}

export async function replaceQuoteContent(
	tx: TransactionClient,
	params: {
		quoteId: string;
		organizationId: string;
		content: QuoteDraftContentInput;
	},
): Promise<void> {
	const content = normalizeQuoteContent(
		quoteDraftContentInputSchema.parse(params.content),
	);
	await validateQuoteParticipants(
		tx,
		params.organizationId,
		content.participants,
	);

	await tx
		.delete(quoteParticipants)
		.where(
			and(
				eq(quoteParticipants.quoteId, params.quoteId),
				eq(quoteParticipants.organizationId, params.organizationId),
			),
		);
	await tx
		.delete(quoteOptions)
		.where(
			and(
				eq(quoteOptions.quoteId, params.quoteId),
				eq(quoteOptions.organizationId, params.organizationId),
			),
		);

	await tx.insert(quoteParticipants).values(
		content.participants.map((participant) => ({
			organizationId: params.organizationId,
			quoteId: params.quoteId,
			clientId: participant.clientId,
			role: participant.role,
			side: participant.side ?? null,
			isPrimary: participant.isPrimary,
			sortOrder: participant.sortOrder,
		})),
	);

	for (const option of content.options) {
		const [created] = await tx
			.insert(quoteOptions)
			.values({
				organizationId: params.organizationId,
				quoteId: params.quoteId,
				name: option.name,
				description: option.description ?? null,
				subtotal: option.subtotal,
				discountAmount: option.discountAmount,
				taxAmount: option.taxAmount,
				totalAmount: option.totalAmount,
				bookingBlueprintVersion: option.bookingBlueprint.schemaVersion,
				bookingBlueprint: option.bookingBlueprint,
				isRecommended: option.isRecommended,
				sortOrder: option.sortOrder,
			})
			.returning({ id: quoteOptions.id });
		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create quote option",
			});
		}
		await tx.insert(quoteLineItems).values(
			option.lineItems.map((item) => ({
				organizationId: params.organizationId,
				quoteOptionId: created.id,
				type: item.type,
				description: item.description,
				quantity: item.quantity ?? null,
				unitPrice: item.unitPrice ?? null,
				amount: item.amount,
				sortOrder: item.sortOrder,
			})),
		);
	}
}

export async function readQuoteContent(
	tx: TransactionClient,
	organizationId: string,
	quoteId: string,
): Promise<QuoteDraftContentInput> {
	const quote = await tx.query.quotes.findFirst({
		where: (table, { and, eq }) =>
			and(
				eq(table.id, quoteId),
				eq(table.organizationId, organizationId),
			),
	});
	if (!quote) {
		throw new ORPCError("NOT_FOUND", { message: "Quote not found" });
	}
	const participants = await tx.query.quoteParticipants.findMany({
		where: and(
			eq(quoteParticipants.quoteId, quoteId),
			eq(quoteParticipants.organizationId, organizationId),
		),
		orderBy: (table, { asc }) => [asc(table.sortOrder)],
	});
	const options = await tx.query.quoteOptions.findMany({
		where: and(
			eq(quoteOptions.quoteId, quoteId),
			eq(quoteOptions.organizationId, organizationId),
		),
		orderBy: (table, { asc }) => [asc(table.sortOrder)],
		with: {
			lineItems: { orderBy: (table, { asc }) => [asc(table.sortOrder)] },
		},
	});
	return quoteDraftContentInputSchema.parse({
		title: quote.title,
		currency: quote.currency,
		expiresAt: quote.expiresAt?.toISOString(),
		terms: quote.terms ?? undefined,
		clientMessage: quote.clientMessage ?? undefined,
		internalNotes: quote.internalNotes ?? undefined,
		participants: participants.map((item) => ({
			clientId: item.clientId,
			role: item.role,
			side: item.side ?? undefined,
			isPrimary: item.isPrimary,
		})),
		options: options.map((option) => ({
			name: option.name,
			description: option.description ?? undefined,
			discountAmount: option.discountAmount,
			taxAmount: option.taxAmount,
			bookingBlueprint: bookingBlueprintSchema.parse(
				option.bookingBlueprint,
			),
			isRecommended: option.isRecommended,
			lineItems: option.lineItems.map((item) => ({
				type: item.type,
				description: item.description,
				quantity: item.quantity ?? undefined,
				unitPrice: item.unitPrice ?? undefined,
				amount:
					item.type === "milestone" || item.type === "expense"
						? item.amount
						: undefined,
			})),
		})),
	});
}
