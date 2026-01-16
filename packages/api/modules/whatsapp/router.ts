import { connectBaileys } from "./procedures/connect-baileys";
import { connectCloudApi } from "./procedures/connect-cloud-api";
import { sendText } from "./procedures/send-text";
import { whatsappWebhook } from "./procedures/webhook";

export const whatsappRouter = {
	connectBaileys,
	connectCloudApi,
	sendText,
	webhook: whatsappWebhook,
};
