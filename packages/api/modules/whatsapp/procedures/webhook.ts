import { publicProcedure } from "../../../orpc/procedures";
import { webhookInputSchema, webhookOutputSchema } from "../types";

export const whatsappWebhook = publicProcedure
	.route({
		method: "POST",
		path: "/whatsapp/webhook/{token}",
		tags: ["WhatsApp"],
		summary: "Receive WhatsApp webhook events",
	})
	.input(webhookInputSchema)
	.output(webhookOutputSchema)
	.handler(async () => ({
		data: { received: true },
	}));
