import { assignConversation } from "./procedures/assign-conversation";
import { completeEmbeddedSignup } from "./procedures/complete-embedded-signup";
import { connectBaileys } from "./procedures/connect-baileys";
import { connectCloudApi } from "./procedures/connect-cloud-api";
import { deleteAccount } from "./procedures/delete-account";
import { getAccount } from "./procedures/get-account";
import { getConversation } from "./procedures/get-conversation";
import { listAccounts } from "./procedures/list-accounts";
import { listContactTags } from "./procedures/list-contact-tags";
import { listContacts } from "./procedures/list-contacts";
import { listConversations } from "./procedures/list-conversations";
import { listMessages } from "./procedures/list-messages";
import { listTemplates } from "./procedures/list-templates";
import { markConversationRead } from "./procedures/mark-conversation-read";
import { retryMessage } from "./procedures/retry-message";
import { sendMedia } from "./procedures/send-media";
import { sendTemplate } from "./procedures/send-template";
import { sendText } from "./procedures/send-text";
import { subscribeAccount } from "./procedures/subscribe-account";
import { syncTemplates } from "./procedures/sync-templates";
import { testAccount } from "./procedures/test-account";
import { updateAccount } from "./procedures/update-account";
import { updateConversationStatus } from "./procedures/update-conversation-status";
import { whatsappWebhook } from "./procedures/webhook";

export const whatsappRouter = {
	assignConversation,
	completeEmbeddedSignup,
	connectBaileys,
	connectCloudApi,
	deleteAccount,
	getAccount,
	getConversation,
	listAccounts,
	listContactTags,
	listContacts,
	listConversations,
	listMessages,
	listTemplates,
	markConversationRead,
	retryMessage,
	sendMedia,
	sendTemplate,
	sendText,
	subscribeAccount,
	syncTemplates,
	testAccount,
	updateAccount,
	updateConversationStatus,
	webhook: whatsappWebhook,
};
