import { and, clients, db, eq, inArray } from "@repo/database";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createDocumentQuoteInputSchema,
	documentQuoteMutationOutputSchema,
	quoteMutationOutputSchema,
	saveDocumentQuoteInputSchema,
	searchQuotationContactsInputSchema,
	searchQuotationContactsOutputSchema,
	sendDocumentQuoteInputSchema,
} from "../../studio/schemas/quote";
import {
	createDocumentDraft,
	saveDocumentDraft,
	searchQuotationContacts,
} from "../lib/quotation-document-service";
import { sendDocumentQuotation } from "../lib/quotation-pdf-service";

async function requireContactMutationPermissions(
	context: Parameters<typeof requirePermission>[0],
	document: (typeof createDocumentQuoteInputSchema)["_output"]["document"],
): Promise<void> {
	if (
		document.participants.some(
			(participant) =>
				!participant.clientId &&
				participant.resolutionIntent === "create_lead" &&
				participant.contact.name.trim(),
		)
	) {
		await requirePermission(context, "client", "create");
	}
	const ids = document.participants.flatMap((participant) =>
		participant.clientId ? [participant.clientId] : [],
	);
	if (ids.length === 0) {
		return;
	}
	const lead = await db.query.clients.findFirst({
		where: and(
			eq(clients.organizationId, context.organizationId),
			inArray(clients.id, ids),
			eq(clients.lifecycleStage, "lead"),
		),
		columns: { id: true },
	});
	if (lead) {
		await requirePermission(context, "client", "update");
	}
}

export const createDocumentQuote = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/quotes/document-v1",
		tags: ["Quotes"],
		summary: "Create document-v1 quotation draft",
	})
	.input(createDocumentQuoteInputSchema)
	.output(documentQuoteMutationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "create");
		await requireContactMutationPermissions(context, input.document);
		return {
			data: await createDocumentDraft(context, input.document),
			message: "Quotation draft created",
		};
	});

export const saveDocumentQuote = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/quotes/{id}/document-v1",
		tags: ["Quotes"],
		summary: "Save document-v1 quotation draft",
	})
	.input(saveDocumentQuoteInputSchema)
	.output(documentQuoteMutationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "update");
		await requireContactMutationPermissions(context, input.document);
		return {
			data: await saveDocumentDraft(
				context,
				input.id,
				input.expectedDocumentRevision,
				input.document,
			),
			message: "Quotation draft saved",
		};
	});

export const sendDocumentQuote = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/quotes/{id}/document-v1/send",
		tags: ["Quotes"],
		summary: "Validate, render, store, and send document-v1 quotation",
	})
	.input(sendDocumentQuoteInputSchema)
	.output(quoteMutationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "send");
		return {
			data: await sendDocumentQuotation(
				context,
				input.id,
				input.expectedDocumentRevision,
			),
			message: "Quotation sent",
		};
	});

export const searchContacts = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/quotes/contacts/search",
		tags: ["Quotes"],
		summary: "Search leads and clients for quotation",
	})
	.input(searchQuotationContactsInputSchema)
	.output(searchQuotationContactsOutputSchema)
	.handler(async ({ input, context }) => {
		await Promise.all([
			requirePermission(context, "quote", "create"),
			requirePermission(context, "client", "list"),
		]);
		return {
			data: await searchQuotationContacts(
				context.organizationId,
				input.query,
				input.limit,
			),
		};
	});
