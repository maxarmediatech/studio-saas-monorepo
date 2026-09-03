import { createHash } from "node:crypto";
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
import { logger } from "@repo/logs";
import { trackActivityWithExecutor } from "../../activities/lib";
import type { StudioContext } from "../../studio/lib/permissions";
import { strictQuotationDocumentV1Schema } from "../../studio/schemas/quotation-document";
import {
	assertQuotationPdfTemplateCompatibility,
	quotationPdfTemplateRegistry,
} from "../pdf/registry";
import { canonicalQuotationJson } from "./quotation-document";
import { resolveQuotationBranding } from "./quotation-pdf-service";
import {
	implicitClassicPresentation,
	type QuotationPresentationIdentity,
} from "./quotation-presentation-service";
import type { FrozenQuotationPdfSource } from "./quotation-render-contract";
import { findExistingAcceptedQuotationPdfIntent } from "./quotation-render-existing-intent";
import { processQuotationPdfRenderIntent } from "./quotation-render-worker";

type Context = Pick<StudioContext, "organizationId" | "user">;
type IntentStatus =
	| "pending"
	| "rendering"
	| "failed"
	| "returned_to_draft"
	| "completed";

export interface QuotationRenderIntentIdentity {
	id: string;
	quoteId: string;
	status: IntentStatus;
	documentRevision: number;
	selectionVersion: number;
	templateId: string;
	templateVersion: number;
}

function fingerprint(value: unknown): string {
	return createHash("sha256")
		.update(canonicalQuotationJson(value))
		.digest("hex");
}

function serializeIntent(intent: {
	id: string;
	quoteId: string;
	status: IntentStatus;
	documentRevision: number;
	selectionVersion: number;
	templateId: string;
	templateVersion: number;
}): QuotationRenderIntentIdentity {
	return {
		id: intent.id,
		quoteId: intent.quoteId,
		status: intent.status,
		documentRevision: intent.documentRevision,
		selectionVersion: intent.selectionVersion,
		templateId: intent.templateId,
		templateVersion: intent.templateVersion,
	};
}

function conflict(
	message: string,
	current: QuotationPresentationIdentity,
): never {
	throw new ORPCError("CONFLICT", { message, data: { current } });
}

async function renderAcceptedIntent(
	context: Context,
	accepted: QuotationRenderIntentIdentity,
): Promise<QuotationRenderIntentIdentity> {
	try {
		const result = await processQuotationPdfRenderIntent(accepted.id);
		if (result.status === "completed") {
			return { ...accepted, status: "completed" };
		}
		throw new ORPCError("CONFLICT", {
			message:
				result.status === "rendering"
					? "Quotation PDF generation is already in progress"
					: "Quotation PDF generation was returned to draft",
		});
	} catch (error) {
		if (error instanceof ORPCError) {
			throw error;
		}
		logger.error("quotation.pdf.render_failed", {
			organizationId: context.organizationId,
			quoteId: accepted.quoteId,
			renderIntentId: accepted.id,
			error,
		});
		try {
			await transitionFailedIntent(
				context,
				{
					quoteId: accepted.quoteId,
					renderIntentId: accepted.id,
					expectedDocumentRevision: accepted.documentRevision,
					expectedSelectionVersion: accepted.selectionVersion,
				},
				"returned_to_draft",
			);
		} catch (recoveryError) {
			logger.error("quotation.pdf.return_to_draft_failed", {
				organizationId: context.organizationId,
				quoteId: accepted.quoteId,
				renderIntentId: accepted.id,
				error: recoveryError,
			});
		}
		throw new ORPCError("BAD_REQUEST", {
			message:
				"Could not generate the quotation PDF. The quotation remains a draft. Try again.",
		});
	}
}

async function resumeReturnedIntent(
	context: Context,
	accepted: QuotationRenderIntentIdentity,
): Promise<QuotationRenderIntentIdentity> {
	return db.transaction(async (tx) => {
		const [quote] = await tx
			.select()
			.from(quotes)
			.where(
				and(
					eq(quotes.id, accepted.quoteId),
					eq(quotes.organizationId, context.organizationId),
					isNull(quotes.deletedAt),
				),
			)
			.for("update");
		const [presentation] = await tx
			.select()
			.from(quotationPresentations)
			.where(eq(quotationPresentations.quoteId, accepted.quoteId))
			.for("update");
		const [intent] = await tx
			.select()
			.from(quotationPdfRenderIntents)
			.where(eq(quotationPdfRenderIntents.id, accepted.id))
			.for("update");
		if (
			!quote ||
			!presentation ||
			!intent ||
			quote.status !== "draft" ||
			intent.status !== "returned_to_draft" ||
			quote.documentRevision !== accepted.documentRevision ||
			presentation.selectionVersion !== accepted.selectionVersion
		) {
			throw new ORPCError("CONFLICT", {
				message: "Quotation is not ready to generate",
			});
		}
		const now = new Date();
		const [resumed] = await tx
			.update(quotationPdfRenderIntents)
			.set({
				status: "pending",
				taskId: null,
				lastErrorCode: null,
				lastErrorMessage: null,
				updatedAt: now,
			})
			.where(eq(quotationPdfRenderIntents.id, intent.id))
			.returning();
		if (!resumed) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to resume quotation PDF generation",
			});
		}
		return serializeIntent(resumed);
	});
}

export async function startQuotationPdfSend(
	context: Context,
	input: {
		quoteId: string;
		expectedDocumentRevision: number;
		expectedSelectionVersion: number | null;
	},
): Promise<QuotationRenderIntentIdentity> {
	const existing = await findExistingAcceptedQuotationPdfIntent(
		context.organizationId,
		input,
	);
	if (existing) {
		const serialized = serializeIntent(existing);
		const accepted =
			serialized.status === "returned_to_draft"
				? await resumeReturnedIntent(context, serialized)
				: serialized;
		return renderAcceptedIntent(context, accepted);
	}
	const resolvedBranding = await resolveQuotationBranding(
		context.organizationId,
	);
	const accepted = await db.transaction(async (tx) => {
		const [quote] = await tx
			.select()
			.from(quotes)
			.where(
				and(
					eq(quotes.id, input.quoteId),
					eq(quotes.organizationId, context.organizationId),
					isNull(quotes.deletedAt),
				),
			)
			.for("update");
		if (!quote || quote.documentVersion !== 1) {
			throw new ORPCError("NOT_FOUND", {
				message: "Quotation draft not found",
			});
		}
		let [presentation] = await tx
			.select()
			.from(quotationPresentations)
			.where(eq(quotationPresentations.quoteId, quote.id))
			.for("update");
		const initialCurrent = presentation
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
				initialCurrent,
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
				initialCurrent,
			);
		}
		if (!presentation) {
			if (quote.status !== "draft") {
				throw new ORPCError("CONFLICT", {
					message: "Quotation is not sendable",
					data: { current: initialCurrent },
				});
			}
			const now = new Date();
			[presentation] = await tx
				.insert(quotationPresentations)
				.values({
					quoteId: quote.id,
					organizationId: context.organizationId,
					templateId: initialCurrent.templateId,
					templateVersion: initialCurrent.templateVersion,
					selectionVersion: 1,
					selectedBy: context.user.id,
					selectedAt: now,
					createdAt: now,
					updatedAt: now,
				})
				.returning();
		}
		if (!presentation) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to materialize quotation presentation",
			});
		}
		const idempotencyKey = `${quote.id}:${quote.documentRevision}:${presentation.selectionVersion}`;
		const [existing] = await tx
			.select()
			.from(quotationPdfRenderIntents)
			.where(
				and(
					eq(
						quotationPdfRenderIntents.organizationId,
						context.organizationId,
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
			if (existing.status === "returned_to_draft") {
				throw new ORPCError("CONFLICT", {
					message:
						"Change the template selection before sending again",
					data: {
						current: {
							documentRevision: quote.documentRevision,
							selectionVersion: presentation.selectionVersion,
							templateId: presentation.templateId,
							templateVersion: presentation.templateVersion,
						},
					},
				});
			}
			return serializeIntent(existing);
		}
		if (quote.status !== "draft") {
			throw new ORPCError("CONFLICT", {
				message: "Quotation is not sendable",
			});
		}
		const document = strictQuotationDocumentV1Schema.parse(quote.document);
		const { branding, logoDataUri } = resolvedBranding;
		const template = quotationPdfTemplateRegistry.getActive(
			presentation.templateId,
			presentation.templateVersion,
		);
		assertQuotationPdfTemplateCompatibility(template, {
			document,
			branding,
			quoteNumber: quote.quoteNumber,
			quoteVersion: quote.version,
			validUntil: quote.expiresAt?.toISOString() ?? null,
			createdAt: quote.createdAt.toISOString(),
		});
		const source: FrozenQuotationPdfSource = {
			schemaVersion: 1,
			document,
			quoteNumber: quote.quoteNumber,
			quoteVersion: quote.version,
			validUntil: quote.expiresAt?.toISOString() ?? null,
			createdAt: quote.createdAt.toISOString(),
			logoDataUri,
		};
		const now = new Date();
		const [intent] = await tx
			.insert(quotationPdfRenderIntents)
			.values({
				organizationId: context.organizationId,
				quoteId: quote.id,
				quoteVersion: quote.version,
				documentRevision: quote.documentRevision,
				selectionVersion: presentation.selectionVersion,
				sourceDocument: source,
				sourceFingerprint: fingerprint(source.document),
				brandingSnapshot: branding,
				brandingFingerprint: fingerprint(branding),
				templateId: template.manifest.id,
				templateVersion: template.manifest.version,
				copyProfileVersion: template.copyProfile.version,
				composerVersion: template.manifest.composerVersion,
				rendererVersion: template.manifest.rendererVersion,
				idempotencyKey,
				status: "pending",
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		if (!intent) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create quotation render intent",
			});
		}
		return serializeIntent(intent);
	});
	return renderAcceptedIntent(context, accepted);
}

async function transitionFailedIntent(
	context: Context,
	input: {
		quoteId: string;
		renderIntentId: string;
		expectedDocumentRevision: number;
		expectedSelectionVersion: number;
	},
	target: "pending" | "returned_to_draft",
): Promise<QuotationRenderIntentIdentity> {
	const result = await db.transaction(async (tx) => {
		const [quote] = await tx
			.select()
			.from(quotes)
			.where(
				and(
					eq(quotes.id, input.quoteId),
					eq(quotes.organizationId, context.organizationId),
					isNull(quotes.deletedAt),
				),
			)
			.for("update");
		if (!quote) {
			throw new ORPCError("NOT_FOUND", {
				message: "Quotation not found",
			});
		}
		const [presentation] = await tx
			.select()
			.from(quotationPresentations)
			.where(eq(quotationPresentations.quoteId, quote.id))
			.for("update");
		if (!presentation) {
			throw new ORPCError("CONFLICT", {
				message: "Quotation presentation is missing",
			});
		}
		const current = {
			documentRevision: quote.documentRevision,
			selectionVersion: presentation.selectionVersion,
			templateId: presentation.templateId,
			templateVersion: presentation.templateVersion,
		};
		if (
			quote.documentRevision !== input.expectedDocumentRevision ||
			presentation.selectionVersion !== input.expectedSelectionVersion
		) {
			conflict("Quotation presentation changed", current);
		}
		const [intent] = await tx
			.select()
			.from(quotationPdfRenderIntents)
			.where(
				and(
					eq(quotationPdfRenderIntents.id, input.renderIntentId),
					eq(quotationPdfRenderIntents.quoteId, quote.id),
					eq(
						quotationPdfRenderIntents.organizationId,
						context.organizationId,
					),
				),
			)
			.for("update");
		if (!intent) {
			throw new ORPCError("NOT_FOUND", {
				message: "Quotation render intent not found",
			});
		}
		if (
			(quote.status !== "draft" && quote.status !== "preparing") ||
			intent.status !== "failed" ||
			intent.documentRevision !== quote.documentRevision ||
			intent.selectionVersion !== presentation.selectionVersion
		) {
			throw new ORPCError("CONFLICT", {
				message:
					"Quotation render intent is not eligible for this action",
				data: { current },
			});
		}
		const now = new Date();
		const [updated] = await tx
			.update(quotationPdfRenderIntents)
			.set({
				status: target,
				taskId: target === "pending" ? null : intent.taskId,
				lastErrorCode:
					target === "pending" ? null : intent.lastErrorCode,
				lastErrorMessage:
					target === "pending" ? null : intent.lastErrorMessage,
				updatedAt: now,
			})
			.where(eq(quotationPdfRenderIntents.id, intent.id))
			.returning();
		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to transition quotation render intent",
			});
		}
		if (target === "returned_to_draft" && quote.status === "preparing") {
			await tx
				.update(quotes)
				.set({
					status: "draft",
					updatedAt: now,
					updatedBy: context.user.id,
				})
				.where(eq(quotes.id, quote.id));
			await trackActivityWithExecutor(
				tx,
				{
					organizationId: context.organizationId,
					user: context.user,
				},
				{
					entityType: "quote",
					entityId: quote.id,
					entityName: quote.title,
					action: "status_changed",
					field: "status",
					oldValue: "preparing",
					newValue: "draft",
					metadata: {
						renderIntentId: intent.id,
						templateId: intent.templateId,
						templateVersion: intent.templateVersion,
						documentRevision: intent.documentRevision,
						selectionVersion: intent.selectionVersion,
					},
				},
			);
		}
		return serializeIntent(updated);
	});
	if (target === "pending") {
		return renderAcceptedIntent(context, result);
	}
	return result;
}

export const retryQuotationPdfRender = (
	context: Context,
	input: Parameters<typeof transitionFailedIntent>[1],
) => transitionFailedIntent(context, input, "pending");

export const returnQuotationPdfRenderToDraft = (
	context: Context,
	input: Parameters<typeof transitionFailedIntent>[1],
) => transitionFailedIntent(context, input, "returned_to_draft");
