import { MessageType } from "./models";

export interface SendTextCommand {
	accountId: string;
	to: string;
	text: string;
}

export interface SendMediaCommand {
	accountId: string;
	to: string;
	mediaUrl: string;
	mediaType: Exclude<MessageType, "text" | "template" | "interactive" | "contact" | "location">;
	caption?: string;
}

export type SendMessageCommand = SendTextCommand | SendMediaCommand;
