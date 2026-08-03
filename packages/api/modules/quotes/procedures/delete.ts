import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	getQuoteInputSchema,
	quoteMutationOutputSchema,
} from "../../studio/schemas/quote";
import { deleteDraftQuote } from "../lib/quote-service";

export const deleteQuote = studioProtectedProcedure
	.route({
		method: "DELETE",
		path: "/quotes/{id}",
		tags: ["Quotes"],
		summary: "Delete draft quote",
	})
	.input(getQuoteInputSchema)
	.output(quoteMutationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "delete");
		return {
			data: await deleteDraftQuote(context, input.id),
			message: "Quote deleted",
		};
	});
