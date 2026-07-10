import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { studioProtectedProcedure } from "../../../../orpc/procedures";
import { requirePermission } from "../../../studio/lib/permissions";
import {
	createReceivedInputSchema,
	createReceivedOutputSchema,
} from "../../../studio/schemas/payment";
import { createReceivedPaymentIdempotently } from "../../lib/payment-idempotency";

export const createReceived = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/studio-payments/received",
		tags: ["Studio Payments"],
		summary: "Create received payment",
		description: "Record a new payment received from a client",
	})
	.input(createReceivedInputSchema)
	.output(createReceivedOutputSchema)
	.handler(async ({ input, context }) => {
		await requirePermission(context, "payment", "create");

		if (
			input.proofAttachment?.key &&
			!input.proofAttachment.key.startsWith(
				`orgs/${context.organizationId}/`,
			)
		) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"Invalid payment proof: file does not belong to this organization",
			});
		}

		const execution = await db.transaction((tx) =>
			createReceivedPaymentIdempotently(tx, {
				...input,
				actorName: context.user.name || "Unknown User",
				organizationId: context.organizationId,
				userId: context.user.id,
			}),
		);

		return execution.result;
	});
