import type { Locale } from "@repo/i18n";

export interface MailAddress {
	name?: string;
	address: string;
}

export interface MailAttachment {
	filename: string;
	content: string;
	contentType?: string;
}

export interface SendEmailParams {
	to: string;
	subject: string;
	text: string;
	html?: string;
	from?: MailAddress;
	replyTo?: string;
	attachments?: MailAttachment[];
}

export type SendEmailHandler = (params: SendEmailParams) => Promise<void>;

export interface MailProvider {
	send: SendEmailHandler;
}

export type BaseMailProps = {
	locale: Locale;
	translations: any;
};
