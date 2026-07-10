import { z } from "zod";

const waConversationStatusSchema = z.enum(["open", "closed", "archived"]);
const waCampaignStatusSchema = z.enum([
	"draft",
	"scheduled",
	"running",
	"paused",
	"completed",
	"cancelled",
]);
const waBotFlowStatusSchema = z.enum(["draft", "published", "archived"]);

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
	contactName: z.string().min(1).optional(),
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
	contactType: z.enum(["client", "crew"]).optional(),
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
		"delivery_unknown",
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
	accountId: z.string().optional(),
	search: z.string().min(1).max(100).optional(),
	tag: z.string().min(1).max(100).optional(),
	blocked: z.boolean().optional(),
	optedOut: z.boolean().optional(),
	linkType: z
		.enum(["all", "linked", "unlinked", "client", "crew"])
		.optional(),
});

export const contactItemSchema = z.object({
	id: z.string(),
	waId: z.string(),
	phoneNumber: z.string(),
	pushName: z.string().nullable(),
	name: z.string().nullable(),
	email: z.string().nullable(),
	tags: z.array(z.string()),
	isBlocked: z.boolean(),
	isOptedOut: z.boolean(),
	externalSource: z.string().nullable(),
	externalId: z.string().nullable(),
	lastMessageAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const listContactsOutputSchema = z.object({
	data: z.array(contactItemSchema),
	nextCursor: z.string().nullable(),
});

export const contactTagSummarySchema = z.object({
	name: z.string(),
	contactCount: z.number().int().nonnegative(),
});

export const listContactTagsInputSchema = z.object({
	search: z.string().min(1).max(100).optional(),
});

export const listContactTagsOutputSchema = z.object({
	data: z.array(contactTagSummarySchema),
});

export const listCampaignsInputSchema = z.object({
	status: waCampaignStatusSchema.optional(),
	search: z.string().min(1).max(100).optional(),
});

export const campaignAudienceFilterSchema = z.object({
	tag: z.string().min(1).max(100).optional(),
	linkType: z
		.enum(["all", "linked", "unlinked", "client", "crew"])
		.default("all"),
	excludeOptedOut: z.boolean().default(true),
	excludeBlocked: z.boolean().default(true),
});

export const campaignItemSchema = z.object({
	id: z.string(),
	accountId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	status: waCampaignStatusSchema,
	messageType: z.enum([
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
	templateName: z.string().nullable(),
	audienceFilter: z.unknown().nullable(),
	estimatedRecipients: z.number().int().nonnegative(),
	scheduledAt: z.date().nullable(),
	startedAt: z.date().nullable(),
	completedAt: z.date().nullable(),
	totalSent: z.number().int().nonnegative(),
	totalDelivered: z.number().int().nonnegative(),
	totalRead: z.number().int().nonnegative(),
	totalFailed: z.number().int().nonnegative(),
	createdByUserId: z.string().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const listCampaignsOutputSchema = z.object({
	data: z.array(campaignItemSchema),
});

export const whatsappDashboardInputSchema = z.object({
	dateRange: z
		.object({
			start: z.string().min(1),
			end: z.string().min(1),
		})
		.optional(),
});

export const whatsappDashboardSchema = z.object({
	conversationsToday: z.number(),
	responseTimeMinutes: z.number().nullable(),
	messages: z.object({
		sent: z.number(),
		delivered: z.number(),
		read: z.number(),
		failed: z.number(),
	}),
	campaigns: z.object({
		total: z.number(),
		running: z.number(),
		scheduled: z.number(),
		completed: z.number(),
		totalRecipients: z.number(),
	}),
	topContacts: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			phoneNumber: z.string(),
			messageCount: z.number(),
			lastMessageAt: z.string().nullable(),
		}),
	),
	recentActivity: z.array(
		z.object({
			id: z.string(),
			contactName: z.string(),
			phoneNumber: z.string(),
			direction: z.enum(["inbound", "outbound"]),
			status: z.string(),
			preview: z.string(),
			createdAt: z.string(),
		}),
	),
});

export const whatsappDashboardOutputSchema = z.object({
	data: whatsappDashboardSchema,
});

export const createCampaignInputSchema = z
	.object({
		accountId: z.string().min(1),
		name: z.string().min(1).max(120),
		description: z.string().max(500).optional(),
		templateName: z.string().min(1),
		language: z.string().min(1),
		variableValues: z.record(z.string(), z.string()).default({}),
		audienceFilter: campaignAudienceFilterSchema.default({
			linkType: "all",
			excludeOptedOut: true,
			excludeBlocked: true,
		}),
		action: z.enum(["draft", "send", "schedule"]),
		scheduledAt: z.date().optional(),
	})
	.refine((input) => input.action !== "schedule" || input.scheduledAt, {
		message: "scheduledAt is required when scheduling a broadcast",
		path: ["scheduledAt"],
	});

export const createCampaignOutputSchema = z.object({
	data: campaignItemSchema,
	message: z.string(),
});

export const automationActionSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("send_text"),
		text: z.string().min(1).max(4000),
	}),
	z.object({
		type: z.literal("send_template"),
		templateName: z.string().min(1),
		language: z.string().min(1),
	}),
	z.object({
		type: z.literal("add_tag"),
		tag: z.string().min(1).max(100),
	}),
	z.object({
		type: z.literal("assign_conversation"),
		userId: z.string().min(1),
	}),
	z.object({
		type: z.literal("wait"),
		durationMinutes: z.number().int().min(1).max(43_200),
	}),
	z.object({
		type: z.literal("close_conversation"),
	}),
]);

export const automationFlowDataSchema = z.object({
	actions: z.array(automationActionSchema).min(1).max(20),
});

export const automationItemSchema = z.object({
	id: z.string(),
	accountId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	status: waBotFlowStatusSchema,
	triggerType: z.enum(["keyword", "first_inbound"]),
	triggerKeywords: z.array(z.string()),
	flowData: automationFlowDataSchema,
	totalTriggered: z.number().int().nonnegative(),
	lastTriggeredAt: z.date().nullable(),
	publishedAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const listAutomationsInputSchema = z.object({
	status: waBotFlowStatusSchema.optional(),
	search: z.string().min(1).max(100).optional(),
});

export const listAutomationsOutputSchema = z.object({
	data: z.array(automationItemSchema),
});

export const createAutomationInputSchema = z.object({
	accountId: z.string().min(1),
	name: z.string().min(1).max(120),
	description: z.string().max(500).optional(),
	status: waBotFlowStatusSchema.default("draft"),
	triggerType: z.enum(["keyword", "first_inbound"]),
	triggerKeywords: z.array(z.string().min(1).max(100)).max(20).default([]),
	flowData: automationFlowDataSchema,
});

export const createAutomationOutputSchema = z.object({
	data: automationItemSchema,
	message: z.string(),
});

export const updateAutomationStatusInputSchema = z.object({
	automationId: z.string().min(1),
	status: waBotFlowStatusSchema,
});

export const updateAutomationStatusOutputSchema = z.object({
	data: automationItemSchema,
	message: z.string(),
});

export const webhookInputSchema = z.object({
	token: z.string(),
	payload: z.unknown(),
});

export const webhookOutputSchema = z.object({
	data: z.object({ received: z.boolean() }),
});
