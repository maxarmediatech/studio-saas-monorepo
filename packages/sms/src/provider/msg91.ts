import { logger } from "@repo/logs";
import type { SmsProvider, SmsSendParams, SmsSendResult } from "../types";
import { normalizeAndValidateIndianPhone } from "../util/phone";

const MSG91_API_URL = "https://api.msg91.com/api/v5/flow/";
const REQUEST_TIMEOUT_MS = 15000;

export interface Msg91Config {
	authKey: string;
	senderId: string;
}

interface Msg91Response {
	type: "success" | "error";
	message: string;
	request_id?: string;
}

function maskPhone(phone: string): string {
	if (phone.length < 6) return phone;
	const prefix = phone.slice(0, 2);
	const suffix = phone.slice(-4);
	const masked = "X".repeat(phone.length - 6);
	return `${prefix}${masked}${suffix}`;
}

function getErrorCodeFromStatus(status: number): string {
	if (status === 429) return "RATE_LIMIT";
	if (status === 401 || status === 403) return "AUTH_ERROR";
	if (status === 400) return "BAD_REQUEST";
	if (status === 404) return "NOT_FOUND";
	if (status >= 500) return "PROVIDER_ERROR";
	return "PROVIDER_ERROR";
}

function getErrorCodeFromException(errorMessage: string): string {
	const normalized = errorMessage.toUpperCase();
	if (normalized.includes("ENOTFOUND")) return "DNS_ERROR";
	if (normalized.includes("ECONNREFUSED")) return "CONNECTION_REFUSED";
	if (normalized.includes("ETIMEDOUT")) return "TIMEOUT";
	if (normalized.includes("ECONNRESET")) return "CONNECTION_RESET";
	return "REQUEST_ERROR";
}

function classifyError(
	status: number,
	responseText: string,
): { message: string; retryable: boolean; errorCode: string } {
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
		errorCode: getErrorCodeFromStatus(status),
	};
}

export class Msg91Provider implements SmsProvider {
	private readonly config: Required<Msg91Config>;

	constructor(config: Msg91Config) {
		this.config = {
			authKey: config.authKey,
			senderId: config.senderId,
		};
	}

	async send(params: SmsSendParams): Promise<SmsSendResult> {
		const { to, message, templateId, variables } = params;

		if (!templateId) {
			return {
				success: false,
				error: "MSG91 requires a template/flow ID",
				errorCode: "TEMPLATE_REQUIRED",
				retryable: false,
				permanentFailure: true,
			};
		}

		if (templateId.startsWith("FLOW_")) {
			return {
				success: false,
				error: "SMS template flow ID is not configured",
				errorCode: "TEMPLATE_NOT_CONFIGURED",
				retryable: false,
				permanentFailure: true,
			};
		}

		const phoneValidation = normalizeAndValidateIndianPhone(to);
		if (phoneValidation.valid === false) {
			return {
				success: false,
				error: phoneValidation.error,
				errorCode: "INVALID_PHONE",
				retryable: false,
				permanentFailure: true,
			};
		}

		const normalizedPhone = phoneValidation.normalized;

		const body: Record<string, unknown> = {
			flow_id: templateId,
			sender: this.config.senderId,
			mobiles: normalizedPhone,
		};
		const safeVariables = variables ?? {};
		for (const [key, value] of Object.entries(safeVariables)) {
			body[key] = value;
		}
		if (!("VAR1" in body) && message) {
			body.VAR1 = message;
		}

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
					errorCode: "TIMEOUT",
					statusCode: 408,
					retryable: true,
					permanentFailure: false,
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
				const {
					message: errorMsg,
					retryable,
					errorCode,
				} = classifyError(response.status, responseText);
				logger.error(
					{ status: response.status, to: maskPhone(normalizedPhone) },
					"MSG91 API request failed",
				);
				return {
					success: false,
					error: errorMsg,
					errorCode,
					statusCode: response.status,
					retryable,
					permanentFailure: !retryable,
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
					errorCode: "INVALID_RESPONSE",
					statusCode: response.status,
					retryable: true,
					permanentFailure: false,
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
					errorCode: "PROVIDER_ERROR",
					statusCode: response.status,
					retryable: false,
					permanentFailure: true,
				};
			}

			logger.info(
				{ requestId: data.request_id, to: maskPhone(normalizedPhone) },
				"SMS sent via MSG91",
			);

			return {
				success: true,
				messageId: data.request_id,
				statusCode: response.status,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const retryable = true;
			const errorCode = getErrorCodeFromException(errorMessage);
			logger.error(
				{ error, to: maskPhone(normalizedPhone) },
				"MSG91 send failed with exception",
			);

			return {
				success: false,
				error: errorMessage,
				errorCode,
				retryable,
				permanentFailure: !retryable,
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
