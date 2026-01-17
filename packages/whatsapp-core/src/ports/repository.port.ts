import { WhatsAppEvent } from "../domain/events";
import { WhatsAppMessage } from "../domain/models";

export interface MessageRepository {
	createMessage(message: WhatsAppMessage): Promise<WhatsAppMessage>;
	updateMessageStatus(messageId: string, status: WhatsAppMessage["status"]): Promise<void>;
	findMessageByProviderId(providerMessageId: string): Promise<WhatsAppMessage | null>;
}

export interface EventRepository {
	hasEvent(providerEventId: string): Promise<boolean>;
	recordEvent(event: WhatsAppEvent): Promise<void>;
}
