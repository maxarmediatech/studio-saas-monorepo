import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getQuoteInputSchema,
	getQuoteOutputSchema,
} from "../../studio/schemas/quote";
import { getOrganizationQuote } from "../lib/quote-query";

export const getQuote = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/quotes/{id}",
		tags: ["Quotes"],
		summary: "Get quote detail",
	})
	.input(getQuoteInputSchema)
	.output(getQuoteOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "readOperational");
		return {
			data: await getOrganizationQuote(context.organizationId, input.id),
		};
	});
