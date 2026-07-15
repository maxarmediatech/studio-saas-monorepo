import { studioProtectedProcedure } from "../../../orpc/procedures";
import { acceptManualWhatsAppSend } from "../lib/manual-send-service";
import { triggerWhatsAppOutbox } from "../lib/trigger-outbox";
import { sendTemplateInputSchema, sendTemplateOutputSchema } from "../types";

export const sendTemplate = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/messages/send-template",
		tags: ["WhatsApp"],
		summary: "Send WhatsApp template message",
	})
	.input(sendTemplateInputSchema)
	.output(sendTemplateOutputSchema)
	.handler(async ({ input, context }) => {
		const accepted = await acceptManualWhatsAppSend({
			organizationId: context.organizationId,
			actorId: context.user.id,
			idempotencyKey: input.idempotencyKey,
			payload: {
				kind: "template",
				accountId: input.accountId,
				to: input.to,
				templateName: input.templateName,
				language: input.language,
				components: input.components,
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
