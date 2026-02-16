import {
	and,
	db,
	eq,
	gte,
	inArray,
	smsOutbox,
} from "@repo/database";
import { logger } from "@repo/logs";
import { send as sendSms } from "../provider";
import type { SmsSendParams, SmsSendResult } from "../types";
import { normalizeAndValidateIndianPhone } from "./phone";

export async function sendSMS(params: SmsSendParams): Promise<SmsSendResult> {
	return sendSms(params);
}

export async function queueSms(params: {
	organizationId: string;
	phoneNumber: string;
	templateId: string;
	variables: Record<string, string | number | boolean>;
}): Promise<void> {
	const phoneValidation = normalizeAndValidateIndianPhone(params.phoneNumber);
	if (!phoneValidation.valid) {
		throw new Error(phoneValidation.error);
	}

	const normalizedPhone = phoneValidation.normalized;

	try {
		const dedupeWindowMs = 60_000;
		const dedupeCutoff = new Date(Date.now() - dedupeWindowMs);
		const existingCandidates = await db
			.select({
				id: smsOutbox.id,
				variables: smsOutbox.variables,
			})
			.from(smsOutbox)
			.where(
				and(
					eq(smsOutbox.organizationId, params.organizationId),
					eq(smsOutbox.phoneNumber, normalizedPhone),
					eq(smsOutbox.templateId, params.templateId),
					inArray(smsOutbox.status, ["pending", "processing"]),
					gte(smsOutbox.createdAt, dedupeCutoff),
				),
			);

		const incomingVariables = stableStringify(params.variables);
		const duplicate = existingCandidates.find(
			(existing) =>
				stableStringify(existing.variables) === incomingVariables,
		);
		if (duplicate) {
			logger.info(
				{
					outboxId: duplicate.id,
					organizationId: params.organizationId,
					templateId: params.templateId,
				},
				"Skipping duplicate SMS queue request",
			);
			return;
		}

		await db.insert(smsOutbox).values({
			organizationId: params.organizationId,
			phoneNumber: normalizedPhone,
			templateId: params.templateId,
			variables: params.variables,
			status: "pending",
			attempts: 0,
			maxAttempts: 3,
		});
	} catch (error) {
		logger.error("Failed to queue SMS", {
			error,
			organizationId: params.organizationId,
			templateId: params.templateId,
			phoneNumber: maskPhone(normalizedPhone),
		});
		throw error;
	}
}

function stableStringify(value: unknown): string {
	return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => sortJsonValue(item));
	}

	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(record).sort()) {
			const item = record[key];
			if (item !== undefined) {
				sorted[key] = sortJsonValue(item);
			}
		}
		return sorted;
	}

	return value;
}

function maskPhone(phone: string): string {
	if (phone.length < 6) return phone;
	const prefix = phone.slice(0, 2);
	const suffix = phone.slice(-4);
	const masked = "X".repeat(phone.length - 6);
	return `${prefix}${masked}${suffix}`;
}
