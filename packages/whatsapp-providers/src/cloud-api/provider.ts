import type {
	Capability,
	MessagingPort,
	ProvisioningPort,
	SendMediaParams,
	SendResult,
	SendTemplateParams,
	SendTextParams,
	StartLinkResult,
	WhatsAppProvider,
} from "@repo/whatsapp-core";

export interface CloudApiConfig {
	accessToken: string;
	phoneNumberId: string;
	apiVersion?: string;
	webhookVerifyToken?: string;
}

const DEFAULT_VERSION = "v22.0";

const buildBaseUrl = (apiVersion: string, phoneNumberId: string) =>
	`https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;

const parseError = (data: unknown) => {
	if (!data || typeof data !== "object") {
		return { code: "UNKNOWN_ERROR", message: "Unknown error" };
	}

	const error = (data as { error?: { code?: number; message?: string } }).error;
	if (!error) {
		return { code: "UNKNOWN_ERROR", message: "Unknown error" };
	}

	return {
		code: String(error.code ?? "UNKNOWN_ERROR"),
		message: error.message ?? "Unknown error",
	};
};

const parseMessageId = (data: unknown) => {
	if (!data || typeof data !== "object") {
		return undefined;
	}

	const messages = (data as { messages?: Array<{ id?: string }> }).messages;
	return messages?.[0]?.id;
};

class CloudApiProvisioning implements ProvisioningPort {
	public constructor(private readonly config: CloudApiConfig) {}

	async startLink(): Promise<StartLinkResult> {
		if (!this.config.accessToken || !this.config.phoneNumberId) {
			return { status: "error" as const, error: "Missing Cloud API credentials" };
		}

		return { status: "connected" as const };
	}

	async getStatus() {
		return this.config.accessToken ? "connected" : "disconnected";
	}

	async disconnect() {
		return;
	}

	verifyWebhook(challenge: string, verifyToken: string) {
		if (!this.config.webhookVerifyToken) {
			return null;
		}

		return this.config.webhookVerifyToken === verifyToken ? challenge : null;
	}
}

class CloudApiMessaging implements MessagingPort {
	public constructor(private readonly config: CloudApiConfig) {}

	private async sendRequest(payload: Record<string, unknown>): Promise<SendResult> {
		const apiVersion = this.config.apiVersion ?? DEFAULT_VERSION;
		const url = `${buildBaseUrl(apiVersion, this.config.phoneNumberId)}/messages`;

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.config.accessToken}`,
			},
			body: JSON.stringify(payload),
		});

		const data = await response.json().catch(() => null);

		if (!response.ok) {
			return {
				success: false,
				error: parseError(data),
			};
		}

		return {
			success: true,
			providerMessageId: parseMessageId(data),
		};
	}

	async sendText(params: SendTextParams): Promise<SendResult> {
		return this.sendRequest({
			messaging_product: "whatsapp",
			recipient_type: "individual",
			to: params.to,
			type: "text",
			text: {
				body: params.text,
				preview_url: false,
			},
		});
	}

	async sendMedia(params: SendMediaParams): Promise<SendResult> {
		const mediaPayload: Record<string, unknown> = {
			link: params.mediaUrl,
		};

		if (params.caption) {
			mediaPayload.caption = params.caption;
		}

		return this.sendRequest({
			messaging_product: "whatsapp",
			recipient_type: "individual",
			to: params.to,
			type: params.mediaType,
			[params.mediaType]: mediaPayload,
		});
	}

	async sendTemplate(params: SendTemplateParams): Promise<SendResult> {
		return this.sendRequest({
			messaging_product: "whatsapp",
			recipient_type: "individual",
			to: params.to,
			type: "template",
			template: {
				name: params.templateName,
				language: { code: params.language },
				components: params.components ?? [],
			},
		});
	}

	async markRead(messageIds: string[]): Promise<void> {
		const apiVersion = this.config.apiVersion ?? DEFAULT_VERSION;
		const url = `${buildBaseUrl(apiVersion, this.config.phoneNumberId)}/messages`;

		await Promise.all(
			messageIds.map(async (messageId) => {
				await fetch(url, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.config.accessToken}`,
					},
					body: JSON.stringify({
						messaging_product: "whatsapp",
						status: "read",
						message_id: messageId,
					}),
				});
			}),
		);
	}

	supports(capability: Capability) {
		const supported = new Set<Capability>([
			"media_send",
			"media_receive",
			"templates",
			"interactive",
			"read_receipts",
		]);

		return supported.has(capability);
	}
}

export class CloudApiProvider implements WhatsAppProvider {
	readonly type = "cloud_api" as const;
	readonly capabilities = new Set<Capability>([
		"media_send",
		"media_receive",
		"templates",
		"interactive",
		"read_receipts",
	]);

	readonly provisioning: ProvisioningPort;
	readonly messaging: MessagingPort;

	constructor(private readonly config: CloudApiConfig) {
		this.provisioning = new CloudApiProvisioning(config);
		this.messaging = new CloudApiMessaging(config);
	}

	async destroy() {
		return;
	}
}
