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

export const waContactRelations = relations(waContacts, ({ many }) => ({
	conversations: many(waConversations),
	messages: many(waMessages),
}));

export const waConversationRelations = relations(waConversations, ({ many }) => ({
	messages: many(waMessages),
}));

export const waMessageRelations = relations(waMessages, ({ one }) => ({
	media: one(waMedia, {
		fields: [waMessages.mediaId],
		references: [waMedia.id],
	}),
	outbox: one(waOutbox, {
		fields: [waMessages.id],
		references: [waOutbox.messageId],
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
	message: one(waMessages, {
		fields: [waOutbox.messageId],
		references: [waMessages.id],
	}),
}));

export const waCampaignRelations = relations(waCampaigns, ({ one }) => ({
	media: one(waMedia, {
		fields: [waCampaigns.mediaId],
		references: [waMedia.id],
	}),
}));

export const waBotFlowRelations = relations(waBotFlows, ({ many }) => ({
	messages: many(waMessages),
}));
