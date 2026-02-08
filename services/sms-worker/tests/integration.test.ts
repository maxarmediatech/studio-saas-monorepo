import { db, eq, smsOutbox } from "@repo/database";
import type { SmsSendResult } from "@repo/sms/src/types";
import { queueSms } from "@repo/sms/src/util/send";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

let mockSendCalls: Array<{
	to: string;
	message: string;
	templateId?: string;
}> = [];
let mockSendDelay = 0;
let mockSendCallCount = 0;

type MockSendHandler = (params: {
	to: string;
	message: string;
	templateId?: string;
}) => SmsSendResult | Promise<SmsSendResult>;

let mockSendHandler: MockSendHandler = () => ({
	success: true,
	messageId: "test-msg-id",
});

vi.mock("@repo/sms/src/provider/msg91", () => ({
	createMsg91Provider: () => ({
		send: async (params: {
			to: string;
			message: string;
			templateId?: string;
		}) => {
			mockSendCallCount++;
			mockSendCalls.push(params);

			if (mockSendDelay > 0) {
				await new Promise((resolve) =>
					setTimeout(resolve, mockSendDelay),
				);
			}

			return mockSendHandler(params);
		},
	}),
	Msg91Provider: class {
		send = async (params: {
			to: string;
			message: string;
			templateId?: string;
		}) => {
			mockSendCallCount++;
			mockSendCalls.push(params);

			if (mockSendDelay > 0) {
				await new Promise((resolve) =>
					setTimeout(resolve, mockSendDelay),
				);
			}

			return mockSendHandler(params);
		};
	},
}));

import {
	claimMessages,
	computeNextAttemptAt,
	createSmsWorker,
	recoverStuckMessages,
} from "../src/worker";

const TEST_ORG_ID = "test-org-integration";

async function cleanupTestData() {
	await db.delete(smsOutbox).where(eq(smsOutbox.organizationId, TEST_ORG_ID));
}

async function createTestMessage(
	overrides: Partial<typeof smsOutbox.$inferInsert> = {},
) {
	const [message] = await db
		.insert(smsOutbox)
		.values({
			organizationId: TEST_ORG_ID,
			phoneNumber: "+919876543210",
			templateId: "test-template",
			variables: { message: "Test message" },
			status: "pending",
			attempts: 0,
			maxAttempts: 3,
			...overrides,
		})
		.returning();
	return message;
}

async function getMessage(id: string) {
	const [message] = await db
		.select()
		.from(smsOutbox)
		.where(eq(smsOutbox.id, id));
	return message;
}

async function waitFor(
	condition: () => Promise<boolean>,
	timeoutMs = 5000,
	intervalMs = 100,
): Promise<void> {
	const startTime = Date.now();
	while (Date.now() - startTime < timeoutMs) {
		if (await condition()) return;
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
	throw new Error(`Condition not met within ${timeoutMs}ms`);
}

describe("SMS Worker Integration Tests", () => {
	beforeAll(async () => {
		await cleanupTestData();
	});

	beforeEach(() => {
		mockSendCalls = [];
		mockSendHandler = () => ({ success: true, messageId: "test-msg-id" });
		mockSendDelay = 0;
		mockSendCallCount = 0;
	});

	afterEach(async () => {
		await cleanupTestData();
	});

	afterAll(async () => {
		await cleanupTestData();
	});

	describe("End-to-End Flow", () => {
		it("should process message from queue to sent status", async () => {
			await queueSms({
				organizationId: TEST_ORG_ID,
				phoneNumber: "+919876543210",
				templateId: "test-template",
				variables: { message: "Hello World" },
			});

			const [queued] = await db
				.select()
				.from(smsOutbox)
				.where(eq(smsOutbox.organizationId, TEST_ORG_ID));

			expect(queued).toBeDefined();
			expect(queued.status).toBe("pending");

			const worker = createSmsWorker({
				pollIntervalMs: 100,
				batchSize: 10,
				workerId: "test-worker-e2e",
			});

			await worker.start();

			await waitFor(async () => {
				const msg = await getMessage(queued.id);
				return msg?.status === "sent";
			});

			await worker.stop();

			const sent = await getMessage(queued.id);
			expect(sent.status).toBe("sent");
			expect(sent.providerMessageId).toBe("test-msg-id");
			expect(sent.errorMessage).toBeNull();
			expect(mockSendCalls.length).toBeGreaterThanOrEqual(1);
			expect(mockSendCalls[0].to).toBe("+919876543210");
		});
	});

	describe("Concurrency - No Duplicates", () => {
		it("should not process same message twice with 2 workers", async () => {
			const messageIds: string[] = [];
			for (let i = 0; i < 10; i++) {
				const msg = await createTestMessage({
					phoneNumber: `+91987654321${i}`,
					variables: { message: `Message ${i}` },
				});
				messageIds.push(msg.id);
			}

			mockSendDelay = 50;

			const worker1 = createSmsWorker({
				pollIntervalMs: 50,
				batchSize: 5,
				workerId: "worker-1",
			});

			const worker2 = createSmsWorker({
				pollIntervalMs: 50,
				batchSize: 5,
				workerId: "worker-2",
			});

			await Promise.all([worker1.start(), worker2.start()]);

			await waitFor(
				async () => {
					const pending = await db
						.select()
						.from(smsOutbox)
						.where(eq(smsOutbox.organizationId, TEST_ORG_ID));
					return pending.every((m) => m.status === "sent");
				},
				10000,
				100,
			);

			await Promise.all([worker1.stop(), worker2.stop()]);

			const sentMessages = await db
				.select()
				.from(smsOutbox)
				.where(eq(smsOutbox.organizationId, TEST_ORG_ID));

			expect(sentMessages.length).toBe(10);
			expect(sentMessages.every((m) => m.status === "sent")).toBe(true);
			expect(mockSendCallCount).toBe(10);

			const calledNumbers = mockSendCalls.map((c) => c.to);
			const uniqueNumbers = new Set(calledNumbers);
			expect(uniqueNumbers.size).toBe(10);
		});
	});

	describe("Failure Recovery", () => {
		it("should recover stuck messages after crash simulation", async () => {
			const stuckMsg = await createTestMessage();

			const stuckTime = new Date(Date.now() - 10 * 60 * 1000);
			await db
				.update(smsOutbox)
				.set({
					status: "processing",
					lockedAt: stuckTime,
					lockedBy: "crashed-worker",
					processingStartedAt: stuckTime,
				})
				.where(eq(smsOutbox.id, stuckMsg.id));

			const stuck = await getMessage(stuckMsg.id);
			expect(stuck.status).toBe("processing");

			const recoveredCount = await recoverStuckMessages({
				staleThresholdMinutes: 5,
			});

			expect(recoveredCount).toBe(1);

			const recovered = await getMessage(stuckMsg.id);
			expect(recovered.status).toBe("pending");
			expect(recovered.lockedAt).toBeNull();
			expect(recovered.lockedBy).toBeNull();

			const worker = createSmsWorker({
				pollIntervalMs: 100,
				batchSize: 10,
				workerId: "recovery-worker",
			});

			await worker.start();

			await waitFor(async () => {
				const msg = await getMessage(stuckMsg.id);
				return msg?.status === "sent";
			});

			await worker.stop();

			const sent = await getMessage(stuckMsg.id);
			expect(sent.status).toBe("sent");
		});
	});

	describe("Retry Logic", () => {
		it("should retry on temporary failure with exponential backoff", async () => {
			const msg = await createTestMessage();

			mockSendHandler = () => ({
				success: false,
				error: "Temporary failure",
			});

			const worker = createSmsWorker({
				pollIntervalMs: 100,
				batchSize: 10,
				workerId: "retry-worker",
			});

			await worker.start();

			await waitFor(async () => {
				const m = await getMessage(msg.id);
				return m?.attempts === 1;
			}, 3000);

			await worker.stop();

			const afterFirst = await getMessage(msg.id);
			expect(afterFirst.status).toBe("pending");
			expect(afterFirst.attempts).toBe(1);
			expect(afterFirst.nextAttemptAt).not.toBeNull();

			const expectedDelayMs = 30 * 1000;
			const actualDelay =
				new Date(afterFirst.nextAttemptAt!).getTime() -
				afterFirst.lastAttemptAt!.getTime();
			expect(actualDelay).toBeGreaterThanOrEqual(expectedDelayMs - 5000);
			expect(actualDelay).toBeLessThanOrEqual(expectedDelayMs + 5000);
		});

		it("should compute correct backoff delays", () => {
			const now = Date.now();

			const delay1 = computeNextAttemptAt(1).getTime() - now;
			expect(delay1).toBeGreaterThanOrEqual(29000);
			expect(delay1).toBeLessThanOrEqual(31000);

			const delay2 = computeNextAttemptAt(2).getTime() - now;
			expect(delay2).toBeGreaterThanOrEqual(59000);
			expect(delay2).toBeLessThanOrEqual(61000);

			const delay3 = computeNextAttemptAt(3).getTime() - now;
			expect(delay3).toBeGreaterThanOrEqual(119000);
			expect(delay3).toBeLessThanOrEqual(121000);

			const delay10 = computeNextAttemptAt(10).getTime() - now;
			expect(delay10).toBeGreaterThanOrEqual(15 * 60 * 1000 - 1000);
			expect(delay10).toBeLessThanOrEqual(15 * 60 * 1000 + 1000);
		});
	});

	describe("Permanent Failure", () => {
		it("should mark message as permanent failure after exhausting retries", async () => {
			const msg = await createTestMessage({
				phoneNumber: "invalid-phone",
				maxAttempts: 2,
			});

			mockSendHandler = () => ({
				success: false,
				error: "Phone number is invalid",
			});

			async function processAttempt() {
				const worker = createSmsWorker({
					pollIntervalMs: 50,
					batchSize: 10,
					workerId: `perm-fail-worker-${Date.now()}`,
				});

				await worker.start();
				await new Promise((r) => setTimeout(r, 300));
				await worker.stop();
			}

			await processAttempt();

			const current = await getMessage(msg.id);
			expect(current.attempts).toBe(1);
			expect(current.status).toBe("pending");

			await db
				.update(smsOutbox)
				.set({ nextAttemptAt: null })
				.where(eq(smsOutbox.id, msg.id));

			await processAttempt();

			const failed = await getMessage(msg.id);
			expect(failed.status).toBe("failed");
			expect(failed.isPermanentFailure).toBe(true);
			expect(failed.attempts).toBe(2);
			expect(failed.nextAttemptAt).toBeNull();
			expect(failed.errorMessage).toContain("invalid");
		});

		it("should exhaust retries then mark permanent failure", async () => {
			const msg = await createTestMessage({
				maxAttempts: 2,
			});

			mockSendHandler = () => ({
				success: false,
				error: "Service unavailable",
			});

			const worker = createSmsWorker({
				pollIntervalMs: 100,
				batchSize: 10,
				workerId: "exhaust-retries-worker",
			});

			await worker.start();

			await waitFor(async () => {
				const m = await getMessage(msg.id);
				return m?.attempts === 1;
			}, 5000);

			await worker.stop();

			await db
				.update(smsOutbox)
				.set({ nextAttemptAt: null })
				.where(eq(smsOutbox.id, msg.id));

			const worker2 = createSmsWorker({
				pollIntervalMs: 100,
				batchSize: 10,
				workerId: "exhaust-retries-worker-2",
			});

			await worker2.start();

			await waitFor(async () => {
				const m = await getMessage(msg.id);
				return m?.status === "failed";
			}, 5000);

			await worker2.stop();

			const failed = await getMessage(msg.id);
			expect(failed.status).toBe("failed");
			expect(failed.isPermanentFailure).toBe(true);
			expect(failed.attempts).toBe(2);
		});
	});

	describe("Atomic Claiming", () => {
		it("should claim messages atomically with FOR UPDATE SKIP LOCKED", async () => {
			await cleanupTestData();

			const createdMessages: string[] = [];
			for (let i = 0; i < 5; i++) {
				const msg = await createTestMessage({
					phoneNumber: `+91987654000${i}`,
				});
				createdMessages.push(msg.id);
			}

			const messages = await db
				.select()
				.from(smsOutbox)
				.where(eq(smsOutbox.organizationId, TEST_ORG_ID));
			expect(messages.length).toBe(5);

			const results = await Promise.all([
				claimMessages({
					workerId: "worker-a",
					batchSize: 5,
					skipLocked: true,
				}),
				claimMessages({
					workerId: "worker-b",
					batchSize: 5,
					skipLocked: true,
				}),
			]);

			const claimed1 = results[0];
			const claimed2 = results[1];

			const allClaimed = [...claimed1, ...claimed2];
			expect(allClaimed.length).toBe(5);

			const ids = allClaimed.map((m) => m.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(5);

			for (const msg of allClaimed) {
				expect(msg.status).toBe("processing");
				expect(msg.lockedBy).toBeTruthy();
			}
		});

		it("should set lock metadata when claiming", async () => {
			await cleanupTestData();
			const msg = await createTestMessage();

			const claimed = await claimMessages({
				workerId: "metadata-test-worker",
				batchSize: 1,
			});

			expect(claimed.length).toBe(1);
			expect(claimed[0].id).toBe(msg.id);
			expect(claimed[0].status).toBe("processing");
			expect(claimed[0].lockedBy).toBe("metadata-test-worker");
			expect(claimed[0].lockedAt).not.toBeNull();
			expect(claimed[0].processingStartedAt).not.toBeNull();
		});
	});

	describe("Graceful Shutdown", () => {
		it("should complete in-flight work before stopping", async () => {
			const msg = await createTestMessage();

			mockSendDelay = 1000;

			const worker = createSmsWorker({
				pollIntervalMs: 50,
				batchSize: 10,
				workerId: "graceful-shutdown-worker",
			});

			await worker.start();

			await new Promise((r) => setTimeout(r, 200));

			const shutdownPromise = worker.shutdown();
			await shutdownPromise;

			const final = await getMessage(msg.id);
			expect(final.status).toBe("sent");
		});
	});
});
