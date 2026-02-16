export interface SmsSendParams {
	to: string;
	message: string;
	templateId?: string;
	variables?: Record<string, string | number | boolean>;
}

export interface SmsSendResult {
	success: boolean;
	messageId?: string;
	error?: string;
	errorCode?: string;
	statusCode?: number;
	retryable?: boolean;
	permanentFailure?: boolean;
}

export type SmsSendHandler = (params: SmsSendParams) => Promise<SmsSendResult>;

export interface SmsProvider {
	send: SmsSendHandler;
}

export interface SmsTemplate {
	id: string;
	flowId: string;
	dltTemplateId: string;
	name: string;
	variables: Record<string, any>;
}
