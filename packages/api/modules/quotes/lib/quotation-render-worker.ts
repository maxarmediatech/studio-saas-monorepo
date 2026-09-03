import {
	and,
	db,
	eq,
	quotationPdfRenderIntents,
	quotationPresentations,
	quotes,
} from "@repo/database";
import { createActivityWithExecutor } from "../../activities/lib";
import { quotationBrandingSnapshotV1Schema } from "../../studio/schemas/quotation-document";
import { renderAndStoreFrozenQuotationPdf } from "./quotation-render-artifact";

type WorkerResult = {
	id: string;
	status: "completed" | "rendering" | "returned_to_draft";
};

async function claimRenderIntent(renderIntentId: string) {
	const hint = await db.query.quotationPdfRenderIntents.findFirst({
		where: eq(quotationPdfRenderIntents.id, renderIntentId),
		columns: { quoteId: true, organizationId: true },
	});
	if (!hint) {
		throw new Error("Quotation PDF render intent not found");
	}
	return db.transaction(async (tx) => {
		const [quote] = await tx
			.select()
			.from(quotes)
			.where(
				and(
					eq(quotes.id, hint.quoteId),
					eq(quotes.organizationId, hint.organizationId),
				),
			)
			.for("update");
		if (!quote) {
			throw new Error("Quotation for render intent not found");
		}
		const [presentation] = await tx
			.select()
			.from(quotationPresentations)
			.where(eq(quotationPresentations.quoteId, quote.id))
			.for("update");
		const [intent] = await tx
			.select()
			.from(quotationPdfRenderIntents)
			.where(eq(quotationPdfRenderIntents.id, renderIntentId))
			.for("update");
		if (!presentation || !intent) {
			throw new Error("Quotation PDF render identity is incomplete");
		}
		if (intent.status === "completed") {
			return {
				kind: "settled" as const,
				result: { id: intent.id, status: "completed" as const },
			};
		}
		if (intent.status === "rendering") {
			return {
				kind: "settled" as const,
				result: { id: intent.id, status: "rendering" as const },
			};
		}
		if (intent.status === "returned_to_draft") {
			return {
				kind: "settled" as const,
				result: { id: intent.id, status: "returned_to_draft" as const },
			};
		}
		if (
			(quote.status !== "draft" && quote.status !== "preparing") ||
			quote.version !== intent.quoteVersion ||
			quote.documentRevision !== intent.documentRevision ||
			presentation.selectionVersion !== intent.selectionVersion ||
			presentation.templateId !== intent.templateId ||
			presentation.templateVersion !== intent.templateVersion
		) {
			throw new Error(
				"Quotation PDF render intent no longer matches quotation",
			);
		}
		const now = new Date();
		const [claimed] = await tx
			.update(quotationPdfRenderIntents)
			.set({
				status: "rendering",
				attemptCount: intent.attemptCount + 1,
				lastAttemptAt: now,
				lastErrorCode: null,
				lastErrorMessage: null,
				updatedAt: now,
			})
			.where(eq(quotationPdfRenderIntents.id, intent.id))
			.returning();
		if (!claimed) {
			throw new Error("Failed to claim quotation PDF render intent");
		}
		return { kind: "claimed" as const, intent: claimed };
	});
}

function errorDetails(error: unknown): { code: string; message: string } {
	const record = error as { code?: unknown; message?: unknown };
	return {
		code:
			typeof record?.code === "string"
				? record.code.slice(0, 100)
				: "RENDER_FAILED",
		message:
			typeof record?.message === "string"
				? record.message.slice(0, 2000)
				: "Quotation PDF render failed",
	};
}

async function markRenderFailed(renderIntentId: string, error: unknown) {
	const details = errorDetails(error);
	const hint = await db.query.quotationPdfRenderIntents.findFirst({
		where: eq(quotationPdfRenderIntents.id, renderIntentId),
		columns: { quoteId: true, organizationId: true },
	});
	if (!hint) {
		return;
	}
	await db.transaction(async (tx) => {
		const [quote] = await tx
			.select({ id: quotes.id })
			.from(quotes)
			.where(
				and(
					eq(quotes.id, hint.quoteId),
					eq(quotes.organizationId, hint.organizationId),
				),
			)
			.for("update");
		if (!quote) {
			return;
		}
		await tx
			.select({ quoteId: quotationPresentations.quoteId })
			.from(quotationPresentations)
			.where(eq(quotationPresentations.quoteId, quote.id))
			.for("update");
		const [intent] = await tx
			.select({ status: quotationPdfRenderIntents.status })
			.from(quotationPdfRenderIntents)
			.where(eq(quotationPdfRenderIntents.id, renderIntentId))
			.for("update");
		if (intent?.status !== "rendering") {
			return;
		}
		await tx
			.update(quotationPdfRenderIntents)
			.set({
				status: "failed",
				lastErrorCode: details.code,
				lastErrorMessage: details.message,
				updatedAt: new Date(),
			})
			.where(eq(quotationPdfRenderIntents.id, renderIntentId));
	});
}

export async function processQuotationPdfRenderIntent(
	renderIntentId: string,
): Promise<WorkerResult> {
	const claim = await claimRenderIntent(renderIntentId);
	if (claim.kind === "settled") {
		return claim.result;
	}
	const { intent } = claim;
	try {
		const artifact = await renderAndStoreFrozenQuotationPdf(intent);
		const branding = quotationBrandingSnapshotV1Schema.parse(
			intent.brandingSnapshot,
		);
		const { storageKey, sha256, pageCount, byteSize, renderedAt } =
			artifact;
		await db.transaction(async (tx) => {
			const [quote] = await tx
				.select()
				.from(quotes)
				.where(
					and(
						eq(quotes.id, intent.quoteId),
						eq(quotes.organizationId, intent.organizationId),
					),
				)
				.for("update");
			const [presentation] = await tx
				.select()
				.from(quotationPresentations)
				.where(eq(quotationPresentations.quoteId, intent.quoteId))
				.for("update");
			const [lockedIntent] = await tx
				.select()
				.from(quotationPdfRenderIntents)
				.where(eq(quotationPdfRenderIntents.id, intent.id))
				.for("update");
			if (lockedIntent?.status === "completed") {
				return;
			}
			if (
				!quote ||
				!presentation ||
				lockedIntent?.status !== "rendering" ||
				(quote.status !== "draft" && quote.status !== "preparing") ||
				quote.version !== intent.quoteVersion ||
				quote.documentRevision !== intent.documentRevision ||
				presentation.selectionVersion !== intent.selectionVersion
			) {
				throw new Error("Quotation changed before PDF completion");
			}
			await tx
				.update(quotationPdfRenderIntents)
				.set({
					status: "completed",
					artifactStorageKey: storageKey,
					artifactSha256: sha256,
					artifactRenderedAt: renderedAt,
					artifactPageCount: pageCount,
					artifactByteSize: byteSize,
					completedAt: renderedAt,
					updatedAt: renderedAt,
				})
				.where(eq(quotationPdfRenderIntents.id, intent.id));
			await tx
				.update(quotes)
				.set({
					status: "sent",
					sentAt: renderedAt,
					brandingSnapshot: branding,
					pdfStorageKey: storageKey,
					pdfSha256: sha256,
					pdfRenderedAt: renderedAt,
					pdfRendererVersion: intent.rendererVersion,
					pdfPageCount: pageCount,
					pdfByteSize: byteSize,
					pdfRenderIntentId: intent.id,
					updatedAt: renderedAt,
				})
				.where(eq(quotes.id, quote.id));
			await createActivityWithExecutor(tx, {
				organizationId: intent.organizationId,
				actorId: intent.id,
				actorType: "system",
				actorName: "Quotation PDF renderer",
				entityType: "quote",
				entityId: quote.id,
				entityName: quote.title,
				action: "status_changed",
				field: "status",
				oldValue: quote.status,
				newValue: "sent",
				metadata: {
					pdfEvidence: {
						kind: "template",
						renderIntentId: intent.id,
						templateId: intent.templateId,
						templateVersion: intent.templateVersion,
					},
					pdfSha256: sha256,
					pageCount,
					byteSize,
					rendererVersion: intent.rendererVersion,
				},
			});
		});
		return { id: intent.id, status: "completed" };
	} catch (error) {
		await markRenderFailed(intent.id, error);
		throw error;
	}
}
