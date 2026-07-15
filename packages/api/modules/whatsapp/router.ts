import { assignConversation } from "./procedures/assign-conversation";
import { completeEmbeddedSignup } from "./procedures/complete-embedded-signup";
import { connectBaileys } from "./procedures/connect-baileys";
import { connectCloudApi } from "./procedures/connect-cloud-api";
import { createAutomation } from "./procedures/create-automation";
import { createCampaign } from "./procedures/create-campaign";
import { deleteAccount } from "./procedures/delete-account";
import { getAccount } from "./procedures/get-account";
import { getConversation } from "./procedures/get-conversation";
import { getDashboard } from "./procedures/get-dashboard";
import { listAccounts } from "./procedures/list-accounts";
import { listAutomations } from "./procedures/list-automations";
import { listCampaigns } from "./procedures/list-campaigns";
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
import { updateAutomationStatus } from "./procedures/update-automation-status";
import { updateConversationStatus } from "./procedures/update-conversation-status";
import { whatsappWebhook } from "./procedures/webhook";

export const whatsappRouter = {
	assignConversation,
	completeEmbeddedSignup,
	connectBaileys,
	connectCloudApi,
	createAutomation,
	createCampaign,
	deleteAccount,
	getAccount,
	getConversation,
	getDashboard,
	listAccounts,
	listAutomations,
	listCampaigns,
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
	updateAutomationStatus,
	updateConversationStatus,
	webhook: whatsappWebhook,
};
