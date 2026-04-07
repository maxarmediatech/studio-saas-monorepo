const DEFAULT_CLOUD_API_VERSION = "v22.0";

type GraphErrorPayload = {
	error?: {
		message?: string;
		error_user_msg?: string;
		error_user_title?: string;
	};
};

type PhoneNumberResponse = {
	display_phone_number?: string;
	verified_name?: string;
	quality_rating?: string;
	messaging_limit_tier?: string;
};

type PhoneNumberListResponse = {
	data?: Array<{
		id?: string;
	}>;
};

export interface CloudApiValidationResult {
	apiVersion: string;
	displayPhoneNumber: string | null;
	verifiedName: string | null;
	qualityRating: string | null;
	messagingLimitTier: string | null;
}

const parseGraphError = (payload: unknown, fallback: string) => {
	const error = (payload as GraphErrorPayload | null)?.error;
	return (
		error?.error_user_msg ??
		error?.message ??
		error?.error_user_title ??
		fallback
	);
};

const fetchGraph = async <T>(
	path: string,
	accessToken: string,
	fallbackMessage: string,
) => {
	const response = await fetch(`https://graph.facebook.com/${path}`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	const payload = (await response.json().catch(() => null)) as T | null;
	if (!response.ok) {
		throw new Error(parseGraphError(payload, fallbackMessage));
	}

	if (!payload) {
		throw new Error(fallbackMessage);
	}

	return payload;
};

const postGraph = async (
	path: string,
	accessToken: string,
	body: Record<string, unknown>,
	fallbackMessage: string,
) => {
	const response = await fetch(`https://graph.facebook.com/${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken}`,
		},
		body: JSON.stringify(body),
	});

	const payload = (await response.json().catch(() => null)) as unknown;
	if (!response.ok) {
		throw new Error(parseGraphError(payload, fallbackMessage));
	}
};

export const validateCloudApiAccount = async (params: {
	accessToken: string;
	phoneNumberId: string;
	wabaId?: string | null;
	apiVersion?: string | null;
}) => {
	const apiVersion = params.apiVersion?.trim() || DEFAULT_CLOUD_API_VERSION;

	const phone = await fetchGraph<PhoneNumberResponse>(
		`${apiVersion}/${params.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier`,
		params.accessToken,
		"Failed to validate WhatsApp phone number",
	);

	if (params.wabaId) {
		const phoneNumbers = await fetchGraph<PhoneNumberListResponse>(
			`${apiVersion}/${params.wabaId}/phone_numbers?fields=id`,
			params.accessToken,
			"Failed to validate WhatsApp business account",
		);

		const matchingPhone = phoneNumbers.data?.find(
			(item) => item.id === params.phoneNumberId,
		);

		if (!matchingPhone) {
			throw new Error(
				`Phone number ID ${params.phoneNumberId} does not belong to WABA ${params.wabaId}`,
			);
		}
	}

	return {
		apiVersion,
		displayPhoneNumber: phone.display_phone_number ?? null,
		verifiedName: phone.verified_name ?? null,
		qualityRating: phone.quality_rating ?? null,
		messagingLimitTier: phone.messaging_limit_tier ?? null,
	} satisfies CloudApiValidationResult;
};

export const markCloudApiMessagesRead = async (params: {
	accessToken: string;
	phoneNumberId: string;
	messageIds: string[];
	apiVersion?: string | null;
}) => {
	const apiVersion = params.apiVersion?.trim() || DEFAULT_CLOUD_API_VERSION;

	await Promise.all(
		params.messageIds.map(async (messageId) => {
			await postGraph(
				`${apiVersion}/${params.phoneNumberId}/messages`,
				params.accessToken,
				{
					messaging_product: "whatsapp",
					status: "read",
					message_id: messageId,
				},
				`Failed to mark WhatsApp message ${messageId} as read`,
			);
		}),
	);
};

export { DEFAULT_CLOUD_API_VERSION };
