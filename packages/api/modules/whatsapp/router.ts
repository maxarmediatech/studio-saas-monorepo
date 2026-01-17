import { connectBaileys } from "./procedures/connect-baileys";
import { connectCloudApi } from "./procedures/connect-cloud-api";
import { getConversation } from "./procedures/get-conversation";
import { listContacts } from "./procedures/list-contacts";
import { listConversations } from "./procedures/list-conversations";
import { listMessages } from "./procedures/list-messages";
import { markConversationRead } from "./procedures/mark-conversation-read";
import { sendMedia } from "./procedures/send-media";
import { sendTemplate } from "./procedures/send-template";
import { sendText } from "./procedures/send-text";
import { whatsappWebhook } from "./procedures/webhook";

export const whatsappRouter = {
	connectBaileys,
	connectCloudApi,
	getConversation,
	listContacts,
	listConversations,
	listMessages,
	markConversationRead,
	sendMedia,
	sendTemplate,
	sendText,
	webhook: whatsappWebhook,
};
