import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getQuotationPresentationInputSchema,
	getQuotationPresentationOutputSchema,
	listQuotationTemplatesOutputSchema,
	quotationPresentationMutationOutputSchema,
	quotationRenderIntentInputSchema,
	quotationRenderIntentOutputSchema,
	selectQuotationTemplateInputSchema,
	sendDocumentQuoteInputSchema,
} from "../../studio/schemas/quote";
import {
	getQuotationPresentation,
	listActiveQuotationTemplates,
	selectQuotationTemplate,
} from "../lib/quotation-presentation-service";
import {
	retryQuotationPdfRender,
	returnQuotationPdfRenderToDraft,
	startQuotationPdfSend,
} from "../lib/quotation-render-intent-service";

export const listQuotationTemplates = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/quotes/templates",
		tags: ["Quotes"],
		summary: "List active quotation PDF templates",
	})
	.output(listQuotationTemplatesOutputSchema)
	.handler(async ({ context }) => {
		await requirePermission(context, "quote", "readOperational");
		return { data: listActiveQuotationTemplates() };
	});

export const readQuotationPresentation = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/quotes/{id}/presentation",
		tags: ["Quotes"],
		summary: "Read quotation PDF presentation",
	})
	.input(getQuotationPresentationInputSchema)
	.output(getQuotationPresentationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "readOperational");
		return {
			data: await getQuotationPresentation(
				context.organizationId,
				input.id,
			),
		};
	});

export const chooseQuotationTemplate = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/quotes/{id}/presentation",
		tags: ["Quotes"],
		summary: "Select quotation PDF template",
	})
	.input(selectQuotationTemplateInputSchema)
	.output(quotationPresentationMutationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "update");
		return {
			data: await selectQuotationTemplate(context, {
				quoteId: input.id,
				expectedDocumentRevision: input.expectedDocumentRevision,
				expectedSelectionVersion: input.expectedSelectionVersion,
				templateId: input.templateId,
				templateVersion: input.templateVersion,
			}),
			message: "Quotation template selected",
		};
	});

export const startQuotationSend = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/quotes/{id}/presentation/send",
		tags: ["Quotes"],
		summary: "Generate quotation PDF and send",
	})
	.input(sendDocumentQuoteInputSchema)
	.output(quotationRenderIntentOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "send");
		return {
			data: await startQuotationPdfSend(context, {
				quoteId: input.id,
				expectedDocumentRevision: input.expectedDocumentRevision,
				expectedSelectionVersion: input.expectedSelectionVersion,
			}),
			message: "Quotation PDF generated",
		};
	});

export const retryQuotationRender = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/quotes/{id}/presentation/retry",
		tags: ["Quotes"],
		summary: "Retry failed quotation PDF rendering",
	})
	.input(quotationRenderIntentInputSchema)
	.output(quotationRenderIntentOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "send");
		return {
			data: await retryQuotationPdfRender(context, {
				quoteId: input.id,
				renderIntentId: input.renderIntentId,
				expectedDocumentRevision: input.expectedDocumentRevision,
				expectedSelectionVersion: input.expectedSelectionVersion,
			}),
			message: "Quotation PDF generated",
		};
	});

export const returnQuotationRenderToDraft = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/quotes/{id}/presentation/return-to-draft",
		tags: ["Quotes"],
		summary: "Return failed quotation PDF render to draft",
	})
	.input(quotationRenderIntentInputSchema)
	.output(quotationRenderIntentOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "send");
		return {
			data: await returnQuotationPdfRenderToDraft(context, {
				quoteId: input.id,
				renderIntentId: input.renderIntentId,
				expectedDocumentRevision: input.expectedDocumentRevision,
				expectedSelectionVersion: input.expectedSelectionVersion,
			}),
			message: "Quotation returned to draft",
		};
	});
