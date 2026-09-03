import { ORPCError } from "@orpc/server";
import {
	and,
	db,
	eq,
	isNull,
	quotationPdfRenderIntents,
	quotationPresentations,
	quotes,
} from "@repo/database";
import {
	implicitClassicPresentation,
	type QuotationPresentationIdentity,
} from "./quotation-presentation-service";

function conflict(
	message: string,
	current: QuotationPresentationIdentity,
): never {
	throw new ORPCError("CONFLICT", { message, data: { current } });
}

export async function findExistingAcceptedQuotationPdfIntent(
	organizationId: string,
	input: {
		quoteId: string;
		expectedDocumentRevision: number;
		expectedSelectionVersion: number | null;
	},
) {
	return db.transaction(async (tx) => {
		const [quote] = await tx
			.select()
			.from(quotes)
			.where(
				and(
					eq(quotes.id, input.quoteId),
					eq(quotes.organizationId, organizationId),
					isNull(quotes.deletedAt),
				),
			)
			.for("update");
		if (!quote || quote.documentVersion !== 1) {
			throw new ORPCError("NOT_FOUND", {
				message: "Quotation draft not found",
			});
		}
		const [presentation] = await tx
			.select()
			.from(quotationPresentations)
			.where(eq(quotationPresentations.quoteId, quote.id))
			.for("update");
		const current = presentation
			? {
					documentRevision: quote.documentRevision,
					selectionVersion: presentation.selectionVersion,
					templateId: presentation.templateId,
					templateVersion: presentation.templateVersion,
				}
			: implicitClassicPresentation(quote.documentRevision);
		if (quote.documentRevision !== input.expectedDocumentRevision) {
			conflict(
				"Quotation document revision changed before send",
				current,
			);
		}
		const materializedImplicitDuplicate =
			quote.status === "preparing" &&
			input.expectedSelectionVersion === null &&
			presentation?.selectionVersion === 1;
		if (
			!materializedImplicitDuplicate &&
			(presentation?.selectionVersion ?? null) !==
				input.expectedSelectionVersion
		) {
			conflict(
				"Quotation template selection changed before send",
				current,
			);
		}
		if (!presentation) {
			if (quote.status !== "draft") {
				throw new ORPCError("CONFLICT", {
					message: "Quotation is not sendable",
					data: { current },
				});
			}
			return null;
		}
		const idempotencyKey = `${quote.id}:${quote.documentRevision}:${presentation.selectionVersion}`;
		const [existing] = await tx
			.select()
			.from(quotationPdfRenderIntents)
			.where(
				and(
					eq(
						quotationPdfRenderIntents.organizationId,
						organizationId,
					),
					eq(quotationPdfRenderIntents.quoteId, quote.id),
					eq(
						quotationPdfRenderIntents.idempotencyKey,
						idempotencyKey,
					),
				),
			)
			.for("update");
		if (existing) {
			return existing;
		}
		if (quote.status !== "draft") {
			throw new ORPCError("CONFLICT", {
				message: "Quotation is not sendable",
			});
		}
		return null;
	});
}
