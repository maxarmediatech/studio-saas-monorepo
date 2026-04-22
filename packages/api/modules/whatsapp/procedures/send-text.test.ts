import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let capturedHandler:
		| ((options: {
				input: {
					accountId: string;
					to: string;
					text: string;
				};
				context: {
					headers: Headers;
					organizationId: string;
					user: { id: string };
				};
		  }) => Promise<unknown>)
		| undefined;

	const procedureChain = {
		route: vi.fn(() => procedureChain),
		input: vi.fn(() => procedureChain),
		output: vi.fn(() => procedureChain),
		handler: vi.fn((handler) => {
			capturedHandler = handler;
			return procedureChain;
		}),
	};

	return {
		get handler() {
			if (!capturedHandler) {
				throw new Error("Handler not captured");
			}

			return capturedHandler;
		},
		mockAnd: vi.fn((...args) => args),
		mockDbInsert: vi.fn(),
		mockEq: vi.fn((left, right) => ({ eq: [left, right] })),
		mockFindActiveWhatsAppAccount: vi.fn(),
		mockFindContact: vi.fn(),
		mockFindConversation: vi.fn(),
		mockRecordOutboundConversationActivity: vi.fn(),
		procedureChain,
	};
});

vi.mock("../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.procedureChain,
}));

vi.mock("../lib/account-repository", () => ({
	findActiveWhatsAppAccount: mocks.mockFindActiveWhatsAppAccount,
}));

vi.mock("../lib/outbound-activity", () => ({
	recordOutboundConversationActivity:
		mocks.mockRecordOutboundConversationActivity,
}));

vi.mock("@repo/database", () => ({
	and: mocks.mockAnd,
	db: {
		insert: mocks.mockDbInsert,
		query: {
			waContacts: {
				findFirst: mocks.mockFindContact,
			},
			waConversations: {
				findFirst: mocks.mockFindConversation,
			},
		},
	},
	eq: mocks.mockEq,
}));

vi.mock("@repo/whatsapp-db", () => ({
	waContacts: {
		__table: "waContacts",
		accountId: "waContacts.accountId",
		id: "waContacts.id",
		organizationId: "waContacts.organizationId",
		phoneNumber: "waContacts.phoneNumber",
		waId: "waContacts.waId",
	},
	waConversations: {
		__table: "waConversations",
		accountId: "waConversations.accountId",
		contactId: "waConversations.contactId",
		id: "waConversations.id",
		organizationId: "waConversations.organizationId",
	},
	waMessages: {
		__table: "waMessages",
		createdAt: "waMessages.createdAt",
		id: "waMessages.id",
	},
	waOutbox: {
		__table: "waOutbox",
		id: "waOutbox.id",
	},
}));

import "./send-text";

const context = {
	headers: new Headers(),
	organizationId: "org_1",
	user: { id: "user_1" },
};

const input = {
	accountId: "account_input",
	to: "919999999999",
	text: "Hello",
};

function mockInsertReturningByTable(results: Record<string, unknown>) {
	mocks.mockDbInsert.mockImplementation((table: { __table: string }) => ({
		values: vi.fn((values) => ({
			returning: vi.fn(async () => {
				const result = results[table.__table];
				return Array.isArray(result) ? result : [result ?? values];
			}),
		})),
	}));
}

describe("sendText", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mockRecordOutboundConversationActivity.mockResolvedValue(
			undefined,
		);
	});

	it("rejects missing or cross-organization accounts before writes", async () => {
		mocks.mockFindActiveWhatsAppAccount.mockResolvedValue(null);

		await expect(
			mocks.handler({
				input,
				context,
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(mocks.mockFindActiveWhatsAppAccount).toHaveBeenCalledWith(
			"org_1",
			"account_input",
		);
		expect(mocks.mockFindContact).not.toHaveBeenCalled();
		expect(mocks.mockFindConversation).not.toHaveBeenCalled();
		expect(mocks.mockDbInsert).not.toHaveBeenCalled();
		expect(
			mocks.mockRecordOutboundConversationActivity,
		).not.toHaveBeenCalled();
	});

	it("enqueues text with the resolved active account id", async () => {
		const createdAt = new Date("2026-04-22T10:00:00.000Z");
		mocks.mockFindActiveWhatsAppAccount.mockResolvedValue({
			id: "account_resolved",
		});
		mocks.mockFindContact.mockResolvedValue({ id: "contact_1" });
		mocks.mockFindConversation.mockResolvedValue({ id: "conversation_1" });
		mockInsertReturningByTable({
			waMessages: [{ id: "message_1", createdAt }],
			waOutbox: [{ id: "outbox_1" }],
		});

		await expect(
			mocks.handler({
				input,
				context,
			}),
		).resolves.toEqual({
			data: { messageId: "message_1", outboxId: "outbox_1" },
			message: "Message queued",
		});

		const messageInsert = mocks.mockDbInsert.mock.results[0]?.value
			.values as ReturnType<typeof vi.fn>;
		const outboxInsert = mocks.mockDbInsert.mock.results[1]?.value
			.values as ReturnType<typeof vi.fn>;

		expect(messageInsert).toHaveBeenCalledWith(
			expect.objectContaining({
				accountId: "account_resolved",
				conversationId: "conversation_1",
				contactId: "contact_1",
				textBody: "Hello",
			}),
		);
		expect(outboxInsert).toHaveBeenCalledWith(
			expect.objectContaining({
				accountId: "account_resolved",
				messageId: "message_1",
			}),
		);
	});
});
