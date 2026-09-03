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
import { trackActivityWithExecutor } from "../../activities/lib";
import type { StudioContext } from "../../studio/lib/permissions";
import type { QuotationDocumentV1 } from "../../studio/schemas/quotation-document";
import { strictQuotationDocumentV1Schema } from "../../studio/schemas/quotation-document";
import {
	QuotationPdfTemplateRegistryError,
	quotationPdfTemplateRegistry,
} from "../pdf/registry";
import {
	CLASSIC_V0_QUOTATION_TEMPLATE_ID,
	CLASSIC_V0_QUOTATION_TEMPLATE_VERSION,
} from "../pdf/templates/classic-v0";
import type { QuotationPdfTemplateDefinition } from "../pdf/types";

export interface QuotationPresentationIdentity {
	documentRevision: number;
	selectionVersion: number | null;
	templateId: string;
	templateVersion: number;
}

type Context = Pick<StudioContext, "organizationId" | "user">;

export function listActiveQuotationTemplates() {
	return quotationPdfTemplateRegistry.listActive().map(({ manifest }) => ({
		templateId: manifest.id,
		templateVersion: manifest.version,
		label: manifest.label,
		description: manifest.description,
		thumbnailPath: manifest.thumbnailPath,
		rendererVersion: manifest.rendererVersion,
		composerVersion: manifest.composerVersion,
		copyProfileVersion: manifest.compatibility.copyProfile.version,
		supportedFeatures: [...manifest.supportedFeatures],
	}));
}

export function implicitClassicPresentation(
	documentRevision: number,
): QuotationPresentationIdentity {
	return {
		documentRevision,
		selectionVersion: null,
		templateId: CLASSIC_V0_QUOTATION_TEMPLATE_ID,
		templateVersion: CLASSIC_V0_QUOTATION_TEMPLATE_VERSION,
	};
}

export async function getQuotationPresentation(
	organizationId: string,
	quoteId: string,
) {
	const quote = await db.query.quotes.findFirst({
		where: and(
			eq(quotes.id, quoteId),
			eq(quotes.organizationId, organizationId),
			isNull(quotes.deletedAt),
		),
		columns: { documentRevision: true, documentVersion: true },
		with: { presentation: true },
	});
	if (!quote || quote.documentVersion !== 1) {
		throw new ORPCError("NOT_FOUND", { message: "Quotation not found" });
	}
	if (!quote.presentation) {
		return {
			...implicitClassicPresentation(quote.documentRevision),
			persisted: false,
			renderIntent: null,
		};
	}
	const intent = await db.query.quotationPdfRenderIntents.findFirst({
		where: and(
			eq(quotationPdfRenderIntents.organizationId, organizationId),
			eq(quotationPdfRenderIntents.quoteId, quoteId),
			eq(
				quotationPdfRenderIntents.documentRevision,
				quote.documentRevision,
			),
			eq(
				quotationPdfRenderIntents.selectionVersion,
				quote.presentation.selectionVersion,
			),
		),
		orderBy: (table, { desc }) => [desc(table.createdAt)],
	});
	return {
		documentRevision: quote.documentRevision,
		selectionVersion: quote.presentation.selectionVersion,
		templateId: quote.presentation.templateId,
		templateVersion: quote.presentation.templateVersion,
		persisted: true,
		renderIntent: intent
			? {
					id: intent.id,
					status: intent.status,
					attemptCount: intent.attemptCount,
					lastErrorCode: intent.lastErrorCode,
					lastErrorMessage: intent.lastErrorMessage,
					lastAttemptAt: intent.lastAttemptAt?.toISOString() ?? null,
					createdAt: intent.createdAt.toISOString(),
					updatedAt: intent.updatedAt.toISOString(),
				}
			: null,
	};
}

function conflict(
	message: string,
	current: QuotationPresentationIdentity,
): never {
	throw new ORPCError("CONFLICT", { message, data: { current } });
}

function assertTemplateSupportsDocument(
	templateId: string,
	templateVersion: number,
	document: QuotationDocumentV1,
) {
	let template: QuotationPdfTemplateDefinition;
	try {
		template = quotationPdfTemplateRegistry.getActive(
			templateId,
			templateVersion,
		);
	} catch (error) {
		if (error instanceof QuotationPdfTemplateRegistryError) {
			throw new ORPCError("BAD_REQUEST", { message: error.message });
		}
		throw error;
	}
	if (
		!template.manifest.compatibility.quotationDocumentVersions.includes(
			document.schemaVersion,
		) ||
		!template.manifest.compatibility.brandingSchemaVersions.includes(1)
	) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Quotation template is incompatible with this quotation",
		});
	}
	return template;
}

export async function selectQuotationTemplate(
	context: Context,
	input: {
		quoteId: string;
		expectedDocumentRevision: number;
		expectedSelectionVersion: number | null;
		templateId: string;
		templateVersion: number;
	},
): Promise<QuotationPresentationIdentity> {
	return db.transaction(async (tx) => {
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
				message: "Quotation not found",
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
			conflict("Quotation document revision changed", current);
		}
		if (
			(presentation?.selectionVersion ?? null) !==
			input.expectedSelectionVersion
		) {
			conflict("Quotation template selection changed", current);
		}
		if (quote.status !== "draft") {
			throw new ORPCError("CONFLICT", {
				message: "Quotation template can only be selected for a draft",
				data: { current },
			});
		}
		const document = strictQuotationDocumentV1Schema.parse(quote.document);
		assertTemplateSupportsDocument(
			input.templateId,
			input.templateVersion,
			document,
		);
		const now = new Date();
		const selectionVersion = (presentation?.selectionVersion ?? 0) + 1;
		if (presentation) {
			await tx
				.update(quotationPresentations)
				.set({
					templateId: input.templateId,
					templateVersion: input.templateVersion,
					selectionVersion,
					selectedBy: context.user.id,
					selectedAt: now,
					updatedAt: now,
				})
				.where(eq(quotationPresentations.quoteId, quote.id));
		} else {
			await tx.insert(quotationPresentations).values({
				quoteId: quote.id,
				organizationId: context.organizationId,
				templateId: input.templateId,
				templateVersion: input.templateVersion,
				selectionVersion,
				selectedBy: context.user.id,
				selectedAt: now,
				createdAt: now,
				updatedAt: now,
			});
		}
		await trackActivityWithExecutor(
			tx,
			{ organizationId: context.organizationId, user: context.user },
			{
				entityType: "quote",
				entityId: quote.id,
				entityName: quote.title,
				action: "updated",
				field: "presentation",
				metadata: {
					templateId: input.templateId,
					templateVersion: input.templateVersion,
					selectionVersion,
					documentRevision: quote.documentRevision,
				},
			},
		);
		return {
			documentRevision: quote.documentRevision,
			selectionVersion,
			templateId: input.templateId,
			templateVersion: input.templateVersion,
		};
	});
}
