import { getUploadsBucketName } from "@repo/env";
import { getSignedUrl } from "@repo/storage";
import type { WhatsAppProvider } from "@repo/whatsapp-core";
import { CloudApiProvider } from "@repo/whatsapp-providers";
import { decryptWhatsAppStoredSecret } from "./secret";
import type { ProviderFactory, WhatsAppOutboxItem } from "./types";

const OUTBOUND_MEDIA_URL_EXPIRY_SECONDS = Number(
	process.env.WHATSAPP_MEDIA_SEND_URL_TTL_SECONDS ?? 15 * 60,
);

type ProviderSendError = { code?: string; message?: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

export const defaultProviderFactory: ProviderFactory = (item) => {
	if (!item.account.accessToken || !item.account.phoneNumberId) {
		throw new Error("Missing Cloud API credentials");
	}

	return new CloudApiProvider({
		accessToken: decryptWhatsAppStoredSecret(item.account.accessToken),
		phoneNumberId: item.account.phoneNumberId,
	});
};

export const isPermanentProviderError = (
	error: ProviderSendError | undefined,
) => {
	const code = error?.code;
	const message = error?.message?.toLowerCase() ?? "";
	return (
		(code !== undefined &&
			["10", "100", "190", "200", "368", "131031"].includes(code)) ||
		message.includes("authentication") ||
		message.includes("access token") ||
		message.includes("permission") ||
		message.includes("unsupported post request") ||
		message.includes("does not exist") ||
		message.includes("recipient phone number not in allowed list")
	);
};

const parseTemplateComponents = (value: unknown) => {
	if (!isRecord(value) || !Array.isArray(value.components)) {
		return [];
	}
	return value.components.filter(isRecord).flatMap((component) => {
		if (typeof component.type !== "string" || !component.type) {
			return [];
		}
		return [
			{
				type: component.type,
				parameters: Array.isArray(component.parameters)
					? component.parameters.filter(isRecord)
					: undefined,
			},
		];
	});
};

export const prepareProviderSend = async (params: {
	item: WhatsAppOutboxItem;
	provider: WhatsAppProvider;
}) => {
	const recipient =
		params.item.contact.phoneNumber || params.item.contact.waId;
	if (!recipient) {
		throw new Error("Missing recipient phone number");
	}

	const message = params.item.message;
	const textBody = message.textBody;
	if (message.type === "text" && textBody) {
		return () =>
			params.provider.messaging.sendText({
				to: recipient,
				text: textBody,
			});
	}

	const templateName = message.templateName;
	if (message.type === "template" && templateName) {
		const sendTemplate = params.provider.messaging.sendTemplate;
		if (!sendTemplate) {
			throw new Error("Provider does not support template sending");
		}
		const language = isRecord(message.templateParams)
			? message.templateParams.language
			: null;
		if (typeof language !== "string" || !language) {
			throw new Error("Missing template language");
		}
		return () =>
			sendTemplate({
				to: recipient,
				templateName,
				language,
				components: parseTemplateComponents(message.templateParams),
			});
	}

	const mediaType = [
		"image",
		"video",
		"audio",
		"document",
		"sticker",
	].includes(message.type)
		? (message.type as "image" | "video" | "audio" | "document" | "sticker")
		: null;
	if (!mediaType || !params.item.media?.storageUrl) {
		throw new Error(`Invalid outbound WhatsApp ${message.type} payload`);
	}

	const mediaUrl =
		params.item.media.storageType === "s3"
			? await getSignedUrl(params.item.media.storageUrl, {
					bucket: getUploadsBucketName(),
					expiresIn: OUTBOUND_MEDIA_URL_EXPIRY_SECONDS,
				})
			: params.item.media.storageUrl;
	return () =>
		params.provider.messaging.sendMedia({
			to: recipient,
			mediaUrl,
			mediaType,
			caption: message.caption ?? undefined,
		});
};
