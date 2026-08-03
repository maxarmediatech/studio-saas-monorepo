import { ORPCError } from "@orpc/server";
import {
	and,
	eq,
	quoteLineItems,
	quoteOptions,
	quoteParticipants,
} from "@repo/database";
import type { TransactionClient } from "../../studio/lib/transactions";
import type {
	BookingBlueprintV2,
	QuotationDocumentV1,
} from "../../studio/schemas/quotation-document";
import { assembleBookingBlueprintV2 } from "./quotation-document";

export async function replaceNormalizedDocumentChildren(
	tx: TransactionClient,
	organizationId: string,
	quoteId: string,
	document: QuotationDocumentV1,
): Promise<void> {
	await tx
		.delete(quoteParticipants)
		.where(
			and(
				eq(quoteParticipants.organizationId, organizationId),
				eq(quoteParticipants.quoteId, quoteId),
			),
		);
	await tx
		.delete(quoteOptions)
		.where(
			and(
				eq(quoteOptions.organizationId, organizationId),
				eq(quoteOptions.quoteId, quoteId),
			),
		);
	const resolvedParticipants = document.participants.filter(
		(
			participant,
		): participant is typeof participant & { clientId: string } =>
			Boolean(participant.clientId && participant.contact.name),
	);
	if (resolvedParticipants.length > 0) {
		await tx.insert(quoteParticipants).values(
			resolvedParticipants.map((participant, index) => ({
				organizationId,
				quoteId,
				clientId: participant.clientId,
				role: index === 0 ? "primary_client" : "client",
				isPrimary: index === 0,
				documentKey: participant.key,
				contactSnapshot: participant.contact,
				sortOrder: index,
			})),
		);
	}
	for (const [index, item] of document.packages.entries()) {
		if (!item.name.trim() || item.price === null) {
			continue;
		}
		let blueprint: BookingBlueprintV2;
		try {
			blueprint = assembleBookingBlueprintV2(document, item.key);
		} catch {
			continue;
		}
		const [option] = await tx
			.insert(quoteOptions)
			.values({
				organizationId,
				quoteId,
				name: item.name,
				description: item.summary,
				subtotal: item.price,
				discountAmount: "0",
				taxAmount: "0",
				totalAmount: item.price,
				bookingBlueprintVersion: 2,
				bookingBlueprint: blueprint,
				isRecommended: item.key === document.recommendedPackageKey,
				documentKey: item.key,
				sortOrder: index,
			})
			.returning({ id: quoteOptions.id });
		if (!option) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to normalize package",
			});
		}
		await tx.insert(quoteLineItems).values({
			organizationId,
			quoteOptionId: option.id,
			type: "service",
			description: item.name,
			quantity: "1",
			unitPrice: item.price,
			amount: item.price,
			sortOrder: 0,
		});
	}
}
