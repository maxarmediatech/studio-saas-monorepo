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

export interface ProviderConfig {
	accountId: string;
	organizationId: string;
	webhookUrl: string;
	bridgeUrl?: string;
	sessionKey?: string;
	accessToken?: string;
	phoneNumberId?: string;
}
