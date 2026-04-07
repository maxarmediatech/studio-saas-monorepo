import { relations } from "drizzle-orm";
import {
	waAccounts,
	waBotFlows,
	waCampaigns,
	waContacts,
	waConversations,
	waEvents,
	waMedia,
	waMessages,
	waOutbox,
} from "./schema";

export const waAccountRelations = relations(waAccounts, ({ many }) => ({
	contacts: many(waContacts),
	conversations: many(waConversations),
	messages: many(waMessages),
	events: many(waEvents),
	outbox: many(waOutbox),
	campaigns: many(waCampaigns),
	botFlows: many(waBotFlows),
}));

export const waContactRelations = relations(waContacts, ({ one, many }) => ({
	account: one(waAccounts, {
		fields: [waContacts.accountId],
		references: [waAccounts.id],
	}),
	conversations: many(waConversations),
	messages: many(waMessages),
}));

export const waConversationRelations = relations(
	waConversations,
	({ one, many }) => ({
		account: one(waAccounts, {
			fields: [waConversations.accountId],
			references: [waAccounts.id],
		}),
		contact: one(waContacts, {
			fields: [waConversations.contactId],
			references: [waContacts.id],
		}),
		messages: many(waMessages),
	}),
);

export const waMessageRelations = relations(waMessages, ({ one }) => ({
	account: one(waAccounts, {
		fields: [waMessages.accountId],
		references: [waAccounts.id],
	}),
	conversation: one(waConversations, {
		fields: [waMessages.conversationId],
		references: [waConversations.id],
	}),
	contact: one(waContacts, {
		fields: [waMessages.contactId],
		references: [waContacts.id],
	}),
	media: one(waMedia, {
		fields: [waMessages.mediaId],
		references: [waMedia.id],
	}),
	outbox: one(waOutbox, {
		fields: [waMessages.id],
		references: [waOutbox.messageId],
	}),
	botFlow: one(waBotFlows, {
		fields: [waMessages.sentByBotFlowId],
		references: [waBotFlows.id],
	}),
}));

export const waMediaRelations = relations(waMedia, ({ many }) => ({
	messages: many(waMessages),
}));

export const waEventRelations = relations(waEvents, ({ one }) => ({
	account: one(waAccounts, {
		fields: [waEvents.accountId],
		references: [waAccounts.id],
	}),
}));

export const waOutboxRelations = relations(waOutbox, ({ one }) => ({
	account: one(waAccounts, {
		fields: [waOutbox.accountId],
		references: [waAccounts.id],
	}),
	message: one(waMessages, {
		fields: [waOutbox.messageId],
		references: [waMessages.id],
	}),
}));

export const waCampaignRelations = relations(waCampaigns, ({ one }) => ({
	account: one(waAccounts, {
		fields: [waCampaigns.accountId],
		references: [waAccounts.id],
	}),
	media: one(waMedia, {
		fields: [waCampaigns.mediaId],
		references: [waMedia.id],
	}),
}));

export const waBotFlowRelations = relations(waBotFlows, ({ one, many }) => ({
	account: one(waAccounts, {
		fields: [waBotFlows.accountId],
		references: [waAccounts.id],
	}),
	messages: many(waMessages),
}));
