import { logger } from "@repo/logs";
import type { SmsProvider, SmsSendParams, SmsSendResult } from "../types";

const MSG91_API_URL = "https://api.msg91.com/api/v5/flow/";

export interface Msg91Config {
	authKey: string;
	senderId: string;
	route?: number;
}

interface Msg91Response {
	type: "success" | "error";
	message: string;
	request_id?: string;
}

/**
 * Normalizes Indian phone numbers to MSG91 format (919876543210).
 * Handles: 9876543210, +919876543210, 91 9876543210, 919876543210
 */
function normalizePhoneNumber(phone: string): string {
	let normalized = phone.replace(/[\s\-()]/g, "");

	if (normalized.startsWith("+")) {
		normalized = normalized.slice(1);
	}

	if (normalized.length === 10 && /^\d+$/.test(normalized)) {
		normalized = `91${normalized}`;
	}

	if (!/^91\d{10}$/.test(normalized)) {
		logger.warn(
			{ original: phone, normalized },
			"Phone number may not be valid Indian format",
		);
	}

	return normalized;
}

function parseMsg91Error(response: Msg91Response): string {
	return response.message || "Unknown MSG91 error";
}

export class Msg91Provider implements SmsProvider {
	private readonly config: Required<Msg91Config>;

	constructor(config: Msg91Config) {
		this.config = {
			authKey: config.authKey,
			senderId: config.senderId,
			route: config.route ?? 4,
		};
	}

	async send(params: SmsSendParams): Promise<SmsSendResult> {
		const { to, message, templateId } = params;

		if (!templateId) {
			return {
				success: false,
				error: "MSG91 requires a template/flow ID",
			};
		}

		const normalizedPhone = normalizePhoneNumber(to);

		const body: Record<string, unknown> = {
			flow_id: templateId,
			sender: this.config.senderId,
			mobiles: normalizedPhone,
			VAR1: message,
		};

		try {
			const response = await fetch(MSG91_API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					authkey: this.config.authKey,
				},
				body: JSON.stringify(body),
			});

			const data = (await response
				.json()
				.catch(() => null)) as Msg91Response | null;

			if (!response.ok || !data) {
				logger.error(
					{ status: response.status, data },
					"MSG91 API request failed",
				);
				return {
					success: false,
					error: data
						? parseMsg91Error(data)
						: `HTTP ${response.status}`,
				};
			}

			if (data.type === "error") {
				logger.warn(
					{ response: data },
					"MSG91 returned error response",
				);
				return {
					success: false,
					error: parseMsg91Error(data),
				};
			}

			logger.info(
				{ requestId: data.request_id, to: normalizedPhone },
				"SMS sent via MSG91",
			);

			return {
				success: true,
				messageId: data.request_id,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			logger.error({ error }, "MSG91 send failed with exception");

			return {
				success: false,
				error: errorMessage,
			};
		}
	}
}

export function createMsg91Provider(): Msg91Provider {
	const authKey = process.env.MSG91_AUTH_KEY;
	const senderId = process.env.MSG91_SENDER_ID;

	if (!authKey || !senderId) {
		throw new Error(
			"MSG91_AUTH_KEY and MSG91_SENDER_ID environment variables are required",
		);
	}

	return new Msg91Provider({
		authKey,
		senderId,
	});
}
