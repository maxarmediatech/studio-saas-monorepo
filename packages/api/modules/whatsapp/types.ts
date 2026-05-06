import { z } from "zod";

const waConversationStatusSchema = z.enum(["open", "closed", "archived"]);

export const connectBaileysInputSchema = z.object({
	name: z.string().min(1),
});

export const connectBaileysOutputSchema = z.object({
	data: z.object({ id: z.string() }),
	message: z.string(),
});

export const connectCloudApiInputSchema = z.object({
	name: z.string().min(1),
	phoneNumberId: z.string().min(1),
	wabaId: z.string().min(1),
	accessToken: z.string().min(1),
	appSecret: z.string().min(1).optional(),
	apiVersion: z.string().min(1).optional(),
	displayPhoneNumber: z.string().min(1).optional(),
	webhookVerifyToken: z.string().min(1),
});

export const connectCloudApiOutputSchema = z.object({
	data: z.object({ id: z.string() }),
	message: z.string(),
});

export const completeEmbeddedSignupInputSchema = z.object({
	code: z.string().min(1),
	wabaId: z.string().min(1),
	phoneNumberId: z.string().min(1),
	businessId: z.string().min(1).optional(),
	accountName: z.string().min(1).max(120).optional(),
});

export const completeEmbeddedSignupOutputSchema = z.object({
	data: z.object({ id: z.string() }),
	message: z.string(),
});

export const whatsappAccountSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	provider: z.enum(["baileys", "cloud_api"]),
	connectionStatus: z.enum([
		"disconnected",
		"connecting",
		"qr_pending",
		"connected",
		"banned",
	]),
	ownershipType: z.enum(["platform", "customer"]),
	phoneNumber: z.string().nullable(),
	displayPhoneNumber: z.string().nullable(),
	phoneNumberId: z.string().nullable(),
	wabaId: z.string().nullable(),
	apiVersion: z.string().nullable(),
	verifiedName: z.string().nullable(),
	qualityRating: z.string().nullable(),
	messagingLimitTier: z.string().nullable(),
	lastConnectedAt: z.date().nullable(),
	lastValidatedAt: z.date().nullable(),
	lastEventAt: z.date().nullable(),
	lastErrorMessage: z.string().nullable(),
	errorCount: z.number(),
	hasAccessToken: z.boolean(),
	hasAppSecret: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const listAccountsInputSchema = z.object({});

export const listAccountsOutputSchema = z.object({
	data: z.array(whatsappAccountSummarySchema),
});

export const getAccountInputSchema = z.object({
	accountId: z.string(),
});

export const getAccountOutputSchema = z.object({
	data: whatsappAccountSummarySchema,
});

export const updateAccountInputSchema = z
	.object({
		accountId: z.string(),
		name: z.string().min(1).optional(),
		phoneNumberId: z.string().min(1).optional(),
		wabaId: z.string().min(1).optional(),
		accessToken: z.string().min(1).optional(),
		appSecret: z.string().min(1).optional(),
		apiVersion: z.string().min(1).optional(),
		webhookVerifyToken: z.string().min(1).optional(),
	})
	.refine(
		(input) =>
			Boolean(
				input.name ||
					input.phoneNumberId ||
					input.wabaId ||
					input.accessToken ||
					input.appSecret ||
					input.apiVersion ||
					input.webhookVerifyToken,
			),
		{
			message: "At least one field must be updated",
		},
	);

export const updateAccountOutputSchema = z.object({
	data: whatsappAccountSummarySchema,
	message: z.string(),
});

export const deleteAccountInputSchema = z.object({
	accountId: z.string(),
});

export const deleteAccountOutputSchema = z.object({
	data: z.object({ id: z.string() }),
	message: z.string(),
});

export const testAccountInputSchema = z.object({
	accountId: z.string(),
});

export const testAccountOutputSchema = z.object({
	data: whatsappAccountSummarySchema,
	message: z.string(),
});

export const subscribeAccountInputSchema = z.object({
	accountId: z.string(),
});

export const subscribeAccountOutputSchema = z.object({
	data: z.object({ id: z.string() }),
	message: z.string(),
});

export const whatsappTemplateVariableSchema = z.object({
	key: z.string(),
	componentType: z.enum(["header", "body", "button"]),
	index: z.number().int().positive(),
	label: z.string(),
	buttonIndex: z.number().int().nonnegative().nullable(),
	buttonSubType: z.string().nullable(),
});

export const whatsappTemplateSummarySchema = z.object({
	id: z.string(),
	accountId: z.string(),
	providerTemplateId: z.string().nullable(),
	name: z.string(),
	language: z.string(),
	status: z.string(),
	category: z.string(),
	headerText: z.string().nullable(),
	bodyText: z.string().nullable(),
	footerText: z.string().nullable(),
	buttonLabels: z.array(z.string()),
	variables: z.array(whatsappTemplateVariableSchema),
	isSupported: z.boolean(),
	unsupportedReason: z.string().nullable(),
	lastSyncedAt: z.date(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const listTemplatesInputSchema = z.object({
	accountId: z.string(),
	status: z.string().min(1).optional(),
	category: z.string().min(1).optional(),
	language: z.string().min(1).optional(),
	search: z.string().min(1).max(100).optional(),
});

export const listTemplatesOutputSchema = z.object({
	data: z.array(whatsappTemplateSummarySchema),
});

export const syncTemplatesInputSchema = z.object({
	accountId: z.string(),
});

export const syncTemplatesOutputSchema = z.object({
	data: z.object({
		accountId: z.string(),
		count: z.number().int().nonnegative(),
		lastSyncedAt: z.date(),
	}),
	message: z.string(),
});

export const sendTextInputSchema = z.object({
	accountId: z.string(),
	to: z.string(),
	text: z.string().min(1),
});

export const sendTextOutputSchema = z.object({
	data: z.object({ messageId: z.string(), outboxId: z.string() }),
	message: z.string(),
});

const waMediaTypeSchema = z.enum([
	"image",
	"video",
	"audio",
	"document",
	"sticker",
]);

export const sendMediaInputSchema = z
	.object({
		accountId: z.string(),
		to: z.string(),
		mediaType: waMediaTypeSchema,
		mediaUrl: z.string().url().optional(),
		mediaKey: z.string().min(1).optional(),
		mimeType: z.string().min(1),
		caption: z.string().min(1).optional(),
		fileName: z.string().min(1).optional(),
	})
	.refine((data) => Boolean(data.mediaUrl || data.mediaKey), {
		message: "mediaUrl or mediaKey is required",
	})
	.refine((data) => !(data.mediaUrl && data.mediaKey), {
		message: "Provide either mediaUrl or mediaKey, not both",
	})
	.refine(
		(data) =>
			!data.caption ||
			data.mediaType === "image" ||
			data.mediaType === "video" ||
			data.mediaType === "document",
		{ message: "caption is only supported for image, video, or document" },
	);

export const sendMediaOutputSchema = z.object({
	data: z.object({ messageId: z.string(), outboxId: z.string() }),
	message: z.string(),
});

const waTemplateComponentSchema = z.object({
	type: z.string().min(1),
	parameters: z.array(z.record(z.string(), z.unknown())).optional(),
	subType: z.string().optional(),
	index: z.number().int().nonnegative().optional(),
});

export const sendTemplateInputSchema = z.object({
	accountId: z.string(),
	to: z.string(),
	templateName: z.string().min(1),
	language: z.string().min(1),
	components: z.array(waTemplateComponentSchema).optional(),
});

export const sendTemplateOutputSchema = z.object({
	data: z.object({ messageId: z.string(), outboxId: z.string() }),
	message: z.string(),
});

export const retryMessageInputSchema = z.object({
	messageId: z.string().min(1),
});

export const retryMessageOutputSchema = z.object({
	data: z.object({ messageId: z.string(), outboxId: z.string() }),
	message: z.string(),
});

export const listConversationsInputSchema = z.object({
	limit: z.number().min(1).max(100).default(20),
	cursor: z.string().optional(),
	accountId: z.string().optional(),
	status: waConversationStatusSchema.optional(),
	assignment: z.enum(["all", "mine", "unassigned"]).optional(),
	search: z.string().min(1).max(100).optional(),
});

export const conversationItemSchema = z.object({
	id: z.string(),
	accountId: z.string(),
	contactId: z.string(),
	status: waConversationStatusSchema,
	assignedToUserId: z.string().nullable(),
	unreadCount: z.number(),
	lastMessageId: z.string().nullable(),
	lastMessageAt: z.date().nullable(),
	lastMessagePreview: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
	contact: z.object({
		id: z.string(),
		waId: z.string(),
		phoneNumber: z.string(),
		pushName: z.string().nullable(),
		name: z.string().nullable(),
		lastMessageAt: z.date().nullable(),
	}),
});

export const listConversationsOutputSchema = z.object({
	data: z.array(conversationItemSchema),
	nextCursor: z.string().nullable(),
});

export const listMessagesInputSchema = z.object({
	conversationId: z.string(),
	limit: z.number().min(1).max(100).default(50),
	cursor: z.string().optional(),
	direction: z.enum(["inbound", "outbound"]).optional(),
});

export const messageItemSchema = z.object({
	id: z.string(),
	conversationId: z.string(),
	contactId: z.string(),
	accountId: z.string(),
	direction: z.enum(["inbound", "outbound"]),
	type: z.enum([
		"text",
		"image",
		"video",
		"audio",
		"document",
		"sticker",
		"location",
		"contact",
		"template",
		"interactive",
	]),
	textBody: z.string().nullable(),
	caption: z.string().nullable(),
	media: z
		.object({
			id: z.string(),
			accessUrl: z.string().nullable(),
			ingestStatus: z.enum(["pending", "processing", "ready", "failed"]),
			ingestErrorMessage: z.string().nullable(),
			storageUrl: z.string().nullable(),
			mimeType: z.string(),
			fileName: z.string().nullable(),
		})
		.nullable(),
	templateName: z.string().nullable(),
	templateParams: z.unknown().nullable(),
	templateRenderedText: z.string().nullable(),
	status: z.enum([
		"pending",
		"queued",
		"sent",
		"delivered",
		"read",
		"failed",
	]),
	statusUpdatedAt: z.date().nullable(),
	providerMessageId: z.string().nullable(),
	providerTimestamp: z.date().nullable(),
	errorCode: z.string().nullable(),
	errorMessage: z.string().nullable(),
	createdAt: z.date(),
});

export const listMessagesOutputSchema = z.object({
	data: z.array(messageItemSchema),
	nextCursor: z.string().nullable(),
});

export const getConversationInputSchema = z.object({
	conversationId: z.string(),
});

export const getConversationOutputSchema = z.object({
	data: conversationItemSchema,
});

export const assignConversationInputSchema = z.object({
	conversationId: z.string(),
	assignedToUserId: z.string().nullable(),
});

export const assignConversationOutputSchema = z.object({
	data: conversationItemSchema,
	message: z.string(),
});

export const updateConversationStatusInputSchema = z.object({
	conversationId: z.string(),
	status: waConversationStatusSchema,
});

export const updateConversationStatusOutputSchema = z.object({
	data: conversationItemSchema,
	message: z.string(),
});

export const markConversationReadInputSchema = z.object({
	conversationId: z.string(),
});

export const markConversationReadOutputSchema = z.object({
	data: z.object({ id: z.string() }),
	message: z.string(),
});

export const listContactsInputSchema = z.object({
	limit: z.number().min(1).max(100).default(50),
	cursor: z.string().optional(),
	search: z.string().min(1).max(100).optional(),
});

export const contactItemSchema = z.object({
	id: z.string(),
	waId: z.string(),
	phoneNumber: z.string(),
	pushName: z.string().nullable(),
	name: z.string().nullable(),
	lastMessageAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const listContactsOutputSchema = z.object({
	data: z.array(contactItemSchema),
	nextCursor: z.string().nullable(),
});

export const webhookInputSchema = z.object({
	token: z.string(),
	payload: z.unknown(),
});

export const webhookOutputSchema = z.object({
	data: z.object({ received: z.boolean() }),
});
