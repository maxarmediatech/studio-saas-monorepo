/**
 * Studio API Utilities
 *
 * Query hooks and mutation options for studio modules using ORPC + TanStack Query.
 * These utilities integrate with the @repo/api package.
 */

import { orpc } from "@shared/lib/orpc-query-utils";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const studioQueryKeys = {
	// Invoices
	invoices: {
		all: ["studio", "invoices"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "invoices", "list", filters] as const,
		detail: (id: string) => ["studio", "invoices", "detail", id] as const,
	},
	// Bookings
	bookings: {
		all: ["studio", "bookings"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "bookings", "list", filters] as const,
		detail: (id: string) => ["studio", "bookings", "detail", id] as const,
		stats: () => ["studio", "bookings", "stats"] as const,
		participants: (bookingId: string) =>
			["studio", "bookings", bookingId, "participants"] as const,
	},
	// Clients
	clients: {
		all: ["studio", "clients"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "clients", "list", filters] as const,
		detail: (id: string) => ["studio", "clients", "detail", id] as const,
	},
	// Crews
	crews: {
		all: ["studio", "crews"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "crews", "list", filters] as const,
		detail: (id: string) => ["studio", "crews", "detail", id] as const,
	},
	// Shoots
	shoots: {
		all: ["studio", "shoots"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "shoots", "list", filters] as const,
		detail: (id: string) => ["studio", "shoots", "detail", id] as const,
	},
	// Tasks
	tasks: {
		all: ["studio", "tasks"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "tasks", "list", filters] as const,
		detail: (id: string) => ["studio", "tasks", "detail", id] as const,
	},
	// Deliverables
	deliverables: {
		all: ["studio", "deliverables"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "deliverables", "list", filters] as const,
		detail: (id: string) =>
			["studio", "deliverables", "detail", id] as const,
	},
	// Payments (studio payments - received amounts)
	payments: {
		all: ["studio", "payments"] as const,
		received: {
			list: (filters?: Record<string, unknown>) =>
				["studio", "payments", "received", "list", filters] as const,
			detail: (id: string) =>
				["studio", "payments", "received", "detail", id] as const,
		},
		schedules: {
			list: (filters?: Record<string, unknown>) =>
				["studio", "payments", "schedules", "list", filters] as const,
			detail: (id: string) =>
				["studio", "payments", "schedules", "detail", id] as const,
		},
	},
	// Expenses
	expenses: {
		all: ["studio", "expenses"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "expenses", "list", filters] as const,
		detail: (id: string) => ["studio", "expenses", "detail", id] as const,
	},
	// Activities (for cache invalidation on mutations)
	activities: {
		all: ["studio", "activities"] as const,
	},
	// Your Work
	yourWork: {
		all: ["studio", "your-work"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "your-work", "list", filters] as const,
	},
	// Notifications
	notifications: {
		all: ["studio", "notifications"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "notifications", "list", filters] as const,
		unreadCount: () => ["studio", "notifications", "unread-count"] as const,
		preferences: () => ["studio", "notifications", "preferences"] as const,
	},
	// Dashboard
	dashboard: {
		all: ["studio", "dashboard"] as const,
		overview: (filters?: Record<string, unknown>) =>
			["studio", "dashboard", "overview", filters] as const,
		kpis: (filters?: Record<string, unknown>) =>
			["studio", "dashboard", "kpis", filters] as const,
		operations: () => ["studio", "dashboard", "operations"] as const,
		actions: () => ["studio", "dashboard", "actions"] as const,
	},
	// Submissions (review queue)
	submissions: {
		all: ["studio", "submissions"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "submissions", "list", filters] as const,
		detail: (id: string) =>
			["studio", "submissions", "detail", id] as const,
	},
	discussions: {
		all: ["studio", "discussions"] as const,
		channels: {
			all: ["studio", "discussions", "channels"] as const,
			list: () => ["studio", "discussions", "channels", "list"] as const,
			detail: (id: string) =>
				["studio", "discussions", "channels", "detail", id] as const,
			bySlug: (slug: string) =>
				["studio", "discussions", "channels", "slug", slug] as const,
		},
		posts: {
			list: (channelId: string, filters?: Record<string, unknown>) =>
				[
					"studio",
					"discussions",
					"posts",
					channelId,
					"list",
					filters,
				] as const,
			detail: (id: string) =>
				["studio", "discussions", "posts", "detail", id] as const,
		},
		messages: {
			list: (discussionId: string) =>
				[
					"studio",
					"discussions",
					"messages",
					discussionId,
					"list",
				] as const,
		},
	},
} as const;

export const invoicesApi = {
	listOptions: (
		input?: Parameters<typeof orpc.invoices.list.queryOptions>[0]["input"],
	) => orpc.invoices.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.invoices.get.queryOptions({ input: { id } }),
};

export const invoicesMutations = {
	create: () => orpc.invoices.create.mutationOptions(),
	createFromSchedule: () =>
		orpc.invoices.createFromSchedule.mutationOptions(),
	update: () => orpc.invoices.update.mutationOptions(),
	markSent: () => orpc.invoices.markSent.mutationOptions(),
	cancel: () => orpc.invoices.cancel.mutationOptions(),
	delete: () => orpc.invoices.delete.mutationOptions(),
	addLineItem: () => orpc.invoices.addLineItem.mutationOptions(),
	updateLineItem: () => orpc.invoices.updateLineItem.mutationOptions(),
	removeLineItem: () => orpc.invoices.removeLineItem.mutationOptions(),
};

export const receiptsApi = {
	listOptions: (
		input?: Parameters<typeof orpc.receipts.list.queryOptions>[0]["input"],
	) => orpc.receipts.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.receipts.get.queryOptions({ input: { id } }),
};

export const receiptsMutations = {
	generateFromReceived: () =>
		orpc.receipts.generateFromReceived.mutationOptions(),
	void: () => orpc.receipts.void.mutationOptions(),
};

// ============================================================================
// BOOKINGS QUERY OPTIONS
// ============================================================================

export const bookingsApi = {
	// List bookings
	listOptions: (
		input?: Parameters<typeof orpc.bookings.list.queryOptions>[0]["input"],
	) => orpc.bookings.list.queryOptions({ input: input ?? {} }),

	// List minimal bookings (for dropdowns)
	listMinimalOptions: (
		input?: Parameters<
			typeof orpc.bookings.listMinimal.queryOptions
		>[0]["input"],
	) => orpc.bookings.listMinimal.queryOptions({ input: input ?? {} }),

	// Get single booking
	getOptions: (id: string) =>
		orpc.bookings.get.queryOptions({ input: { id } }),

	// Get booking stats
	statsOptions: () => orpc.bookings.stats.queryOptions({ input: {} }),

	// List participants
	listParticipantsOptions: (bookingId: string) =>
		orpc.bookings.listParticipants.queryOptions({ input: { bookingId } }),

	// List crews (aggregated from shoots, tasks, deliverables)
	listCrewsOptions: (bookingId: string) =>
		orpc.bookings.listCrews.queryOptions({ input: { bookingId } }),
};

// ============================================================================
// BOOKINGS MUTATION OPTIONS
// ============================================================================

export const bookingsMutations = {
	create: () => orpc.bookings.create.mutationOptions(),
	update: () => orpc.bookings.update.mutationOptions(),
	delete: () => orpc.bookings.delete.mutationOptions(),
	updateStatus: () => orpc.bookings.updateStatus.mutationOptions(),
	addParticipant: () => orpc.bookings.addParticipant.mutationOptions(),
	updateParticipant: () => orpc.bookings.updateParticipant.mutationOptions(),
	removeParticipant: () => orpc.bookings.removeParticipant.mutationOptions(),
};

// ============================================================================
// CLIENTS QUERY OPTIONS
// ============================================================================

export const clientsApi = {
	listOptions: (
		input?: Parameters<typeof orpc.clients.list.queryOptions>[0]["input"],
	) => orpc.clients.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.clients.get.queryOptions({ input: { id } }),

	statsOptions: () => orpc.clients.stats.queryOptions({ input: {} }),
};

export const clientsMutations = {
	create: () => orpc.clients.create.mutationOptions(),
	update: () => orpc.clients.update.mutationOptions(),
	delete: () => orpc.clients.delete.mutationOptions(),
};

// ============================================================================
// CREWS QUERY OPTIONS
// ============================================================================

export const crewsApi = {
	listOptions: (
		input?: Parameters<typeof orpc.crews.list.queryOptions>[0]["input"],
	) => orpc.crews.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) => orpc.crews.get.queryOptions({ input: { id } }),

	availabilityOptions: (
		input: Parameters<
			typeof orpc.crews.availability.queryOptions
		>[0]["input"],
	) => orpc.crews.availability.queryOptions({ input }),
};

export const crewsMutations = {
	create: () => orpc.crews.create.mutationOptions(),
	update: () => orpc.crews.update.mutationOptions(),
	delete: () => orpc.crews.delete.mutationOptions(),
	createFromMember: () => orpc.crews.createFromMember.mutationOptions(),
};

// ============================================================================
// SHOOTS QUERY OPTIONS
// ============================================================================

export const shootsApi = {
	listOptions: (
		input?: Parameters<typeof orpc.shoots.list.queryOptions>[0]["input"],
	) => orpc.shoots.list.queryOptions({ input: input ?? {} }),

	listMinimalOptions: (
		input?: Parameters<
			typeof orpc.shoots.listMinimal.queryOptions
		>[0]["input"],
	) => orpc.shoots.listMinimal.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) => orpc.shoots.get.queryOptions({ input: { id } }),
};

export const shootsMutations = {
	create: () => orpc.shoots.create.mutationOptions(),
	update: () => orpc.shoots.update.mutationOptions(),
	delete: () => orpc.shoots.delete.mutationOptions(),
	assignCrew: () => orpc.shoots.assign.mutationOptions(),
	unassignCrew: () => orpc.shoots.unassign.mutationOptions(),
};

// ============================================================================
// CONFIGURATIONS QUERY OPTIONS
// ============================================================================

export const configurationsApi = {
	listOptions: (
		input?: Parameters<
			typeof orpc.configurations.list.queryOptions
		>[0]["input"],
	) => orpc.configurations.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.configurations.get.queryOptions({ input: { id } }),

	// Convenience helpers for specific config types
	bookingTypesOptions: () =>
		orpc.configurations.list.queryOptions({
			input: {
				type: "booking_type",
				limit: 100,
				sortBy: "sortOrder",
				sortDirection: "asc",
			},
		}),

	packageTypesOptions: () =>
		orpc.configurations.list.queryOptions({
			input: { type: "package_type", limit: 100 },
		}),

	taskStatusOptions: () =>
		orpc.configurations.list.queryOptions({
			input: { type: "task_status", limit: 100 },
		}),

	deliverableStatusOptions: () =>
		orpc.configurations.list.queryOptions({
			input: { type: "deliverable_status", limit: 100 },
		}),

	relationTypesOptions: () =>
		orpc.configurations.list.queryOptions({
			input: {
				type: "relation_type",
				limit: 100,
				sortBy: "sortOrder",
				sortDirection: "asc",
			},
		}),

	shootStatusOptions: () =>
		orpc.configurations.list.queryOptions({
			input: { type: "shoot_status", limit: 100 },
		}),

	specialisationsOptions: () =>
		orpc.configurations.list.queryOptions({
			input: {
				type: "crew_role",
				limit: 100,
				sortBy: "sortOrder",
				sortDirection: "asc",
			},
		}),

	crewRolesOptions: () =>
		orpc.configurations.list.queryOptions({
			input: {
				type: "crew_role",
				limit: 100,
				sortBy: "sortOrder",
				sortDirection: "asc",
			},
		}),

	eventTypesOptions: () =>
		orpc.configurations.list.queryOptions({
			input: {
				type: "event_type",
				limit: 100,
				sortBy: "sortOrder",
				sortDirection: "asc",
			},
		}),
};

export const configurationsMutations = {
	create: () => orpc.configurations.create.mutationOptions(),
	update: () => orpc.configurations.update.mutationOptions(),
	delete: () => orpc.configurations.delete.mutationOptions(),
	seed: () => orpc.configurations.seed.mutationOptions(),
};

// ============================================================================
// TASKS QUERY OPTIONS
// ============================================================================

export const tasksApi = {
	listOptions: (
		input?: Parameters<typeof orpc.tasks.list.queryOptions>[0]["input"],
	) => orpc.tasks.list.queryOptions({ input: input ?? {} }),

	listMinimalOptions: (
		input?: Parameters<
			typeof orpc.tasks.listMinimal.queryOptions
		>[0]["input"],
	) => orpc.tasks.listMinimal.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) => orpc.tasks.get.queryOptions({ input: { id } }),

	statsOptions: (
		input?: Parameters<typeof orpc.tasks.stats.queryOptions>[0]["input"],
	) => orpc.tasks.stats.queryOptions({ input: input ?? {} }),
};

export const tasksMutations = {
	create: () => orpc.tasks.create.mutationOptions(),
	update: () => orpc.tasks.update.mutationOptions(),
	delete: () => orpc.tasks.delete.mutationOptions(),
	updateStatus: () => orpc.tasks.updateStatus.mutationOptions(),
	updateAssignmentStatus: () =>
		orpc.tasks.updateAssignmentStatus.mutationOptions(),
	assign: () => orpc.tasks.assign.mutationOptions(),
	unassign: () => orpc.tasks.unassign.mutationOptions(),
	submit: () => orpc.tasks.submit.mutationOptions(),
};

// ============================================================================
// DELIVERABLES QUERY OPTIONS
// ============================================================================

export const deliverablesApi = {
	listOptions: (
		input?: Parameters<
			typeof orpc.deliverables.list.queryOptions
		>[0]["input"],
	) => orpc.deliverables.list.queryOptions({ input: input ?? {} }),

	listMinimalOptions: (
		input?: Parameters<
			typeof orpc.deliverables.listMinimal.queryOptions
		>[0]["input"],
	) => orpc.deliverables.listMinimal.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.deliverables.get.queryOptions({ input: { id } }),

	statsOptions: (
		input?: Parameters<
			typeof orpc.deliverables.stats.queryOptions
		>[0]["input"],
	) => orpc.deliverables.stats.queryOptions({ input: input ?? {} }),
};

export const deliverablesMutations = {
	create: () => orpc.deliverables.create.mutationOptions(),
	update: () => orpc.deliverables.update.mutationOptions(),
	delete: () => orpc.deliverables.delete.mutationOptions(),
	assign: () => orpc.deliverables.assign.mutationOptions(),
	unassign: () => orpc.deliverables.unassign.mutationOptions(),
	convertToTask: () => orpc.deliverables.convertToTask.mutationOptions(),
	updateAssignmentStatus: () =>
		orpc.deliverables.updateAssignmentStatus.mutationOptions(),
	submit: () => orpc.deliverables.submit.mutationOptions(),
};

// ============================================================================
// SUBMISSIONS QUERY OPTIONS
// ============================================================================

export const submissionsApi = {
	listOptions: (
		input?: Parameters<
			typeof orpc.submissions.list.queryOptions
		>[0]["input"],
	) => orpc.submissions.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.submissions.get.queryOptions({ input: { id } }),
};

export const submissionsMutations = {
	claim: () => orpc.submissions.claim.mutationOptions(),
	review: () => orpc.submissions.review.mutationOptions(),
};

// ============================================================================
// STUDIO PAYMENTS QUERY OPTIONS (Received Amounts & Schedules)
// ============================================================================

export const studioPaymentsApi = {
	// Received amounts
	listReceivedOptions: (
		input?: Parameters<
			typeof orpc.studioPayments.listReceived.queryOptions
		>[0]["input"],
	) => orpc.studioPayments.listReceived.queryOptions({ input: input ?? {} }),

	getReceivedOptions: (id: string) =>
		orpc.studioPayments.getReceived.queryOptions({ input: { id } }),

	// Payment schedules
	listSchedulesOptions: (
		input?: Parameters<
			typeof orpc.studioPayments.listSchedules.queryOptions
		>[0]["input"],
	) => orpc.studioPayments.listSchedules.queryOptions({ input: input ?? {} }),

	listSchedulesMinimalOptions: (
		input?: Parameters<
			typeof orpc.studioPayments.listSchedulesMinimal.queryOptions
		>[0]["input"],
	) =>
		orpc.studioPayments.listSchedulesMinimal.queryOptions({
			input: input ?? {},
		}),

	getScheduleOptions: (id: string) =>
		orpc.studioPayments.getSchedule.queryOptions({ input: { id } }),

	// Stats
	statsOptions: (
		input?: Parameters<
			typeof orpc.studioPayments.stats.queryOptions
		>[0]["input"],
	) => orpc.studioPayments.stats.queryOptions({ input: input ?? {} }),
};

export const studioPaymentsMutations = {
	// Received amounts
	createReceived: () => orpc.studioPayments.createReceived.mutationOptions(),
	updateReceived: () => orpc.studioPayments.updateReceived.mutationOptions(),
	deleteReceived: () => orpc.studioPayments.deleteReceived.mutationOptions(),

	// Payment schedules
	createSchedule: () => orpc.studioPayments.createSchedule.mutationOptions(),
	updateSchedule: () => orpc.studioPayments.updateSchedule.mutationOptions(),
	deleteSchedule: () => orpc.studioPayments.deleteSchedule.mutationOptions(),
	convertSchedule: () =>
		orpc.studioPayments.convertSchedule.mutationOptions(),
};

// ============================================================================
// EXPENSES QUERY OPTIONS
// ============================================================================

export const expensesApi = {
	listOptions: (
		input?: Parameters<typeof orpc.expenses.list.queryOptions>[0]["input"],
	) => orpc.expenses.list.queryOptions({ input: input ?? {} }),

	listMinimalOptions: (
		input?: Parameters<
			typeof orpc.expenses.listMinimal.queryOptions
		>[0]["input"],
	) => orpc.expenses.listMinimal.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.expenses.get.queryOptions({ input: { id } }),

	statsOptions: (
		input?: Parameters<typeof orpc.expenses.stats.queryOptions>[0]["input"],
	) => orpc.expenses.stats.queryOptions({ input: input ?? {} }),
};

export const expensesMutations = {
	create: () => orpc.expenses.create.mutationOptions(),
	update: () => orpc.expenses.update.mutationOptions(),
	delete: () => orpc.expenses.delete.mutationOptions(),
};

// ============================================================================
// SAVED VIEWS QUERY OPTIONS
// ============================================================================

export const savedViewsApi = {
	listOptions: (
		input: Parameters<typeof orpc.savedViews.list.queryOptions>[0]["input"],
	) => orpc.savedViews.list.queryOptions({ input }),
};

export const savedViewsMutations = {
	create: () => orpc.savedViews.create.mutationOptions(),
	update: () => orpc.savedViews.update.mutationOptions(),
	delete: () => orpc.savedViews.delete.mutationOptions(),
	toggleFavorite: () => orpc.savedViews.toggleFavorite.mutationOptions(),
};

export const recentVisitsApi = {
	listOptions: (
		input?: Parameters<
			typeof orpc.recentVisits.list.queryOptions
		>[0]["input"],
	) => orpc.recentVisits.list.queryOptions({ input: input ?? {} }),
};

export const recentVisitsMutations = {
	track: () => orpc.recentVisits.track.mutationOptions(),
};

export const quickLinksApi = {
	listOptions: () => orpc.quickLinks.list.queryOptions({ input: {} }),
};

export const quickLinksMutations = {
	create: () => orpc.quickLinks.create.mutationOptions(),
	update: () => orpc.quickLinks.update.mutationOptions(),
	delete: () => orpc.quickLinks.delete.mutationOptions(),
};

export const stickiesApi = {
	listOptions: (
		input?: Parameters<typeof orpc.stickies.list.queryOptions>[0]["input"],
	) => orpc.stickies.list.queryOptions({ input: input ?? {} }),
};

export const stickiesMutations = {
	create: () => orpc.stickies.create.mutationOptions(),
	update: () => orpc.stickies.update.mutationOptions(),
	delete: () => orpc.stickies.delete.mutationOptions(),
};

// ============================================================================
// ACTIVITIES QUERY OPTIONS
// ============================================================================

export const activitiesApi = {
	listOptions: (
		input?: Parameters<
			typeof orpc.activities.list.queryOptions
		>[0]["input"],
	) => orpc.activities.list.queryOptions({ input: input ?? {} }),
};

// ============================================================================
// YOUR WORK QUERY OPTIONS
// ============================================================================

export const yourWorkApi = {
	listOptions: (
		input: Parameters<typeof orpc.yourWork.list.queryOptions>[0]["input"],
	) => orpc.yourWork.list.queryOptions({ input }),
};

export const yourWorkMutations = {
	subscribe: () => orpc.yourWork.subscribe.mutationOptions(),
	unsubscribe: () => orpc.yourWork.unsubscribe.mutationOptions(),
};

// ============================================================================
// NOTIFICATIONS QUERY OPTIONS
// ============================================================================

export const notificationsApi = {
	listOptions: (
		input: Parameters<
			typeof orpc.notifications.list.queryOptions
		>[0]["input"],
	) => orpc.notifications.list.queryOptions({ input }),
	unreadCountOptions: () => orpc.notifications.unreadCount.queryOptions(),
	preferencesOptions: () =>
		orpc.notifications.getPreferences.queryOptions({ input: undefined }),
};

export const notificationsMutations = {
	markRead: () => orpc.notifications.markRead.mutationOptions(),
	markUnread: () => orpc.notifications.markUnread.mutationOptions(),
	markAllRead: () => orpc.notifications.markAllRead.mutationOptions(),
	updatePreferences: () =>
		orpc.notifications.updatePreferences.mutationOptions(),
};

// ============================================================================
// WHATSAPP QUERY OPTIONS
// ============================================================================

export const whatsappApi = {
	listAccountsOptions: () =>
		orpc.whatsapp.listAccounts.queryOptions({ input: {} }),

	getAccountOptions: (accountId: string) =>
		orpc.whatsapp.getAccount.queryOptions({ input: { accountId } }),

	listConversationsOptions: (
		input?: Parameters<
			typeof orpc.whatsapp.listConversations.queryOptions
		>[0]["input"],
	) => orpc.whatsapp.listConversations.queryOptions({ input: input ?? {} }),

	listCampaignsOptions: (
		input?: Parameters<
			typeof orpc.whatsapp.listCampaigns.queryOptions
		>[0]["input"],
	) => orpc.whatsapp.listCampaigns.queryOptions({ input: input ?? {} }),

	listMessagesOptions: (
		input: Parameters<
			typeof orpc.whatsapp.listMessages.queryOptions
		>[0]["input"],
	) => orpc.whatsapp.listMessages.queryOptions({ input }),

	listContactsOptions: (
		input?: Parameters<
			typeof orpc.whatsapp.listContacts.queryOptions
		>[0]["input"],
	) => orpc.whatsapp.listContacts.queryOptions({ input: input ?? {} }),

	listContactTagsOptions: (
		input?: Parameters<
			typeof orpc.whatsapp.listContactTags.queryOptions
		>[0]["input"],
	) => orpc.whatsapp.listContactTags.queryOptions({ input: input ?? {} }),

	listTemplatesOptions: (
		input: Parameters<
			typeof orpc.whatsapp.listTemplates.queryOptions
		>[0]["input"],
	) => orpc.whatsapp.listTemplates.queryOptions({ input }),
};

export const whatsappMutations = {
	assignConversation: () =>
		orpc.whatsapp.assignConversation.mutationOptions(),
	completeEmbeddedSignup: () =>
		orpc.whatsapp.completeEmbeddedSignup.mutationOptions(),
	connectCloudApi: () => orpc.whatsapp.connectCloudApi.mutationOptions(),
	updateAccount: () => orpc.whatsapp.updateAccount.mutationOptions(),
	deleteAccount: () => orpc.whatsapp.deleteAccount.mutationOptions(),
	testAccount: () => orpc.whatsapp.testAccount.mutationOptions(),
	subscribeAccount: () => orpc.whatsapp.subscribeAccount.mutationOptions(),
	retryMessage: () => orpc.whatsapp.retryMessage.mutationOptions(),
	sendMedia: () => orpc.whatsapp.sendMedia.mutationOptions(),
	sendText: () => orpc.whatsapp.sendText.mutationOptions(),
	sendTemplate: () => orpc.whatsapp.sendTemplate.mutationOptions(),
	syncTemplates: () => orpc.whatsapp.syncTemplates.mutationOptions(),
	markConversationRead: () =>
		orpc.whatsapp.markConversationRead.mutationOptions(),
	updateConversationStatus: () =>
		orpc.whatsapp.updateConversationStatus.mutationOptions(),
};

// ============================================================================
// DISCUSSIONS QUERY OPTIONS
// ============================================================================

export const discussionsApi = {
	listChannelsOptions: () =>
		orpc.discussions.listChannels.queryOptions({ input: {} }),

	getChannelOptions: (channelId: string) =>
		orpc.discussions.getChannel.queryOptions({ input: { channelId } }),

	getChannelBySlugOptions: (slug: string) =>
		orpc.discussions.getChannelBySlug.queryOptions({ input: { slug } }),

	listDiscussionsOptions: (
		input: Parameters<
			typeof orpc.discussions.listDiscussions.queryOptions
		>[0]["input"],
	) => orpc.discussions.listDiscussions.queryOptions({ input }),

	getDiscussionOptions: (discussionId: string) =>
		orpc.discussions.getDiscussion.queryOptions({
			input: { discussionId },
		}),

	listMessagesOptions: (
		input: Parameters<
			typeof orpc.discussions.listMessages.queryOptions
		>[0]["input"],
	) => orpc.discussions.listMessages.queryOptions({ input }),
};

export const discussionsMutations = {
	createChannel: () => orpc.discussions.createChannel.mutationOptions(),
	updateChannel: () => orpc.discussions.updateChannel.mutationOptions(),
	deleteChannel: () => orpc.discussions.deleteChannel.mutationOptions(),
	addChannelMember: () => orpc.discussions.addChannelMember.mutationOptions(),
	removeChannelMember: () =>
		orpc.discussions.removeChannelMember.mutationOptions(),
	toggleSubscription: () =>
		orpc.discussions.toggleSubscription.mutationOptions(),

	createDiscussion: () => orpc.discussions.createDiscussion.mutationOptions(),
	updateDiscussion: () => orpc.discussions.updateDiscussion.mutationOptions(),
	deleteDiscussion: () => orpc.discussions.deleteDiscussion.mutationOptions(),
	resolveDiscussion: () =>
		orpc.discussions.resolveDiscussion.mutationOptions(),
	reopenDiscussion: () => orpc.discussions.reopenDiscussion.mutationOptions(),
	addDiscussionLink: () =>
		orpc.discussions.addDiscussionLink.mutationOptions(),
	removeDiscussionLink: () =>
		orpc.discussions.removeDiscussionLink.mutationOptions(),

	createMessage: () => orpc.discussions.createMessage.mutationOptions(),
	updateMessage: () => orpc.discussions.updateMessage.mutationOptions(),
	deleteMessage: () => orpc.discussions.deleteMessage.mutationOptions(),
};

// ============================================================================
// CHECKINS QUERY OPTIONS
// ============================================================================

export const checkinsApi = {
	listTypesOptions: (
		input?: Parameters<
			typeof orpc.checkins.listTypes.queryOptions
		>[0]["input"],
	) => orpc.checkins.listTypes.queryOptions({ input: input ?? {} }),

	getTypeOptions: (checkinTypeId: string) =>
		orpc.checkins.getType.queryOptions({ input: { checkinTypeId } }),

	listCheckinsOptions: (
		input: Parameters<
			typeof orpc.checkins.listCheckins.queryOptions
		>[0]["input"],
	) => orpc.checkins.listCheckins.queryOptions({ input }),

	getCheckinOptions: (checkinId: string) =>
		orpc.checkins.getCheckin.queryOptions({ input: { checkinId } }),

	listCommentsOptions: (
		input: Parameters<
			typeof orpc.checkins.listComments.queryOptions
		>[0]["input"],
	) => orpc.checkins.listComments.queryOptions({ input }),

	listUserCheckinsOptions: (
		input: Parameters<
			typeof orpc.checkins.listUserCheckins.queryOptions
		>[0]["input"],
	) => orpc.checkins.listUserCheckins.queryOptions({ input }),
};

export const checkinsMutations = {
	createType: () => orpc.checkins.createType.mutationOptions(),
	updateType: () => orpc.checkins.updateType.mutationOptions(),
	deleteType: () => orpc.checkins.deleteType.mutationOptions(),

	createCheckin: () => orpc.checkins.createCheckin.mutationOptions(),
	updateCheckin: () => orpc.checkins.updateCheckin.mutationOptions(),
	deleteCheckin: () => orpc.checkins.deleteCheckin.mutationOptions(),

	createComment: () => orpc.checkins.createComment.mutationOptions(),
	updateComment: () => orpc.checkins.updateComment.mutationOptions(),
	deleteComment: () => orpc.checkins.deleteComment.mutationOptions(),

	addLink: () => orpc.checkins.addLink.mutationOptions(),
	removeLink: () => orpc.checkins.removeLink.mutationOptions(),
};

export const dashboardApi = {
	getOptions: (
		input?: Parameters<typeof orpc.dashboard.get.queryOptions>[0]["input"],
	) => orpc.dashboard.get.queryOptions({ input: input ?? {} }),

	kpisOptions: (
		input?: Parameters<typeof orpc.dashboard.kpis.queryOptions>[0]["input"],
	) => orpc.dashboard.kpis.queryOptions({ input: input ?? {} }),

	operationsOptions: (
		input?: Parameters<
			typeof orpc.dashboard.operations.queryOptions
		>[0]["input"],
	) => orpc.dashboard.operations.queryOptions({ input: input ?? {} }),

	actionsOptions: () => orpc.dashboard.actions.queryOptions({ input: {} }),
};
