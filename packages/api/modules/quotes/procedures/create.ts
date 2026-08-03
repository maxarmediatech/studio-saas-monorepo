import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	createQuoteInputSchema,
	quoteMutationOutputSchema,
} from "../../studio/schemas/quote";
import { createDraftQuote } from "../lib/quote-service";

export const createQuote = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/quotes",
		tags: ["Quotes"],
		summary: "Create draft quote",
	})
	.input(createQuoteInputSchema)
	.output(quoteMutationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "create");
		const created = await createDraftQuote(context, input);
		return {
			data: { id: created.id },
			message: `Quote created (${created.quoteNumber})`,
		};
	});
