import { studioProtectedProcedure } from "../../../orpc/procedures";
import { acceptManualWhatsAppSend } from "../lib/manual-send-service";
import { triggerWhatsAppOutbox } from "../lib/trigger-outbox";
import { sendTextInputSchema, sendTextOutputSchema } from "../types";

export const sendText = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/messages/send",
		tags: ["WhatsApp"],
		summary: "Send WhatsApp text message",
	})
	.input(sendTextInputSchema)
	.output(sendTextOutputSchema)
	.handler(async ({ input, context }) => {
		const accepted = await acceptManualWhatsAppSend({
			organizationId: context.organizationId,
			actorId: context.user.id,
			idempotencyKey: input.idempotencyKey,
			payload: {
				kind: "text",
				accountId: input.accountId,
				to: input.to,
				text: input.text,
				contactName: input.contactName,
			},
		});

		await triggerWhatsAppOutbox({ outboxId: accepted.outboxId });

		return {
			data: {
				messageId: accepted.messageId,
				outboxId: accepted.outboxId,
			},
			message: "Message queued",
		};
	});
