import { studioProtectedProcedure } from "../../../orpc/procedures";
import { requirePermission } from "../../studio/lib/permissions";
import {
	acceptQuoteInputSchema,
	convertQuoteOutputSchema,
	getQuoteInputSchema,
	quoteMutationOutputSchema,
	reviseQuoteInputSchema,
	reviseQuoteOutputSchema,
} from "../../studio/schemas/quote";
import { acceptQuote as acceptQuoteService } from "../lib/quote-acceptance";
import { convertAcceptedQuote } from "../lib/quote-conversion";
import {
	declineQuote as declineQuoteService,
	expireQuote as expireQuoteService,
	reviseQuote as reviseQuoteService,
	sendQuote as sendQuoteService,
} from "../lib/quote-service";

const mutationRoute = (path: `/${string}`, summary: string) => ({
	method: "POST" as const,
	path,
	tags: ["Quotes"],
	summary,
});

export const sendQuote = studioProtectedProcedure
	.route(mutationRoute("/quotes/{id}/send", "Send draft quote"))
	.input(getQuoteInputSchema)
	.output(quoteMutationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "send");
		return {
			data: await sendQuoteService(context, input.id),
			message: "Quote sent",
		};
	});

export const reviseQuote = studioProtectedProcedure
	.route(mutationRoute("/quotes/{id}/revise", "Revise immutable quote"))
	.input(reviseQuoteInputSchema)
	.output(reviseQuoteOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "revise");
		return {
			data: await reviseQuoteService(context, input.id),
			message: "Quote revision created",
		};
	});

export const acceptQuote = studioProtectedProcedure
	.route(mutationRoute("/quotes/{id}/accept", "Accept one quote option"))
	.input(acceptQuoteInputSchema)
	.output(quoteMutationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "accept");
		return {
			data: await acceptQuoteService(
				context,
				input.id,
				input.quoteOptionId,
			),
			message: "Quote accepted",
		};
	});

export const declineQuote = studioProtectedProcedure
	.route(mutationRoute("/quotes/{id}/decline", "Decline sent quote"))
	.input(getQuoteInputSchema)
	.output(quoteMutationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "decline");
		return {
			data: await declineQuoteService(context, input.id),
			message: "Quote declined",
		};
	});

export const expireQuote = studioProtectedProcedure
	.route(mutationRoute("/quotes/{id}/expire", "Expire a due sent quote"))
	.input(getQuoteInputSchema)
	.output(quoteMutationOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "expire");
		return {
			data: await expireQuoteService(context, input.id),
			message: "Quote expired",
		};
	});

export const convertQuote = studioProtectedProcedure
	.route(
		mutationRoute(
			"/quotes/{id}/convert",
			"Convert accepted quote to booking",
		),
	)
	.input(getQuoteInputSchema)
	.output(convertQuoteOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "quote", "convert");
		await requirePermission(context, "booking", "create");
		await requirePermission(context, "payment", "create");
		const booking = await convertAcceptedQuote(context, input.id);
		return {
			data: {
				...booking,
				deletedAt: booking.deletedAt?.toISOString() ?? null,
			},
			message: booking.deletedAt
				? "Converted booking is deleted"
				: "Quote converted to booking",
		};
	});
