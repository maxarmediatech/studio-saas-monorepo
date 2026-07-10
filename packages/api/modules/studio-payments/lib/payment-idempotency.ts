import { ORPCError } from "@orpc/server";
import {
	and,
	eq,
	isNull,
	paymentIdempotencyRecords,
	receivedAmounts,
} from "@repo/database";
import { formatAmount, trackActivityWithExecutor } from "../../activities/lib";
import type { TransactionClient } from "../../studio/lib/transactions";
import type {
	ConvertScheduleInput,
	ConvertScheduleOutput,
	CreateReceivedInput,
	CreateReceivedOutput,
} from "../../studio/schemas/payment";
import {
	convertSchedulePaymentFingerprint,
	createReceivedPaymentFingerprint,
} from "./payment-request-fingerprint";
import {
	convertSchedulePaymentTransition,
	createReceivedPaymentTransition,
} from "./schedule-payment-service";

export const PAYMENT_IDEMPOTENCY_CONFLICT_MESSAGE =
	"This idempotency key was already used for a different payment request";

export const PAYMENT_IDEMPOTENCY_OPERATIONS = {
	createReceived: "create_received_payment",
	convertSchedule: "convert_schedule_payment",
} as const;

type PaymentIdempotencyOperation =
	(typeof PAYMENT_IDEMPOTENCY_OPERATIONS)[keyof typeof PAYMENT_IDEMPOTENCY_OPERATIONS];

interface PaymentActor {
	actorName: string;
	organizationId: string;
	userId: string;
}

export const CREATE_RECEIVED_SUCCESS_MESSAGE = "Payment recorded successfully";
export const CONVERT_SCHEDULE_SUCCESS_MESSAGE =
	"Payment schedule converted successfully";

async function executeIdempotently<T extends Record<string, unknown>>({
	tx,
	organizationId,
	operation,
	idempotencyKey,
	requestFingerprint,
	execute,
}: {
	tx: TransactionClient;
	organizationId: string;
	operation: PaymentIdempotencyOperation;
	idempotencyKey: string;
	requestFingerprint: string;
	execute: () => Promise<{
		resourceId: string;
		result: T;
	}>;
}): Promise<{ result: T; replayed: boolean }> {
	const [claim] = await tx
		.insert(paymentIdempotencyRecords)
		.values({
			organizationId,
			operation,
			idempotencyKey,
			requestFingerprint,
			status: "processing",
		})
		.onConflictDoNothing({
			target: [
				paymentIdempotencyRecords.organizationId,
				paymentIdempotencyRecords.operation,
				paymentIdempotencyRecords.idempotencyKey,
			],
		})
		.returning({ id: paymentIdempotencyRecords.id });

	if (!claim) {
		const existing = await tx.query.paymentIdempotencyRecords.findFirst({
			where: and(
				eq(paymentIdempotencyRecords.organizationId, organizationId),
				eq(paymentIdempotencyRecords.operation, operation),
				eq(paymentIdempotencyRecords.idempotencyKey, idempotencyKey),
			),
		});

		if (!existing) {
			throw new ORPCError("CONFLICT", {
				message: "Payment request claim changed. Retry the request.",
			});
		}
		if (existing.requestFingerprint !== requestFingerprint) {
			throw new ORPCError("CONFLICT", {
				message: PAYMENT_IDEMPOTENCY_CONFLICT_MESSAGE,
			});
		}
		if (
			existing.status !== "completed" ||
			!existing.resultResourceId ||
			!existing.resultPayload
		) {
			throw new ORPCError("CONFLICT", {
				message:
					"Payment request is still processing. Retry the request.",
			});
		}

		const resource = await tx.query.receivedAmounts.findFirst({
			where: and(
				eq(receivedAmounts.id, existing.resultResourceId),
				eq(receivedAmounts.organizationId, organizationId),
				isNull(receivedAmounts.deletedAt),
			),
			columns: { id: true },
		});
		if (!resource) {
			throw new ORPCError("CONFLICT", {
				message: "The original payment is no longer available",
			});
		}

		return { result: existing.resultPayload as T, replayed: true };
	}

	const execution = await execute();
	const completedAt = new Date();
	await tx
		.update(paymentIdempotencyRecords)
		.set({
			status: "completed",
			resultResourceId: execution.resourceId,
			resultPayload: execution.result as Record<string, unknown>,
			completedAt,
			updatedAt: completedAt,
		})
		.where(eq(paymentIdempotencyRecords.id, claim.id));

	return { result: execution.result, replayed: false };
}

export async function createReceivedPaymentIdempotently(
	tx: TransactionClient,
	input: CreateReceivedInput & PaymentActor,
) {
	return executeIdempotently({
		tx,
		organizationId: input.organizationId,
		operation: PAYMENT_IDEMPOTENCY_OPERATIONS.createReceived,
		idempotencyKey: input.idempotencyKey,
		requestFingerprint: createReceivedPaymentFingerprint(input),
		execute: async () => {
			const result = await createReceivedPaymentTransition(tx, input);
			const response = {
				data: { id: result.id },
				message: CREATE_RECEIVED_SUCCESS_MESSAGE,
			} satisfies CreateReceivedOutput;
			await trackActivityWithExecutor(
				tx,
				{
					organizationId: input.organizationId,
					user: { id: input.userId, name: input.actorName },
				},
				{
					entityType: "received_amount",
					entityId: result.id,
					entityName: `${formatAmount(input.amount)} via ${input.paymentMethod}`,
					action: "payment_received",
					parentEntityType: "booking",
					parentEntityId: input.bookingId,
					parentEntityName: result.bookingName,
					metadata: {
						amount: input.amount,
						paymentMethod: input.paymentMethod,
					},
				},
			);
			return {
				resourceId: result.id,
				result: response,
			};
		},
	});
}

export async function convertSchedulePaymentIdempotently(
	tx: TransactionClient,
	input: ConvertScheduleInput & PaymentActor,
) {
	return executeIdempotently({
		tx,
		organizationId: input.organizationId,
		operation: PAYMENT_IDEMPOTENCY_OPERATIONS.convertSchedule,
		idempotencyKey: input.idempotencyKey,
		requestFingerprint: convertSchedulePaymentFingerprint(input),
		execute: async () => {
			const result = await convertSchedulePaymentTransition(tx, input);
			const response = {
				data: {
					receivedId: result.receivedId,
					receiptId: result.receiptId,
					scheduleId: result.scheduleId,
				},
				message: CONVERT_SCHEDULE_SUCCESS_MESSAGE,
			} satisfies ConvertScheduleOutput;
			await trackActivityWithExecutor(
				tx,
				{
					organizationId: input.organizationId,
					user: { id: input.userId, name: input.actorName },
				},
				{
					entityType: "payment_schedule",
					entityId: input.scheduleId,
					entityName: `${result.schedule.name} (${formatAmount(result.schedule.amount)})`,
					action: "marked_paid",
					parentEntityType: "booking",
					parentEntityId: result.schedule.bookingId,
					parentEntityName: result.bookingName,
					metadata: {
						paidAmount: input.amount,
						totalPaidAmount: result.paidAmount,
						scheduleStatus: result.scheduleStatus,
						receivedId: result.receivedId,
						receiptId: result.receiptId,
					},
				},
			);
			return {
				resourceId: result.receivedId,
				result: response,
			};
		},
	});
}
