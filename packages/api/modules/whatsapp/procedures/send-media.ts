import { studioProtectedProcedure } from "../../../orpc/procedures";
import { acceptManualWhatsAppSend } from "../lib/manual-send-service";
import { triggerWhatsAppOutbox } from "../lib/trigger-outbox";
import { sendMediaInputSchema, sendMediaOutputSchema } from "../types";

export const sendMedia = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/messages/send-media",
		tags: ["WhatsApp"],
		summary: "Send WhatsApp media message",
	})
	.input(sendMediaInputSchema)
	.output(sendMediaOutputSchema)
	.handler(async ({ input, context }) => {
		const accepted = await acceptManualWhatsAppSend({
			organizationId: context.organizationId,
			actorId: context.user.id,
			idempotencyKey: input.idempotencyKey,
			payload: {
				kind: "media",
				accountId: input.accountId,
				to: input.to,
				mediaType: input.mediaType,
				mediaUrl: input.mediaUrl,
				mediaKey: input.mediaKey,
				mimeType: input.mimeType,
				caption: input.caption,
				fileName: input.fileName,
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
