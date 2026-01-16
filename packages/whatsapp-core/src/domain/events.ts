import { MessageStatus, MessageType } from "./models";

export interface InboundMessageEvent {
	type: "message.inbound";
	accountId: string;
	providerEventId: string;
	providerMessageId: string;
	from: string;
	fromName?: string;
	timestamp: Date;
	messageType: MessageType;
	content: {
		text?: string;
		mediaUrl?: string;
		caption?: string;
	};
}

export interface MessageStatusEvent {
	type: "message.status";
	accountId: string;
	providerEventId: string;
	providerMessageId: string;
	status: Exclude<MessageStatus, "pending" | "queued">;
	timestamp: Date;
	error?: { code: string; message: string };
}

export interface ConnectionStatusEvent {
	type: "connection.status";
	accountId: string;
	status: "connected" | "disconnected" | "qr_pending" | "banned";
	qrCode?: string;
	error?: string;
}

export type WhatsAppEvent =
	| InboundMessageEvent
	| MessageStatusEvent
	| ConnectionStatusEvent;
