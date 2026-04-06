import { config } from "@repo/config";
import { logger } from "@repo/logs";
import type { SendEmailHandler } from "../../types";

const { fromAddress, fromName, replyTo: defaultReplyTo } = config.mails;

function formatAddress({ address, name }: { address: string; name?: string }) {
	return name ? `${name} <${address}>` : address;
}

export const send: SendEmailHandler = async ({
	to,
	subject,
	text,
	html,
	from,
	replyTo,
	attachments,
}) => {
	if (!process.env.RESEND_API_KEY) {
		throw new Error("RESEND_API_KEY is missing.");
	}

	const sender = from ?? {
		address: fromAddress,
		name: fromName,
	};
	const effectiveReplyTo = replyTo ?? defaultReplyTo;
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
		},
		body: JSON.stringify({
			from: formatAddress(sender),
			to,
			subject,
			text,
			html,
			reply_to: effectiveReplyTo,
			attachments,
		}),
	});

	if (!response.ok) {
		const payload = await response.json().catch(() => null);
		logger.error("mail.resend.send_failed", {
			payload,
			status: response.status,
			subject,
			to,
		});
		throw new Error("Could not send email via Resend.");
	}
};
