import { db, smsOutbox } from "@repo/database";
import { logger } from "@repo/logs";
import { send as sendSms } from "../provider";
import type { SmsSendParams, SmsSendResult } from "../types";

export async function sendSMS(params: SmsSendParams): Promise<SmsSendResult> {
	try {
		const result = await sendSms(params);
		return result;
	} catch (error) {
		logger.error(error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function queueSms(params: {
	organizationId: string;
	phoneNumber: string;
	templateId: string;
	variables: Record<string, any>;
}): Promise<void> {
	try {
		await db.insert(smsOutbox).values({
			organizationId: params.organizationId,
			phoneNumber: params.phoneNumber,
			templateId: params.templateId,
			variables: params.variables,
			status: "pending",
			attempts: 0,
			maxAttempts: 3,
		});
	} catch (error) {
		logger.error("Failed to queue SMS", { error, params });
		throw error;
	}
}
