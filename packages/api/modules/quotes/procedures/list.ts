import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import { createPaginationResponse } from "../../studio/schemas/common";
import {
	listQuotesInputSchema,
	listQuotesOutputSchema,
} from "../../studio/schemas/quote";
import { listOrganizationQuotes } from "../lib/quote-query";

export const listQuotes = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/quotes",
		tags: ["Quotes"],
		summary: "List quotes",
	})
	.input(listQuotesInputSchema)
	.output(listQuotesOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "list");
		const result = await listOrganizationQuotes({
			...input,
			organizationId: context.organizationId,
		});
		return {
			data: result.data,
			pagination: createPaginationResponse(
				input.page,
				input.limit,
				result.total,
			),
		};
	});
