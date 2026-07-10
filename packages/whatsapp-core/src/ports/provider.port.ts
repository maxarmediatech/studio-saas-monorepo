export type ProviderType = "baileys" | "cloud_api";

export type Capability =
	| "media_send"
	| "media_receive"
	| "templates"
	| "interactive"
	| "groups"
	| "reactions"
	| "read_receipts"
	| "typing_indicator"
	| "presence";

export interface StartLinkResult {
	status: "qr_pending" | "connected" | "error";
	qrCode?: string;
	qrExpiresAt?: Date;
	error?: string;
}

export interface SendTextParams {
	to: string;
	text: string;
}

export interface SendMediaParams {
	to: string;
	mediaUrl: string;
	mediaType: "image" | "video" | "audio" | "document" | "sticker";
	caption?: string;
}

export interface SendTemplateParams {
	to: string;
	templateName: string;
	language: string;
	components?: Array<{
		type: string;
		parameters?: Array<Record<string, unknown>>;
		subType?: string;
		index?: number;
	}>;
}

export interface SendResult {
	success: boolean;
	providerMessageId?: string;
	error?: { code: string; message: string };
}

export interface ProvisioningPort {
	startLink(): Promise<StartLinkResult>;
	getStatus(): Promise<
		"connected" | "disconnected" | "qr_pending" | "banned"
	>;
	disconnect(): Promise<void>;
	verifyWebhook?(challenge: string, verifyToken: string): string | null;
}

export interface MessagingPort {
	sendText(params: SendTextParams): Promise<SendResult>;
	sendMedia(params: SendMediaParams): Promise<SendResult>;
	sendTemplate?(params: SendTemplateParams): Promise<SendResult>;
	markRead(messageIds: string[]): Promise<void>;
	supports(capability: Capability): boolean;
}

export interface WhatsAppProvider {
	readonly type: ProviderType;
	readonly capabilities: Set<Capability>;
	provisioning: ProvisioningPort;
	messaging: MessagingPort;
	destroy(): Promise<void>;
}
