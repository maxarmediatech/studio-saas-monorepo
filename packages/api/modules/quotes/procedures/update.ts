import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	quoteMutationOutputSchema,
	updateQuoteInputSchema,
} from "../../studio/schemas/quote";
import { updateDraftQuote } from "../lib/quote-service";

export const updateQuote = studioProtectedProcedure
	.route({
		method: "PUT",
		path: "/quotes/{id}",
		tags: ["Quotes"],
		summary: "Update draft quote",
	})
	.input(updateQuoteInputSchema)
	.output(quoteMutationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "update");
		const updated = await updateDraftQuote(
			context,
			input.id,
			input.content,
		);
		return { data: updated, message: "Quote updated" };
	});
