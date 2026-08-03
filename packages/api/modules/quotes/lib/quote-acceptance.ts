import { ORPCError } from "@orpc/server";
import {
	and,
	db,
	eq,
	isNull,
	quoteAcceptances,
	quoteOptions,
	quotes,
} from "@repo/database";
import { trackActivityWithExecutor } from "../../activities/lib";
import {
	acceptedQuoteOptionSnapshotSchema,
	bookingBlueprintSchema,
} from "../../studio/schemas/quote";
import { isQuoteExpiryDue } from "./quote-lifecycle";
import type { QuoteServiceContext } from "./quote-service";

export async function acceptQuote(
	context: QuoteServiceContext,
	quoteId: string,
	quoteOptionId: string,
) {
	return db.transaction(async (tx) => {
		const [quote] = await tx
			.select()
			.from(quotes)
			.where(
				and(
					eq(quotes.id, quoteId),
					eq(quotes.organizationId, context.organizationId),
					isNull(quotes.deletedAt),
				),
			)
			.for("update");
		if (!quote) {
			throw new ORPCError("NOT_FOUND", { message: "Quote not found" });
		}
		if (quote.status !== "sent") {
			const prior = await tx.query.quoteAcceptances.findFirst({
				where: and(
					eq(quoteAcceptances.quoteId, quote.id),
					eq(quoteAcceptances.organizationId, context.organizationId),
				),
			});
			if (prior?.quoteOptionId === quoteOptionId) {
				return { id: quote.id };
			}
			if (prior) {
				throw new ORPCError("CONFLICT", {
					message: "Quote was accepted with a different option",
				});
			}
			throw new ORPCError("CONFLICT", {
				message: "Only sent quotes can be accepted",
			});
		}
		const now = new Date();
		if (isQuoteExpiryDue(quote.expiresAt, now)) {
			throw new ORPCError("CONFLICT", { message: "Quote has expired" });
		}
		const option = await tx.query.quoteOptions.findFirst({
			where: and(
				eq(quoteOptions.id, quoteOptionId),
				eq(quoteOptions.quoteId, quoteId),
				eq(quoteOptions.organizationId, context.organizationId),
			),
			with: {
				lineItems: {
					orderBy: (table, { asc }) => [asc(table.sortOrder)],
				},
			},
		});
		if (!option) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Quote option not found",
			});
		}
		const snapshot = acceptedQuoteOptionSnapshotSchema.parse({
			quoteId: quote.id,
			quoteOptionId: option.id,
			quoteNumber: quote.quoteNumber,
			quoteVersion: quote.version,
			currency: quote.currency,
			acceptedAt: now.toISOString(),
			option: {
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
			},
		});
		await tx.insert(quoteAcceptances).values({
			quoteId: quote.id,
			organizationId: context.organizationId,
			quoteOptionId: option.id,
			optionSnapshot: snapshot,
			acceptedAt: now,
			acceptedBy: context.user.id,
		});
		await tx
			.update(quotes)
			.set({
				status: "accepted",
				updatedAt: now,
				updatedBy: context.user.id,
			})
			.where(
				and(
					eq(quotes.id, quote.id),
					eq(quotes.organizationId, context.organizationId),
				),
			);
		await trackActivityWithExecutor(
			tx,
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "quote",
				entityId: quote.id,
				entityName: quote.title,
				action: "status_changed",
				field: "status",
				oldValue: "sent",
				newValue: "accepted",
			},
		);
		return { id: quote.id };
	});
}
