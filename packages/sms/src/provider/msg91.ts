import { logger } from "@repo/logs";
import type { SmsProvider, SmsSendParams, SmsSendResult } from "../types";

const MSG91_API_URL = "https://api.msg91.com/api/v5/flow/";
const REQUEST_TIMEOUT_MS = 15000;

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

type PhoneValidationResult =
	| { valid: true; normalized: string }
	| { valid: false; error: string };

function normalizeAndValidatePhone(phone: string): PhoneValidationResult {
	const stripped = phone.replace(/[\s\-()]/g, "");

	if (!stripped || stripped.trim() === "") {
		return { valid: false, error: "Phone number is invalid: empty" };
	}

	let digitsOnly = stripped.replace(/^\+/, "");

	if (!/^\d+$/.test(digitsOnly)) {
		return {
			valid: false,
			error: "Phone number is invalid: contains non-digit characters",
		};
	}

	if (digitsOnly.startsWith("0091")) {
		digitsOnly = `91${digitsOnly.slice(4)}`;
	} else if (digitsOnly.startsWith("091")) {
		digitsOnly = `91${digitsOnly.slice(3)}`;
	} else if (digitsOnly.startsWith("0") && digitsOnly.length === 11) {
		digitsOnly = `91${digitsOnly.slice(1)}`;
	} else if (digitsOnly.length === 10) {
		digitsOnly = `91${digitsOnly}`;
	}

	const indianMobilePattern = /^91[6-9]\d{9}$/;
	if (!indianMobilePattern.test(digitsOnly)) {
		return {
			valid: false,
			error: "Phone number is invalid: must be a valid Indian mobile number",
		};
	}

	return { valid: true, normalized: digitsOnly };
}

function maskPhone(phone: string): string {
	if (phone.length < 6) return phone;
	const prefix = phone.slice(0, 2);
	const suffix = phone.slice(-4);
	const masked = "X".repeat(phone.length - 6);
	return `${prefix}${masked}${suffix}`;
}

function classifyError(
	status: number,
	responseText: string,
): { message: string; retryable: boolean } {
	const isRetryable = status === 429 || status >= 500;

	let parsedMessage = responseText;
	try {
		const json = JSON.parse(responseText) as Msg91Response;
		parsedMessage = json.message || responseText;
	} catch {
		parsedMessage = responseText || "Unknown error";
	}

	return {
		message: `[${status}] ${parsedMessage}`,
		retryable: isRetryable,
	};
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

		const phoneValidation = normalizeAndValidatePhone(to);
		if (phoneValidation.valid === false) {
			return {
				success: false,
				error: phoneValidation.error,
			};
		}

		const normalizedPhone = phoneValidation.normalized;

		const body: Record<string, unknown> = {
			flow_id: templateId,
			sender: this.config.senderId,
			mobiles: normalizedPhone,
			route: this.config.route,
			VAR1: message,
		};

		const timeoutError = Symbol("timeout");
		const timeoutPromise = new Promise<typeof timeoutError>((resolve) => {
			setTimeout(() => resolve(timeoutError), REQUEST_TIMEOUT_MS);
		});

		try {
			const fetchPromise = fetch(MSG91_API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					authkey: this.config.authKey,
				},
				body: JSON.stringify(body),
			});

			const result = await Promise.race([fetchPromise, timeoutPromise]);

			if (result === timeoutError) {
				logger.error(
					{ to: maskPhone(normalizedPhone) },
					"MSG91 request timeout",
				);
				return {
					success: false,
					error: "Request timeout after 15 seconds",
				};
			}

			const response = result;
			const responseText = await response.text();
			let data: Msg91Response | null = null;
			try {
				data = JSON.parse(responseText) as Msg91Response;
			} catch {
				data = null;
			}

			if (!response.ok) {
				const { message: errorMsg } = classifyError(
					response.status,
					responseText,
				);
				logger.error(
					{ status: response.status, to: maskPhone(normalizedPhone) },
					"MSG91 API request failed",
				);
				return {
					success: false,
					error: errorMsg,
				};
			}

			if (!data) {
				const errorMsg = `[${response.status}] Invalid response format`;
				logger.error(
					{ status: response.status, to: maskPhone(normalizedPhone) },
					"MSG91 returned non-JSON response",
				);
				return {
					success: false,
					error: errorMsg,
				};
			}

			if (data.type === "error") {
				logger.warn(
					{ response: data, to: maskPhone(normalizedPhone) },
					"MSG91 returned error response",
				);
				return {
					success: false,
					error: data.message || "Unknown MSG91 error",
				};
			}

			logger.info(
				{ requestId: data.request_id, to: maskPhone(normalizedPhone) },
				"SMS sent via MSG91",
			);

			return {
				success: true,
				messageId: data.request_id,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			logger.error(
				{ error, to: maskPhone(normalizedPhone) },
				"MSG91 send failed with exception",
			);

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
