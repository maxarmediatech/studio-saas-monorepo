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
