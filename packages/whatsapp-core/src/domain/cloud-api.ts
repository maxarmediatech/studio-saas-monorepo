import type { MessageType } from "./models";

export type CloudApiWebhookEvent =
	| {
			type: "message.inbound";
			phoneNumberId: string;
			providerMessageId: string;
			from: string;
			timestamp: Date;
			messageType: MessageType;
			content: {
				text?: string;
				caption?: string;
				fileName?: string;
				mediaId?: string;
				mimeType?: string;
			};
	  }
	| {
			type: "message.status";
			phoneNumberId: string;
			providerMessageId: string;
			status: "sent" | "delivered" | "read" | "failed";
			timestamp: Date;
			error?: { code: string; message: string };
	  };

const toDate = (value: unknown) => {
	if (typeof value !== "string") {
		return null;
	}

	const timestamp = Number.parseInt(value, 10);
	if (Number.isNaN(timestamp)) {
		return null;
	}

	return new Date(timestamp * 1000);
};

const parseMessageContent = (message: Record<string, unknown>) => {
	const type = message.type;
	if (typeof type !== "string") {
		return null;
	}

	const text = message.text as { body?: string } | undefined;
	const image = message.image as
		| { id?: string; caption?: string; mime_type?: string }
		| undefined;
	const video = message.video as
		| { id?: string; caption?: string; mime_type?: string }
		| undefined;
	const audio = message.audio as
		| { id?: string; mime_type?: string }
		| undefined;
	const document = message.document as
		| {
				id?: string;
				caption?: string;
				filename?: string;
				mime_type?: string;
		  }
		| undefined;
	const sticker = message.sticker as
		| { id?: string; mime_type?: string }
		| undefined;

	const content = {
		text: text?.body,
		caption: image?.caption ?? video?.caption ?? document?.caption,
		fileName: document?.filename,
		mediaId:
			image?.id ?? video?.id ?? audio?.id ?? document?.id ?? sticker?.id,
		mimeType:
			image?.mime_type ??
			video?.mime_type ??
			audio?.mime_type ??
			document?.mime_type ??
			sticker?.mime_type,
	};

	return { type, content };
};

export const parseCloudApiWebhook = (
	payload: unknown,
): CloudApiWebhookEvent[] => {
	if (!payload || typeof payload !== "object") {
		return [];
	}

	const entries = (payload as { entry?: unknown }).entry;
	if (!Array.isArray(entries)) {
		return [];
	}

	const events: CloudApiWebhookEvent[] = [];

	entries.forEach((entry) => {
		const changes = (entry as { changes?: unknown }).changes;
		if (!Array.isArray(changes)) {
			return;
		}

		changes.forEach((change) => {
			const value = (change as { value?: unknown }).value as
				| Record<string, unknown>
				| undefined;
			if (!value) {
				return;
			}

			const metadata = value.metadata as
				| { phone_number_id?: string }
				| undefined;
			const phoneNumberId = metadata?.phone_number_id;
			if (!phoneNumberId) {
				return;
			}

			const messages = value.messages as
				| Array<Record<string, unknown>>
				| undefined;
			if (Array.isArray(messages)) {
				messages.forEach((message) => {
					const messageId = message.id;
					const from = message.from;
					const timestamp = toDate(message.timestamp);
					const content = parseMessageContent(message);

					if (
						typeof messageId !== "string" ||
						typeof from !== "string" ||
						!timestamp ||
						!content
					) {
						return;
					}

					events.push({
						type: "message.inbound",
						phoneNumberId,
						providerMessageId: messageId,
						from,
						timestamp,
						messageType: content.type as MessageType,
						content: content.content,
					});
				});
			}

			const statuses = value.statuses as
				| Array<Record<string, unknown>>
				| undefined;
			if (Array.isArray(statuses)) {
				statuses.forEach((status) => {
					const statusId = status.id;
					const statusValue = status.status;
					const timestamp = toDate(status.timestamp);

					if (
						typeof statusId !== "string" ||
						typeof statusValue !== "string" ||
						!timestamp
					) {
						return;
					}

					if (
						statusValue !== "sent" &&
						statusValue !== "delivered" &&
						statusValue !== "read" &&
						statusValue !== "failed"
					) {
						return;
					}

					const errors = status.errors as
						| Array<{
								code?: number | string;
								title?: string;
								message?: string;
						  }>
						| undefined;
					const firstError = errors?.[0];

					events.push({
						type: "message.status",
						phoneNumberId,
						providerMessageId: statusId,
						status: statusValue,
						timestamp,
						error: firstError
							? {
									code: String(
										firstError.code ?? "UNKNOWN_ERROR",
									),
									message:
										firstError.message ??
										firstError.title ??
										"Unknown error",
								}
							: undefined,
					});
				});
			}
		});
	});

	return events;
};
