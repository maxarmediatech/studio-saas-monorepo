export type MessageDirection = "inbound" | "outbound";

export type MessageType =
	| "text"
	| "image"
	| "video"
	| "audio"
	| "document"
	| "sticker"
	| "location"
	| "contact"
	| "template"
	| "interactive";

export type MessageStatus =
	| "pending"
	| "queued"
	| "sent"
	| "delivered"
	| "read"
	| "failed"
	| "delivery_unknown";

export interface WhatsAppAccount {
	id: string;
	organizationId: string;
	name: string;
	provider: "baileys" | "cloud_api";
	connectionStatus:
		| "disconnected"
		| "connecting"
		| "qr_pending"
		| "connected"
		| "banned";
}

export interface WhatsAppContact {
	id: string;
	organizationId: string;
	accountId?: string;
	waId: string;
	phoneNumber: string;
	name?: string;
}

export interface WhatsAppConversation {
	id: string;
	organizationId: string;
	accountId: string;
	contactId: string;
	status: "open" | "closed" | "archived";
}

export interface WhatsAppMessage {
	id: string;
	organizationId: string;
	accountId: string;
	conversationId: string;
	contactId: string;
	direction: MessageDirection;
	type: MessageType;
	status: MessageStatus;
	textBody?: string;
	createdAt: Date;
}
