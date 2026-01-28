import type { SmsProvider, SmsSendParams, SmsSendResult } from "../types";

let provider: SmsProvider | null = null;

export function setProvider(newProvider: SmsProvider): void {
	provider = newProvider;
}

export function getProvider(): SmsProvider {
	if (!provider) {
		throw new Error("SMS provider not configured");
	}
	return provider;
}

export async function send(params: SmsSendParams): Promise<SmsSendResult> {
	const smsProvider = getProvider();
	return smsProvider.send(params);
}
